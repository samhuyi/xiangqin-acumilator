/* =========================================================
 * 美术资源加载层（主包 + 分包）
 * ---------------------------------------------------------
 * 设计要点（踩过的坑都在这）：
 *  1. 主包图（intro_bg）必须显式加载 —— 它不在任何分包里，
 *     不加载就永远拿不到，表现为「标题页背景是纯色」。
 *  2. 分包图必须「等分包下完再排图」，不能提前排。
 *     —— 这是真机「除了主界面图全都加载失败」的元凶：
 *        开发者工具里分包是本地文件，wx.createImage 立刻命中，看不出问题；
 *        真机上分包还没下完，提前排的图必然 onerror，重试两次（约 1.5 秒）
 *        后就被标成 FAILED；而真机下载往往超过 1.5 秒，等 loadSubpackage
 *        成功回调再去 enqueue 时，会被 FAILED 判断直接挡掉，图就永久没了。
 *     现在的做法：分包 loading 期间失败的图不消耗重试次数、不标 FAILED，
 *     只记进 PENDING；loadSubpackage 一成功（或失败）就整体 resume 重新排队。
 *  3. 失败要重试：偶发的解码/解码排队失败不该让图永久消失。
 *  4. 结果要能诊断：暴露 art.stats()，谁没加载上一眼看得到。
 *
 * 用法：
 *   art.ensureAll();                     // 启动时调一次，主包 + 分包全下
 *   var img = art.roleImg('programmer','m');  // 未就绪返回 null（画占位）
 *
 * 图未就绪时返回 null，渲染层自己画占位，不会崩。
 * ========================================================= */

'use strict';

var MANIFEST = require('../../assets/images/manifest.js');
var ROLE_MAP = require('../../assets/images/role-map.js');
var DB = require('../db/repository.js');

/* 头像 key 的取值来源：数据库（唯一数据源）。
 *   · backgrounds[i].avatar       —— 主角出身背景 → 职业 key
 *   · materials.jobs[i].avatar    —— 相亲对象职业 → 职业 key
 * 数据库里没有该字段时，才回退到 role-map.js（美术兜底，避免老数据直接白屏）。 */
function bgAvatarKey(bgId) {
  var list = DB.list('backgrounds') || [];
  for (var i = 0; i < list.length; i++) {
    if (list[i] && list[i].id === bgId && list[i].avatar) return list[i].avatar;
  }
  return (ROLE_MAP.background && ROLE_MAP.background[bgId]) || null;
}

function jobAvatarKey(jobName) {
  var mats = DB.get('materials') || {};
  var jobs = mats.jobs || [];
  for (var i = 0; i < jobs.length; i++) {
    if (jobs[i] && jobs[i].job === jobName && jobs[i].avatar) return jobs[i].avatar;
  }
  /* 数据库没登记（或老数据）→ 用职业名本身当 key，再退 role-map */
  return (ROLE_MAP.job && ROLE_MAP.job[jobName]) || null;
}

/* 性别 code：数据层用 m / f，容错中文写法 */
var GENDER_CODE = { m: 'm', f: 'f', 男: 'm', 女: 'f' };

var IMG = {};         // path -> Image（加载完成）
var LOADING = {};     // path -> true（正在加载）
var RETRIES = {};     // path -> 已重试次数
var FAILED = {};      // path -> true（重试后仍失败）
var PENDING = {};     // path -> true（分包还没下完，先搁置，不算失败）
var PACK_STATE = {};  // packName -> 'idle' | 'loading' | 'ready' | 'failed'
var PACK_CB = {};     // packName -> [callback]
var redraw = null;    // 由 render 注入的重绘回调
var PATH_PACK = null; // path -> packName（懒建索引）

var MAX_RETRY = 2;          // 每张图最多重试次数
var RETRY_DELAY = 500;      // 重试间隔（毫秒），按次数递增
var CONCURRENCY = 6;        // 同时进行的图片请求数上限

function setRedraw(fn) { redraw = fn; }
function notifyRedraw() { if (redraw) { try { redraw(); } catch (e) { /* ignore */ } } }

function hasWx() {
  return typeof wx !== 'undefined' && wx && wx.createImage;
}

/* ---------------- 图片加载（带并发上限 + 失败重试） ---------------- */
var queue = [];
var active = 0;

/* path → packName 索引（懒建一次） */
function packOf(path) {
  if (!PATH_PACK) {
    PATH_PACK = {};
    var packs = MANIFEST.packs || {};
    Object.keys(packs).forEach(function (n) {
      var im = (packs[n] && packs[n].images) || {};
      Object.keys(im).forEach(function (k) { PATH_PACK[im[k]] = n; });
    });
  }
  return PATH_PACK[path] || null;
}

/* 该图所属的分包还在下载中？（此时取不到图是正常的，不该算失败） */
function packLoading(path) {
  var n = packOf(path);
  if (!n) return false;
  return PACK_STATE[n] === 'loading' || PACK_STATE[n] === 'idle';
}

function enqueue(path) {
  if (!path || IMG[path] || LOADING[path] || FAILED[path]) return;
  for (var i = 0; i < queue.length; i++) { if (queue[i] === path) return; }
  queue.push(path);
  SUMMARY_LOGGED = false;      // 有新活干，最终汇总重打一次
  pump();
}

function pump() {
  if (!queue.length || active >= CONCURRENCY) return;
  var path = queue.shift();
  active++;
  loadOne(path, function () {
    active--;
    pump();
  });
}

function loadOne(path, done) {
  if (!hasWx()) { done(); return; }
  LOADING[path] = true;

  var img;
  try { img = wx.createImage(); } catch (e) { delete LOADING[path]; done(); return; }

  var finish = function (ok) {
    delete LOADING[path];
    if (ok) {
      IMG[path] = img;
      delete FAILED[path];
      delete PENDING[path];
      notifyRedraw();
    } else if (packLoading(path)) {
      /* 分包还没下完 —— 先搁置，等 loadSubpackage 回调统一 resume，
       * 不消耗重试次数、不标 FAILED。（真机图片全挂就是在这里出问题的） */
      PENDING[path] = true;
    } else {
      var n = RETRIES[path] || 0;
      if (n < MAX_RETRY) {
        RETRIES[path] = n + 1;
        setTimeout(function () { enqueue2(path); }, RETRY_DELAY * (n + 1));
      } else {
        FAILED[path] = true;
        console.warn('[相亲模拟器] 图片加载失败（已重试 ' + MAX_RETRY + ' 次）：' + path);
      }
    }
    done();
    maybeSummary();
  };

  img.onload = function () {
    /* 极少数情况下 onload 时尺寸仍为 0，视为失败走重试 */
    finish(!!(img.width > 0 || img.height > 0));
  };
  img.onerror = function () { finish(false); };
  img.src = path;
}

/* 全部落定后打一条汇总日志（每次落定打一次，有新活干会重新武装），
 * 方便一眼看出图片到底加载上没有 */
var SUMMARY_LOGGED = false;
function maybeSummary() {
  if (SUMMARY_LOGGED) return;
  if (active || queue.length) return;
  var st = stats();
  if (st.pending > 0) return;      // 还有图在等分包 / 在重试，先不急着下结论
  SUMMARY_LOGGED = true;
  var packTxt = Object.keys(st.packs).map(function (n) {
    return n + '=' + st.packs[n];
  }).join(' ');
  var line = '[相亲模拟器] 美术资源：' + st.loaded + '/' + st.total + ' 张就绪' +
    '（主包 intro_bg=' + (mainImg('intro_bg') ? 'ok' : 'x') +
    '，分包 ' + packTxt + '；按需 ' + st.lazyLoaded + '/' + st.lazyTotal + '）';
  if (st.failed.length) {
    console.error(line + '，失败 ' + st.failed.length + ' 张：' + st.failed.slice(0, 5).join(', '));
  } else {
    console.log(line);
  }
}

/* 重试走队列，避免同时挤爆 */
function enqueue2(path) {
  if (IMG[path] || LOADING[path] || FAILED[path]) return;
  queue.push(path);
  SUMMARY_LOGGED = false;
  pump();
}

/* ---------------- 主包图：必须显式加载 ---------------- */
function ensureMain() {
  Object.keys(MANIFEST.main || {}).forEach(function (k) { enqueue(MANIFEST.main[k]); });
}

/* ---------------- 按需图（lazy） ----------------
 * 行动页 / 结局页的头部背景：首屏用不到，等真的画到了才排下载。
 * —— 不放进启动队列，避免和「标题页背景 / 头像 / 场景图」抢带宽。
 * 背景加载完成后会自动重绘（loadOne 里 notifyRedraw），
 * 所以先画纯色兜底、图到了再补上，玩家感知是「渐显」而不是空白。
 * ---------------------------------------------------------- */
function lazyPath(key) {
  return (MANIFEST.lazy && MANIFEST.lazy[key]) || null;
}

/* 取按需图（顺手排下载）。未就绪返回 null，调用方画兜底。 */
function lazyImg(key) {
  var p = lazyPath(key);
  if (!p) { warnMissing('lazy', String(key)); return null; }
  enqueue(p);
  return img(p);
}

/* 启动后台补下所有按需图：等主包 + 分包的图都排完了再排，
 * 这样关键图永远排在前面，按需图只是捡带宽。
 * 全部落定后 art.js 会再打一条汇总日志。 */
function preloadLazy() {
  var all = MANIFEST.lazy || {};
  Object.keys(all).forEach(function (k) { enqueue(all[k]); });
}

/* 行动页头部背景：seek_bg / upgrade_bg，按主角性别取图 */
function pageBg(name, gender) {
  return lazyImg(name + '_' + (GENDER_CODE[gender] || 'm'));
}

/* 结局页头部背景：end_<结局美术类型>_<性别>
 * 「结局 → 美术类型」的对应关系存在数据库 endings.art，
 * 渲染层只负责拼 key，不认识任何一个结局 id。 */
function endBg(artKey, gender) {
  if (!artKey) return null;
  return lazyImg('end_' + artKey + '_' + (GENDER_CODE[gender] || 'm'));
}

/* 寻找相亲「没找到合适的」浮窗背景：单张图（不按性别分），路径 /images/bg_seek_fail */
function seekFailBg() {
  return lazyImg('bg_seek_fail');
}

/* ---------------- 分包图 ---------------- */
function packImages(packName) {
  var pack = MANIFEST.packs && MANIFEST.packs[packName];
  if (!pack) return [];
  var im = pack.images || {};
  return Object.keys(im).map(function (k) { return im[k]; });
}

function loadPackImages(packName) {
  packImages(packName).forEach(enqueue);
}

/**
 * 分包就绪（或下载失败）后，整体「解冻」这个分包的图：
 * 清掉 FAILED / PENDING / 重试计数，重新排队。
 * —— 真机上前一次尝试必然失败，必须清干净才有可能加载上。
 */
function resumePack(packName) {
  packImages(packName).forEach(function (p) {
    delete FAILED[p];
    delete PENDING[p];
    RETRIES[p] = 0;
  });
  SUMMARY_LOGGED = false;
  loadPackImages(packName);
  notifyRedraw();
}

/**
 * 确保某个分包的图可用。
 *
 * 关键：分包没下完之前「不排图」。
 * 真机上提前排等于必然失败，而失败次数用光后就会被 enqueue 的 FAILED 判断
 * 永久挡住（这正是「真机除了主界面图全都加载失败」的原因）。
 *
 * @param {string} packName 分包名
 * @param {function} [cb]   cb(true/false) 分包是否可用
 */
function ensure(packName, cb) {
  var pack = MANIFEST.packs && MANIFEST.packs[packName];
  if (!pack) { if (cb) cb(false); return; }

  if (cb) {
    PACK_CB[packName] = PACK_CB[packName] || [];
    PACK_CB[packName].push(cb);
  }

  if (PACK_STATE[packName] === 'ready') {
    loadPackImages(packName);
    flushCb(packName, true);
    return;
  }
  if (PACK_STATE[packName] === 'loading') return;
  if (PACK_STATE[packName] === 'failed') {
    resumePack(packName);          // 再给一次机会（图可能已在主包 / 缓存里）
    flushCb(packName, false);
    return;
  }

  PACK_STATE[packName] = 'loading';

  if (typeof wx === 'undefined' || !wx.loadSubpackage) {
    /* 非微信环境（本地测试）或基础库过老：没得分包概念，按路径直接取图 */
    PACK_STATE[packName] = 'ready';
    loadPackImages(packName);
    flushCb(packName, true);
    return;
  }

  wx.loadSubpackage({
    name: packName,
    success: function () {
      PACK_STATE[packName] = 'ready';
      resumePack(packName);        // 分包到了，这时才真正排图
      flushCb(packName, true);
    },
    fail: function (err) {
      /* 分包没下下来，不代表图取不到：如果图已经在主包里，
       * 按路径直取照样能加载出来。所以先 resume 再核对实际结果。 */
      PACK_STATE[packName] = 'failed';
      resumePack(packName);
      flushCb(packName, false);
      verifyPack(packName, err);
    }
  });
}

/* 分包 fail 后核对实际取图结果：全拿到就当成功，仍有缺图才报警（并点名是哪几张） */
function verifyPack(packName, err) {
  var list = packImages(packName);
  if (!list.length) return;
  var tries = 0;
  var t = setInterval(function () {
    var done = list.filter(function (p) { return !!IMG[p]; }).length;
    if (done === list.length) {
      clearInterval(t);
      PACK_STATE[packName] = 'ready';
      SUMMARY_LOGGED = false;
      notifyRedraw();
      console.log('[相亲模拟器] 分包 ' + packName + ' 未下载，但 ' + done +
        ' 张图已从主包/缓存取到，按就绪处理');
      return;
    }
    if (++tries >= 8) {                        // 约 2 秒后仍不全
      clearInterval(t);
      var missing = list.filter(function (p) { return !IMG[p]; });
      console.warn('[相亲模拟器] 分包 ' + packName + ' 加载失败：' +
        (err && err.errMsg ? err.errMsg : '未知') + '；仍有 ' + missing.length +
        '/' + list.length + ' 张图没取到：' + missing.slice(0, 5).join(', '));
    }
  }, 250);
}

function flushCb(packName, ok) {
  var cbs = PACK_CB[packName] || [];
  PACK_CB[packName] = [];
  cbs.forEach(function (f) { try { f(ok); } catch (e) { /* ignore */ } });
}

/* 一次性把主包 + 所有分包的图都安排下载 */
function ensureAll(cb) {
  ensureMain();
  var names = Object.keys(MANIFEST.packs || {});
  var left = names.length;
  if (!left) { if (cb) cb(true); return; }
  names.forEach(function (n) {
    ensure(n, function () { if (--left === 0 && cb) cb(true); });
  });
}

function ready(packName) { return PACK_STATE[packName] === 'ready'; }

/* ---------------- 取图：只返回已加载完成的 Image ---------------- */
function img(path) { return (path && IMG[path]) || null; }

function packPath(packName, key) {
  var pack = MANIFEST.packs && MANIFEST.packs[packName];
  return (pack && pack.images && pack.images[key]) || null;
}

/* ---- 职业头像：先按「职业-性别」找，缺该性别则回退另一性别 ----
 * 回退会让玩家看到「错性别」的头像（例如男主角用了女头像）——
 * 因此回退时打一条 warn，把缺失的文件名点出来，方便补图。 */
function roleImg(job, gender) {
  if (!job) return null;
  var g = GENDER_CODE[gender] || 'm';
  var other = g === 'm' ? 'f' : 'm';
  var p = packPath('art_role', job + '-' + g) ||
          packPath('art_role', job + '-' + other) ||
          packPath('art_role', job);
  if (!p) { warnMissing('role', job + '-' + g); return null; }
  if (g !== other && !packPath('art_role', job + '-' + g)) {
    /* 缺该性别图，回退到反性别图：醒目的告警，避免再被静默吞掉 */
    console.warn('[相亲模拟器] 角色头像 ' + job + '-' + g + '.png 缺失，已回退到反性别图 ' +
      p.split('/').pop() + '（性别展示会出错，请补图）');
  }
  return img(p);
}

var MISSING = {};   // 记录「映射表指向了不存在的图」，避免刷屏
function warnMissing(kind, key) {
  var k = kind + ':' + key;
  if (MISSING[k]) return;
  MISSING[k] = true;
  console.warn('[相亲模拟器] ' + kind + ' 映射找不到图片：' + key + '（检查 role-map.js / manifest.js）');
}

/* 主角：出身背景 id + 性别 → 头像（头像 key 来自数据库 backgrounds.avatar） */
function heroImg(bgId, gender) {
  var job = bgAvatarKey(bgId);
  if (!job) { warnMissing('background', String(bgId)); return null; }
  return roleImg(job, gender);
}

/* 相亲对象：头像 → 图。
 * 头像 key 的优先级：对象自带的 avatar（partners.avatar）> 职业头像表（materials.jobs）。
 * 这样每个相亲对象可以有自己的专属头像，同时保持「职业 → 头像」的兜底。 */
function partnerImg(jobName, gender, avatarKey) {
  if (!jobName && !avatarKey) return null;
  var job = avatarKey || jobAvatarKey(jobName) || jobName;
  return roleImg(job, gender);
}

/* 场景背景：场景 key → 图（没有映射或图未就绪返回 null） */
function sceneImg(sceneKey) {
  if (!sceneKey) return null;
  var p = packPath('art_scene', sceneKey);
  if (!p) { warnMissing('scene', sceneKey); return null; }
  return img(p);
}

/**
 * 事件 → 场景 key。四级匹配，都命中不了返回 null（不展示背景）：
 *   1) eventScene[ev.id]          按事件 id 显式指定（可写 null 强制不展示）
 *   2) dateTypeScene[dateType]    约会档位默认场景
 *   3) sceneKeys 关键词            正文 + 选项 + extraText（如初遇的见面地点旁白）
 *   4) meetScene                  「赴约初遇」没有档位概念，用默认场景兜底
 *
 * @param {object} ev       事件对象
 * @param {string} dateType 约会档位 id（simple/standard/activity）
 * @param {string} action   行动类型（meet/date/life/…）
 * @param {string} extraText 额外参与关键词匹配的文本（如 introLines 拼起来的旁白）
 */
function sceneNameForEvent(ev, dateType, action, extraText) {
  if (!ev) return null;

  if (ROLE_MAP.eventScene && ev.id in ROLE_MAP.eventScene) {
    return ROLE_MAP.eventScene[ev.id];      // 显式指定（可写 null 表示不要背景）
  }
  if (dateType && ROLE_MAP.dateTypeScene && ROLE_MAP.dateTypeScene[dateType]) {
    return ROLE_MAP.dateTypeScene[dateType];
  }

  var key = matchSceneKey(ev, extraText);
  if (key) return key;

  /* 初遇：玩家没得选场景，给个默认的（比如咖啡馆），可配 null 关闭 */
  if (action === 'meet') return ROLE_MAP.meetScene || null;
  return null;
}

function matchSceneKey(ev, extraText) {
  var hay = (ev.text || []).join(' ') + ' ' +
    (ev.options || []).map(function (o) { return o.label || ''; }).join(' ');
  if (extraText) hay += ' ' + extraText;
  var rules = ROLE_MAP.sceneKeys || [];
  for (var i = 0; i < rules.length; i++) {
    var ks = rules[i].keys || [];
    for (var j = 0; j < ks.length; j++) {
      if (hay.indexOf(ks[j]) >= 0) return rules[i].scene;
    }
  }
  return null;
}

/* 事件 → 场景图（没有对应场景返回 null，由调用方决定兜底） */
function eventSceneImg(ev, dateType, action, extraText) {
  return sceneImg(sceneNameForEvent(ev, dateType, action, extraText));
}

/* 「没有事件对象」的行动（告白 / 求婚）的默认场景：
 * 这些页面走的是行动结算流程，拿不到 ev，靠 actionScene 兜底。 */
function actionScene(action) {
  if (!action) return null;
  return (ROLE_MAP.actionScene && ROLE_MAP.actionScene[action]) || null;
}

/* 主包背景（标题页） */
function mainImg(key) {
  return img(MANIFEST.main && MANIFEST.main[key]);
}

/* ---------------- 诊断 ---------------- */
/* 返回加载概况：总数 / 已就绪 / 失败清单 / 各分包状态。
 * 注意：total 只统计「启动就该下完」的图（main + 分包）；
 * 按需图另算 lazyTotal / lazyLoaded —— 它们没被排下载时不算 pending，
 * 否则那条「美术资源：x/y 张就绪」的汇总日志永远不会输出。 */
function stats() {
  var paths = [];
  Object.keys(MANIFEST.main || {}).forEach(function (k) { paths.push(MANIFEST.main[k]); });
  Object.keys(MANIFEST.packs || {}).forEach(function (p) {
    var im = MANIFEST.packs[p].images || {};
    Object.keys(im).forEach(function (k) { paths.push(im[k]); });
  });
  var failed = [];
  var ok = 0;
  paths.forEach(function (p) {
    if (IMG[p]) ok++;
    else if (FAILED[p]) failed.push(p);
  });

  var lazyPaths = Object.keys(MANIFEST.lazy || {}).map(function (k) { return MANIFEST.lazy[k]; });
  var lazyOk = lazyPaths.filter(function (p) { return !!IMG[p]; }).length;

  var packs = {};
  Object.keys(MANIFEST.packs || {}).forEach(function (n) { packs[n] = PACK_STATE[n] || 'idle'; });

  return {
    total: paths.length,
    loaded: ok,
    failed: failed,
    pending: paths.length - ok - failed.length,
    lazyTotal: lazyPaths.length,
    lazyLoaded: lazyOk,
    packs: packs
  };
}

module.exports = {
  setRedraw: setRedraw,
  ensureMain: ensureMain,
  ensure: ensure,
  ensureAll: ensureAll,
  ready: ready,
  stats: stats,
  img: img,
  roleImg: roleImg,
  bgAvatarKey: bgAvatarKey,
  jobAvatarKey: jobAvatarKey,
  heroImg: heroImg,
  partnerImg: partnerImg,
  sceneImg: sceneImg,
  sceneNameForEvent: sceneNameForEvent,
  eventSceneImg: eventSceneImg,
  actionScene: actionScene,
  mainImg: mainImg,
  /* 按需图（行动页 / 结局页头部背景） */
  lazyPath: lazyPath,
  lazyImg: lazyImg,
  preloadLazy: preloadLazy,
  pageBg: pageBg,
  endBg: endBg,
  seekFailBg: seekFailBg,
  manifest: MANIFEST,
  roleMap: ROLE_MAP
};

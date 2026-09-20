/* =========================================================
 * 《相亲模拟器》渲染层（Canvas 2D）
 * ---------------------------------------------------------
 * 唯一的平台相关层：负责把引擎状态画到 Canvas，并处理触摸交互。
 * 文案全部来自数据库（DB.text），数值由引擎计算，本层不硬编码游戏数据。
 *
 * 布局约定（v2）：
 *   · 屏幕顶部：状态信息（天数 / 倒计时 / 属性）
 *   · 屏幕底部：固定操作区（重开 / 返回 / 上一步 等控制类按钮）
 *   · 事件触发时：弹出模态事件页（含人物 / 背景图片切片位）
 * ========================================================= */

'use strict';

var engine = require('../core/engine.js');
var DB = require('../db/repository.js');
var R = require('./canvas-kit.js');
var gallery = require('./gallery.js');
var ad = require('../core/ad.js');
var audio = require('../audio.js');

var P = R.PALETTE;

var SAVE_KEY = 'xq_save_v1';
/* 广告奖励单独存一个 key：它属于「上一局看广告换来的」，
 * 不能被 clearSave()（重开清档）一起清掉，否则玩家看完广告一点重开就白看了。 */
var AD_REWARD_KEY = 'xq_ad_reward_v1';

var canvas = null, ctx = null;
var W = 0, H = 0, DPR = 1, SAFE_TOP = 0, SAFE_BOTTOM = 0;

var S = null;
var today = null;
var scene = 'loading';       // loading | intro | title | rules | setup | play | end | error
var errorLines = [];         // 错误页问题清单（云端数据异常时显示）
var pendingAction = null;    // 当前选中项对应的执行函数（配合 pendingKey）
var setupStep = 0;
var pick = { gender: null, bgId: null, goalId: null, difficulty: null, seed: 1 };

/* 相亲图鉴：当前浏览的性别分栏（f=女生 / m=男生）与详情页选中的对象 id */
var galleryTab = 'f';
var galleryPickId = null;

/* 倒计时暂停原因 → 文案 key（state 由 engine.deadlineState 给出） */
var DEADLINE_HINT_KEY = {
  single: 'deadlineSingle',
  lead: 'deadlineLead',
  meeting: 'deadlineMeeting',
  talking: 'deadlineTalking',
  settled: 'deadlinePaused'
};

var buttons = [];            // 滚动内容命中区（内容坐标系）
var fixedButtons = [];       // 底部固定操作区命中区（屏幕坐标系）
var pressedBox = null;       // 当前按下的按钮命中框（按下视觉反馈用，松手即清空）
var bottomActions = [];      // 本帧待绘制的底部操作按钮
var bottomHint = null;        // 底部确认栏上方的「当前已选」提示（开局设定等页面设置）
var barTopY = 0;             // 本帧底部叠加层（含提示）顶边，供布局审计跳过
var scrollY = 0;
var contentH = 0;
var C = { y: 0 };            // 内容绘制游标

var introIdx = 0;
var introTimer = null;

/* 两步确认：所有点击位首次点击仅选中，再次点击同一位置才执行 */
var pendingKey = null;
var lastCtxKey = '';        // 场景/阶段指纹，变化即清除待确认态

/* 模态叠层（交往风格）打开时：下层页面只负责当背景，
 * 既不登记点击区、也不登记底部操作区，避免隔层误触。 */
var modalInert = false;

/* ---- 布局常量（留白加大，避免过于紧凑） ---- */
var PAD = 18;                // 左右页边距
var GAP = 14;                // 元素间距
var LINEH = 24;              // 正文行高
var CARD_PAD = 16;           // 卡片内边距
var BOTTOM_GAP = 16;         // 底部操作区到屏幕底的距离
var BAR_BTN_H = 46;          // 底部按钮高度
var BAR_RESERVE = 82;        // 内容区为底部操作区预留的高度
var MUSIC_BTN = 36;          // 左上角音乐浮窗直径
var TOP_INSET = MUSIC_BTN + 8;   // 内容区顶部预留：给左上角音乐浮窗让位（所有页面统一）

/* =========================================================
 * 图标（emoji）选用约定
 * ---------------------------------------------------------
 * 小游戏 Canvas 的 emoji 是借系统字体画的，安卓机型字体覆盖率差别很大：
 *   · 需要变体选择符（U+FE0F）才呈彩色样式的（🌤️ 🍽️ ☕ ❤️ ✉）在部分机型上会退化成
 *     黑白字形，甚至因为字形缺失画成方块 —— 玩家看到的就是「乱码」；
 *   · Unicode 7.0 之后才收录的（🤝 😴 🌤️ 🍽️）在老安卓上直接缺字。
 * 因此这里只用「Unicode 6.0 时代、各平台都有彩色字形」的图标，
 * 并在绘制时用 emoji 字体族兜底（见 canvas-kit 的 setEmojiFont）。
 * 已替换：🌤️→🌱  🍽️→🍜  ☕→🍵  ❤️→💪  ✉→💌  🤝→👋  😴→🌙
 * ========================================================= */
var ICON = {
  planOther: '🌱',    // 其余安排（过日子 / 提升 / 加班 / 休息）
  date: '🍜',         // 约会
  dateSimple: '🍵',   // 约会档位：简单的
  dateActivity: '🎡', // 约会档位：活动类
  meet: '👋',         // 赴约 / 见面
  rest: '🌙',         // 休息
  health: '💪',       // 健康属性
  chance: '💌',       // 相亲机会角标
  warn: '🚨'          // 关系预警（主界面关系卡上的常驻提醒）
};

/* =========================================================
 * 美术资源（主包 + 分包）
 * ---------------------------------------------------------
 * 统一由 js/ui/art.js 负责：主包图直接用，分包图先 loadSubpackage 再取。
 *   · intro_bg  主包   → 标题页全屏背景
 *   · art_role  分包   → 职业头像（主角按出身背景、对象按职业）
 *   · art_scene 分包   → 约会场景背景（事件与场景一一对应，无则不展示）
 * 图未就绪时画占位（纯色底 + 文字），不会崩。
 * ========================================================= */
var art = require('./art.js');

/* 以「cover」方式把图片铺满目标矩形（等比缩放 + 居中裁剪，不变形） */
function drawCoverImage(img, x, y, w, h) {
  if (!img || !img.width || !img.height) return;
  var s = Math.max(w / img.width, h / img.height);
  var dw = img.width * s, dh = img.height * s;
  var dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

/* 占位：图还没下载好 / 该职业没有对应头像时画这个 */
function drawImgPlaceholder(x, y, w, h, text) {
  R.fillRoundRect(ctx, x, y, w, h, 8, '#efe7da');
  R.roundRectPath(ctx, x, y, w, h, 8);
  ctx.strokeStyle = '#e2d8c8';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (text) centerText(text, x + w / 2, y + h / 2 + 4, 11, P.text3, false);
}

/* 圆形头像（职业图裁圆；没有图则画占位圆） */
function drawRoleAvatar(img, x, y, size, fallbackText) {
  var r = size / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (img) {
    drawCoverImage(img, x - r, y - r, size, size);
  } else {
    ctx.fillStyle = '#efe7da';
    ctx.fillRect(x - r, y - r, size, size);
    if (fallbackText) {
      centerText(fallbackText, x, y + 4, Math.max(10, size / 4), P.text3, false);
    }
  }
  ctx.restore();
  R.roundRectPath(ctx, x - r, y - r, size, size, r);
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/* 全屏背景（标题页）：优先用 intro_bg，加载完成前回退纯色 */
function drawFullBg() {
  var img = art.mainImg('intro_bg');
  if (img) {
    drawCoverImage(img, 0, 0, W, H);
  } else {
    ctx.fillStyle = P.bg;
    ctx.fillRect(0, 0, W, H);
  }
}

/* ================= 平台初始化 ================= */
function init(cv) {
  canvas = cv;
  ctx = canvas.getContext('2d');
  var info = wx.getSystemInfoSync();
  W = info.windowWidth;
  H = info.windowHeight;
  DPR = info.pixelRatio || 1;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.scale(DPR, DPR);
  var safe = info.safeArea;
  var STATUS_BAR_MIN = 44;
  /* 刘海 / 灵动岛：新基础库可能不返回 safeArea，或 safeArea.top 为 0，
   * 此时只给 44 的下限会被状态栏 / 灵动岛挡住。改用 getWindowInfo()
   * （新接口优先）取 statusBarHeight 作为更可靠的下限 —— 真机灵动岛 /
   * 刘海机型的 statusBarHeight 通常 44~59，足以避开顶部遮挡。
   * 老基础库没有 getWindowInfo 时回退到 getSystemInfoSync 的字段。 */
  var statusBar = info.statusBarHeight || 0;
  try {
    if (wx.getWindowInfo) {
      var win = wx.getWindowInfo();
      if (win && win.statusBarHeight) statusBar = win.statusBarHeight;
      if (win && win.safeArea && win.safeArea.top) safe = win.safeArea;
    }
  } catch (e) { /* 老基础库无 getWindowInfo，忽略 */ }
  SAFE_TOP = Math.max((safe && safe.top) || 0, statusBar, STATUS_BAR_MIN);
  SAFE_BOTTOM = Math.max(0, (safe && safe.bottom) ? (H - safe.bottom) : 0);

  wx.onTouchStart(onTouchStart);
  wx.onTouchMove(onTouchMove);
  wx.onTouchEnd(onTouchEnd);

  /* 页面过渡动效只在真机 / 开发者工具里跑。
   * 测试是同步直连 draw() 的：让动效默认关闭，排版断言看到的永远是终态，
   * 不受「刚换页时整页还在上移 20px」影响。 */
  transOn = true;

  // 美术资源：主包图显式加载 + 两个图片分包后台下载，任何一张就绪都会自动重绘
  art.setRedraw(function () { draw(); });
  // 全部落定后 art.js 会打一条汇总日志「美术资源：x/y 张就绪」
  // 主包 + 分包的图排完之后，再后台补下载「按需图」（行动页 / 结局页的头部背景）：
  // 让关键图永远排在前面，按需图只是捡带宽。
  art.ensureAll(function () { art.preloadLazy(); });
}

/* ================= 文案工具 ================= */
function txt(key) { var p = DB.text('play') || {}; return p[key] || ''; }
function tset(key) { return DB.text(key); }
function fmt(str, vars) {
  var out = String(str);
  if (vars) for (var k in vars) out = out.split('{' + k + '}').join(String(vars[k]));
  return out;
}
/* UI 提示文案：优先取 DB，缺失时用本地默认（便于零改动扩展） */
function ui(key, fallback) { return txt(key) || fallback; }

/* ================= 绘制基础 ================= */
function resetFrame() {
  buttons = [];
  fixedButtons = [];
  bottomActions = [];
  bottomHint = null;        // 每帧重置；由需要「已选提示」的页面（如开局设定）设置
  barTopY = H;              // 无底部叠加层时不跳过任何内容
  frameCards.note = 0;
  frameCards.delta = 0;
  C.y = SAFE_TOP + 10 + TOP_INSET;   // 顶部预留：左上角音乐浮窗不压正文
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, W, H);
}

/* ================= 页面过渡动效 =================
 * 不要求每个跳转点都手动登记：这里用「页面指纹」自动识别页面变化 ——
 * 指纹一变就开始一段「淡入 + 上移」的入场动效。
 * 好处是所有已有跳转（标题→设定、行动→二级页→事件→结算…）一次全覆盖，
 * 新增页面也不用再记得调用什么。
 *
 * 为什么不做「旧页淡出」：画布上没法在不掏离屏画布的前提下留住上一帧
 * （小游戏的离屏画布在测试环境里不可用），硬做会把底图戳出洞。
 * 淡入 + 上移 20px 已经足够把「换页」这件事讲清楚，且零风险。 */
var TRANS_MS = 260;
var trans = null;              // { t0 } —— 当前这段入场动效
var lastPageKey = null;        // 上一次绘制时的页面指纹
var transOn = false;           // 仅 init() 打开；测试不打开，保证排版断言看到的是终态
var transTimer = null;

function pageKey() {
  if (scene !== 'play') return scene;
  return scene + '|' + (today ? today.phase : '-') +
    (today && today.stylePayload ? '|style' : '');
}

/* 「本页卡片集合」的指纹：换页、事件从「选项态」翻到「结果态」、
 * 结算页换了一条结果 —— 都会让指纹变化，从而重播一段卡片入场。 */
function cardSig() {
  var s = pageKey();
  if (today) {
    s += '|' + (today.resolved ? 'R' : 'O');
    if (today.event) s += '|' + (today.event.id || '-');
  }
  return s;
}

function easeOutCubic(k) { return 1 - Math.pow(1 - k, 3); }

/* 当前动效状态：k=线性进度；dy=内容下移量；alpha=整体透明度。
 * transOn 关掉时必须直接返回终态 —— 否则会把已经起跳的那一段动效
 * 连同它的半透明一起带进测试的排版断言里。 */
function transState(now) {
  if (!transOn || !trans) return { active: false, k: 1, dy: 0, alpha: 1 };
  var k = engine.clamp((now - trans.t0) / TRANS_MS, 0, 1);
  if (k >= 1) { trans = null; return { active: false, k: 1, dy: 0, alpha: 1 }; }
  var e = easeOutCubic(k);
  return { active: true, k: k, dy: Math.round((1 - e) * 20), alpha: Math.min(1, e * 1.3) };
}

function scheduleTransTick() {
  if (!transOn || transTimer) return;
  transTimer = setTimeout(function () {
    transTimer = null;
    if (trans) { draw(); if (trans) scheduleTransTick(); }
  }, 16);
}

/* ================= 卡片进出动效 =================
 * 事件正文 / 选项 / 结果 / 属性变化都是卡片，这里统一提供两种动效：
 *   · 入场：每张卡按序号错落「上移 + 淡入」（第 0 张先动，后面的依次跟上）；
 *   · 退场：整体「下沉 + 淡出」，播完再执行真正的状态变更（换页 / 落实结果），
 *     这样「卡片出去、新卡片进来」的交接是看得见的。
 *
 * 入场由 cardEnterSet(key) 触发：key 是本页「卡片集合」的指纹，
 * 指纹一变就重播一段入场 —— 换页、事件从「选项态」翻到「结果态」都会命中，
 * 不需要每个跳转点手动登记。
 *
 * transOn 关闭（测试环境）时全部返回终态：排版断言看到的永远是稳定版式。 */
var CARD_IN_MS = 300;         // 单张卡片入场时长
var CARD_OUT_MS = 240;        // 单张卡片退场时长
var CARD_STAGGER_MS = 55;     // 相邻卡片的错落间隔
var CARD_STAGGER_MAX = 8;     // 错落最多算到第几张（再往后一起入场，别让列表末尾等太久）
var cardEnterKey = null, cardEnterT0 = 0;
var cardExitCb = null, cardExitT0 = 0;
var cardAnimEndAt = 0;        // 本段动效的最晚结束时刻（定时重绘据此收敛）
var cardTickTimer = null;

/* 登记「本页卡片集合」的指纹；变了就重播入场并安排逐帧重绘 */
function cardEnterSet(key) {
  if (cardEnterKey !== key) {
    cardEnterKey = key;
    cardEnterT0 = Date.now();
    cardAnimEndAt = Math.max(cardAnimEndAt, cardEnterT0 + CARD_IN_MS + CARD_STAGGER_MS * CARD_STAGGER_MAX + 40);
    scheduleCardTick();
  }
  return cardEnterT0;
}

/* 第 i 张卡片的动效状态：a=不透明度 · dy=视觉下移量 · on=是否还在动 */
var CARD_ANIM_NONE = { on: false, a: 1, dy: 0 };   // 明确「不动」的占位（浮窗自带入场动效时用）
function cardAnim(i) {
  if (!transOn) return { on: false, a: 1, dy: 0 };
  var now = Date.now();
  var idx = Math.min(i || 0, CARD_STAGGER_MAX);
  if (cardExitCb) {
    var ko = engine.clamp((now - cardExitT0 - idx * 12) / CARD_OUT_MS, 0, 1);
    return { on: ko < 1, a: 1 - ko, dy: Math.round(ko * 22) };
  }
  var e = easeOutCubic(engine.clamp((now - cardEnterT0 - idx * CARD_STAGGER_MS) / CARD_IN_MS, 0, 1));
  return { on: e < 1, a: Math.min(1, e * 1.6), dy: Math.round((1 - e) * 26) };
}

/* 退场：先播卡片下沉淡出，再执行 cb（换页 / 落实选项结果）。
 * 动效关闭时直接执行 —— 测试与无动效环境的行为完全同步。 */
function cardExitThen(cb) {
  if (!transOn) { cb(); return; }
  cardExitCb = cb;
  cardExitT0 = Date.now();
  cardAnimEndAt = Math.max(cardAnimEndAt, cardExitT0 + CARD_OUT_MS + 12 * CARD_STAGGER_MAX + 40);
  scheduleCardTick();
}

/* 是否正在播「卡片退场」（这期间新卡片不该跟着往下沉） */
function cardExiting() { return !!cardExitCb; }

/* 动效期间的逐帧重绘：到点收尾（并执行退场回调），否则继续。
 * 收敛条件是「时间到了」而不是「还在动」—— 不会出现停不下来的循环。
 * 收尾判定抽成 cardTick()，定时器与测试（手动拨表）共用同一段逻辑。 */
function cardTick() {
  var now = Date.now();
  if (cardExitCb && now >= cardExitT0 + CARD_OUT_MS + 12 * CARD_STAGGER_MAX) {
    var cb = cardExitCb;
    cardExitCb = null;
    cb();
    return;
  }
  draw();
}

function scheduleCardTick() {
  if (!transOn || cardTickTimer) return;
  cardTickTimer = setTimeout(function () {
    cardTickTimer = null;
    var wasExit = !!cardExitCb;
    cardTick();
    if (cardExitCb) { scheduleCardTick(); return; }        // 退场还没播完
    if (wasExit) return;                                   // 刚收尾（回调里已重绘）
    if (Date.now() < cardAnimEndAt) scheduleCardTick();
  }, 16);
}

/* 本帧画了几张「旁白卡 / 属性变化卡」——供测试断言卡片化改造确实生效 */
var frameCards = { note: 0, delta: 0 };

function section(title, sub) {
  R.setFont(ctx, 17, true);
  ctx.fillStyle = P.text1;
  ctx.fillText(title, PAD, C.y + 16);
  C.y += 26;
  if (sub) {
    R.setFont(ctx, 12);
    ctx.fillStyle = P.text2;
    C.y = R.drawWrapped(ctx, sub, PAD, C.y + 12, W - PAD * 2, 18, P.text2, 12);
  }
  C.y += 8;
}

/* 按钮：支持主/次/幽灵/禁用/小尺寸/选中/左侧头像；label 可换行 */
function button(label, sub, onClick, opts) {
  opts = opts || {};
  var key = opts.key || ('btn:' + label);
  if (pendingKey === key) opts.selected = true;      // 待确认 → 选中态
  var w = W - PAD * 2;
  var size = opts.small ? 14 : 16;
  var padX = 14, padY = opts.small ? 10 : 14;

  /* 左侧头像（职业头像）或图标盒：占位后文字整体右移 */
  var lead = opts.lead || null;
  var leadSize = lead ? (opts.leadSize || 44) : 0;
  var leadGap = lead ? 12 : 0;
  var icon = opts.icon || null;                       // 纯文本 emoji 图标
  var iconSize = icon ? 34 : 0;
  var iconGap = icon ? 10 : 0;
  var radioW = opts.selectable ? 30 : 0;              // 右侧单选圆点占位
  var textX = PAD + padX + leadSize + leadGap + iconSize + iconGap;
  var textW = w - padX * 2 - leadSize - leadGap - iconSize - iconGap - radioW;

  R.setFont(ctx, size, true);
  var labelLines = R.wrapText(ctx, label, textW);
  var subLines = sub ? R.wrapText(ctx, sub, textW) : [];
  var lh = size * 1.5;
  var h = padY * 2 + labelLines.length * lh + (subLines.length ? subLines.length * 18 + 2 : 0);
  if (lead) h = Math.max(h, padY * 2 + leadSize);
  if (icon) h = Math.max(h, padY * 2 + iconSize);

  var pressed = isPressed(PAD, C.y, w, h);
  var bg = P.card, fg = P.text1, subColor = P.text2, border = P.line;
  if (opts.disabled) { bg = P.disabled; fg = '#ffffff'; subColor = '#f1ece3'; border = P.disabled; }
  else if (pressed) { bg = '#ece9e4'; fg = P.text1; subColor = P.text2; border = P.primary; }
  else if (opts.selected) { bg = '#fbeae5'; fg = P.primaryDark; subColor = '#a8564a'; border = P.primary; }
  else if (opts.primary) { bg = P.primary; fg = '#ffffff'; subColor = '#f7ddd6'; border = P.primary; }
  else if (opts.ghost) { bg = P.ghost; border = P.line; }

  R.fillRoundRect(ctx, PAD, C.y, w, h, 12, bg);
  R.roundRectPath(ctx, PAD, C.y, w, h, 12);
  ctx.strokeStyle = border;
  ctx.lineWidth = (opts.selected || pressed) ? 2 : 1;
  ctx.stroke();

  if (lead) {
    drawRoleAvatar(lead, PAD + padX + leadSize / 2, C.y + h / 2, leadSize, '?');
  }
  if (icon) {
    var ibx = PAD + padX + leadSize + leadGap;
    var iby = C.y + (h - iconSize) / 2;
    R.fillRoundRect(ctx, ibx, iby, iconSize, iconSize, 10, '#f3ece0');
    R.setEmojiFont(ctx, 18); ctx.fillStyle = P.text2;
    var iw = ctx.measureText(icon).width;
    ctx.fillText(icon, ibx + iconSize / 2 - iw / 2, iby + iconSize / 2 + 6);
  }

  var yy = C.y + padY;
  R.setFont(ctx, size, true);
  ctx.fillStyle = fg;
  for (var i = 0; i < labelLines.length; i++) {
    ctx.fillText(labelLines[i], textX, yy + size);
    yy += lh;
  }
  if (subLines.length) {
    yy += 2;
    R.setFont(ctx, 12);
    ctx.fillStyle = subColor;
    for (var j = 0; j < subLines.length; j++) {
      ctx.fillText(subLines[j], textX, yy + 12);
      yy += 18;
    }
  }

  /* 单选圆点：选中态填主色 + 白勾 */
  if (opts.selectable) {
    var rx = PAD + w - padX - 10;
    var ry = C.y + h / 2;
    var r = 10;
    R.roundRectPath(ctx, rx - r, ry - r, r * 2, r * 2, r);
    if (opts.selected) {
      ctx.fillStyle = P.primary; ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rx - 4, ry); ctx.lineTo(rx - 1, ry + 3); ctx.lineTo(rx + 4, ry - 3);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#d8cfba'; ctx.lineWidth = 2; ctx.stroke();
    }
  }

  /* 徽章（如「推进主线」）：右上角金标 */
  if (opts.badge) {
    R.setFont(ctx, 10, true);
    var bw = ctx.measureText(opts.badge).width + 14;
    var bh = 18;
    var bx = PAD + w - bw - padX;
    var by = C.y - bh / 2 + 4;
    R.fillRoundRect(ctx, bx, by, bw, bh, 999, P.money);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(opts.badge, bx + 7, by + 13);
  }

  /* inert = 只画不点：被模态叠层盖住的下层页面用，
   * 视觉上仍然在（背景保留），但点击全部交给叠层。
   * modalInert 是整页级的同一件事（叠层打开期间，下层一律不登记）。 */
  if (!opts.disabled && !opts.inert && !modalInert) {
    // selectable = 列表选项：只负责选中，由「确认」按钮执行；
    // 其余（导航 / 单一动作）单次点击直接执行，不再二次确认。
    var wrap = opts.selectable
      ? (function (k, f) { return function () { selectOnly(k, f); }; })(key, onClick)
      : onClick;
    buttons.push({
      x: PAD, y: C.y, w: w, h: h, label: label,
      selectable: !!opts.selectable, onClick: wrap,
      setup: opts.setup || null, setupId: opts.setupId || null
    });
  }
  C.y += h + GAP;
  return C.y;
}

/* 底部固定操作区：登记一个按钮（绘制在屏幕底部，不随内容滚动）。
 * 模态叠层打开时不登记 —— 底部整条让给叠层。 */
function bottomAction(label, onClick, opts) {
  if (modalInert) return;
  bottomActions.push({ label: label, onClick: onClick, opts: opts || {} });
}

/* =========================================================
 * 卡片式选项（对齐「开局设定原型 V2」视觉语言）
 *   · 区块标题带序号徽章（sectionBadge）
 *   · 性别等互斥项用分段控件（drawSegmented）
 *   · 选项统一用富卡片（optionCard）：左头像/图标 + 标题 + 右侧难度/标签胶囊
 *     + 标签行 + 副描述 + 属性 chips + 选中 ✓ 角标；短文本选项不传头像/chips
 *     即为简洁卡片，视觉一致。
 * ========================================================= */

/* 难度 / 标签胶囊配色 */
var DIFF_PILL = {
  easy:   { bg: '#e8f5ec', fg: '#2e9e5b' },
  normal: { bg: '#e9effb', fg: '#4a7fd4' },
  hard:   { bg: '#fdf3e0', fg: '#d8852f' },
  hell:   { bg: '#fdeeec', fg: '#e0657a' },
  gold:   { bg: '#fdf3e0', fg: '#c9902f' }
};
/* 属性 chips 配色（hi 绿 / mid 金 / lo 红 / money 金 / neutral 灰） */
var CHIP_TONE = {
  hi:     { bg: '#e8f5ec', val: '#2e9e5b' },
  mid:    { bg: '#fdf3e0', val: '#d8852f' },
  lo:     { bg: '#fdeeec', val: '#e0657a' },
  money:  { bg: '#fdf3e0', val: '#c9902f' },
  neutral:{ bg: '#f6f1e5', val: '#7d7369' }
};

/* 自动给一个数值分档（money 按金额、其余按 0-100 量程），用于属性 chips 配色 */
function chipTone(v, isMoney) {
  if (isMoney) { if (v >= 150000) return 'hi'; if (v >= 20000) return 'mid'; return 'lo'; }
  if (v >= 70) return 'hi';
  if (v >= 45) return 'mid';
  return 'lo';
}

/* 带序号徽章的区块标题（原型：① 选择性别） */
function sectionBadge(title, sub, no) {
  if (no != null) {
    var nb = 18;
    R.fillRoundRect(ctx, PAD, C.y, nb, nb, 6, P.text1);
    R.setFont(ctx, 10, true); ctx.fillStyle = '#ffffff';
    ctx.fillText(String(no), PAD + nb / 2 - 3, C.y + 13);
    R.setFont(ctx, 15, true); ctx.fillStyle = P.text1;
    ctx.fillText(title, PAD + nb + 8, C.y + 14);
    C.y += 30;
  } else {
    R.setFont(ctx, 15, true); ctx.fillStyle = P.text1;
    ctx.fillText(title, PAD, C.y + 14);
    C.y += 24;
  }
  if (sub) {
    R.setFont(ctx, 12); ctx.fillStyle = P.text2;
    C.y = R.drawWrapped(ctx, sub, PAD, C.y + 12, W - PAD * 2, 18, P.text2, 12);
  }
  C.y += 8;
}

/* 分段控件（原型：性别一行两个，选中白底主色字 + 描边） */
function drawSegmented(opts) {
  var items = opts.options || [];
  if (!items.length) return;
  var cols = Math.min(items.length, opts.cols || items.length);
  var w = W - PAD * 2, gap = 4, outerPad = 4;
  var h = 46;
  var y = C.y;
  R.fillRoundRect(ctx, PAD, y, w, h + outerPad * 2, 12, '#ece4d2');
  var iw = (w - outerPad * 2 - gap * (cols - 1)) / cols;
  var iy = y + outerPad;
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var ix = PAD + outerPad + i * (iw + gap);
    var sel = (it.id === opts.selectedId);
    R.fillRoundRect(ctx, ix, iy, iw, h, 9, sel ? '#ffffff' : 'transparent');
    if (sel) { R.roundRectPath(ctx, ix, iy, iw, h, 9); ctx.strokeStyle = P.primary; ctx.lineWidth = 1; ctx.stroke(); }
    R.setFont(ctx, 15, true); ctx.fillStyle = sel ? P.primary : P.text2;
    var label = (it.icon ? it.icon + ' ' : '') + it.label;
    var lw = ctx.measureText(label).width;
    ctx.fillText(label, ix + (iw - lw) / 2, iy + h / 2 + 5);
    buttons.push({
      x: ix, y: iy, w: iw, h: h, label: it.label, selectable: false,
      setup: opts.setup || null, setupId: it.id,
      onClick: (function (id) { return function () { opts.onPick(id); }; })(it.id)
    });
  }
  C.y = y + h + outerPad * 2 + GAP;
}

/* 富选项卡片（原型 bg-card：头像 + 名称 + 难度胶囊 + 标签 + 属性 chips + 选中 ✓） */
function optionCard(o) {
  o = o || {};
  /* 与 button() 同一规则：命中「待确认 key」的卡片自动进入选中态。
   * 渠道 / 其余安排 / 约会档位 / 赴约 / 表白 / 求婚… 全部靠这一条 ——
   * 之前只有行动菜单显式写了 selected，其它页点了没有任何反馈。 */
  var cardKey = o.key || ('btn:' + (o.title || ''));
  if (o.selectable && !o.disabled && pendingKey === cardKey) o.selected = true;

  var x = (o.x != null) ? o.x : PAD;
  var w = (o.w != null) ? o.w : (W - PAD * 2);
  var compact = !!o.compact;                 // 短文本选项（事件/聊天）用更紧凑的排版
  var titleSize = compact ? 15 : 16;
  var padX = 14, padY = compact ? 10 : 13;
  var avatar = o.avatar || null;
  var avatarSize = avatar ? (o.avatarSize || 48) : 0;
  var icon = o.icon || null;
  var iconSize = icon ? (o.iconSize || 40) : 0;
  var leftSize = Math.max(avatarSize, iconSize);
  var leftGap = (avatar || icon) ? 12 : 0;

  /* 右侧胶囊预留 */
  var badge = o.badge || null, badgeH = 18, badgeW = 0;
  if (badge) { R.setFont(ctx, 10, true); badgeW = ctx.measureText(badge).width + 16; }
  var titleW = w - padX * 2 - leftSize - leftGap - (badge ? badgeW + 8 : 0);

  R.setFont(ctx, titleSize, true);
  var titleLines = R.wrapText(ctx, o.title || '', titleW);
  R.setFont(ctx, 11);
  var tagline = o.tagline || null;
  var taglineLines = tagline ? R.wrapText(ctx, tagline, titleW) : [];
  var subW = w - padX * 2 - leftSize - leftGap;
  R.setFont(ctx, 12);
  var subLines = o.sub ? R.wrapText(ctx, o.sub, subW) : [];

  /* chips 换行排列 */
  var chips = o.chips || [];
  var chipH = 22, chipGap = 6, chipLineGap = 6, chipLines = [];
  if (chips.length) {
    var cx = 0, line = [];
    chips.forEach(function (c) {
      R.setFont(ctx, 11);
      var cw = ctx.measureText(c.label + (c.value != null ? ' ' + c.value : '')).width + 14;
      if (cx + cw > subW && line.length) { chipLines.push(line); line = []; cx = 0; }
      line.push({ c: c, w: cw }); cx += cw + chipGap;
    });
    if (line.length) chipLines.push(line);
  }

  var lhTitle = compact ? 19 : 20, lhTag = 15, lhSub = 18;
  var titleBlockH = titleLines.length * lhTitle;
  var tagBlockH = taglineLines.length * lhTag;
  var subBlockH = subLines.length * lhSub;
  var chipsBlockH = chipLines.length ? (chipLines.length * (chipH + chipLineGap) - chipLineGap) : 0;
  var leftBlockH = leftSize || 0;
  var h = padY + Math.max(leftBlockH, titleBlockH + tagBlockH)
    + (subLines.length ? 6 + subBlockH : 0)
    + (chipLines.length ? 10 + chipsBlockH : 0) + padY;
  h = Math.max(h, padY * 2 + (leftBlockH || 44));

  /* 卡片动效：把 C.y 本身挪到「视觉位置」，于是绘制与命中框自动跟着走；
   * 布局流不受影响 —— 末尾用保存的 layY 推进，下一张卡片不会跟着漂。 */
  var layY = C.y;
  var anim = o.anim || null;
  var animA = anim ? anim.a : 1;
  if (anim && anim.dy) C.y = layY + anim.dy;
  if (animA < 1) { ctx.save(); ctx.globalAlpha = Math.max(0, animA); }

  var selected = !!o.selected;
  var disabled = !!o.disabled;
  var pressed = isPressed(x, C.y, w, h);

  var bg = disabled ? P.disabled : (pressed ? '#ece9e4' : (selected ? '#fffdfb' : P.card));
  var border = disabled ? P.disabled : (selected ? P.primary : P.line);
  R.fillRoundRect(ctx, x, C.y, w, h, 16, bg);
  R.roundRectPath(ctx, x, C.y, w, h, 16);
  ctx.strokeStyle = border; ctx.lineWidth = selected ? 2 : 1; ctx.stroke();

  var innerX = x + padX + leftSize + leftGap;
  var cy = C.y + padY;

  if (avatar) drawRoleAvatar(avatar, x + padX + avatarSize / 2, C.y + padY + avatarSize / 2, avatarSize, '?');
  else if (icon) {
    var ix0 = x + padX, iy0 = C.y + padY;
    R.fillRoundRect(ctx, ix0, iy0, iconSize, iconSize, 12, '#f3ece0');
    R.setEmojiFont(ctx, 22); ctx.fillStyle = P.text2;
    var iw0 = ctx.measureText(icon).width;
    ctx.fillText(icon, ix0 + iconSize / 2 - iw0 / 2, iy0 + iconSize / 2 + 7);
  }

  var ty = cy + (compact ? 14 : 15);
  R.setFont(ctx, titleSize, true);
  ctx.fillStyle = disabled ? '#f1ece3' : (selected ? P.primaryDark : P.text1);
  for (var i = 0; i < titleLines.length; i++) { ctx.fillText(titleLines[i], innerX, ty); ty += lhTitle; }
  if (badge) {
    var btone = o.badgeTone || 'normal';
    var bBg = (DIFF_PILL[btone] || DIFF_PILL.normal).bg;
    var bFg = (DIFF_PILL[btone] || DIFF_PILL.normal).fg;
    R.fillRoundRect(ctx, x + w - padX - badgeW, cy, badgeW, badgeH, 999, bBg);
    R.setFont(ctx, 10, true); ctx.fillStyle = bFg;
    ctx.fillText(badge, x + w - padX - badgeW + 8, cy + 13);
  }
  if (taglineLines.length) {
    R.setFont(ctx, 11); ctx.fillStyle = disabled ? '#f1ece3' : P.text3;
    for (var t = 0; t < taglineLines.length; t++) { ctx.fillText(taglineLines[t], innerX, ty); ty += lhTag; }
  }
  if (subLines.length) {
    ty += 6;
    R.setFont(ctx, 12); ctx.fillStyle = disabled ? '#f1ece3' : (selected ? '#a8564a' : P.text2);
    for (var s = 0; s < subLines.length; s++) { ctx.fillText(subLines[s], innerX, ty); ty += lhSub; }
  }
  if (chipLines.length) {
    ty += 10;
    chipLines.forEach(function (ln) {
      var chx = innerX;
      ln.forEach(function (it) {
        var ch = it.c;
        var tone = ch.tone || 'neutral';
        var cb = (CHIP_TONE[tone] || CHIP_TONE.neutral).bg;
        var cv = (CHIP_TONE[tone] || CHIP_TONE.neutral).val;
        R.fillRoundRect(ctx, chx, ty, it.w, chipH, 8, cb);
        R.setFont(ctx, 11); ctx.fillStyle = P.text2;
        ctx.fillText(ch.label, chx + 7, ty + 15);
        if (ch.value != null) {
          R.setFont(ctx, 12, true); ctx.fillStyle = cv;
          ctx.fillText(String(ch.value), chx + 7 + ctx.measureText(ch.label).width + 3, ty + 15);
        }
        chx += it.w + chipGap;
      });
      ty += chipH + chipLineGap;
    });
  }

  if (selected) {
    var rx = x + w - 12, ry = C.y + 12, rr = 11;
    R.fillRoundRect(ctx, rx - rr, ry - rr, rr * 2, rr * 2, rr, P.primary);
    R.setFont(ctx, 12, true); ctx.fillStyle = '#ffffff';
    ctx.fillText('✓', rx - 4, ry + 5);
  }

  if (!disabled && !o.inert && !modalInert) {
    var key = cardKey;   // 与 button() 一致：单选卡片总有一个稳定 key
    var wrap = o.selectable
      ? (function (k, f) { return function () { selectOnly(k, f); }; })(key, o.onClick)
      : o.onClick;
    buttons.push({ x: x, y: C.y, w: w, h: h, label: o.title, selectable: !!o.selectable,
      onClick: wrap, setup: o.setup || null, setupId: o.setupId || null });
  }
  if (animA < 1) ctx.restore();
  C.y = layY + h + GAP;
}

/* 旁白卡：把事件正文（旁白 + 剧情 / 结果正文）装进一张白卡，
 * 与选项卡片共用同一套视觉语言（16 圆角 / 细描边 / 白底）。
 * 段落之间留 8px，空串当作一次「换段」。
 * opts.anim 传 cardAnim(i) 的结果即可获得入场 / 退场动效。 */
function noteCard(paras, opts) {
  opts = opts || {};
  var x = (opts.x != null) ? opts.x : PAD;
  var w = (opts.w != null) ? opts.w : (W - PAD * 2);
  var padX = 16, padY = 14, paraGap = 8;
  var size = opts.size || 15;
  var innerW = w - padX * 2;

  /* 先按最终字号量高：wrapText 依赖 ctx.font，字号必须在测量前设好 */
  var blocks = [], lineCount = 0;
  R.setFont(ctx, size);
  (paras || []).forEach(function (p) {
    if (p === '' || p == null) { blocks.push([]); return; }
    var ls = R.wrapText(ctx, engine.fillText(p, S), innerW);
    blocks.push(ls);
    lineCount += ls.length;
  });
  var h = padY * 2 + lineCount * LINEH + Math.max(0, blocks.length - 1) * paraGap;
  h = Math.max(h, padY * 2 + LINEH);

  var layY = C.y;
  var anim = opts.anim || null;
  var a = anim ? anim.a : 1;
  var topY = layY + ((anim && anim.dy) ? anim.dy : 0);
  if (a < 1) { ctx.save(); ctx.globalAlpha = Math.max(0, a); }
  frameCards.note++;

  R.fillRoundRect(ctx, x, topY, w, h, 16, P.card);
  R.roundRectPath(ctx, x, topY, w, h, 16);
  ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.stroke();

  /* 首行基线 = 卡片顶 + 内边距 + 0.8×字号（与 bbox 上沿对齐，不会顶出卡片） */
  var yy = topY + padY + Math.round(size * 0.8);
  blocks.forEach(function (ls) {
    if (!ls.length) { yy += paraGap; return; }
    ls.forEach(function (l) {
      R.setFont(ctx, size); ctx.fillStyle = P.text1;
      ctx.fillText(l, x + padX, yy);
      yy += LINEH;
    });
    yy += paraGap;
  });
  if (a < 1) ctx.restore();

  C.y = layY + h + (opts.gap != null ? opts.gap : 12);
  return h;
}

function smallLink(label, onClick) {
  R.setFont(ctx, 13);
  var tw = ctx.measureText(label).width;
  var x = W - PAD - tw - 12, y = C.y, w = tw + 12, h = 24;
  var key = 'link:' + label;
  var pending = (pendingKey === key);
  R.fillRoundRect(ctx, x, y, w, h, 8, pending ? P.primary : P.ghost);
  ctx.fillStyle = pending ? '#ffffff' : P.text2;
  ctx.fillText(label, x + 6, y + 16);
  buttons.push({
    x: x, y: y, w: w, h: h,
    label: label,
    onClick: onClick
  });
}

/* ---- 首页按钮专用：底色半透明 + 四周边缘渐隐 ----
 * '#c95a45' + 0.7 → 'rgba(201,90,69,0.7)'（画布只认字符串颜色） */
function softRgba(hex, a) {
  var h = String(hex || '#000000').replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var n = parseInt(h, 16);
  if (isNaN(n)) return 'rgba(0,0,0,' + a + ')';
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

/* 边缘渐隐的软面板：底色整体降到 alpha（首页用 0.7，背景图能透出来），
 * 左右两侧由一条横向渐变淡到全透明，上下两侧再用逐带透明度叠出羽化。
 * 刻意不用 destination-in —— 那会把底下的背景图一起戳出洞来。 */
function vFade(t) {
  var k = 0.30;                     // 上下各 30% 的高度用来羽化
  if (t < k) return t / k;
  if (t > 1 - k) return (1 - t) / k;
  return 1;
}

function paintSoftPanel(x, y, w, h, r, color, alpha) {
  ctx.save();
  R.roundRectPath(ctx, x, y, w, h, r);
  ctx.clip();
  if (ctx.createLinearGradient) {
    var g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, softRgba(color, 0));
    g.addColorStop(0.18, softRgba(color, alpha));
    g.addColorStop(0.82, softRgba(color, alpha));
    g.addColorStop(1, softRgba(color, 0));
    ctx.fillStyle = g;
    var step = 2;
    for (var yy = 0; yy < h; yy += step) {
      ctx.globalAlpha = vFade((yy + step / 2) / h);
      ctx.fillRect(x, y + yy, w, Math.min(step, h - yy));
    }
    ctx.globalAlpha = 1;
  } else {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/* 首页（开始游戏页）按钮：取消渐变、保持透明；文字水平居中、比通用按钮大一号。
 * 与通用 button() 的区别只在观感 —— 命中判定、两步确认规则完全一致。
 * opts.w 指定宽度（标题页男女主中间的窄按钮列用），不传则整宽；
 * 指定宽度时按钮水平居中。 */
/* 首页（开始游戏页）按钮：白底 + 投影，文字放大加粗，带「按下」反馈。
 * 仍是居中、单/双行自适应，不铺渐变、不与背景图混底。 */
function titleButton(label, sub, onClick, opts) {
  opts = opts || {};
  var key = 'title:' + label;
  if (pendingKey === key) opts.selected = true;
  var w = opts.w || (W - PAD * 2);
  var bx = (opts.center === false) ? PAD : Math.round((W - w) / 2);
  var size = opts.small ? 18 : 20;          // 比通用按钮（16）大一号：放大加粗
  var padX = 22, padY = 16;

  R.setFont(ctx, size, true);
  var labelLines = R.wrapText(ctx, label, w - padX * 2);
  var subLines = sub ? R.wrapText(ctx, sub, w - padX * 2) : [];
  /* 副标题只在「能一行装下」时显示：居中窄按钮列里副标题折行会撑太高、
   * 导致按钮超出屏幕，此时直接隐藏，保持按钮紧凑、始终落在屏幕内。 */
  var showSub = subLines.length === 1;
  var lh = size * 1.5;
  var h = padY * 2 + labelLines.length * lh + (showSub ? subLines.length * 18 + 2 : 0);

  var pressed = isPressed(bx, C.y, w, h);

  /* 白底 + 投影：正常态悬浮阴影，按下态阴影收小、底色微灰，呈现「按进去」 */
  ctx.save();
  if (pressed) {
    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
    R.fillRoundRect(ctx, bx, C.y, w, h, 16, '#eceae9');
  } else {
    ctx.shadowColor = 'rgba(0,0,0,0.22)';
    ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
    R.fillRoundRect(ctx, bx, C.y, w, h, 16, '#ffffff');
  }
  ctx.restore();

  /* 主按钮 / 选中态：主色描边；普通按钮：极淡描边兜底边界 */
  var stroke = opts.primary ? P.primary : (opts.selected ? P.primary : 'rgba(0,0,0,0.06)');
  var lw = (opts.primary || opts.selected) ? 2 : 1;
  R.roundRectPath(ctx, bx + (lw === 2 ? 1 : 0.5), C.y + (lw === 2 ? 1 : 0.5),
    w - (lw === 2 ? 2 : 1), h - (lw === 2 ? 2 : 1), 15);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();

  var fg = opts.primary ? P.primary : '#34302c';
  if (pressed) fg = opts.primary ? P.primaryDark : '#1f1c1a';
  var subColor = opts.primary ? P.primaryDark : '#6b6660';

  var yy = C.y + padY;
  R.setFont(ctx, size, true);
  ctx.fillStyle = fg;
  for (var i = 0; i < labelLines.length; i++) {
    ctx.fillText(labelLines[i], bx + (w - ctx.measureText(labelLines[i]).width) / 2, yy + size);
    yy += lh;
  }
  if (showSub) {
    yy += 2;
    R.setFont(ctx, 13, true);
    ctx.fillStyle = subColor;
    ctx.fillText(subLines[0], bx + (w - ctx.measureText(subLines[0]).width) / 2, yy + 13);
  }

  if (!opts.disabled) {
    var wrap = opts.selectable
      ? (function (k, f) { return function () { selectOnly(k, f); }; })(key, onClick)
      : onClick;
    buttons.push({
      x: bx, y: C.y, w: w, h: h, label: label,
      selectable: !!opts.selectable, onClick: wrap
    });
  }
  C.y += h + (opts.gap === undefined ? GAP : opts.gap);
  return C.y;
}

/* ---- 属性条本体（含涨跌动效） ----
 * ratio = 当前值 / 该属性的 max，归一化到 0~1 后驱动进度条宽度，
 * 因此条长会随数值真实变化（早期版本传入 0~100 后被 min(1,·) 截断，导致恒满格）。
 *
 * 结算后的动效分两层（谁都不许再引入随机浮动，涨跌完全由结算数据决定）：
 *   1) 滑动：条长在 STAT_ANIM_MS 内从「结算前」平滑滑到「结算后」；
 *   2) 高亮：变化的那一段单独上色 ——
 *      涨：这一段是新长出来的，用涨色直接盖在条上（一截绿长出来）；
 *      跌：这一段正在失去，用跌色画在填充底下并随动画淡出（一截红被吃掉）。
 * 颜色沿用全局的涨/跌色（与数值飘字同一套语义），不做二次发明。
 */
/* 属性当前的上限：只有好感度是「动态值」——
 * 单身 / 初遇 / 接触中是 100，告白成功（恋爱 / 已婚）放大到 500，
 * 上限本身写在常量里（AFFECTION_CAP_BASE / AFFECTION_CAP_DATING），
 * 这里向引擎要当前值，好让进度条按真实刻度归一化，不会恋爱后恒满格。 */
function statMax(d) {
  if (d && d.key === 'affection' && S) return engine.affectionCap(S);
  return (d && d.max) || 100;
}

function drawStatBar(d, x, barY, w, barH, hide) {
  R.fillRoundRect(ctx, x, barY, w, barH, barH / 2, P.line);
  if (hide) return;

  var max = statMax(d);
  var toRatio = engine.clamp(Math.round(S[d.key] || 0) / max, 0, 1);
  var tw = statFlashAnim(d.key);

  if (!tw) {
    var fw = toRatio * w;
    if (fw > 0) R.fillRoundRect(ctx, x, barY, Math.max(fw, barH), barH, barH / 2, d.color);
    return;
  }

  var fromRatio = engine.clamp(tw.from / max, 0, 1);
  var curRatio = fromRatio + (toRatio - fromRatio) * tw.e;
  var curW = curRatio * w;
  if (curW > 0) R.fillRoundRect(ctx, x, barY, Math.max(curW, barH), barH, barH / 2, d.color);

  var lo = Math.min(fromRatio, curRatio) * w;
  var segW = Math.abs(curRatio - fromRatio) * w;
  if (segW <= 0.5) return;

  if (curRatio >= fromRatio) {
    R.fillRoundRect(ctx, x + lo, barY, segW, barH, barH / 2, P.up);
  } else {
    ctx.save();
    ctx.globalAlpha = 0.9 * (1 - tw.e);      // 动画结束即淡尽，不会留下「虚长」的条
    R.fillRoundRect(ctx, x + lo, barY, segW, barH, barH / 2, P.down);
    ctx.restore();
  }
}

/* ---- 属性条：单个格子（一行两条布局中的一格） ---- */
function drawStatCell(d, x, y, w) {
  var v = Math.round(S[d.key] || 0);
  var hide = d.hideWhenSingle && S.relationship === 'single';
  var tw = hide ? null : statFlashAnim(d.key);
  /* 数值跟着条一起滚动，避免「条动了数字没动」 */
  var shown = tw ? Math.round(tw.from + (v - tw.from) * tw.e) : v;
  var display = d.format === 'money' ? engine.moneyText(shown) : String(shown);

  R.setFont(ctx, 12);
  ctx.fillStyle = P.text2;
  ctx.fillText(d.label, x, y + 12);

  R.setFont(ctx, 13, true);
  /* 动效期间数值跟着变色（涨 / 跌），与条上高亮、飘字保持同一套语义 */
  ctx.fillStyle = hide ? P.text3 : (tw ? (tw.dir > 0 ? P.up : P.down) : d.color);
  var vt = hide ? '--' : display;
  ctx.fillText(vt, x + w - ctx.measureText(vt).width, y + 12);

  drawStatBar(d, x, y + 20, w, 7, hide);

  /* 本次结算的涨跌：在属性条上方飘出并淡出（增=涨色 up，减=跌色 down） */
  var fp = statFlashProgress();
  if (fp >= 0 && statFlash.delta && statFlash.delta[d.key]) {
    var dv = Math.round(statFlash.delta[d.key]);
    if (dv !== 0) {
      var txt2 = (dv > 0 ? '+' : '-') +
        (d.key === 'money' && Math.abs(dv) >= 10000 ? engine.moneyText(Math.abs(dv)) : String(Math.abs(dv)));
      /* 0→1 过程中：上飘 14px、透明度 1→0 */
      var rise = 14 * fp;
      var alpha = fp < 0.65 ? 1 : (1 - (fp - 0.65) / 0.35);
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      R.setFont(ctx, 13, true);
      ctx.fillStyle = dv > 0 ? P.up : P.down;
      ctx.fillText(txt2, x + w - ctx.measureText(txt2).width, y + 12 - rise);
      ctx.restore();
    }
  }

  return 42;
}

/* ---- 属性条网格：一行两条 ----
 * 只负责摆放与绘制。点击入口统一在主角头像上（见 drawStatus），
 * 属性条本身不可点 —— 早期把入口藏在细条上，几乎没人找得到。 */
function drawStatGrid(defs) {
  if (!defs || !defs.length) return;
  var colGap = 12;
  var colW = (W - PAD * 2 - colGap) / 2;
  var rowY = C.y;
  var rowH = 0;
  var col = 0;
  for (var i = 0; i < defs.length; i++) {
    var x = PAD + col * (colW + colGap);
    var h = drawStatCell(defs[i], x, rowY, colW);
    if (h > rowH) rowH = h;
    col++;
    if (col >= 2) { col = 0; rowY += rowH + 12; rowH = 0; }
  }
  C.y = rowY + (col === 0 ? 0 : rowH);
}

/* ---------------- 交互模型 ----------------
 * 选项类控件：单次点击只选中（可再次点击取消），由下方/弹窗底部的「确认」按钮提交。
 * 非选项类控件（导航 / 单一动作 / 底部操作）：单次点击直接执行。
 */
function selectOnly(key, fn) {
  if (pendingKey === key) {
    clearPending();
  } else {
    pendingKey = key;
    pendingAction = fn;
  }
  draw();
}

function clearPending() {
  pendingKey = null;
  pendingAction = null;
}

/* 「确认」按钮：执行当前选中项 */
function runPending() {
  if (!pendingAction) return;
  var fn = pendingAction;
  clearPending();
  fn();
}

/* 登记底部「确认」按钮：未选中时置灰，选中后可点并直接执行。
 * opts.run 可选：确认时改跑这个函数（用于「先提交选中项、再做后续动作」）。
 * opts.disabledLabel 可选：置灰时显示的引导文案（默认仍是 label）。 */
function confirmAction(label, opts) {
  var o = opts || {};
  var extra = o.run || null;
  delete o.run;
  o.primary = true;
  o.key = 'confirm';
  o.disabled = !pendingAction;    // 没选东西时置灰，提示先选一项
  if (o.disabledLabel === undefined) o.disabledLabel = null;
  var handler = extra
    ? function () { runPending(); extra(); }   // 先落实选中项，再做这一步自己的事
    : runPending;
  bottomAction(label || ui('confirm', '确认'), handler, o);
}

/* 场景或阶段变化时自动清除待确认态，避免跨页残留。
 * 交往风格叠层也算一层上下文：开关叠层时选中态必须清干净。 */
function syncPendingCtx() {
  var key = scene + '|' + (today ? today.phase : '-') + '|' + setupStep +
    '|' + (today && today.stylePayload ? 'style' : '-');
  if (key !== lastCtxKey) {
    pendingKey = null;
    pendingAction = null;
    lastCtxKey = key;
  }
}

/* ================= 主绘制分发 ================= */
function draw() {
  syncPendingCtx();

  /* 页面指纹变了 → 起一段入场动效（见 transState） */
  var pk = pageKey();
  if (pk !== lastPageKey) {
    lastPageKey = pk;
    if (transOn) trans = { t0: Date.now() };
  }
  var t = transState(Date.now());

  resetFrame();
  /* 卡片集合指纹：换页 / 事件翻到结果态 → 重播一段错落入场（见 cardEnterSet） */
  cardEnterSet(cardSig());

  /* 滚动内容层 */
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  if (t.active) ctx.globalAlpha = t.alpha;
  ctx.translate(0, scrollY + t.dy);
  drawContent();
  ctx.restore();

  /* 固定层（头部 / 叠层 / 底部操作区）跟着一起淡入上移，整页一起动才像换页 */
  ctx.save();
  if (t.active) { ctx.globalAlpha = t.alpha; ctx.translate(0, t.dy); }
  drawEventHeader();    // 事件页固定头部（场景背景 + 双人头像）
  drawStyleOverlay();   // 交往风格叠层（模态，打开时接管交互）
  drawKeyModal();       // 关键事件浮窗（模态，打开时接管交互）
  drawSeekFailModal();  // 寻找落空浮窗（模态，打开时接管交互）
  if (!styleOverlayOpen() && !keyModalOpen() && !seekFailModalOpen()) drawBottomBar();   // 底部固定操作区
  ctx.restore();

  /* 提示条画在最上层：不会被背景图盖住，任何页面都能看见 */
  drawFlashes();

  /* 音乐开关浮窗：钉在左上角，所有页面（含叠层 / 浮窗）都看得见、点得到 */
  drawMusicToggle();

  if (t.active) scheduleTransTick();
}

function drawContent() {
  modalInert = false;          // 每帧重置；由 drawPlay 在叠层打开时置位
  if (scene === 'loading') drawLoading();
  else if (scene === 'error') drawError();
  else if (scene === 'intro') drawIntro();
  else if (scene === 'title') { drawTitle(); startTitleAnim(); }
  else if (scene === 'rules') drawRules();
  else if (scene === 'setup') drawSetup();
  else if (scene === 'play') drawPlay();
  else if (scene === 'partner') drawPartnerProfile();   // 点对方头像 → 资料
  else if (scene === 'stats') drawStatDetail();          // 点属性条 → 近期变化
  else if (scene === 'recent') drawRecentPage();         // 点近期经历 → 事件/选择/结果
  else if (scene === 'chat') drawChatPage();             // 微信闲聊（非单身）
  else if (scene === 'gallery') drawGallery();            // 相亲图鉴（分男女）
  else if (scene === 'galleryDetail') drawGalleryDetail(); // 图鉴 · 单个人物资料
  else if (scene === 'end') drawEnd();
  // 为底部固定操作区预留空间，避免内容被遮挡：
  // 「确认置顶 + 次级一行」布局更高，其余单行布局用基础预留值
  if (bottomActions.length) {
    var split = false;
    for (var bi = 0; bi < bottomActions.length; bi++) {
      if (bottomActions[bi].opts.key === 'confirm') { split = bottomActions.length >= 2; break; }
    }
    C.y += split ? 150 : BAR_RESERVE;
  }
  contentH = C.y + 24;
}

/* ================= 底部固定操作区 ================= */
/* 含「确认」键且有 ≥2 个按钮时，走「确认置顶 + 次级一行」布局（对齐主页原型）；
 * 否则沿用原来的单行等分布局，保证其余页面（重开确认、二级页等）不变。 */
function drawBottomBar() {
  if (!bottomActions.length || scene === 'loading') return;
  var confirmIdx = -1;
  for (var k = 0; k < bottomActions.length; k++) {
    if (bottomActions[k].opts.key === 'confirm') { confirmIdx = k; break; }
  }
  if (confirmIdx >= 0 && bottomActions.length >= 2) drawBottomBarSplit(confirmIdx);
  else drawBottomBarRow();
}

/* 单行等分布局（原逻辑） */
function drawBottomBarRow() {
  var n = bottomActions.length;
  var gap = 10;
  var totalW = W - PAD * 2;
  var bw = (totalW - gap * (n - 1)) / n;
  var by = H - SAFE_BOTTOM - BOTTOM_GAP - BAR_BTN_H;
  barTopY = bottomHint ? (by - 20) : by;   // 叠加层顶边（含提示条）

  drawBottomShade(by);

  /* 「当前已选」提示条（原型：确认按钮上方一行小字） */
  if (bottomHint) {
    R.setFont(ctx, 11);
    ctx.fillStyle = P.text2;
    var hw = ctx.measureText(bottomHint).width;
    ctx.fillText(bottomHint, (W - hw) / 2, by - 8);
  }

  for (var i = 0; i < n; i++) {
    var a = bottomActions[i];
    var x = PAD + i * (bw + gap);
    var key = a.opts.key || ('bar:' + a.label);
    var dis = !!a.opts.disabled;
    var pending = !dis && (pendingKey === key);
    var primary = !!a.opts.primary || pending;
    var bg = dis ? P.disabled : (primary ? P.primary : P.card);
    var fg = dis ? '#f1ece3' : (primary ? '#ffffff' : P.text2);
    var bd = dis ? P.disabled : (primary ? P.primary : P.line);

    R.fillRoundRect(ctx, x, by, bw, BAR_BTN_H, 14, bg);
    R.roundRectPath(ctx, x, by, bw, BAR_BTN_H, 14);
    ctx.strokeStyle = bd;
    ctx.lineWidth = pending ? 2 : 1;
    ctx.stroke();

    var lbl = (dis && a.opts.disabledLabel) ? a.opts.disabledLabel : a.label;
    R.setFont(ctx, 15, true);
    ctx.fillStyle = fg;
    var tw = ctx.measureText(lbl).width;
    ctx.fillText(lbl, x + (bw - tw) / 2, by + BAR_BTN_H / 2 + 5);

    if (!dis) fixedButtons.push({ x: x, y: by, w: bw, h: BAR_BTN_H, label: a.label, onClick: a.onClick });
  }
}

/* 确认置顶 + 次级一行（主页原型布局） */
function drawBottomBarSplit(confirmIdx) {
  var confirm = bottomActions[confirmIdx];
  var rest = [];
  for (var i = 0; i < bottomActions.length; i++) if (i !== confirmIdx) rest.push(bottomActions[i]);

  var gap = 10, bottomGap = BOTTOM_GAP, confirmH = 48, secH = 44;
  var secY = H - SAFE_BOTTOM - bottomGap - secH;
  var confirmY = secY - gap - confirmH;
  barTopY = bottomHint ? (confirmY - 18) : confirmY;   // 叠加层顶边（含提示条）
  drawBottomShade(confirmY);

  /* 「当前已选」提示条（原型：确认按钮上方一行小字） */
  if (bottomHint) {
    R.setFont(ctx, 11);
    ctx.fillStyle = P.text2;
    var hw = ctx.measureText(bottomHint).width;
    ctx.fillText(bottomHint, (W - hw) / 2, confirmY - 7);
  }

  /* 确认：整宽主按钮 */
  var cdis = !!confirm.opts.disabled;
  R.fillRoundRect(ctx, PAD, confirmY, W - PAD * 2, confirmH, 14, cdis ? P.disabled : P.primary);
  R.roundRectPath(ctx, PAD, confirmY, W - PAD * 2, confirmH, 14);
  ctx.strokeStyle = cdis ? P.disabled : P.primary; ctx.lineWidth = 1; ctx.stroke();
  var clbl = (cdis && confirm.opts.disabledLabel) ? confirm.opts.disabledLabel : confirm.label;
  R.setFont(ctx, 16, true); ctx.fillStyle = cdis ? '#f1ece3' : '#ffffff';
  var cw = ctx.measureText(clbl).width;
  ctx.fillText(clbl, (W - cw) / 2, confirmY + confirmH / 2 + 5);
  if (!cdis) fixedButtons.push({ x: PAD, y: confirmY, w: W - PAD * 2, h: confirmH, label: confirm.label, onClick: confirm.onClick });

  /* 次级：等分一行（如 相亲图鉴 / 重开，或 返回） */
  var n = rest.length, secGap = 10;
  var secW = (W - PAD * 2 - secGap * (n - 1)) / n;
  for (var j = 0; j < n; j++) {
    var a = rest[j];
    var x = PAD + j * (secW + secGap);
    var akey = a.opts.key || ('bar:' + a.label);
    var adis = !!a.opts.disabled;
    var apending = !adis && (pendingKey === akey);
    var aprimary = !!a.opts.primary || apending;
    var abg = adis ? P.disabled : (aprimary ? P.primary : P.card);
    var afg = adis ? '#f1ece3' : (aprimary ? '#ffffff' : P.text2);
    var abd = adis ? P.disabled : (aprimary ? P.primary : P.line);
    R.fillRoundRect(ctx, x, secY, secW, secH, 12, abg);
    R.roundRectPath(ctx, x, secY, secW, secH, 12);
    ctx.strokeStyle = abd; ctx.lineWidth = apending ? 2 : 1; ctx.stroke();
    R.setFont(ctx, 14, true); ctx.fillStyle = afg;
    var aw = ctx.measureText(a.label).width;
    ctx.fillText(a.label, x + (secW - aw) / 2, secY + secH / 2 + 5);
    if (!adis) fixedButtons.push({ x: x, y: secY, w: secW, h: secH, label: a.label, onClick: a.onClick });
  }
}

/* 底部渐变遮罩：让滚动内容在底部操作区上方自然淡出 */
function drawBottomShade(barTop) {
  if (!ctx.createLinearGradient) return;
  var h = 34;
  var g = ctx.createLinearGradient(0, barTop - h, 0, barTop + 6);
  g.addColorStop(0, 'rgba(246,241,234,0)');
  g.addColorStop(1, 'rgba(246,241,234,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, barTop - h, W, h + 6);
}

/* ================= 载入页 ================= */
function drawLoading() {
  var L = tset('loading') || {};
  C.y = H * 0.4;
  R.setFont(ctx, 18, true);
  ctx.fillStyle = P.text1;
  var t = (L.loading || '正在载入……');
  ctx.fillText(t, (W - ctx.measureText(t).width) / 2, C.y);
}

/* ================= 错误页（云端数据异常时显示问题清单） ================= */
function showError(lines) {
  errorLines = lines || ['数据加载失败'];
  scene = 'error';
  scrollY = 0;
  draw();
}

function drawError() {
  C.y = H * 0.18;
  R.setFont(ctx, 20, true);
  ctx.fillStyle = P.text1;
  var title = '数据加载失败';
  ctx.fillText(title, (W - ctx.measureText(title).width) / 2, C.y);
  C.y += 36;

  R.setFont(ctx, 13);
  ctx.fillStyle = P.text2;
  var sub = '云端数据库存在问题，请到微信开发者工具「云开发」控制台排查：';
  C.y = R.drawWrapped(ctx, sub, PAD, C.y, W - PAD * 2, 20, P.text2, 13);
  C.y += 12;

  // 问题清单卡片
  var list = errorLines.length ? errorLines : ['未知错误'];
  var cardW = W - PAD * 2;
  var padX = 14, padY = 14, lh = 20;
  var maxW = cardW - padX * 2;
  var lines = [];
  list.forEach(function (item) {
    R.wrapText(ctx, '· ' + item, maxW).forEach(function (l) { lines.push(l); });
  });
  var cardH = padY * 2 + lines.length * lh;

  R.fillRoundRect(ctx, PAD, C.y, cardW, cardH, 12, P.card);
  R.roundRectPath(ctx, PAD, C.y, cardW, cardH, 12);
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  ctx.stroke();

  R.setFont(ctx, 13);
  ctx.fillStyle = P.text1;
  var yy = C.y + padY + 15;
  lines.forEach(function (l) {
    ctx.fillText(l, PAD + padX, yy);
    yy += lh;
  });
  C.y += cardH + 16;

  R.setFont(ctx, 12);
  ctx.fillStyle = P.text3;
  var tip = '修复后重新编译即可。常见原因：集合未导入、权限未设「所有用户可读」、字段缺失。';
  C.y = R.drawWrapped(ctx, tip, PAD, C.y, W - PAD * 2, 18, P.text3, 12);
}


/* ================= 开场播片 ================= */
function startIntro() {
  scene = 'intro';
  introIdx = 0;
  draw();
  playIntroStep();
}

function playIntroStep() {
  var intro = tset('intro') || [];
  if (introIdx >= intro.length) return;
  introIdx++;
  draw();
  introTimer = setTimeout(playIntroStep, 1000);
}

function drawIntro() {
  var intro = tset('intro') || [];
  var uiSet = tset('intro_ui') || {};
  var yy = H * 0.2;
  for (var i = 0; i < introIdx && i < intro.length; i++) {
    var line = intro[i];
    yy = R.drawWrapped(ctx, line[0], PAD, yy, W - PAD * 2, LINEH,
      line[1] ? P.text1 : P.text2, line[1] ? 20 : 16, line[1]);
    yy += 6;
  }
  // 开场播片的「跳过 / 继续」统一放到底部操作区
  if (introIdx >= intro.length) {
    bottomAction(uiSet.next || '继续', gotoTitle, { primary: true });
  } else {
    bottomAction(uiSet.skip || '跳过 ▸', skipIntro);
  }
}

function skipIntro() {
  if (introTimer) clearTimeout(introTimer);
  scene = 'intro';
  introIdx = (tset('intro') || []).length;
  draw();
}

/* ================= 标题页 ================= */
function gotoTitle() { scene = 'title'; scrollY = 0; draw(); }

/* ---------------- 标题页动效 ----------------
 * 「动图」实现：微信小游戏 Canvas 的 drawImage 不会播放 GIF，
 * 动态感全部在这里逐帧绘制：
 *   · 背景轻微「呼吸」（慢速缩放）
 *   · 男女主角独立上下浮动 + 轻微摇摆（intro_lead_m / intro_lead_f）
 *   · 爱心粒子从底部往上飘、渐隐
 *   · 标题逐字跳动（金色立体字由 Canvas 绘制，文案来自 texts.app.title）
 * 动画循环只在支持逐帧调度的环境（真机 / 开发者工具）里跑：
 * 测试用同步 mock 画布没有 canvas.requestAnimationFrame，自动保持静态终态。 */
var TITLE_ANIM = { on: false, raf: 0, t0: 0 };
var TITLE_HEARTS = [];      // 漂浮爱心粒子
var TITLE_SPAWN_AT = 0;     // 上一次生成爱心的时刻

/* 逐帧调度：小游戏主画布的 canvas.requestAnimationFrame 优先，
 * 其次用全局 requestAnimationFrame（小游戏运行时的标准循环驱动，最可靠），
 * 再退回 wx.requestAnimationFrame。三者都没有（测试 mock）就返回 0，
 * 标题页保持静态终态，不跑循环。
 * 说明：测试夹具装的是「异步版」全局 rAF（setTimeout 实现），
 * 不会像同步版那样造成无限同步递归，这里可以放心使用全局版本。 */
function rafSupported() {
  return (canvas && typeof canvas.requestAnimationFrame === 'function') ||
    (typeof requestAnimationFrame === 'function') ||
    (typeof wx !== 'undefined' && typeof wx.requestAnimationFrame === 'function');
}
function raf(cb) {
  if (canvas && typeof canvas.requestAnimationFrame === 'function') return canvas.requestAnimationFrame(cb);
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(cb);
  if (typeof wx !== 'undefined' && typeof wx.requestAnimationFrame === 'function') return wx.requestAnimationFrame(cb);
  return 0;
}

function startTitleAnim() {
  if (TITLE_ANIM.on) return;
  if (!canvas || !rafSupported()) return;
  TITLE_ANIM.on = true;
  TITLE_ANIM.t0 = Date.now();
  TITLE_HEARTS.length = 0;
  var loop = function () {
    if (!TITLE_ANIM.on) return;
    if (scene !== 'title') { TITLE_ANIM.on = false; return; }
    draw();
    TITLE_ANIM.raf = raf(loop);
  };
  TITLE_ANIM.raf = raf(loop);
}

/* 动效时间（秒）。静态兜底取 1.2s：一个各相位都好看的中间帧 */
function titleT() { return TITLE_ANIM.on ? (Date.now() - TITLE_ANIM.t0) / 1000 : 1.2; }

function drawTitleScene() {
  var t = titleT();

  /* 背景：以 cover 方式铺满，叠加慢速呼吸缩放 */
  var img = art.mainImg('intro_bg');
  if (img) {
    var zoom = 1.015 + 0.008 * Math.sin(t * 0.6);
    var s = Math.max(W / img.width, H / img.height) * zoom;
    var dw = img.width * s, dh = img.height * s;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = P.bg;
    ctx.fillRect(0, 0, W, H);
  }

  drawTitleLeads(t);
  drawTitleHearts(t);
  drawTitleLogo(t);
}

/* 男女主角：放大、外缘贴左右屏幕边、膝盖（底部）贴下边缘、中间留白给按钮。
 * 以「图片底边中点」为支点轻摆：脚/膝始终贴底，不会随动画抬离下边缘。 */
function drawTitleLeads(t) {
  var baseH = H * 0.56;            // 放大：约占屏高 56%
  var bottomY = H - 2;             // 膝盖/脚贴屏幕下边缘
  function leadW(key) {
    var im = art.mainImg(key);
    return (im && im.width) ? baseH * im.width / im.height : 0;
  }
  function lead(key, cx, phase) {
    var img = art.mainImg(key);
    if (!img || !img.width) return;
    var h = baseH;
    var w = h * img.width / img.height;
    var sway = Math.sin(t * 0.9 + phase) * 0.025;   // 仅绕底部支点轻摆
    ctx.save();
    ctx.translate(cx, bottomY);     // 支点 = 图片底边中点
    ctx.rotate(sway);
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }
  var wm = leadW('intro_lead_m');
  var wf = leadW('intro_lead_f');
  var cxM = W * 0.30 - wm / 2;      // 右缘落在 0.30W，左肩略出屏 → 手肘贴左边
  var cxF = W * 0.70 + wf / 2;      // 左缘落在 0.70W，右肩略出屏 → 手肘贴右边
  lead('intro_lead_m', cxM, 0);
  lead('intro_lead_f', cxF, 2.8);
}

/* 爱心粒子：约 650ms 一颗，从底部往上飘、左右轻摆、渐隐 */
function drawTitleHearts(t) {
  var now = Date.now();
  if (TITLE_ANIM.on && now - TITLE_SPAWN_AT > 650 && TITLE_HEARTS.length < 12) {
    TITLE_SPAWN_AT = now;
    TITLE_HEARTS.push({
      x: W * (0.12 + Math.random() * 0.76),
      y: H * (0.72 + Math.random() * 0.22),
      v: H * 0.00006 * (0.8 + Math.random() * 0.5),   // px/ms
      size: Math.round(9 + Math.random() * 8),
      life: 0
    });
  }
  for (var i = TITLE_HEARTS.length - 1; i >= 0; i--) {
    var p = TITLE_HEARTS[i];
    p.life += 16;
    p.y -= p.v * 16;
    p.x += Math.sin(t * 2 + p.y * 0.02) * 0.35;
    var fade = 1 - p.life / 6500;
    if (!TITLE_ANIM.on || fade <= 0 || p.y < H * 0.42) { TITLE_HEARTS.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = Math.min(1, fade) * 0.7;
    ctx.fillStyle = P.accent;
    R.setFont(ctx, p.size, true);
    ctx.textAlign = 'center';
    ctx.fillText('\u2665', p.x, p.y);
    ctx.restore();
  }
}

/* 标题 Logo：金色立体字 + 逐字跳动；文案来自 texts.app.title（不硬编码） */
function drawTitleLogo(t) {
  var app = tset('app') || {};
  var title = app.title || '我妈又催婚';
  var chars = String(title).split('');
  var n = chars.length;
  if (!n) return;
  var size = Math.min(W * 0.82 / n, W * 0.16);
  var cy = SAFE_TOP + H * 0.13;
  for (var i = 0; i < n; i++) {
    var cx = W / 2 + (i - (n - 1) / 2) * size * 1.12;
    var y = cy + Math.sin(t * 2.4 - i * 0.55) * size * 0.10;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    R.setFont(ctx, Math.round(size), true);
    /* 立体阴影 */
    ctx.fillStyle = 'rgba(122, 74, 18, 0.4)';
    ctx.fillText(chars[i], cx + size * 0.06, y + size * 0.09);
    /* 深色描边 */
    ctx.lineWidth = Math.max(2, size * 0.14);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#7a4a12';
    ctx.strokeText(chars[i], cx, y);
    /* 金色渐变填充 */
    var grad = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
    grad.addColorStop(0, '#fff3bd');
    grad.addColorStop(0.55, '#f8c94e');
    grad.addColorStop(1, '#e8961e');
    ctx.fillStyle = grad;
    ctx.fillText(chars[i], cx, y);
    ctx.restore();
  }
  /* 副标题 */
  if (app.sub) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    R.setFont(ctx, Math.round(Math.max(11, W * 0.032)), false);
    ctx.fillStyle = 'rgba(110, 70, 30, 0.72)';
    ctx.fillText(app.sub, W / 2, cy + size * 0.85);
    ctx.restore();
  }
}

function drawTitle() {
  var app = tset('app') || {};

  /* 动态标题场景：背景呼吸 + 人物浮动 + 爱心 + 逐字跳动标题 */
  drawTitleScene();

  /* 资源自检：只在「还没加载完 / 有失败」时露一行小字，方便定位问题；
   * 一切正常时完全不出现，不干扰标题页。 */
  var ast = art.stats();
  if (ast.total && (ast.failed.length || (ast.pending && !ast.loaded))) {
    R.setFont(ctx, 11, false);
    var msg = ast.failed.length
      ? ('美术资源异常：' + ast.failed.length + ' 张加载失败（详见控制台）')
      : ('美术资源加载中… ' + ast.loaded + '/' + ast.total);
    centerText(msg, W / 2, SAFE_TOP + 16, 11, P.text3, false);
  }

  var saved = loadGame();
  var items = [
    { label: app.start || '开始游戏', sub: null, onClick: startSetup, opts: { primary: true } }
  ];
  if (saved) {
    items.push({
      label: '继续游戏', sub: '从上一次的进度接着走',
      onClick: function () { resumeGame(saved); }, opts: {}
    });
  }
  items.push({
    label: (tset('gallery') || {}).entry || '相亲图鉴', sub: (tset('gallery') || {}).sub || null,
    onClick: openGallery, opts: {}
  });
  items.push({
    label: app.rules || '玩法说明', sub: null,
    onClick: function () { scene = 'rules'; scrollY = 0; draw(); }, opts: {}
  });

  /* 按钮列放在男女主中间的留白区：居中、窄于整屏，
   * 左右缘（0.30W / 0.70W）正好避开两侧人物。 */
  var btnW = Math.round(W * 0.40);
  C.y = Math.max(SAFE_TOP + 40, Math.round(H * 0.50));

  items.forEach(function (it) {
    var o = {};
    for (var k in it.opts) o[k] = it.opts[k];
    o.gap = 12;
    o.w = btnW;
    titleButton(it.label, it.sub, it.onClick, o);
  });

  /* 音乐开关已改为「左上角全局浮窗」（见 drawMusicToggle），
   * 所有页面都能看到、能点，这里不再单独画一个。 */
}

/* ================= 玩法说明 ================= */
function drawRules() {
  var RULE = tset('rules') || {};
  section(RULE.head || '玩法说明', RULE.sub || '');
  var lines = RULE.lines || [];
  var padIn = CARD_PAD;                       // 卡片内边距 16
  var textW = W - PAD * 2 - padIn * 2;
  var innerTop = padIn + 4, innerGap = 4;
  /* 先按真实换行量出高度，保证白框包住所有文字（含自动折行） */
  var totalLines = 0;
  for (var i = 0; i < lines.length; i++) {
    totalLines += R.wrapText(ctx, lines[i], textW).length;
  }
  var boxH = innerTop + totalLines * LINEH + (lines.length ? (lines.length - 1) * innerGap : 0) + (padIn - 4);
  R.fillRoundRect(ctx, PAD, C.y, W - PAD * 2, boxH, 14, P.card);
  var yy = C.y + innerTop;
  for (var j = 0; j < lines.length; j++) {
    yy = R.drawWrapped(ctx, lines[j], PAD + padIn, yy, textW, LINEH, P.text1, 14);
    if (j < lines.length - 1) yy += innerGap;
  }
  C.y = C.y + boxH + 12;
  bottomAction(RULE.back || '返回', function () { scene = 'title'; scrollY = 0; draw(); });
}

/* ================= 设定流程 ================= */
function startSetup() {
  scene = 'setup';
  setupStep = 0;
  /* 清掉上一局的运行时残留（尤其 today.stylePayload）：设定页是「开新档」，
   * 不该继承上一局交往风格叠层的开态，否则 styleOverlayOpen() 会误判为真、
   * 把底部操作区（含「开始这段人生」）整个压掉。新档的 today 由 beginGame 重建。 */
  today = null;
  lastCtxKey = null;
  pendingKey = null;
  pendingAction = null;
  pick = { gender: null, bgId: null, goalId: null, difficulty: null, seed: Math.floor(Math.random() * 100000) + 1 };
  scrollY = 0;
  draw();
}

/* 设定流程：两页合并
 *   第 0 页「base」    ：性别（一行两个：男 / 女）+ 出身背景（选了性别才联动出现，每行一个）
 *   第 1 页「goaldiff」：人生目标（每行一个）+ 难度（每行一个）
 * 两页各自「都选齐才放行确认」，满足「合并到一页、都选才能确认」的要求。
 * 选择状态直接写进 pick（高亮即已选），不再依赖全局 pendingKey，
 * 这样合并页上「性别 + 出身」「目标 + 难度」能各自独立高亮、互不清除，
 * 也天然满足「默认不预选 / 回退不残留 / 再点可取消」。 */
var SETUP_PAGES = ['base', 'goaldiff'];

/* stepKey（gender/bg/goal/diff）→ pick 里对应的字段名 */
function setupField(stepKey) {
  if (stepKey === 'gender') return 'gender';
  if (stepKey === 'bg') return 'bgId';
  if (stepKey === 'goal') return 'goalId';
  if (stepKey === 'diff') return 'difficulty';
  return null;
}

/* 单选点选：写进 pick（再点一次取消）。
 * 改性别会级联清空出身 / 目标；改出身会级联清空目标（与「联动展示」一致）。 */
function pickSetup(stepKey, id) {
  var f = setupField(stepKey);
  if (!f) return;
  if (pick[f] === id) pick[f] = null;          // 再点一次取消选中
  else pick[f] = id;
  if (stepKey === 'gender') { pick.bgId = null; pick.goalId = null; }
  if (stepKey === 'bg') { pick.goalId = null; }
  draw();
}

/* 高亮 = 实际已选值（和点击写入的是同一份，不会残留、默认不预选） */
function isSetupSelected(stepKey, id) {
  var f = setupField(stepKey);
  return f ? pick[f] === id : false;
}

/* 当前合并页是否「都选齐」 */
function setupPageReady(pageKey) {
  if (pageKey === 'base') return !!pick.gender && !!pick.bgId;
  if (pageKey === 'goaldiff') return !!pick.goalId && !!pick.difficulty;
  return false;
}

/* 确认：本页都选齐才放行；base 页进下一页，goaldiff 页直接开局 */
function setupCommit(pageKey) {
  if (!setupPageReady(pageKey)) return;
  if (pageKey === 'base') { setupStep = 1; scrollY = 0; draw(); }
  else { beginGame(); }
}

/* 底部「确认」：未选齐置灰，选齐后可点 */
function setupConfirm(label, pageKey) {
  bottomAction(label, function () { setupCommit(pageKey); },
    { primary: true, disabled: !setupPageReady(pageKey) });
}

/* ---- 开局设定页头（原型：步骤标签 + 大标题 + 副描述） ---- */
function setupHead() {
  var U = tset('setup') || {};
  var step = U.stepLabel || '开局设定 · CHARACTER SETUP';
  var title = U.pageTitle || '创建你的角色';
  var sub = U.pageSub || '性别决定相亲对象与部分剧情措辞，出身背景决定全部初始属性与职业。';
  R.setFont(ctx, 11, true); ctx.fillStyle = P.text3;
  ctx.fillText(step, PAD, C.y + 12);
  C.y += 20;
  R.setFont(ctx, 24, true); ctx.fillStyle = P.text1;
  ctx.fillText(title, PAD, C.y + 22);
  C.y += 30;
  C.y = R.drawWrapped(ctx, sub, PAD, C.y + 12, W - PAD * 2, 18, P.text2, 12);
  C.y += 12;
}

/* 出身背景的「起步难度」胶囊：由初始属性综合评分推导（游戏无该字段，视觉对齐原型） */
function bgTierBadge(b) {
  var ini = (b && b.init) || {};
  var moneyScore = Math.min(100, (ini.money || 0) / 5000);
  var comp = (moneyScore + (ini.health || 0) + (ini.career || 0)
    + (ini.looks || 0) + (ini.family || 0) + (ini.mood || 0)) / 6;
  if (comp >= 68) return { text: '轻松 ★', tone: 'easy' };
  if (comp >= 52) return { text: '普通 ★★', tone: 'normal' };
  if (comp >= 42) return { text: '困难 ★★★', tone: 'hard' };
  return { text: '地狱 ★★★★', tone: 'hell' };
}

/* 出身背景的初始属性 chips（原型：结构化 chips 替代长文字流） */
function bgChips(b) {
  var ini = (b && b.init) || {};
  return [
    { label: '存款', value: engine.moneyText(ini.money || 0), tone: chipTone(ini.money || 0, true) },
    { label: '健康', value: ini.health || 0, tone: chipTone(ini.health || 0) },
    { label: '事业', value: ini.career || 0, tone: chipTone(ini.career || 0) },
    { label: '颜值', value: ini.looks || 0, tone: chipTone(ini.looks || 0) },
    { label: '家境', value: ini.family || 0, tone: chipTone(ini.family || 0) },
    { label: '情绪', value: ini.mood || 0, tone: chipTone(ini.mood || 0) }
  ];
}

var GOAL_EMOJI = { marry: '💍', true_love: '💗', rich_alone: '💰', career_peak: '📈', settle: '🏠' };
function goalEmoji(id) { return GOAL_EMOJI[id] || '🎯'; }

/* 底部「当前已选」提示（原型：确认栏上方一行小字） */
function setupPickedHint() {
  function findName(list, id, gender) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        var nm = list[i].name;
        if (list[i].nameByGender && gender) nm = list[i].nameByGender[gender] || nm;
        return nm;
      }
    }
    return null;
  }
  if (setupStep === 1) {
    var gn = findName(DB.list('goals'), pick.goalId, pick.gender);
    var dn = findName(DB.list('difficulties'), pick.difficulty);
    var parts = [];
    if (gn) parts.push(gn);
    if (dn) parts.push(dn);
    return parts.length ? ('当前已选：' + parts.join(' · ')) : '请选择人生目标与难度';
  }
  var bn = findName(DB.list('backgrounds'), pick.bgId);
  return bn ? ('当前已选：' + bn) : '请选择性别与出身背景';
}

function drawSetup() {
  var U = tset('setup') || {};
  setupHead();

  if (setupStep === 0) {
    /* 第 0 页：性别（分段控件）+ 出身背景（选了性别才联动出现，富卡片） */
    sectionBadge(U.genderHead, U.genderSub, 1);
    drawGenderRow(U);
    if (pick.gender) {
      sectionBadge(U.bgHead, U.bgSub, 2);
      var bgs = DB.list('backgrounds');
      bgs.forEach(function (b) {
        var tier = bgTierBadge(b);
        optionCard({
          title: b.name,
          tagline: b.tag,
          badge: tier.text, badgeTone: tier.tone,
          avatar: art.heroImg(b.id, pick.gender), avatarSize: 48,
          chips: bgChips(b),
          selected: isSetupSelected('bg', b.id),
          setup: 'bg', setupId: b.id,
          onClick: (function (id) { return function () { pickSetup('bg', id); }; })(b.id)
        });
      });
    }
    /* base 页没有上一步；性别 + 出身都选齐才放行「确认」 */
    bottomHint = setupPickedHint();
    setupConfirm(U.confirm || '确认', 'base');
  } else if (setupStep === 1) {
    /* 第 1 页：人生目标 + 难度，均富卡片 */
    drawSetupHero();
    sectionBadge(U.goalHead, U.goalSub, 1);
    var bgs2 = DB.list('backgrounds');
    var bg = null;
    for (var i = 0; i < bgs2.length; i++) if (bgs2[i].id === pick.bgId) bg = bgs2[i];
    var goals = DB.list('goals');
    (bg ? bg.goals : []).forEach(function (gid) {
      var g = null;
      for (var j = 0; j < goals.length; j++) if (goals[j].id === gid) g = goals[j];
      if (!g) return;
      var nm = (g.nameByGender && g.nameByGender[pick.gender]) || g.name;
      optionCard({
        icon: goalEmoji(gid),
        title: nm,
        sub: g.desc,
        selected: isSetupSelected('goal', gid),
        setup: 'goal', setupId: gid,
        onClick: (function (id) { return function () { pickSetup('goal', id); }; })(gid)
      });
    });
    sectionBadge(U.diffHead, U.diffSub, 2);
    var diffs = DB.list('difficulties');
    diffs.forEach(function (d) {
      var stars = d.id === 'easy' ? '★' : (d.id === 'normal' ? '★★' : '★★★');
      optionCard({
        title: d.name,
        sub: d.desc + '　' + fmt(U.diffMeta, { days: d.partnerDeadline }),
        badge: stars, badgeTone: DIFF_PILL[d.id] ? d.id : 'normal',
        selected: isSetupSelected('diff', d.id),
        setup: 'diff', setupId: d.id,
        onClick: (function (id) { return function () { pickSetup('diff', id); }; })(d.id)
      });
    });
    bottomHint = setupPickedHint();
    bottomAction(U.backBase || '上一步', function () { setupStep = 0; scrollY = 0; draw(); });
    setupConfirm(U.begin || '开始游戏', 'goaldiff');
  }
}

/* 性别分段控件：男 / 女 横向并排，点一次选中、再点一次取消 */
function drawGenderRow(U) {
  var opts = U.genderOptions || [];
  if (!opts.length) return;
  drawSegmented({
    setup: 'gender',
    options: opts.map(function (g) {
      return { id: g.id, label: g.label, icon: g.id === 'm' ? '👦' : '👧' };
    }),
    selectedId: pick.gender,
    onPick: function (id) { pickSetup('gender', id); }
  });
}

/* 主角形象：按「出身背景职业 + 性别」取职业头像，不再随机生成 */
function drawSetupHero() {
  if (!pick.gender) return;
  var U = tset('setup') || {};
  var size = 80;
  var img = art.heroImg(pick.bgId, pick.gender);
  drawRoleAvatar(img, W / 2, C.y + size / 2, size, '头像');
  C.y += size + 12;
  R.setFont(ctx, 13);
  ctx.fillStyle = P.text2;
  var nm = pick.gender === 'm' ? U.genderMale : U.genderFemale;
  var tw = ctx.measureText(nm).width;
  ctx.fillText(nm, (W - tw) / 2, C.y);
  C.y += 12;
}

/* 程序化写入选择（测试 / 存档兼容用）：与 UI 走同一套规则，避免两边逻辑漂移 */
function setGender(g) { pickSetup('gender', g); setupStep = 0; scrollY = 0; draw(); }
function setBg(id) { pickSetup('bg', id); setupStep = 0; scrollY = 0; draw(); }
function setGoal(id) { pickSetup('goal', id); setupStep = 1; scrollY = 0; draw(); }
function setDifficulty(id) { pickSetup('diff', id); draw(); }

/* =========================================================
 * 结局页「看广告领奖励 · 再开一局」（微信激励视频）
 * ---------------------------------------------------------
 * 规则：
 *   · 数值（AD_REWARD_*）/ 广告位（AD_UNIT_ID）/ 开关（AD_ENABLED）/ 文案
 *     全部在云端，这里只做流程；
 *   · 奖励在「下一局开局时」发放，不回改这一局结局页上已经展示的成绩；
 *   · 广告拉不起来或中途退出都不发奖，也不卡住玩家（给了提示，仍可直接重开）。
 * ========================================================= */

/** 云端数据就绪后调用一次：把广告位 ID 交给广告模块 */
function initAd() {
  ad.setUnitId(DB.num('AD_UNIT_ID', ''));
}

/** 广告位 ID 跟着云端常量走（setUnitId 内部有短路，重复调用是空操作）。
 * 不依赖「谁先谁后」的初始化时序：数据换了广告位，下一帧就生效。 */
function syncAdUnit() {
  ad.setUnitId(DB.num('AD_UNIT_ID', ''));
}

/** 总开关 + 当前环境能不能拉起广告 */
function adEntryOpen() {
  syncAdUnit();
  return DB.num('AD_ENABLED', 1) === 1 && ad.available();
}

function adRewardSpec() {
  return {
    money: DB.num('AD_REWARD_MONEY', 0) || 0,
    mood: DB.num('AD_REWARD_MOOD', 0) || 0,
    health: DB.num('AD_REWARD_HEALTH', 0) || 0
  };
}

/** 待发放的广告奖励（看完广告写下，下一局开局消费） */
function pendingAdReward() {
  try {
    var raw = wx.getStorageSync(AD_REWARD_KEY);
    if (!raw) return null;
    var v = JSON.parse(raw);
    if (!v || typeof v !== 'object') return null;
    return (v.money || v.mood || v.health) ? v : null;
  } catch (e) { return null; }
}
function saveAdReward(r) {
  try { wx.setStorageSync(AD_REWARD_KEY, JSON.stringify(r)); } catch (e) { /* ignore */ }
}
function clearAdReward() {
  try { wx.removeStorageSync(AD_REWARD_KEY); } catch (e) { /* ignore */ }
}

/** 开局时把上一局看广告换来的奖励发下去 */
function grantPendingAdReward() {
  var r = pendingAdReward();
  if (!r || !S) return null;
  clearAdReward();
  S.money = Math.max(0, S.money + (r.money || 0));
  S.mood = engine.clamp(S.mood + (r.mood || 0), 0, 100);
  S.health = engine.clamp(S.health + (r.health || 0), 0, 100);
  var E = tset('end') || {};
  pushFlash('✓', fmt(E.adRewardFlash || '广告奖励到账：存款 +{money}',
    { money: engine.moneyText(r.money || 0) }), P.up);
  return r;
}

/** 点「看广告 · +N」：看完记下奖励并直接回标题开新一局 */
function watchAdAndRestart() {
  var E = tset('end') || {};
  if (!adEntryOpen()) {
    pushFlash('!', E.adNotReady || '广告还没准备好，可以先直接开新一局', P.warn);
    draw();
    return;
  }
  pushFlash('…', E.adLoading || '广告加载中…', P.text3);
  draw();
  ad.show(function (res) {
    if (res.ok) {
      saveAdReward(adRewardSpec());
      restartNow();
      return;
    }
    /* 中途退出：明确告诉他没拿到，别让人以为是 bug */
    pushFlash('!', res.reason === 'abort'
      ? (E.adAbort || '广告没看完，奖励没拿到')
      : (E.adNotReady || '广告还没准备好，可以先直接开新一局'), P.warn);
    draw();
  });
}

function beginGame() {
  S = engine.createGame(pick.gender, pick.bgId, pick.goalId, pick.seed, pick.difficulty);
  /* 上一局看广告换来的奖励，在这一局开局时兑现 */
  grantPendingAdReward();
  today = newDay();
  scene = 'play';
  scrollY = 0;
  saveGame();
  draw();
}

/* ================= 主游戏 ================= */
function newDay() {
  return {
    phase: 'choose', action: null, event: null, costDays: 0, costMoney: 0,
    result: null, afterEvent: null, stylePayload: null, dateType: null,
    actionDelta: null, introLines: null, note: null, confirmRestart: false,
    pendingOption: null,       // 事件选项的「待确认」索引（两步确认用）
    resolved: false,           // 事件是否已确认（结果在事件页内展示）
    chosenLabel: null          // 已确认时玩家选的选项原文
  };
}

function drawPlay() {
  consumeFlashes();
  /* 交往风格叠层 / 关键事件浮窗打开时，下层页面降级为「背景」：只画、不接交互 */
  modalInert = styleOverlayOpen() || keyModalOpen();
  /* 关键事件浮窗打开时，整页被浮窗盖住，下层不绘制（也避免布局审计把两层文字都算上） */
  if (keyModalOpen()) return;

  /* 事件 / 结算走独立的二级页面：不展示属性与目标，界面更聚焦 */
  if (today && today.phase === 'event') { drawEventPage(); return; }
  if (today && today.phase === 'done') { drawResultPage(); return; }

  /* 行动二级页（寻找相亲机会 / 其余安排 / 约会档位）同样是「聚焦页」：
   * 头部是背景图，下面只放这一类的操作，不再铺状态条与长期目标。
   * 不排除的话，状态区会被头部背景图压住，两段文字直接叠在一起。 */
  var focused = !!(today && (today.phase === 'seek' || today.phase === 'upgrade' || today.phase === 'date'));
  if (!focused) drawStatus();

  if (today.confirmRestart) {
    section(txt('confirmRestart'), null);
    bottomAction(txt('confirmYes'), restartNow, { primary: true });
    bottomAction(txt('confirmNo'), restartCancel);
    drawLog();
    return;
  }

  if (today.phase === 'choose') drawActionMenu();
  else if (today.phase === 'seek') drawSeekMenu();
  else if (today.phase === 'upgrade') drawUpgradeMenu();
  else if (today.phase === 'date') drawDateMenu();

  /* 「近期经历」只在主界面（行动菜单）上展示，二级页保持干净 */
  if (!focused) drawLog();

  /* 交往风格是叠层（见 drawStyleOverlay）：叠层打开时，
   * 下层页面只作为背景保留，底部操作区交给叠层自己。 */
  if (styleOverlayOpen()) return;

  // 「重开」与「相亲图鉴」只留在主进程页面（行动菜单），二级页面里不再出现
  if (today.phase === 'choose') {
    bottomAction(ui('galleryEntry', '相亲图鉴'), openGallery);
    bottomAction(txt('restart') || '重开', restartAsk);
  }
}

function drawStatus() {
  /* 卡片化主界面（对齐「主页原型 V2」）：
   * 顶部条（日期 + 紧凑倒计时） → 三栏收支卡 → 关系卡（头像 + 阶段进度）→ 2×3 属性卡 */
  drawPlayTopBar();
  drawFinanceCard();
  drawRelationCard();
  drawAttrGrid(playStatDefs());
  C.y += 10;
}

/* ============ 顶部条：日期 + 紧凑倒计时 ============ */
var PLAY_GREETINGS = ['早安，开始新的一天', '今天也要加油呀', '新的一天，新的可能', '稳住，我们能赢', '今天也要元气满满'];
function playGreeting() {
  if (S.day <= 1) return txt('greetFirst') || '早安，开始新的一天';
  return PLAY_GREETINGS[(S.day - 2) % PLAY_GREETINGS.length];
}

function drawChip(text, x, y) {
  R.setFont(ctx, 11);
  var tw = ctx.measureText(text).width;
  var padX = 8, h = 22, w = tw + padX * 2;
  R.fillRoundRect(ctx, x, y, w, h, 999, '#efe8d8');
  R.roundRectPath(ctx, x, y, w, h, 999);
  ctx.strokeStyle = '#e5dcc8'; ctx.lineWidth = 1; ctx.stroke();
  R.setFont(ctx, 11); ctx.fillStyle = P.text2;
  ctx.fillText(text, x + padX, y + 15);
  return w;
}

function drawPlayTopBar() {
  var topY = C.y;
  var left = Math.max(0, S.diff.maxDays - S.day);

  /* 左：天数 + 问候 + 难度/目标/职业 胶囊 */
  R.setFont(ctx, 12); ctx.fillStyle = P.text3;
  ctx.fillText('第 ' + S.day + ' 天 · ' + engine.weekdayName(S.day), PAD, topY + 12);
  R.setFont(ctx, 21, true); ctx.fillStyle = P.text1;
  ctx.fillText(playGreeting(), PAD, topY + 38);
  var chipY = topY + 50;
  var cx = PAD;
  cx += drawChip(S.diff.name, cx, chipY) + 6;
  cx += drawChip(engine.goalName(S), cx, chipY) + 6;
  if (S.jobName) cx += drawChip(S.jobName, cx, chipY);
  var leftBottom = chipY + 22;

  /* 右：紧凑倒计时卡（仅限时目标的局显示；保留紧急/警告配色语义） */
  var cdW = 112, cdH = 76, cdX = W - PAD - cdW, cdY = topY;
  if (S.goal && S.goal.needRelation) {
    drawCompactCountdown(cdX, cdY, cdW, cdH, left);
  }
  C.y = Math.max(leftBottom, cdY + cdH) + 14;
}

function drawCompactCountdown(x, y, w, h, left) {
  var limit = S.singleLimit || 0;
  var streak = S.singleStreak || 0;
  var remain = Math.max(0, limit - streak);
  var ds = engine.deadlineState(S);
  var single = ds.running, paused = !ds.running;
  var urgent = single && remain <= 10;
  var warn = single && remain <= 20 && remain > 10;
  var main = paused ? P.up : (urgent ? P.down : (warn ? P.warn : P.primary));
  var bg = paused ? '#eef6f1' : (urgent ? '#fdecea' : (warn ? '#fdf3e5' : P.card));
  R.fillRoundRect(ctx, x, y, w, h, 14, bg);
  R.roundRectPath(ctx, x, y, w, h, 14);
  ctx.strokeStyle = (urgent || warn) ? main : P.line;
  ctx.lineWidth = urgent ? 2 : 1; ctx.stroke();

  /* 标题（小字）单独一行：避免与大号天数同排相撞（剩余天数大时尤其明显） */
  R.setFont(ctx, 12, true); ctx.fillStyle = main;
  ctx.fillText(ui('deadlineTitle', '相亲期限'), x + 10, y + 15);

  /* 大号剩余天数 + 天：单独一行，左对齐，不再和标题抢占同一横排 */
  var numTxt = String(remain);
  R.setFont(ctx, 18, true); ctx.fillStyle = main;
  var numW = ctx.measureText(numTxt).width;
  ctx.fillText(numTxt, x + 10, y + 37);
  R.setFont(ctx, 11); ctx.fillStyle = P.text2;
  ctx.fillText('天', x + 10 + numW + 4, y + 37);

  /* 状态提示（暂停 / 仍单身 / 待赴约）：去掉引导的「· 」，换行展示 */
  var hint = (txt(DEADLINE_HINT_KEY[ds.state] || 'deadlinePaused') || '').replace(/^\s*·\s*/, '');
  R.setFont(ctx, 10); ctx.fillStyle = P.text2;
  R.drawWrapped(ctx, hint, x + 10, y + 52, w - 20, 13, P.text2, 10);

  /* 进度条（已消耗比例） */
  var barW = w - 20, barY = y + h - 8;
  R.fillRoundRect(ctx, x + 10, barY, barW, 4, 2, '#f0e9da');
  var used = limit > 0 ? Math.min(1, streak / limit) : 0;
  if (used > 0) R.fillRoundRect(ctx, x + 10, barY, Math.max(used * barW, 4), 4, 2, main);
}

/* ============ 收支三栏卡 ============ */
function drawFinanceCard() {
  var fin = engine.monthFinance(S);
  var net = fin.net;
  var w = W - PAD * 2, x = PAD, y = C.y, h = 62;
  R.fillRoundRect(ctx, x, y, w, h, 14, P.card);
  R.roundRectPath(ctx, x, y, w, h, 14); ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.stroke();

  var colW = (w - 2) / 3;
  drawFinItem('本月收入', (fin.income >= 0 ? '+' : '') + engine.moneyText(fin.income), P.primary, x + 10, y, false, null);
  drawFinItem('本月支出', (fin.expense >= 0 ? '-' : '') + engine.moneyText(fin.expense), P.text2, x + colW + 10, y, false, null);
  var note = '基本' + engine.moneyText(fin.baseIncome) + '＋事业' + engine.moneyText(fin.careerBonus);
  drawFinItem('净结余', (net >= 0 ? '+' : '') + engine.moneyText(net), P.primary, x + colW * 2 + 10, y, true, clipText(note, colW - 20));

  ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = P.line; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + colW, y + 12); ctx.lineTo(x + colW, y + h - 12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + colW * 2, y + 12); ctx.lineTo(x + colW * 2, y + h - 12); ctx.stroke();
  ctx.restore();
  C.y += h + GAP;
}

function drawFinItem(k, v, vColor, x, y, isNet, note) {
  R.setFont(ctx, 11); ctx.fillStyle = P.text3;
  ctx.fillText(k, x, y + 20);
  R.setFont(ctx, isNet ? 20 : 16, true); ctx.fillStyle = vColor;
  ctx.fillText(v, x, y + 42);
  if (note) { R.setFont(ctx, 9); ctx.fillStyle = P.text3; ctx.fillText(note, x, y + 56); }
}

/* ============ 关系卡：头像 + 阶段进度 ============ */
function relationStageIndex(rel) {
  if (rel === 'talking') return 1;
  if (rel === 'dating' || rel === 'married') return 2;
  return 0;                              // single / meeting
}

function drawStatusTag(rel, cx, y) {
  R.setFont(ctx, 14, true);
  var tw = ctx.measureText(rel).width;
  var pw = tw + 28, ph = 26;
  R.fillRoundRect(ctx, cx - pw / 2, y, pw, ph, 999, '#fbe9ec');
  R.roundRectPath(ctx, cx - pw / 2, y, pw, ph, 999);
  ctx.strokeStyle = '#f6d3d0'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = P.accent;
  ctx.fillText(rel, cx - tw / 2, y + ph / 2 + 5);
}

function drawStageProgress(activeIdx, cx, y, totalW) {
  var labels = ['相亲', '暧昧', '恋爱'];
  var nodeD = 22, segW = (totalW - nodeD * 3) / 2;
  var sx = cx - totalW / 2;
  for (var i = 0; i < 3; i++) {
    var nx = sx + nodeD / 2 + i * (nodeD + segW);
    var ncy = y + nodeD / 2;
    var isActive = i === activeIdx;
    var isDone = i < activeIdx;
    if (i < 2) {
      ctx.strokeStyle = isDone ? P.accent : P.line; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(nx + nodeD / 2, ncy);
      ctx.lineTo(nx + nodeD / 2 + segW, ncy);
      ctx.stroke();
    }
    if (isActive) {
      ctx.save(); ctx.fillStyle = '#fbe9ec';
      ctx.beginPath(); ctx.arc(nx, ncy, nodeD / 2 + 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    R.fillRoundRect(ctx, nx - nodeD / 2, ncy - nodeD / 2, nodeD, nodeD, 999,
      isActive ? P.accent : (isDone ? '#fbe9ec' : '#f0e9da'));
    if (!isActive) {
      R.roundRectPath(ctx, nx - nodeD / 2, ncy - nodeD / 2, nodeD, nodeD, 999);
      ctx.strokeStyle = isDone ? P.accent : '#e5dcc8'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    centerText(String(i + 1), nx, ncy + 4, 11, isActive ? '#fff' : (isDone ? P.accent : P.text3), true);
    R.setFont(ctx, 10); ctx.fillStyle = isActive ? P.accent : P.text3;
    var lw = ctx.measureText(labels[i]).width;
    ctx.fillText(labels[i], nx - lw / 2, ncy + nodeD / 2 + 12);
  }
}

function drawRelationCard() {
  var w = W - PAD * 2, x = PAD;
  var avSize = 52;
  var top = C.y + 12;
  var avCy = top + avSize / 2;
  var nameY = top + avSize + 16;
  var descY = nameY + 15;
  var extraY = descY + 14;
  var h = (extraY + 26) - C.y;

  /* 关系预警：踩到对方在意的那条底线之后，这里会一直挂着一条红色提示条。
   * 只靠「闪 3 秒的提示条」传这种信息太容易错过 —— 而这条信息决定玩家接下来
   * 几天要不要优先救这一项。挂在关系卡上，等于把「分手倒计时」摆在最显眼处。 */
  var warnReason = (S.leaveWarnDay != null && S.leaveWarnReason) ? S.leaveWarnReason : null;
  if (warnReason) h += 30;

  R.fillRoundRect(ctx, x, C.y, w, h, 14, P.card);
  R.roundRectPath(ctx, x, C.y, w, h, 14); ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.stroke();

  var colHalf = 44;
  var leftCx = x + colHalf;
  var rightCx = x + w - colHalf;

  /* 左：主角 */
  drawRoleAvatar(art.heroImg(S.bg.id, S.gender), leftCx, avCy, avSize, '我');
  centerText('你', leftCx, nameY, 13, P.text1, true);
  centerText(S.bg.name, leftCx, descY, 10, P.text2, false);
  var ownHint = txt('statTap');
  if (ownHint) centerText(ownHint, leftCx, extraY + 8, 10, P.text3, false);
  buttons.push({ x: leftCx - colHalf, y: top - 12, w: colHalf * 2, h: h - 12, label: 'hero:stats', onClick: openStatDetail });

  /* 右：对象 / 待见面的人 */
  var other = S.partner || S.lead;
  if (other) {
    drawRoleAvatar(art.partnerImg(other.job, other.gender, other.avatar), rightCx, avCy, avSize, 'TA');
    centerText(other.name, rightCx, nameY, 13, P.text1, true);
    centerText(S.partner ? other.personality : (txt('leadTag') || ''), rightCx, descY, 10, P.text2, false);
    drawPartnerAffection(rightCx, extraY - 2, colHalf * 2 - 8);
  } else {
    R.fillRoundRect(ctx, rightCx - avSize / 2, top, avSize, avSize, 26, '#f0ead9');
    R.roundRectPath(ctx, rightCx - avSize / 2, top, avSize, avSize, 26);
    ctx.strokeStyle = '#d8cfba'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
    R.setFont(ctx, 24); ctx.fillStyle = P.text3;
    ctx.fillText('?', rightCx - ctx.measureText('?').width / 2, top + avSize / 2 + 8);
    centerText(txt('noPartner') || '暂无对象', rightCx, nameY, 13, P.text1, true);
    centerText(txt('noPartnerSub') || '先去找机会', rightCx, descY, 10, P.text2, false);
    var ph = txt('profileTap');
    if (ph) centerText(ph, rightCx, extraY + 8, 10, P.text3, false);
  }
  buttons.push({ x: rightCx - colHalf, y: top - 12, w: colHalf * 2, h: h - 12, label: 'partner:profile', onClick: openPartnerProfile });

  /* 中：状态标签 + 三阶段进度 */
  var relNames = tset('rel_names') || {};
  var rel = relNames[S.relationship] || S.relationship;
  var midCx = x + w / 2;
  drawStatusTag(rel, midCx, top + 6);
  drawStageProgress(relationStageIndex(S.relationship), midCx, top + 44, Math.min(w - colHalf * 4 - 8, 150));

  /* 底部预警条（内嵌在卡里，占满可用宽度） */
  if (warnReason) {
    var padIn = 12;
    var bw = w - padIn * 2, bh = 24;
    var by = C.y + h - bh - 6;
    R.fillRoundRect(ctx, x + padIn, by, bw, bh, 12, '#fbebe9');
    R.roundRectPath(ctx, x + padIn, by, bw, bh, 12);
    ctx.strokeStyle = '#f2d5d2'; ctx.lineWidth = 1; ctx.stroke();

    R.setEmojiFont(ctx, 11);
    ctx.fillStyle = P.down;
    var iw = ctx.measureText(ICON.warn).width;
    var ibx = x + padIn + 8;
    ctx.fillText(ICON.warn, ibx, by + bh / 2 + 4);

    R.setFont(ctx, 11, true);
    ctx.fillStyle = P.down;
    var label = fmt(ui('partner_leave_warn_card', '关系预警 · {reason}'), { reason: warnReason });
    /* 先设好字体再量宽度 —— clipText 用的是当前 ctx.font */
    ctx.fillText(clipText(label, bw - 16 - iw - 10), ibx + iw + 5, by + bh / 2 + 4);
  }

  C.y += h + GAP;
}

/* ============ 2×3 属性卡 ============ */
var ATTR_META = {
  money: { icon: '💰', bg: '#fdf3e0' },
  health: { icon: ICON.health, bg: '#e8f5ec' },
  career: { icon: '💼', bg: '#e9effb' },
  looks: { icon: '✨', bg: '#f3ecfb' },
  family: { icon: '🏠', bg: '#f7efdf' },
  mood: { icon: '😊', bg: '#e6f5f2' },
  affection: { icon: '💕', bg: '#fbe9ec' }
};

function drawAttrGrid(defs) {
  if (!defs || !defs.length) return;
  var colGap = 12, colW = (W - PAD * 2 - colGap) / 2;
  var rowY = C.y, rowH = 0, col = 0;
  for (var i = 0; i < defs.length; i++) {
    var hh = drawAttrCard(defs[i], PAD + col * (colW + colGap), rowY, colW);
    if (hh > rowH) rowH = hh;
    col++;
    if (col >= 2) { col = 0; rowY += rowH + 12; rowH = 0; }
  }
  C.y = rowY + rowH;
}

function drawAttrCard(d, x, y, w) {
  var meta = ATTR_META[d.key] || { icon: '•', bg: '#f3ece0' };
  var padX = 11, padY = 10;
  var h = padY * 2 + 20 + 7;
  R.fillRoundRect(ctx, x, y, w, h, 12, P.card);
  R.roundRectPath(ctx, x, y, w, h, 12); ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.stroke();

  /* 图标盒 */
  var ib = 20;
  R.fillRoundRect(ctx, x + padX, y + padY, ib, ib, 6, meta.bg);
  R.setEmojiFont(ctx, 12); ctx.fillStyle = P.text2;
  var iw = ctx.measureText(meta.icon).width;
  ctx.fillText(meta.icon, x + padX + ib / 2 - iw / 2, y + padY + ib / 2 + 4);

  /* 标签 + 数值 */
  R.setFont(ctx, 12); ctx.fillStyle = P.text2;
  ctx.fillText(d.label, x + padX + ib + 6, y + padY + 14);
  var v = Math.round(S[d.key] || 0);
  var tw = statFlashAnim(d.key);
  var shown = tw ? Math.round(tw.from + (v - tw.from) * tw.e) : v;
  var display = d.format === 'money' ? engine.moneyText(shown) : String(shown);
  R.setFont(ctx, 13, true);
  ctx.fillStyle = tw ? (tw.dir > 0 ? P.up : P.down) : d.color;
  var vt = display, vW = ctx.measureText(vt).width;
  ctx.fillText(vt, x + w - padX - vW, y + padY + 14);

  /* 进度条 */
  drawStatBar(d, x + padX, y + padY + 22, w - padX * 2, 6, false);

  /* 结算飘字（涨/跌） */
  var fp = statFlashProgress();
  if (fp >= 0 && statFlash.delta && statFlash.delta[d.key]) {
    var dv = Math.round(statFlash.delta[d.key]);
    if (dv !== 0) {
      var ftxt = (dv > 0 ? '+' : '-') +
        (d.key === 'money' && Math.abs(dv) >= 10000 ? engine.moneyText(Math.abs(dv)) : String(Math.abs(dv)));
      var rise = 14 * fp;
      var al = fp < 0.65 ? 1 : (1 - (fp - 0.65) / 0.35);
      ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, al));
      R.setFont(ctx, 13, true); ctx.fillStyle = dv > 0 ? P.up : P.down;
      var fW = ctx.measureText(ftxt).width;
      ctx.fillText(ftxt, x + w - padX - fW, y + padY + 14 - rise);
      ctx.restore();
    }
  }
  return h;
}

function clipText(text, maxW) {
  if (!text) return '';
  if (ctx.measureText(text).width <= maxW) return text;
  var t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

/* 主界面属性条用的定义：数据里标了 slot 的（如好感度）改在别处展示，不在这里重复 */
function playStatDefs() {
  var defs = tset('stat_defs') || [];
  warnStatDefsIfStale(defs);
  return defs.filter(function (d) { return !d.slot; });
}

/* 兜底告警：万一云端 texts 还是旧版（stat_defs 里没有 slot 字段），
 * 好感度会掉进主界面网格，属性区就变成「四行、最后一行只有一个」。
 * 这是数据没重导，不是代码问题 —— 报一次就够，别刷屏。 */
var warnedStatDefs = false;
function warnStatDefsIfStale(defs) {
  if (warnedStatDefs) return;
  if (defs.some(function (d) { return d && d.slot; })) return;
  warnedStatDefs = true;
  console.warn('[相亲模拟器] texts.stat_defs 里没有任何 slot 字段：好感度会挤进主界面属性区' +
    '（属性区就不是「三行 × 每行两条」了）。这通常说明云端 texts 集合还是旧数据 —— ' +
    '请用 Upsert/覆盖 重新导入 db/export/import/texts.json。');
}

/* 取「指定位置展示」的属性定义（如 slot=partnerHeader → 对象头像下方那条好感度） */
function statDefBySlot(slot) {
  var defs = tset('stat_defs') || [];
  for (var i = 0; i < defs.length; i++) { if (defs[i].slot === slot) return defs[i]; }
  return null;
}

/* 对象（含「已相到、还没见面」的人）头像下方的好感度条：标签在左、数值在右，条在下面。
 * 数值写成「当前 / 上限」：上限是动态的（单身期 100，告白成功后 500），
 * 直接标出来玩家才知道「这条还能往上长」。
 * 由 drawStatus 保证「聊天框里有人时才会被调用」。 */
function drawPartnerAffection(cx, y, w) {
  var d = statDefBySlot('partnerHeader');
  if (!d) return 0;
  var v = Math.round(S[d.key] || 0);
  var cap = engine.affectionCap(S);
  var tw = statFlashAnim(d.key);
  var shown = tw ? Math.round(tw.from + (v - tw.from) * tw.e) : v;
  var x = cx - w / 2;

  R.setFont(ctx, 10);
  ctx.fillStyle = P.text2;
  ctx.fillText(d.label, x, y + 10);

  R.setFont(ctx, 11, true);
  ctx.fillStyle = tw ? (tw.dir > 0 ? P.up : P.down) : d.color;
  var vt = String(shown) + '/' + cap;
  ctx.fillText(vt, x + w - ctx.measureText(vt).width, y + 10);

  drawStatBar(d, x, y + 14, w, 7, false);
  return 24;
}

/* 居中绘制文本 */
function centerText(text, cx, y, size, color, bold) {
  R.setFont(ctx, size, bold);
  ctx.fillStyle = color;
  ctx.fillText(text, cx - ctx.measureText(text).width / 2, y);
}

/* ---------------------------------------------------------
 * 倒计时卡片：相亲期限
 * 顶部显眼位置，含大号剩余天数 + 进度条 + 状态提示，
 * 临近期限时切换为警示配色。
 * ------------------------------------------------------- */
function drawDeadlineCard() {
  if (!S.goal || !S.goal.needRelation) return;

  var limit = S.singleLimit || 0;
  var streak = S.singleStreak || 0;
  var remain = Math.max(0, limit - streak);
  /* 走表 / 暂停的唯一判断在引擎里（engine.deadlineState），渲染层只负责展示：
   *   单身且没对象 → 走表；已有对象待初遇 / 初遇中 / 接触中 → 暂停；恋爱婚后 → 归零。 */
  var ds = engine.deadlineState(S);
  var single = ds.running;
  var paused = !ds.running;
  var urgent = single && remain <= 10;
  var warn = single && remain <= 20 && remain > 10;
  var hint = txt(DEADLINE_HINT_KEY[ds.state] || 'deadlinePaused');

  var w = W - PAD * 2;
  var h = 94;
  var x = PAD, y = C.y;
  var bg = paused ? '#eef6f1' : (urgent ? '#fdecea' : (warn ? '#fdf3e5' : P.card));
  var bd = paused ? P.up : (urgent ? P.down : (warn ? P.warn : P.line));
  var main = paused ? P.up : (urgent ? P.down : (warn ? P.warn : P.primary));

  R.fillRoundRect(ctx, x, y, w, h, 14, bg);
  R.roundRectPath(ctx, x, y, w, h, 14);
  ctx.strokeStyle = bd;
  ctx.lineWidth = urgent ? 2 : 1;
  ctx.stroke();

  /* 图标 + 标题 */
  var icon = paused ? '⏸' : (urgent ? '!' : '⏳');
  R.setFont(ctx, 15, true);
  ctx.fillStyle = main;
  ctx.fillText(icon, x + 14, y + 27);
  R.setFont(ctx, 13, true);
  ctx.fillStyle = main;
  ctx.fillText(ui('deadlineTitle', '相亲期限'), x + 34, y + 27);

  /* 右侧状态提示（暂停 / 仍单身） */
  R.setFont(ctx, 12);
  ctx.fillStyle = paused ? P.up : (urgent ? P.down : P.text2);
  var ht = hint || '';
  var htW = ctx.measureText(ht).width;
  var maxHtX = x + 34 + ctx.measureText(ui('deadlineTitle', '相亲期限')).width + 12;
  ctx.fillText(ht, Math.max(maxHtX, x + w - 14 - htW), y + 27);

  /* 大号剩余天数（与下方进度条留足间距） */
  var numTxt = String(remain);
  R.setFont(ctx, 30, true);
  ctx.fillStyle = main;
  ctx.fillText(numTxt, x + 14, y + 64);
  var numW = ctx.measureText(numTxt).width;
  R.setFont(ctx, 12);
  ctx.fillStyle = P.text2;
  ctx.fillText(' 天 / ' + limit + ' 天', x + 16 + numW, y + 64);

  /* 进度条（已消耗比例）：贴着卡片底部，上下各留 ≥10px */
  var barW = w - 28;
  var barY = y + h - 14;
  R.fillRoundRect(ctx, x + 14, barY, barW, 6, 3, '#e6ded1');
  var used = limit > 0 ? Math.min(1, streak / limit) : 0;
  if (used > 0) R.fillRoundRect(ctx, x + 14, barY, Math.max(used * barW, 4), 6, 3, main);

  C.y += h + 20;
}

/* ================= 行动菜单 ================= */

/* 「微信闲聊」入口。被「必须出门约会」锁住时仍然显示这个按钮，
 * 但副标题换成提醒，点进去只会看到一句「我们还是多当面接触吧」——
 * 让玩家清楚「为什么现在聊不了」，而不是按钮凭空消失。
 *
 * 只要微信里有人（对象 / 待见面的人）就一定给入口：
 * 题目池为空（chats 还是旧数据）时也不藏按钮，点进去给一句说明，
 * 免得玩家以为「这个功能没了」。 */
function chatEntryButton() {
  if (!S || !engine.canChat(S)) return;
  var who = S.partner || S.lead;
  if (!who) return;
  warnChatPoolIfStale(S);
  var T = tset('chat') || {};
  var locked = engine.chatLocked(S);
  var label = txt('chatTitle') || '微信闲聊';
  var sub;
  if (locked) {
    sub = T.lockedSub || '先当面见一面再聊';
  } else {
    sub = fmt(txt(S.partner ? 'chatSub' : 'chatSubLead'), { name: who.name });
    /* 规则要让人看得见：微信已经聊够次数时，入口上就把话说清楚 ——
     * 不然玩家只会觉得「聊了半天什么事都没发生」。见面前（lead）同样算账，
     * 聊够次数就该约出来见面，这条进度在 lead 阶段也要展示。 */
    var n = engine.chatCount(S);
    var thr = DB.num('CHAT_MUST_DATE_AFTER', 2);
    if (n >= thr && T.mustDateSoon) {
      sub += '\n' + fmt(T.mustDateSoon, { n: n, thr: thr });
    }
  }
  optionCard({ icon: '💬', title: label, sub: sub, selectable: true, onClick: function () { openChat(false); } });
}

/* 兜底告警：微信里有人，但 chats 里没有这个阶段可聊的题目。
 * 这是数据没重导，不是代码问题 —— 报一次就够，别刷屏。 */
var warnedChatPool = false;
function warnChatPoolIfStale(s) {
  if (warnedChatPool) return;
  if (!engine.canChat(s) || engine.chatLocked(s)) return;
  if (engine.chatAvailable(s)) return;
  warnedChatPool = true;
  console.warn('[相亲模拟器] 微信里有人（' + engine.chatStage(s) +
    ' 阶段），但 chats 里没有这个阶段可聊的题目 —— 入口会显示，点进去只有一句说明。' +
    '这通常是云端 chats 集合还是旧数据，请用 Upsert/覆盖 重新导入 db/export/import/chats.json。');
}

/* 行动菜单：只给两个方向（相亲向 / 自我提升向），做成单选卡，
 * 选中后由底部「确认」进入对应的二级页（带背景图）。 */
function drawActionMenu() {
  section(txt('actionTitle'), txt('actionNote'));
  optionCard({
    icon: '💝', title: txt('seekTitle'), sub: txt('seekSub'),
    badge: txt('mainLine') || '推进主线', badgeTone: 'gold',
    selected: pendingKey === 'choose:seek', selectable: true, key: 'choose:seek', onClick: gotoSeek
  });
  optionCard({
    icon: ICON.planOther, title: txt('otherTitle'), sub: txt('otherSub'),
    selected: pendingKey === 'choose:upgrade', selectable: true, key: 'choose:upgrade', onClick: gotoUpgrade
  });
  confirmAction(txt('confirm') || '确认', { disabledLabel: ui('confirmPick', '请先选择今日安排') });
}

/* 二级页 · 寻找相亲机会
 * 头部背景图取 seek_bg_<主角性别>（在 drawEventHeader 里画，不随滚动）。
 * 内容按关系阶段给：还没相到人 → 选渠道；相到了没见面 → 赴约 + 微信；
 * 接触 / 恋爱 / 婚后 → 约会 / 表白 / 求婚 / 分手。
 */
function drawSeekMenu() {
  C.y = SAFE_TOP + PAGE_HEAD_H + 24;
  var r = S.relationship;

  if (r === 'single' && !S.lead) {
    section(txt('seekMenuTitle'), null);
    var channels = DB.list('channels');
    channels.forEach(function (c) {
      var cost = Math.round(c.cost * S.diff.costMod);
      var pct = Math.round(c.chance * 100);
      optionCard({
        icon: '💘', title: c.name, sub: c.sub,
        chips: [
          { label: '花费', value: engine.moneyText(cost), tone: 'money' },
          { label: '成功率', value: pct + '%', tone: pct >= 50 ? 'hi' : (pct >= 30 ? 'mid' : 'lo') }
        ],
        selectable: true, key: 'seek:' + c.id,
        onClick: (function (id) { return function () { actSeek(id); }; })(c.id)
      });
    });
  } else if (r === 'single' && S.lead) {
    optionCard({ icon: ICON.meet, title: fmt(txt('meetTitle'), { name: S.lead.name }), sub: fmt(txt('meetSub'), { days: Math.round(3 * S.diff.timeMod) }), selectable: true, onClick: actMeet });
    /* 赴约之前也能在微信上先聊两句（chats 里带 lead 阶段的对话） */
    chatEntryButton();
  } else if (r === 'talking') {
    optionCard({ icon: ICON.date, title: fmt(txt('dateTitle'), { name: S.partner.name }), sub: txt('dateSub'), selectable: true, onClick: gotoDate });
    optionCard({ icon: '💗', title: fmt(txt('confessTitle'), { name: S.partner.name }), sub: fmt(txt('confessSub'), { pct: Math.round(engine.confessChance(S) * 100), days: engine.actionDays('confess', S) }), selectable: true, onClick: actConfess });
    chatEntryButton();
    optionCard({ icon: '💔', title: txt('breakupTitle'), sub: txt('breakupSub'), selectable: true, onClick: actBreakup });
  } else if (r === 'dating') {
    optionCard({ icon: ICON.date, title: fmt(txt('dateTitle'), { name: S.partner.name }), sub: txt('dateSub'), selectable: true, onClick: gotoDate });
    /* 求婚看的是「恋爱后的感情刻度」：还没养够就明说还差多少，别让人蒙头送人头 */
    var pMin = engine.proposeAffectionMin(S);
    var pNeed = Math.max(0, pMin - Math.round(S.affection || 0));
    var pSub = pNeed > 0
      ? fmt(txt('proposeSubWait'), { need: pNeed, cur: Math.round(S.affection || 0), cap: engine.affectionCap(S) })
      : fmt(txt('proposeSub'), { pct: Math.round(engine.proposeChance(S) * 100), cost: engine.moneyText(DB.num('PROPOSE_COST', 60000)), days: engine.actionDays('propose', S) });
    optionCard({ icon: '💍', title: fmt(txt('proposeTitle'), { name: S.partner.name }), sub: pSub, selectable: true, onClick: actPropose });
    chatEntryButton();
    optionCard({ icon: '💔', title: txt('breakupTitle2'), sub: txt('breakupSub'), selectable: true, onClick: actBreakup });
  } else if (r === 'married') {
    optionCard({ icon: ICON.date, title: fmt(txt('dateTitleMarried'), { name: S.partner.name }), sub: txt('dateSub'), selectable: true, onClick: gotoDate });
    chatEntryButton();
    if (!S.flags.child) {
      var can = S.affection >= DB.num('CHILD_AFFECTION_MIN', 70);
      var sub = can ? fmt(txt('childSubOk'), { cost: '3 万', days: engine.actionDays('child', S), goal: engine.goalName(S) }) : fmt(txt('childSubNo'), { min: DB.num('CHILD_AFFECTION_MIN', 70) });
      optionCard({ icon: '👶', title: txt('childTitle'), sub: sub, selectable: can, disabled: !can, onClick: actChild });
    } else {
      R.setFont(ctx, 13);
      ctx.fillStyle = P.text3;
      ctx.fillText(txt('childDone'), PAD, C.y + 12);
      C.y += 28;
    }
  }

  bottomAction(txt('back') || '返回', backToChoose);
  confirmAction(txt('confirm') || '确认');
}

/* 二级页 · 其余安排
 * 头部背景图取 upgrade_bg_<主角性别>；内容是过日子 / 提升自己 / 加班挣钱 / 休息。 */
function drawUpgradeMenu() {
  C.y = SAFE_TOP + PAGE_HEAD_H + 24;
  optionCard({ icon: '🏠', title: txt('lifeTitle'), sub: txt('lifeSub'), selectable: true, onClick: actLife });
  optionCard({ icon: '📚', title: txt('improveTitle'), sub: txt('improveSub'), selectable: true, onClick: actImprove });
  optionCard({ icon: '💼', title: txt('overtimeTitle'), sub: txt('overtimeSub'), selectable: true, onClick: actOvertime });
  optionCard({ icon: ICON.rest, title: txt('restTitle'), sub: txt('restSub') + (S.jobType === 'worker' ? txt('restWorker') : ''), selectable: true, onClick: actRest });
  bottomAction(txt('back') || '返回', backToChoose);
  confirmAction(txt('confirm') || '确认');
}

/* 二级页 · 约会档位
 * 头部沿用「寻找相亲机会」那套背景图（seek_bg_<性别>），
 * 于是从「相亲机会」点进来到这一页，背景是连着的、不闪白。 */
function drawDateMenu() {
  C.y = SAFE_TOP + PAGE_HEAD_H + 24;
  var dts = DB.list('date_types');
  var DATE_EMOJI = { simple: ICON.dateSimple, standard: ICON.date, activity: ICON.dateActivity };
  dts.forEach(function (t) {
    var cost = Math.round(t.cost * S.diff.costMod);
    var dis = S.money < cost;
    var sub = fmt(txt('dateMeta'), { cost: engine.moneyText(cost), label: engine.dateSpendLabel(t, S.gender), mult: t.affMult });
    if (S.jobType === 'worker' && !engine.isWeekend(S.day)) {
      sub += fmt(txt('dateWarn'), { day: engine.weekdayName(S.day + engine.daysToWeekend(S.day)) });
    }
    optionCard({
      icon: DATE_EMOJI[t.id] || '💞', title: t.name, sub: sub,
      disabled: dis, selectable: !dis,
      onClick: (function (id) { return function () { gotoStyle('date', id); }; })(t.id)
    });
  });
  bottomAction(txt('back') || '返回', backToChoose);
  confirmAction(txt('confirm') || '确认');
}

/* =========================================================
 * 叠层 · 交往风格
 * ---------------------------------------------------------
 * 选完约会档位（或点「赴约初遇」）之后，交往风格不另开一页 ——
 * 另开一页会把刚看的背景整块丢掉。这里做成半透明叠层浮在当前页上：
 *   · 底下这一页（含背景图）压暗但依然可辨 —— 这就是「保留背景」；
 *   · 风格列表在叠层里可以面板内滚动，条目多也不会把面板撑爆；
 *   · 交互沿用两步：点一次选中、再点一次取消、点叠层里的「确认」才提交；
 *   · 选完（或返回）叠层收起，事件页照常走，结算后回主界面。
 * ========================================================= */
var styleScroll = 0;        // 叠层列表的面板内滚动（<=0）
var styleMaxScroll = 0;
var stylePanel = null;      // 本帧面板几何（触摸用）
var touchInPanel = false;

/* 关键事件浮窗（告白成功/失败、被分手、求婚成功/失败）：
 * 以二级浮窗弹出，带入场强调动画，顶部预留背景图位置。 */
var keyModal = null;        // { title, lines, delta, kind, scene, t0 }
var keyAnimTimer = null;
var keyModalResume = null;   // 浮窗关闭后要继续做的事（如建新的一天）

/* 寻找相亲「没找到合适的」：同样用二级浮窗（背景图 + 结果，背景图预留位置），
 * 和关键事件浮窗同一套视觉，关闭后推进一天回到主界面。 */
var seekFailModal = null;    // { title, lines, delta, scene, bgImg, t0 }
var seekFailAnimTimer = null;

function seekFailModalOpen() { return !!seekFailModal; }
function openSeekFailModal(r) {
  if (!r) return;
  seekFailModal = {
    title: r.title || '',
    lines: r.lines || [],
    delta: r.delta || {},
    scene: null,
    bgImg: art.seekFailBg(),
    t0: Date.now()
  };
  scheduleSeekFailAnim();
}
function closeSeekFailModal() {
  if (!seekFailModal) return;
  seekFailModal = null;
  if (seekFailAnimTimer) { clearTimeout(seekFailAnimTimer); seekFailAnimTimer = null; }
  continueDay();
}
function scheduleSeekFailAnim() {
  if (seekFailAnimTimer) return;
  seekFailAnimTimer = setTimeout(function () {
    seekFailAnimTimer = null;
    if (seekFailModal) { draw(); if (seekFailModal) scheduleSeekFailAnim(); }
  }, 16);
}

function styleOverlayOpen() { return !!(today && today.stylePayload); }

function drawPanelButton(x, y, w, h, label, primary, onClick, disabled) {
  var bg = disabled ? P.disabled : (primary ? P.primary : P.card);
  var fg = disabled ? '#f1ece3' : (primary ? '#ffffff' : P.text2);
  var bd = disabled ? P.disabled : (primary ? P.primary : P.line);
  R.fillRoundRect(ctx, x, y, w, h, 14, bg);
  R.roundRectPath(ctx, x, y, w, h, 14);
  ctx.strokeStyle = bd;
  ctx.lineWidth = 1;
  ctx.stroke();
  R.setFont(ctx, 15, true);
  ctx.fillStyle = fg;
  ctx.fillText(label, x + (w - ctx.measureText(label).width) / 2, y + h / 2 + 5);
  if (!disabled) fixedButtons.push({ x: x, y: y, w: w, h: h, label: label, onClick: onClick });
}

function drawStyleOverlay() {
  if (scene !== 'play' || !styleOverlayOpen()) { stylePanel = null; return; }
  var styles = DB.list('court_styles');
  var w = W - PAD * 2;
  var padIn = 16;
  var innerW = w - padIn * 2 - 12 - 24;   // 预留右上角「选中 ✓」角标的位置

  /* 逐条量高：与下面绘制用同一套测量，量多少就画多少 */
  var rows = [];
  styles.forEach(function (st) {
    var more = st.seeMore ? txt('styleSeeMore') : '';
    R.setFont(ctx, 15, true);
    var nameLines = R.wrapText(ctx, st.name, innerW);
    var sub = st.desc + '\n' +
      fmt(txt('styleMeta'), { aff: st.affMod, risk: Math.round(st.risk * 100), more: more }) +
      (st.suits ? '\n' + st.suits : '');
    R.setFont(ctx, 12);
    var subLines = R.wrapText(ctx, sub, innerW);
    var h = 14 + nameLines.length * 22 + 2 + subLines.length * 18 + 14;
    rows.push({ st: st, nameLines: nameLines, subLines: subLines, h: h });
  });

  var headH = 60, footH = 66, gap = 8;
  var listH = 0;
  rows.forEach(function (r) { listH += r.h + gap; });
  /* 面板上下各留一条「看得见背景」的缝：叠层是浮上去的，不是把整页盖死 */
  var maxPanel = H - SAFE_TOP - SAFE_BOTTOM - 72;
  var panelH = Math.min(maxPanel, headH + listH + footH);
  var py = Math.round((H - panelH) / 2);
  var viewTop = py + headH;
  var viewH = Math.max(0, panelH - headH - footH);

  /* 遮罩：压暗但不盖死 —— 底下的背景图（含页头那张）仍然可辨 */
  ctx.fillStyle = 'rgba(28,22,18,0.30)';
  ctx.fillRect(0, 0, W, H);

  /* 面板本身也是半透明的：底色透出来一点，读起来仍是浅底深字 */
  R.fillRoundRect(ctx, PAD, py, w, panelH, 18, 'rgba(255,255,255,0.93)');
  R.roundRectPath(ctx, PAD, py, w, panelH, 18);
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  ctx.stroke();

  R.setFont(ctx, 17, true);
  ctx.fillStyle = P.text1;
  ctx.fillText(txt('styleTitle'), PAD + padIn, py + 28);
  R.setFont(ctx, 12);
  ctx.fillStyle = P.text3;
  var hint = txt('styleOverlayHint');
  if (hint) ctx.fillText(hint, PAD + padIn, py + 48);

  /* 面板内滚动 */
  styleMaxScroll = Math.max(0, listH - viewH);
  styleScroll = Math.max(-styleMaxScroll, Math.min(0, styleScroll));

  var rowW = w - (padIn - 6) * 2;
  var rowX = PAD + padIn - 6;

  ctx.save();
  ctx.beginPath();
  ctx.rect(PAD, viewTop, w, viewH);
  ctx.clip();

  var y = viewTop + styleScroll;
  rows.forEach(function (r) {
    var sel = pendingKey === ('style:' + r.st.id);
    var visible = (y + r.h > viewTop) && (y < viewTop + viewH);
    if (visible) {
      /* 卡片式行：白底 + 描边；选中 → 主色描边 + 右上 ✓ 角标（与其它选项卡片一致） */
      R.fillRoundRect(ctx, rowX, y, rowW, r.h, 12, sel ? '#fffdfb' : P.card);
      R.roundRectPath(ctx, rowX, y, rowW, r.h, 12);
      ctx.strokeStyle = sel ? P.primary : P.line;
      ctx.lineWidth = sel ? 2 : 1;
      ctx.stroke();
      if (sel) {
        var rrx = rowX + rowW - 12, rry = y + 12, rr = 11;
        R.fillRoundRect(ctx, rrx - rr, rry - rr, rr * 2, rr * 2, rr, P.primary);
        R.setFont(ctx, 12, true); ctx.fillStyle = '#ffffff';
        ctx.fillText('✓', rrx - 4, rry + 5);
      }
      var ty = y + 14;
      R.setFont(ctx, 15, true);
      ctx.fillStyle = sel ? P.primaryDark : P.text1;
      r.nameLines.forEach(function (l) { ctx.fillText(l, PAD + padIn, ty + 15); ty += 22; });
      ty += 2;
      R.setFont(ctx, 12);
      ctx.fillStyle = sel ? '#a8564a' : P.text2;
      r.subLines.forEach(function (l) { ctx.fillText(l, PAD + padIn, ty + 12); ty += 18; });
      fixedButtons.push({
        x: rowX, y: y, w: rowW, h: r.h, label: 'style:' + r.st.id,
        onClick: (function (sid) {
          return function () { selectOnly('style:' + sid, function () { pickStyle(sid); }); };
        })(r.st.id)
      });
    }
    y += r.h + gap;
  });
  ctx.restore();

  /* 叠层内底部：返回 / 确认 */
  var footY = py + panelH - footH + 12;
  var bw = (w - padIn * 2 - 10) / 2;
  drawPanelButton(PAD + padIn, footY, bw, 44, txt('back') || '返回', false, closeStyleOverlay);
  drawPanelButton(PAD + padIn + bw + 10, footY, bw, 44, txt('confirm') || '确认', true, runPending, !pendingAction);

  stylePanel = { x: PAD, y: py, w: w, h: panelH, viewTop: viewTop, viewH: viewH };
}

/* =========================================================
 * 关键事件浮窗（二级浮窗）
 * ---------------------------------------------------------
 * 告白 / 求婚 / 分手这类「大事」不再只走普通结算页，而是叠一层
 * 带强调动画的浮窗：遮罩压暗但不盖死底层、面板从 0.8 弹到 1.0 并淡入、
 * 一道光带扫过、顶部预留背景图位置；唯一可点是底部「继续」。
 * 由 KEY_RESULT_ACTIONS（默认 confess,propose,breakup）决定哪些行动触发，
 * 对方主动提分手（checkPartnerLeave）也走同一浮窗。
 * ========================================================= */
function keyResultActions() {
  var raw = DB.num('KEY_RESULT_ACTIONS', 'confess,propose,breakup');
  if (Array.isArray(raw)) return raw;
  return String(raw || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
}

function keyModalOpen() { return !!keyModal; }

/* 用结算正文给浮窗找一张背景图（与事件页同一套关键词匹配） */
function keySceneName(r) {
  var lines = (r && r.lines || []).filter(function (l) { return l !== ''; });
  var extra = (r && r.title || '') + ' ' + lines.join(' ');
  return art.sceneNameForEvent({ id: '', text: lines, options: [] }, null, null, extra) || null;
}

function openKeyModal(r, kind) {
  if (!r) return;
  keyModal = {
    title: r.title || '',
    lines: r.lines || [],
    delta: r.delta || {},
    kind: kind,
    scene: keySceneName(r),
    t0: Date.now()
  };
  scheduleKeyAnim();
}

function closeKeyModal() {
  if (!keyModal) return;
  keyModal = null;
  if (keyAnimTimer) { clearTimeout(keyAnimTimer); keyAnimTimer = null; }
  /* 浮窗关闭后：优先执行挂起的续做（如「建新的一天」），
   * 否则按默认回到主界面并推进一天。 */
  if (keyModalResume) {
    var f = keyModalResume;
    keyModalResume = null;
    f();
  } else {
    continueDay();
  }
}

function scheduleKeyAnim() {
  if (keyAnimTimer) return;
  keyAnimTimer = setTimeout(function () {
    keyAnimTimer = null;
    if (keyModal) { draw(); if (keyModal) scheduleKeyAnim(); }
  }, 16);
}

function hasDelta(d) {
  if (!d) return false;
  return ['money', 'affection', 'health', 'career', 'looks', 'family', 'mood']
    .some(function (k) { return d[k]; });
}

/* 关键事件 / 寻找落空 共用的一套浮窗绘制：
 * 顶部预留背景图位置 + 入场缩放淡入 + 标题/正文/属性变化 + 光带强调 + 「继续」。
 * 两种浮窗只是数据源（m）与关闭回调（onClose / scheduleAnim）不同。 */
function drawResultModalBody(m, onClose, scheduleAnim) {
  if (!m) return;
  var now = Date.now();
  var DUR = 360;
  var p = engine.clamp((now - m.t0) / DUR, 0, 1);
  var e = easeOutCubic(p);
  var scale = 0.8 + 0.2 * e;            // 入场放大（带一点弹）
  var alpha = Math.min(1, p * 1.5);

  var w = W - PAD * 2;
  var padIn = 16;
  var innerW = w - padIn * 2;
  var bgH = 96;                         // 顶部预留背景图位置

  /* 量高（与绘制用同一套测量） */
  R.setFont(ctx, 18, true);
  var titleLines = m.title ? R.wrapText(ctx, m.title, innerW) : [];
  R.setFont(ctx, 14, false);
  var lineRows = [];
  (m.lines || []).forEach(function (l) {
    if (l === '') { lineRows.push({ empty: true }); return; }
    R.wrapText(ctx, engine.fillText(l, S), innerW).forEach(function (t) { lineRows.push({ t: t }); });
  });
  var headTop = 56;
  var titleH = titleLines.length ? titleLines.length * 26 + 8 : 0;
  var linesH = lineRows.reduce(function (a, r) { return a + (r.empty ? 10 : 20); }, 0);
  var deltaH = hasDelta(m.delta) ? (deltaCardsH(m.delta) + 6) : 0;
  var footH = 60;
  var panelH = bgH + headTop + titleH + linesH + deltaH + footH;
  var maxPanel = H - SAFE_TOP - SAFE_BOTTOM - 36;
  panelH = Math.min(panelH, maxPanel);
  var py = Math.round((H - panelH) / 2);

  ctx.save();
  /* 遮罩：压暗但不盖死底层背景 */
  ctx.fillStyle = 'rgba(18,14,10,' + (0.46 * alpha) + ')';
  ctx.fillRect(0, 0, W, H);

  /* 入场：绕面板中心缩放 + 整体淡入 */
  ctx.translate(W / 2, py + panelH / 2);
  ctx.scale(scale, scale);
  ctx.translate(-W / 2, -(py + panelH / 2));
  ctx.globalAlpha = alpha;

  /* 面板 */
  R.fillRoundRect(ctx, PAD, py, w, panelH, 18, 'rgba(255,255,255,0.98)');
  R.roundRectPath(ctx, PAD, py, w, panelH, 18);
  ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.stroke();

  /* 顶部预留背景图位置 */
  ctx.save();
  R.roundRectPath(ctx, PAD, py, w, bgH, 18);
  ctx.clip();
  var img = m.bgImg || (m.scene ? art.sceneImg(m.scene) : null);
  if (img) {
    drawCoverImage(img, PAD, py, w, bgH);
    if (ctx.createLinearGradient) {
      var g = ctx.createLinearGradient(0, py, 0, py + bgH);
      g.addColorStop(0, 'rgba(28,22,18,0.12)');
      g.addColorStop(1, 'rgba(246,241,234,0)');
      ctx.fillStyle = g; ctx.fillRect(PAD, py, w, bgH);
    }
  } else if (ctx.createLinearGradient) {
    var g2 = ctx.createLinearGradient(0, py, 0, py + bgH);
    g2.addColorStop(0, P.bg); g2.addColorStop(1, 'rgba(246,241,234,0.25)');
    ctx.fillStyle = g2; ctx.fillRect(PAD, py, w, bgH);
  }
  ctx.restore();

  /* 标题区（图标 + 标题） */
  var ty = py + bgH + 18;
  var bad = m.title && /没|失败|落空|拒绝|结束|没答应|没有|告吹|分手/.test(m.title);
  var ic = bad ? P.down : P.up;
  R.setFont(ctx, 24, true);
  ctx.fillStyle = ic;
  ctx.fillText(bad ? '!' : '✓', PAD + padIn, ty + 18);
  if (m.title) {
    R.setFont(ctx, 18, true);
    ctx.fillStyle = P.text1;
    var tx = PAD + padIn + 30;
    titleLines.forEach(function (l, i) { ctx.fillText(l, tx, ty + 6 + i * 26); });
    ty += titleLines.length * 26 + 8;
  } else { ty += 4; }

  /* 正文 */
  R.setFont(ctx, 14, false);
  ctx.fillStyle = P.text1;
  lineRows.forEach(function (r) {
    if (r.empty) { ty += 10; return; }
    ctx.fillText(r.t, PAD + padIn, ty + 14);
    ty += 20;
  });

  /* 属性变化（浮窗自带入场动效，卡片只跟随，不再叠一层） */
  if (deltaH) {
    ty += 6;
    C.y = ty;
    drawDeltaTags(m.delta, PAD + padIn, { noAnim: true });
    ty = C.y;
  }

  /* 光带扫过：入场强调（手绘平行四边形，避免依赖 ctx.transform） */
  if (p < 0.78) {
    var sweep = p / 0.78;
    var bandW = w * 0.42;
    var shear = panelH * 0.35;
    var sx = PAD - bandW + sweep * (w * 1.6);
    ctx.save();
    ctx.globalAlpha = alpha * 0.55 * (1 - sweep);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.moveTo(sx, py);
    ctx.lineTo(sx + bandW, py);
    ctx.lineTo(sx + bandW - shear, py + panelH);
    ctx.lineTo(sx - shear, py + panelH);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* 继续按钮（浮窗内唯一可点） */
  var btnY = py + panelH - footH + 12;
  var bw = w - padIn * 2;
  var label = txt('continueDay') ? fmt(txt('continueDay'), { n: (today && today.costDays) || 1 }) : '继续';
  drawPanelButton(PAD + padIn, btnY, bw, 44, label, true, onClose);

  ctx.restore();
  if (p < 1) scheduleAnim();
}

function drawKeyModal() { drawResultModalBody(keyModal, closeKeyModal, scheduleKeyAnim); }
function drawSeekFailModal() { drawResultModalBody(seekFailModal, closeSeekFailModal, scheduleSeekFailAnim); }

/* =========================================================
 * 事件二级页面
 * ---------------------------------------------------------
 * 选中事件后进入独立页面：不展示属性与目标，只保留
 * 场景背景 + 双方头像 + 事件正文 + 选项，界面更聚焦。
 * 场景图与事件一一对应；匹配不到就不展示背景（兜底）。
 * ========================================================= */
function eventSceneName() {
  if (!today) return null;
  /* 初遇的见面地点写在旁白里（introLines），一并参与关键词匹配 */
  var extra = today.introLines ? today.introLines.join(' ') : '';
  return art.sceneNameForEvent(today.event, today.dateType, today.action, extra);
}

function eventHeadH() {
  /* 有场景背景时头部更高（背景 + 头像 + 名字）；没有背景时也要够高，
   * 否则「我 / 对方」两行名字会和下面正文贴在一起。
   * 用户要求：相亲事件 / 随机事件页的背景图更高，这里整体放大头部。 */
  return eventSceneName() ? 244 : 140;
}

function drawEventPage() {
  if (scene !== 'play' || !today || today.phase !== 'event' || !today.event) return;

  var ev = today.event;

  /* 内容从固定头部下方开始（头部在 drawEventHeader 里画，不随滚动） */
  C.y = SAFE_TOP + eventHeadH() + 14;

  /* ---- 正文：一张旁白卡（相亲事件 / 随机事件同一套画法） ---- */
  var paras = [];
  if (today.introLines) paras = paras.concat(today.introLines);
  paras = paras.concat(ev.text);

  /* 退场中旁白卡保持不动，只有选项卡片往下沉 —— 「选择题被收走」的观感更清楚 */
  var exiting = cardExiting();
  noteCard(paras, { anim: exiting ? null : cardAnim(0), gap: 14 });

  /* ---- 已确认：结果直接展示在原「选项区域」，头部头像与背景保持不变 ---- */
  if (today.resolved) {
    drawEventResultInline();
    return;
  }

  /* ---- 选项：单选，由底部「确认」按钮提交；逐张错落入场 ---- */
  ev.options.forEach(function (opt, oi) {
    optionCard({
      title: opt.label, compact: true,
      anim: cardAnim(oi + 1),
      selected: pendingKey === ('opt:' + ev.id + ':' + oi),
      selectable: true, key: 'opt:' + ev.id + ':' + oi,
      /* 先播选项卡片退场，再落实结果 —— 新旧卡片交接看得见 */
      onClick: (function (i) {
        return function () { cardExitThen(function () { chooseOption(i); }); };
      })(oi)
    });
  });
  confirmAction(ui('confirm', '确认'));
}

/* 事件确认后的结果块：接在正文之后、原来选项的位置上。
 * 不跳页，因此场景背景与双方头像都留着，玩家不会「丢掉上下文」。
 * 展示顺序：你的选择（选项原文）→ 结果正文 → 属性增减 → （偶遇卡片）。
 * 除旁白卡外全部是卡片，并带错落入场动效。 */
function drawEventResultInline() {
  var r = today.result || {};
  var pickT = ui('resolvedPickTitle', '你的选择');
  var resT = ui('resolvedResultTitle', '结果');
  var idx = 0;      // 结果区卡片的错落序号（接在旁白卡之后）

  /* 你的选择：小标题 + 选中态卡片复述刚点的选项 */
  if (today.chosenLabel) {
    R.setFont(ctx, 11, true);
    ctx.fillStyle = P.text3;
    ctx.fillText(pickT, PAD, C.y + 12);
    C.y += 18;

    R.setFont(ctx, 15, true);
    var plines = R.wrapText(ctx, today.chosenLabel, W - PAD * 2 - 28);
    var ph = plines.length * 24 + 20;
    var anim0 = cardAnim(++idx);
    var layY0 = C.y;
    var topY0 = layY0 + (anim0.dy || 0);
    if (anim0.a < 1) { ctx.save(); ctx.globalAlpha = Math.max(0, anim0.a); }
    R.fillRoundRect(ctx, PAD, topY0, W - PAD * 2, ph, 14, '#fbeae5');
    R.roundRectPath(ctx, PAD, topY0, W - PAD * 2, ph, 14);
    ctx.strokeStyle = P.primary;
    ctx.lineWidth = 2;
    ctx.stroke();
    R.setFont(ctx, 15, true);
    ctx.fillStyle = P.primaryDark;
    var py = topY0 + 10;
    for (var i = 0; i < plines.length; i++) {
      ctx.fillText(plines[i], PAD + 14, py + 16);
      py += 24;
    }
    if (anim0.a < 1) ctx.restore();
    C.y = layY0 + ph + 16;
  }

  /* 结果：小标题 + 结果正文卡 */
  R.setFont(ctx, 11, true);
  ctx.fillStyle = P.text3;
  ctx.fillText(resT, PAD, C.y + 12);
  C.y += 18;

  noteCard(r.lines || [], { anim: cardAnim(++idx), gap: 14 });

  drawDeltaTags(r.delta, PAD, { animBase: idx });

  /* 偶遇：本次安排顺带认识的人 */
  if (r.encounter) drawEncounterCard(r.encounter);

  /* 继续：先让卡片退场，再回主界面 / 推进一天 */
  bottomAction(fmt(txt('continueDay'), { n: today.costDays }),
    function () { cardExitThen(continueDay); }, { primary: true });
}

/* 事件页固定头部：场景背景 + 主角/对象头像（屏幕坐标，不随内容滚动） */
function drawEventHeader() {
  /* 微信闲聊页有自己固定的顶栏（不随内容滚动） */
  if (scene === 'chat') { drawChatBar(); return; }
  /* 结局页：一张结局插画压在顶部 */
  if (scene === 'end') { drawEndHeader(); return; }
  /* 结算页里「有对象在场」的行动（告白 / 求婚）也走同一套头部 */
  if (resultHeadOn()) { drawResultHeader(); return; }
  if (scene !== 'play' || !today) return;
  /* 行动二级页（寻找相亲机会 / 其余安排）：头部背景图 + 页标题 */
  if (today.phase === 'seek') {
    drawPageHeader(PAGE_HEAD_H, art.pageBg('seek_bg', S.gender), seekPageTitle(), seekPageSub());
    return;
  }
  if (today.phase === 'upgrade') {
    drawPageHeader(PAGE_HEAD_H, art.pageBg('upgrade_bg', S.gender), txt('upgradePageTitle'), txt('upgradePageSub'));
    return;
  }
  /* 约会档位页沿用「寻找相亲机会」的背景，从上一页点进来时背景是连着的 */
  if (today.phase === 'date') {
    drawPageHeader(PAGE_HEAD_H, art.pageBg('seek_bg', S.gender),
      fmt(txt('datePageTitle'), { name: S.partner ? S.partner.name : '' }), txt('datePageSub'));
    return;
  }
  if (today.phase !== 'event' || !today.event) return;
  drawPairHeader(eventHeadH(), eventSceneName(), eventInvolvesPartner());
}

/* 本次事件是否「与相亲对象有关」——决定事件页头部画不画对方头像。
 * 判据（任一成立即算有关）：
 *   · 事件正文 / 选项里出现 {p}（作者用占位符点名了对方）；
 *   · 事件自带 dateType / stage（约会档位、恋爱阶段专属事件）；
 *   · 本次安排本身就是见面（action=meet），或事件阶段是相亲现场 / 约会（meeting / date）。
 * 无关的随机事件（加班、体检、朋友借钱、外卖超时…）只展示主角头像 ——
 * 玩家在相亲对象面前没发生过的事，别硬塞一张对方的脸进来。 */
function eventInvolvesPartner() {
  if (!today || !today.event) return false;
  if (today.dateType || today.action === 'meet') return true;
  var ev = today.event;
  if (ev.dateType || ev.stage) return true;
  if (ev.phase === 'meeting' || ev.phase === 'date') return true;
  var hay = (ev.text || []).join(' ') + ' ' +
    (ev.options || []).map(function (o) { return (o.label || '') + ' ' + (o.result || ''); }).join(' ');
  return hay.indexOf('{p}') >= 0;
}

/* 二级页头部：一张背景图铺满 + 顶部压暗、底部渐隐到页面底色。
 * 「寻找相亲机会」「其余安排」「结局」三处共用，样式不会走偏。
 * 图还没下载好就画纯色兜底（不占位、不留白），图到了 art.js 会自动重绘。 */
var PAGE_HEAD_H = 200;   // 行动二级页头部高度（增高头部背景图 + 拉开与下方内容的间距）
var END_HEAD_H = 172;    // 结局页头部高度

function drawPageHeader(hh, bgImg, title, sub) {
  ctx.save();
  R.roundRectPath(ctx, 0, 0, W, hh);
  ctx.clip();

  if (bgImg) {
    drawCoverImage(bgImg, 0, 0, W, hh);
    if (ctx.createLinearGradient) {
      var g = ctx.createLinearGradient(0, 0, 0, hh);
      g.addColorStop(0, 'rgba(20,16,12,0.52)');
      g.addColorStop(0.55, 'rgba(20,16,12,0.22)');
      g.addColorStop(1, 'rgba(246,241,234,1)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, hh);
    }
  } else {
    ctx.fillStyle = P.bg;
    ctx.fillRect(0, 0, W, hh);
  }
  ctx.restore();

  /* 标题压在背景的深色区：先画一层偏移的暗字，再叠白字。
   * 不用 shadowColor —— 某些环境的 Canvas 实现不支持，画两遍最稳。 */
  var ty = SAFE_TOP + Math.round(hh * 0.40);
  if (title) {
    R.setFont(ctx, 20, true);
    if (bgImg) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillText(title, PAD + 1, ty + 1); }
    ctx.fillStyle = bgImg ? '#ffffff' : P.text1;
    ctx.fillText(title, PAD, ty);
  }
  if (sub) {
    R.setFont(ctx, 12);
    if (bgImg) { ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.fillText(sub, PAD + 1, ty + 23); }
    ctx.fillStyle = bgImg ? 'rgba(255,255,255,0.92)' : P.text2;
    ctx.fillText(sub, PAD, ty + 22);
  }
}

/* 行动二级页「寻找相亲机会」的标题：还没对象时是「找机会」，
 * 已经有对象时改成「和 TA 的事」—— 这一页放着约会 / 表白 / 求婚 / 分手。 */
function seekPageTitle() {
  if (S.partner) return fmt(txt('seekPageTitlePartner'), { name: S.partner.name });
  return txt('seekPageTitle');
}
function seekPageSub() {
  return S.partner ? txt('seekPageSubPartner') : txt('seekPageSub');
}

/* 当前结局记录（还没结算时按「时间到了」兜底，绝不返回 undefined） */
function currentEnding() {
  if (S.ending) return S.ending;
  var t = DB.list('endings').filter(function (x) { return x.id === 'timeout'; })[0];
  return t || {};
}

function drawEndHeader() {
  var e = currentEnding();
  var E = tset('end') || {};
  warnEndingArtIfStale(e);
  drawPageHeader(END_HEAD_H, art.endBg(e.art, S.gender), E.headTag || '', '');
}

/* 兜底告警：结局记录里没有 art 字段 → 结局页头部配不到图（只会是一块纯色）。
 * 这是数据没重导，不是代码问题 —— 报一次就够。 */
var warnedEndingArt = false;
function warnEndingArtIfStale(e) {
  if (warnedEndingArt) return;
  if (!e || !e.id || e.art) return;
  warnedEndingArt = true;
  console.warn('[相亲模拟器] endings 里没有 art 字段（结局 ' + e.id +
    '），结局页头部配不到背景图。这通常是云端 endings 集合还是旧数据 —— ' +
    '请用 Upsert/覆盖 重新导入 db/export/import/endings.json。');
}

/* 双人头部：场景背景 + 「我 / 对方」两张头像 + 场景标签。
 * 事件页与结算页（告白 / 求婚）共用，避免两处样式走偏。
 * dual === false 时只画主角一张（居中对齐）—— 用于跟相亲对象无关的随机事件。 */
function drawPairHeader(hh, scn, dual) {
  var showOther = (dual !== false);
  var bg = scn ? art.sceneImg(scn) : null;

  ctx.save();
  R.roundRectPath(ctx, 0, 0, W, hh);
  ctx.clip();

  if (bg) {
    drawCoverImage(bg, 0, 0, W, hh);
    /* 顶部压暗 + 底部渐隐到页面底色，保证头像和文字可读 */
    if (ctx.createLinearGradient) {
      var g = ctx.createLinearGradient(0, 0, 0, hh);
      g.addColorStop(0, 'rgba(28,22,18,0.28)');
      g.addColorStop(0.55, 'rgba(28,22,18,0.05)');
      g.addColorStop(1, 'rgba(246,241,234,1)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, hh);
    }
  } else {
    /* 没有对应场景 → 兜底不展示背景，只留纯色头部 */
    ctx.fillStyle = P.bg;
    ctx.fillRect(0, 0, W, hh);
  }
  ctx.restore();

  /* 双方头像：主角在左，对象/意向人在右。
   * 头部放大后头像整体下移一点，落在背景图偏下、渐隐到页面底色之前的位置，
   * 既不被顶部压暗吞掉，也不会贴着正文。
   * 单人（无关事件）时主角居中，不留下半张空位。 */
  var avSize = 64;
  var ay = SAFE_TOP + (bg ? 86 : 64) + avSize / 2;
  var leftCx = showOther ? W * 0.28 : W * 0.5;
  var rightCx = W * 0.72;

  drawRoleAvatar(art.heroImg(S.bg.id, S.gender), leftCx, ay, avSize, '我');
  centerText(txt('you') || '我', leftCx, ay + avSize / 2 + 16, 12,
    bg ? 'rgba(255,255,255,0.92)' : P.text2, false);

  if (showOther) {
    var other = S.partner || S.lead;
    if (other) {
      drawRoleAvatar(art.partnerImg(other.job, other.gender, other.avatar), rightCx, ay, avSize, 'TA');
      centerText(other.name, rightCx, ay + avSize / 2 + 16, 12,
        bg ? 'rgba(255,255,255,0.92)' : P.text2, false);
    } else {
      drawRoleAvatar(null, rightCx, ay, avSize, '?');
      centerText(txt('noPartner') || '暂无对象', rightCx, ay + avSize / 2 + 16, 11,
        bg ? 'rgba(255,255,255,0.75)' : P.text3, false);
    }
  }

  /* 场景名标签（右上角） */
  if (scn) {
    R.setFont(ctx, 12, true);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(scn, W - PAD - ctx.measureText(scn).width, SAFE_TOP + 22);
  }
}

/* 事件选项：点击只选中，再由底部「确认」提交（供测试与外部调用） */
function tapEventOption(i) {
  if (!today || today.phase !== 'event') return;
  var key = 'opt:' + (today.event ? today.event.id : '') + ':' + i;
  selectOnly(key, function () { chooseOption(i); });
}

/* ================= 结果页（二级页面） =================
 * 「寻找相亲机会」的结果、以及「选择事件选项后」的结果，统一用独立页面展示：
 * 不展示属性与目标，只给结果反馈（标题 / 花费 / 正文 / 属性变化）和「继续」。
 * 点继续回到主界面后，属性变化会在主界面上动态飘出。 */
/* ---------------------------------------------------------
 * 结算页的固定头部（告白 / 求婚这类「对方就在现场」的行动）
 * ---------------------------------------------------------
 * 哪些行动要展示头部由常量 RESULT_HEAD_ACTIONS 决定（逗号分隔，默认
 * confess,propose）—— 这两件事玩家最需要看到对方的脸和当时的环境。
 * 场景：先用结算正文做关键词匹配，匹配不到再退 actionScene 的默认场景；
 * 都没有就只留纯色头部（与事件页一致的兜底逻辑）。
 * ------------------------------------------------------- */
function resultHeadActions() {
  var raw = DB.num('RESULT_HEAD_ACTIONS', 'confess,propose');
  if (Array.isArray(raw)) return raw;
  return String(raw || '')
    .split(',')
    .map(function (x) { return x.trim(); })
    .filter(function (x) { return x; });
}

function resultHeadOn() {
  if (scene !== 'play') return false;
  if (!today || today.phase !== 'done' || !today.result) return false;
  return resultHeadActions().indexOf(String(today.action || '')) >= 0;
}

function resultSceneName() {
  if (!today) return null;
  var r = today.result || {};
  var lines = (r.lines || []).filter(function (l) { return l !== ''; });
  /* 复用事件页的关键词匹配：给一个「空事件」，只靠结算正文找场景 */
  var extra = (r.title || '') + ' ' + lines.join(' ');
  var scn = art.sceneNameForEvent({ id: '', text: lines, options: [] }, null, null, extra);
  return scn || art.actionScene(today.action);
}

function resultHeadH() {
  if (!resultHeadOn()) return 0;
  return resultSceneName() ? 200 : 132;
}

function drawResultHeader() {
  if (!resultHeadOn()) return;
  drawPairHeader(resultHeadH(), resultSceneName());
}

function drawResultPage() {
  if (scene !== 'play' || !today || today.phase !== 'done' || !today.result) return;
  var r = today.result;

  /* 有固定头部时内容从头部下方开始，否则沿用原来的顶部留白 */
  C.y = SAFE_TOP + (resultHeadOn() ? resultHeadH() + 14 : 28 + TOP_INSET);

  /* 结果图标 + 标题：明确告诉玩家「这一趟成了 / 没成」 */
  var bad = r.title && /没|失败|落空|拒绝|结束|没答应|没有|告吹/.test(r.title);
  var icon = bad ? '!' : '✓';
  var ic = bad ? P.down : P.up;
  R.setFont(ctx, 26, true);
  ctx.fillStyle = ic;
  ctx.fillText(icon, PAD + 2, C.y + 20);

  if (r.title) {
    R.setFont(ctx, 19, true);
    ctx.fillStyle = P.text1;
    C.y = R.drawWrapped(ctx, r.title, PAD + 32, C.y + 2, W - PAD * 2 - 32, 26, P.text1, 19, true);
    C.y += 10;
  } else {
    C.y += 34;
  }

  /* 花销：相亲成功时单独一个背景框（信封卡片的「花销」栏） */
  if (today.costMoney) {
    if (r.lead) {
      drawCostBox(today.costMoney);
    } else {
      R.setFont(ctx, 13, true);
      ctx.fillStyle = P.down;
      ctx.fillText(fmt(txt('costLine'), { v: engine.moneyText(today.costMoney) }), PAD, C.y + 12);
      C.y += 22;
    }
  }

  /* 备注 */
  if (today.note) {
    C.y = R.drawWrapped(ctx, today.note, PAD, C.y + 6, W - PAD * 2, 18, P.warn, 12);
    C.y += 6;
  }

  /* 对象信息：信封样式卡片（花销之后，介绍之前） */
  if (r.lead) drawEnvelopeCard(r.lead);

  /* 正文 */
  if (r.lines) {
    C.y += 4;
    r.lines.forEach(function (l) {
      if (l === '') { C.y += 8; return; }
      C.y = R.drawWrapped(ctx, engine.fillText(l, S), PAD, C.y + 4, W - PAD * 2, LINEH, P.text1, 15);
      C.y += 4;
    });
  }

  /* 偶遇：本次安排顺带认识的人 */
  if (r.encounter) drawEncounterCard(r.encounter);

  /* 属性变化（本次结算的增减） */
  C.y += 10;
  drawDeltaTags(r.delta, PAD);

  /* 继续：回到主界面，属性变化会在主界面动态展示 */
  bottomAction(fmt(txt('continueDay'), { n: today.costDays }), continueDay, { primary: true });
}

/* ================= 二级页：对方资料 =================
 * 主界面点对方头像进入。展示完整设定（年龄 / 职业 / 性格 / 家庭 / 外形 / 爱好 /
 * 认识方式 / 颜值家境 / 好感度），字段与生成逻辑一一对应。
 * 标签全部取自 texts 的 profile 文档，渲染层不硬编码文案。 */
var PREV_SCENE = null;      // 从哪个场景点进来的，返回时回到哪

function backToPlay() {
  scene = PREV_SCENE || 'play';
  PREV_SCENE = null;
  scrollY = 0;
  draw();
}

function openPartnerProfile() {
  if (!S) return;
  PREV_SCENE = scene;
  scene = 'partner';
  scrollY = 0;
  draw();
}

function openStatDetail() {
  if (!S) return;
  PREV_SCENE = scene;
  scene = 'stats';
  scrollY = 0;
  draw();
}

function drawPartnerProfile() {
  var T = tset('profile') || {};
  var who = S && (S.partner || S.lead);

  C.y = SAFE_TOP + 16 + TOP_INSET;

  if (!who) {
    section(T.title || '对方资料', null);
    C.y = R.drawWrapped(ctx, T.empty || '现在还没有对象。',
      PAD, C.y + 10, W - PAD * 2, LINEH, P.text2, 14);
    bottomAction(T.back || '返回', backToPlay, { primary: true });
    return;
  }

  section(T.title || '对方资料', null);

  /* 大头像 + 姓名 + 当前关系 */
  var size = 96;
  drawRoleAvatar(art.partnerImg(who.job, who.gender, who.avatar), W / 2, C.y + size / 2 + 4, size, 'TA');
  C.y += size + 22;
  centerText(who.name || '', W / 2, C.y, 20, P.text1, true);
  C.y += 20;
  var relNames = tset('rel_names') || {};
  centerText(relNames[S.relationship] || S.relationship || '', W / 2, C.y, 12, P.accent, false);
  C.y += 18;

  /* 资料行：标签 + 值（值为空的行自动跳过） */
  var rows = [
    [T.age, who.age ? (who.age + '岁') : ''],
    [T.job, [who.job, who.jobNote].filter(function (s) { return s; }).join(' · ')],
    [T.trait, [who.trait, who.traitDesc].filter(function (s) { return s; }).join(' —— ')],
    [T.personality, [who.personality, who.personalityDesc].filter(function (s) { return s; }).join(' —— ')],
    [T.condition, [who.condition, who.conditionDesc].filter(function (s) { return s; }).join(' —— ')],
    [T.look, who.look || ''],
    [T.hobby, who.hobby || ''],
    [T.place, who.place || ''],
    [T.looks, who.looks != null ? String(who.looks) : ''],
    [T.family, who.family != null ? String(who.family) : '']
  ];
  if (S.partner) rows.push([T.affection, String(Math.round(S.affection))]);

  R.fillRoundRect(ctx, PAD, C.y - 8, W - PAD * 2, 8, 4, P.card);   // 分隔留白
  C.y += 6;

  rows.forEach(function (r) {
    if (!r[0] || !r[1]) return;
    R.setFont(ctx, 12, true);
    ctx.fillStyle = P.text3;
    ctx.fillText(r[0], PAD, C.y + 12);
    C.y = R.drawWrapped(ctx, r[1], PAD + 56, C.y + 12, W - PAD * 2 - 56, 18, P.text1, 13);
    C.y += 8;
  });

  /* 还是「待见面」状态时给出下一步提示 */
  if (!S.partner && S.lead && T.leadHint) {
    C.y += 6;
    C.y = R.drawWrapped(ctx, T.leadHint, PAD, C.y, W - PAD * 2, 18, P.warn, 12);
  }

  bottomAction(T.back || '返回', backToPlay, { primary: true });
}

/* ================= 二级页：近期变化 =================
 * 主界面点任意属性条进入。把所有属性的涨跌放在一起，
 * 依次展示：当前状态 → 本次结算 → 最近若干天（含关键事件 + 每项「从 x 变为 y」）→ 近期合计。
 * 历史条目只存状态（数值 + 变化 + 事件标签），不含任何游戏数据。 */
var STAT_KEYS = ['money', 'affection', 'health', 'career', 'looks', 'family', 'mood'];

function statHistory() { return (S && S.history) || []; }

/* 把一次结算记进历史：delta（涨跌）+ from/to（结算前后快照）+ label（关键事件）。
 * 只记录「有实际变化」的条目；长度受常量 STAT_HISTORY_MAX 限制。 */
function recordStatHistory(delta, label) {
  if (!S || !delta) return;
  var clean = {};
  var any = false;
  STAT_KEYS.forEach(function (k) {
    var v = Math.round(delta[k] || 0);
    if (v) { clean[k] = v; any = true; }
  });
  if (!any) return;
  if (!S.history) S.history = [];
  var to = {}, from = {};
  STAT_KEYS.forEach(function (k) {
    to[k] = Math.round(S[k] || 0);
    from[k] = to[k] - (clean[k] || 0);
  });
  S.history.push({ day: S.day, delta: clean, from: from, to: to, label: label || '' });
  var max = DB.num('STAT_HISTORY_MAX', 12);
  if (S.history.length > max) S.history = S.history.slice(-max);
}

function sumDelta(list) {
  var out = {};
  list.forEach(function (h) {
    for (var k in h.delta) out[k] = (out[k] || 0) + h.delta[k];
  });
  return out;
}

/* 行动 → 中文名（「近期经历」卡片右上角那行小字），全部取数据库文案 */
function actionLabel(action) {
  if (!action) return '';
  var p = (S && (S.partner || S.lead)) || {};
  var m = {
    life: txt('lifeTitle'), improve: txt('improveTitle'), rest: txt('restResultTitle'),
    overtime: txt('overtimeTitleResult'), seek: txt('seekMenuTitle'), meet: txt('meetTitle'),
    date: txt('dateTitle'), chat: txt('chatTitle'), confess: txt('confessTitle'),
    propose: txt('proposeTitle'), child: txt('childTitle'), breakup: txt('breakupTitle')
  };
  return fmt(m[action] || '', { name: p.name || '' });
}

/* ================= 近期经历 =================
 * 每次行动结束后记一条：事件正文 / 你的选择 / 结果。
 * 只记状态（字符串数组），不含任何游戏数据；长度受常量 ACTLOG_MAX 限制。 */
function recordAct() {
  if (!S || !today || !today.result) return;
  var meta = today.actMeta || {};
  if (!S.acts) S.acts = [];
  S.acts.push({
    day: S.day,
    action: today.action || '',
    title: meta.title || actionLabel(today.action) || today.result.title || '',
    event: (meta.event || []).slice(0, 4),
    option: meta.option || '',
    result: (today.result.lines || []).slice(0, 6)
  });
  var max = DB.num('ACTLOG_MAX', 5);
  if (S.acts.length > max) S.acts = S.acts.slice(-max);
}

function deltaIsEmpty(d) {
  for (var k in d) { if (d[k]) return false; }
  return true;
}

/* 属性值的展示口径：存款按「万」压缩，其余一律取整（属性会因每日衰减带小数，展示必须收干净） */
function statValue(k, v) {
  return (k === 'money') ? engine.moneyText(v) : String(Math.round(v));
}
function changedKeys(delta) {
  return STAT_KEYS.filter(function (k) { return Math.round((delta && delta[k]) || 0) !== 0; });
}
/* 结算前后的快照（当前 S 是结算后的状态，减去 delta 即结算前） */
function snapshotOf(delta) {
  var to = {}, from = {};
  STAT_KEYS.forEach(function (k) {
    to[k] = Math.round(S[k] || 0);
    from[k] = to[k] - Math.round((delta && delta[k]) || 0);
  });
  return { from: from, to: to };
}

function drawStatDetail() {
  var T = tset('statlog') || {};
  C.y = SAFE_TOP + 16 + TOP_INSET;

  section(T.title || '近期变化', T.hint || null);

  /* 当前状态：七项一起摆出来（复用属性条绘制，但这里不再可点） */
  R.setFont(ctx, 12, true);
  ctx.fillStyle = P.text3;
  ctx.fillText(T.currentTitle || '当前状态', PAD, C.y + 12);
  C.y += 20;
  drawStatGrid(tset('stat_defs') || []);
  C.y += 10;

  var hist = statHistory();
  var session = (today && today.result && today.result.delta) || null;
  var hasSession = session && !deltaIsEmpty(session);

  if (!hasSession && !hist.length) {
    C.y = R.drawWrapped(ctx, T.empty || '还没有可展示的变化。',
      PAD, C.y + 6, W - PAD * 2, LINEH, P.text2, 13);
    bottomAction(T.back || '返回', backToPlay, { primary: true });
    return;
  }

  /* 一天：标题 + 关键事件 + 每项属性的「从 x 变为 y」
   * 间距节奏：日期标题基线 +13 → 内容基线 +30（统一留 18px 空隙，不贴字）。 */
  function dayBlock(title, h) {
    R.setFont(ctx, 14, true);
    ctx.fillStyle = P.accent;
    ctx.fillText(title, PAD, C.y + 13);
    C.y += 28;

    if (h.label) {
      R.setFont(ctx, 11, true);
      ctx.fillStyle = P.text3;
      ctx.fillText(T.eventTitle || '关键事件', PAD, C.y + 12);
      C.y += 18;
      C.y = R.drawWrapped(ctx, h.label, PAD, C.y + 12, W - PAD * 2, 19, P.text1, 14) + 8;
    } else if (T.noEvent) {
      C.y = R.drawWrapped(ctx, T.noEvent, PAD, C.y + 12, W - PAD * 2, 18, P.text3, 12) + 6;
    }

    var keys = changedKeys(h.delta);
    keys.forEach(function (k) {
      var fv = h.from ? h.from[k] : null;
      var tv = h.to ? h.to[k] : null;
      if (fv === null || fv === undefined || tv === null || tv === undefined) {
        /* 老存档没有前后快照 → 退回只显示涨跌幅度 */
        var one = {};
        one[k] = h.delta[k];
        drawDeltaTags(one, PAD);
        return;
      }
      var line = fmt(T.fromTo || '{label}：从 {from} 变为 {to}', {
        label: statLabel(k), from: statValue(k, fv), to: statValue(k, tv)
      });
      C.y = R.drawWrapped(ctx, line, PAD, C.y + 10, W - PAD * 2, 18, P.text2, 13) + 2;
    });

    if (keys.length) drawDeltaTags(h.delta, PAD);
    C.y += 10;
  }

  /* 本次结算（还没回主界面时） */
  if (hasSession) {
    var snap = snapshotOf(session);
    dayBlock(fmt(T.sessionTitle || '本次结算（第 {day} 天）', { day: S.day }), {
      delta: session,
      from: snap.from,
      to: snap.to,
      label: (today.result && today.result.title) || ''
    });
  }
  /* 历史：最新的在前 */
  for (var i = hist.length - 1; i >= 0; i--) {
    dayBlock(fmt(T.dayTitle || '第 {day} 天', { day: hist[i].day }), hist[i]);
  }

  /* 近期合计 */
  var totalD = sumDelta(hist);
  if (!deltaIsEmpty(totalD)) {
    R.setFont(ctx, 14, true);
    ctx.fillStyle = P.accent;
    ctx.fillText(fmt(T.totalTitle || '近期合计（近 {n} 天）', { n: hist.length }), PAD, C.y + 15);
    C.y += 24;
    drawDeltaTags(totalD, PAD);
  }

  bottomAction(T.back || '返回', backToPlay, { primary: true });
}

/* ================= 二级页：近期经历 =================
 * 主界面「近期经历」块可点进入。把最近几次行动摊开：
 * 事件正文 → 你的选择 → 结果，三条都在。 */
function openRecent() {
  if (!S) return;
  PREV_SCENE = scene;
  scene = 'recent';
  scrollY = 0;
  draw();
}

function actLog() { return (S && S.acts) || []; }

function drawRecentPage() {
  var T = tset('recent') || {};
  C.y = SAFE_TOP + 16 + TOP_INSET;

  section(T.title || '近期经历', T.hint || null);

  var acts = actLog();
  if (!acts.length) {
    C.y = R.drawWrapped(ctx, T.empty || '还没有什么经历。',
      PAD, C.y + 10, W - PAD * 2, LINEH, P.text2, 14);
    bottomAction(T.back || '返回', backToPlay, { primary: true });
    return;
  }

  /* 最新的在前 */
  for (var i = acts.length - 1; i >= 0; i--) {
    drawActCard(acts[i], T);
  }

  bottomAction(T.back || '返回', backToPlay, { primary: true });
}

/* 一条经历：卡片内三段（事件 / 你的选择 / 结果），每段带小标题 */
function drawActCard(a, T) {
  var x = PAD, w = W - PAD * 2;
  var pad = 14;
  var innerW = w - pad * 2;
  var labelW = 62;
  var textW = innerW - labelW;

  function lines(text, size) {
    if (!text) return [];
    R.setFont(ctx, size || 13, false);
    return R.wrapText(ctx, text, textW);
  }
  function paragraphs(arr, size) {
    var out = [];
    (arr || []).forEach(function (t) {
      if (t === '') { out.push(''); return; }
      lines(t, size).forEach(function (l) { out.push(l); });
    });
    return out;
  }

  var eventLines = paragraphs(a.event, 13);
  var resultLines = paragraphs(a.result, 13);

  /* 先量高度，再画卡片：避免「先画框再撑高」的错位 */
  var h = pad;
  h += 26;                                     // 标题行
  if (eventLines.length) h += 18 + eventLines.length * 19 + 8;
  if (a.option) h += 18 + 20 + 8;
  if (resultLines.length) h += 18 + resultLines.length * 19 + 8;
  h += pad;

  var y = C.y + 6;
  R.fillRoundRect(ctx, x, y, w, h, 14, P.card);
  R.roundRectPath(ctx, x, y, w, h, 14);
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  ctx.stroke();
  /* 左侧色条：一眼区分不同天的经历 */
  R.fillRoundRect(ctx, x, y + 12, 4, h - 24, 2, P.primary);

  var yy = y + pad;
  R.setFont(ctx, 13, true);
  ctx.fillStyle = P.primaryDark || P.primary;
  ctx.fillText(fmt(T.dayTitle || '第 {day} 天', { day: a.day }), x + pad, yy + 12);
  if (a.title) {
    R.setFont(ctx, 12, false);
    ctx.fillStyle = P.text3;
    var tw = ctx.measureText(a.title).width;
    ctx.fillText(a.title, x + w - pad - tw, yy + 12);
  }
  yy += 26;

  function seg(label, bodyLines, color) {
    if (!bodyLines.length) return;
    R.setFont(ctx, 11, true);
    ctx.fillStyle = P.text3;
    ctx.fillText(label, x + pad, yy + 12);
    yy += 18;
    R.setFont(ctx, 13, false);
    ctx.fillStyle = color;
    bodyLines.forEach(function (l) { ctx.fillText(l, x + pad + labelW, yy + 12); yy += 19; });
    yy += 8;
  }

  seg(T.eventTitle || '事件', eventLines, P.text1);

  if (a.option) {
    R.setFont(ctx, 11, true);
    ctx.fillStyle = P.text3;
    ctx.fillText(T.optionTitle || '你的选择', x + pad, yy + 12);
    yy += 18;
    R.fillRoundRect(ctx, x + pad + labelW - 6, yy, textW + 12, 20, 10, '#fbeae5');
    R.setFont(ctx, 13, true);
    ctx.fillStyle = P.primaryDark || P.primary;
    var ol = R.wrapText(ctx, a.option, textW - 4)[0] || a.option;
    ctx.fillText(ol, x + pad + labelW, yy + 14);
    yy += 20 + 8;
  }

  seg(T.resultTitle || '结果', resultLines, P.text2);

  C.y = y + h;
}

/* ================= 信封卡片（相亲机会的对象信息） =================
 * 花销一个框；对象信息做成信封：顶部信封口 + 头像，
 * 姓名 / 职业 / 性格 / 家庭 / 条件 每项一个独立背景框。
 * 所有文案取 texts.envelope，头像取 materials.jobs[].avatar（数据库）。 */
function envelopeRow(label, value, valueW) {
  R.setFont(ctx, 13, false);
  var lines = value ? R.wrapText(ctx, value, valueW) : [];
  return { label: label, lines: lines, h: Math.max(34, lines.length * 19 + 15) };
}

/* 最近一次信封卡片的几何（供布局回归断言：内容不能溢出卡片） */
var _lastEnvelope = null;

function drawEnvelopeCard(who) {
  var T = tset('envelope') || {};
  if (!who) return;

  var x = PAD, w = W - PAD * 2;
  var pad = 14;
  var innerW = w - pad * 2;
  var labelW = 56;
  var valueW = innerW - labelW - 16;

  var rows = [
    envelopeRow(T.name || '姓名', who.name || '', valueW),
    envelopeRow(T.job || '职业', [who.job, who.jobNote].filter(function (s) { return s; }).join(' · '), valueW),
    envelopeRow(T.trait || '性格', [who.trait, who.traitDesc].filter(function (s) { return s; }).join(' —— '), valueW),
    envelopeRow(T.family || '家庭', [who.condition, who.conditionDesc].filter(function (s) { return s; }).join(' —— '), valueW),
    envelopeRow(T.condition || '条件', fmt(T.extra || '颜值 {looks} · 家境 {family} · 平时喜欢{hobby}',
      { looks: who.looks, family: who.family, hobby: who.hobby || '' }), valueW)
  ];

  var flapH = 46;
  var avSize = 72;
  var gap = 10;
  /* 高度直接由「排版实际占用」推出来，避免卡片比内容矮一截、
   * 最后一行（或地点行）被压在卡片边框外面。 */
  var rowsTotal = 0;
  rows.forEach(function (r) { rowsTotal += r.h + 8; });
  var placeH = (T.place && who.place) ? 22 : 0;
  var top = flapH + avSize - 8 + gap;      // 卡片顶 → 第一行背景框的垂直距离
  var h = top + rowsTotal + placeH + pad;

  var y = C.y + 8;
  /* 卡片主体 */
  R.fillRoundRect(ctx, x, y, w, h, 16, P.card);
  R.roundRectPath(ctx, x, y, w, h, 16);
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  ctx.stroke();

  /* 信封口：顶部三角形 + 两条斜线 */
  ctx.save();
  R.roundRectPath(ctx, x, y, w, h, 16);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w / 2, y + flapH);
  ctx.closePath();
  ctx.fillStyle = '#fbeae5';
  ctx.fill();
  ctx.strokeStyle = '#e8cdc4';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  R.setFont(ctx, 12, true);
  ctx.fillStyle = P.primaryDark || P.primary;
  ctx.fillText(ICON.chance + ' ' + (T.badge || '相亲机会'), x + pad, y + 18);
  R.setFont(ctx, 12, false);
  ctx.fillStyle = P.text3;
  var tt = T.title || '对象信息';
  ctx.fillText(tt, x + w - pad - ctx.measureText(tt).width, y + 18);

  /* 头像压在信封口的尖上 */
  var avY = y + flapH + avSize / 2 - 8;
  drawRoleAvatar(art.partnerImg(who.job, who.gender, who.avatar), x + w / 2, avY, avSize, (who.name || 'TA').slice(0, 1));

  var yy = avY + avSize / 2 + gap;
  rows.forEach(function (r) {
    R.fillRoundRect(ctx, x + pad, yy, innerW, r.h, 10, P.tagBg);
    R.setFont(ctx, 12, true);
    ctx.fillStyle = P.text3;
    ctx.fillText(r.label, x + pad + 12, yy + 20);
    R.setFont(ctx, 13, false);
    ctx.fillStyle = P.text1;
    var ly = yy + 20;
    r.lines.forEach(function (l) { ctx.fillText(l, x + pad + 12 + labelW, ly); ly += 19; });
    yy += r.h + 8;
  });

  if (T.place && who.place) {
    R.setFont(ctx, 11, false);
    ctx.fillStyle = P.text3;
    ctx.fillText(fmt(T.place, { place: who.place }), x + pad + 2, yy + 12);
    yy += 20;
  }

  /* 记录几何：内容底部（yy）必须落在卡片内（y + h），否则就是排版溢出 */
  _lastEnvelope = { y: y, h: h, bottom: y + h, contentBottom: yy };

  C.y = y + h + 4;
}

/* 花销：单独一个背景框 */
function drawCostBox(cost) {
  if (!cost) return;
  var T = tset('envelope') || {};
  var x = PAD, w = W - PAD * 2;
  var h = 40;
  var y = C.y + 6;
  R.fillRoundRect(ctx, x, y, w, h, 10, P.tagBg);
  R.setFont(ctx, 12, true);
  ctx.fillStyle = P.text3;
  ctx.fillText(T.costTitle || '花销', x + 14, y + 25);
  R.setFont(ctx, 15, true);
  ctx.fillStyle = P.down;
  var v = fmt(txt('costLine') || '花销 −{v}', { v: engine.moneyText(cost) });
  ctx.fillText(v, x + w - 14 - ctx.measureText(v).width, y + 25);
  C.y = y + h + 6;
}

/* ================= 二级页：微信闲聊 =================
 * 非单身时可用：对方先发几条消息，玩家从若干回复里挑一个，
 * 只影响好感度与情绪。剧情与数值全部来自 chats 集合。 */
var chatState = null;      // { chat, phase:'pick'|'result', picked, delta, reply, proactive, locked }

/* 打开微信闲聊。
 * @param {boolean} proactive true = 对方主动发来的（当天被动进入，聊完这一整天就没了）
 * 被「必须出门约会」锁住时不展示题目，只给一句「我们还是多当面接触吧」。 */
function openChat(proactive) {
  if (!S || !engine.canChat(S)) return;

  if (engine.chatLocked(S)) {
    chatState = { locked: true, proactive: false };
    PREV_SCENE = 'play';
    scene = 'chat';
    scrollY = 0;
    draw();
    return;
  }

  var c = engine.pickChat(S);
  if (!c) {
    /* 当前阶段一条可聊的题都没有（chats 数据缺失）：
     *   · 玩家主动点进来的 → 给一页说明，别把空白页甩给玩家
     *   · 对方主动发来的 → 不成立，当天照常回行动菜单（别白扣一天） */
    if (proactive) {
      today.phase = 'choose';
      draw();
      return;
    }
    chatState = { empty: true, proactive: false };
    PREV_SCENE = 'play';
    scene = 'chat';
    scrollY = 0;
    draw();
    return;
  }
  chatState = { chat: c, phase: 'pick', picked: -1, proactive: !!proactive };
  PREV_SCENE = 'play';
  scene = 'chat';
  scrollY = 0;
  draw();
}

function closeChat() {
  /* 对方主动发来的那一次不能「溜掉」：只能聊完往下走 */
  if (chatState && chatState.proactive) return;
  chatState = null;
  scene = PREV_SCENE || 'play';
  PREV_SCENE = null;
  if (today) { today.phase = 'choose'; today.pendingOption = null; }
  scrollY = 0;
  draw();
}

/* 选定回复：只记下选项，高亮统一由 pendingKey 决定（与设定页同一套单选模型） */
function pickChatOption(i) {
  if (!chatState || chatState.phase !== 'pick') return;
  chatState.picked = i;
}

function sendChat() {
  if (!chatState || chatState.phase !== 'pick') return;
  var c = chatState.chat;
  if (chatState.picked < 0 || !c.options[chatState.picked]) return;
  var opt = c.options[chatState.picked];
  var res = engine.applyChat(S, opt);
  /* 记账：主动聊天计数 +1；如果这条是固定剧情，就进入「必须当面约会」状态 */
  var after = engine.afterChat(S, c, chatState.proactive);
  chatState.phase = 'result';
  chatState.delta = res.delta;
  chatState.reply = res.reply;
  chatState.option = opt;
  chatState.after = after;

  /* 闲聊也占时间：天数成本走 ACTION_DAYS.chat（数据驱动） */
  var d = engine.actionDays('chat', S);
  if (today) {
    today.costDays = d;
    today.action = 'chat';
    today.result = {
      title: txt('chatTitle') || '微信闲聊',
      lines: [opt.label].concat(res.reply ? [res.reply] : []),
      delta: res.delta,
      kind: 'chat'
    };
    today.actMeta = { title: txt('chatTitle') || '微信闲聊', event: (c.opener || []).slice(), option: opt.label };
  }
  S.log.push({ day: S.day, text: txt('chatTitle') || '微信闲聊' });
  saveGame();
  draw();
}

/* 结束闲聊：走与其它行动一致的收尾（记历史 / 推进天数 / 判定结局）。
 * 主动聊天本来就是「这一天的全部内容」，continueDay 会直接翻到新的一天，
 * 不再给玩家回去挑行动的机会 —— 也就是「跳过当天的事件选择」。 */
function finishChat() {
  chatState = null;
  scene = 'play';
  PREV_SCENE = null;
  continueDay();
}

/* 微信风格顶栏（固定层绘制，不随内容滚动） */
var CHAT_BAR_H = 44;
function drawChatBar() {
  var T = tset('chat') || {};
  var who = S && (S.partner || S.lead);
  ctx.fillStyle = '#ededed';
  ctx.fillRect(0, 0, W, SAFE_TOP + CHAT_BAR_H);
  centerText(who ? who.name : (T.title || '微信闲聊'), W / 2, SAFE_TOP + 28, 16, '#1a1a1a', true);
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.fillRect(0, SAFE_TOP + CHAT_BAR_H, W, 1);
}

/* 微信风格的对话框：左白右绿，对方带头像 */
function drawBubble(text, side, cx, cy, maxW, avatarImg) {
  var padX = 12, padY = 9, size = 14, lh = 20;
  R.setFont(ctx, size, false);
  var lines = R.wrapText(ctx, text, maxW - padX * 2);
  var w = 0;
  lines.forEach(function (l) { w = Math.max(w, ctx.measureText(l).width); });
  w = Math.min(maxW, w + padX * 2);
  var h = lines.length * lh + padY * 2;

  var av = 34;
  var gutter = av + 8;
  var x = (side === 'me') ? (W - PAD - w) : (PAD + gutter);
  var bubbleX = x;
  var bodyX = bubbleX + padX;

  /* 小尖角 */
  ctx.beginPath();
  if (side === 'me') {
    ctx.moveTo(bubbleX + w, cy + 12);
    ctx.lineTo(bubbleX + w + 7, cy + 17);
    ctx.lineTo(bubbleX + w, cy + 22);
  } else {
    ctx.moveTo(bubbleX, cy + 12);
    ctx.lineTo(bubbleX - 7, cy + 17);
    ctx.lineTo(bubbleX, cy + 22);
  }
  ctx.closePath();
  ctx.fillStyle = (side === 'me') ? '#95ec69' : '#ffffff';
  ctx.fill();

  R.fillRoundRect(ctx, bubbleX, cy, w, h, 8, (side === 'me') ? '#95ec69' : '#ffffff');

  if (side !== 'me') {
    drawRoleAvatar(avatarImg, PAD + av / 2, cy + av / 2, av, 'TA');
  }
  R.setFont(ctx, size, false);
  ctx.fillStyle = '#1a1a1a';
  var ly = cy + padY + size;
  lines.forEach(function (l) { ctx.fillText(l, bodyX, ly); ly += lh; });

  return cy + h;
}

function drawChatPage() {
  var T = tset('chat') || {};
  if (!chatState) {
    bottomAction(T.back || '返回', backToPlay, { primary: true });
    return;
  }

  /* 顶栏由 drawChatBar() 画在固定层，这里从它下面开始排内容 */
  C.y = SAFE_TOP + CHAT_BAR_H + 14;

  var who = S.partner || S.lead;
  var avImg = who ? art.partnerImg(who.job, who.gender, who.avatar) : null;
  var maxW = W - PAD * 2 - 60;

  /* ---- 被「必须出门约会」锁住：只显示一句拒绝，不给任何题目 ---- */
  if (chatState.locked) {
    C.y = drawBubble(T.lockedLine || '我们还是多当面接触吧', 'them', 0, C.y + 4, maxW, avImg) + 8;
    C.y += 4;
    C.y = R.drawWrapped(ctx, T.lockedHint || '',
      PAD, C.y + 4, W - PAD * 2, LINEH, P.text2, 13);
    bottomAction(T.back || '返回', closeChat);
    return;
  }

  var c = chatState.chat;

  /* ---- 这个阶段一条可聊的题都没有（chats 数据缺失）：给一句说明就收工 ---- */
  if (chatState.empty) {
    C.y = drawBubble(T.emptyLine || '', 'them', 0, C.y + 4, maxW, avImg) + 8;
    C.y += 4;
    C.y = R.drawWrapped(ctx, T.emptyHint || '',
      PAD, C.y + 4, W - PAD * 2, LINEH, P.text2, 13);
    bottomAction(T.back || '返回', closeChat, { primary: true });
    return;
  }

  /* 对方主动发来的：顶部点一句，玩家知道「是 TA 先找的你」 */
  if (chatState.proactive) {
    var tag = T.proactiveTag || '对方主动发来了消息';
    R.setFont(ctx, 11, false);
    ctx.fillStyle = P.text3;
    ctx.fillText(tag, PAD, C.y + 12);
    C.y += 20;
  }
  /* 灵魂拷问 / 暧昧事件：标一下这次的调性 */
  var kindTag = (c.kind === 'grill') ? (T.kindGrill || '')
    : (c.kind === 'flirt' ? (T.kindFlirt || '') : '');
  if (kindTag) {
    R.setFont(ctx, 11, false);
    ctx.fillStyle = (c.kind === 'grill') ? P.down : P.accent;
    ctx.fillText(kindTag, PAD, C.y + 12);
    C.y += 20;
  }

  /* 对方先发来的消息 */
  (c.opener || []).forEach(function (m) {
    C.y = drawBubble(m, 'them', 0, C.y + 4, maxW, avImg) + 8;
  });

  if (chatState.phase === 'pick') {
    var hint = T.hint || '';
    if (hint) {
      R.setFont(ctx, 11, false);
      ctx.fillStyle = P.text3;
      ctx.fillText(hint, PAD, C.y + 12);
      C.y += 20;
    }
    (c.options || []).forEach(function (o, i) {
      optionCard({
        title: o.label, compact: true,
        selected: (pendingKey === 'chat:' + i),      // 高亮只认本次点击
        selectable: true, key: 'chat:' + i,
        onClick: function () { pickChatOption(i); }
      });
    });
    /* 对方主动发来的不能一走了之，也就没有「返回」 */
    if (!chatState.proactive) bottomAction(T.back || '返回', closeChat);
    confirmAction(T.send || '发送', { run: sendChat });
  } else {
    /* 我发出去的回复 */
    if (chatState.option) {
      C.y = drawBubble(chatState.option.label, 'me', 0, C.y + 6, maxW, null) + 8;
    }
    /* 对方的回应 */
    if (chatState.reply) {
      R.setFont(ctx, 11, false);
      ctx.fillStyle = P.text3;
      ctx.fillText(T.replyTitle || '对方的回应', PAD, C.y + 12);
      C.y += 18;
      C.y = drawBubble(chatState.reply, 'them', 0, C.y + 4, maxW, avImg) + 10;
    }
    /* 答没答到点子上：只有灵魂拷问 / 暧昧事件才有这条提示 */
    var isK = (c.kind === 'grill' || c.kind === 'flirt');
    if (isK && chatState.option) {
      var hit = !!chatState.option.correct;
      R.setFont(ctx, 12, true);
      ctx.fillStyle = hit ? P.up : P.down;
      var vt = hit ? (T.verdictGood || '答到点子上了') : (T.verdictBad || '这话说得不太妙');
      ctx.fillText(vt, PAD, C.y + 12);
      C.y += 22;
    }
    R.setFont(ctx, 11, false);
    ctx.fillStyle = P.text3;
    ctx.fillText(T.deltaTitle || '这次闲聊', PAD, C.y + 12);
    C.y += 18;
    drawDeltaTags(chatState.delta, PAD);
    /* 聊完固定剧情 → 后面只能当面见了，提前说清楚下一步该做什么 */
    if (chatState.after && chatState.after.mustDate) {
      C.y = R.drawWrapped(ctx, T.mustDateNotice || '',
        PAD, C.y + 8, W - PAD * 2, LINEH, P.warn, 12);
    }
    /* 结束闲聊 = 结算完成，推进天数回主界面（按钮文案把这个动作说清楚） */
    bottomAction(T.finish || '结束闲聊 · 进入下一天', finishChat, { primary: true });
  }
}

/* ================= 二级页：相亲图鉴 =================
 * 入口：主界面底部「相亲图鉴」/ 标题页「相亲图鉴」。
 * 数据：roster 来自数据库 partners 集合（姓名 / 头像 / 资料），
 *       解锁与进展来自本地图鉴存档（js/ui/gallery.js，跨局累计）。
 * 分男女两栏展示；已解锁显示头像 + 姓名 + 达成进展，未解锁显示黑框 + 问号。
 * ========================================================= */
function galleryText() { return tset('gallery') || {}; }

/* 阶段中文名（取自 texts.gallery.stages，渲染层不写死） */
function galleryStageLabel(stage) {
  var m = galleryText().stages || {};
  return m[stage] || stage || '';
}

/* 默认展示异性花名册（相亲对象就是异性） */
function galleryDefaultTab() {
  return (S && S.gender === 'f') ? 'm' : 'f';
}

function openGallery() {
  PREV_SCENE = scene;
  galleryTab = galleryDefaultTab();
  galleryPickId = null;
  scene = 'gallery';
  scrollY = 0;
  draw();
}

function closeGallery() {
  scene = PREV_SCENE || 'title';
  PREV_SCENE = null;
  galleryPickId = null;
  scrollY = 0;
  draw();
}

function gallerySetTab(g) {
  if (galleryTab === g) return;
  galleryTab = g;
  scrollY = 0;
  draw();
}

function openGalleryDetail(id) {
  galleryPickId = id;
  scene = 'galleryDetail';
  scrollY = 0;
  draw();
}

function backFromGalleryDetail() {
  galleryPickId = null;
  scene = 'gallery';
  scrollY = 0;
  draw();
}

function drawGallery() {
  var G = galleryText();
  C.y = SAFE_TOP + 16 + TOP_INSET;
  section(G.title || '相亲图鉴', G.sub || '');

  var all = DB.list('partners').filter(function (p) { return p && p.gender; });
  var roster = all.filter(function (p) { return engine.genderCode(p.gender) === galleryTab; });

  /* ---- 已解锁统计 ---- */
  var unlocked = gallery.unlockedCount(galleryTab, all);
  R.setFont(ctx, 13, true);
  ctx.fillStyle = P.text1;
  ctx.fillText(fmt(G.unlockedCount || '已解锁 {n} / {total}', { n: unlocked, total: roster.length }),
    PAD, C.y + 14);
  C.y += 26;

  /* ---- 男女分栏（两段式切换） ---- */
  var tabH = 40;
  var gap = 10;
  var tabW = (W - PAD * 2 - gap) / 2;
  var tabs = [
    { id: 'f', label: G.tabFemale || '女生' },
    { id: 'm', label: G.tabMale || '男生' }
  ];
  tabs.forEach(function (t, i) {
    var x = PAD + i * (tabW + gap);
    var on = (galleryTab === t.id);
    var cnt = gallery.unlockedCount(t.id, all);
    var tot = all.filter(function (p) { return engine.genderCode(p.gender) === t.id; }).length;
    R.fillRoundRect(ctx, x, C.y, tabW, tabH, 12, on ? P.primary : P.card);
    R.roundRectPath(ctx, x, C.y, tabW, tabH, 12);
    ctx.strokeStyle = on ? P.primary : P.line;
    ctx.lineWidth = 1;
    ctx.stroke();
    var label = t.label + ' ' + cnt + '/' + tot;
    R.setFont(ctx, 14, true);
    ctx.fillStyle = on ? '#ffffff' : P.text2;
    ctx.fillText(label, x + (tabW - ctx.measureText(label).width) / 2, C.y + 25);
    buttons.push({
      x: x, y: C.y, w: tabW, h: tabH, label: label,
      onClick: (function (id) { return function () { gallerySetTab(id); }; })(t.id)
    });
  });
  C.y += tabH + 16;

  if (!roster.length) {
    C.y = R.drawWrapped(ctx, G.empty || '这个性别还没有登记相亲对象。',
      PAD, C.y, W - PAD * 2, LINEH, P.text2, 13);
    bottomAction(G.back || '返回', closeGallery, { primary: true });
    return;
  }

  /* ---- 网格：一行三张卡片 ---- */
  var cols = 3;
  var cGap = 10;
  var cardW = (W - PAD * 2 - cGap * (cols - 1)) / cols;
  var avSize = Math.min(cardW - 30, 56);
  var cardH = avSize + 66;
  var anyMet = false;

  for (var i = 0; i < roster.length; i++) {
    var p = roster[i];
    var col = i % cols;
    var row = Math.floor(i / cols);
    var x = PAD + col * (cardW + cGap);
    var y = C.y + row * (cardH + cGap);
    var rec = gallery.record(p.id);
    var cx = x + cardW / 2;

    /* 卡片底 */
    R.fillRoundRect(ctx, x, y, cardW, cardH, 14, P.card);
    R.roundRectPath(ctx, x, y, cardW, cardH, 14);
    ctx.strokeStyle = rec ? P.line : '#ded3c2';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (rec) {
      anyMet = true;
      /* 已解锁：头像 + 姓名 + 达成进展 */
      drawRoleAvatar(art.partnerImg(p.job, p.gender, p.avatar), cx, y + 12 + avSize / 2, avSize, 'TA');
      R.setFont(ctx, 13, true);
      ctx.fillStyle = P.text1;
      var nm = p.name || '';
      ctx.fillText(nm, cx - ctx.measureText(nm).width / 2, y + 12 + avSize + 20);

      var stageTxt = galleryStageLabel(rec.stage);
      R.setFont(ctx, 10, true);
      ctx.fillStyle = rec.stage === 'married' ? P.up : P.accent;
      ctx.fillText(stageTxt, cx - ctx.measureText(stageTxt).width / 2, y + 12 + avSize + 38);

      if (rec.aff > 0) {
        var affTxt = fmt(G.peakAff || '好感度峰值 {n}', { n: rec.aff });
        R.setFont(ctx, 9, false);
        ctx.fillStyle = P.text3;
        ctx.fillText(affTxt, cx - ctx.measureText(affTxt).width / 2, y + 12 + avSize + 53);
      }

      buttons.push({
        x: x, y: y, w: cardW, h: cardH, label: 'gallery:' + p.id,
        onClick: (function (id) { return function () { openGalleryDetail(id); }; })(p.id)
      });
    } else {
      /* 未解锁：黑框 + 问号 */
      var box = avSize;
      R.fillRoundRect(ctx, cx - box / 2, y + 12, box, box, 12, '#2b2a28');
      R.setFont(ctx, Math.round(box * 0.5), true);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      var q = '？';
      ctx.fillText(q, cx - ctx.measureText(q).width / 2, y + 12 + box / 2 + box * 0.18);

      R.setFont(ctx, 13, true);
      ctx.fillStyle = P.text3;
      var ln = G.lockedName || '？？？';
      ctx.fillText(ln, cx - ctx.measureText(ln).width / 2, y + 12 + avSize + 20);

      var lk = G.locked || '未解锁';
      R.setFont(ctx, 10, false);
      ctx.fillStyle = P.text3;
      ctx.fillText(lk, cx - ctx.measureText(lk).width / 2, y + 12 + avSize + 38);
    }
  }

  var rows = Math.ceil(roster.length / cols);
  C.y += rows * (cardH + cGap) + 4;

  if (!anyMet && G.noneMet) {
    C.y = R.drawWrapped(ctx, G.noneMet, PAD, C.y, W - PAD * 2, 18, P.text2, 12);
    C.y += 6;
  } else if (G.tapHint) {
    C.y = R.drawWrapped(ctx, G.tapHint, PAD, C.y, W - PAD * 2, 18, P.text3, 12);
    C.y += 6;
  }

  bottomAction(G.back || '返回', closeGallery, { primary: true });
}

/* 图鉴 · 单个人物资料（点已解锁的卡片进入） */
function drawGalleryDetail() {
  var G = galleryText();
  var T = tset('profile') || {};
  var doc = engine.partnerById(galleryPickId);
  var rec = gallery.record(galleryPickId);

  C.y = SAFE_TOP + 16 + TOP_INSET;
  section(G.detailTitle || '图鉴资料', null);

  if (!doc || !rec) {
    C.y = R.drawWrapped(ctx, G.notMet || '还没解锁', PAD, C.y + 10, W - PAD * 2, LINEH, P.text2, 14);
    bottomAction(G.back || '返回', backFromGalleryDetail, { primary: true });
    return;
  }

  var who = engine.hydratePartner(doc);

  /* 大头像 + 姓名 + 一句话简介 */
  var size = 92;
  drawRoleAvatar(art.partnerImg(who.job, who.gender, who.avatar), W / 2, C.y + size / 2 + 4, size, 'TA');
  C.y += size + 22;
  centerText(who.name || '', W / 2, C.y, 20, P.text1, true);
  C.y += 22;
  if (who.tagline) {
    R.setFont(ctx, 12, false);
    ctx.fillStyle = P.text2;
    C.y = R.drawWrapped(ctx, '「' + who.tagline + '」', PAD, C.y + 12, W - PAD * 2, 18, P.text2, 12);
    C.y += 8;
  }

  /* ---- 达成的进展 ---- */
  R.setFont(ctx, 12, true);
  ctx.fillStyle = P.text3;
  ctx.fillText(G.progressTitle || '达成的进展', PAD, C.y + 12);
  C.y += 18;

  var stageTxt = galleryStageLabel(rec.stage);
  var badges = [stageTxt];
  if (rec.child && G.child) badges.push(G.child);

  /* 先算好要画几行（阶段徽标 + 元信息），再按实际行数定卡片高度，
   * 否则元信息会溢出卡片、和下面「资料行」贴在一起。 */
  var meta = [];
  if (rec.firstDay) meta.push(fmt(G.firstDay || '首次遇见 · 第 {day} 天', { day: rec.firstDay }));
  if (rec.lastDay && rec.lastDay !== rec.firstDay) {
    meta.push(fmt(G.lastDay || '最近见面 · 第 {day} 天', { day: rec.lastDay }));
  }
  if (rec.aff > 0) meta.push(fmt(G.peakAff || '好感度峰值 {n}', { n: rec.aff }));

  var padX = 14, padY = 12, lineH = 20, metaH = 17;
  R.setFont(ctx, 15, true);
  var wl = R.wrapText(ctx, badges.join(' · '), W - PAD * 2 - padX * 2);
  var boxH = padY * 2 + wl.length * lineH + meta.length * metaH;

  R.fillRoundRect(ctx, PAD, C.y, W - PAD * 2, boxH, 12, '#eef6f1');
  R.roundRectPath(ctx, PAD, C.y, W - PAD * 2, boxH, 12);
  ctx.strokeStyle = P.up;
  ctx.lineWidth = 1;
  ctx.stroke();

  R.setFont(ctx, 15, true);
  ctx.fillStyle = P.up;
  var yy = C.y + padY + 15;
  wl.forEach(function (l) { ctx.fillText(l, PAD + padX, yy); yy += lineH; });

  R.setFont(ctx, 11, false);
  ctx.fillStyle = '#3f6b55';
  meta.forEach(function (m) {
    ctx.fillText(m, PAD + padX, yy);
    yy += metaH;
  });

  C.y += boxH + 14;

  /* ---- 资料行 ---- */
  var rows = [
    [T.age, who.age ? fmt(G.age || '{n}岁', { n: who.age }) : ''],
    [G.job || '职业', [who.job, who.jobNote].filter(function (s) { return s; }).join(' · ')],
    [G.trait || '性格', [who.trait, who.traitDesc].filter(function (s) { return s; }).join(' —— ')],
    [G.personality || '人格', [who.personality, who.personalityDesc].filter(function (s) { return s; }).join(' —— ')],
    [G.condition || '家庭', [who.condition, who.conditionDesc].filter(function (s) { return s; }).join(' —— ')],
    [G.look || '外形', who.look || ''],
    [G.hobby || '爱好', who.hobby || ''],
    [G.place || '认识方式', who.place || ''],
    [G.looks || '颜值', who.looks != null ? String(who.looks) : ''],
    [G.family || '家境', who.family != null ? String(who.family) : '']
  ];
  rows.forEach(function (r) {
    if (!r[0] || !r[1]) return;
    R.setFont(ctx, 12, true);
    ctx.fillStyle = P.text3;
    ctx.fillText(r[0], PAD, C.y + 12);
    C.y = R.drawWrapped(ctx, r[1], PAD + 56, C.y + 12, W - PAD * 2 - 56, 18, P.text1, 13);
    C.y += 8;
  });

  bottomAction(G.back || '返回', backFromGalleryDetail, { primary: true });
}

/* ================= 结算 ================= */
/* 属性中文标签（取自 stat_defs，避免渲染层硬编码） */
function statLabel(key) {
  var defs = tset('stat_defs') || [];
  for (var i = 0; i < defs.length; i++) {
    if (defs[i].key === key) return defs[i].label;
  }
  return key;
}

/* 属性变化标签文本（纯函数，便于测试）
 * 数值取绝对值，符号统一由 +/- 前缀给出。
 * 旧版负数分支只拼了空格，导致「健康 5」这种看不出增减的展示。 */
function deltaTagText(key, raw) {
  var v = Math.round(raw);
  var av = Math.abs(v);
  var mag = (key === 'money' && av >= 10000) ? engine.moneyText(av) : String(av);
  return statLabel(key) + (v > 0 ? ' +' : ' -') + mag;
}

/* 属性增减的「数值部分」（纯函数，便于测试）：+5 / -3 / +2.5万 */
function deltaValText(key, raw) {
  var v = Math.round(raw);
  var av = Math.abs(v);
  var mag = (key === 'money' && av >= 10000) ? engine.moneyText(av) : String(av);
  return (v > 0 ? '+' : '-') + mag;
}

/* 属性变化卡片：双列，每张 = 属性图标 + 名称 + 增减值（涨绿 / 跌红）。
 * 与选项卡片同一套语言（圆角浅底 + 细描边），并带错落入场动效。
 * opts.animBase 给出这批卡片在「本页卡片集合」里的起始序号（接在别的卡片之后）。
 * 无变化时什么都不画（保持原来的行为）。 */
function drawDeltaTags(d, startX, opts) {
  if (!d) return;
  opts = opts || {};
  var keys = ['money', 'affection', 'health', 'career', 'looks', 'family', 'mood'];
  var changed = [];
  keys.forEach(function (k) { if (d[k]) changed.push(k); });
  if (!changed.length) return;

  var gap = 12;
  var x0 = (startX === undefined) ? PAD : startX;
  var availW = W - PAD - x0;
  var colW = (availW - gap) / 2;
  var cardH = 40, rowGap = 10, animBase = opts.animBase || 0;
  var y0 = C.y;
  frameCards.delta += changed.length;

  changed.forEach(function (k, i) {
    var col = i % 2, row = Math.floor(i / 2);
    var x = x0 + col * (colW + gap);
    var y = y0 + row * (cardH + rowGap);
    var v = Math.round(d[k]);
    var up = v > 0;
    var meta = ATTR_META[k] || { icon: '•', bg: '#f3ece0' };
    var anim = opts.noAnim ? CARD_ANIM_NONE : cardAnim(animBase + i);
    var topY = y + (anim.dy || 0);
    if (anim.a < 1) { ctx.save(); ctx.globalAlpha = Math.max(0, anim.a); }

    R.fillRoundRect(ctx, x, topY, colW, cardH, 12, up ? '#e9f5ee' : '#fbebe9');
    R.roundRectPath(ctx, x, topY, colW, cardH, 12);
    ctx.strokeStyle = up ? '#cde8d9' : '#f2d5d2';
    ctx.lineWidth = 1;
    ctx.stroke();

    /* 图标盒 */
    var ib = 22;
    R.fillRoundRect(ctx, x + 10, topY + (cardH - ib) / 2, ib, ib, 7, meta.bg);
    R.setEmojiFont(ctx, 12); ctx.fillStyle = P.text2;
    var iw = ctx.measureText(meta.icon).width;
    ctx.fillText(meta.icon, x + 10 + ib / 2 - iw / 2, topY + cardH / 2 + 4);

    /* 名称（左） + 增减值（右对齐） */
    var base = topY + cardH / 2 + 5;
    R.setFont(ctx, 11); ctx.fillStyle = P.text2;
    ctx.fillText(statLabel(k), x + 10 + ib + 7, base);
    R.setFont(ctx, 14, true); ctx.fillStyle = up ? P.up : P.down;
    var vt = deltaValText(k, v);
    ctx.fillText(vt, x + colW - 10 - ctx.measureText(vt).width, base);

    if (anim.a < 1) ctx.restore();
  });

  var rows = Math.ceil(changed.length / 2);
  C.y = y0 + rows * cardH + (rows - 1) * rowGap + 12;
}

/* 属性变化卡片的整体高度（供浮窗提前量高，避免面板被撑破） */
function deltaCardsH(d) {
  if (!hasDelta(d)) return 0;
  var n = 0;
  ['money', 'affection', 'health', 'career', 'looks', 'family', 'mood'].forEach(function (k) {
    if (d[k]) n++;
  });
  var rows = Math.ceil(n / 2);
  return rows * 40 + (rows - 1) * 10 + 12;
}

function drawLog() {
  if (!S.log || !S.log.length) return;
  var title = txt('logTitle');
  var hint = txt('recentTap');
  var y0 = C.y;
  R.setFont(ctx, 12, true);
  ctx.fillStyle = P.text3;
  ctx.fillText(title, PAD, C.y + 10);
  if (hint) {
    R.setFont(ctx, 10, false);
    ctx.fillStyle = P.text3;
    ctx.fillText(hint, PAD + ctx.measureText(title).width + 12, C.y + 10);
  }
  C.y += 20;
  var items = S.log.slice(-5).reverse();
  items.forEach(function (l) {
    C.y = R.drawWrapped(ctx, '· 第' + l.day + '天　' + l.text, PAD, C.y + 6, W - PAD * 2, 18, P.text3, 12);
  });
  /* 整块可点：进「近期经历」页看事件 / 选择 / 结果 */
  buttons.push({
    x: PAD - 6, y: y0 - 4, w: W - PAD * 2 + 12, h: (C.y - y0) + 10,
    label: 'recent:open', onClick: openRecent
  });
}

/* ================= 提示条（发薪 / 分手 / 宽限 / 冷却） =================
 * 这些提示必须真的被玩家看见。早期版本是在这一帧里画完就立刻把标记清空，
 * 而主界面的属性动效每帧都会重绘 —— 提示实际只存在不到一帧，
 * 玩家根本看不到（「每 30 天结算收支的规则没生效」就是这么来的）。
 *
 * 现在的规则：
 *   · 引擎留下的 *Flash 标记只负责「入队」，读完即清（不重复播）；
 *   · 队列里的提示各自带存活时间，到期才消失，期间持续重绘；
 *   · 画在最上层的固定区（不吃滚动），任何页面都能看见。 */
var FLASH_MS = 3200;
var flashQueue = [];          // [{ icon, msg, color, until }]
var flashTimer = null;

function pushFlash(icon, msg, color) {
  flashQueue.push({ icon: icon, msg: msg, color: color, until: Date.now() + FLASH_MS });
  scheduleFlashTick();
}

function consumeFlashes() {
  if (!S) return;
  if (S.paydayFlash) {
    var f = S.paydayFlash;
    var netTxt = (f.net >= 0 ? '+' : '') + engine.moneyText(f.net);
    var msg = fmt(txt('paydayFlash'), { day: f.day, income: engine.moneyText(f.income), base: engine.moneyText(f.baseIncome), bonus: engine.moneyText(f.careerBonus), expense: engine.moneyText(f.expense), net: netTxt });
    pushFlash('📅', msg, P.warn);
    S.log.push({ day: S.day, text: fmt(txt('logPayday'), { v: netTxt }) });
    S.paydayFlash = null;
  }
  if (S.breakFlash) {
    var b = S.breakFlash;
    pushFlash('💔', b.title + '：' + (b.lines && b.lines[0] ? b.lines[0] : ''), P.down);
    S.log.push({ day: S.day, text: b.title });
    S.breakFlash = null;
  }
  /* 关系预警：对方还没走，只是已经到了边缘。
   * 提示条讲清楚「哪里出问题」，并写进「近期经历」——玩家回头还能查。 */
  if (S.leaveWarnFlash) {
    var lw = S.leaveWarnFlash;
    pushFlash('🚨', lw.text || lw.reason || '', P.warn);
    S.log.push({ day: S.day, text: lw.logText || lw.text || lw.reason || '' });
    S.leaveWarnFlash = null;
  }
  if (S.graceFlash) {
    var g = S.graceFlash;
    pushFlash('⏳', fmt(txt('graceFlash'), { reason: g.reason, n: g.amount }), P.up);
    S.log.push({ day: S.day, text: fmt(txt('logGrace'), { n: g.amount }) });
    S.graceFlash = null;
  }
  if (S.cooldownFlash) {
    var cf = S.cooldownFlash;
    pushFlash('💔', fmt(txt('cooldownFlash'), { together: cf.together, days: cf.days }), P.down);
    S.log.push({ day: S.day, text: fmt(txt('logCooldown'), { n: cf.days }) });
    S.cooldownFlash = null;
  }
}

/* 到期自动消失：到点重绘一次（重绘时会被清理掉） */
function scheduleFlashTick() {
  if (flashTimer) return;
  flashTimer = setTimeout(function () {
    flashTimer = null;
    var now = Date.now();
    var before = flashQueue.length;
    flashQueue = flashQueue.filter(function (x) { return x.until > now; });
    draw();
    if (flashQueue.length) scheduleFlashTick();
    else if (before !== flashQueue.length) { /* 已经重绘过，收工 */ }
  }, FLASH_MS + 40);
}

/* 固定层绘制：贴着底部操作区上方往上堆（没有底部按钮时贴着安全区） */
function drawFlashes() {
  if (!flashQueue.length) return;
  var now = Date.now();
  flashQueue = flashQueue.filter(function (x) { return x.until > now; });
  if (!flashQueue.length) return;

  var w = W - PAD * 2;
  var by = bottomActions.length && !styleOverlayOpen()
    ? H - SAFE_BOTTOM - BOTTOM_GAP - BAR_BTN_H - 14
    : H - SAFE_BOTTOM - 14;

  R.setFont(ctx, 12, true);
  for (var i = flashQueue.length - 1; i >= 0; i--) {
    var it = flashQueue[i];
    var lines = R.wrapText(ctx, it.icon + ' ' + it.msg, w - 22);
    var h = lines.length * LINEH + 18;
    by -= h;
    R.fillRoundRect(ctx, PAD, by, w, h, 12, '#fbf4e6');
    R.roundRectPath(ctx, PAD, by, w, h, 12);
    ctx.strokeStyle = it.color;
    ctx.lineWidth = 1;
    ctx.stroke();
    var yy = by + 16;
    for (var j = 0; j < lines.length; j++) {
      ctx.fillStyle = it.color;
      ctx.fillText(lines[j], PAD + 11, yy);
      yy += LINEH;
    }
    by -= 8;
  }
}

/* ================= 音乐开关浮窗（左上角 · 所有页面可见） =================
 * 圆角圆形浮窗：🔊 正在播放 / 🔇 已静音，点一下切换（偏好存本地，下次启动沿用）。
 * 画在固定层最上面，所以叠层 / 浮窗打开时它依然在，也依然点得到。
 * 内容页顶部统一预留 TOP_INSET（见 resetFrame），保证第一行文字不被它压住。 */
function drawMusicToggle() {
  if (scene === 'loading') return;   // 载入页什么都没有，浮窗也跟着藏起来
  var muted = audio.isMuted();
  var size = MUSIC_BTN;
  var x = PAD - 6;
  var y = SAFE_TOP + 6;

  R.fillRoundRect(ctx, x, y, size, size, size / 2, muted ? 'rgba(255,255,255,0.72)' : P.card);
  R.roundRectPath(ctx, x, y, size, size, size / 2);
  ctx.strokeStyle = muted ? '#ddd2c2' : P.line;
  ctx.lineWidth = 1;
  ctx.stroke();

  var icon = muted ? '🔇' : '🔊';
  R.setEmojiFont(ctx, 16);
  var iw = ctx.measureText(icon).width;
  ctx.fillStyle = muted ? P.text3 : P.text2;
  ctx.fillText(icon, x + size / 2 - iw / 2, y + size / 2 + 5);

  fixedButtons.push({
    x: x, y: y, w: size, h: size,
    label: muted ? '音乐 关' : '音乐 开',
    music: true,
    onClick: function () { audio.toggleMute(); draw(); }
  });
}

/* ================= 玩家操作 ================= */
function gotoSeek() { today.phase = 'seek'; today.pendingOption = null; scrollY = 0; draw(); }
function gotoUpgrade() { today.phase = 'upgrade'; today.pendingOption = null; scrollY = 0; draw(); }
function gotoDate() { today.phase = 'date'; today.pendingOption = null; scrollY = 0; draw(); }
function backToChoose() { today.phase = 'choose'; today.pendingOption = null; scrollY = 0; draw(); }
/* 打开交往风格叠层：只记 payload，**不改 phase** ——
 * 当前页继续照原样画在下面当背景，叠层浮在它上面。 */
function gotoStyle(action, payload) {
  today.stylePayload = { action: action, payload: payload };
  today.pendingOption = null;
  styleScroll = 0;
  scrollY = 0;
  draw();
}

/* 收起叠层（返回）：下层页面原样回来，不需要重新构造任何状态 */
function closeStyleOverlay() {
  if (!today) return;
  today.stylePayload = null;
  styleScroll = 0;
  stylePanel = null;
  clearPending();
  draw();
}

function pushRecent(ev) {
  S.recent.push(ev.id);
  if (S.recent.length > DB.num('RECENT_MAX', 6)) S.recent.shift();
}

function enterEvent(ev, action, opts) {
  opts = opts || {};
  // 防御：事件数据缺失时（云端数据不完整）安全退回行动菜单，避免崩溃卡死
  if (!ev || !ev.options || !ev.options.length) {
    today.phase = 'choose';
    today.event = null;
    scrollY = 0;
    draw();
    return;
  }
  pushRecent(ev);
  today.event = ev;
  today.costDays = engine.eventDays(ev, S);
  today.action = action;
  today.phase = 'event';
  today.pendingOption = null;
  today.resolved = false;      // 新事件：还没确认
  today.chosenLabel = null;
  /* 「近期经历」要记事件正文；选项在 chooseOption 里补上 */
  today.actMeta = { event: (ev.text || []).slice(), option: '' };
  /* 每进一次事件都重置，避免上一次初遇的旁白残留下来影响场景匹配 */
  today.introLines = opts.introLines || null;
  today.afterEvent = opts.afterEvent || null;
  scrollY = 0;
  draw();
}

function actLife() {
  enterEvent(engine.pickLifeEvent(S), 'life');
}
function actImprove() {
  enterEvent(engine.pickImproveEvent(S), 'improve');
}
function actRest() {
  S.mood = engine.clamp(S.mood + DB.num('REST_MOOD', 6), 0, 100);
  S.health = engine.clamp(S.health + DB.num('REST_HEALTH', 4), 0, 100);
  var lines = (tset('play') || {}).restLines.slice();
  var delta = { mood: DB.num('REST_MOOD', 6), health: DB.num('REST_HEALTH', 4) };
  var pen = engine.workdaySkipPenalty(S);
  if (pen) {
    lines.push(fmt(txt('restPenalty'), { job: S.jobName }));
    delta = mergeDelta(delta, pen);
  }
  today.costDays = engine.actionDays('rest', S);
  today.action = 'rest';
  today.result = { title: txt('restResultTitle'), lines: lines, delta: delta };
  today.actMeta = { event: lines.slice(), option: '' };
  S.log.push({ day: S.day, text: txt('logRest') });
  afterActionEnd();
}

function actSeek(id) {
  var r = engine.findDate(S, id);
  today.action = 'seek';
  today.costDays = r.days;
  today.costMoney = r.paid;
  today.result = { title: r.title, lines: r.lines, delta: r.delta || {} };
  var ch = null;
  DB.list('channels').forEach(function (c) { if (c.id === id) ch = c; });
  var chName = ch ? ch.name : '';
  if (r.ok && S.lead) {
    /* 相亲成功：结果页改用信封卡片展示对象信息（头像 + 姓名/职业/性格/家庭/条件），
     * 原来那段纯文字介绍交给卡片承担，只保留后续旁白。 */
    today.result.lead = S.lead;
    today.result.lines = (r.tail || []).slice();
    today.actMeta = { title: r.title, event: (r.tail || []).slice(), option: chName };
  } else {
    today.actMeta = { title: r.title, event: (r.lines || []).slice(), option: chName };
  }
  S.log.push({ day: S.day, text: fmt(r.ok ? txt('logSeekOk') : txt('logSeekFail'), { ch: chName }) });
  checkAndSetEnd();

  /* 「没找到合适的」：用二级浮窗弹出（背景图 + 结果，背景图预留位置），
   * 浮窗关闭后推进一天回到主界面；其余结算走独立的 done 页。 */
  if (!r.ok) {
    today.phase = 'done';
    openSeekFailModal(today.result);
    draw();
    return;
  }
  today.phase = 'done';
  scrollY = 0;
  draw();
}

function actMeet() { gotoStyle('meet', null); }

function pickStyle(styleId) {
  // 防御：payload 已丢失（如上一次事件加载异常中断），安全退回行动菜单而非崩溃
  if (!today || !today.stylePayload) {
    today.phase = 'choose';
    today.stylePayload = null;
    today.pendingOption = null;
    scrollY = 0;
    draw();
    return;
  }
  S.courtStyle = styleId;
  var sp = today.stylePayload;
  today.stylePayload = null;      // 收起叠层
  styleScroll = 0;
  stylePanel = null;
  var N_ = DB.text('narratives') || {};
  if (sp.action === 'meet') {
    var r = engine.firstMeet(S);
    if (!r || !r.partner) { backToChoose(); return; }
    today.costDays = r.days;
    var ev = engine.pickMeetingEvent(S);
    var introLines = N_.meet_intro.map(function (l) {
      return engine.fillText(l, S, { name: r.partner.name, place: r.place });
    });
    var style = null;
    DB.list('court_styles').forEach(function (st) { if (st.id === styleId) style = st; });
    if (style && style.seeMore) {
      introLines.push(engine.fillText(N_.meet_see_more, S, { looks: r.partner.looks, family: r.partner.family }));
    }
    /* 见面前在微信上攒下的好感：折算成印象分并明说一句，玩家知道那段聊天没白聊 */
    if (r.chatBonus > 0 && N_.meet_chat_bonus) {
      introLines.push(engine.fillText(N_.meet_chat_bonus, S, { name: r.partner.name }));
    }
    enterEvent(ev, 'meet', { introLines: introLines, afterEvent: 'endMeet' });
  } else if (sp.action === 'date') {
    var rd = engine.goDate(S, sp.payload);
    if (!rd || !rd.event) { backToChoose(); return; }
    today.costDays = rd.days;
    today.costMoney = rd.paid;
    today.actionDelta = rd.delta;
    today.note = rd.note;
    today.dateType = rd.type.id;
    enterEvent(rd.event, 'date');
  }
  var stName = '';
  DB.list('court_styles').forEach(function (st) { if (st.id === styleId) stName = st.name; });
  S.log.push({ day: S.day, text: fmt(txt('logStyle'), { style: stName }) });
}

function actConfess() {
  var r = engine.doConfess(S);
  today.costDays = engine.actionDays('confess', S);
  today.action = 'confess';
  today.result = { title: r.title, lines: r.lines, delta: r.delta || {} };
  today.actMeta = { event: (r.lines || []).slice(), option: '' };
  S.log.push({ day: S.day, text: r.ok ? txt('logConfessOk') : (r.breakup ? txt('logConfessBreak') : txt('logConfessZero')) });
  afterActionEnd();
}
function actPropose() {
  var r = engine.doPropose(S);
  today.costDays = engine.actionDays('propose', S);
  today.costMoney = r.paid || 0;
  today.action = 'propose';
  today.result = { title: r.title, lines: r.lines, delta: r.delta || {} };
  today.actMeta = { event: (r.lines || []).slice(), option: '' };
  S.log.push({
    day: S.day,
    text: r.ok ? txt('logMarry') : (r.breakup ? txt('logProposeBreak') || txt('logBreakup') : txt('logProposeFail'))
  });
  afterActionEnd();
}
function actBreakup() {
  var r = engine.doBreakup(S, null);
  today.costDays = engine.actionDays('breakup', S);
  today.action = 'breakup';
  today.result = { title: r.title, lines: r.lines, delta: r.delta };
  today.actMeta = { event: (r.lines || []).slice(), option: '' };
  S.log.push({ day: S.day, text: txt('logBreakup') });
  afterActionEnd();
}
function actChild() {
  var r = engine.doChild(S);
  today.costDays = engine.actionDays('child', S);
  today.costMoney = r.paid || 0;
  today.action = 'child';
  today.result = { title: r.title, lines: r.lines, delta: r.delta || {} };
  today.actMeta = { event: (r.lines || []).slice(), option: '' };
  S.log.push({ day: S.day, text: r.ok ? txt('logChildOk') : txt('logChildWait') });
  afterActionEnd();
}
function actOvertime() {
  var r = engine.doOvertime(S);
  today.action = 'overtime';
  today.costDays = r.days;
  today.costMoney = 0;
  today.result = { title: txt('overtimeTitleResult'), lines: r.lines, delta: r.delta };
  today.actMeta = { event: (r.lines || []).slice(), option: '' };
  S.log.push({ day: S.day, text: fmt(txt('logOvertime'), { v: engine.moneyText(r.amount) }) });
  afterActionEnd();
}

function mergeDelta(a, b) {
  var out = {};
  ['money', 'affection', 'health', 'career', 'looks', 'family', 'mood'].forEach(function (k) {
    out[k] = (a[k] || 0) + (b[k] || 0);
  });
  return out;
}

function maybePartnerLeaves() {
  var leave = engine.checkPartnerLeave(S);
  if (!leave) return null;
  /* 两段式的第一段：只是预警，不分手。
   * 挂到闪一下的提示条上，并写进日志 —— 玩家要能看见「再不管就要出事」，
   * 否则「先预警后分手」就只是把随机数藏起来了，等于没做。 */
  if (leave.warn) {
    S.leaveWarnFlash = leave;
    return null;
  }
  S.breakFlash = leave;
  S.log.push({ day: S.day, text: leave.title });
  /* 对方主动提分手（被分手）也是关键事件，用同一套浮窗强调 */
  openKeyModal({ title: leave.title, lines: leave.lines || [], delta: leave.delta || {} }, 'breakup');
  return leave;
}

function checkAndSetEnd() {
  var e = engine.checkEnd(S);
  if (e) { S.over = true; S.ending = e; }
}

/* ---------------- 偶遇 ----------------
 * 「其余安排」里的生活 / 提升 / 加班 / 休息，也有小概率认识一个能接触的人。
 * 命中后把人写进 S.lead（引擎负责），并把说明挂到本次结算上，
 * 结算页会画出一张偶遇卡片（头像 + 姓名职业 + 后续提示）。 */
function maybeEncounter(action) {
  if (!S || S.over || !today) return;
  var ec = engine.tryChanceEncounter(S, action);
  if (!ec || !ec.partner) return;
  if (!today.result) today.result = { title: '', lines: [], delta: {} };
  var lines = (today.result.lines || []).slice();
  lines.push('', '◆ ' + ec.title);
  if (ec.intro) lines.push(ec.intro);
  today.result.lines = lines;
  today.result.encounter = { partner: ec.partner, tail: ec.tail };
  S.log.push({ day: S.day, text: ec.title });
}

/* 结算页里的偶遇卡片 */
function drawEncounterCard(ec) {
  var who = ec && ec.partner;
  if (!who) return;
  var size = 56;
  var pad = 12;
  var x = PAD;
  var w = W - PAD * 2;
  var y = C.y + 6;
  var h = size + pad * 2;

  R.roundRectPath(ctx, x, y, w, h, 14);
  ctx.fillStyle = P.tagBg;
  ctx.fill();
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  ctx.stroke();

  var av = art.partnerImg(who.job, who.gender, who.avatar);
  drawRoleAvatar(av, x + pad + size / 2, y + pad + size / 2, size, (who.name || '?').slice(0, 1));

  var tx = x + pad + size + 12;
  var tw = w - (tx - x) - pad;
  R.setFont(ctx, 15, true);
  ctx.fillStyle = P.text1;
  ctx.fillText(who.name || '', tx, y + pad + 18);
  R.setFont(ctx, 12, false);
  ctx.fillStyle = P.text2;
  var meta = [who.job, who.age ? (who.age + '岁') : ''].filter(function (s) { return s; }).join(' · ');
  ctx.fillText(meta, tx, y + pad + 36);

  C.y = y + h;
  if (ec.tail) {
    C.y = R.drawWrapped(ctx, ec.tail, x + pad, C.y + 2, w - pad * 2, 18, P.text2, 12);
  }
  C.y += 10;
}

function afterActionEnd() {
  maybeEncounter(today && today.action);
  maybePartnerLeaves();
  checkAndSetEnd();
  today.phase = 'done';
  scrollY = 0;
  /* 关键事件（告白 / 求婚 / 主动分手）以二级浮窗弹出，强调这是一件大事 */
  if (today.result && keyResultActions().indexOf(String(today.action || '')) >= 0) {
    openKeyModal(today.result, today.action);
  }
  draw();
}

function chooseOption(i) {
  var opt = today.event.options[i];
  var ev = today.event;
  today.pendingOption = null;
  var REL_AMP = DB.num('RELATION_AFF_AMP', 1.6);
  var amp = (ev.phase === 'meeting' || ev.phase === 'talking' || ev.phase === 'dating' || ev.phase === 'married') ? REL_AMP : 1;
  if (today.action === 'date' && today.dateType) {
    var dt = null;
    DB.list('date_types').forEach(function (t) { if (t.id === today.dateType) dt = t; });
    if (dt) amp *= dt.affMult || 1;
  }
  var lines = [];
  var delta = {};

  if (opt.breakup) {
    var br = engine.doBreakup(S, opt.result);
    lines = [opt.result, '【' + br.title + '】'].concat(br.lines);
    delta = br.delta;
  } else {
    var res = engine.applyFx(S, opt.fx, amp);
    lines = [opt.result];
    delta = res.delta;

    var risk = engine.applyStyleRisk(S);
    if (risk) { lines.push('', risk.text); delta = mergeDelta(delta, risk.delta); }

    if (amp > 1 && opt.fx && opt.fx.affection < 0) {
      lines.push('', txt('affDropHint'));
    }

    var br2 = engine.checkBreakup(S);
    if (br2) {
      lines.push('', '【' + br2.title + '】');
      br2.lines.forEach(function (l) { lines.push(l); });
      if (br2.delta) delta = mergeDelta(delta, br2.delta);
    }

    if (today.afterEvent === 'endMeet' && S.relationship === 'meeting') {
      var em = engine.endMeet(S);
      lines.push('', '◆ ' + em.title);
      em.lines.forEach(function (l) { lines.push(l); });
      if (em.delta) delta = mergeDelta(delta, em.delta);
    }
  }

  if (today.action === 'improve' || today.action === 'rest') {
    var pen = engine.workdaySkipPenalty(S);
    if (pen) {
      lines.push('', fmt(txt('improvePenalty'), { job: S.jobName }));
      delta = mergeDelta(delta, pen);
    }
  }

  if (!opt.breakup) {
    var leave = maybePartnerLeaves();
    if (leave) {
      lines.push('', '【' + leave.title + '】');
      leave.lines.forEach(function (l) { lines.push(l); });
      delta = mergeDelta(delta, leave.delta);
    }
  }

  S.log.push({ day: S.day, text: opt.label });
  if (today.actionDelta) delta = mergeDelta(delta, today.actionDelta);
  today.result = { title: '▸ ' + opt.label, lines: lines, delta: delta };
  today.actMeta = today.actMeta || {};
  today.actMeta.option = opt.label;
  maybeEncounter(today.action);
  checkAndSetEnd();
  /* 结果不跳页：留在事件页、原选项区域展示（头部头像与背景继续保留）。
   * 玩家点底部「继续」才推进时间回主界面。 */
  today.chosenLabel = opt.label;
  today.resolved = true;
  pendingKey = null;
  pendingAction = null;
  scrollY = 0;
  saveGame();
  draw();
}

function continueDay() {
  /* 回到主界面前，先把本次结算的属性变化记下来，主界面上会动态飘出 */
  var d = today && today.result && today.result.delta;
  if (d) {
    startStatFlash(d);        // 主界面上飘出 +/-
    /* 存进历史，「近期变化」页要用：带上关键事件标题 */
    recordStatHistory(d, (today.result && today.result.title) || '');
  }
  recordAct();                // 「近期经历」：事件 / 选择 / 结果

  if (S.over) { renderEnd(); return; }
  if (engine.advanceDays(S, today.costDays)) { renderEnd(); return; }
  var leave = maybePartnerLeaves();
  /* 对方主动提分手（被分手）也弹浮窗：浮窗关闭后再建新的一天，
   * 否则这里直接 newDay() 会让「继续」再推进一天，等于白跳一天。 */
  if (leave && keyModalOpen()) {
    keyModalResume = finishNewDay;
    return;
  }
  finishNewDay();
}

/* 结算后真正开始新的一天（建日 + 可能的主动微信 / 随机事件） */
function finishNewDay() {
  today = newDay();

  /* 非单身时，对方有一定概率当天主动发来微信（PARTNER_CHAT_RATE）。
   * 主动聊完这一整天就过去了，玩家没有机会再挑行动 ——
   * 也就是「触发后跳过当天的事件选择」。 */
  if (engine.rollProactiveChat(S)) {
    openChat(true);
    return;
  }

  if (Math.random() < DB.num('RANDOM_EVENT_CHANCE', 0.2)) {
    triggerRandomEvent();
    return;
  }
  scrollY = 0;
  saveGame();
  draw();
}

/* ---------------- 属性变化动效 ----------------
 * 结算后回到主界面时：
 *   · 属性条从「结算前」平滑滑到「结算后」，变化的那一段用涨/跌色标出来；
 *   · 数值跟着滚动；条上方还会飘出「+5 / -3」并淡出。
 * 让玩家一眼看到这次行动带来了什么、涨跌了多少。
 *
 * 快照 from/to 都在这里算：from = to - delta，不引入任何随机浮动。 */
var STAT_ANIM_MS = 900;      // 属性条滑到新值的时长
var STAT_FLASH_MS = 2000;    // 整段动效总时长（含飘字淡出）
var statFlash = { delta: null, from: null, to: null, t0: 0, timer: null };

function startStatFlash(delta) {
  var from = {}, to = {}, any = false;
  Object.keys(delta || {}).forEach(function (k) {
    var dv = Math.round(delta[k] || 0);
    if (!dv) return;
    any = true;
    to[k] = Math.round(S[k] || 0);
    from[k] = to[k] - dv;
  });
  if (!any) return;
  if (statFlash.timer) clearInterval(statFlash.timer);
  statFlash = { delta: delta, from: from, to: to, t0: Date.now(), timer: null };
  statFlash.timer = setInterval(function () {
    if (Date.now() - statFlash.t0 >= STAT_FLASH_MS) {
      clearInterval(statFlash.timer);
      statFlash = { delta: null, from: null, to: null, t0: 0, timer: null };
    }
    draw();
  }, 60);
}

/* 飘字用的整体进度 0→1；未激活返回 -1 */
function statFlashProgress() {
  if (!statFlash.delta) return -1;
  var p = (Date.now() - statFlash.t0) / STAT_FLASH_MS;
  return p >= 1 ? -1 : p;
}

/* 属性条用的动效状态：{ from, to, dir, e }（e 为缓出后的进度）；未激活返回 null */
function statFlashAnim(key) {
  if (!statFlash.to || !(key in statFlash.to)) return null;
  var e = (Date.now() - statFlash.t0) / STAT_ANIM_MS;
  if (e > 1) e = 1;
  return {
    from: statFlash.from[key],
    to: statFlash.to[key],
    dir: statFlash.to[key] >= statFlash.from[key] ? 1 : -1,
    e: easeOutCubic(e)
  };
}

function triggerRandomEvent() {
  var ev = engine.pickLifeEvent(S);
  enterEvent(ev, 'life', { introLines: [txt('randomIntro')] });
}

/* ================= 重开 ================= */
function restartAsk() { today.confirmRestart = true; scrollY = 0; draw(); }
function restartCancel() { today.confirmRestart = false; draw(); }
function restartNow() { clearSave(); gotoTitle(); }

/* 结局「为什么」：原因由引擎给出结构化数据（key + 数值），文案模板取自 texts.end.reasons */
function endReasonText(e) {
  var E = tset('end') || {};
  var tpls = E.reasons || {};
  var r = e && e.reason;
  var key = (r && r.key) || 'unknown';
  var tpl = tpls[key] || tpls.unknown || '';
  if (!tpl) {
    // 数据缺失时明确提示，方便定位是云端 texts 没更新（而不是代码问题）
    console.warn('[相亲模拟器] 结局原因文案缺失：texts 集合里找不到 end.reasons.' + key +
      '。请重新导入 db/export/import/texts.json（已有文档要用 Upsert/覆盖，不能只 Insert）');
    return '';
  }
  return fmt(tpl, (r && r.vars) || {});
}

function drawEndReason(e, E) {
  var text = endReasonText(e);
  if (!text) return;
  var win = e && e.type === 'win';
  var padX = 14, padY = 12;
  var textW = W - PAD * 2 - padX * 2;

  R.setFont(ctx, 13);
  var lines = R.wrapText(ctx, text, textW - 22);
  var boxH = padY * 2 + 20 + lines.length * 20;

  var x = PAD, y = C.y;
  R.fillRoundRect(ctx, x, y, W - PAD * 2, boxH, 12, win ? '#eef6f0' : '#fbf0ee');
  R.roundRectPath(ctx, x, y, W - PAD * 2, boxH, 12);
  ctx.strokeStyle = win ? P.up : P.down;
  ctx.lineWidth = 1;
  ctx.stroke();

  /* 左侧竖条强调 */
  ctx.fillStyle = win ? P.up : P.down;
  ctx.fillRect(x, y + 10, 3, boxH - 20);

  var yy = y + padY;
  R.setFont(ctx, 12, true);
  ctx.fillStyle = win ? P.up : P.down;
  ctx.fillText(E.reasonTitle || '为什么', x + padX, yy + 12);
  yy += 20;

  R.setFont(ctx, 13);
  ctx.fillStyle = P.text1;
  for (var i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x + padX, yy + 12);
    yy += 20;
  }
  C.y = y + boxH + 16;
}

/* ================= 结局 ================= */
/* 进结局页。endingId 可选（测试 / 调试用：直接看某个结局的样子），
 * 正式流程里由 continueDay 无参调用。 */
function renderEnd(endingId) {
  if (endingId) {
    var e = DB.list('endings').filter(function (x) { return x.id === endingId; })[0];
    if (e) { S.ending = e; S.over = true; }
  }
  /* 对局已结束 → 立刻清掉存档：否则从结局页直接关掉小游戏（或点「回到标题」）后，
   * 「继续游戏」仍然存在，读档会恢复到死亡属性下的「僵尸局」，而结局页本身不再重现。
   * 广告奖励存在另一个 key，不受影响。 */
  clearSave();
  scene = 'end';
  scrollY = 0;
  draw();
}

function drawEnd() {
  var E = tset('end') || {};
  var e = currentEnding();
  var win = e.type === 'win';

  /* 内容从结局插画（固定在顶部，见 drawEndHeader）下方开始 */
  C.y = SAFE_TOP + END_HEAD_H + 14;
  R.setFont(ctx, 22, true);
  var tc = win ? P.up : P.down;
  C.y = R.drawWrapped(ctx, e.title || '', PAD, C.y, W - PAD * 2, 30, tc, 22, true);
  C.y += 14;

  if (S.partner) {
    var relNames = tset('rel_names') || {};
    var size = 60;
    var cy = C.y + size / 2;
    drawRoleAvatar(art.heroImg(S.bg.id, S.gender), W / 2 - size - 24, cy, size, '我');
    drawRoleAvatar(art.partnerImg(S.partner.job, S.partner.gender, S.partner.avatar), W / 2 + size + 24, cy, size, 'TA');
    R.setFont(ctx, 13);
    ctx.fillStyle = P.accent;
    var rel = relNames[S.relationship] || '';
    ctx.fillText('· ' + rel + ' ·', W / 2 - ctx.measureText('· ' + rel + ' ·').width / 2, cy + 5);
    C.y = cy + size / 2 + 20;
  }

  /* 结局正文卡片：高度按「实际折行后的行数」算。
   * 固定高度会出事 —— 有的结局文案长，折行后能到 8 行，会溢出卡片、
   * 压到下面的「为什么」框上。 */
  var bodyW = W - PAD * 2 - CARD_PAD * 2;
  R.setFont(ctx, 15);
  var bodyLines = [];
  (e.lines || []).forEach(function (l) {
    R.wrapText(ctx, engine.fillText(l, S), bodyW).forEach(function (t) { bodyLines.push(t); });
  });
  var boxH = CARD_PAD * 2 + Math.max(1, bodyLines.length) * LINEH;
  R.fillRoundRect(ctx, PAD, C.y, W - PAD * 2, boxH, 14, P.card);
  var yy = C.y + CARD_PAD + 6;
  R.setFont(ctx, 15);
  ctx.fillStyle = P.text1;
  bodyLines.forEach(function (t) {
    ctx.fillText(t, PAD + CARD_PAD, yy);
    yy += LINEH;
  });
  C.y = C.y + boxH + 16;

  drawEndReason(e, E);

  var stats = [
    [E.days, S.day + ' 天'],
    [E.money, engine.moneyText(S.money)],
    [E.health, Math.round(S.health)],
    [E.career, Math.round(S.career)],
    [E.looks, Math.round(S.looks)],
    [E.family, Math.round(S.family)],
    [E.mood, Math.round(S.mood)],
    [E.goal, engine.goalName(S)]
  ];
  var colW = (W - PAD * 2) / 2;
  var cellH = 44;
  var startY = C.y;
  for (var i = 0; i < stats.length; i++) {
    var cx0 = PAD + (i % 2) * colW;
    var cy0 = startY + Math.floor(i / 2) * cellH;
    R.setFont(ctx, 11);
    ctx.fillStyle = P.text3;
    ctx.fillText(stats[i][0], cx0 + 10, cy0 + 16);
    R.setFont(ctx, 15, true);
    ctx.fillStyle = P.text1;
    ctx.fillText(String(stats[i][1]), cx0 + 10, cy0 + 36);
  }
  C.y = startY + Math.ceil(stats.length / 2) * cellH + 16;

  /* ---- 广告奖励说明 + 两个「再开一局」入口 ----
   * 两个入口并行、玩家自选（微信不允许把广告当继续游戏的强制门槛）：
   *   · 看广告 → 奖励记下来 → 下一局开局发放（不影响这一局已经展示的成绩）
   *   · 不看 → 直接重开，什么也不损失
   * 广告不可用（没配广告位 / 环境不支持 / 开关关掉）时只留「直接再开一局」。 */
  if (adEntryOpen()) {
    var moneyTxt = engine.moneyText(adRewardSpec().money);
    R.setFont(ctx, 11);
    ctx.fillStyle = P.text3;
    var hintTxt = fmt(E.adHint || '看完广告，下一局开局多 {money}', { money: moneyTxt });
    ctx.fillText(hintTxt, PAD + 2, C.y + 12);
    C.y += 26;
  }

  /* 「回到标题」收成内容区的小链接：底部要留两个「再开一局」入口，
   * 三个按钮挤在一行会放不下（375 宽屏每格只有 ~107px，文案要被截断）。 */
  smallLink(E.home || '回到标题', function () { scene = 'title'; scrollY = 0; draw(); });
  C.y += 34;

  if (adEntryOpen()) {
    bottomAction(fmt(E.againAd || '看广告 · +{money}', { money: engine.moneyText(adRewardSpec().money) }),
      watchAdAndRestart, { primary: true });
    bottomAction(E.again || '直接再开一局', restartNow);
  } else {
    bottomAction(E.again || '直接再开一局', restartNow, { primary: true });
  }
}

/* ================= 存档 ================= */
function saveGame() {
  try {
    if (!S) return;
    /* 相亲图鉴：把「当前正在接触 / 待见面的人」同步进跨局累计的收集记录。
     * 只写玩家进度，不涉及任何游戏数据（对象资料始终来自 partners 集合）。 */
    gallery.sync(S, S.day);
    var data = {
      v: 1,
      day: S.day, gender: S.gender,
      bgId: S.bg.id, goalId: S.goal.id, difficultyId: S.diff.id,
      seed: S.seed, courtStyle: S.courtStyle,
      money: S.money, health: S.health, career: S.career,
      looks: S.looks, family: S.family, mood: S.mood, affection: S.affection,
      relationship: S.relationship, partner: S.partner, lead: S.lead,
      flags: S.flags, singleStreak: S.singleStreak, singleLimit: S.singleLimit,
      /* relSpent 必须入档：分手心情三档靠「相处天数 + 关系内累计花费」定档，
       * 漏存会让读档后的分手永远退到最轻档（相处再久、花得再多也不算数）。 */
      relStartDay: S.relStartDay, relSpent: S.relSpent || 0, recent: S.recent, log: S.log.slice(-20),
      /* 对象主动分手的四个字段必须入档：
       * 漏存 leaveRollDay / leaveWarnDay / leaveStrikes 的话，读档就能把预警和宽容额度洗掉
       * ——玩家只要在每次「被预警」后重进游戏，就永远轮不到分手。 */
      partnerSinceDay: S.partnerSinceDay, leaveRollDay: S.leaveRollDay,
      leaveWarnDay: S.leaveWarnDay, leaveWarnReason: S.leaveWarnReason,
      leaveStrikes: S.leaveStrikes || 0,
      met: (S.met || []).slice(),
      /* 微信状态：总聊天次数 + 对方主动次数 + 是否被要求「当面见一面」 */
      chatCount: S.chatCount || 0,
      proactiveChats: S.proactiveChats || 0,
      mustDate: !!S.mustDate,
      history: (S.history || []).slice(-20),
      acts: (S.acts || []).slice(-10),
      today: today
    };
    wx.setStorageSync(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* ignore */ }
}

function loadGame() {
  try {
    var raw = wx.getStorageSync(SAVE_KEY);
    if (!raw) return null;
    var d = JSON.parse(raw);
    if (!d || d.v !== 1) return null;
    return d;
  } catch (e) { return null; }
}

function resumeGame(d) {
  S = engine.createGame(d.gender, d.bgId, d.goalId, d.seed, d.difficultyId);
  ['day', 'courtStyle', 'money', 'health', 'career', 'looks', 'family', 'mood', 'affection',
    'relationship', 'partner', 'lead', 'flags', 'singleStreak', 'singleLimit', 'relStartDay', 'relSpent',
    'partnerSinceDay', 'leaveRollDay', 'leaveWarnDay', 'leaveWarnReason', 'leaveStrikes',
    'recent', 'log', 'met', 'chatCount', 'proactiveChats', 'mustDate', 'history', 'acts']
    .forEach(function (k) {
      if (d[k] !== undefined) S[k] = d[k];
    });
  if (!S.history) S.history = [];   // 旧存档没有这个字段
  if (!S.acts) S.acts = [];         // 旧存档没有这个字段
  if (!S.met) S.met = [];           // 旧存档没有这个字段
  /* 旧存档只有 proactiveChats（当时只记对方主动的），折算成总次数的起点。
   * 不能直接清零 —— 那会让老存档的「必须约会」节奏倒退回起点。 */
  if (d.chatCount === undefined) S.chatCount = d.proactiveChats || 0;
  if (!S.proactiveChats) S.proactiveChats = 0;
  if (!S.mustDate) S.mustDate = false;
  /* 旧存档里的对象是「随机拼装」的，没有 id：
   * 图鉴只认数据库里有登记的人，这里补一次 id（按姓名匹配），补不上就当没解锁。 */
  [S.partner, S.lead].forEach(function (p) {
    if (!p || p.id) return;
    var list = DB.list('partners');
    for (var i = 0; i < list.length; i++) {
      if (list[i].name === p.name) { p.id = list[i].id; p.avatar = list[i].avatar; break; }
    }
  });
  today = d.today || newDay();
  if (today.pendingOption === undefined) today.pendingOption = null;
  if (today.resolved === undefined) today.resolved = false;   // 旧存档没有这个字段
  if (today.chosenLabel === undefined) today.chosenLabel = null;
  scene = 'play';
  scrollY = 0;
  draw();
}

function clearSave() {
  try { wx.removeStorageSync(SAVE_KEY); } catch (e) { /* ignore */ }
}

/* ================= 触摸 ================= */
var lastTouchY = 0;
var lastTouchX = 0;

/* 命中框是否等于当前按下框（驱动按钮的「按下」视觉反馈）。
 * 用坐标而非对象引用比对：draw() 每帧重建按钮对象，引用会失效，
 * 但布局稳定时命中框坐标不变。 */
function isPressed(x, y, w, h) {
  return !!(pressedBox && pressedBox.x === x && pressedBox.y === y &&
    pressedBox.w === w && pressedBox.h === h);
}

function findBtn(list, x, y) {
  for (var i = list.length - 1; i >= 0; i--) {
    var b = list[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

/* 在 (x,y) 处按下：若命中某按钮则记录按下框并重绘（显示按下态），不直接执行 */
function pressAt(x, y, list) {
  var b = findBtn(list, x, y);
  if (b) {
    pressedBox = { x: b.x, y: b.y, w: b.w, h: b.h };
    draw();
  }
  return b;
}

function onTouchStart(e) {
  var t = e.touches && e.touches[0];
  /* 第一次触摸即解锁音频（iOS 要求用户手势后才能播放），幂等无副作用 */
  audio.playBgm();
  if (!t) return;
  lastTouchY = t.clientY;
  lastTouchX = t.clientX;
  var tx = t.clientX, ty = t.clientY;

  /* 交往风格叠层是模态：只认叠层自己的按钮；
   * 落在面板列表区则记为「拖动面板」（不滚底下的页面）。 */
  if (styleOverlayOpen()) {
    touchInPanel = !!(stylePanel &&
      tx >= stylePanel.x && tx <= stylePanel.x + stylePanel.w &&
      ty >= stylePanel.viewTop && ty <= stylePanel.viewTop + stylePanel.viewH);
    pressAt(tx, ty, fixedButtons);
    return;
  }

  // 命中优先级：底部固定操作区 > 滚动内容；只记按下、不立即执行
  if (pressAt(tx, ty, fixedButtons)) return;
  pressAt(tx, ty - scrollY, buttons);
}

function onTouchMove(e) {
  var t = e.touches && e.touches[0];
  if (!t) return;
  var dy = t.clientY - lastTouchY;
  lastTouchY = t.clientY;

  /* 拖动超过阈值 → 视为滚动而非点击，取消按下态 */
  if (pressedBox) {
    var dx = t.clientX - (lastTouchX || t.clientX);
    if (Math.abs(dx) + Math.abs(dy) > 6) { pressedBox = null; draw(); }
  }

  /* 叠层打开时只滚面板内部，底下的页面不许跟着动 */
  if (styleOverlayOpen()) {
    if (touchInPanel && styleMaxScroll > 0) {
      var ns = Math.max(-styleMaxScroll, Math.min(0, styleScroll + dy));
      if (ns !== styleScroll) { styleScroll = ns; draw(); }
    }
    return;
  }

  var minY = Math.min(0, H - contentH - SAFE_TOP);
  var next = Math.max(minY, Math.min(0, scrollY + dy));
  if (next !== scrollY) {
    scrollY = next;
    draw();
  }
}

/* 松手：仅在松手点仍命中某按钮时执行它的 onClick（点击效果）。
 * pressedBox 只用于按下时的视觉反馈，这里靠「松手点重新命中」来判断，
 * 坐标转换（内容区要减去 scrollY）由 findBtn 各自处理，避免坐标系错配。 */
function onTouchEnd(e) {
  var t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
  var had = !!pressedBox;
  pressedBox = null;
  if (!t) return;
  var tx = t.clientX, ty = t.clientY;
  var b = null;
  if (styleOverlayOpen()) b = findBtn(fixedButtons, tx, ty);
  else b = findBtn(fixedButtons, tx, ty) || findBtn(buttons, tx, ty - scrollY);
  if (b && b.onClick) b.onClick();
  else if (had) draw();
}

/* ================= 对外启动 ================= */
function start(cv) {
  init(cv);
  draw();
}

module.exports = {
  start: start,
  goIntro: function () { startIntro(); },
  showError: showError,
  gotoTitle: gotoTitle,
  draw: draw,
  // 交互入口（供测试与扩展使用）
  startSetup: startSetup,
  setGender: setGender,
  setBg: setBg,
  setGoal: setGoal,
  setDifficulty: setDifficulty,
  beginGame: beginGame,
  actLife: actLife,
  actImprove: actImprove,
  actRest: actRest,
  actSeek: actSeek,
  actMeet: actMeet,
  gotoStyle: gotoStyle,
  pickStyle: pickStyle,
  actConfess: actConfess,
  actPropose: actPropose,
  actBreakup: actBreakup,
  actChild: actChild,
  actOvertime: actOvertime,
  chooseOption: chooseOption,      // 直接提交选择（测试 / 存档兼容）
  tapEventOption: tapEventOption,  // 选中某一项（再由 runPending 确认）
  runPending: runPending,          // 执行当前选中项（「确认」按钮）
  continueDay: continueDay,
  openPartnerProfile: openPartnerProfile,
  openStatDetail: openStatDetail,
  openRecent: openRecent,
  openChat: openChat,
  pickChatOption: pickChatOption,
  sendChat: sendChat,
  finishChat: finishChat,
  closeChat: closeChat,
  openGallery: openGallery,
  closeGallery: closeGallery,
  gallerySetTab: gallerySetTab,
  openGalleryDetail: openGalleryDetail,
  backFromGalleryDetail: backFromGalleryDetail,
  backToPlay: backToPlay,
  recordStatHistory: recordStatHistory,
  recordAct: recordAct,
  gotoSeek: gotoSeek,
  gotoUpgrade: gotoUpgrade,
  gotoDate: gotoDate,
  closeStyleOverlay: closeStyleOverlay,
  backToChoose: backToChoose,
  renderEnd: renderEnd,
  resumeGame: resumeGame,
  restartNow: restartNow,
  saveGame: saveGame,
  initAd: initAd,
  watchAdAndRestart: watchAdAndRestart,
  // 测试只读访问
  _state: function () { return { scene: scene, S: S, today: today, pick: pick, setupStep: setupStep, prevScene: PREV_SCENE, chat: chatState }; },
  _buttons: function () { return buttons; },
  _fixedButtons: function () { return fixedButtons; },
  /* 当前帧底部操作区配置（供布局审计动态判断底部条高度 / 是否「确认置顶」布局） */
  _bottomActions: function () { return bottomActions; },
  _barTop: function () { return barTopY; },
  /* 关键事件浮窗是否打开（供测试在结算后正确走「继续」：浮窗打开时
   * 唯一可点是浮窗内的「继续」，直接 continueDay 会留着浮窗盖住主界面） */
  _keyModalOpen: function () { return keyModalOpen(); },
  /* 寻找落空浮窗是否打开（供测试在结算后正确走「继续」） */
  _seekFailModalOpen: function () { return seekFailModalOpen(); },

  _pending: function () { return pendingKey; },
  _chat: function () { return chatState; },
  /* 广告入口状态（供测试断言：可用性 / 待发奖励 / 奖励数值） */
  _ad: function () {
    return {
      enabled: DB.num('AD_ENABLED', 1) === 1,
      available: ad.available(),
      entryOpen: adEntryOpen(),
      unitId: DB.num('AD_UNIT_ID', ''),
      reward: adRewardSpec(),
      pending: pendingAdReward()
    };
  },
  /* 结算页头部（告白 / 求婚）：on=是否展示 · scene=命中的场景 key · h=头部高度 */
  _resultHead: function () {
    return { on: resultHeadOn(), scene: resultSceneName(), h: resultHeadH() };
  },
  _gallery: function () { return gallery.load(); },
  _galleryTab: function () { return galleryTab; },
  _envelope: function () { return _lastEnvelope; },
  /* 行动二级页头部（寻找相亲机会 / 其余安排 / 约会档位）：kind=null 表示当前不在二级页 */
  _pageHead: function () {
    if (!today) return { kind: null, h: 0, title: '' };
    if (today.phase === 'seek') return { kind: 'seek', h: PAGE_HEAD_H, title: seekPageTitle() };
    if (today.phase === 'upgrade') return { kind: 'upgrade', h: PAGE_HEAD_H, title: txt('upgradePageTitle') };
    if (today.phase === 'date') {
      return { kind: 'date', h: PAGE_HEAD_H, title: fmt(txt('datePageTitle'), { name: S.partner ? S.partner.name : '' }) };
    }
    return { kind: null, h: 0, title: '' };
  },
  _transMs: function () { return TRANS_MS; },
  /* 结局页头部：on=是否展示 · art=命中的美术类型 · tag=压在图上小标签 · h=头部高度 */
  _endHead: function () {
    var E = tset('end') || {};
    if (scene !== 'end') return { on: false, art: null, tag: '', h: 0 };
    return { on: true, art: currentEnding().art || null, tag: E.headTag || '', h: END_HEAD_H };
  },
  /* 测试用：立刻结束属性飘字动效（否则飘字会压在属性值上，干扰布局回归） */
  _clearFlash: function () {
    if (statFlash.timer) clearInterval(statFlash.timer);
    statFlash = { delta: null, from: null, to: null, t0: 0, timer: null };
  },
  /* 测试用：清空提示条队列（发薪 / 分手…），避免常驻提示影响排版审计 */
  _clearFlashBar: function () {
    flashQueue = [];
    if (flashTimer) { clearTimeout(flashTimer); flashTimer = null; }
  },
  _flashQueue: function () { return flashQueue.slice(); },
  /* 交往风格叠层：open=是否浮出 · panel=面板几何 · scroll/maxScroll=面板内滚动 */
  _styleOverlay: function () {
    return { open: styleOverlayOpen(), panel: stylePanel, scroll: styleScroll, maxScroll: styleMaxScroll };
  },
  /* 页面过渡动效：默认关闭（测试要的是终态）；t 传时间戳可断言中间帧。
   * 关掉时把已经起跳的那一段也一起清掉，避免半透明残留到下一帧。 */
  _transOn: function (on) { transOn = !!on; if (!transOn) trans = null; return transOn; },
  _trans: function (now) { return transState(now === undefined ? Date.now() : now); },
  _startTrans: function (ageMs) { trans = { t0: Date.now() - (ageMs || 0) }; return transState(Date.now()); },
  _pageKey: function () { return pageKey(); },
  /* 本次事件是否与相亲对象有关（决定事件页头部画不画对方头像） */
  _eventPartnerShown: function () { return eventInvolvesPartner(); },
  /* ---------- 卡片动效（测试钩子，沿用 _startTrans / _setFlashProgress 的「手动拨表」风格） ---------- */
  /* 第 i 张卡片的动效状态：{ on, a, dy } */
  _cardAnim: function (i) { return cardAnim(i === undefined ? 0 : i); },
  /* 把「入场时间轴」拨到已过去 ageMs 毫秒（默认 0 = 刚开始），返回第 0 张的状态 */
  _cardEnter: function (key, ageMs) {
    cardEnterKey = (key === undefined ? '__test__' : key);
    cardEnterT0 = Date.now() - (ageMs || 0);
    return cardAnim(0);
  },
  /* 把「入场时间轴」往前拨 ageMs 毫秒（不改变当前指纹，用于驱动已开始的入场） */
  _ageCardEnter: function (ageMs) { cardEnterT0 = Date.now() - (ageMs || 0); return cardAnim(0); },
  /* 退场：返回是否「延后执行」（true = 正在播动画，cb 还没跑）；再配 _ageCardExit + _cardTick 收尾 */
  _cardExit: function (cb) {
    cardExitThen(cb || function () { });
    return cardExiting();
  },
  _ageCardExit: function (ageMs) { cardExitT0 = Date.now() - (ageMs || 0); return cardExiting(); },
  _cardExiting: function () { return cardExiting(); },
  _cardTick: function () { cardTick(); },
  _cardEnterKey: function () { return cardEnterKey; },
  _cardSig: function () { return cardSig(); },
  /* 本帧画了几张「旁白卡 / 属性变化卡」 */
  _frameCards: function () { return { note: frameCards.note, delta: frameCards.delta }; },
  /* 音乐浮窗（左上角全局控件）：位置 + 当前文案；没画返回 null */
  _musicBtn: function () {
    var bs = fixedButtons.filter(function (b) { return b.music; });
    return bs.length ? { x: bs[0].x, y: bs[0].y, w: bs[0].w, h: bs[0].h, label: bs[0].label } : null;
  },
  /* 测试只读：单条属性的动效中间态；未激活返回 null */
  _statFlashAnim: function (key) { return statFlashAnim(key); },
  /* 测试用：把动效时间轴拨到指定进度（0~1），断言动画中间帧而不依赖真实耗时 */
  _setFlashProgress: function (p) {
    if (!statFlash.to) return false;
    statFlash.t0 = Date.now() - p * STAT_ANIM_MS;
    return true;
  },
  _affectionSlot: function () { return statDefBySlot('partnerHeader'); },
  _playStatDefs: function () { return playStatDefs(); },
  startStatFlash: startStatFlash,
  deltaTagText: deltaTagText,
  deltaValText: deltaValText
};

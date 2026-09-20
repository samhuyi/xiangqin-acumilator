/* =========================================================
 * 真实点击链路测试（Node 环境，模拟 wx + Canvas）
 * ---------------------------------------------------------
 * 全程只通过「按钮 onClick」驱动（不直接调 actXXX / setXXX API），
 * 严格走「选中一项 → 点确认」的用户路径，验证：
 *   1. 每个选择界面都能找到可单选的选项
 *   2. 选中后都能找到可点的「确认」按钮，且点一次就生效
 *   3. 全流程不卡死，能一路走到结局
 *
 * 这个用例专门防「确认按钮点不动」这类回归：
 * 确认按钮若被二次确认包裹，第二次点击时 pendingAction 已被清空，
 * 会导致点了但永远不生效。
 *
 * 运行： node tools/click-smoke.js
 * ========================================================= */

'use strict';

var hm = require('./helpers/cloud-mock.js');
var DB = require('../js/db/repository.js');

var SEEDS = [42, 7, 99, 2026, 12345];

var storage = {};
var touchHandlers = {};
var cloudFixture = hm.loadCloudFixture();

global.wx = {
  getSystemInfoSync: function () {
    return {
      windowWidth: 375, windowHeight: 667, pixelRatio: 2,
      safeArea: { top: 0, bottom: 667, left: 0, right: 375, width: 375, height: 667 }
    };
  },
  onTouchStart: function (fn) { touchHandlers.start = fn; },
  onTouchMove: function (fn) { touchHandlers.move = fn; },
  onTouchEnd: function (fn) { touchHandlers.end = fn; },
  getStorageSync: function (k) { return storage[k] || ''; },
  setStorageSync: function (k, v) { storage[k] = v; },
  removeStorageSync: function (k) { delete storage[k]; },
  cloud: {
    init: function (opt) { global.wx.cloud._opt = opt; },
    database: function () {
      return {
        collection: function (name) {
          var st = { skip: 0, limit: hm.LIMIT };
          var api = {
            skip: function (s) { st.skip = s; return api; },
            limit: function (l) { st.limit = l; return api; },
            get: function () {
              var docs = cloudFixture[name] || [];
              return Promise.resolve({ data: docs.slice(st.skip, st.skip + st.limit) });
            }
          };
          return api;
        }
      };
    }
  }
};

function makeCtx() {
  var state = { fillStyle: '', strokeStyle: '', font: '', lineWidth: 1, globalAlpha: 1, lineCap: 'butt' };
  var noop = function () {};
  var ctx = {
    scale: noop, save: noop, restore: noop, translate: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    arc: noop, arcTo: noop, ellipse: noop, bezierCurveTo: noop, quadraticCurveTo: noop,
    fill: noop, stroke: noop, fillRect: noop, strokeRect: noop,
    clearRect: noop, clip: noop, rect: noop, setLineDash: noop, drawImage: noop,
    measureText: function (t) {
      var size = 15; var m = /(\d+)px/.exec(state.font); if (m) size = +m[1];
      return { width: String(t).length * size * 0.6 };
    },
    createLinearGradient: function () { return { addColorStop: noop }; },
    fillText: noop
  };
  ['fillStyle', 'strokeStyle', 'font', 'lineWidth', 'globalAlpha', 'lineCap'].forEach(function (k) {
    Object.defineProperty(ctx, k, { get: function () { return state[k]; }, set: function (v) { state[k] = v; } });
  });
  return ctx;
}
function makeCanvas() { var c = makeCtx(); return { width: 0, height: 0, getContext: function () { return c; } }; }

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function findBy(list, label) {
  return (list || []).filter(function (b) { return b.label === label; })[0];
}
function click(btn) { if (btn && btn.onClick) { btn.onClick(); return true; } return false; }

function runSeed(seed) {
  Math.random = mulberry32(seed);
  delete require.cache[require.resolve('../js/ui/render.js')];
  var render = require('../js/ui/render.js');
  render.start(makeCanvas());
  render._transOn(false);      // 过渡动效是观感层，测试要的是稳定的命中区
  render.startSetup();

  var visited = {};
  var steps = 0;
  var lastSig = '';
  var stuck = 0;
  var err = null;
  var navTurn = 0;          // 行动菜单的两个方向入口轮流点，两条支路都覆盖

  while (steps++ < 500) {
    var st = render._state();
    if (st.scene === 'end') break;

    var sig = st.scene + '|' + (st.today ? st.today.phase : '-') + '|' + S(st.pick) + '|' + (st.S ? st.S.day : 0) +
      '|' + (render._styleOverlay().open ? 'style' : '-');
    function S(p) { return p ? (p.gender + '/' + p.bgId + '/' + p.goalId) : ''; }
    if (sig === lastSig) {
      stuck++;
      if (stuck > 3) { err = '卡死在 ' + sig; break; }
    } else { stuck = 0; lastSig = sig; }

    if (st.scene === 'setup') {
      /* 设定是两页合并：第 0 页「性别 + 出身」、第 1 页「目标 + 难度」，
       * 每页都要「都选齐」才放行确认。所以每次只补一个还没选的分组，
       * 重绘后再看还差什么，直到底部的「确认 / 开始游戏」可点为止。 */
      var SETUP_FIELD = { gender: 'gender', bg: 'bgId', goal: 'goalId', diff: 'difficulty' };
      var done = false;
      for (var si = 0; si < 8 && !done; si++) {
        var pk = render._state().pick;
        var byGroup = {};
        render._buttons().forEach(function (b) {
          if (!b.setup) return;
          (byGroup[b.setup] = byGroup[b.setup] || []).push(b);
        });
        var next = null;
        ['gender', 'bg', 'goal', 'diff'].forEach(function (g) {
          if (next) return;
          var list = byGroup[g] || [];
          if (!list.length) return;
          var picked = list.some(function (b) { return pk[SETUP_FIELD[g]] === b.setupId; });
          if (!picked) next = list[0];      // 这一组还没选 → 选它第一项
        });
        if (next) click(next);
        var cf = findBy(render._fixedButtons(), '确认') ||
          findBy(render._fixedButtons(), '开始这段人生') ||
          findBy(render._fixedButtons(), '开始游戏');
        if (cf) { click(cf); done = true; }
      }
      if (!done) { err = 'setup 选不齐（确认始终不可点）'; break; }
      visited.setup = true;
      continue;
    }

    /* 对方主动发来的微信（非单身时每天有一定概率触发）：
     * 聊完这一整天就过去了，会自动跳过当天的行动选择。 */
    if (st.scene === 'chat') {
      if (st.chat && (st.chat.locked || st.chat.empty)) {
        var bk = render._fixedButtons()[0];
        if (!bk) { err = '被锁住 / 空题库的聊天页没有返回按钮'; break; }
        click(bk);
        continue;
      }
      var co = render._buttons().filter(function (b) { return b.selectable; })[0];
      if (!co) { err = '聊天页没有可单选的回复'; break; }
      click(co);
      var sc = findBy(render._fixedButtons(), '发送');
      if (!sc) { err = '聊天选中后没有「发送」按钮'; break; }
      click(sc);
      var fc = render._fixedButtons()[0];
      if (!fc) { err = '聊天结果页没有结束按钮'; break; }
      click(fc);
      visited.chat = true;
      continue;
    }

    /* 二次弹层（关键事件 / 寻找落空）：浮在主界面上接管交互，
     * 点掉它们的「继续」可能顺手把这一天推进完（closeSeekFailModal 会 continueDay），
     * 所以处理完必须重新开始一轮 —— 否则会拿这一轮的旧 phase 去点新页面的按钮。 */
    var modalHandled = false;
    var modalBtn = null;
    if (render._keyModalOpen && render._keyModalOpen()) {
      modalBtn = render._fixedButtons().filter(function (b) { return /^继续/.test(String(b.label)); })[0] ||
        render._fixedButtons()[0];
      if (!modalBtn) { err = '关键事件浮层没有可点的「继续」按钮'; break; }
      click(modalBtn); visited.keyModal = true; modalHandled = true;
    } else if (render._seekFailModalOpen && render._seekFailModalOpen()) {
      modalBtn = render._fixedButtons().filter(function (b) { return /^继续/.test(String(b.label)); })[0] ||
        render._fixedButtons()[0];
      if (!modalBtn) { err = '寻找落空浮层没有可点的「继续」按钮'; break; }
      click(modalBtn); visited.seekFail = true; modalHandled = true;
    }
    if (modalHandled) continue;

    if (st.scene !== 'play') { err = '意外场景 ' + st.scene; break; }

    /* 交往风格是叠层（浮在当前页上，不改 phase）：
     * 点一条风格 → 点叠层里的「确认」→ 直接进事件页。 */
    if (render._styleOverlay().open) {
      var row = render._fixedButtons().filter(function (b) { return /^style:/.test(String(b.label)); })[0];
      if (!row) { err = '交往风格叠层里没有可选风格'; break; }
      click(row);
      var scf = findBy(render._fixedButtons(), '确认');
      if (!scf) { err = '交往风格叠层里没有「确认」按钮'; break; }
      click(scf);
      visited.style = true;
      continue;
    }

    var phase = st.today.phase;
    if (phase === 'event') {
      if (st.today.resolved) {
        /* 结果就在事件页的选项区域展示（保留头像/背景），底部只有一个「继续」 */
        var contBtn = render._fixedButtons()[0];
        if (!contBtn) { err = '事件页内结果没有可点的继续按钮'; break; }
        click(contBtn);
        visited.done = true;
        continue;
      }
      var mo = render._buttons().filter(function (b) { return b.selectable; })[0];
      if (!mo) { err = '事件二级页没有选项'; break; }
      click(mo);
      var mc = findBy(render._fixedButtons(), '确认');
      if (!mc) { err = '事件二级页选中后没有可点的「确认」按钮'; break; }
      click(mc);
      if (!st.today.resolved) { err = '事件确认后没有在本页展示结果'; break; }
      visited.event = true;
    } else if (phase === 'done') {
      /* 一次结算可能有不止一层（浮窗 → 结算页 → 新的一天），
       * 每次都重新取当前按钮再点，不能拿旧按钮连点（旧回调会点到别的入口）。 */
      for (var di = 0; di < 3; di++) {
        var cont = render._fixedButtons()[0];
        if (!cont) { err = '结算二级页没有继续按钮'; break; }
        click(cont);
        var st2 = render._state();
        if (!st2.today || st2.today.phase !== 'done') break;
      }
      if (err) break;
      visited.done = true;
    } else if (phase === 'choose') {
      /* 行动菜单：两个「方向入口」现在是单选卡片（先点选一项，再由底部「确认」提交）。
       * 轮流选，让 seek / upgrade 两条支路都能被走到。 */
      var navs = render._buttons().filter(function (b) {
        return b.selectable && /寻找相亲机会|其余安排/.test(String(b.label));
      });
      if (navs.length !== 2) { err = 'choose 阶段方向入口应为 2 个，实际 ' + navs.length; break; }
      click(navs[navTurn++ % navs.length]);        // 选中方向卡片
      var cfNav = findBy(render._fixedButtons(), '确认');
      if (!cfNav) { err = 'choose 阶段选中方向后没有可点的「确认」按钮'; break; }
      click(cfNav);                                // 确认 → 进入对应二级页
      visited.choose = true;
    } else {
      var act = render._buttons().filter(function (b) { return b.selectable; })[0];
      if (!act) { err = phase + ' 找不到可单选的选项'; break; }
      click(act);
      var cf2 = findBy(render._fixedButtons(), '确认');
      if (!cf2) { err = phase + ' 选中后没有可点的「确认」按钮'; break; }
      click(cf2);
      visited[phase] = true;
    }
  }

  if (!err && render._state().scene !== 'end') err = '未走到结局（步数用尽）';
  return { seed: seed, steps: steps, paths: Object.keys(visited), err: err, ok: !err };
}

function main() {
  DB.load({ cloud: { env: 'cloud1-d7gwcey64cad30d91' } }).then(function (r) {
    if (r.source !== 'network') throw new Error('云端数据未就绪：' + JSON.stringify(r.problems));
    var allPaths = {};
    SEEDS.forEach(function (seed) {
      var res = runSeed(seed);
      res.paths.forEach(function (p) { allPaths[p] = true; });
      if (!res.ok) {
        console.error('  ✗ seed ' + seed + '：' + res.err);
        process.exit(1);
      }
      console.log('  ✓ seed ' + seed + '：' + res.steps + ' 步走到结局，路径 ' + res.paths.join('、'));
    });
    ['setup', 'choose', 'seek', 'upgrade', 'date', 'style', 'event', 'done'].forEach(function (p) {
      if (!allPaths[p]) console.log('  ⚠ 本次未覆盖路径：' + p);
    });
    console.log('  覆盖路径：' + Object.keys(allPaths).join('、'));
    console.log('CLICK SMOKE OK');
  }).catch(function (e) {
    console.error('  ✗ ' + (e && e.message));
    process.exit(1);
  });
}

main();

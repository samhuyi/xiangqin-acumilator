/* =========================================================
 * UI 冒烟测试（Node 环境，模拟 wx + Canvas）
 * ---------------------------------------------------------
 * 用 mock 的 wx 与 Canvas 上下文驱动渲染层，验证：
 *   1. 开场 → 标题 → 设定 → 开局 全链路
 *   2. 多回合行动/事件/结算/存档
 *   3. 触摸命中检测
 *
 * 运行： node tools/ui-smoke.js
 * ========================================================= */

'use strict';

var DB = require('../js/db/repository.js');
var hm = require('./helpers/cloud-mock.js');
var cm = require('./helpers/canvas-mock.js');

/* ---- mock wx ---- */
var storage = {};
var touchHandlers = {};
var cloudFixture = hm.loadCloudFixture();

/* 激励视频广告的假实现：测试里拨 adFake 就能控制「看没看完 / 拉不拉得起来」。
 * onClose 用同步回调（真机是异步的），这样断言不用等 tick，测试更稳。 */
var adFake = { isEnded: true, showFails: false, createThrows: false, instances: [] };

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
  /* 激励视频广告（结局页「看广告领奖励」）：
   * show() 成功时同步把 onClose 打一遍，isEnded 由 adFake 控制。 */
  createRewardedVideoAd: function (opt) {
    if (adFake.createThrows) throw new Error('广告位不存在');
    var listeners = [];
    var inst = {
      adUnitId: opt && opt.adUnitId,
      onClose: function (fn) { listeners.push(fn); },
      offClose: function (fn) { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); },
      load: function () { return Promise.resolve(); },
      show: function () {
        if (adFake.showFails) return Promise.reject(new Error('no fill'));
        listeners.slice().forEach(function (fn) { fn({ isEnded: adFake.isEnded }); });
        return Promise.resolve();
      }
    };
    adFake.instances.push(inst);
    return inst;
  },
  // 模拟云端数据库（唯一数据源）
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

var drawnTexts = [];
var textOps = [];           // 每次 fillText 的几何信息，供「文字不重叠」布局回归使用
var fillOps = [];           // 每次 fill() 的 {fill, alpha, x, y, w, h}，供属性条动效回归使用
var gradientCalls = 0;      // 记录线性渐变调用次数
/* 渐变填充的落点：用来区分「整屏蒙层」（标题页不该再有）与
 * 「按钮自身的边缘渐隐」（首页按钮要求这么做）。 */
var gradientFills = [];

function makeCtx() {
  var state = { fillStyle: '', strokeStyle: '', font: '', lineWidth: 1, globalAlpha: 1, lineCap: 'butt' };
  var noop = function () {};
  var stack = [];
  var box = null;           // 当前路径的包围盒（moveTo / lineTo / arcTo 都算）
  function mark(x, y) {
    if (typeof x !== 'number' || typeof y !== 'number') return;
    if (!box) box = { x0: x, y0: y, x1: x, y1: y };
    else {
      if (x < box.x0) box.x0 = x;
      if (y < box.y0) box.y0 = y;
      if (x > box.x1) box.x1 = x;
      if (y > box.y1) box.y1 = y;
    }
  }
  var ctx = {
    scale: noop, translate: noop, rotate: noop,
    /* save/restore 必须真的生效：属性条淡出用 globalAlpha，
     * 若 restore 是空操作，透明度会泄漏，断言就会失真。 */
    save: function () { stack.push({ fillStyle: state.fillStyle, strokeStyle: state.strokeStyle, font: state.font, lineWidth: state.lineWidth, globalAlpha: state.globalAlpha, lineCap: state.lineCap }); },
    restore: function () {
      var s = stack.pop();
      if (s) Object.keys(s).forEach(function (k) { state[k] = s[k]; });
    },
    beginPath: function () { box = null; },
    closePath: noop,
    moveTo: mark, lineTo: mark,
    arc: noop,
    arcTo: function (x1, y1, x2, y2) { mark(x1, y1); mark(x2, y2); },
    ellipse: noop,
    bezierCurveTo: noop, quadraticCurveTo: noop,
    fill: function () {
      if (box) fillOps.push({
        fill: state.fillStyle, alpha: state.globalAlpha,
        x: box.x0, y: box.y0, w: box.x1 - box.x0, h: box.y1 - box.y0
      });
    },
    stroke: noop, strokeRect: noop, strokeText: noop,
    fillRect: function (x, y, w, h) {
      var f = state.fillStyle;
      if (f && f._grad) gradientFills.push({ grad: f, rect: [x, y, w, h] });
    },
    /* 便于断言：拿渐变对象自己的停靠点 */
    clearRect: noop, clip: noop, rect: noop,
    setLineDash: noop, drawImage: noop,
    measureText: function (t) {
      var size = 15;
      var m = /(\d+)px/.exec(state.font);
      if (m) size = +m[1];
      return { width: cm.textWidth(t, size) };
    },
    createLinearGradient: function (x0, y0, x1, y1) {
      gradientCalls++;
      var g = { _grad: [x0, y0, x1, y1], stops: [] };
      g.addColorStop = function (off, color) { g.stops.push([off, color]); };
      return g;
    },
    fillText: function (t, x, y) {
      var size = 15;
      var m = /(\d+)px/.exec(state.font);
      if (m) size = +m[1];
      drawnTexts.push(String(t));
      textOps.push({
        text: String(t),
        x: (typeof x === 'number' ? x : 0),
        y: (typeof y === 'number' ? y : 0),
        size: size,
        w: cm.textWidth(t, size)
      });
    }
  };
  ['fillStyle', 'strokeStyle', 'font', 'lineWidth', 'globalAlpha', 'lineCap'].forEach(function (k) {
    Object.defineProperty(ctx, k, { get: function () { return state[k]; }, set: function (v) { state[k] = v; } });
  });
  return ctx;
}

function makeCanvas() {
  var ctx = makeCtx();
  return { width: 0, height: 0, getContext: function () { return ctx; } };
}

function tap(x, y) {
  var handler = touchHandlers.start;
  if (handler) handler({ touches: [{ clientX: x, clientY: y }] });
}

function assert(cond, msg) {
  if (!cond) throw new Error('断言失败: ' + msg);
  console.log('  ✓ ' + msg);
}

/* ---- 确定性随机数：让多回合推进可复现，避免偶发走不到「事件」阶段 ---- */
var RNG_SEED = parseInt(process.env.UI_SMOKE_SEED || '42', 10);
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
Math.random = mulberry32(RNG_SEED);

/* 结算后推进到第二天：
 * 关键事件（告白 / 求婚 / 分手 / 被分手）会以二级浮窗弹出，浮窗打开时
 * 唯一可点是浮窗内的「继续」——直接 continueDay 会留着浮窗盖住主界面、
 * 且不会关闭它（drawPlay 在浮窗打开时直接 return，菜单不会绘制）。
 * 所以这里优先点浮窗的「继续」（内部走到 continueDay / finishNewDay），
 * 没有浮窗时才直接 continueDay。 */
function advanceAfterResult(render, _depth) {
  _depth = _depth || 0;
  if (_depth > 24) { render.continueDay(); return; }   // 兜底，避免极端情况下死循环
  var st = render._state();
  if (render._keyModalOpen && render._keyModalOpen()) {
    var btn = render._fixedButtons().filter(function (b) {
      return b.label && b.label.indexOf('继续') >= 0;
    })[0];
    if (btn && typeof btn.onClick === 'function') { btn.onClick(); return advanceAfterResult(render, _depth + 1); }
  }
  if (render._seekFailModalOpen && render._seekFailModalOpen()) {
    var sbtn = render._fixedButtons().filter(function (b) {
      return b.label && b.label.indexOf('继续') >= 0;
    })[0];
    if (sbtn && typeof sbtn.onClick === 'function') { sbtn.onClick(); return advanceAfterResult(render, _depth + 1); }
  }
  /* 对方主动发来的微信：结算（如告白成功）后可能直接开聊，聊完才翻到新的一天。
   * 这里把这一整天推进掉，和在真实游戏里聊完点「发送」等价。 */
  if (st.scene === 'chat') {
    var co = render._buttons().filter(function (b) { return b.selectable; })[0];
    if (co && typeof co.onClick === 'function') co.onClick();
    var cs = render._fixedButtons()[0];
    if (cs && typeof cs.onClick === 'function') { cs.onClick(); return advanceAfterResult(render, _depth + 1); }
  }
  render.continueDay();
  /* continueDay 翻到新的一天时，可能立刻弹出「对方主动发来的微信」——
   * 这时候主界面还没回来，后面的菜单断言会全部落空，所以再推进一次。 */
  if (render._state().scene === 'chat') return advanceAfterResult(render, _depth + 1);
}

function main() {
  DB.load({ cloud: { env: 'cloud1-d7gwcey64cad30d91' } }).then(function (r) {
    if (r.source !== 'network') {
      throw new Error('云端数据未就绪：' + JSON.stringify(r.problems));
    }
    var render = require('../js/ui/render.js');
    render.start(makeCanvas());
    /* 页面过渡动效是「真机才有」的观感层：测试断言的是页面终态排版，
     * 开着动效会拿到「刚换页、整页还在上移 20px 且半透明」的中间帧。
     * 这里关掉，另有一节专门校验动效本身的数值。 */
    render._transOn(false);

    /* 页面按钮 = 固定层里去掉「左上角音乐浮窗」（它是全局控件，不参与页面交互断言） */
    var pageBtns = function () {
      return render._fixedButtons().filter(function (b) { return !b.music; });
    };

    render.goIntro();
    assert(render._state().scene === 'intro', '进入开场播片');
    render.gotoTitle();
    assert(render._state().scene === 'title', '进入标题页');

    // 设定流程（合并页）：性别 + 出身背景 在第 0 页；先验证「联动 + 都选才确认」
    render.startSetup();
    var findConfirm = function () {
      return render._fixedButtons().filter(function (b) {
        return b.label === '确认' || b.label === '开始游戏';
      })[0];
    };
    assert(render._state().setupStep === 0, '首屏是「性别 + 出身」合并页');
    var genderBtns = render._buttons().filter(function (b) { return b.setup === 'gender'; });
    assert(genderBtns.length === 2, '性别一行展示 2 个选项（男 / 女）');
    assert(!findConfirm(), '什么都没选时确认不可点');
    genderBtns[0].onClick();   // 选 男
    assert(render._state().pick.gender === 'm', '点击选中性别');
    var bgBtns = render._buttons().filter(function (b) { return b.setup === 'bg'; });
    assert(bgBtns.length > 0, '选了性别后出身背景联动出现');
    assert(!findConfirm(), '只选了性别、没选出身时确认仍不可点');
    genderBtns[0].onClick();   // 再点一次取消
    assert(render._state().pick.gender === null, '再点一次取消性别选中');
    assert(render._buttons().filter(function (b) { return b.setup === 'bg'; }).length === 0,
      '取消性别后出身背景联动收起');
    genderBtns[0].onClick();   // 重新选 男
    bgBtns = render._buttons().filter(function (b) { return b.setup === 'bg'; });
    bgBtns[0].onClick();       // 选第一个出身背景
    assert(render._state().pick.bgId != null, '选中出身背景');
    var cf = findConfirm();
    assert(!!cf, '性别 + 出身都选齐后底部出现可点的「确认」');
    cf.onClick();              // 确认 → 进入第 1 页（目标 + 难度）
    assert(render._state().setupStep === 1, '确认后进入「人生目标 + 难度」合并页');
    render.startSetup();
    render.setGender('m');
    assert(render._state().pick.gender === 'm', '选择性别');
    var bg = DB.list('backgrounds')[0];
    render.setBg(bg.id);
    assert(render._state().pick.bgId === bg.id, '选择出身背景');
    render.setGoal(bg.goals[0]);
    assert(render._state().pick.goalId === bg.goals[0], '选择人生目标');
    render.setDifficulty('normal');
    render.beginGame();
    assert(render._state().scene === 'play', '开始游戏进入主界面');

    // 触摸命中检测：找到任意按钮，点击验证不崩
    var btns = render._buttons();
    if (btns.length) {
      var b = btns[btns.length - 1];
      tap(b.x + b.w / 2, b.y + b.h / 2);
      console.log('  ✓ 触摸命中触发一次按钮回调');
    }

    // 多回合推进：根据 today.phase 调用对应交互函数
    var engine = require('../js/core/engine.js');
    var guard = 0;
    var barChecked = false;
    var twoStepChecked = false;
    var twoStepBarChecked = false;
    var resultModalChecked = false;
    var inlineResultChecked = false;
    while (render._state().scene === 'play' && guard++ < 60) {
      var S = render._state().S;
      if (!S || S.over) break;
      var phase = render._state().today.phase;

      if (phase === 'choose') {
        if (!barChecked) {
          assert(render._fixedButtons().length > 0, '底部固定操作区已渲染（控制按钮靠下）');
          barChecked = true;
        }
        if (!twoStepBarChecked) {
          // 底部操作区单次点击即执行（重开按钮）
          var rb = pageBtns()[pageBtns().length - 1];
          rb.onClick();
          assert(render._state().today.confirmRestart === true, '底部按钮单次点击即执行动作');
          var cb = render._fixedButtons()[1];
          cb.onClick();
          assert(render._state().today.confirmRestart === false, '取消后恢复原状态');
          twoStepBarChecked = true;
        }
        var r = S.relationship;
        if (r === 'single' && !S.lead) render.gotoSeek();
        else if (r === 'single' && S.lead) render.actMeet();
        else if (r === 'talking' || r === 'dating' || r === 'married') render.gotoDate();
        else if (Math.random() < 0.5) render.actLife();
        else render.actOvertime();
      } else if (phase === 'seek') {
        render.actSeek('self');
      } else if (phase === 'upgrade') {
        render.actLife();
      } else if (phase === 'date') {
        render.gotoStyle('date', 'simple');
      } else if (phase === 'style') {
        render.pickStyle('modest');
      } else if (phase === 'event') {
        if (render._state().today.resolved) {
          /* 结果直接展示在事件页的选项区域（保留头部头像与背景），不跳独立结算页 */
          if (!inlineResultChecked) {
            assert(render._state().today.phase === 'event',
              '事件确认后不跳页（phase 仍为 event，头部头像/背景保留）');
            assert(render._state().scene === 'play', '仍在主场景内，没有切到独立结算页');
            assert(drawnTexts.some(function (t) { return t === '你的选择'; }),
              '选项区域展示「你的选择」小标题');
            assert(drawnTexts.some(function (t) { return t === '结果'; }),
              '选项区域展示「结果」小标题');
            assert(drawnTexts.some(function (t) {
              return t && render._state().today.chosenLabel.indexOf(t) >= 0;
            }), '选项区域复述了刚选的选项原文');
            assert(render._buttons().filter(function (b) { return b.selectable; }).length === 0,
              '确认后选项区不再残留可点选项');
            inlineResultChecked = true;
          }
          var contBtn = render._fixedButtons()[0];
          assert(!!contBtn, '页内结果底部提供「继续」按钮');
          contBtn.onClick();
        } else {
          // 单选 + 确认：点击只选中，必须再点「确认」按钮才提交
          render.tapEventOption(0);
          if (!twoStepChecked) {
            assert(render._pending() !== null, '事件选项点击后进入选中态');
            assert(render._state().today.phase === 'event', '仅选中不会提交事件');
            assert(render._buttons().length > 0, '事件二级页渲染出可点击选项');
            twoStepChecked = true;
          }
          var mcf = render._fixedButtons().filter(function (b) { return b.label === '确认'; })[0];
          assert(!!mcf, '事件二级页底部提供可点的「确认」按钮');
          mcf.onClick();   // 关键：只点一次就要提交
          assert(render._state().today.resolved === true, '点一次「确认」即提交，并在本页展示结果');
        }
      } else if (phase === 'done') {
        // 结算改为独立二级页：应渲染出「继续」按钮，且底部不再出现「重开」
        if (!resultModalChecked) {
          assert(render._fixedButtons().length > 0, '结算结果以二级页展示（底部有可点击按钮）');
          var hasContinue = render._fixedButtons().some(function (b) { return b.label && b.label.indexOf('继续') >= 0; });
          assert(hasContinue, '结算二级页提供「继续」入口');
          var restartInFixed = render._fixedButtons().some(function (b) { return b.label === '重开'; });
          assert(!restartInFixed, '结算二级页打开时底部不再展示「重开」');
          resultModalChecked = true;
        }
        advanceAfterResult(render);
      } else {
        break;
      }
    }
    assert(barChecked, '主界面进入过行动阶段');
    assert(twoStepChecked, '事件选项「单选 + 确认」流程已验证');
    assert(twoStepBarChecked, '底部操作区单次点击流程已验证');
    assert(inlineResultChecked, '事件结果在页内选项区展示（保留头像/背景）已验证');
    /* 后面的排版断言都基于主界面，先把阶段拉回行动菜单 */
    if (render._state().scene === 'play') render.backToChoose();

    // 属性变化标签：正负号必须正确（旧版负数漏掉减号）
    assert(render.deltaTagText('health', -5) === '健康 -5', '属性减少显示减号');
    assert(render.deltaTagText('health', 5) === '健康 +5', '属性增加显示加号');
    /* 「万」单位：整数不再拖多余的 .0（60000 → 6万），带小数才保留一位（36000 → 3.6万） */
    assert(render.deltaTagText('money', -60000) === '存款 -6万', '大额减少用万为单位且带减号');
    assert(render.deltaTagText('money', -36000) === '存款 -3.6万', '万单位非整数保留一位小数');
    assert(render.deltaTagText('affection', -8) === '好感度 -8', '标签取自 stat_defs 而非硬编码');

    // 属性条：一行两条。好感度已挪到对象头像下方，所以主界面只排其余几项
    var allDefs = DB.text('stat_defs') || [];
    assert(allDefs.length === 7, '属性数据共 ' + allDefs.length + ' 项');
    var playDefs = render._playStatDefs();
    assert(playDefs.length === 6, '主界面属性条只排 6 项（好感度不在其中），实际 ' + playDefs.length);
    assert(playDefs.every(function (d) { return d.key !== 'affection'; }),
      '好感度不在主界面属性条里重复展示');
    var affSlot0 = render._affectionSlot();
    assert(!!affSlot0 && affSlot0.key === 'affection' && affSlot0.slot === 'partnerHeader',
      '好感度的展示位由数据决定（slot=partnerHeader → 对象头像下方）');
    var finalState = render._state();
    console.log('  ✓ 完成 ' + guard + ' 次交互，最终场景: ' + finalState.scene +
      '（第 ' + (finalState.S ? finalState.S.day : '?') + ' 天）');

    assert(!!storage['xq_save_v1'], '存档已写入本地缓存');

    // 读档重建
    var raw = JSON.parse(storage['xq_save_v1']);
    assert(raw.v === 1 && raw.goalId, '存档结构完整（含目标/难度 id）');

    // 结局绘制：验证 end 场景不崩，并检查「为什么」原因展示
    // （用带结构化 reason 的 ending 强制渲染一次结局页，避免依赖随机走到的结局）
    var st = render._state();
    if (st.S) {
      st.S.over = true;
      st.S.ending = {
        type: 'lose', title: '结局 · 时间到了', lines: ['两年过去了。'],
        reason: { key: 'timeout', vars: { maxDays: 150, goal: '结婚', progress: 42 } }
      };
      drawnTexts.length = 0;
      advanceAfterResult(render);
      assert(render._state().scene === 'end', '进入结局页并绘制正常');
      assert(drawnTexts.some(function (t) { return t === '为什么'; }), '结局页展示「为什么」标题');
      assert(drawnTexts.some(function (t) { return t.indexOf('进度停在 42%') >= 0; }),
        '结局页把原因变量替换进文案（进度停在 42%）');
    }

    /* ---------- 合并页单选：默认不预选 / 再点可取消 / 都选才确认 ---------- */
    console.log('  -- 合并页单选逻辑 --');
    render.startSetup();
    render.setGender('m');
    render.setBg(DB.list('backgrounds')[0].id);
    render.setGoal(DB.list('backgrounds')[0].goals[0]);
    assert(render._state().setupStep === 1, '选完性别+出身+目标后停在「目标+难度」合并页');
    assert(render._state().pick.difficulty === null, '难度没有默认预选值');

    var findBegin = function () {
      return render._fixedButtons().filter(function (b) {
        return b.label === '确认' || b.label === '开始这段人生' || b.label === '开始游戏';
      })[0];
    };
    var findBack = function () {
      return render._fixedButtons().filter(function (b) {
        return b.label && (b.label.indexOf('重选') >= 0 || b.label.indexOf('上一步') >= 0);
      })[0];
    };
    var diffOpts = function () {
      return render._buttons().filter(function (b) { return b.setup === 'diff'; });
    };
    // 合并页上难度项：本身不预选、不亮
    var d0 = diffOpts();
    assert(d0.length === 3, '难度渲染出 3 个可单选项，实际 ' + d0.length);
    assert(!findBegin(), '难度未选中时底部「开始游戏」不可点（目标已选、差难度）');

    d0[0].onClick();
    assert(render._state().pick.difficulty === 'easy', '点击难度即写入选择（合并页选中即落定）');
    assert(!!findBegin(), '选中难度后「开始游戏」可点');
    d0[0].onClick();
    assert(render._state().pick.difficulty === null, '再点一次同一项可取消选中（不再无法取消）');
    assert(!findBegin(), '取消后「开始游戏」重新置灰');

    // 正式选中一个难度并提交，确认能正常开局
    diffOpts()[2].onClick();
    assert(render._state().pick.difficulty === 'hard', '换选另一项后仍是选中态');
    findBegin().onClick();
    assert(render._state().scene === 'play', '选齐目标+难度后点「开始游戏」能正常开局');
    assert(render._state().pick.difficulty !== null, '难度选择已写入 pick');

    // 回退路径：合并页之间回退，已选值应保留而非残留错乱
    render.startSetup();
    render.setGender('m');
    render.setBg(DB.list('backgrounds')[0].id);
    render.setGoal(DB.list('backgrounds')[0].goals[0]);
    diffOpts()[0].onClick();
    assert(render._state().pick.difficulty === 'easy', '再次进入合并页可正常选中难度');
    findBack().onClick();   // 回到 base 页
    assert(render._state().setupStep === 0, '回退到「性别+出身」合并页');
    assert(render._state().pick.difficulty === 'easy', '回退后难度选择保留（合并页内不丢失）');
    assert(render._state().pick.gender === 'm' && render._state().pick.bgId != null,
      '回退后性别/出身选择也保留');
    // 改性别会级联清空出身/目标（难度与性别无关，保留——与原级联规则一致）
    var gBtns2 = render._buttons().filter(function (b) { return b.setup === 'gender'; });
    gBtns2[1].onClick();   // 换选「女」
    assert(render._state().pick.gender === 'f', '改选性别为女');
    assert(render._state().pick.bgId === null && render._state().pick.goalId === null,
      '改性别级联清空出身/目标');
    assert(render._state().pick.difficulty === 'easy', '难度与性别无关，改性别后仍保留');
    assert(!findBegin(), '出身被清空后「确认」重新置灰');

    /* ---------- 新功能：点对方头像看资料 ---------- */
    console.log('  -- 点对方头像看资料 --');
    render.startSetup();
    render.setGender('m');
    render.setBg(DB.list('backgrounds')[0].id);
    render.setGoal(DB.list('backgrounds')[0].goals[0]);
    render.setDifficulty('normal');
    render.beginGame();
    var S2 = render._state().S;

    // 还没有对象时：页面要给出引导文案，而不是空白
    render.openPartnerProfile();
    assert(render._state().scene === 'partner', '无对象时也能进入资料页');
    assert(drawnTexts.some(function (t) { return t.indexOf('还没有对象') >= 0; }),
      '无对象时资料页给出引导文案');
    render.backToPlay();
    assert(render._state().scene === 'play', '资料页可返回主界面');

    // 造一个对象，再点头像
    S2.lead = null; S2.partner = null; S2.relationship = 'single';
    var tries2 = 0;
    while (tries2++ < 500) {
      var rd = engine.findDate(S2, 'matchmaker');
      if (rd.ok) break;
    }
    assert(!!S2.lead, '成功认识了新的相亲对象（lead 已写入）');
    assert(S2.lead && !!S2.lead.job, '对象带职业字段（用于取头像）');

    drawnTexts.length = 0;
    render.openPartnerProfile();
    assert(render._state().scene === 'partner', '有对象时点头像进入资料页');
    assert(drawnTexts.some(function (t) { return t === S2.lead.name; }), '资料页展示对方姓名');
    assert(drawnTexts.some(function (t) { return t === '职业'; }), '资料页展示「职业」标签');
    assert(drawnTexts.some(function (t) { return t.indexOf(S2.lead.job) >= 0; }), '资料页展示对方职业');
    assert(drawnTexts.some(function (t) { return t === '性格'; }), '资料页展示「性格」标签');
    assert(drawnTexts.some(function (t) { return t === '家境'; }), '资料页展示「家境」标签');
    assert(drawnTexts.some(function (t) { return t === '对方资料'; }), '资料页有标题');
    render.backToPlay();
    assert(render._state().scene === 'play', '从资料页返回主界面');

    /* ---------- 新功能：近期变化的入口改到主角头像上 ---------- */
    console.log('  -- 近期变化入口：主角头像（属性条不再可点） --');
    // 属性条不再是可点区域（旧版把入口藏在细条上，几乎没人找得到）
    var statHits = render._buttons().filter(function (b) {
      return b.label && b.label.indexOf('stat:') === 0;
    });
    assert(statHits.length === 0, '属性条已不再是可点区域，实际 ' + statHits.length + ' 个');
    var heroHits = render._buttons().filter(function (b) { return b.label === 'hero:stats'; });
    assert(heroHits.length === 1, '主界面主角头像区域可点（进「近期变化」）');
    var avHits = render._buttons().filter(function (b) { return b.label === 'partner:profile'; });
    assert(avHits.length === 1, '主界面对方头像区域可点');
    avHits[0].onClick();
    assert(render._state().scene === 'partner', '点击对方头像命中区直接进入资料页');
    render.backToPlay();

    heroHits[0].onClick();
    assert(render._state().scene === 'stats', '点击主角头像命中区直接进入变化页');
    render.backToPlay();
    assert(render._state().scene === 'play', '变化页可返回主界面');

    // 提示文案必须贴着头像说，不能再说「点属性条」
    var statTapTxt = ((DB.text('play') || {}).statTap) || '';
    assert(statTapTxt.indexOf('头像') >= 0 && statTapTxt.indexOf('属性条') < 0,
      '主界面提示指向头像而不是属性条：' + statTapTxt);
    drawnTexts.length = 0;
    render.draw();
    assert(drawnTexts.some(function (t) { return t === statTapTxt; }), '主界面画出了该提示');

    // 再进一次，检查「近期变化」页的内容
    drawnTexts.length = 0;
    render.openStatDetail();
    assert(render._state().scene === 'stats', '点属性条进入「近期变化」页');
    assert(drawnTexts.some(function (t) { return t === '近期变化'; }), '变化页有标题');
    assert(drawnTexts.some(function (t) { return t === '当前状态'; }), '变化页先给「当前状态」');
    // 七项属性名应当全部出现（所有属性一起展示）
    var defs2 = DB.text('stat_defs') || [];
    var missingLabels = defs2.filter(function (d) {
      return !drawnTexts.some(function (t) { return t === d.label; });
    });
    assert(missingLabels.length === 0, '七项属性全部一起展示' +
      (missingLabels.length ? '（缺 ' + missingLabels.map(function (d) { return d.label; }).join(',') + '）' : ''));
    render.backToPlay();
    assert(render._state().scene === 'play', '看完变化页能回到主界面');

    /* ---------- 好感度条：挪到对象头像下方，且只在有对象时出现 ---------- */
    console.log('  -- 好感度条位置（对象头像下方 / 没对象就不展示） --');
    var affDef = render._affectionSlot();
    var S3 = render._state().S;

    // 没有对象：整块不出现
    S3.relationship = 'single';
    S3.partner = null;
    S3.lead = null;
    drawnTexts.length = 0;
    render.draw();
    assert(!drawnTexts.some(function (t) { return t === affDef.label; }),
      '没有相亲对象时不展示好感度条');
    assert(render._buttons().filter(function (b) { return b.label === 'hero:stats'; }).length === 1,
      '没有对象时主角头像依然可点');
    assert(render._buttons().filter(function (b) { return b.label === 'partner:profile'; }).length === 1,
      '没有对象时「?」占位仍可点（引导进资料页）');

    // 有对象：出现在对象头像下方
    S3.relationship = 'dating';
    S3.partner = {
      id: 'p_probe', name: '林知夏', job: 'nurse', gender: 'f', personality: '温柔',
      looks: 7, family: 6, age: 26
    };
    S3.affection = 55;
    render._clearFlash();
    drawnTexts.length = 0;
    textOps.length = 0;
    render.draw();
    assert(drawnTexts.some(function (t) { return t === affDef.label; }), '有对象时展示好感度条');

    var affOps = textOps.filter(function (o) { return o.text === affDef.label; });
    assert(affOps.length === 1, '好感度标签只出现一次，实际 ' + affOps.length);
    var affLabel = affOps[0];
    // 新布局：对象列半宽 44、好感度条宽 = 列宽-8 = 80（与 render.js 保持同步）
    var colHalf = 44;
    var affW = colHalf * 2 - 8;
    var rightCx = 375 - 18 - colHalf;                // 对象头像中心 x（PAD=18）
    var colL = rightCx - affW / 2;
    assert(Math.abs(affLabel.x - colL) < 4,
      '好感度标签左对齐在对象头像那一列（x≈' + Math.round(affLabel.x) + ' vs ' + colL + '）');
    // 数值落在同一行、右对齐到列右边缘。
    // 好感度是动态值 → 展示成「当前 / 上限」，上限由引擎按关系阶段给出。
    var affText = '55/' + engine.affectionCap(S3);
    var affValOps = textOps.filter(function (o) { return o.text === affText; });
    assert(affValOps.length >= 1, '好感度条带数值 ' + affText);
    assert(Math.abs(affValOps[0].y - affLabel.y) < 4, '好感度数值与标签同一行');
    assert(Math.abs((affValOps[0].x + affValOps[0].w) - (colL + affW)) < 4,
      '好感度数值右对齐到列右边缘（' + Math.round(affValOps[0].x + affValOps[0].w) + '）');
    assert(affLabel.y > 200, '好感度条在头像区下方（y≈' + Math.round(affLabel.y) + '）');

    /* ---------- 属性区：三行 × 每行两条，且不含好感度 ---------- */
    console.log('  -- 属性区排版（3 行 × 2 列） --');
    var wantKeys = ['money', 'health', 'career', 'looks', 'family', 'mood'];
    var wantLabels = ['存款', '健康', '事业', '颜值', '家境', '情绪'];
    var gridDefs = render._playStatDefs();
    assert(gridDefs.length === 6, '属性区正好 6 项（3 行 × 2 列），实际 ' + gridDefs.length);
    assert(gridDefs.map(function (d) { return d.key; }).join(',') === wantKeys.join(','),
      '属性区顺序 = ' + wantKeys.join('/') + '，实际 ' + gridDefs.map(function (d) { return d.key; }).join('/'));
    assert(gridDefs.map(function (d) { return d.label; }).join(',') === wantLabels.join(','),
      '属性区标签 = ' + wantLabels.join('/'));
    assert(gridDefs.every(function (d) { return d.key !== 'affection'; }),
      '好感度不占属性区的格子（在下方的对象头像处展示）');

    var cellOps = textOps.filter(function (o) { return wantLabels.indexOf(o.text) >= 0; });
    assert(cellOps.length === 6, '属性区画出 6 个标签，实际 ' + cellOps.length);
    var rows = {};
    cellOps.forEach(function (o) {
      var k = Math.round(o.y / 4) * 4;      // 同一行的基线一致，做一点容差
      (rows[k] = rows[k] || []).push(o);
    });
    var rowKeys = Object.keys(rows).map(Number).sort(function (a, b) { return a - b; });
    assert(rowKeys.length === 3, '属性区分成 3 行，实际 ' + rowKeys.length);
    var layoutOk = true, readOrder = [];
    rowKeys.forEach(function (k) {
      if (rows[k].length !== 2) layoutOk = false;
      rows[k].sort(function (a, b) { return a.x - b.x; });
      readOrder = readOrder.concat(rows[k].map(function (o) { return o.text; }));
    });
    assert(layoutOk, '每一行正好 2 个指标（3 行 × 2 列）');
    assert(readOrder.join(',') === wantLabels.join(','),
      '按行读出的顺序是 ' + wantLabels.join('/ ') + '，实际 ' + readOrder.join('/ '));

    /* ---------- 好感度上限随关系阶段变化（动态值） ---------- */
    console.log('  -- 好感度动态上限 --');
    var capDating = null, capTalking = null;
    S3.relationship = 'talking';
    render._clearFlash(); drawnTexts.length = 0; render.draw();
    capTalking = drawnTexts.filter(function (t) { return /^55\/\d+$/.test(t); })[0] || '';
    S3.relationship = 'dating';
    render._clearFlash(); drawnTexts.length = 0; render.draw();
    capDating = drawnTexts.filter(function (t) { return /^55\/\d+$/.test(t); })[0] || '';
    assert(capTalking === '55/100', '接触中好感度显示 55/100，实际 ' + capTalking);
    assert(capDating === '55/500', '告白成功后好感度上限变 500，显示 55/500，实际 ' + capDating);
    assert(engine.affectionCap(S3) === 500, '引擎按关系阶段给出 500 的上限');

    /* ---------- 初遇之前也能微信聊天 ---------- */
    console.log('  -- 初遇前微信闲聊 --');
    var S4 = render._state().S;
    var savedPartner = S4.partner, savedLead = S4.lead;
    S4.relationship = 'single';
    S4.partner = null;
    S4.lead = { id: 'p_lead', name: '林晚晴', job: 'teacher', gender: 'f', personalityId: 'emo', personality: '温柔', looks: 74, family: 62 };
    S4.affection = 0;
    assert(engine.chatStage(S4) === 'lead', '还没见面时聊天阶段是 lead');
    assert(engine.canChat(S4) === true, '还没见面（single + lead）也能微信聊天');
    assert(engine.chatAvailable(S4) === true, 'lead 阶段有可聊的题库（chats 里有 lead 条目）');
    var leadPool = engine.chatPool(S4);
    assert(leadPool.length > 0 && leadPool.every(function (c) { return (c.phases || []).indexOf('lead') >= 0; }),
      'lead 阶段只会抽到带 lead 标签的对话，实际 ' + leadPool.length + ' 条');
    assert(engine.rollProactiveChat(S4) === false, '还没见面时对方不会主动发来微信');
    render._clearFlash(); drawnTexts.length = 0; render.draw();
    assert(drawnTexts.some(function (t) { return t === affDef.label; }),
      '还没见面时好感度条也直接展示在对象头像下方');
    render.backToChoose();
    var chatBtns = render._buttons().filter(function (b) { return b.label === '微信闲聊'; });
    assert(chatBtns.length === 0,
      '「微信闲聊」不再堆在行动菜单里（菜单只留两个方向入口），实际 ' + chatBtns.length);
    render.gotoSeek();
    chatBtns = render._buttons().filter(function (b) { return b.label === '微信闲聊'; });
    assert(chatBtns.length === 1,
      '还没见面时「寻找相亲机会」二级页里有「微信闲聊」入口，实际 ' + chatBtns.length);

    // 真的聊一次：与事件同一套规则 —— 只影响「看得见的」属性，且不铺满全部属性
    var leadChat = engine.pickChat(S4);
    assert(!!leadChat, 'lead 阶段能抽到一条对话');
    var opt0 = leadChat.options[0];
    var before4 = { aff: S4.affection, mood: S4.mood, money: S4.money, career: S4.career, health: S4.health };
    var res4 = engine.applyChat(S4, opt0);
    var fx0 = opt0.fx || {};
    var fxKeys = Object.keys(fx0).filter(function (k) { return fx0[k]; });
    assert(fxKeys.length >= 1 && fxKeys.length <= 3,
      '闲聊回复与事件选项同一套规则：一条回复影响 ' + fxKeys.length + ' 项属性（1~3 项，不铺满）');
    var tiny = fxKeys.filter(function (k) {
      return k === 'money' ? Math.abs(fx0[k]) < 100 : Math.abs(fx0[k]) < 5;
    });
    assert(tiny.length === 0,
      '闲聊的每一项影响都是「看得见的幅度」（存款 ≥100 元 / 属性 ≥5 点）：' + JSON.stringify(fx0));
    assert(Object.keys(res4.delta).length >= 1,
      '结算回报至少覆盖一项属性（实际变化 ' + Object.keys(res4.delta).length + ' 项）');
    assert(S4.affection === engine.clamp(before4.aff + (opt0.affection || 0), 0, 100),
      '闲聊好感度按上限 100 结算（还没在一起）');
    assert(S4.affection > 0, '见面前的闲聊会攒下好感（' + S4.affection + '）');

    // 见面时把这段好感折成印象分
    var leadAff = S4.affection;
    var meetRes = engine.firstMeet(S4);
    assert(meetRes && meetRes.partner && meetRes.partner.id === 'p_lead', '赴约后 lead 变成对象');
    assert(S4.relationship === 'meeting', '赴约后进入「初次见面」阶段');
    assert(meetRes.chatBonus === Math.min(leadAff, DB.num('LEAD_CHAT_AFF_MAX', 20)),
      '见面前聊出来的好感折算成印象分（chatBonus=' + meetRes.chatBonus + '）');
    S4.partner = savedPartner; S4.lead = savedLead; S4.relationship = 'dating';
    /* 阶段拉回行动菜单：后面的排版 / 动效断言都基于主界面 */
    render.backToChoose();
    render._clearFlash();

    /* ---------- 属性条涨跌动效 ---------- */
    console.log('  -- 属性条涨跌动效（滑到新值 + 变化段高亮） --');
    /* 好感度的上限是动态值（接触中 100 / 恋爱后 500），这里固定成接触中来测「条长几何」，
     * 几何断言用的是 100 刻度的宽度换算；刻度切换到 500 单独在下面验。 */
    S3.relationship = 'talking';
    assert(engine.affectionCap(S3) === 100, '接触中好感度上限仍是 100');
    /* 好感度数值的展示格式是「当前 / 上限」，把前导数字取出来比较 */
    function numOf(t) {
      var m = /^(\d+)(?:\/\d+)?$/.exec(String(t));
      return m ? +m[1] : null;
    }
    function barFills() {
      /* 好感度条：列宽 92、高 7；用宽度区分「轨道 / 已填充 / 变化段」 */
      return fillOps.filter(function (o) { return o.h === 7 && o.w >= 6 && o.w <= 95; });
    }
    var PAL = require('../js/ui/canvas-kit.js').PALETTE;

    // 涨：55 → 65
    S3.affection = 65;
    render.startStatFlash({ affection: 10 });
    assert(!!render._statFlashAnim('affection'), '结算后属性条进入动效状态');

    function frame(p) { render._setFlashProgress(p); fillOps.length = 0; drawnTexts.length = 0; textOps.length = 0; render.draw(); }
    function segBy(color) {
      var hit = barFills().filter(function (o) { return o.fill === color && o.alpha > 0.5; });
      return hit.length ? hit[hit.length - 1] : null;
    }
    /* 条的真实长度 = 所有可见填充段向右伸得最远的那个（排除底色轨道） */
    function barRight() {
      var m = 0;
      barFills().forEach(function (o) {
        if (o.fill === PAL.line || o.alpha <= 0.05) return;
        if (o.x + o.w > m) m = o.x + o.w;
      });
      return m - colL;
    }
    var W55 = 55 / 100 * 80, W65 = 65 / 100 * 80, W45 = 45 / 100 * 80, W10 = 10 / 100 * 80;

    frame(0);        // 起点：条长 = 结算前的 55
    assert(Math.abs(barRight() - W55) < 2, '动效起点条长还是旧值 55（实际 ' + barRight().toFixed(1) + 'px）');
    assert(!segBy(PAL.up), '起点还没有「新长出来」的部分');
    assert(drawnTexts.some(function (t) { return numOf(t) === 55; }), '数值跟着从旧值 55 开始滚动');

    frame(0.5);      // 中途：条长介于 55 与 65 之间，且出现涨色高亮段
    var upMid = segBy(PAL.up);
    assert(!!upMid, '动画中途出现涨色高亮段（这一段是新长出来的）');
    assert(Math.abs(upMid.x - (colL + W55)) < 2, '涨色段从「旧值位置」开始长（x≈' + Math.round(upMid.x) + '）');
    assert(upMid.w > 0.5 && upMid.w < W10, '高亮段还没长满（' + upMid.w.toFixed(1) + 'px < ' + W10.toFixed(0) + 'px）');
    assert(barRight() > W55 && barRight() < W65, '条长正处于 55 与 65 之间（' + barRight().toFixed(1) + 'px）');
    var nums = textOps.map(function (o) { return numOf(o.text); })
      .filter(function (n) { return n !== null; });
    assert(nums.indexOf(64) >= 0, '数值在滚动中间帧（64）');

    frame(1);        // 终点：条长 = 新值 65，高亮段 = 本次涨幅
    var up1 = segBy(PAL.up);
    assert(Math.abs(barRight() - W65) < 2, '终点条长 = 新值 65（实际 ' + barRight().toFixed(1) + 'px）');
    assert(!!up1 && Math.abs(up1.x - (colL + W55)) < 2 && Math.abs(up1.w - W10) < 2,
      '终点涨色段正好盖住本次涨幅 10（x≈' + (up1 ? Math.round(up1.x) : '无') +
      '，w≈' + (up1 ? up1.w.toFixed(1) : '无') + '）');

    // 跌：65 → 45
    S3.affection = 45;
    render.startStatFlash({ affection: -20 });
    frame(0);
    assert(Math.abs(barRight() - W65) < 2, '跌的时候起点条长还是旧值 65（实际 ' + barRight().toFixed(1) + 'px）');
    frame(0.5);
    var downMid = barFills().filter(function (o) { return o.fill === PAL.down && o.alpha > 0.05; });
    assert(downMid.length === 1, '动画中途出现跌色段（正在失去的那一截），实际 ' + downMid.length);
    assert(downMid[0].x >= colL - 1 && downMid[0].x + downMid[0].w <= colL + W65 + 1,
      '跌色段落在「旧值长度」以内，不会虚长到条外');
    var solidMid = segBy(affDef.color);
    assert(!!solidMid && solidMid.w < W65 - 1 && solidMid.w > W45 + 1,
      '实心条正在从 65 往 45 缩（' + (solidMid ? solidMid.w.toFixed(1) : '无') + 'px）');
    assert(Math.abs(downMid[0].x - (colL + solidMid.w)) < 2,
      '跌色段紧跟在实心条尾部（就是刚刚失去的那一截）');
    frame(1);
    assert(Math.abs(barRight() - W45) < 2, '跌的终点条长 = 新值 45（实际 ' + barRight().toFixed(1) + 'px）');
    var downEnd = barFills().filter(function (o) { return o.fill === PAL.down && o.alpha > 0.05; });
    assert(downEnd.length === 0, '动画结束时跌色段已淡尽（条长就是真实值，不会看起来没掉）');
    assert(drawnTexts.some(function (t) { return numOf(t) === 45; }), '数值滚动到新值 45');

    render._clearFlash();
    assert(!render._statFlashAnim('affection'), '动效结束后状态被清干净');
    fillOps.length = 0;
    render.draw();
    assert(Math.abs(barRight() - W45) < 2, '静默态条长就是当前值');

    // 记录历史后，变化页要能列出该天的涨跌
    drawnTexts.length = 0;
    render.recordStatHistory({ money: -1200, affection: 6, health: -1 });
    var hist = render._state().S.history;
    assert(hist.length === 1 && hist[0].day === render._state().S.day, '结算涨跌被记入历史（第 N 天）');
    render.openStatDetail();
    assert(drawnTexts.some(function (t) { return t.indexOf('第 ') === 0 && t.indexOf(' 天') > 0; }),
      '变化页按天列出涨跌');
    assert(drawnTexts.some(function (t) { return t.indexOf('存款') >= 0; }) &&
      drawnTexts.some(function (t) { return t.indexOf('-') === 0; }),
      '变化页展示存款减少（属性变化卡：名称 + 带减号的数值）');
    assert(drawnTexts.some(function (t) { return t.indexOf('好感度') >= 0; }) &&
      drawnTexts.some(function (t) { return t.indexOf('+') === 0; }),
      '变化页展示好感度增加（属性变化卡：名称 + 带加号的数值）');
    assert(drawnTexts.some(function (t) { return t.indexOf('近期合计') >= 0; }), '变化页给出近期合计');
    render.recordStatHistory({ money: 0, mood: 0 });
    assert(render._state().S.history.length === 1, '全零变化不写入历史（不产生噪音记录）');
    var maxH = DB.num('STAT_HISTORY_MAX', 12);
    for (var hi = 0; hi < maxH + 8; hi++) render.recordStatHistory({ mood: 1 });
    assert(render._state().S.history.length === maxH,
      '历史长度受常量 STAT_HISTORY_MAX 限制（' + maxH + '）');
    render.backToPlay();

    /* ---------- 标题页：上移到 50%、没有整屏蒙层、按钮居中 / 大字 / 白底带投影 ---------- */
    console.log('  -- 标题页布局（按钮：居中 + 大一号 + 白底 + 投影） --');
    render._clearFlashBar();
    render.gotoTitle();
    var tbtns = render._buttons();
    assert(tbtns.length > 0, '标题页渲染出按钮（' + tbtns.length + ' 个）');
    assert(tbtns[0].y >= Math.round(667 * 0.5) - 1,
      '标题页按钮组从画布 50% 处开始（y=' + tbtns[0].y + '）');
    var lastTb = tbtns[tbtns.length - 1];
    assert(lastTb.y + lastTb.h <= 667 - 6,
      '大一号后首页按钮仍全部落在屏幕内（底部 ' + (lastTb.y + lastTb.h) + ' ≤ 661）');

    textOps.length = 0;
    fillOps.length = 0;
    gradientCalls = 0;
    gradientFills.length = 0;
    render.gotoTitle();

    /* 标题页按钮：白底 + 投影、无渐变 —— 纯色填充，不铺渐变蒙层 */
    assert(gradientFills.length === 0, '标题页按钮无渐变填充（白底用纯色，不铺渐变）');

    /* 白底按钮：每个按钮矩形区域都有白色纯色填充（fillRoundRect 记录到 fillOps） */
    var btnFills = fillOps.filter(function (o) {
      return tbtns.some(function (b) {
        return Math.abs(o.x - b.x) < 2 && Math.abs(o.y - b.y) < 2 &&
          Math.abs(o.w - b.w) < 2 && Math.abs(o.h - b.h) < 2;
      });
    });
    var whiteFills = btnFills.filter(function (o) {
      var c = String(o.fill || '').toLowerCase();
      return c === '#ffffff' || c === 'white' || c === '#eceae9';
    });
    assert(whiteFills.length === tbtns.length,
      '标题页按钮为白底（每个按钮都有白色填充，实得 ' + whiteFills.length + '/' + tbtns.length + '）');

    /* 文字居中 + 字号大一号（通用按钮是 16） */
    var labelOp = function (b) {
      return textOps.filter(function (o) { return o.text === b.label; })[0];
    };
    var missing = tbtns.filter(function (b) { return !labelOp(b); });
    assert(missing.length === 0, '标题页每个按钮都画出了文字（缺 ' + missing.length + ' 个）');
    var offCenter = tbtns.filter(function (b) {
      var op = labelOp(b);
      return !op || Math.abs((op.x + op.w / 2) - (b.x + b.w / 2)) > 2;
    });
    assert(offCenter.length === 0, '按钮文字水平居中（' + tbtns.length + ' 个全部对中）');
    assert(tbtns.every(function (b) { var o = labelOp(b); return o && o.size >= 17; }),
      '按钮字号比通用按钮大一号（≥17，实际 ' +
      tbtns.map(function (b) { var o = labelOp(b); return o ? o.size : '?'; }).join('/') + '）');

    /* ---------- 头像 / 对象信息来自数据库 ---------- */
    console.log('  -- 头像与对象信息来自数据库 --');
    var artR = require('../js/ui/art.js');
    var bgsAll = DB.list('backgrounds');
    assert(bgsAll.length > 0 && bgsAll.every(function (b) { return !!b.avatar; }),
      '全部 ' + bgsAll.length + ' 个出身背景都带 avatar 字段（在数据库里）');
    var matsAll = DB.get('materials') || {};
    var jobsAll = matsAll.jobs || [];
    assert(jobsAll.length > 0 && jobsAll.every(function (j) { return !!j.avatar; }),
      '全部 ' + jobsAll.length + ' 个对象职业都带 avatar 字段（在数据库里）');
    assert(artR.bgAvatarKey(bgsAll[0].id) === bgsAll[0].avatar,
      '主角头像 key 取自 backgrounds.avatar');
    assert(artR.jobAvatarKey(jobsAll[0].job) === jobsAll[0].avatar,
      '对象头像 key 取自 materials.jobs[].avatar');
    // 改数据库里的值，取图 key 必须跟着变（证明不是读 role-map.js）
    var keepAvatar = jobsAll[0].avatar;
    jobsAll[0].avatar = 'coach';
    assert(artR.jobAvatarKey(jobsAll[0].job) === 'coach',
      '改数据库 avatar 后取图 key 随之变化（数据库为唯一来源）');
    jobsAll[0].avatar = keepAvatar;

    /* ---------- 相亲机会结果页：花销 + 信封样式的对象信息 ---------- */
    console.log('  -- 相亲机会结果页（信封卡片） --');
    var S0 = render._state().S;
    S0.lead = null; S0.partner = null; S0.relationship = 'single'; S0.affection = 0;
    render.backToPlay();
    assert(render._state().scene === 'play', '回到主界面准备相亲');
    render.gotoSeek();
    var chBtns = render._buttons().filter(function (b) { return b.selectable; });
    assert(chBtns.length > 0, '相亲渠道列表渲染出选项');
    /* 选一个花钱的渠道：免费档没有「花销」栏可看 */
    var chsAll = DB.list('channels');
    var pickIdx = 0;
    for (var ci = 0; ci < chsAll.length; ci++) { if (chsAll[ci].cost > 0) { pickIdx = ci; break; } }
    assert(chsAll[pickIdx].cost > 0, '找到花钱的相亲渠道：' + chsAll[pickIdx].name);
    var savedRnd = Math.random;
    Math.random = function () { return 0; };           // 必中：走「相亲成功」分支
    chBtns[pickIdx].onClick();
    render.runPending();
    Math.random = savedRnd;
    var t0 = render._state().today;
    assert(!!t0.result && !!t0.result.lead, '相亲成功后结果页带上对象（供信封卡片使用）');
    var lead0 = t0.result.lead;
    /* ui-smoke 不真实下载图片（无 wx.createImage），这里验证「头像 key 能解析」；
     * 真正的 drawImage 由 art-smoke 用真实图片验证。 */
    assert(!!artR.jobAvatarKey(lead0.job), '对象职业在数据库里有对应头像 key：' + lead0.job);

    drawnTexts.length = 0;
    render.draw();
    assert(drawnTexts.some(function (t) { return t === '对象信息'; }), '结果页有「对象信息」信封卡片');
    assert(drawnTexts.some(function (t) { return t === '花销'; }), '结果页有独立的「花销」栏');
    ['姓名', '职业', '性格', '家庭', '条件'].forEach(function (lbl) {
      assert(drawnTexts.some(function (t) { return t === lbl; }), '信封卡片有「' + lbl + '」背景框');
    });
    assert(drawnTexts.some(function (t) { return t === lead0.name; }), '信封卡片展示对象姓名');
    assert(drawnTexts.some(function (t) { return t.indexOf(lead0.job) >= 0; }), '信封卡片展示对象职业');

    /* 记入「近期经历」，再进「近期变化」验证关键事件与 从 x 变为 y */
    render.recordAct();
    var acts0 = render._state().S.acts;
    assert(acts0.length >= 1, '行动被记入近期经历');
    var lastAct = acts0[acts0.length - 1];
    assert(lastAct.event.length > 0, '近期经历记录了事件正文');
    assert(!!lastAct.option, '近期经历记录了渠道（你的选择）');
    assert(lastAct.result.length > 0, '近期经历记录了结果');

    console.log('  -- 近期经历页 --');
    drawnTexts.length = 0;
    render.openRecent();
    assert(render._state().scene === 'recent', '进入「近期经历」页');
    assert(drawnTexts.some(function (t) { return t === '近期经历'; }), '近期经历页有标题');
    assert(drawnTexts.some(function (t) { return t === '事件'; }), '近期经历展示「事件」');
    assert(drawnTexts.some(function (t) { return t === '你的选择'; }), '近期经历展示「你的选择」');
    assert(drawnTexts.some(function (t) { return t === '结果'; }), '近期经历展示「结果」');
    assert(drawnTexts.some(function (t) { return t === lastAct.option; }), '近期经历展示所选选项原文');
    render.backToPlay();
    assert(render._state().scene === 'play', '近期经历页可返回主界面');

    console.log('  -- 近期变化：关键事件 + 从 x 变为 y --');
    var Sx2 = render._state().S;
    var moneyBefore = Sx2.money;
    Sx2.money = moneyBefore - 1000;                       // 模拟结算已生效
    Sx2.mood = Math.min(100, (Sx2.mood || 0) + 5);
    render.recordStatHistory({ money: -1000, mood: 5 }, '测试关键事件');
    var hLast = render._state().S.history.slice(-1)[0];
    assert(hLast.from.money === moneyBefore && hLast.to.money === moneyBefore - 1000,
      '历史条目记录了结算前后的数值（from / to）');
    assert(hLast.label === '测试关键事件', '历史条目带上了关键事件标题');
    drawnTexts.length = 0;
    render.openStatDetail();
    assert(drawnTexts.some(function (t) { return t === '关键事件'; }), '变化页有「关键事件」小标题');
    assert(drawnTexts.some(function (t) { return t.indexOf('测试关键事件') >= 0; }), '变化页展示关键事件内容');
    var fromTo = drawnTexts.filter(function (t) { return t.indexOf('从') >= 0 && t.indexOf('变为') >= 0; });
    assert(fromTo.length > 0, '变化页展示「从 x 变为 y」(' + fromTo.length + ' 条)');
    assert(fromTo.some(function (t) { return t.indexOf('存款') >= 0; }), '其中包含存款的 从 x 变为 y');
    render.backToPlay();

    /* ---------- 微信闲聊（非单身） ---------- */
    console.log('  -- 微信闲聊 --');
    var S1 = render._state().S;
    var MJ = (DB.get('materials') || {}).jobs || [];
    var partnerObj = {
      name: '测试对象', job: MJ[0].job, gender: 'f', personality: '温和',
      looks: 6, family: 5, age: 26, hobby: '看书', place: '相亲介绍', seenDates: []
    };
    render.gotoTitle();
    render.resumeGame({
      v: 1, gender: S1.gender, bgId: S1.bg.id, goalId: S1.goal.id, seed: S1.seed,
      difficultyId: S1.diff.id, day: S1.day, money: S1.money, health: S1.health,
      career: S1.career, looks: S1.looks, family: S1.family, mood: 60,
      affection: 40, relationship: 'talking', partner: partnerObj, lead: null,
      flags: {}, singleStreak: 0, singleLimit: 60, relStartDay: 1, recent: [], log: [],
      history: [], acts: []
    });
    S1 = render._state().S;      // resumeGame 会重建状态对象，这里要重新取
    assert(S1.relationship === 'talking' && !!S1.partner, '已恢复到「恋爱中」状态');
    assert(engine.canChat(S1), '非单身时可用「微信闲聊」');
    assert(!!engine.pickChat(S1), '能从 chats 集合抽到一条闲聊剧情');

    // 「微信闲聊」入口在「寻找相亲机会」二级页里（行动菜单只留两个方向入口）
    render.gotoSeek();
    var chatEntry = render._buttons().filter(function (b) {
      return b.label === (DB.text('chat').title || '微信闲聊');
    });
    assert(chatEntry.length === 1, '非单身时「寻找相亲机会」二级页出现「微信闲聊」');
    render.backToChoose();

    drawnTexts.length = 0;
    render.openChat();
    assert(render._state().scene === 'chat', '进入微信闲聊页（对话框样式）');
    var st1 = render._chat();
    assert(!!st1 && !!st1.chat, '闲聊页拿到一条剧情');
    assert(drawnTexts.some(function (t) { return t === st1.chat.opener[0]; }), '画出对方发来的消息气泡');
    assert(drawnTexts.some(function (t) { return t.indexOf('好感度为主') >= 0; }),
      '闲聊页说明「好感度为主，也可能牵动情绪与其他状态」');

    var optBtns = render._buttons().filter(function (b) { return b.selectable; });
    assert(optBtns.length === st1.chat.options.length,
      '回复选项数量与数据一致（' + optBtns.length + '）');
    var best = 0;
    st1.chat.options.forEach(function (o, i) { if (o.affection > st1.chat.options[best].affection) best = i; });
    var bestOpt = st1.chat.options[best];

    var before1 = {
      money: S1.money, health: S1.health, career: S1.career,
      looks: S1.looks, family: S1.family, affection: S1.affection, mood: S1.mood
    };
    optBtns[best].onClick();
    assert(render._pending() !== null, '点一次选中某句回复');
    var sendBtn = render._fixedButtons().filter(function (b) {
      return b.label === (DB.text('chat').send || '发送');
    })[0];
    assert(!!sendBtn, '闲聊页底部有「发送」按钮');
    sendBtn.onClick();
    assert(render._chat().phase === 'result', '发送后进入结果态');
    assert(S1.affection > before1.affection && S1.affection <= 100,
      '选中最甜的一句后好感上升且不超上限（' + before1.affection + ' → ' + S1.affection + '）');
    var sideKeys = ['money', 'health', 'career', 'looks', 'family', 'mood']
      .filter(function (k) { return S1[k] !== before1[k]; });
    assert(sideKeys.length >= 1 && sideKeys.length <= 2,
      '闲聊与事件同一套规则：一句回复只带动捎带的少量属性（' +
      sideKeys.length + ' 项：' + sideKeys.join('/') + '），不再全属性铺满');

    drawnTexts.length = 0;
    render.draw();
    assert(drawnTexts.some(function (t) { return t === bestOpt.label; }), '画出我发出的回复气泡');
    if (bestOpt.reply) {
      assert(drawnTexts.some(function (t) { return t === bestOpt.reply; }), '画出对方的回应气泡');
    }
    var finBtn = render._fixedButtons().filter(function (b) {
      return b.label === (DB.text('chat').finish || '结束闲聊 · 进入下一天');
    })[0];
    assert(!!finBtn, '闲聊结算页的按钮写明「进入下一天」');
    var dayBefore = S1.day;
    var chatCost = engine.actionDays('chat', S1);
    render.finishChat();
    assert(render._state().S.day === dayBefore + chatCost,
      '闲聊结算后正好推进 ' + chatCost + ' 天（耗天来自 ACTION_DAYS.chat）');
    assert(render._state().S.acts.length > 0, '闲聊也计入近期经历');

    /* ---------- 主动微信 / 灵魂拷问 / 「必须当面约会」 ---------- */
    console.log('  -- 主动微信与「必须当面约会」 --');
    var TCHAT = DB.text('chat') || {};
    var chatTitleLabel = TCHAT.title || '微信闲聊';
    var sendLabel = TCHAT.send || '发送';

    /* 对方主动发来的那一次：顶部标出来，而且不能「返回」溜掉 */
    S1.proactiveChats = 0;
    S1.mustDate = false;
    S1.relationship = 'talking';
    S1.affection = 50;
    render.openChat(true);
    assert(render._state().scene === 'chat', '对方主动发微信 → 进入闲聊页');
    assert(!!(render._chat() && render._chat().proactive), '标记为「对方主动发来」');
    drawnTexts.length = 0;
    render.draw();
    assert(drawnTexts.some(function (t) { return t === (TCHAT.proactiveTag || '对方主动发来了消息'); }),
      '聊天页标出「对方主动发来了消息」');
    assert(render._fixedButtons().filter(function (b) { return b.label === (TCHAT.back || '返回'); }).length === 0,
      '主动发来的那一次没有「返回」，只能聊完往下走');

    /* 钉一条「灵魂拷问」，验证：按人格出题 + 踩雷大幅掉好感 */
    var grill = DB.list('chats').filter(function (c) { return c.kind === 'grill'; })[0];
    assert(!!grill && !!grill.personalityId, '灵魂拷问剧情存在且绑定人格（' + (grill && grill.id) + '）');
    var stG = render._chat();
    stG.chat = grill;
    stG.phase = 'pick';
    stG.picked = -1;
    stG.proactive = false;
    drawnTexts.length = 0;
    render.draw();
    assert(drawnTexts.some(function (t) { return t === grill.opener[0]; }), '灵魂拷问剧情正常展示');
    assert(drawnTexts.some(function (t) { return t.indexOf('灵魂拷问') >= 0; }), '标出「灵魂拷问」的调性');

    var badIdx = -1, goodIdx = -1;
    grill.options.forEach(function (o, i) {
      if (o.correct) { if (goodIdx < 0) goodIdx = i; } else if (badIdx < 0) badIdx = i;
    });
    assert(badIdx >= 0 && goodIdx >= 0, '灵魂拷问同时有踩雷项与答对项');
    S1.affection = 60;
    var gOpts = render._buttons().filter(function (b) { return b.selectable; });
    gOpts[badIdx].onClick();
    render._fixedButtons().filter(function (b) { return b.label === sendLabel; })[0].onClick();
    var gDrop = S1.affection - 60;
    assert(gDrop <= -20, '灵魂拷问答错时好感大幅下降（' + gDrop + '）');
    drawnTexts.length = 0;
    render.draw();
    assert(drawnTexts.some(function (t) { return t === (TCHAT.verdictBad || '这话说得不太妙'); }),
      '灵魂拷问答错后给出「答错」提示');

    /* 暧昧事件：答对大幅涨好感 */
    var flirt = DB.list('chats').filter(function (c) { return c.kind === 'flirt'; })[0];
    assert(!!flirt && !!flirt.personalityId, '暧昧剧情存在且绑定人格（' + (flirt && flirt.id) + '）');
    var stF = render._chat();
    stF.chat = flirt;
    stF.phase = 'pick';
    stF.picked = -1;
    S1.affection = 40;
    drawnTexts.length = 0;
    render.draw();
    assert(drawnTexts.some(function (t) { return t.indexOf('暧昧') >= 0; }), '标出「暧昧时刻」的调性');
    var goodF = 0;
    flirt.options.forEach(function (o, i) { if (o.correct) goodF = i; });
    var fOpts = render._buttons().filter(function (b) { return b.selectable; });
    fOpts[goodF].onClick();
    render._fixedButtons().filter(function (b) { return b.label === sendLabel; })[0].onClick();
    var fGain = S1.affection - 40;
    assert(fGain >= 15, '暧昧事件答对时好感大幅提升（+' + fGain + '）');
    drawnTexts.length = 0;
    render.draw();
    assert(drawnTexts.some(function (t) { return t === (TCHAT.verdictGood || '答到点子上了'); }),
      '暧昧事件答对后给出「答对」提示');

    /* 被「必须当面约会」锁住：入口还在，点进去只能说一句「多当面接触」 */
    S1.mustDate = true;
    S1.relationship = 'talking';
    /* 先离开聊天页回到主界面（主动发来的那次没有「返回」按钮，这里直接复位标记） */
    if (render._chat()) render._chat().proactive = false;
    render.closeChat();
    assert(render._state().scene === 'play', '闲聊结束后回到主界面');
    render.backToChoose();
    render.gotoSeek();          // 微信入口在「寻找相亲机会」二级页里
    render.draw();
    var lockedEntry = render._buttons().filter(function (b) { return b.label === chatTitleLabel; });
    assert(lockedEntry.length === 1, '「必须约会」期间仍然显示微信入口（而不是凭空消失）');
    drawnTexts.length = 0;
    render.draw();
    assert(drawnTexts.some(function (t) { return t === (TCHAT.lockedSub || '先当面见一面再聊'); }),
      '入口副标题换成「先当面见一面再聊」');

    render.openChat(false);
    assert(!!(render._chat() && render._chat().locked), '锁定期间点闲聊 → 进入锁定提示页');
    drawnTexts.length = 0;
    render.draw();
    assert(drawnTexts.some(function (t) { return t === (TCHAT.lockedLine || '我们还是多当面接触吧'); }),
      '聊天界面显示「我们还是多当面接触吧」');
    render.closeChat();
    assert(render._state().scene === 'play', '锁定提示页可以返回');

    /* 聊完固定剧情 → 进入「必须当面约会」，并且这一整天就过去了 */
    S1.mustDate = false;
    S1.proactiveChats = 0;
    S1.relationship = 'talking';
    S1.affection = 50;
    render.openChat(true);
    var mustId = DB.num('CHAT_MUST_DATE_ID', 'c_mustdate');
    var mustSc = DB.list('chats').filter(function (c) { return c.id === mustId; })[0];
    assert(!!mustSc, '固定剧情 ' + mustId + ' 已在 chats 集合里');
    var stM = render._chat();
    stM.chat = mustSc;
    stM.phase = 'pick';
    stM.picked = -1;
    stM.proactive = true;
    var mOpts = render._buttons().filter(function (b) { return b.selectable; });
    mOpts[0].onClick();
    render._fixedButtons().filter(function (b) { return b.label === sendLabel; })[0].onClick();
    assert(S1.mustDate === true, '聊完固定剧情后进入「必须当面约会」状态');
    assert(S1.proactiveChats === 1, '对方主动聊天计数 +1（' + S1.proactiveChats + '）');
    drawnTexts.length = 0;
    render.draw();
    assert(drawnTexts.some(function (t) { return t.indexOf('当面') >= 0; }),
      '固定剧情后提示「接下来得当面见一面」');

    var dayB2 = S1.day;
    var costB2 = engine.actionDays('chat', S1);
    var todayObj = render._state().today;
    render.finishChat();
    var stA = render._state();
    assert(stA.S.day === dayB2 + costB2, '主动聊天结束后推进 ' + costB2 + ' 天');
    assert(stA.today !== todayObj,
      '聊天占掉了这一整天：结算后直接换到新的一天，没有回到行动选择');

    /* 约一次会 → 解锁微信，计数归零 */
    S1.mustDate = true;
    S1.proactiveChats = 2;
    S1.affection = 55;
    engine.goDate(S1, 'simple');
    assert(S1.mustDate === false, '安排约会后解除「必须当面约会」');
    assert(S1.proactiveChats === 0, '安排约会后主动聊天计数归零');

    /* ---------- 倒计时：只有单身中才扣减，接触中暂停 ---------- */
    console.log('  -- 相亲倒计时规则 --');
    var bg0 = DB.list('backgrounds')[0].id;
    var cs = engine.createGame('m', bg0, 'marry', 7, 'normal');
    cs.relationship = 'single';
    cs.singleStreak = 0;
    engine.advanceDays(cs, 5);
    assert(cs.singleStreak === 5, '单身中倒计时正常扣减（0 → ' + cs.singleStreak + '）');

    cs.relationship = 'talking';
    engine.advanceDays(cs, 10);
    assert(cs.singleStreak === 5, '接触中倒计时暂停（保持在 ' + cs.singleStreak + '）');

    cs.relationship = 'meeting';
    engine.advanceDays(cs, 3);
    assert(cs.singleStreak === 5, '初遇中倒计时暂停（保持在 ' + cs.singleStreak + '）');

    cs.relationship = 'dating';
    engine.advanceDays(cs, 2);
    assert(cs.singleStreak === 0, '确定关系后倒计时归零（' + cs.singleStreak + '）');

    /* 边界：当天已经相到人（lead 存在）但还没赴约初遇 → 也要暂停 */
    var csL = engine.createGame('m', bg0, 'marry', 9, 'normal');
    csL.relationship = 'single';
    csL.singleStreak = 5;
    csL.lead = { id: 'p_check', name: '待见面', job: '', gender: 'f', seenDates: [] };
    assert(engine.deadlineState(csL).running === false,
      '已有相亲对象待初遇 → 倒计时判定为暂停');
    engine.advanceDays(csL, 4);
    assert(csL.singleStreak === 5,
      '已有相亲对象待初遇 → 倒计时暂停（保持在 ' + csL.singleStreak + '）');
    csL.lead = null;
    engine.advanceDays(csL, 3);
    assert(csL.singleStreak === 8,
      '对象清空（初遇失败 / 分手）后倒计时恢复走表（5 → ' + csL.singleStreak + '）');

    /* 到点但仍在接触中 → 不判负；回到单身才判负 */
    var cs2 = engine.createGame('m', bg0, 'marry', 8, 'normal');
    cs2.singleLimit = 30;
    cs2.singleStreak = 30;
    cs2.relationship = 'talking';
    assert(engine.checkEnd(cs2) === null, '期限到点但仍在接触中 → 不进入失败结局');
    cs2.relationship = 'single';
    var endTL = engine.checkEnd(cs2);
    assert(!!endTL, '期限到点且仍单身 → 进入失败结局');
    assert(!!(endTL.reason && endTL.reason.key === 'deadline'), '失败原因是相亲期限（deadline）');

    /* 时间上限（maxDays）到点时的兜底结局：文案必须跟当时的关系状态对得上。
     * 旧版一律用 timeout（「你既没有走进婚姻」）—— 玩「城市立足」这类跟婚恋
     * 无关的目标时，求婚成功反而被判定成「没走进婚姻」。 */
    function pastLimit(goalId, rel) {
      var x = engine.createGame('m', bg0, goalId, 11, 'normal');
      x.day = x.diff.maxDays;                 // 再走一天就越过上限
      x.relationship = rel;
      if (rel !== 'single') x.partner = partnerObj;
      if (rel === 'married') { x.flags.marriedOnce = true; x.affection = 120; }
      x.money = 30000; x.career = 40;         // 离「城市立足」还差得远
      return engine.advanceDays(x, 1);
    }
    var eM = pastLimit('settle', 'married');
    assert(!!eM && eM.id === 'married_stall',
      '已结婚 + 时间到 → 「婚姻里的将就」（实=' + (eM && eM.id) + '）');
    assert(!!eM && eM.type === 'lose' && eM.art === 'badmarry',
      '已婚兜底结局是 lose · badmarry 画面（实=' + (eM && eM.art) + '）');
    assert(!!eM && eM.lines.join('').indexOf('{p}') < 0 &&
      eM.lines.join('').indexOf(partnerObj.name) >= 0,
      '失败结局也做占位符替换（{p} → 对象名，画面上不会出现字面量 {p}）');
    var eT = pastLimit('settle', 'talking');
    assert(!!eT && eT.id === 'stalled',
      '有对象但未婚 + 时间到 → 「停在原地」（实=' + (eT && eT.id) + '）');
    var eS = pastLimit('settle', 'single');
    assert(!!eS && eS.id === 'timeout',
      '单身 + 时间到 → 「时间到了」（实=' + (eS && eS.id) + '）');
    assert(!!eS && eS.lines.join('').indexOf('没有走进婚姻') >= 0,
      '单身兜底沿用「没走进婚姻」的文案（只在单身时才成立）');

    /* 倒计时卡片：非单身时应提示「暂停」 */
    var S3 = render._state().S;
    render.gotoTitle();
    render.resumeGame({
      v: 1, gender: S3.gender, bgId: S3.bg.id, goalId: 'marry', seed: S3.seed,
      difficultyId: S3.diff.id, day: 20, money: 50000, health: 80, career: 40,
      looks: 60, family: 40, mood: 60, affection: 30,
      relationship: 'talking', partner: partnerObj, lead: null,
      flags: {}, singleStreak: 12, singleLimit: 60, relStartDay: 15, recent: [], log: [],
      history: [], acts: []
    });
    drawnTexts.length = 0;
    render.draw();
    assert(drawnTexts.some(function (t) { return t === '相亲期限'; }), '主界面展示倒计时卡片');
    assert(drawnTexts.some(function (t) { return t.indexOf('接触中') >= 0 && t.indexOf('暂停') >= 0; }),
      '接触中时倒计时卡片提示「暂停」');
    render._state().S.relationship = 'single';
    render._state().S.singleStreak = 12;
    drawnTexts.length = 0;
    render.draw();
    assert(drawnTexts.some(function (t) { return t.indexOf('仍单身') >= 0; }),
      '单身时倒计时卡片提示「仍单身（正在走表）」');

    /* 已有相亲对象、还没赴约初遇 → 卡片也要说清楚是「暂停」 */
    render._state().S.relationship = 'single';
    render._state().S.lead = { id: 'p_check', name: '待见面', job: '', gender: 'f', seenDates: [] };
    drawnTexts.length = 0;
    render.draw();
    assert(drawnTexts.some(function (t) { return t.indexOf('待赴约') >= 0; }),
      '已有相亲对象待初遇时，倒计时卡片提示「已相到人，待赴约（倒计时暂停）」');
    render._state().S.lead = null;

    /* ---------- 事件 / 聊天的接触阶段分级 ---------- */
    console.log('  -- 接触阶段分级 --');
    assert(engine.stageRank('single') < engine.stageRank('talking'), '阶段顺序：单身 < 接触中');
    assert(engine.stageRank('talking') < engine.stageRank('dating'), '阶段顺序：接触中 < 恋爱中');
    assert(engine.stageRank('dating') < engine.stageRank('married'), '阶段顺序：恋爱中 < 婚后');

    var datingStage = DB.list('events').filter(function (e) { return e.stage === 'dating'; });
    assert(datingStage.length > 0, '存在只给「告白成功后」的事件（' + datingStage.length + ' 条）');
    var kidEv = datingStage.filter(function (e) { return e.id === 'dt_question_kid'; })[0];
    assert(!!kidEv, '「要不要孩子」被标为婚嫁向（stage=dating）');

    var ts = engine.createGame('f', bg0, 'marry', 9, 'normal');
    ts.courtStyle = 'modest';
    ts.partner = partnerObj;
    ts.affection = 60;
    ts.relationship = 'talking';
    assert(engine.stageOk(ts, kidEv) === false, '接触中达不到婚嫁向事件的阶段');
    ts.relationship = 'dating';
    assert(engine.stageOk(ts, kidEv) === true, '告白成功后可以达到婚嫁向事件的阶段');

    /* 反复抽约会事件：接触中不应出现任何婚嫁向内容 */
    ts.relationship = 'talking';
    ts.money = 200000;
    var leak = 0;
    for (var gi = 0; gi < 300; gi++) {
      var rd = engine.goDate(ts, 'standard');
      if (rd && rd.event && rd.event.stage) leak++;
    }
    assert(leak === 0, '接触中 300 次约会都没有婚嫁向事件（实际 ' + leak + ' 次）');

    /* 闲聊：见家长（婚嫁信号）只在告白成功后出现 */
    var momChat = DB.list('chats').filter(function (c) { return c.id === 'c_mom'; })[0];
    assert(!!momChat && momChat.phases.indexOf('talking') < 0, '见家长剧情不在接触中出现');
    ts.relationship = 'talking';
    ts.affection = 80;
    var talkChats = engine.chatPool(ts);
    assert(talkChats.length > 0, '接触中仍有可聊的暧昧向剧情（' + talkChats.length + ' 条）');
    assert(talkChats.every(function (c) { return c.phases.indexOf('talking') >= 0; }),
      '接触中可聊的剧情都允许接触中阶段');
    assert(talkChats.filter(function (c) { return c.id === 'c_mom'; }).length === 0,
      '接触中抽不到见家长剧情');
    ts.relationship = 'dating';
    assert(engine.chatPool(ts).filter(function (c) { return c.id === 'c_mom'; }).length === 1,
      '告白成功后见家长剧情才进入闲聊池');

    /* ---------- 属性结算：不再有随机浮动 ---------- */
    console.log('  -- 属性结算不再随机浮动 --');
    assert(DB.num('FX_ROLL_MIN', null) === null && DB.num('FX_ROLL_RANGE', null) === null,
      '数据库里已删除随机浮动常量（FX_ROLL_MIN / FX_ROLL_RANGE）');

    function fxState() {
      var st = engine.createGame('m', bg0, 'marry', 11, 'normal');
      st.health = 50; st.mood = 50; st.career = 50; st.looks = 50; st.family = 50;
      st.money = 100000;
      st.relationship = 'talking';
      st.partner = { name: '测试', job: '程序员', gender: 'f', personalityId: 'emo', mod: {}, seenDates: [] };
      return st;
    }
    var fxEff = { money: 1000, health: 3, career: -2, mood: 4, affection: 6 };
    var dA = engine.applyFx(fxState(), fxEff).delta;
    var dB = engine.applyFx(fxState(), fxEff).delta;
    assert(JSON.stringify(dA) === JSON.stringify(dB),
      '同一组效果两次结算结果完全一致（不再 ±25% 随机）');
    assert(dA.health === 3 && dA.career === -2 && dA.mood === 4,
      '健康 / 事业 / 情绪的变化等于事件写死的数值（' + dA.health + ' / ' + dA.career + ' / ' + dA.mood + '）');
    assert(dA.affection === dB.affection && dA.affection !== 0,
      '好感度结算也是确定的（' + dA.affection + '）');

    /* 见面第一印象同样不再随机：同一个人、同样的状态，结果一致 */
    function meetState() {
      var st = engine.createGame('m', bg0, 'marry', 13, 'normal');
      st.looks = 60; st.family = 45; st.mood = 60;
      st.lead = engine.hydratePartner(DB.list('partners').filter(function (p) { return p.gender === 'f'; })[0]);
      return st;
    }
    var m1 = engine.firstMeet(meetState()).partner;
    var m2 = engine.firstMeet(meetState()).partner;
    assert(m1.name === m2.name && m1.id === m2.id, '首访对象来自数据库花名册（' + m1.name + '）');
    var a1 = meetState(); engine.firstMeet(a1);
    var a2 = meetState(); engine.firstMeet(a2);
    assert(a1.affection === a2.affection, '第一印象不再随机（两次都是 ' + a1.affection + '）');

    /* ---------- 相亲对象全部来自数据库 ---------- */
    console.log('  -- 相亲对象来自数据库 --');
    var rosterF = DB.list('partners').filter(function (p) { return p.gender === 'f'; });
    var rosterM = DB.list('partners').filter(function (p) { return p.gender === 'm'; });
    assert(rosterF.length >= 8 && rosterM.length >= 8,
      'partners 花名册分男女：' + rosterF.length + ' 女 / ' + rosterM.length + ' 男');
    assert(rosterF.concat(rosterM).every(function (p) {
      return p.id && p.name && p.avatar && p.job && p.looks > 0 && p.family > 0;
    }), '每位对象都登记了 id / 姓名 / 头像 / 职业 / 颜值 / 家境');
    assert(rosterF.every(function (p) {
      return (DB.get('materials').jobs || []).some(function (j) { return j.job === p.job; });
    }), '对象的职业都能在 materials.jobs 里查到（头像与备注可解析）');

    var allNames = DB.list('partners').map(function (p) { return p.name; });
    var fromRoster = true;
    for (var gi2 = 0; gi2 < 40; gi2++) {
      var pg2 = engine.generatePartner('m', 60, 50, []);
      if (!pg2 || allNames.indexOf(pg2.name) < 0 || pg2.gender !== 'f') { fromRoster = false; break; }
    }
    assert(fromRoster, '抽 40 次都落在数据库花名册里（不再随机拼装姓名 / 职业）');

    var seenIds = [];
    for (var si2 = 0; si2 < rosterF.length; si2++) {
      var px = engine.generatePartner('m', 60, 50, seenIds);
      if (!px) break;
      seenIds.push(px.id);
    }
    var uniq = {};
    seenIds.forEach(function (id) { uniq[id] = true; });
    assert(seenIds.length === rosterF.length && Object.keys(uniq).length === seenIds.length,
      '同一局里优先抽没见过的对象（' + rosterF.length + ' 位异性全部覆盖且不重复）');

    var metState = engine.createGame('m', bg0, 'marry', 21, 'normal');
    var metOne = engine.generatePartner('m', 50, 50, metState.met);
    engine.markMet(metState, metOne);
    assert(metState.met.length === 1 && metState.met[0] === metOne.id,
      '遇见的对象会记进本局 met 列表（' + metOne.name + '）');
    assert(engine.generatePartner('m', 50, 50, metState.met).id !== metOne.id,
      '下一次不会重复抽到同一个人');

    /* ---------- 相亲图鉴 ---------- */
    console.log('  -- 相亲图鉴 --');
    delete storage['xq_gallery_v1'];                  // 从零开始，断言可复现
    var gWho = engine.hydratePartner(rosterF[0]);
    var gMob = engine.hydratePartner(rosterM[0]);
    render.gotoTitle();
    render.resumeGame({
      v: 1, gender: 'm', bgId: bg0, goalId: 'marry', seed: 777,
      difficultyId: 'normal', day: 12, money: 80000, health: 70, career: 50,
      looks: 60, family: 45, mood: 60, affection: 42,
      relationship: 'talking', partner: gWho, lead: null,
      flags: {}, singleStreak: 0, singleLimit: 60, relStartDay: 5, recent: [], log: [],
      history: [], acts: [], met: [gWho.id]
    });
    render.saveGame();                                // 存档即同步进图鉴
    var grec = render._gallery().records[gWho.id];
    assert(!!grec, '与对象接触后，图鉴里出现解锁记录');
    assert(grec.stage === 'talking', '记录里存了达到的接触阶段（' + grec.stage + '）');
    assert(grec.aff === 42, '记录了好感度峰值（' + grec.aff + '）');
    assert(!render._gallery().records[gMob.id], '没遇见过的对象不会出现在图鉴记录里');

    drawnTexts.length = 0;
    render.openGallery();
    assert(render._state().scene === 'gallery', '从主界面能打开「相亲图鉴」');
    assert(render._galleryTab() === 'f', '默认展示异性（女生）分栏');
    assert(drawnTexts.some(function (t) { return t === '相亲图鉴'; }), '图鉴页有标题');
    assert(drawnTexts.some(function (t) { return t === gWho.name; }), '已解锁对象显示姓名');
    assert(drawnTexts.some(function (t) { return t === '？？？'; }), '未解锁对象显示问号占位（黑框 + ？）');
    assert(drawnTexts.some(function (t) { return t === '未解锁'; }), '未解锁对象标注「未解锁」');
    assert(drawnTexts.some(function (t) { return t === '接触中'; }),
      '已解锁对象展示达成的进展（接触中）');

    render.gallerySetTab('m');
    assert(render._galleryTab() === 'm', '图鉴可切换到「男生」分栏');
    drawnTexts.length = 0;
    render.gallerySetTab('f');
    render.openGalleryDetail(gWho.id);
    assert(render._state().scene === 'galleryDetail', '点已解锁卡片进入图鉴资料页');
    assert(drawnTexts.some(function (t) { return t === '达成的进展'; }), '资料页展示「达成的进展」');
    assert(drawnTexts.some(function (t) { return t === gWho.tagline || t.indexOf(gWho.tagline) >= 0; }),
      '资料页展示一句话简介');
    render.backFromGalleryDetail();
    assert(render._state().scene === 'gallery', '资料页可返回图鉴');
    render.closeGallery();
    assert(render._state().scene === 'play', '图鉴可返回主界面');

    /* 主界面底部有图鉴入口 */
    var galBtn = render._fixedButtons().filter(function (b) { return b.label === '相亲图鉴'; });
    assert(galBtn.length === 1, '主界面底部固定操作区有「相亲图鉴」入口');

    /* 阶段只升不降：结婚后再回到旧阶段，图鉴仍记最高阶段 */
    function resumeWith(rel, aff) {
      render.gotoTitle();
      render.resumeGame({
        v: 1, gender: 'm', bgId: bg0, goalId: 'marry', seed: 778,
        difficultyId: 'normal', day: 40, money: 90000, health: 70, career: 55,
        looks: 60, family: 45, mood: 60, affection: aff,
        relationship: rel, partner: gWho, lead: null,
        flags: { child: true }, singleStreak: 0, singleLimit: 60, relStartDay: 5,
        recent: [], log: [], history: [], acts: [], met: [gWho.id]
      });
      render.saveGame();
    }
    resumeWith('married', 88);
    var rMarried = render._gallery().records[gWho.id];
    assert(rMarried.stage === 'married', '结婚后图鉴阶段升到「已结婚」');
    assert(rMarried.aff === 88, '好感度峰值随之更新（' + rMarried.aff + '）');
    assert(rMarried.child === true, '有了孩子也记进图鉴');
    resumeWith('talking', 30);
    assert(render._gallery().records[gWho.id].stage === 'married',
      '图鉴阶段只升不降（再回接触中仍记「已结婚」）');
    assert(render._gallery().records[gWho.id].aff === 88, '好感度峰值只升不降');
    render.openGallery();
    drawnTexts.length = 0;
    render.draw();
    assert(drawnTexts.some(function (t) { return t === '已结婚'; }), '图鉴卡片展示「已结婚」阶段名');
    render.openGalleryDetail(gWho.id);
    assert(drawnTexts.some(function (t) { return t.indexOf('已有孩子') >= 0; }),
      '图鉴资料页展示「已有孩子」徽标');
    render.backFromGalleryDetail();
    render.closeGallery();

    /* ---------- 布局间距：文字之间 / 与固定层不重叠 ---------- */
    console.log('  -- 布局间距（文字不重叠） --');
    function auditLayout(label) {
      render._clearFlash();           // 飘字动效是刻意的覆盖层，审计前先关掉
      render._clearFlashBar();        // 发薪 / 分手提示条同理（常驻 3 秒，会压住正文）
      textOps.length = 0;
      render.draw();
      /* 底部操作区上沿：单行布局（BOTTOM_GAP + BAR_BTN_H）vs「确认置顶」布局
       * （次级行 44 + 间距 10 + 确认 48 + BOTTOM_GAP）。后者更高，需动态跳过，
       * 否则确认条会压住下方内容被误判为重叠。 */
      var bos = render._bottomActions() || [];
      var split = bos.some(function (a) { return a.opts.key === 'confirm'; }) && bos.length >= 2;
      /* 底部叠加层顶边由渲染层给出：含「已选提示」时比按钮更高，一并跳过；
       * 无底部操作区时返回 H（不跳过任何内容）。 */
      var barTop = (typeof render._barTop === 'function') ? render._barTop()
        : (split ? (667 - 16 - 44 - 10 - 48) : (667 - 16 - 46));
      var ov = cm.findTextOverlaps(textOps, { skipBottom: barTop - 2, minOverlap: 2 });
      ov.slice(0, 3).forEach(function (o) {
        console.log('      ⚠ ' + label + '：「' + o.a + '」× 「' + o.b + '」重叠 ' +
          o.overlapX + '×' + o.overlapY + ' @' + o.aAt + ' / ' + o.bAt);
      });
      assert(ov.length === 0, label + ' 文字无重叠（' + ov.length + ' 处）');
    }

    /* 设定页（合并页）：第 0 页「性别一行两个 + 出身背景联动」，第 1 页「目标 + 难度」 */
    render.startSetup();
    var aGBtns = render._buttons().filter(function (b) { return b.setup === 'gender'; });
    aGBtns[0].onClick();
    var aBgBtns = render._buttons().filter(function (b) { return b.setup === 'bg'; });
    aBgBtns[0].onClick();
    auditLayout('设定页（性别 + 出身）');
    render._fixedButtons().filter(function (b) { return b.label === '确认'; })[0].onClick();
    var aGoalOpts = render._buttons().filter(function (b) { return b.setup === 'goal'; });
    if (aGoalOpts.length) aGoalOpts[0].onClick();
    var aDOpts = render._buttons().filter(function (b) { return b.setup === 'diff'; });
    aDOpts[0].onClick();
    auditLayout('设定页（目标 + 难度）');

    /* 卡片式重构：设定页 =「步骤标签 + 序号区块标题 + 富卡片（难度胶囊 + 属性 chips）+ 底部已选提示」 */
    render.startSetup();
    render._buttons().filter(function (b) { return b.setup === 'gender'; })[0].onClick();
    render._buttons().filter(function (b) { return b.setup === 'bg'; })[0].onClick();
    drawnTexts.length = 0;
    render.draw();
    assert(drawnTexts.some(function (t) { return t === '开局设定 · CHARACTER SETUP'; }),
      '设定页顶部展示「开局设定 · CHARACTER SETUP」步骤标签');
    assert(drawnTexts.some(function (t) { return /★/.test(String(t)); }),
      '出身背景卡片带「起步难度」星级胶囊');
    assert(drawnTexts.some(function (t) { return t === '存款'; }),
      '出身背景卡片用「存款」等属性 chips 展示初始属性');
    assert(drawnTexts.some(function (t) { return String(t).indexOf('当前已选') === 0; }),
      '底部确认栏上方展示「当前已选」提示');

    /* 主界面：单身（含倒计时卡片） */
    render.gotoTitle();
    render.resumeGame({
      v: 1, gender: 'm', bgId: bg0, goalId: 'marry', seed: 4242,
      difficultyId: 'normal', day: 30, money: 68000, health: 72, career: 46,
      looks: 58, family: 44, mood: 61, affection: 0,
      relationship: 'single', partner: null, lead: null,
      flags: {}, singleStreak: 22, singleLimit: 60, relStartDay: null, recent: [], log: [],
      history: [{ day: 29, delta: { money: -1200, mood: 2 }, from: { money: 69200, mood: 59 }, to: { money: 68000, mood: 61 }, label: '▸ 加班到深夜' }],
      acts: [{ day: 29, title: '▸ 加班到深夜', event: ['办公室只剩你一个人。'], option: '再撑一会儿', result: '你把这版方案改完了。' }]
    });
    auditLayout('主界面（单身 + 倒计时）');

    /* 主界面：已相到人、还没见面（好感度条 + 微信闲聊入口都要在） */
    render.resumeGame({
      v: 1, gender: 'm', bgId: bg0, goalId: 'marry', seed: 4244,
      difficultyId: 'normal', day: 33, money: 70000, health: 73, career: 47,
      looks: 59, family: 45, mood: 62, affection: 12,
      relationship: 'single', partner: null, lead: partnerObj,
      flags: {}, singleStreak: 25, singleLimit: 60, relStartDay: null, recent: [], log: [],
      history: [], acts: []
    });
    auditLayout('主界面（待赴约 · 见面前）');

    /* 主界面：有对象（含属性提示 + 资料入口）。
     * 好感度取 480 —— 三位数 + 「/500」，是这条最宽的样子，专门用来压排版。 */
    render.resumeGame({
      v: 1, gender: 'm', bgId: bg0, goalId: 'marry', seed: 4243,
      difficultyId: 'normal', day: 45, money: 88000, health: 76, career: 52,
      looks: 60, family: 46, mood: 64, affection: 480,
      relationship: 'dating', partner: partnerObj, lead: null,
      flags: {}, singleStreak: 0, singleLimit: 60, relStartDay: 38, recent: [], log: [],
      history: [], acts: []
    });
    auditLayout('主界面（恋爱中）');

    /* 主界面：有对象 + 关系预警挂着。
     * 预警只在提示条上闪 3 秒太容易错过，所以关系卡里必须常驻一条 ——
     * 这条信息决定玩家接下来几天要不要优先救某一项属性。 */
    render.resumeGame({
      v: 1, gender: 'm', bgId: bg0, goalId: 'marry', seed: 4245,
      difficultyId: 'normal', day: 52, money: 9000, health: 70, career: 48,
      looks: 60, family: 46, mood: 30, affection: 120,
      relationship: 'dating', partner: partnerObj, lead: null,
      flags: {}, singleStreak: 0, singleLimit: 60, relStartDay: 38,
      partnerSinceDay: 38, leaveWarnDay: 49, leaveStrikes: 0,
      leaveWarnReason: '你账户里的数字，让她越来越不安。',
      recent: [], log: [], history: [], acts: []
    });
    auditLayout('主界面（关系预警挂着）');
    assert(drawnTexts.some(function (t) { return t.indexOf('关系预警') >= 0; }),
      '关系预警挂在主界面关系卡上（不用靠一闪而过的提示条）');
    assert(drawnTexts.some(function (t) { return t.indexOf('越来越不安') >= 0; }),
      '预警把「是哪一项出问题」写清楚了（原因原文）');
    /* 预警解除 → 提示条随之消失（否则玩家看不出「已经救回来了」） */
    render._state().S.leaveWarnDay = null;
    render._state().S.leaveWarnReason = null;
    drawnTexts.length = 0;
    render.draw();
    assert(!drawnTexts.some(function (t) { return t.indexOf('关系预警') >= 0; }),
      '预警解除后关系卡上的提示条消失');
    auditLayout('主界面（预警已解除）');

    /* 事件页（未确认）与页内结果 */
    render.actLife();
    auditLayout('事件页（选项态）');
    render.chooseOption(0);
    auditLayout('事件页（页内结果）');
    advanceAfterResult(render);

    /* ---------- 事件页头像：跟相亲对象无关的随机事件不画对方 ---------- */
    console.log('  -- 事件页头像：无关的随机事件不展示对方 --');
    (function () {
      function mentionsPartner(e) {
        var hay = (e.text || []).join(' ') + ' ' +
          (e.options || []).map(function (o) { return (o.label || '') + ' ' + (o.result || ''); }).join(' ');
        return hay.indexOf('{p}') >= 0;
      }
      render.resumeGame({
        v: 1, gender: 'm', bgId: bg0, goalId: 'marry', seed: 777,
        difficultyId: 'normal', day: 45, money: 88000, health: 76, career: 52,
        looks: 60, family: 46, mood: 64, affection: 120,
        relationship: 'dating', partner: partnerObj, lead: null,
        flags: {}, singleStreak: 0, singleLimit: 60, relStartDay: 38, recent: [], log: [],
        history: [], acts: []
      });
      render.actLife();
      var T = render._state().today;
      assert(T.phase === 'event', '进入事件页（供头像断言用）');

      var solo = DB.list('events').filter(function (e) {
        return e.phase === 'any' && !mentionsPartner(e) && (e.options || []).length >= 2;
      })[0];
      var withP = DB.list('events').filter(function (e) {
        return mentionsPartner(e) && e.phase !== 'date' && (e.options || []).length >= 2;
      })[0];
      assert(!!solo && !!withP, '事件库里同时有「与对方无关」和「提到对方」的随机事件');

      /* 无关的随机事件：只画主角一张头像 */
      T.event = solo; T.dateType = null; T.action = null; T.resolved = false;
      render._clearFlash(); drawnTexts.length = 0; render.draw();
      assert(render._eventPartnerShown() === false,
        '无关事件（' + solo.id + '）不展示对方头像');
      assert(!drawnTexts.some(function (x) { return x === partnerObj.name; }),
        '无关事件页不画出对方名字（' + partnerObj.name + '）');
      assert(drawnTexts.some(function (x) { return x === '我'; }),
        '无关事件页仍然画主角名字');

      /* 点名了对方的事件：照旧双人 */
      T.event = withP; T.resolved = false;
      render._clearFlash(); drawnTexts.length = 0; render.draw();
      assert(render._eventPartnerShown() === true,
        '提到对方的事件（' + withP.id + '）展示对方头像');
      assert(drawnTexts.some(function (x) { return x === partnerObj.name; }),
        '有关事件页画出对方名字');

      /* 约会档位的事件：一定与对方有关 */
      T.dateType = 'simple';
      assert(render._eventPartnerShown() === true, '约会档位事件一定展示对方头像');
      T.dateType = null;
      render.backToPlay();
    })();

    /* ---------- 结算数值：只保留「看得见」的影响，且不铺满全属性 ---------- */
    console.log('  -- 结算数值：看得见的幅度 · 最多 3 项影响 --');
    (function () {
      ['events', 'chats'].forEach(function (coll) {
        var optCount = 0, empty = 0, badMoney = [], invisible = [], tooMany = [];
        DB.list(coll).forEach(function (d) {
          (d.options || []).forEach(function (o) {
            var fx = o.fx || {};
            /* zero 是「归零语义」的标记（见引擎 applyFx），不是一项数值影响：
             * 它不计入「最多 3 项」，也不参与「幅度太小」的判定。 */
            var keys = Object.keys(fx).filter(function (k) { return fx[k] && k !== 'zero'; });
            optCount++;
            if (!keys.length) empty++;
            if (keys.length > 3) tooMany.push(d.id);
            keys.forEach(function (k) {
              if (k === 'money') {
                if (Math.abs(fx[k]) < 100) badMoney.push(d.id + ':' + fx[k]);
              } else if (Math.abs(fx[k]) < 5) {
                invisible.push(d.id + ':' + k + fx[k]);
              }
            });
          });
        });
        assert(badMoney.length === 0,
          coll + ' 里没有「只动个位数」的存款影响（' + badMoney.slice(0, 3).join('、') + '）');
        assert(invisible.length === 0,
          coll + ' 里没有看不见的 ±1~4 属性噪声（' + invisible.slice(0, 3).join('、') + '）');
        assert(tooMany.length === 0,
          coll + ' 每个选项最多 3 项影响（超出：' + tooMany.slice(0, 3).join('、') + '）');
        assert(empty <= Math.ceil(optCount * 0.15),
          coll + ' 纯剧情选项（不硬凑数值）不超过 15%，实际 ' + empty + '/' + optCount);
      });

      /* ---------- 极端内容：属性归零 ----------
       * 断崖式后果用 fx.zero 表达（「存款归零」而不是「存款 -47 万」），
       * 因为负值会被属性下限截断，写多大都一样、还会误导玩家。
       * 关键约束：归零必须停在 FX_ZERO_FLOOR（保底 1 点）——
       * 真归 0 会立刻触发破产/抑郁结局，一条随机事件秒杀玩家等于没有玩法。 */
      var zeroOpts = [];
      ['events', 'chats'].forEach(function (coll) {
        DB.list(coll).forEach(function (d) {
          (d.options || []).forEach(function (o) {
            if (o.fx && o.fx.zero && o.fx.zero.length) zeroOpts.push({ coll: coll, doc: d, opt: o });
          });
        });
      });
      assert(zeroOpts.length >= 8,
        '存在足够的「属性归零」极端选项（实际 ' + zeroOpts.length + ' 处）');
      var STAT_KEYS = ['money', 'health', 'career', 'looks', 'family', 'mood', 'affection'];
      var badZeroKey = zeroOpts.filter(function (z) {
        return z.opt.fx.zero.some(function (k) { return STAT_KEYS.indexOf(k) < 0; });
      });
      assert(badZeroKey.length === 0,
        'zero 只声明七项基础属性（非法：' + badZeroKey.slice(0, 2).map(function (z) { return z.doc.id; }).join('、') + '）');
      var floor = (DB.get('constants') || {}).FX_ZERO_FLOOR || 1;
      var notFloor = [], killed = [];
      zeroOpts.forEach(function (z) {
        var s = engine.createGame('m', 'bg_youwo', 'free', 777, 'normal');
        s.money = 480000; s.mood = 72; s.health = 66; s.career = 55;
        /* 事件走 applyFx、聊天走 applyChat，两条路都要验证 */
        var res = (z.coll === 'chats') ? engine.applyChat(s, z.opt) : engine.applyFx(s, z.opt.fx, 1);
        z.opt.fx.zero.forEach(function (k) {
          if (s[k] !== floor) notFloor.push(z.doc.id + ':' + k + '=' + s[k]);
        });
        if (engine.checkEnd(s)) killed.push(z.doc.id + ':' + engine.checkEnd(s).id);
      });
      assert(notFloor.length === 0,
        '归零一律停在保底 ' + floor + ' 点（偏差：' + notFloor.slice(0, 3).join('、') + '）');
      assert(killed.length === 0,
        '归零不会当场触发结局（秒杀：' + killed.slice(0, 3).join('、') + '）');

      /* ---------- 极端内容必须真的抽得到 ----------
       * 权重 / 阶段（phase、stage）/ 人格定向（personalityId）任何一处写错，
       * 一条内容就会变成「永远抽不到」的死数据 —— 等于白写。
       * 这里用真实的抽取函数各跑几千次，确认六条事件、四条聊天都露过面。 */
      var X_EVENTS = ['x_single_hunmei', 'x_talking_privacy', 'x_any_guarantee',
        'x_dating_control', 'x_dating_married_secret', 'x_any_checkup'];
      var X_CHATS = ['n_x_c_hunmei', 'n_x_c_rage', 'n_x_c_secret', 'n_x_c_betrothal'];
      var seenEv = {}, seenCh = {};
      ['single', 'meeting', 'talking', 'dating'].forEach(function (rel) {
        var xs = engine.createGame('m', 'bg_youwo', 'free', 99, 'normal');
        xs.relationship = rel;
        xs.partner = (rel === 'single') ? null
          : { id: 'p', name: '对象', job: 'teacher', gender: 'f', avatar: null, personalityId: 'money' };
        for (var k = 0; k < 4000; k++) {
          var pe = engine.pickEvent(xs);
          if (pe) seenEv[pe.id] = (seenEv[pe.id] || 0) + 1;
        }
      });
      ['talking', 'dating', 'married'].forEach(function (rel) {
        ['money', 'emo', 'casual', 'family'].forEach(function (pid) {
          var cs = engine.createGame('m', 'bg_youwo', 'free', 99, 'normal');
          cs.relationship = rel;
          cs.partner = { id: 'p', name: '对象', job: 'teacher', gender: 'f', avatar: null, personalityId: pid };
          cs.affection = 80;
          for (var k2 = 0; k2 < 3000; k2++) {
            var pc = engine.pickChat(cs);
            if (pc) seenCh[pc.id] = (seenCh[pc.id] || 0) + 1;
          }
        });
      });
      var deadEv = X_EVENTS.filter(function (id) { return !seenEv[id]; });
      var deadCh = X_CHATS.filter(function (id) { return !seenCh[id]; });
      assert(deadEv.length === 0,
        '新增的 6 条极端事件都能被抽到（抽不到：' + (deadEv.join('、') || '无') + '）');
      assert(deadCh.length === 0,
        '新增的 4 条极端聊天都能被抽到（抽不到：' + (deadCh.join('、') || '无') + '）');

      /* 存款影响都落在游戏经济「看得见」的区间（起步存款 5k~80w、求婚 6w） */
      var moneys = [];
      DB.list('events').forEach(function (e) {
        (e.options || []).forEach(function (o) {
          if (o.fx && o.fx.money) moneys.push(Math.abs(o.fx.money));
        });
      });
      assert(moneys.length > 100 && Math.min.apply(null, moneys) >= 100,
        '事件里的存款影响都在 100 元以上（最小 ' + Math.min.apply(null, moneys) +
        ' 元，共 ' + moneys.length + ' 处）');

      /* 聊天的扁平字段与 fx 必须同源（引擎两种写法都读） */
      var mismatch = 0;
      DB.list('chats').forEach(function (c) {
        (c.options || []).forEach(function (o) {
          var fx = o.fx || {};
          if ((o.affection || 0) !== (fx.affection || 0) || (o.mood || 0) !== (fx.mood || 0)) mismatch++;
        });
      });
      assert(mismatch === 0, '聊天的 affection / mood 与 fx 同源（不一致 ' + mismatch + ' 条）');
    })();

    /* 对方资料 / 近期变化 / 近期经历 */
    render.openPartnerProfile();
    auditLayout('对方资料页');
    render.backToPlay();
    render.openStatDetail();
    auditLayout('近期变化页');
    render.backToPlay();
    render.openRecent();
    auditLayout('近期经历页');
    render.backToPlay();

    /* 微信闲聊（对话框） */
    render.openChat();
    auditLayout('微信闲聊页');
    render.closeChat();

    /* 相亲图鉴（两个分栏）+ 图鉴资料页 */
    render.openGallery();
    auditLayout('相亲图鉴（女生栏）');
    render.gallerySetTab('m');
    auditLayout('相亲图鉴（男生栏）');
    render.gallerySetTab('f');
    var gid0 = Object.keys(render._gallery().records)[0];
    assert(!!gid0, '布局审计前图鉴里已有解锁对象');
    render.openGalleryDetail(gid0);
    auditLayout('图鉴资料页');
    render.backFromGalleryDetail();
    render.closeGallery();
    assert(render._state().scene === 'play', '图鉴页返回后回到主界面');

    /* 相亲机会结果页（花销 + 信封卡片） */
    var S4 = render._state().S;
    var paidCh = DB.list('channels').filter(function (c) { return c.cost > 0; })[0];
    assert(!!paidCh, '存在花钱的相亲渠道（' + (paidCh && paidCh.name) + '）');
    /* 相亲有成功率，这里直接重试到成功为止（只为了审计信封卡片的排版）。
     * 注意：落空现在会弹二级浮窗，循环里要先把浮窗关掉，否则残留的浮窗会盖在成功页上。 */
    var seekOk = false;
    for (var si = 0; si < 120 && !seekOk; si++) {
      S4.relationship = 'single'; S4.partner = null; S4.lead = null; S4.money = 300000;
      render.gotoSeek();
      render.actSeek(paidCh.id);
      if (render._seekFailModalOpen && render._seekFailModalOpen()) {
        var xb = render._fixedButtons().filter(function (b) { return b.label && b.label.indexOf('继续') >= 0; })[0];
        if (xb && typeof xb.onClick === 'function') xb.onClick();   // 关掉「没找到合适的」浮窗，准备下一次重试
      }
      var t4 = render._state().today;
      seekOk = !!(t4 && t4.phase === 'done' && t4.result && t4.result.lead);
    }
    assert(seekOk, '相亲成功过一次（信封卡片可审计）');
    var env = render._envelope();
    assert(!!env && env.contentBottom <= env.bottom - 4,
      '信封卡片内容不溢出卡片底部（内容 ' + Math.round(env.contentBottom - env.y) +
      ' ≤ 卡高 ' + Math.round(env.h) + '）');
    auditLayout('相亲结果页（信封卡片）');
    advanceAfterResult(render);

    /* 微信闲聊的两种新形态：灵魂拷问（结果态）与锁定提示页 */
    var S5 = render._state().S;
    S5.relationship = 'talking';
    S5.mustDate = false;
    S5.partner = partnerObj;
    S5.affection = 45;
    render.backToChoose();
    render.openChat(false);
    var gr2 = DB.list('chats').filter(function (c) { return c.kind === 'grill'; })[0];
    var stA2 = render._chat();
    assert(!!stA2, '布局审计：聊天页已就绪');
    stA2.chat = gr2;
    stA2.phase = 'pick';
    stA2.picked = 0;
    stA2.proactive = false;
    render.draw();
    auditLayout('微信闲聊（灵魂拷问 · 选项态）');
    var sendL = DB.text('chat').send || '发送';
    render._buttons().filter(function (b) { return b.selectable; })[0].onClick();
    render._fixedButtons().filter(function (b) { return b.label === sendL; })[0].onClick();
    auditLayout('微信闲聊（灵魂拷问 · 答错提示）');

    S5.mustDate = true;
    render.openChat(false);
    auditLayout('微信闲聊（必须当面见面提示）');
    render.closeChat();
    S5.mustDate = false;

    /* 告白结算页：这次要展示头像与背景 */
    render.backToChoose();
    S5.relationship = 'talking';
    S5.partner = partnerObj;
    S5.affection = 60;
    var headBefore = render._resultHead();
    assert(headBefore.on === false, '告白之前（主界面）不展示结算页头部');
    render.actConfess();
    var t6 = render._state().today;
    assert(t6 && t6.phase === 'done' && t6.action === 'confess', '告白进入结算页');
    var rh = render._resultHead();
    assert(rh.on === true, '告白结算页展示「头像 + 背景」头部');
    assert(!!rh.scene, '告白结算页匹配到场景背景（' + rh.scene + '）');
    assert(rh.h === 200, '有背景时头部高度为 200（实际 ' + rh.h + '）');
    auditLayout('告白结算页（带头像与背景）');
    advanceAfterResult(render);

    /* ---------- 行动菜单改两级：菜单只留两个方向入口 ---------- */
    console.log('  -- 两级行动菜单 + 二级页头部背景图 --');
    var art = require('../js/ui/art.js');
    var S6 = render._state().S;

    /* 单身 + 已相到人：菜单是「寻找相亲机会 / 其余安排」两个直接入口 */
    S6.relationship = 'single';
    S6.partner = null;
    S6.lead = partnerObj;
    S6.mustDate = false;
    render.backToChoose();
    var menuBtns = render._buttons().filter(function (b) { return /:/.test(String(b.label)) === false; });
    var navSeek = menuBtns.filter(function (b) { return b.label === (DB.text('play').seekTitle || '寻找相亲机会'); });
    var navOther = menuBtns.filter(function (b) { return b.label === (DB.text('play').otherTitle || '其余安排'); });
    assert(navSeek.length === 1, '行动菜单有「寻找相亲机会」入口，实际 ' + navSeek.length);
    assert(navOther.length === 1, '行动菜单有「其余安排」入口，实际 ' + navOther.length);
    assert(navSeek[0].selectable === true && navOther[0].selectable === true,
      '两个入口都是「单选卡片」：先点选一项，再由底部「确认」提交（不是单击即进）');
    var chatOnMenu = render._buttons().filter(function (b) { return b.label === '微信闲聊'; }).length;
    assert(chatOnMenu === 0, '行动菜单不再堆具体操作（微信闲聊等已收进二级页）');
    /* 主页原型：今日安排就是两张单选卡片，具体安排都在二级页里 */
    var selMain = render._buttons().filter(function (b) { return b.selectable; });
    assert(selMain.length === 2, '主界面恰有两个可单选的方向卡片（实际 ' + selMain.length + '）');
    assert(selMain.some(function (b) { return b.label === (DB.text('play').seekTitle || '寻找相亲机会'); })
      && selMain.some(function (b) { return b.label === (DB.text('play').otherTitle || '其余安排'); }),
      '两个单选卡片分别是「寻找相亲机会」与「其余安排」');
    auditLayout('行动菜单（两级入口）');

    /* 点「寻找相亲机会」卡片 → 进入待确认态（不立即进页）；再点底部「确认」→ 进二级页 */
    navSeek[0].onClick();
    assert(render._pending() === 'choose:seek', '点选「寻找相亲机会」卡片后进入待确认态（单选 + 确认模型）');
    var confirmSeek = render._fixedButtons().filter(function (b) {
      return b.label === (DB.text('setup').confirm || '确认');
    })[0];
    assert(!!confirmSeek, '选中方向卡片后底部「确认」可点');
    confirmSeek.onClick();
    var ph = render._pageHead();
    assert(render._state().today.phase === 'seek', '确认后进入「寻找相亲机会」二级页');
    assert(ph.kind === 'seek' && ph.h > 0, '二级页头部高度为 ' + ph.h + '（有背景图的位置）');
    /* 只留这一页的绘制记录：drawnTexts 是跨次累计的，不清理会被上一页干扰 */
    drawnTexts.length = 0;
    textOps.length = 0;
    render.draw();
    assert(drawnTexts.some(function (t) { return t === ph.title; }),
      '二级页头部画出页标题「' + ph.title + '」');
    var titleOp = textOps.filter(function (o) { return o.text === ph.title; })[0];
    assert(!!titleOp && titleOp.y > 30 && titleOp.y < ph.h,
      '页标题压在头部背景图上（y≈' + (titleOp ? Math.round(titleOp.y) : '?') + '，头部高 ' + ph.h + '）');
    var statusOnSeek = drawnTexts.some(function (t) { return /^第 \d+ 天 · /.test(t); });
    assert(!statusOnSeek, '二级页不重复铺状态区（界面聚焦在这一件事上）');
    var seekActs = render._buttons().filter(function (b) { return b.selectable; }).map(function (b) { return b.label; });
    assert(seekActs.some(function (l) { return l.indexOf('微信闲聊') >= 0; }),
      '二级页里有「微信闲聊」（单一入口，不再散落在主界面）');
    assert(seekActs.some(function (l) { return l.indexOf('赴约初遇') >= 0; }),
      '还没见面时二级页给出「赴约初遇」，实际 ' + JSON.stringify(seekActs));
    auditLayout('寻找相亲机会二级页（待赴约）');

    /* 单身无对象：这一页就是选渠道 */
    S6.lead = null;
    render.gotoSeek();
    var chBtns = render._buttons().filter(function (b) { return b.selectable; });
    assert(chBtns.length === DB.list('channels').length,
      '还没相到人时二级页列出全部 ' + chBtns.length + ' 个渠道');
    auditLayout('寻找相亲机会二级页（选渠道）');

    /* 「没找到合适的」走二级浮窗（背景图 + 结果，背景图预留位置），
     * 与关键事件浮窗同一套视觉，关闭后推进一天。 */
    Math.random = function () { return 0.99; };   // 强制相亲每次都落空
    var chBtns0 = render._buttons().filter(function (b) { return b.selectable; });
    chBtns0[0].onClick();                            // 选中第一个渠道（单选 + 确认模型）
    var confirmCh = render._fixedButtons().filter(function (b) {
      return b.label === '确认' || b.label === (DB.text('setup').confirm || '确认');
    })[0];
    assert(confirmCh, '渠道选中后底部「确认」可点');
    var moodBefore = S6.mood;
    confirmCh.onClick();                            // 确认 → actSeek → 落空
    assert(render._seekFailModalOpen(), '寻找落空应弹出二级浮窗（背景图 + 结果）');
    assert(render._state().today.phase === 'done' && !render._keyModalOpen(),
      '落空浮窗不应误用关键事件浮窗');
    /* 没找到对象：情绪下降与本次花费成正比（确定性，不随机） */
    var firstCh = DB.list('channels')[0];
    var cost0 = Math.round(firstCh.cost * S6.diff.costMod);
    var drop0 = engine.clamp(Math.round(cost0 * 0.002), 2, 20);
    assert(drop0 >= 2, '落空情绪下降是正值（cost=' + cost0 + ' → ' + drop0 + '）');
    assert(S6.mood === Math.max(0, moodBefore - drop0),
      '落空情绪下降与花费成正比（cost=' + cost0 + ' 应掉 ' + drop0 + '，实际剩 ' + S6.mood + '）');
    var sfb = render._fixedButtons().filter(function (b) {
      return b.label && b.label.indexOf('继续') >= 0;
    })[0];
    assert(sfb, '落空浮窗有「继续」按钮');
    sfb.onClick();                                   // 关闭浮窗 → 推进一天
    Math.random = mulberry32(RNG_SEED);              // 恢复随机源（期间用 0.99 避免触发随机事件/主动微信）
    assert(!render._seekFailModalOpen(), '关闭落空浮窗后浮窗消失');

    /* 返回 → 点「其余安排」 → 二级页：头部 + 生活向操作 */
    render.backToChoose();
    var other2 = render._buttons().filter(function (b) {
      return b.label === (DB.text('play').otherTitle || '其余安排');
    })[0];
    assert(!!other2, '回到菜单后「其余安排」入口仍在');
    other2.onClick();
    var confirmUp = render._fixedButtons().filter(function (b) {
      return b.label === (DB.text('setup').confirm || '确认');
    })[0];
    assert(!!confirmUp, '选中「其余安排」卡片后底部「确认」可点');
    confirmUp.onClick();
    var ph2 = render._pageHead();
    assert(render._state().today.phase === 'upgrade', '确认后进入「其余安排」二级页');
    assert(ph2.kind === 'upgrade' && ph2.h > 0, '二级页头部高度为 ' + ph2.h);
    drawnTexts.length = 0;
    render.draw();
    assert(drawnTexts.some(function (t) { return t === ph2.title; }),
      '二级页头部画出页标题「' + ph2.title + '」');
    var upLabels = render._buttons().filter(function (b) { return b.selectable; }).map(function (b) { return b.label; });
    ['过日子', '提升自己', '加班挣钱', '休息一天'].forEach(function (lb) {
      assert(upLabels.indexOf(lb) >= 0, '「其余安排」二级页里有「' + lb + '」');
    });
    assert(!drawnTexts.some(function (t) { return /^第 \d+ 天 · /.test(t); }),
      '「其余安排」二级页同样不铺状态区');
    auditLayout('其余安排二级页');

    /* 头部背景图按主角性别取图（男 / 女不是同一张） */
    var bgM = art.lazyPath('seek_bg_m'), bgF = art.lazyPath('seek_bg_f');
    assert(!!bgM && !!bgF && bgM !== bgF, 'seek_bg 按性别各有一张图（' + bgM + ' / ' + bgF + '）');
    assert(art.lazyPath('upgrade_bg_m') && art.lazyPath('upgrade_bg_f'),
      'upgrade_bg 按性别各有一张图');
    assert(/seek_bg_m\./.test(bgM), '「寻找相亲机会」男线取 seek_bg_m，实际 ' + bgM);

    /* ---------- 微信题库为空时：入口不消失、点进去不空白 ---------- */
    console.log('  -- 微信闲聊（题库为空时的降级） --');
    var realList = DB.list;
    var warned = [];
    var origWarn2 = console.warn;
    console.warn = function () { warned.push(Array.prototype.slice.call(arguments).join(' ')); };
    DB.list = function (n) { return n === 'chats' ? [] : realList.call(DB, n); };
    try {
      S6.relationship = 'single';
      S6.partner = null;
      S6.lead = partnerObj;
      S6.mustDate = false;
      assert(engine.chatAvailable(S6) === false, 'chats 为空时确实没有可聊的题目');
      render.backToChoose();
      render.gotoSeek();
      var entryWhenEmpty = render._buttons().filter(function (b) { return b.label === '微信闲聊'; });
      assert(entryWhenEmpty.length === 1,
        '题库为空时「微信闲聊」入口仍然在（不再凭空消失），实际 ' + entryWhenEmpty.length);
      render.openChat(false);
      assert(render._state().scene === 'chat', '题库为空也能进入微信页（不静默弹回）');
      assert(!!(render._chat() && render._chat().empty), '聊天页进入「无题可聊」状态');
      drawnTexts.length = 0;
      render.draw();
      /* 气泡里的长句会被折行成多段，断言「画出了这句话的一部分」即可 */
      var emptyLine = (DB.text('chat').emptyLine || '');
      var emptyHint = (DB.text('chat').emptyHint || '');
      assert(drawnTexts.some(function (t) {
        return t.length > 3 && emptyLine.indexOf(t) >= 0;
      }), '空题库时给出说明文案，而不是一块空白');
      assert(drawnTexts.some(function (t) { return t === emptyHint; }),
        '空题库时给出下一步提示');
      auditLayout('微信闲聊（题库为空）');
      render.closeChat();
      assert(render._state().scene === 'play', '空题库的微信页可以返回主界面');
      assert(warned.some(function (s) { return s.indexOf('chats') >= 0 && s.indexOf('Upsert') >= 0; }),
        '题库为空时打一条可操作的告警（指向重新导入 chats.json）');
    } finally {
      console.warn = origWarn2;
      DB.list = realList;
    }

    /* ---------- 结局页头部背景图 ---------- */
    console.log('  -- 结局页头部背景图（end_结局类型_性别） --');
    var endArts = {};
    DB.list('endings').forEach(function (e) {
      assert(!!e.art, '结局 ' + e.id + ' 带美术类型（' + e.art + '）');
      endArts[e.art] = (endArts[e.art] || 0) + 1;
    });
    assert(Object.keys(endArts).sort().join(',') === 'alone,badmarry,happymarry',
      '结局覆盖 3 种画面：' + JSON.stringify(endArts));
    ['happymarry', 'badmarry', 'alone'].forEach(function (k) {
      assert(!!art.lazyPath('end_' + k + '_m') && !!art.lazyPath('end_' + k + '_f'),
        '结局画面 ' + k + ' 男女两张图都在注册表里');
    });

    render.renderEnd('marry');
    var eh = render._endHead();
    assert(render._state().scene === 'end', '进入结局页');
    assert(eh.on === true && eh.art === (render._state().S.ending.art || 'alone'),
      '结局页头部启用（美术类型 ' + eh.art + '）');
    drawnTexts.length = 0;
    textOps.length = 0;
    render.draw();
    assert(eh.h > 0 && !!eh.tag && drawnTexts.some(function (t) { return t === eh.tag; }),
      '结局页头部画出小标签「' + eh.tag + '」');
    var endTitleOp = textOps.filter(function (o) { return o.text === render._state().S.ending.title; })[0];
    assert(!!endTitleOp && endTitleOp.y > eh.h,
      '结局标题排在插画下方（y≈' + (endTitleOp ? Math.round(endTitleOp.y) : '?') + ' > 头部 ' + eh.h + '）');
    auditLayout('结局页（婚姻线 · 插画头部）');

    /* 三种画面各渲染一遍，排版都不许炸 */
    render.renderEnd('forced');
    assert(render._endHead().art === 'badmarry', '被迫结婚的结局用 badmarry 画面');
    auditLayout('结局页（被迫结婚）');
    render.renderEnd('broke');
    assert(render._endHead().art === 'alone', '破产的结局用 alone 画面');
    auditLayout('结局页（独自落魄）');

    /* 14 个结局逐个渲染：文案长短不一，任何一个都不许把正文压到「为什么」框上 */
    DB.list('endings').forEach(function (e) {
      render.renderEnd(e.id);
      auditLayout('结局页 · ' + e.title);
    });
    /* 已婚 + 有对象时的兜底结局（玩家真实遇到的那一种：求婚成功后时间到了）：
     * 双人头像 + 关系标签 + 正文卡一起出现，排版也得排得开。 */
    render._state().S.partner = partnerObj;
    render._state().S.relationship = 'married';
    render.renderEnd('married_stall');
    assert(render._endHead().art === 'badmarry', '「婚姻里的将就」用 badmarry 画面');
    drawnTexts.length = 0;
    render.draw();
    assert(drawnTexts.some(function (t) { return t.indexOf('{p}') < 0 && t.indexOf(partnerObj.name) >= 0; }),
      '结局页正文里的 {p} 已换成对象名（不会把 {p} 原样画出来）');
    auditLayout('结局页（已婚兜底 · 双人头像）');
    render._state().S.partner = null;
    render._state().S.relationship = 'single';
    /* 有对象在场（双人头像那一版）也要排得开 */
    render._state().S.partner = partnerObj;
    render._state().S.relationship = 'married';
    render.renderEnd('marry');
    auditLayout('结局页（双人头像）');
    render._state().S.partner = null;
    render._state().S.relationship = 'single';

    /* ---------- 结局页：看广告领奖励 · 再开一局（微信激励视频） ---------- */
    console.log('  -- 结局页广告（激励视频 · 奖励带进下一局） --');
    var adMod = require('../js/core/ad.js');
    var realNum = DB.num;
    /* 云端常量里的 AD_UNIT_ID 是占位值，这里临时换成一个"真"广告位，
     * 才能走到「创建实例 → show → onClose」的真机路径。 */
    DB.num = function (key, fallback) {
      if (key === 'AD_UNIT_ID') return 'adunit-smoke000000001';
      return realNum(key, fallback);
    };
    adMod.reset();
    try { wx.removeStorageSync('xq_ad_reward_v1'); } catch (e) { /* ignore */ }
    adFake.isEnded = true; adFake.showFails = false; adFake.createThrows = false;

    render.renderEnd('marry');
    var adInfo = render._ad();
    assert(adInfo.entryOpen === true, '广告入口打开（开关开 + 广告位已配）');
    assert(adInfo.reward.money > 0, '奖励数值来自云端常量（存款 +' + adInfo.reward.money + '）');
    assert(realNum('AD_REWARD_MONEY', 0) > 0, '奖励常量确实在 constants 集合里，不是代码里写死的');

    var endAdBtns = function () {
      return render._fixedButtons().filter(function (b) { return /看广告/.test(String(b.label)); });
    };
    assert(endAdBtns().length === 1, '结局页有「看广告 · +N」入口');
    assert(render._fixedButtons().filter(function (b) {
      return b.label === '直接再开一局';
    }).length === 1, '不看广告也能直接开新一局（广告不是强制门槛）');
    assert(pageBtns().length === 2, '底部只放两个重开入口（三个会被挤到文案截断）');
    assert(render._buttons().filter(function (b) {
      return b.label === '回到标题';
    }).length === 1, '「回到标题」收成内容区小链接');
    drawnTexts.length = 0;
    render.draw();
    assert(drawnTexts.some(function (t) { return t.indexOf('看完广告') === 0; }),
      '结局页写明奖励规则（给多少 / 不看也能开）');

    /* 中途退出：不发奖、也不硬闯下一局 */
    var moneyBeforeAd = render._state().S.money;
    adFake.isEnded = false;
    endAdBtns()[0].onClick();
    assert(render._state().scene === 'end', '广告没看完仍留在结局页');
    assert(render._ad().pending === null, '中途退出不发奖励');
    assert(render._state().S.money === moneyBeforeAd, '中途退出不动任何数值');

    /* 完整看完：奖励落地，回到标题准备下一局 */
    adFake.isEnded = true;
    endAdBtns()[0].onClick();   // 上一步 draw 过，按钮对象已换一批，重新取
    assert(adFake.instances.length >= 1, '真的走了一次「创建广告实例 → show」');
    assert(render._state().scene === 'title', '看完广告直接回标题，准备开新一局');
    var pend = render._ad().pending;
    assert(!!pend && pend.money === adInfo.reward.money,
      '看完广告记下待发奖励（+' + (pend && pend.money) + '）');
    assert(render._state().S.money === moneyBeforeAd,
      '奖励不回改这一局结局页上已经展示的成绩');

    /* 奖励带进下一局：开局时一次性发放 */
    var bgPick = DB.list('backgrounds')[0];
    var refMoney = engine.createGame('m', bgPick.id, bgPick.goals[0], 1, 'normal').money;
    render.startSetup();
    render.setGender('m');
    render.setBg(bgPick.id);
    render.setGoal(bgPick.goals[0]);
    render.setDifficulty('normal');
    drawnTexts.length = 0;
    render.beginGame();
    var gotS = render._state().S;
    assert(gotS.money === refMoney + pend.money,
      '新一局开局发放广告奖励（' + refMoney + ' + ' + pend.money + ' = ' + gotS.money + '）');
    assert(render._ad().pending === null, '奖励发放后立刻清空，不会重复发');
    assert(drawnTexts.some(function (t) { return t.indexOf('广告奖励到账') >= 0; }),
      '开局用提示条告诉玩家奖励到账（不然会以为白看了）');

    /* 广告拉不起来（占位广告位 / 没开通流量主 / 环境不支持）：入口降级 */
    DB.num = realNum;
    adMod.reset();
    render.renderEnd('marry');
    assert(render._ad().entryOpen === false, '广告位还是占位值时判定为「拉不起来」');
    assert(endAdBtns().length === 0, '拉不起来时不给假入口（点了也没反应更糟）');
    assert(render._fixedButtons().filter(function (b) {
      return b.label === '直接再开一局';
    }).length === 1, '降级后仍能直接开新一局，玩家不会卡在结局页');
    auditLayout('结局页（无广告入口）');

    /* 广告 show 失败（没填充）：不发奖、留在结局页，不能把人卡住 */
    DB.num = function (key, fallback) {
      if (key === 'AD_UNIT_ID') return 'adunit-smoke000000001';
      return realNum(key, fallback);
    };
    adMod.reset();
    adFake.showFails = true;
    render.renderEnd('marry');
    endAdBtns()[0].onClick();
    assert(render._state().scene === 'end', '广告没填充时留在结局页');
    assert(render._ad().pending === null, '拉不起来不发奖励');
    adFake.showFails = false;
    DB.num = realNum;
    adMod.reset();

    /* ---------- 交往风格：叠层浮出（保留背景）+ 结算后回主界面 ---------- */
    console.log('  -- 交往风格（叠层 · 保留背景） --');
    render._clearFlashBar();
    /* 上面刚在结局页上转了一圈，这里重新载入一局恋爱中的存档，
     * 把 scene 拉回 play（结局页不会自己回去）。 */
    render.gotoTitle();
    render.resumeGame({
      v: 1, gender: 'm', bgId: bg0, goalId: 'marry', seed: 5150,
      difficultyId: 'normal', day: 40, money: 300000, health: 70, career: 50,
      looks: 60, family: 45, mood: 60, affection: 60,
      relationship: 'talking', partner: partnerObj, lead: null,
      flags: {}, singleStreak: 0, singleLimit: 60, relStartDay: 30, recent: [], log: [],
      history: [], acts: []
    });
    var S7 = render._state().S;
    assert(render._state().scene === 'play' && S7.relationship === 'talking', '载入一局「接触中」的存档');
    render.gotoSeek();
    render.gotoDate();
    assert(render._state().today.phase === 'date', '进入约会档位页');
    var phDate = render._pageHead();
    assert(phDate.kind === 'date' && phDate.h > 0,
      '约会档位页头部带背景图（与「寻找相亲机会」同一张，背景连着）');
    var fixedBy = function (label) {
      return render._fixedButtons().filter(function (b) { return b.label === label; })[0];
    };
    var dtBtns = render._buttons().filter(function (b) { return b.selectable; });
    assert(dtBtns.length === DB.list('date_types').length,
      '约会档位页列出全部 ' + dtBtns.length + ' 个档位');
    auditLayout('约会档位页（有背景头部）');

    /* 选档位 → 确认 → 交往风格以叠层浮出（页面不换） */
    dtBtns[0].onClick();
    fixedBy('确认').onClick();
    var ovOpen = render._styleOverlay();
    assert(ovOpen.open === true, '确认档位后交往风格以「叠层」浮出');
    assert(render._state().today.phase === 'date',
      '叠层浮出时页面仍然是约会档位页（没有另开一页，背景得以保留）');
    assert(!!ovOpen.panel && ovOpen.panel.h > 30, '叠层有面板几何（高 ' + Math.round(ovOpen.panel.h) + 'px）');
    var styleRows = render._fixedButtons().filter(function (b) { return /^style:/.test(String(b.label)); });
    var styleAll = DB.list('court_styles');
    assert(styleRows.length >= 3,
      '叠层里给出可选的交往风格（可见 ' + styleRows.length + ' / 共 ' + styleAll.length + ' 种）');
    assert(ovOpen.maxScroll > 0,
      '风格条目多于面板高度时列表可在面板内滚动（可滚 ' + Math.round(ovOpen.maxScroll) + 'px）');
    assert(ovOpen.panel.y >= 20 && ovOpen.panel.y + ovOpen.panel.h <= 667 - 20,
      '叠层面板没盖满全屏，上下留出缝（面板高 ' + Math.round(ovOpen.panel.h) + ' / 屏高 667）');

    /* 面板内拖动 → 后面的风格滚进来（叠层是模态，底层页面不跟着动） */
    var seenStyleIds = {};
    styleRows.forEach(function (b) { seenStyleIds[String(b.label).slice(6)] = true; });
    touchHandlers.start({ touches: [{ clientX: ovOpen.panel.x + 30, clientY: ovOpen.panel.viewTop + 40 }] });
    touchHandlers.move({ touches: [{ clientY: ovOpen.panel.viewTop + 40 - 400 }] });
    var ovAfter = render._styleOverlay();
    assert(ovAfter.scroll < 0, '在面板里向上拖动会滚面板（scroll=' + Math.round(ovAfter.scroll) + '）');
    render._fixedButtons().filter(function (b) { return /^style:/.test(String(b.label)); })
      .forEach(function (b) { seenStyleIds[String(b.label).slice(6)] = true; });
    assert(Object.keys(seenStyleIds).length === styleAll.length,
      '滚动后 ' + styleAll.length + ' 种风格都能看到（实际 ' + Object.keys(seenStyleIds).length + ' 种）');
    /* 把面板拨回顶部，后面的断言不受影响 */
    touchHandlers.move({ touches: [{ clientY: ovOpen.panel.viewTop + 40 }] });
    assert(render._buttons().filter(function (b) { return b.selectable; }).length === 0,
      '叠层打开时下层页面不再接收点击（模态）');
    assert(render._fixedButtons().filter(function (b) { return b.label === '返回' || b.label === '← 返回'; }).length === 1,
      '叠层自带「返回」按钮');
    /* 叠层是刻意盖在页面上的（和飘字一样），不能拿「文字不重叠」去审 ——
     * 这里改成审叠层自身的几何：面板不出屏、底部按钮在面板里。
     * 「返回」始终存在；「确认」初始为未选中态（灰显且不注册），
     * 选中一个风格后才出现可点的确认，所以分两步校验。 */
    var back = render._fixedButtons().filter(function (b) {
      return b.label === '返回' || b.label === '← 返回';
    })[0];
    assert(!!back && back.y >= ovOpen.panel.y && back.y + back.h <= ovOpen.panel.y + ovOpen.panel.h,
      '叠层「返回」落在面板内部');
    /* 选一个风格 → 确认按钮出现且仍在面板内 */
    var one = render._fixedButtons().filter(function (b) { return /^style:/.test(String(b.label)); })[0];
    if (one && one.onClick) one.onClick();
    var confirmBtn = render._fixedButtons().filter(function (b) { return b.label === '确认'; })[0];
    assert(!!confirmBtn, '选中风格后叠层出现「确认」按钮');
    assert(confirmBtn && confirmBtn.y >= ovOpen.panel.y && confirmBtn.y + confirmBtn.h <= ovOpen.panel.y + ovOpen.panel.h,
      '叠层「确认」落在面板内部');

    /* 「返回」收起叠层：下层页面原样回来 */
    render.closeStyleOverlay();
    assert(render._styleOverlay().open === false, '「返回」收起叠层');
    assert(render._state().today.phase === 'date', '收起后仍停在约会档位页');
    assert(render._buttons().filter(function (b) { return b.selectable; }).length === DB.list('date_types').length,
      '收起后下层页面恢复可交互');

    /* 再走一次：选风格 → 确认 → 直接进事件页 → 结算 → 回主界面 */
    render.gotoStyle('date', DB.list('date_types')[0].id);
    render._fixedButtons().filter(function (b) { return /^style:/.test(String(b.label)); })[1].onClick();
    fixedBy('确认').onClick();
    assert(render._styleOverlay().open === false, '确认风格后叠层立即收起');
    assert(render._state().today.phase === 'event', '选完风格直接进入约会事件页');
    var evOpt = render._buttons().filter(function (b) { return b.selectable; })[0];
    assert(!!evOpt, '约会事件页有可选项');
    evOpt.onClick();
    fixedBy('确认').onClick();
    var contBtn = render._fixedButtons()[0];
    assert(!!contBtn, '事件结果页有「继续」按钮');
    var keepRandom = Math.random;
    Math.random = function () { return 0.999; };   // 不触发主动微信 / 随机事件
    contBtn.onClick();
    Math.random = keepRandom;
    render._clearFlashBar();
    assert(render._state().today.phase === 'choose', '结算完成后回到主界面行动菜单');

    /* ---------- 微信聊天次数的规则要「看得见」 ---------- */
    console.log('  -- 微信：聊够次数就要求当面见一面 --');
    var S7b = render._state().S;
    S7b.partner = partnerObj;
    S7b.relationship = 'talking';
    S7b.mustDate = false;
    S7b.chatCount = 0;
    render.backToChoose();
    render.gotoSeek();
    var chatEntry0 = render._buttons().filter(function (b) { return b.label === '微信闲聊'; })[0];
    assert(!!chatEntry0, '「微信闲聊」入口在');
    assert(String(chatEntry0.sub || chatEntry0.label).indexOf('/') < 0,
      '还没聊够时不显示次数提示');
    /* 聊满阈值（默认 2 次）→ 引擎下一次给固定剧情，入口上也提前把话说清楚 */
    for (var cc = 0; cc < 2; cc++) engine.afterChat(S7b, engine.pickChat(S7b), false);
    assert(S7b.chatCount === 2, '玩家自己点开的两次微信也被计入（chatCount=' + S7b.chatCount + '）');
    assert(S7b.mustDate === false, '只是聊够了，还没被锁住');
    render.gotoSeek();
    var chatSub = null;
    render._buttons().forEach(function (b) { if (b.label === '微信闲聊') chatSub = b; });
    assert(!!chatSub, '聊够后入口仍在');
    drawnTexts.length = 0;
    render.draw();
    assert(drawnTexts.some(function (t) { return t.indexOf('2/2') >= 0; }),
      '入口上直接标出「微信聊得够多了（2/2）」，规则可见');
    /* 再聊一次 → 引擎给固定剧情 → 聊完锁住 -->
       下面这一条把「规则真的生效」钉住 */
    var forced = engine.pickChat(S7b);
    assert(engine.isMustDateChat(forced), '聊满 2 次后下一次聊天被替换成「必须见面」剧情');
    engine.afterChat(S7b, forced, false);
    assert(engine.chatLocked(S7b) === true, '聊完固定剧情后微信被锁住，只能先约一次会');
    S7b.chatCount = 0;
    S7b.mustDate = false;

    /* ---------- 提示条：发薪提示真的留在屏幕上 ----------
     * 回归点：以前提示只在「偶遇/发薪那一帧」画一次就立刻清标记，
     * 而主界面属性动效每帧都重绘 —— 玩家实际看不到，于是以为「规则没生效」。 */
    console.log('  -- 提示条（每 30 天结算收支，必须看得见） --');
    render.backToChoose();
    render._clearFlashBar();
    var S8 = render._state().S;
    S8.relationship = 'talking';
    S8.partner = partnerObj;
    S8.mustDate = false;
    S8.singleLimit = 999;
    S8.over = false;
    S8.ending = null;
    S8.day = 29;
    S8.money = 100000;
    var before8 = S8.money;
    engine.advanceDays(S8, 1);            // 跨过第 30 天
    assert(S8.day === 30 && S8.money > before8,
      '第 30 天引擎确实结算了收支（' + before8 + ' → ' + S8.money + '）');
    render.draw();
    assert(render._flashQueue().length === 1,
      '发薪提示进入常驻队列（' + render._flashQueue().length + ' 条）');
    assert(S8.paydayFlash === null, '引擎侧标记读完即清，不会重复播');
    drawnTexts.length = 0;
    render.draw();
    assert(drawnTexts.some(function (t) { return t.indexOf('发薪日') >= 0; }),
      '提示条把「发薪日」画到了屏幕上');
    render.draw();
    render.draw();
    assert(render._flashQueue().length === 1,
      '连续重绘（属性动效每帧都会重绘）提示条依然在 —— 这就是之前看不到结算的根因');
    render._clearFlashBar();
    assert(render._flashQueue().length === 0, '提示条到期 / 手动可清空');

    /* ---------- 页面过渡动效 ---------- */
    console.log('  -- 页面过渡动效 --');
    var transMs = render._transMs();
    assert(render._transOn(true) === true, '过渡动效可开启（真机 init 里默认开）');
    var t0s = render._startTrans(0);
    assert(t0s.active === true && t0s.dy > 0 && t0s.alpha < 0.25,
      '刚换页：整页从下方淡入（dy=' + t0s.dy + 'px · alpha=' + t0s.alpha.toFixed(2) + '）');
    var tQuart = render._startTrans(Math.round(transMs * 0.25));
    assert(tQuart.active === true && tQuart.dy > 0 && tQuart.dy < 20 &&
      tQuart.alpha > 0 && tQuart.alpha < 1,
      '中途：位移在收、透明度在涨（dy=' + tQuart.dy + ' · alpha=' + tQuart.alpha.toFixed(2) + '）');
    var tMid2 = render._startTrans(Math.round(transMs * 0.6));
    assert(tMid2.active === true && tMid2.dy > 0 && tMid2.dy < tQuart.dy,
      '位移单调收敛（' + tQuart.dy + 'px → ' + tMid2.dy + 'px）');
    var tEnd2 = render._startTrans(transMs + 1);
    assert(tEnd2.active === false && tEnd2.dy === 0 && tEnd2.alpha === 1,
      '结束后回到终态（不残留位移 / 半透明）');
    /* 页面指纹变化才触发，同一页重绘不重播 */
    render._transOn(false);
    render.gotoTitle();
    var k1 = render._pageKey();
    render.startSetup();
    var k2 = render._pageKey();
    assert(k1 !== k2, '换页会改变页面指纹（动效据此自动触发，不用逐个跳转点登记）');
    render.draw();
    assert(render._pageKey() === k2, '同一页重复绘制指纹不变（不会一直重播动效）');
    var tOff = render._trans();
    assert(tOff.active === false, '测试模式（动效关）下绘制恒为终态，排版断言不受影响');
    render.gotoTitle();

    /* ---------- 存读档往返：relSpent 等关键字段必须随档保存并还原 ---------- */
    console.log('  -- 存读档往返（relSpent 回归） --');
    (function () {
      var bg = DB.list('backgrounds')[0];
      var d = {
        v: 1, day: 37, gender: 'm', bgId: bg.id, goalId: bg.goals[0],
        difficultyId: 'normal', seed: 4242, courtStyle: 'modest',
        money: 88888, health: 66, career: 55, looks: 60, family: 40, mood: 70, affection: 33,
        relationship: 'single', partner: null, lead: null,
        flags: { child: false, marriedOnce: false, breakupCount: 1, rejectCount: 2 },
        singleStreak: 3, singleLimit: 30, relStartDay: 5, relSpent: 4321,
        recent: [], log: [], met: [], chatCount: 2, proactiveChats: 1, mustDate: true,
        history: [], acts: [], today: null
      };
      render.resumeGame(d);
      var S2 = render._state().S;
      assert(S2.relSpent === 4321, '读档还原 relSpent（实=' + S2.relSpent + '）');
      assert(S2.day === 37 && S2.money === 88888 && S2.chatCount === 2 && S2.mustDate === true,
        '读档还原 day / money / chatCount / mustDate');
      assert(!!(S2.flags && S2.flags.breakupCount === 1), '读档还原 flags');
      render.saveGame();
      var back = storage['xq_save_v1'] ? JSON.parse(storage['xq_save_v1']) : null;
      assert(!!(back && back.relSpent === 4321), 'saveGame 写出的档含 relSpent（实=' +
        (back && back.relSpent) + '）');
      assert(!!(back && back.day === 37 && back.mustDate === true), '关键字段随档写出');
      render.gotoTitle();
    })();

    /* ---------- 结局清档：对局结束后不应还能「继续游戏」 ---------- */
    console.log('  -- 结局清档（结束后不可继续） --');
    (function () {
      render.saveGame();
      assert(!!storage['xq_save_v1'], '结局前先确保存在存档');
      var endId = (DB.list('endings')[0] || {}).id;
      render.renderEnd(endId);
      assert(render._state().scene === 'end', '进入结局页');
      assert(!storage['xq_save_v1'], '进入结局页后存档被清除（结束后不可「继续游戏」）');
      render.gotoTitle();
    })();

    /* ---------- 卡片式改造：选中态 / 正文卡 / 属性变化卡 / 音乐浮窗 / 进出动效 ---------- */
    console.log('  -- 卡片式改造（选中态 · 正文卡 · 属性卡 · 音乐浮窗 · 进出动效） --');
    render._transOn(false);      // 先断言终态；动效单列在最后

    /* 开一局干净的「单身」档：渠道页 / 其余安排页 / 事件页都要用到 */
    render.gotoTitle();
    render.resumeGame({
      v: 1, gender: 'm', bgId: DB.list('backgrounds')[0].id, goalId: 'marry', seed: 20260920,
      difficultyId: 'normal', day: 6, money: 60000, health: 70, career: 55,
      looks: 60, family: 45, mood: 60, affection: 0,
      relationship: 'single', partner: null, lead: null,
      flags: {}, singleStreak: 3, singleLimit: 30, relStartDay: 1,
      recent: [], log: [], history: [], acts: [], met: []
    });
    var countTick = function () {
      return drawnTexts.filter(function (t) { return t === '✓'; }).length;
    };

    /* ① 相亲渠道卡片：点一下必须看得见「选中」 */
    (function () {
      render.gotoSeek();
      var cards = render._buttons().filter(function (b) { return b.selectable; });
      assert(cards.length > 0, '寻找相亲机会渲染出可选的渠道卡片');
      assert(render._pending() === null, '刚进渠道页时没有任何选中项');
      cards[0].onClick();
      assert(render._pending() === 'seek:' + DB.list('channels')[0].id,
        '点渠道卡片进入选中态（pendingKey 命中该渠道，实=' + render._pending() + '）');
      drawnTexts.length = 0;
      render.draw();
      assert(countTick() >= 1, '选中的渠道卡片画出右上角 ✓ 角标（选中态可见）');
      assert(render._buttons().filter(function (b) { return b.selectable; }).length > 0 &&
        render._fixedButtons().filter(function (b) { return b.label === '确认'; }).length === 1,
        '选中渠道后底部「确认」可点（单选 + 确认流程完整）');
      render._state().today.phase = 'choose';   // 清场，不影响后面的用例
      render.backToChoose();
    })();

    /* 同级问题一并覆盖：其余安排的卡片同样要看得见选中 */
    (function () {
      render.gotoUpgrade();
      var cards = render._buttons().filter(function (b) { return b.selectable; });
      assert(cards.length >= 4, '其余安排渲染出 4 张可选卡片（实=' + cards.length + '）');
      cards[0].onClick();
      assert(render._pending() !== null, '点「其余安排」卡片同样进入选中态');
      drawnTexts.length = 0;
      render.draw();
      assert(countTick() >= 1, '「其余安排」选中的卡片也画出 ✓（同类问题一并修好）');
      render.backToChoose();
    })();

    /* ② 事件页（相亲事件 / 随机事件同一套画法）：正文旁白卡 + 选项卡 + 结果属性卡 */
    (function () {
      render.actLife();                     // 过日子 → 随机事件
      assert(render._state().today.phase === 'event', '进事件页（随机事件）');
      drawnTexts.length = 0;
      render.draw();
      assert(render._frameCards().note >= 1,
        '事件正文用旁白卡承载（本帧旁白卡 ' + render._frameCards().note + ' 张）');
      var opts = render._buttons().filter(function (b) { return b.selectable; });
      assert(opts.length >= 2, '事件选项是卡片（实=' + opts.length + ' 张）');
      opts[0].onClick();
      assert(render._pending() !== null, '事件选项点击进入选中态');
      drawnTexts.length = 0;
      render.draw();
      assert(countTick() >= 1, '选中的事件选项卡画出 ✓');
      render.runPending();
      assert(render._state().today.resolved === true, '提交后在本页展示结果');
      assert(render._frameCards().delta >= 1,
        '结果区的属性变化用卡片展示（本帧变化卡 ' + render._frameCards().delta + ' 张）');
      var d0 = render._state().today.result.delta;
      assert(render.deltaValText('money', -60000) === '-6万', '属性卡数值沿用万单位简写');
      assert(render.deltaValText('health', 5) === '+5' &&
        render.deltaValText('health', -5) === '-5', '属性卡数值带正负号');
      assert(Object.keys(d0).length > 0, '结果里确实有属性变化（供卡片展示）');
    })();

    /* ③ 音乐浮窗：钉在左上角，所有页面都在，点一下切换静音 */
    (function () {
      var audioMod = require('../js/audio.js');
      var pages = [
        ['标题页', function () { render.gotoTitle(); }],
        ['设定页', function () { render.startSetup(); }],
        ['主界面', function () {
          render.gotoTitle();
          render.resumeGame({
            v: 1, gender: 'm', bgId: DB.list('backgrounds')[0].id, goalId: 'marry', seed: 20260921,
            difficultyId: 'normal', day: 7, money: 60000, health: 70, career: 55,
            looks: 60, family: 45, mood: 60, affection: 0,
            relationship: 'single', partner: null, lead: null,
            flags: {}, singleStreak: 3, singleLimit: 30, relStartDay: 1,
            recent: [], log: [], history: [], acts: [], met: []
          });
        }],
        ['相亲图鉴', function () { render.openGallery(); }],
        ['对方资料页', function () { render.openPartnerProfile(); }],
        ['玩法说明页', function () { render.closeGallery(); render.gotoTitle(); render.draw(); }]
      ];
      pages.forEach(function (pg) {
        pg[1]();
        var mb = render._musicBtn();
        assert(!!mb, pg[0] + '展示音乐开关浮窗');
        assert(mb.x + mb.w <= 375 * 0.25 && mb.y < 60,
          pg[0] + '的音乐浮窗在左上角（x=' + mb.x + ' y=' + mb.y + '）');
      });
      var before = audioMod.isMuted();
      render._fixedButtons().filter(function (b) { return b.music; })[0].onClick();
      assert(audioMod.isMuted() !== before, '点浮窗即可切换静音（' + before + ' → ' + audioMod.isMuted() + '）');
      assert(render._musicBtn().label === (audioMod.isMuted() ? '音乐 关' : '音乐 开'),
        '浮窗文案跟随静音状态（' + render._musicBtn().label + '）');
      render._fixedButtons().filter(function (b) { return b.music; })[0].onClick();
      assert(audioMod.isMuted() === before, '再点一次切回原状态');

      /* 叠层打开时浮窗依然在、依然能点（它是固定层最上面的全局控件） */
      render.gotoSeek();
      render.gotoStyle('date', 'simple');
      assert(render._styleOverlay().open === true, '约会档位 → 打开交往风格叠层');
      assert(!!render._musicBtn(), '交往风格叠层打开时，音乐浮窗仍在（不被叠层盖掉）');
      assert(render._fixedButtons().filter(function (b) { return b.music; }).length === 1,
        '叠层打开时音乐浮窗仍可点（在固定层最上面）');
      render.closeStyleOverlay();
    })();

    /* ④ 卡片进出动效：入场错落 + 退场延后执行（数值断言，不依赖真实耗时） */
    (function () {
      render._transOn(true);

      /* 入场：拨表到 0ms 是「刚起步」（还在下方且半透明），拨到结束后是终态 */
      var inStart = render._cardEnter('test', 0);
      assert(inStart.on === true && inStart.dy > 0 && inStart.a < 1,
        '卡片入场起步：还在下方且半透明（dy=' + inStart.dy + ' · a=' + inStart.a.toFixed(2) + '）');
      var inMid = render._cardEnter('test', 60);
      assert(inMid.dy > 0 && inMid.dy < inStart.dy && inMid.a > inStart.a && inMid.a < 1,
        '入场中途：位移在收、透明度在涨（dy=' + inMid.dy + ' · a=' + inMid.a.toFixed(2) + '）');
      var inDone = render._ageCardEnter(render._transMs() + 3000);
      assert(inDone.on === false && inDone.dy === 0 && inDone.a === 1,
        '入场结束回到终态（不残留位移 / 半透明）');

      /* 退场：先播动画、回调延后；手动拨到结束才真正执行 */
      var ran = false;
      var deferring = render._cardExit(function () { ran = true; });
      assert(deferring === true && ran === false, '退场先播动画，真正的状态变更被推迟');
      render._ageCardExit(120);
      var outMid = render._cardAnim(0);
      assert(outMid.dy > 0 && outMid.a < 1,
        '退场中途卡片在往下沉且变淡（dy=' + outMid.dy + ' · a=' + outMid.a.toFixed(2) + '）');
      render._ageCardExit(render._transMs() + 3000);
      render._cardTick();
      assert(ran === true && render._cardExiting() === false, '退场播完后才执行回调');

      /* 动效关闭（测试 / 无动效环境）：退场必须同步执行，行为完全一致 */
      render._transOn(false);
      var ran2 = false;
      render._cardExit(function () { ran2 = true; });
      assert(ran2 === true, '动效关闭时退场同步执行（不影响测试与低端机的正确性）');
      var off = render._cardAnim(0);
      assert(off.on === false && off.a === 1 && off.dy === 0, '动效关闭时卡片恒为终态');
      render.gotoTitle();
    })();

    console.log('UI SMOKE OK');
  });
}

main();

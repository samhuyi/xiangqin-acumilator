/* =========================================================
 * 边界 / 全链路专项测试（Node 环境，模拟 wx.cloud）
 * ---------------------------------------------------------
 * 重点验证引擎在「功能 + 边界」下的健壮性，弥补现有冒烟测试未覆盖的部分：
 *   1. 分手后微信计数清零 + relSpent 清零 + 新对象不被锁定（用户近期修复点）
 *   2. 分手心情三档（zero / set / ratio）按相处天数与花费正确落档
 *   3. 属性全程不越界、不出现 NaN（随机策略长跑压力测试）
 *   4. 结局优先级：达成目标优先于破产/抑郁；破产优先于抑郁
 *   5. firstMeet / goDate / doChild / checkPartnerLeave 等边界
 *   6. 长跑稳定性：advanceDays 必然收敛到某个结局、无异常
 *   7. 好感度动态上限在阶段切换时不被击穿
 *
 * 运行： node tools/edge-smoke.js
 * ========================================================= */

'use strict';

var hm = require('./helpers/cloud-mock.js');
var DB = require('../js/db/repository.js');
var engine = require('../js/core/engine.js');
var R = require('../js/core/rules.js');

/* ---------------- 极简断言框架 ---------------- */
var pass = 0, fail = 0, fails = [];
function ok(cond, msg) {
  if (cond) { pass++; }
  else { fail++; fails.push(msg); console.log('  ✗ ' + msg); }
}
function section(name) { console.log('\n===== ' + name + ' ====='); }
function inRange(v, lo, hi) { return typeof v === 'number' && !isNaN(v) && v >= lo && v <= hi; }
function finite(v) { return typeof v === 'number' && isNaN(v) === false && isFinite(v); }

/* 把状态推到「已相到人并进入接触中」的辅助函数。
 * findDate 有随机成功率（self 渠道 chance=0.2），所以这里重试到成功为止，
 * 测试才不会因为「这次没相到」而假失败；临时垫高资金避免反复尝试把钱包刷空。 */
function reachTalking(s) {
  var keep = s.money;
  s.money = Math.max(s.money, 300000);
  var done = false;
  for (var i = 0; i < 400 && !done; i++) {
    var fr = engine.findDate(s, 'self');
    if (fr.ok) {
      engine.firstMeet(s);
      s.affection = 60;        // 抬高好感确保 endMeet 成功
      done = engine.endMeet(s).ok;
    }
  }
  s.money = keep;
  return done;
}
function statOk(s) {
  return finite(s.money) && s.money >= 0 &&
    inRange(s.health, 0, 100) && inRange(s.career, 0, 100) &&
    inRange(s.looks, 0, 100) && inRange(s.family, 0, 100) &&
    inRange(s.mood, 0, 100) &&
    finite(s.affection) && s.affection >= 0 && s.affection <= engine.affectionCap(s);
}
/* 冷静期天数直接从 constants 取：改配置时测试跟着走，不用手改数字 */
function C_GRACE() { return (DB.get('constants') || {}).PARTNER_LEAVE_GRACE_DAYS || 3; }

/* ---------------- 全部测试 ---------------- */
function runTests() {
  /* ============ 1. 分手后微信计数清零 + 新对象不被锁定 ============ */
  section('分手清零（微信计数 / relSpent / 新对象锁定）');
  (function () {
    var s = engine.createGame('m', 'bg_worker', 'marry', 1, 'normal');
    ok(reachTalking(s), '能推进到接触中阶段');
    ok(s.partner, '已建立 partner');
    var spent0 = s.relSpent || 0;

    var c1 = { kind: 'normal', phases: ['talking'], options: [{ fx: { affection: 1, mood: 0 }, reply: 'x' }] };
    engine.afterChat(s, c1, false);
    engine.afterChat(s, c1, false);
    ok(s.chatCount === 2, '聊满 2 次，chatCount=' + s.chatCount);
    /* 「必须约会」不是聊满 2 次就直接置位，而是下一次抽取换成固定剧情、
     * 玩家聊完那条固定剧情后才进入锁定态 —— 模拟真实节奏。 */
    var must = engine.pickChat(s);
    ok(must && engine.isMustDateChat(must), '聊够后下次抽取返回「必须约会」固定剧情');
    if (must) engine.afterChat(s, must, false);
    ok(s.mustDate === true, '聊完固定剧情后进入必须约会锁定态');

    var dt = engine.goDate(s, 'standard');
    ok(s.relSpent > spent0, '关系内约会花费计入 relSpent（' + spent0 + ' → ' + s.relSpent + '）');

    var br = engine.doBreakup(s, '测试分手');
    ok(s.chatCount === 0, '分手后 chatCount 清零（实=' + s.chatCount + '）');
    ok(s.mustDate === false, '分手后 mustDate 解除');
    ok(s.relSpent === 0, '分手后 relSpent 清零');
    ok(s.partner === null && s.relationship === 'single', '分手后回到单身、partner 置空');
    ok(br.delta && finite(br.delta.mood), '分手返回的情绪变化量是有限数');

    ok(reachTalking(s), '分手后能重新相到新对象');
    engine.afterChat(s, c1, false);
    ok(s.chatCount === 1, '新对象聊 1 次 chatCount=' + s.chatCount);
    ok(s.mustDate === false, '新对象不应被旧账锁成「必须约会」');
  })();

  /* ============ 2. 分手心情三档 ============ */
  section('分手心情三档（zero / set / ratio）');
  (function () {
    var tiers = DB.num('BREAK_MOOD_TIERS', [
      { days: 30, money: 5000, mode: 'zero' },
      { days: 15, money: 2500, mode: 'set', value: 10 },
      { days: 0, money: 0, mode: 'ratio', value: 0.5 }
    ]);
    // ratio 档（最轻）：当天分、零花费 → 落到最后一档
    var a = engine.createGame('m', 'bg_worker', 'marry', 2, 'normal');
    a.relStartDay = a.day; a.relSpent = 0; a.mood = 80;
    var ta = engine.breakupTier(a);
    ok(ta.tier.mode === 'ratio', '零相处零花费 → ratio 档（实=' + ta.tier.mode + '）');
    engine.applyBreakupMood(a, ta);
    ok(a.mood === Math.round(80 * (ta.tier.value != null ? ta.tier.value : 0.5)),
      'ratio 档情绪按系数折减（80→' + a.mood + '）');

    var b = engine.createGame('m', 'bg_worker', 'marry', 3, 'normal');
    b.relStartDay = b.day - 20; b.relSpent = 3000; b.mood = 80;
    var tb = engine.breakupTier(b);
    ok(tb.tier.mode === 'set', '相处 20 天 → set 档（实=' + tb.tier.mode + '）');
    engine.applyBreakupMood(b, tb);
    ok(b.mood === Math.min(80, tb.tier.value != null ? tb.tier.value : 10),
      'set 档情绪压到阈值（→' + b.mood + '）');

    var c = engine.createGame('m', 'bg_worker', 'marry', 4, 'normal');
    c.relStartDay = c.day - 40; c.relSpent = 6000; c.mood = 80;
    var tc = engine.breakupTier(c);
    ok(tc.tier.mode === 'zero', '相处 40 天 → zero 档（实=' + tc.tier.mode + '）');
    engine.applyBreakupMood(c, tc);
    ok(c.mood === 0, 'zero 档情绪归 0（→' + c.mood + '）');

    ok(!(ta.tier.mode === tb.tier.mode && tb.tier.mode === tc.tier.mode), '三档确实分出不同档位');
  })();

  /* ============ 3. 结局优先级 ============ */
  section('结局优先级');
  (function () {
    var goal = JSON.parse(JSON.stringify(engine.createGame('m', 'bg_worker', 'marry', 5, 'normal').goal));
    goal.check = null;
    var s = engine.createGame('m', 'bg_worker', 'marry', 5, 'normal');
    s.goal = goal; s.money = 0; s.health = 0; s.mood = 0;
    var e = engine.checkEnd(s);
    ok(e && e.type === 'win', '目标达成时即使 money/health/mood 全 0 也判胜（实=' + (e && e.type) + '）');

    var s2 = engine.createGame('m', 'bg_worker', 'marry', 6, 'normal');
    s2.money = 0; s2.mood = 0;
    var e2 = engine.checkEnd(s2);
    ok(e2 && e2.id === 'broke', '同时破产+抑郁时优先判破产（实=' + (e2 && e2.id) + '）');

    var s3 = engine.createGame('m', 'bg_worker', 'marry', 7, 'normal');
    s3.health = 0; s3.mood = 0;
    var e3 = engine.checkEnd(s3);
    ok(e3 && e3.id === 'sick', '同时病倒+抑郁时优先判病倒（实=' + (e3 && e3.id) + '）');

    var s4 = engine.createGame('m', 'bg_worker', 'marry', 8, 'normal');
    s4.relationship = 'single'; s4.singleLimit = 10; s4.singleStreak = 10;
    var e4 = engine.checkEnd(s4);
    ok(e4 && e4.id === 'forced', '到点仍单身 → forced 结局（实=' + (e4 && e4.id) + '）');

    /* 时间上限兜底结局按关系状态分流：非婚恋目标（城市立足）下，玩家可能已经
     * 结婚却还没达标 —— 不能再套「你既没有走进婚姻」的单身文案。 */
    function overLimit(rel) {
      var x = engine.createGame('m', 'bg_worker', 'settle', 9, 'normal');
      x.day = x.diff.maxDays;
      x.relationship = rel;
      if (rel !== 'single') x.partner = { id: 'p_e', name: '边界对象', job: 'teacher', gender: 'f', avatar: null };
      x.money = 30000; x.career = 40;      // 离「城市立足」的 100 万 / 70 还差得远
      return engine.advanceDays(x, 1);
    }
    var eM = overLimit('married');
    var eT = overLimit('talking');
    var eS = overLimit('single');
    ok(eM && eM.id === 'married_stall', '已结婚 + 时间到 → married_stall（实=' + (eM && eM.id) + '）');
    ok(eM && eM.lines.join('').indexOf('没有走进婚姻') < 0, '已婚兜底文案不提「没走进婚姻」');
    ok(eM && eM.lines.join('').indexOf('{p}') < 0, '已婚兜底文案的 {p} 已替换成对象名');
    ok(eT && eT.id === 'stalled', '有对象未婚 + 时间到 → stalled（实=' + (eT && eT.id) + '）');
    ok(eS && eS.id === 'timeout', '单身 + 时间到 → timeout（实=' + (eS && eS.id) + '）');
    ok(eM && eT && eS && eM.id !== eT.id && eT.id !== eS.id, '三种关系状态的兜底结局互不相同');
  })();

  /* ============ 4. 流程边界 ============ */
  section('流程边界（firstMeet / goDate / doChild / 对方提分手）');
  (function () {
    var s = engine.createGame('m', 'bg_worker', 'marry', 9, 'normal');
    ok(reachTalking(s), '推进到接触中');

    var c = { kind: 'normal', phases: ['talking'], options: [{ fx: { affection: 1 }, reply: 'x' }] };
    engine.afterChat(s, c, false); engine.afterChat(s, c, false);
    var must2 = engine.pickChat(s);
    ok(must2 && engine.isMustDateChat(must2), '聊够后抽到固定「必须约会」剧情');
    if (must2) engine.afterChat(s, must2, false);
    ok(s.mustDate === true, '聊完固定剧情后锁定');
    engine.goDate(s, 'simple');
    ok(s.mustDate === false && s.chatCount === 0, 'goDate 后解除锁定并清零计数');

    var d = engine.createGame('m', 'bg_worker', 'marry', 10, 'normal');
    ok(reachTalking(d), '推进到接触中');
    var crashed = false;
    try {
      for (var i = 0; i < 50; i++) {
        if (d.relationship === 'single') { if (!reachTalking(d)) break; }
        d.affection = 10;
        engine.doConfess(d);
        if (!statOk(d)) { crashed = true; break; }
      }
    } catch (err) { crashed = true; console.log('  ✗ doConfess 循环抛异常：' + err.message); }
    ok(!crashed, 'doConfess 反复失败不崩、状态始终合法');

    var m = engine.createGame('m', 'bg_worker', 'marry', 11, 'normal');
    m.relationship = 'married'; m.affection = 10;
    var ch = engine.doChild(m);
    ok(ch.ok === false, '好感不足时 doChild 返回 ok=false（不报错）');
    ok(statOk(m), 'doChild 拒绝后状态仍合法');

    var sp = engine.createGame('m', 'bg_worker', 'marry', 12, 'normal');
    ok(engine.checkPartnerLeave(sp) === null, '单身时对方不会提分手');
  })();

  /* ============ 5. 好感度动态上限 ============ */
  section('好感度动态上限');
  (function () {
    var s = engine.createGame('m', 'bg_worker', 'marry', 13, 'normal');
    ok(reachTalking(s), '接触中');
    s.affection = 100;
    ok(s.affection <= engine.affectionCap(s), '接触中好感不超过 100');
    s.affection = 80;
    var guard = 0, entered = false;
    while (guard++ < 200 && !entered) {
      s.affection = 95;
      engine.doConfess(s);
      if (s.relationship === 'dating') entered = true;
    }
    ok(entered, '能进入到恋爱阶段');
    ok(s.affection <= engine.affectionCap(s), '恋爱后好感不超过 500（实=' + s.affection + '）');
    s.affection = 999;
    engine.applyStat(s, 'affection', 500);
    ok(s.affection <= 500, 'applyStat 不会击穿恋爱上限（实=' + s.affection + '）');
  })();

  /* ============ 6. 随机长跑压力测试 ============ */
  section('随机长跑压力测试（属性不越界 / 必收敛到结局）');
  (function () {
    var games = 120, bad = 0, noEnd = 0, steps = 0;
    for (var g = 0; g < games; g++) {
      var s = engine.createGame(Math.random() < 0.5 ? 'm' : 'f',
        ['bg_worker', 'bg_richer', 'bg_freelancer'][g % 3],
        'marry', 1000 + g, 'normal');
      var guard = 0, nanHit = false;
      while (!s.over && guard++ < 5000) {
        var r = Math.random();
        try {
          if (r < 0.2) { var ev = engine.pickLifeEvent(s); if (ev) engine.applyFx(s, ev.options[0].fx); }
          else if (r < 0.4) { var ev2 = engine.pickImproveEvent(s); if (ev2) engine.applyFx(s, ev2.options[0].fx); }
          else if (s.relationship === 'single' && !s.lead) { engine.findDate(s, 'self'); }
          else if (s.lead) { engine.firstMeet(s); s.affection = 60; engine.endMeet(s); }
          else if (s.relationship === 'talking' && s.affection > 60) engine.doConfess(s);
          else if (s.relationship === 'dating' && Math.random() < 0.5) engine.doPropose(s);
          engine.advanceDays(s, 1);
        } catch (e) { nanHit = true; bad++; console.log('  ✗ 第' + g + '局抛异常：' + e.message); break; }
        if (!statOk(s)) { nanHit = true; bad++; console.log('  ✗ 第' + g + '局状态越界'); break; }
        steps++;
      }
      if (!s.over && !nanHit) { noEnd++; }
      if (!statOk(s)) bad++;
    }
    ok(bad === 0, '120 局随机长跑无任何 NaN / 越界 / 异常（异常局=' + bad + '）');
    ok(noEnd === 0, '所有对局都收敛到某个结局（未结束局=' + noEnd + '）');
    console.log('  累计推进步数：' + steps);
  })();

  /* ============ 7. 极端输入与边界 ============ */
  section('极端输入与边界');
  (function () {
    var s = engine.createGame('m', 'bg_worker', 'marry', 14, 'normal');
    s.relStartDay = s.day;
    var br = engine.doBreakup(s, '');
    ok(finite(br.delta.mood) && s.mood >= 0 && s.mood <= 100, '当天分手仍安全（mood=' + s.mood + '）');

    var s2 = engine.createGame('m', 'bg_worker', 'marry', 15, 'normal');
    s2.health = 1;
    var e = engine.advanceDays(s2, 500);
    ok(s2.over === true, 'advanceDays(500) 必然走到结局');
    ok(s2.ending && s2.ending.id, '结局带 id（' + (s2.ending && s2.ending.id) + '）');
    ok(s2.day > 1 && s2.day <= 501, '天数推进合理（day=' + s2.day + '）');

    var a = engine.createGame('m', 'bg_worker', 'marry', 16, 'normal');
    var b = engine.createGame('f', 'bg_richer', 'settle', 17, 'normal');
    a.money = 12345;
    ok(b.money !== 12345, '两局状态相互独立（改一局不影响另一局）');
  })();

  /* ============ 8. 对象主动提分手（阈值 / 预警 / 对抗性） ============ */
  section('对象主动提分手（一天一次 / 冷静期 / 预警可解除 / 难度生效）');
  (function () {
    /* 造一个「已经在关系里」的状态：把对方设成指定人格，属性由调用方覆盖 */
    function rel(personalityId, diff, day) {
      var s = engine.createGame('m', 'bg_worker', 'marry', 31, diff || 'normal');
      s.relationship = 'talking';
      s.partner = { id: 'p_leave', name: '测试对象', job: 'teacher', gender: 'f', avatar: null, personalityId: personalityId };
      s.partnerSinceDay = day === undefined ? s.day : day;
      s.relStartDay = s.partnerSinceDay;
      return s;
    }
    /* 把状态摆到「金钱至上」已经踩线：钱不够（阈值 4 万 / 1.5 万两档） */
    function broke(s) { s.money = 8000; s.mood = 80; s.health = 80; s.career = 80; s.affection = 80; return s; }

    /* ---- ① 冷静期：刚在一起的头几天不判定 ---- */
    var g = rel('money');
    broke(g);
    ok(engine.checkPartnerLeave(g) === null, '冷静期内不判定（刚在一起第 0 天）');
    ok(g.leaveRollDay === null, '冷静期内连掷骰都不掷（leaveRollDay 仍为空）');
    g.day += C_GRACE();
    var first = engine.checkPartnerLeave(g);
    ok(first !== null, '过了冷静期，踩线就一定会被看见（第 ' + C_GRACE() + ' 天）');

    /* ---- ② 一天只判定一次 ---- */
    var rolls = 0;
    var h = rel('money'); broke(h); h.day += C_GRACE();
    for (var i = 0; i < 5; i++) {
      var before = h.leaveRollDay;
      engine.checkPartnerLeave(h);
      if (h.leaveRollDay !== before) rolls++;
    }
    ok(rolls === 1, '同一天调用 5 次只真正判定 1 次（实=' + rolls + '）');

    /* ---- ③ 两段式：第一次踩线只预警，不分手 ---- */
    var w = rel('money'); broke(w); w.day += C_GRACE();
    var r3 = engine.checkPartnerLeave(w);
    ok(r3 && r3.warn === true, '第一次踩线只给预警（不直接分手）');
    ok(w.leaveWarnDay === w.day && !!w.leaveWarnReason, '预警挂起并记下原因（主界面关系卡要用）');
    /* 存的必须是「已经替换过性别代词」的文案：浮窗 / 日志走 fillText 会替换，
     * 但关系卡上那条常驻预警条是渲染层用 fmt() 直接拼的 —— 存原文就会把
     * 性格规则里的 `她(O)` 占位符原样画到屏幕上。 */
    ok(String(w.leaveWarnReason).indexOf('(O)') < 0,
      '预警原因不含性别占位符（(O) 不会漏到关系卡上）');
    ok(String(w.leaveWarnReason).indexOf('她') >= 0,
      '预警原因按对象性别替换（女对象 → 她）');
    var wm = rel('money'); wm.partner.gender = 'm'; broke(wm); wm.day += C_GRACE();
    engine.checkPartnerLeave(wm);
    ok(String(wm.leaveWarnReason).indexOf('他') >= 0 && String(wm.leaveWarnReason).indexOf('她') < 0,
      '预警原因按对象性别替换（男对象 → 他）');
    ok(r3 && /.{2,}/.test(String(r3.text)) && String(r3.text).indexOf('{') < 0,
      '预警文案已做占位符替换（无残留 {}）');

    /* ---- ④ 对抗性：把那一项补回去，预警立刻解除 ---- */
    var f = rel('money'); broke(f); f.day += C_GRACE();
    engine.checkPartnerLeave(f);
    var strikesBefore = f.leaveStrikes;
    f.money = 200000;                 // 补回存款
    f.day += 1;
    var r4 = engine.checkPartnerLeave(f);
    ok(r4 === null, '条件补回来之后不再触发');
    ok(f.leaveWarnDay === null && f.leaveWarnReason === null, '预警被解除（主界面提示条随之消失）');
    ok(f.leaveStrikes === strikesBefore + 1, '解除记一次宽容额度（实=' + f.leaveStrikes + '）');

    /* ---- ⑤ 宽容额度用完 → 不再给预警，直接进入判定 ---- */
    var e = rel('money'); broke(e); e.day += C_GRACE();
    e.leaveStrikes = 99;              // 额度用尽
    /* 「直接判定」是概率事件，这里把随机数钉死，才能稳定断言它走的是判定而不是预警 */
    var realRandom = Math.random;
    Math.random = function () { return 0; };
    var r5 = engine.checkPartnerLeave(e);
    Math.random = realRandom;
    ok(!!r5 && r5.warn !== true && !!r5.title, '宽容额度用尽后直接判定（返回分手结果，不再预警）');
    ok(e.leaveWarnDay === null, '直接判定这条路不会顺手挂上预警');

    /* ---- ⑥ 无预兆的离开：不给预警、不吃积怨，就是低概率突然离场 ---- */
    var su = rel('casual');           // 「随便玩玩」有一条 warn:false 的低概率规则
    su.money = 200000; su.mood = 90; su.health = 90; su.career = 90; su.affection = 95;
    su.day += C_GRACE();
    var rkSu = engine.leaveRiskOf(su, R.personalityRisk(su, DB.list('personalities').filter(function (p) { return p.id === 'casual'; })[0]));
    ok(rkSu.warn === 0 && rkSu.sudden > 0 && rkSu.sudden < 0.02,
      '「随便玩玩」在状态良好时只有无预兆的低概率（warn=' + rkSu.warn + ' sudden=' + rkSu.sudden + '）');
    /* 同样的天数、同样的状态，状态良好时不会出预警 */
    var su2 = rel('casual'); su2.money = 200000; su2.mood = 90; su2.health = 90; su2.career = 90; su2.affection = 95;
    su2.day += C_GRACE();
    var r6 = engine.checkPartnerLeave(su2);
    ok(r6 === null || r6.warn !== true, '状态良好时不会收到预警（要分手就是无声无息地走）');

    /* ---- ⑦ 难度真的影响分手概率（上限要先封顶再乘难度） ---- */
    function riskAt(diff) {
      var s = rel('money', diff); broke(s);
      s.day = 10; s.leaveWarnDay = 4; s.leaveStrikes = 99;
      return engine.leaveRiskOf(s, R.personalityRisk(s, DB.list('personalities').filter(function (p) { return p.id === 'money'; })[0]));
    }
    var rEasy = riskAt('easy'), rNorm = riskAt('normal'), rHard = riskAt('hard');
    ok(rEasy.warn < rNorm.warn && rNorm.warn < rHard.warn,
      '三档难度的每日分手概率递增（' + rEasy.warn.toFixed(3) + ' < ' + rNorm.warn.toFixed(3) +
      ' < ' + rHard.warn.toFixed(3) + '）');
    ok(rHard.warn <= rHard.ceil && rNorm.warn <= rNorm.ceil,
      '每日概率不超过该难度的天花板（' + rNorm.ceil + ' / ' + rHard.ceil + '）');

    /* ---- ⑧ 积怨：预警挂着不处理，风险逐日上升且有上限 ---- */
    var rg = rel('money'); broke(rg);
    rg.leaveWarnDay = rg.day; rg.leaveStrikes = 99;
    var per = DB.list('personalities').filter(function (p) { return p.id === 'money'; })[0];
    var at4 = engine.leaveRiskOf(rg, R.personalityRisk(rg, per)).warn;
    rg.day += 6;
    var at10 = engine.leaveRiskOf(rg, R.personalityRisk(rg, per)).warn;
    rg.day += 60;
    var at70 = engine.leaveRiskOf(rg, R.personalityRisk(rg, per)).warn;
    ok(at10 > at4, '预警挂着不处理，风险随天数上升（第4天 ' + at4.toFixed(3) + ' → 第10天 ' + at10.toFixed(3) + '）');
    ok(at70 <= rNorm.ceil + 1e-9, '积怨有上限，不会无限爬升（第70天仍被压在 ' + at70.toFixed(3) + '）');

    /* ---- ⑨ 「踩得多深」影响风险：同一条规则，见底比刚好踩线更危险 ---- */
    ok(R.condSeverity({ field: 'money', op: 'lt', value: 40000 }, { money: 40000 }) === 0,
      '刚好踩线时深度为 0（风险与旧数值一致）');
    var half = R.condSeverity({ field: 'money', op: 'lt', value: 40000 }, { money: 20000 });
    var full = R.condSeverity({ field: 'money', op: 'lt', value: 40000 }, { money: 0 });
    ok(half > 0.4 && half < 0.6, '踩到阈值一半时深度约 0.5（实=' + half.toFixed(2) + '）');
    ok(full === 1, '见底时深度为 1（实=' + full + '）');
    var shallow = R.personalityRisk({ money: 39000, mood: 90, health: 90, career: 90 }, per);
    var deep = R.personalityRisk({ money: 1000, mood: 90, health: 90, career: 90 }, per);
    ok(deep.risk > shallow.risk,
      '同一人格下，踩得越深风险越高（' + shallow.risk.toFixed(4) + ' → ' + deep.risk.toFixed(4) + '，抹平阈值断崖）');

    /* ---- ⑩ 关系结束 / 新关系起点：判定状态归零，不带到下一段 ---- */
    var nb = rel('money'); broke(nb); nb.day += C_GRACE();
    engine.checkPartnerLeave(nb);
    engine.doBreakup(nb, '测试');
    ok(nb.partnerSinceDay === null && nb.leaveWarnDay === null && nb.leaveWarnReason === null && nb.leaveStrikes === 0,
      '分手后判定状态全部归零（前任的积怨不会算到新对象头上）');

    /* ---- ⑪ 婚后折扣：领了证之后，同样的处境下风险更低 ---- */
    var marriedPer = DB.list('personalities').filter(function (p) { return p.id === 'money'; })[0];
    var mTalking = rel('money'); broke(mTalking);
    mTalking.day = 10; mTalking.leaveWarnDay = 4; mTalking.leaveStrikes = 99;
    var rkTalking = engine.leaveRiskOf(mTalking, R.personalityRisk(mTalking, marriedPer));
    var mMarried = rel('money'); broke(mMarried);
    mMarried.relationship = 'married';
    mMarried.day = 10; mMarried.leaveWarnDay = 4; mMarried.leaveStrikes = 99;
    var rkMarried = engine.leaveRiskOf(mMarried, R.personalityRisk(mMarried, marriedPer));
    ok(rkMarried.marriedMod < 1 && rkMarried.warn < rkTalking.warn,
      '已婚的分手风险低于恋爱中（' + rkTalking.warn.toFixed(3) + ' → ' + rkMarried.warn.toFixed(3) +
      '，marriedMod=' + rkMarried.marriedMod + '）');
    ok(rkMarried.warn <= rkMarried.ceil + 1e-9,
      '婚后折扣后仍不超过自己的天花板（' + rkMarried.warn.toFixed(3) + ' ≤ ' + rkMarried.ceil.toFixed(3) + '）');

    /* ---- ⑫ 「没想好要认真」这条无条件规则不在婚后生效 ----
     * 都领证了再说「我没想好要认真」是自相矛盾的；更要紧的是它 warn:false，
     * 婚后玩家会莫名其妙吃到一份「没有预兆的离开」。 */
    var casualPer = DB.list('personalities').filter(function (p) { return p.id === 'casual'; })[0];
    var cSingle = rel('casual'); cSingle.money = 200000; cSingle.mood = 90;
    cSingle.health = 90; cSingle.career = 90; cSingle.affection = 95;
    var cMarried = rel('casual'); cMarried.money = 200000; cMarried.mood = 90;
    cMarried.health = 90; cMarried.career = 90; cMarried.affection = 95;
    cMarried.relationship = 'married';
    var rSingle = R.personalityRisk(cSingle, casualPer);
    var rMarried = R.personalityRisk(cMarried, casualPer);
    ok(rSingle.suddenRisk > 0, '恋爱中的「随便玩玩」仍有无预兆离开的可能（' + rSingle.suddenRisk + '）');
    ok(!rMarried || !(rMarried.suddenRisk > 0),
      '已婚的「随便玩玩」不再触发无条件规则（suddenRisk=' + (rMarried && rMarried.suddenRisk) + '）');
  })();

  /* ============ 9. 存档链路回归守卫 ============ */
  section('存档链路（saveGame / resumeGame 字段完整性）');
  (function () {
    var fs = require('fs');
    var src = fs.readFileSync('js/ui/render.js', 'utf8');
    ok(/function\s+saveGame/.test(src) && /function\s+resumeGame/.test(src),
      '存在 saveGame / resumeGame（玩家对局状态落本地存储）');
    /* relSpent 是分手心情三档的关键输入：必须同时出现在「存」与「读」两侧，
     * 否则读档后分手会永远退到最轻档。这里做静态回归守卫。 */
    var saveBlock = (src.split('function saveGame')[1] || '').split('function loadGame')[0];
    ok(/relSpent/.test(saveBlock), 'saveGame 持久化 relSpent');
    var resumeBlock = (src.split('function resumeGame')[1] || '').split('function clearSave')[0];
    ok(/relSpent/.test(resumeBlock), 'resumeGame 还原 relSpent');
    /* 「对象主动提分手」的判定状态同理：漏存 leaveWarnDay / leaveStrikes，
     * 玩家只要在被预警后重进游戏就能把预警和宽容额度洗掉，永远轮不到分手。 */
    ['leaveWarnDay', 'leaveStrikes', 'leaveRollDay', 'partnerSinceDay', 'leaveWarnReason'].forEach(function (k) {
      ok(new RegExp(k).test(saveBlock), 'saveGame 持久化 ' + k);
      ok(new RegExp(k).test(resumeBlock), 'resumeGame 还原 ' + k);
    });
    /* 结局必须清档：否则结束后仍能「继续游戏」，恢复到僵尸局 */
    var endBlock = (src.split('function renderEnd')[1] || '').split('function drawEnd')[0];
    ok(/clearSave\(\)/.test(endBlock), 'renderEnd 进入结局页即清档');
    /* 行为层往返在 ui-smoke 里用真实渲染夹具验证 */
    console.log('  · 存读档行为往返 / 结局清档由 ui-smoke 验证');
  })();

  console.log('\n========================================');
  console.log('EDGE SMOKE ' + (fail === 0 ? 'OK' : 'FAILED') + '  ✓ ' + pass + ' / ✗ ' + fail);
  if (fail) {
    console.log('失败项：');
    fails.forEach(function (f) { console.log('  - ' + f); });
    process.exit(1);
  }
  process.exit(0);
}

/* ---------------- 加载云端数据后启动 ---------------- */
var fixture = hm.loadCloudFixture();
hm.installCloudWx(function (name) { return fixture[name]; }, {});
DB.load({ cloud: { env: 'cloud1-d7gwcey64cad30d91' } }).then(function (res) {
  if (res.source === 'error') {
    console.error('云端数据加载失败，无法运行边界测试：');
    (res.problems || []).forEach(function (p) { console.error('  - ' + p); });
    process.exit(2);
  }
  runTests();
}).catch(function (e) {
  console.error('边界测试启动失败：', e);
  process.exit(2);
});

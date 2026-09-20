/* =========================================================
 * 「对象主动提分手」风险体检（tools/analyze-leave-risk.js）
 * ---------------------------------------------------------
 * 用途：把 personalities 的规则 + engine.checkPartnerLeave 的机制一起换算成
 *       「每天有多大概率被预警 / 被分手、一段关系能撑多久」，
 *       用来判断阈值是不是合理，也用来对照改动前后的体感差异。
 *
 * 为什么必须走真实引擎而不是自己算概率：
 *   现在的规则不是「单次 risk → 每天一次掷骰」这么简单，而是叠了
 *     · 一天只判定一次的闸（render 有三处会调它）
 *     · 关系开头的冷静期
 *     · 两段式（先预警，预警挂着时风险按积怨每天往上加，有上限）
 *     · ±PARTNER_LEAVE_JITTER 的随机抖动与难度 riskMod
 *   手算很容易算错，直接跑引擎最省事。
 *
 * 运行：node tools/analyze-leave-risk.js
 * ========================================================= */
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');
var hm = require(path.join(ROOT, 'tools/helpers/cloud-mock.js'));
var DB = require(path.join(ROOT, 'js/db/repository.js'));
var engine = require(path.join(ROOT, 'js/core/engine.js'));
var R = require(path.join(ROOT, 'js/core/rules.js'));

var fixture = hm.loadCloudFixture();
hm.installCloudWx(function (n) { return fixture[n]; }, {});

/* 渲染层一天会调 checkPartnerLeave 的次数（引擎内部有「一天只判定一次」的闸，
 * 这里故意按 3 次来调，顺便验证闸真的生效） */
var CALLS_PER_DAY = 3;
var HORIZON = 60;          // 观察 60 天
var N = 20000;             // 每组模拟次数

/* 两档玩家状态：说明「阈值一变动，谁先受影响」 */
var PROFILES = [
  {
    key: 'good', name: '状态健康',
    s: { affection: 80, mood: 70, money: 60000, health: 70, career: 60 }
  },
  {
    key: 'edge', name: '边缘（一两项踩线）',
    s: { affection: 34, mood: 34, money: 30000, health: 34, career: 32 }
  },
  {
    key: 'bad', name: '危险区（多项踩线）',
    s: { affection: 20, mood: 20, money: 10000, health: 20, career: 20 }
  }
];

function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
function pct(x) { return (x * 100).toFixed(1) + '%'; }

function baseState(profile, personalityId, difficultyId, relationship) {
  var s = engine.createGame('m', 'bg_worker', 'marry', 20260918, difficultyId || 'normal');
  Object.keys(profile.s).forEach(function (k) { s[k] = profile.s[k]; });
  s.relationship = relationship || 'talking';
  s.partner = { id: 'x', name: '对象', job: 'teacher', gender: 'f', personalityId: personalityId };
  s.partnerSinceDay = s.day;      // 冷静期从这里起算
  s.relStartDay = s.day;
  return s;
}

/* 跑一次：返回 { warnDay, breakDay }（没发生就是 0） */
function runOnce(profile, personalityId, difficultyId, relationship) {
  var s = baseState(profile, personalityId, difficultyId, relationship);
  var warnDay = 0, breakDay = 0, rolls = 0, lastRollDay = null;
  for (var d = 1; d <= HORIZON; d++) {
    for (var c = 0; c < CALLS_PER_DAY; c++) {
      var before = s.leaveRollDay;
      var r = engine.checkPartnerLeave(s);
      if (s.leaveRollDay !== before) { rolls++; lastRollDay = s.day; }
      if (!r) continue;
      if (r.warn) { if (!warnDay) warnDay = d; continue; }
      breakDay = d;
      break;
    }
    if (breakDay) break;
    s.day = s.day + 1;
  }
  return { warnDay: warnDay, breakDay: breakDay, rolls: rolls, lastRollDay: lastRollDay };
}

function simulate(profile, personalityId, difficultyId, relationship) {
  var warnAlive = 0, surv30 = 0, surv60 = 0;
  var firstWarn = [], breakDays = [];
  var rollsPerDay = 0;
  for (var i = 0; i < N; i++) {
    var r = runOnce(profile, personalityId, difficultyId, relationship);
    rollsPerDay += r.rolls;
    if (r.warnDay) { warnAlive++; firstWarn.push(r.warnDay); }
    if (r.breakDay) breakDays.push(r.breakDay);
    else surv60++;
    if (!r.breakDay || r.breakDay > 30) surv30++;
  }
  firstWarn.sort(function (a, b) { return a - b; });
  breakDays.sort(function (a, b) { return a - b; });
  var med = function (arr) { return arr.length ? arr[Math.floor(arr.length / 2)] : 0; };
  var pctile = function (arr, q) {
    return arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * q))] : 0;
  };
  return {
    warnRate: warnAlive / N,
    warnMed: med(firstWarn),
    breakRate: breakDays.length / N,
    breakMed: med(breakDays),
    breakP10: pctile(breakDays, 0.1),
    breakP90: pctile(breakDays, 0.9),
    surv30: surv30 / N,
    surv60: surv60 / N,
    rollsPerRun: rollsPerDay / N,
    everBreak: breakDays.length > 0
  };
}

DB.load({ cloud: { env: 'x' } }).then(function () {
  var pers = DB.list('personalities');

  console.log('══════════════════════════════════════════════════════════════');
  console.log(' 一、触发条件一览（单次风险 = 条件满足时一次判定的概率）');
  console.log('══════════════════════════════════════════════════════════════');
  pers.forEach(function (p) {
    console.log('  ' + p.name + '（' + p.id + '，combine=' + (p.combine || 'first') + '）');
    (p.rules || []).forEach(function (r) {
      console.log('    ' + pad(r.cond ? JSON.stringify(r.cond) : '无条件（恒触发）', 58) + ' → ' + r.risk);
    });
  });

  console.log('');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(' 二、真实引擎模拟（' + N + ' 次/组，' + HORIZON + ' 天上限，一天调用 ' + CALLS_PER_DAY + ' 次）');
  console.log('     先预警、预警挂着不处理才会被分手；状态全程冻结在档位取值');
  console.log('══════════════════════════════════════════════════════════════');

  PROFILES.forEach(function (pf) {
    console.log('【' + pf.name + '】aff=' + pf.s.affection + ' mood=' + pf.s.mood +
      ' money=' + pf.s.money + ' health=' + pf.s.health + ' career=' + pf.s.career);
    console.log('  ' + pad('人格', 11) + pad('出预警', 9) + pad('首次预警', 10) +
      pad('被分手', 9) + pad('分手中位', 10) + pad('分手 10~90 分位', 18) +
      pad('活过30天', 10) + '每天判定');
    console.log('  ' + '─'.repeat(98));
    pers.forEach(function (p) {
      var r = simulate(pf, p.id, 'normal');
      var spread = r.breakP10 ? (r.breakP10 + '~' + r.breakP90 + ' 天') : '—';
      console.log('  ' + pad(p.name, 9) + pad(pct(r.warnRate), 9) + pad(r.warnMed ? r.warnMed + ' 天' : '—', 10) +
        pad(pct(r.breakRate), 9) + pad(r.breakMed ? r.breakMed + ' 天' : '—', 10) +
        pad(spread, 18) +
        pad(pct(r.surv30), 10) +
        (r.rollsPerRun / HORIZON).toFixed(2) + ' 次');
    });
    console.log('');
  });

  console.log('══════════════════════════════════════════════════════════════');
  console.log(' 三、每日风险怎么涨（危险区 + 金钱至上，预警挂在第 4 天）');
  console.log('     上限先作用在人格风险上、再乘难度；积怨每天 +RAGE_STEP，到顶后不再涨');
  console.log('══════════════════════════════════════════════════════════════');
  (function () {
    var C = DB.get('constants') || {};
    var maxRisk = C.PARTNER_LEAVE_MAX_RISK, rage = C.PARTNER_LEAVE_RAGE_STEP;
    console.log('  PARTNER_LEAVE_MAX_RISK=' + maxRisk + '  RAGE_STEP=' + rage +
      '  JITTER=' + C.PARTNER_LEAVE_JITTER + '  GRACE=' + C.PARTNER_LEAVE_GRACE_DAYS +
      '  MAX_WARNINGS=' + C.PARTNER_LEAVE_MAX_WARNINGS);
    console.log('  ' + pad('难度', 9) + pad('基础(封顶后)', 14) + pad('第7天', 10) +
      pad('第10天', 10) + pad('第14天', 10) + pad('封顶', 10) + '累计到第14天被分手');
    console.log('  ' + '─'.repeat(76));
    ['easy', 'normal', 'hard'].forEach(function (dif) {
      var s = baseState(PROFILES[2], 'money', dif);
      s.day = 4; s.leaveWarnDay = 4;
      var rk0 = engine.leaveRiskOf(s, R.personalityRisk(s, pers.filter(function (p) { return p.id === 'money'; })[0]));
      var base = Math.min(rk0.warn, rk0.ceil);   // 第 4 天：还没积怨
      s.day = 7; var d7 = engine.leaveRiskOf(s, R.personalityRisk(s, pers.filter(function (p) { return p.id === 'money'; })[0])).warn;
      s.day = 10; var d10 = engine.leaveRiskOf(s, R.personalityRisk(s, pers.filter(function (p) { return p.id === 'money'; })[0])).warn;
      s.day = 14; var d14 = engine.leaveRiskOf(s, R.personalityRisk(s, pers.filter(function (p) { return p.id === 'money'; })[0])).warn;
      /* 从第 5 天起逐日累乘，得到「到第 14 天为止至少被分手一次」的概率 */
      var survive = 1;
      for (var d = 5; d <= 14; d++) {
        s.day = d;
        var pw = engine.leaveRiskOf(s, R.personalityRisk(s, pers.filter(function (p) { return p.id === 'money'; })[0])).warn;
        survive *= (1 - Math.min(pw, rk0.ceil));
      }
      console.log('  ' + pad(dif, 9) + pad((base * 100).toFixed(1) + '%', 14) +
        pad((d7 * 100).toFixed(1) + '%', 10) + pad((d10 * 100).toFixed(1) + '%', 10) +
        pad((d14 * 100).toFixed(1) + '%', 10) + pad((rk0.ceil * 100).toFixed(1) + '%', 10) +
        ((1 - survive) * 100).toFixed(1) + '%');
    });
  })();


  console.log('══════════════════════════════════════════════════════════════');
  console.log(' 四、难度对照（同一状态，只换难度）');
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  ' + pad('难度', 9) + pad('人格', 9) + pad('被分手', 9) + pad('分手中位', 10) +
    pad('分手 10~90 分位', 18) + '活过30天');
  console.log('  ' + '─'.repeat(66));
  ['easy', 'normal', 'hard'].forEach(function (dif) {
    ['money', 'emo'].forEach(function (pid) {
      var p = pers.filter(function (x) { return x.id === pid; })[0];
      var r = simulate(PROFILES[2], pid, dif);
      console.log('  ' + pad(dif, 9) + pad(p.name, 9) + pad(pct(r.breakRate), 9) +
        pad(r.breakMed ? r.breakMed + ' 天' : '—', 10) +
        pad(r.breakP10 ? r.breakP10 + '~' + r.breakP90 + ' 天' : '—', 18) + pct(r.surv30));
    });
  });

  console.log('');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(' 五、改动前 vs 改动后（危险区，同一天数窗口）');
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  旧机制：一天判定 2 次、没有预警、没有冷静期，单次命中直接分手');
  console.log('  ' + pad('人格', 11) + pad('旧：每天风险', 14) + pad('旧：中位分手', 13) +
    pad('新：有预警窗口', 16) + '新：中位分手');
  console.log('  ' + '─'.repeat(72));
  var OLD = {
    money: 0.06, emo: 0.09, char: 0.05, casual: 0.05, family: 0, career: 0.05
  };
  pers.forEach(function (p) {
    var oldPer = OLD[p.id] || 0;
    var oldDay = 1 - Math.pow(1 - oldPer, 2);
    var oldMed = oldDay > 0 ? Math.round(Math.log(0.5) / Math.log(1 - oldDay)) : 0;
    var r = simulate(PROFILES[2], p.id, 'normal');
    console.log('  ' + pad(p.name, 9) + pad(oldPer ? pct(oldDay) : '不触发', 14) +
      pad(oldMed ? oldMed + ' 天' : '—', 13) +
      pad(r.warnRate > 0.5 ? '有（约 ' + r.warnMed + ' 天开始）' : '很少触发', 16) +
      (r.breakMed ? r.breakMed + ' 天' : '—'));
  });

  console.log('');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(' 六、婚后折扣（PARTNER_LEAVE_MARRIED_MOD=' +
    ((DB.get('constants') || {}).PARTNER_LEAVE_MARRIED_MOD) + '）');
  console.log('     已婚不再吃「没想好要认真」那条无条件风险；其余风险照算但打折');
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  ' + pad('状态', 9) + pad('关系', 9) + pad('人格', 9) + pad('每日风险', 9) +
    pad('分手中位', 10) + '活过30天');
  console.log('  ' + '─'.repeat(60));
  [['good', PROFILES[0]], ['bad', PROFILES[2]]].forEach(function (pair) {
    var pf = pair[1];
    ['talking', 'married'].forEach(function (rel) {
      ['money', 'casual'].forEach(function (pid) {
        var p = pers.filter(function (x) { return x.id === pid; })[0];
        var s = baseState(pf, pid, 'normal', rel);
        var rk = engine.leaveRiskOf(s, R.personalityRisk(s, p));
        var r = simulate(pf, pid, 'normal', rel);
        console.log('  ' + pad(pf.name.slice(0, 4), 9) + pad(rel === 'married' ? '已婚' : '恋爱中', 9) +
          pad(p.name, 9) + pad(pct(rk.warn + rk.sudden), 9) +
          pad(r.breakMed ? r.breakMed + ' 天' : '—', 10) + pct(r.surv30));
      });
    });
  });
  return null;
}).catch(function (e) { console.error(e); process.exit(2); });

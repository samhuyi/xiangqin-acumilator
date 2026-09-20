/* =========================================================
 * 引擎冒烟测试（Node 环境，模拟 wx.cloud）
 * ---------------------------------------------------------
 * 用 db/export/import/*.json 模拟云端数据 + 策略型 AI 批量模拟整局，验证：
 *   1. 数据从云端正确加载（事件数 / 背景 / 目标 / 难度）
 *   2. 引擎端到端不崩溃、指标不越界、结局可触发
 *   3. 三档难度胜率与平衡合理
 *
 * 运行： node tools/smoke.js
 * ========================================================= */

'use strict';

var hm = require('./helpers/cloud-mock.js');
var DB = require('../js/db/repository.js');
var engine = require('../js/core/engine.js');

var STRAT = 0.7;

function randPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function scoreOption(opt, goalId, s) {
  var fx = opt.fx || {};
  var m = (fx.money || 0) / 10000;
  var sc = 0;
  if (goalId === 'marry' || goalId === 'true_love') {
    sc = (fx.affection || 0) * 3 + (fx.health || 0) * 0.5 + (fx.career || 0) * 0.3 + m * 0.5 +
      (fx.looks || 0) * 0.6 + (fx.family || 0) * 0.6 + (fx.mood || 0) * 0.4;
  } else if (goalId === 'rich_alone' || goalId === 'settle' || goalId === 'free') {
    sc = m * 2 + (fx.career || 0) * 0.8 + (fx.health || 0) * 0.6 + (fx.affection || 0) * 0.2 + (fx.mood || 0) * 0.3;
  } else if (goalId === 'career_peak') {
    sc = (fx.career || 0) * 3 + (fx.health || 0) * 0.8 + m * 0.5 + (fx.mood || 0) * 0.3;
  } else {
    sc = (fx.health || 0) * 1.5 + (fx.career || 0) * 1.0 + m * 0.8 + (fx.affection || 0) * 0.1 +
      (fx.looks || 0) * 0.3 + (fx.mood || 0) * 0.6;
  }
  if (s.health < 30) sc += (fx.health || 0) * 5;
  if (s.money < 20000) sc += m * 6;
  if (s.career < 20) sc += (fx.career || 0) * 3;
  if (s.mood < 25) sc += (fx.mood || 0) * 5;
  return sc;
}

function doEvent(s, ev, affMult) {
  var oi = 0;
  if (Math.random() < STRAT) {
    var best = -1e9;
    ev.options.forEach(function (o, i) {
      var sc = scoreOption(o, s.goal.id, s);
      if (sc > best) { best = sc; oi = i; }
    });
  } else {
    oi = Math.floor(Math.random() * ev.options.length);
  }
  s.recent.push(ev.id);
  if (s.recent.length > 6) s.recent.shift();
  var opt = ev.options[oi];
  var REL_AMP = DB.num('RELATION_AFF_AMP', 1.6);
  var amp = (ev.phase === 'meeting' || ev.phase === 'talking' || ev.phase === 'dating' || ev.phase === 'married') ? REL_AMP : 1;
  if (affMult) amp *= affMult;
  if (opt.breakup) {
    engine.doBreakup(s, opt.result);
  } else {
    engine.applyFx(s, opt.fx, amp);
    engine.applyStyleRisk(s);
    engine.checkBreakup(s);
  }
}

function pickChannel(s) {
  if (s.money >= 200000) return 'matchmaker';
  if (s.money >= 8000) return 'app';
  if (s.money >= 800) return 'relative';
  return 'self';
}

function simulate(gender, bgId, goalId, difficultyId) {
  var s = engine.createGame(gender, bgId, goalId, null, difficultyId);
  s.clicks = 0;
  var guard = 0;
  while (!s.over && guard++ < 2000) {
    var r = s.relationship;
    var want = s.goal.needRelation;
    var days = 1;

    if (want) {
      if (r === 'single' && !s.lead) {
        if (s.money < 8000) { days = engine.doOvertime(s).days; s.clicks += 2; }
        else { days = engine.findDate(s, pickChannel(s)).days; s.clicks += 3; }
      } else if (r === 'single' && s.lead) {
        var res = engine.firstMeet(s);
        days = res.days;
        doEvent(s, engine.pickMeetingEvent(s));
        engine.endMeet(s);
        s.clicks += 4;
      } else if (r === 'meeting') {
        engine.endMeet(s);
        days = 1; s.clicks += 1;
      } else if (r === 'talking') {
        if (s.affection >= 70) {
          engine.doConfess(s);
          days = engine.actionDays('confess', s);
          s.clicks += 2;
        } else {
          var type = s.money >= 6000 ? 'activity' : (s.money >= 2000 ? 'standard' : 'simple');
          var rd = engine.goDate(s, type);
          doEvent(s, rd.event, rd.type.affMult);
          days = rd.days;
          s.clicks += 5;
        }
      } else if (r === 'dating') {
        /* 好感度是动态值：告白成功后刻度变成 0~500，求婚成功率按新刻度算，
         * 所以这里不能再拿「78」这种旧刻度的固定值当门槛 ——
         * 直接问引擎「现在求婚划不划算」，策略跟着数值设计走。
         * 另外：日子不多了就不再挑肥拣瘦，有一线机会也要开口。 */
        var odds = engine.proposeChance(s);
        var leftDays = (s.diff.maxDays || 0) - s.day;
        var wantPropose = s.money >= 70000 && (odds >= 0.45 || (leftDays <= 25 && odds >= 0.2));
        if (wantPropose) {
          engine.doPropose(s);
          days = engine.actionDays('propose', s);
          s.clicks += 2;
        } else {
          var dt2 = s.affection < engine.proposeAffectionMin(s) ? 'activity' : 'standard';
          var rd2 = engine.goDate(s, dt2);
          doEvent(s, rd2.event, rd2.type.affMult);
          days = rd2.days;
          s.clicks += 5;
        }
      } else if (r === 'married') {
        if (!s.flags.child) {
          engine.doChild(s);
          days = engine.actionDays('child', s);
          s.clicks += 2;
        } else {
          var rd3 = engine.goDate(s, 'simple');
          doEvent(s, rd3.event, rd3.type.affMult);
          days = rd3.days;
          s.clicks += 5;
        }
      }
    } else {
      var roll = Math.random();
      if (roll < 0.4) {
        var ev = engine.pickImproveEvent(s);
        doEvent(s, ev);
        days = engine.eventDays(ev, s);
        s.clicks += 3;
      } else if (roll < 0.7) {
        var ev2 = engine.pickLifeEvent(s);
        doEvent(s, ev2);
        days = engine.eventDays(ev2, s);
        s.clicks += 3;
      } else {
        days = engine.doOvertime(s).days;
        s.clicks += 2;
      }
    }

    if (!s.over && Math.random() < 0.2) {
      var ev3 = engine.pickLifeEvent(s);
      doEvent(s, ev3);
      days += engine.eventDays(ev3, s);
      s.clicks += 2;
    }

    if (isNaN(s.money) || isNaN(s.health) || isNaN(s.career) || isNaN(s.affection) ||
        isNaN(s.looks) || isNaN(s.family) || isNaN(s.mood)) {
      throw new Error('NaN 指标: ' + JSON.stringify({ m: s.money, h: s.health, c: s.career, a: s.affection, l: s.looks, f: s.family, mo: s.mood }));
    }
    if (s.health < 0 || s.health > 100 || s.career < 0 || s.career > 100 || s.looks < 0 || s.mood < 0) {
      throw new Error('指标越界: h=' + s.health + ' c=' + s.career + ' l=' + s.looks + ' mood=' + s.mood);
    }

    var e = engine.checkEnd(s);
    if (e) { s.over = true; s.ending = e; break; }
    if (engine.advanceDays(s, days)) break;
  }
  if (!s.ending) s.ending = engine.checkEnd(s) || { type: 'timeout', title: '时间到了' };
  return s;
}

function runBatch(difficultyId, N) {
  var stats = { win: 0, lose: 0, byEnding: {}, totalDays: 0, totalClicks: 0 };
  var bgs = DB.list('backgrounds');
  for (var i = 0; i < N; i++) {
    var bg = randPick(bgs);
    var goalId = randPick(bg.goals);
    var s = simulate(Math.random() < 0.5 ? 'm' : 'f', bg.id, goalId, difficultyId);
    var end = s.ending;
    var key = end ? (end.type === 'win' ? 'WIN:' + goalId : 'LOSE:' + end.title) : 'NO_END';
    stats.byEnding[key] = (stats.byEnding[key] || 0) + 1;
    if (end && end.type === 'win') stats.win++; else stats.lose++;
    stats.totalDays += s.day;
    stats.totalClicks += s.clicks;
  }
  var diffName = '';
  DB.list('difficulties').forEach(function (d) { if (d.id === difficultyId) diffName = d.name; });
  console.log('== ' + diffName + ' (' + N + ' 局) ==');
  console.log('  平均存活天数: ' + Math.round(stats.totalDays / N));
  console.log('  平均点击: ' + (stats.totalClicks / N).toFixed(1));
  console.log('  胜率: ' + (stats.win / N * 100).toFixed(1) + '%  (' + stats.win + ' 胜 / ' + stats.lose + ' 负)');
  console.log('  结局分布:');
  Object.keys(stats.byEnding).sort(function (a, b) { return stats.byEnding[b] - stats.byEnding[a]; }).forEach(function (k) {
    console.log('    ' + k + ': ' + stats.byEnding[k]);
  });
}

function main() {
  // 模拟云端数据库（唯一数据源），用 db/export/import/*.json 作为云数据
  var fixture = hm.loadCloudFixture();
  hm.installCloudWx(function (name) { return fixture[name]; }, {});
  DB.load({ cloud: { env: 'cloud1-d7gwcey64cad30d91' } }).then(function (res) {
    console.log('数据源: ' + res.source);
    if (res.source !== 'network') {
      throw new Error('云端数据未就绪：' + JSON.stringify(res.problems));
    }
    console.log('--- 数据完整性 ---');
    console.log('  事件总数: ' + DB.list('events').length + '（含补充的相亲 / 单身期事件）');
    console.log('  背景: ' + DB.list('backgrounds').length + ' · 目标: ' + DB.list('goals').length +
      ' · 难度: ' + DB.list('difficulties').length + ' · 结局: ' + DB.list('endings').length);
    var optErr = DB.list('events').filter(function (e) { return !e.options || e.options.length < 2; });
    console.log('  选项不足的事件: ' + optErr.length);

    // 风格 ↔ 事件映射验证
    var styleErr = 0;
    var styles = DB.list('court_styles');
    var styleEvents = DB.list('style_events');
    var events = DB.list('events');
    styleEvents.forEach(function (se) {
      se.eventIds.forEach(function (eid) {
        var ev = events.filter(function (e) { return e.id === eid; })[0];
        if (!ev || ev.phase !== 'date') { styleErr++; console.log('  风格 ' + se.styleId + ' 引用无效事件: ' + eid); }
      });
    });
    console.log('  风格↔事件映射: ' + (styleErr ? styleErr + ' 个错误' : '全部有效'));

    // ---- 微信闲聊（新增玩法，纯逻辑校验）----
    console.log('--- 微信闲聊 ---');
    var chatBad = [];
    var chatList = DB.list('chats');
    /* 期望条数直接从种子文件取，避免每次加剧情都要手改数字 */
    var seedChats = require('../db/seed/chats.js');
    if (chatList.length !== seedChats.length) {
      chatBad.push('chats 应为 ' + seedChats.length + ' 条，实际 ' + chatList.length);
    }
    var kindCount = {};
    chatList.forEach(function (c) {
      kindCount[c.kind || 'normal'] = (kindCount[c.kind || 'normal'] || 0) + 1;
      if (!c.opener || !c.opener.length) chatBad.push(c.id + ' 缺对方消息');
      if (!c.options || c.options.length < 2) chatBad.push(c.id + ' 选项少于 2 个');
      (c.options || []).forEach(function (o, i) {
        if (!o.label) chatBad.push(c.id + ' 第 ' + (i + 1) + ' 个选项缺文案');
        if (typeof o.affection !== 'number' || typeof o.mood !== 'number') {
          chatBad.push(c.id + ' 第 ' + (i + 1) + ' 个选项缺 affection/mood');
        }
      });
      /* 刁钻 / 暧昧事件必须挂人格，否则「按性格出题」就落空了 */
      if ((c.kind === 'grill' || c.kind === 'flirt') && !c.personalityId) {
        chatBad.push(c.id + '（' + c.kind + '）没写 personalityId');
      }
      /* 灵魂拷问：必须有一条「答对」的选项，且踩雷要明显更疼 */
      if (c.kind === 'grill') {
        var good = c.options.filter(function (o) { return o.correct; });
        var worst = Math.min.apply(null, c.options.map(function (o) { return o.affection; }));
        if (good.length !== 1) chatBad.push(c.id + ' 应有且仅有一条 correct 选项');
        else if (c.options.filter(function (o) { return o.affection < 0 && o.affection <= -20; }).length < 2) {
          chatBad.push(c.id + ' 灵魂拷问的踩雷选项惩罚不够重（应 ≤ -20，实际最低 ' + worst + '）');
        }
      }
      /* 暧昧事件：答对要明显更甜 */
      if (c.kind === 'flirt') {
        var best = Math.max.apply(null, c.options.map(function (o) { return o.affection; }));
        if (best < 15) chatBad.push(c.id + ' 暧昧事件的答对收益不够高（应 ≥ 15，实际 ' + best + '）');
      }
    });
    console.log('  闲聊剧情: ' + chatList.length + ' 条（' +
      Object.keys(kindCount).map(function (k) { return k + '=' + kindCount[k]; }).join(' ') +
      '）· ' + (chatBad.length ? chatBad.length + ' 个问题' : '全部有效'));
    if (!kindCount.grill) chatBad.push('缺少灵魂拷问（grill）剧情');
    if (!kindCount.flirt) chatBad.push('缺少暧昧（flirt）剧情');
    if (!kindCount.mustdate) chatBad.push('缺少「必须出门约会」（mustdate）固定剧情');

    /* 每种人格都得有对象，否则挂在该人格下的灵魂拷问 / 暧昧剧情永远抽不到 */
    var pidCount = {};
    DB.list('partners').forEach(function (p) {
      if (p.personalityId) pidCount[p.personalityId] = (pidCount[p.personalityId] || 0) + 1;
    });
    var orphanPid = [];
    DB.list('personalities').forEach(function (pe) {
      if (!pidCount[pe.id]) orphanPid.push(pe.name);
      /* 每个人格至少要有一条 grill + 一条 flirt，否则玩法是残的 */
      ['grill', 'flirt'].forEach(function (k) {
        var has = chatList.some(function (c) { return c.kind === k && c.personalityId === pe.id; });
        if (!has) chatBad.push('人格「' + pe.name + '」缺少 ' + k + ' 剧情');
      });
    });
    console.log('  人格覆盖: ' + DB.list('personalities').length + ' 种 · ' +
      (orphanPid.length ? '无人格对象: ' + orphanPid.join('/') : '每种人格都有对象'));
    if (orphanPid.length) chatBad.push('人格「' + orphanPid.join('、') + '」没有对应对象');

    // 单身不可用 / 非单身可用
    var cs = engine.createGame('m', DB.list('backgrounds')[0].id, DB.list('backgrounds')[0].goals[0], 7, 'normal');
    if (engine.canChat(cs)) chatBad.push('单身状态不该能闲聊');
    if (engine.pickChat(cs) !== null) chatBad.push('单身状态不该抽到闲聊剧情');
    cs.partner = { name: '校验用', job: '', gender: 'f', personalityId: 'emo' };
    cs.relationship = 'talking';
    cs.affection = 30;
    var picked = 0;
    for (var ci = 0; ci < 200; ci++) { if (engine.pickChat(cs)) picked++; }
    console.log('  非单身抽闲聊: ' + picked + '/200 命中');
    if (picked !== 200) chatBad.push('非单身时应每次都抽得到闲聊剧情');

    /* 人格定向：抽 300 次，只应出现「通用 + 本人格」的剧情 */
    var pool = engine.chatPool(cs);
    var wrongPid = pool.filter(function (c) {
      return c.personalityId && c.personalityId !== 'emo';
    });
    console.log('  人格定向池: ' + pool.length + ' 条 · 混入他人格: ' + wrongPid.length + ' 条');
    if (wrongPid.length) chatBad.push('人格不符的剧情混进了池子：' + wrongPid.map(function (c) { return c.id; }).join(','));
    var hitEmo = false;
    for (var ci2 = 0; ci2 < 300; ci2++) {
      var pc = engine.pickChat(cs);
      if (pc && pc.personalityId === 'emo') hitEmo = true;
      if (pc && pc.personalityId && pc.personalityId !== 'emo') chatBad.push('抽到了人格不符的剧情：' + pc.id);
    }
    if (!hitEmo) chatBad.push('情绪价值人格应能抽到专属剧情');

    // 结算只动好感度与情绪
    var before = {
      money: cs.money, health: cs.health, career: cs.career,
      looks: cs.looks, family: cs.family, affection: cs.affection, mood: cs.mood
    };
    var res = engine.applyChat(cs, { affection: 6, mood: -3, reply: 'x' });
    var onlyTwo = cs.money === before.money && cs.health === before.health &&
      cs.career === before.career && cs.looks === before.looks && cs.family === before.family;
    console.log('  闲聊结算: 好感 ' + before.affection + '→' + cs.affection +
      ' · 情绪 ' + before.mood + '→' + cs.mood + ' · 其它属性不变: ' + (onlyTwo ? '是' : '否'));
    if (!onlyTwo) chatBad.push('闲聊不该影响好感度/情绪以外的属性');
    if (res.delta.affection !== 6 || res.delta.mood !== -3) chatBad.push('结算变化与配置不一致');

    // 上限夹取
    cs.affection = 98;
    engine.applyChat(cs, { affection: 20, mood: 0 });
    if (cs.affection !== 100) chatBad.push('好感度应夹取到 100，实际 ' + cs.affection);

    if (chatBad.length) {
      chatBad.forEach(function (e) { console.log('    ! ' + e); });
      throw new Error('微信闲聊校验失败：' + chatBad.length + ' 个问题');
    }

    // ---- 对方的主动微信 + 「必须出门约会」 ----
    console.log('--- 主动微信 / 必须出门约会 ---');
    var pmBad = [];
    var rate = DB.num('PARTNER_CHAT_RATE', 0.3);
    var thr = DB.num('CHAT_MUST_DATE_AFTER', 2);
    console.log('  主动聊天概率: ' + rate + ' · 必须约会阈值: 微信聊满 ' + thr + ' 次之后');
    if (Math.abs(rate - 0.3) > 1e-9) pmBad.push('PARTNER_CHAT_RATE 应为 0.3，实际 ' + rate);
    if (thr !== 2) pmBad.push('CHAT_MUST_DATE_AFTER 应为 2，实际 ' + thr);

    var ps = engine.createGame('m', DB.list('backgrounds')[0].id, 'marry', 11, 'normal');
    ps.relationship = 'talking';
    ps.partner = { name: '校验用', job: '', gender: 'f', personalityId: 'emo' };
    ps.affection = 40;

    var hits = 0;
    for (var k = 0; k < 4000; k++) { if (engine.rollProactiveChat(ps)) hits++; }
    var emp = hits / 4000;
    console.log('  主动聊天实测命中率: ' + (emp * 100).toFixed(1) + '%（4000 次）');
    if (Math.abs(emp - rate) > 0.04) pmBad.push('主动聊天命中率偏离配置：' + emp.toFixed(3));

    /* 单身 / 被锁住时不该主动 */
    var single = engine.createGame('m', DB.list('backgrounds')[0].id, 'marry', 12, 'normal');
    var sHit = 0;
    for (var k2 = 0; k2 < 500; k2++) { if (engine.rollProactiveChat(single)) sHit++; }
    if (sHit) pmBad.push('单身状态不该触发主动聊天（命中 ' + sHit + '）');
    ps.mustDate = true;
    var lHit = 0;
    for (var k3 = 0; k3 < 500; k3++) { if (engine.rollProactiveChat(ps)) lHit++; }
    if (lHit) pmBad.push('「必须当面约会」期间不该触发主动聊天（命中 ' + lHit + '）');
    ps.mustDate = false;

    /* 聊够 2 次 → 第 3 次必须给固定剧情。
     * 计数看的是「微信上一共聊过几次」—— 玩家自己点开的也算，
     * 否则玩家一直主动开聊，规则永远不触发（这正是之前的 bug）。 */
    ps.chatCount = 1;
    ps.proactiveChats = 0;          // 一次都没让对方主动，全是玩家点开的
    var c1 = engine.pickChat(ps);
    if (engine.isMustDateChat(c1)) pmBad.push('第 2 次聊天不该直接出固定剧情（' + (c1 && c1.id) + '）');
    /* 玩家自己聊完一次：计数必须 +1（这条就是回归点） */
    var ac = engine.afterChat(ps, c1, false);
    if (ps.chatCount !== 2) pmBad.push('玩家主动开聊也要计入微信次数，实际 ' + ps.chatCount);
    if (ac.chatCount !== 2) pmBad.push('afterChat 应回报累计聊天次数，实际 ' + ac.chatCount);
    var c2 = engine.pickChat(ps);
    if (!engine.isMustDateChat(c2)) {
      pmBad.push('微信聊满 ' + thr + ' 次后应强制出固定剧情，实际 ' + (c2 && c2.id));
    } else {
      console.log('  微信聊满 ' + thr + ' 次后强制剧情: ' + c2.id + '（' + c2.kind + '）');
    }
    /* 固定剧情不进随机池，否则会被日常闲聊冲掉 */
    if (engine.chatPool(ps).some(function (c) { return engine.isMustDateChat(c); })) {
      pmBad.push('固定剧情不该出现在随机池里');
    }
    /* 见面前（lead）同样记账：在微信上聊够了本来就该见面，
     * 这条规则在「还没赴约」时最该生效（之前 bug：lead 不记账导致次数永远 0）。
     * 现在 lead 阶段有可聊的题库（buildChats 给所有闲聊挂了 lead/meeting 标签），
     * 所以 pickChat 在 lead 不会返回 null，afterChat 能把次数记上。 */
    var leadS = engine.createGame('m', DB.list('backgrounds')[0].id, 'marry', 13, 'normal');
    leadS.lead = { name: '待见面', job: '', gender: 'f' };
    leadS.chatCount = 0;
    var leadChat = engine.pickChat(leadS);
    if (!leadChat) pmBad.push('见面前（lead）应能在微信上聊，pickChat 却返回 null（题库缺 lead 标签）');
    engine.afterChat(leadS, leadChat, false);
    if (leadS.chatCount !== 1) pmBad.push('见面前的微信也应计入次数，实际 ' + leadS.chatCount);
    /* 聊满阈值后，见面前也能触发「必须当面约会」固定剧情 */
    leadS.chatCount = DB.num('CHAT_MUST_DATE_AFTER', 2);
    var leadFixed = engine.pickChat(leadS);
    if (!engine.isMustDateChat(leadFixed)) {
      pmBad.push('见面前聊满 ' + DB.num('CHAT_MUST_DATE_AFTER', 2) + ' 次也应强制出固定剧情，实际 ' + (leadFixed && leadFixed.id));
    } else {
      console.log('  见面前聊满阈值强制剧情: ' + leadFixed.id + '（lead 阶段生效）');
    }

    /* 聊完固定剧情 → 进入「必须当面约会」 */
    ps.chatCount = 0;
    ps.proactiveChats = 0;
    ps.mustDate = false;
    engine.afterChat(ps, c2, true);
    console.log('  聊完固定剧情: mustDate=' + ps.mustDate + ' · 微信次数=' + ps.chatCount);
    if (!ps.mustDate) pmBad.push('聊完固定剧情后应进入「必须当面约会」状态');
    if (!engine.chatLocked(ps)) pmBad.push('「必须当面约会」期间 chatLocked 应为 true');

    /* 安排一次约会 → 解锁并重置计数 */
    ps.affection = 50;
    engine.goDate(ps, 'simple');
    console.log('  约会之后: mustDate=' + ps.mustDate + ' · 微信次数=' + ps.chatCount);
    if (ps.mustDate) pmBad.push('安排约会后应解除「必须当面约会」');
    if (ps.chatCount) pmBad.push('安排约会后微信聊天计数应归零');
    if (ps.proactiveChats) pmBad.push('安排约会后主动聊天计数应归零');

    if (pmBad.length) {
      pmBad.forEach(function (e) { console.log('    ! ' + e); });
      throw new Error('主动微信校验失败：' + pmBad.length + ' 个问题');
    }

    /* 结局页头部插画：checkEnd 必须把 art 透传到 S.ending。
     * 之前 cloneEnding 只拷 type/title/lines，胜利分支又手写对象不带 art，
     * 导致所有结局头部都是纯色（warnEndingArtIfStale 的告警正是为它报的警）。 */
    var recById = {};
    DB.list('endings').forEach(function (e) { recById[e.id] = e; });
    var bg0 = DB.list('backgrounds')[0].id;
    var artCases = [
      { id: 'marry', mk: function () { var s = engine.createGame('m', bg0, 'marry', 13, 'normal'); s.relationship = 'married'; s.flags = { child: true }; return s; } },
      { id: 'broke', mk: function () { var s = engine.createGame('m', bg0, 'rich_alone', 13, 'normal'); s.money = -1; return s; } },
      { id: 'sick', mk: function () { var s = engine.createGame('m', bg0, 'settle', 13, 'normal'); s.health = 0; return s; } },
      { id: 'jobless', mk: function () { var s = engine.createGame('m', bg0, 'career_peak', 13, 'normal'); s.career = 0; return s; } },
      { id: 'depressed', mk: function () { var s = engine.createGame('m', bg0, 'free', 13, 'normal'); s.mood = 0; return s; } },
      { id: 'forced', mk: function () { var s = engine.createGame('m', bg0, 'marry', 13, 'normal'); s.relationship = 'single'; s.singleStreak = 999; s.singleLimit = 10; return s; } },
      /* 时间上限兜底现在是「按关系状态分流」的三条（见 engine.timeoutEndingId）：
       * 单身 → timeout；有对象未婚 → stalled；已婚 → married_stall。 */
      { id: 'timeout', mk: function () { var s = engine.createGame('m', bg0, 'free', 13, 'normal'); s.day = 999; s.relationship = 'single'; return s; } },
      { id: 'stalled', mk: function () { var s = engine.createGame('m', bg0, 'free', 13, 'normal'); s.day = 999; s.relationship = 'dating'; return s; } },
      { id: 'married_stall', mk: function () { var s = engine.createGame('m', bg0, 'free', 13, 'normal'); s.day = 999; s.relationship = 'married'; return s; } }
    ];
    artCases.forEach(function (c) {
      var rec = recById[c.id];
      var r = engine.checkEnd(c.mk());
      if (!r || !r.art) {
        pmBad.push('结局 ' + c.id + ' 经 checkEnd 后 art 缺失（结局页头部会没图）');
      } else if (rec && r.art !== rec.art) {
        pmBad.push('结局 ' + c.id + ' 的 art 应为 ' + rec.art + '，实际 ' + r.art);
      } else if (!r.id) {
        pmBad.push('结局 ' + c.id + ' 经 checkEnd 后 id 缺失');
      } else {
        console.log('  结局 ' + c.id + ' → art=' + r.art + ' · id=' + r.id);
      }
    });
    if (pmBad.length) {
      pmBad.forEach(function (e) { console.log('    ! ' + e); });
      throw new Error('结局 art 透传校验失败：' + pmBad.length + ' 个问题');
    }

    runBatch('easy', 300);
    runBatch('normal', 300);
    runBatch('hard', 300);

    console.log('SMOKE OK');
  });
}

main();

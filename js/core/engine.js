/* =========================================================
 * 《相亲模拟器》核心引擎（微信小游戏版）
 * ---------------------------------------------------------
 * 纯逻辑层：状态、事件抽取、数值结算、关系推进、胜负判定。
 * 不依赖 DOM 与任何平台 API。
 *
 * ★ 关键差异：本文件【不包含任何游戏数据】。所有事件、角色、
 *   难度系数、渠道、约会档位、交往风格、结局、数值常量与旁白文案
 *   一律通过 js/db/repository.js 从数据库读取。
 * ========================================================= */

'use strict';

var DB = require('../db/repository.js');
var R = require('./rules.js');

/* ================= 工具 ================= */
function randPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function weightedPick(list) {
  var total = 0;
  for (var i = 0; i < list.length; i++) total += (list[i].weight || 10);
  var r = Math.random() * total;
  for (var j = 0; j < list.length; j++) {
    r -= (list[j].weight || 10);
    if (r <= 0) return list[j];
  }
  return list[list.length - 1];
}
function moneyText(v) {
  if (v >= 10000) {
    var w = v / 10000;
    /* 「万」最多保留一位小数，且整数时不再拖一个多余的 .0（3.0万 → 3万 / 3.6万 不变） */
    var s = (Math.abs(w - Math.round(w)) < 0.05) ? String(Math.round(w)) : w.toFixed(1);
    return s + '万';
  }
  return Math.round(v) + '元';
}
function byId(list, id) {
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}
/* 取数值常量（带默认值兜底） */
function C(key, fallback) {
  return DB.num(key, fallback);
}
/* 取旁白文案 */
function N() {
  return DB.text('narratives') || {};
}
/* 取流程标签文案（宽限原因 / 工作日提示等） */
function flow(key) {
  var n = DB.text('narratives') || {};
  return (n.flow && n.flow[key]) || '';
}

/* ================= 星期 / 社畜作息 ================= */
function weekdayOf(day) { return (day - 1) % 7; }
function weekdayName(day) {
  var names = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  return names[weekdayOf(day)];
}
function isWeekend(day) { return weekdayOf(day) >= 5; }
function daysToWeekend(day) {
  var w = weekdayOf(day);
  return w >= 5 ? 0 : (5 - w);
}

/* ================= 接触阶段（数据驱动） =================
 * 阶段顺序来自 constants.RELATION_ORDER，默认
 *   single < meeting < talking < dating < married
 * 事件可以带一个可选的 stage 字段，表示「至少要走到这个阶段才会出现」：
 *   · 接触中（talking）只会抽到暧昧向内容；
 *   · 见家长 / 要孩子这类婚嫁向内容，标 stage='dating'，告白成功后才可能出现。
 * 聊天（chats）用 phases 显式列出可出现的阶段，共用同一套顺序。
 * 顺序与门槛全部在数据库，逻辑层只做比较。
 */
function relationOrder() {
  var raw = C('RELATION_ORDER', 'single,meeting,talking,dating,married');
  var list = Array.isArray(raw) ? raw.slice() : String(raw).split(',');
  list = list.map(function (x) { return String(x).trim(); }).filter(function (x) { return x; });
  return list.length ? list : ['single', 'meeting', 'talking', 'dating', 'married'];
}
/* 关系阶段在顺序里的位置（未知阶段按最低处理） */
function stageRank(rel) {
  var i = relationOrder().indexOf(rel || 'single');
  return i < 0 ? 0 : i;
}
/* 事件是否已达所需接触阶段（没写 stage 表示不限阶段） */
function stageOk(s, ev) {
  if (!ev || !ev.stage) return true;
  return stageRank(s.relationship) >= stageRank(ev.stage);
}

/* ================= 文案 ================= */
/* 模板替换：{p}=对象名，{key}=vars 里的变量；再处理性别代词 */
function fillText(tpl, s, vars) {
  vars = vars || {};
  var partner = vars._partner || s.partner;
  var pname = partner ? partner.name : (flow('default_partner') || '对方');
  var out = String(tpl).replace(/\{p\}/g, pname);
  for (var k in vars) {
    if (k === '_partner') continue;
    out = out.split('{' + k + '}').join(String(vars[k]));
  }
  var male = partner && partner.gender === 'm';
  out = out.replace(/她\(O\)/g, male ? '他' : '她');
  if (male) out = out.replace(/她/g, '他');
  return out;
}

/* ================= 事件分类 ================= */
function eventCategory(ev) { return ev.id.indexOf('up_') === 0 ? 'improve' : 'life'; }
function eventDays(ev, s) {
  var base = ev.days || (eventCategory(ev) === 'improve'
    ? C('EVENT_DAYS_IMPROVE', 9) : C('EVENT_DAYS_LIFE', 4));
  return Math.max(1, Math.round(base * s.diff.timeMod));
}

/* ================= 开局 ================= */
function createGame(gender, bgId, goalId, seed, difficultyId) {
  var bgs = DB.list('backgrounds');
  var goals = DB.list('goals');
  var diffs = DB.list('difficulties');

  var bg = byId(bgs, bgId) || bgs[0];
  var goal = byId(goals, goalId) || byId(goals, 'marry') || goals[0];
  var diff = byId(diffs, difficultyId) || byId(diffs, 'normal') || diffs[0];
  var m = (diff && diff.initMod) || 1;   // 防御：diff.initMod 缺失时按 1 兜底
  var ini = (bg && bg.init) || {};   // 防御：bg.init 缺失时用空对象兜底

  return {
    day: 1,
    gender: gender,
    bg: bg,
    goal: goal,
    diff: diff,
    jobType: ini.jobType || 'worker',
    jobName: ini.jobName || '打工人',
    salary: { income: ini.income || 0, expense: ini.expense || 0 },
    courtStyle: 'modest',
    money: Math.round((ini.money || 0) * m),
    health: clamp(Math.round((ini.health || 50) * m), 1, 100),
    career: clamp(Math.round((ini.career || 30) * m), 1, 100),
    looks: clamp(Math.round((ini.looks || 50) * m), 1, 100),
    family: clamp(Math.round((ini.family || 30) * m), 1, 100),
    mood: clamp(Math.round((ini.mood || 50) * m), 1, 100),
    affection: 0,
    relationship: 'single',
    partner: null,
    lead: null,
    seed: seed || (Math.floor(Math.random() * 100000) + 1),
    flags: { child: false, marriedOnce: false, breakupCount: 0, rejectCount: 0 },
    singleStreak: 0,
    singleLimit: diff.partnerDeadline || 0,
    relStartDay: null,
    /* 这段关系里「主动花出去的钱」累计（约会 / 送礼 / 求婚 / 生子等，
     * 由 applyStat 的负向 money 变动累加）。分手时用来判断「你为这段感情
     * 投入了多少」，与相处天数一起决定情绪扣减的档位。 */
    relSpent: 0,
    recent: [],
    /* 本局「遇见过的相亲对象」id 列表（纯状态）。
     * 用来避免同一局里反复抽到同一个人；图鉴的跨局解锁记录在 UI 层另存。 */
    met: [],
    /* 微信相关状态（纯状态，不含任何数值配置）：
     *   chatCount      见面前之外，微信上一共聊过几次（玩家发起 + 对方主动都算）——
     *                  攒够次数就要求「必须出门约会」
     *   proactiveChats 其中「对方主动发来」的次数（仅用于主动聊天的节奏判定）
     *   mustDate       是否处在「先当面见一面，别再微信聊了」的状态 */
    chatCount: 0,
    proactiveChats: 0,
    mustDate: false,
    currentEvent: null,
    over: false,
    ending: null,
    paydayFlash: null,
    breakFlash: null,
    graceFlash: null,
    cooldownFlash: null,
    log: [],
    /* 属性变化历史（纯展示用）：[{day, delta}]，供「近期变化」页读取。
     * 只记录状态，不含任何游戏数据；长度由常量 STAT_HISTORY_MAX 控制。 */
    history: [],

    /* 「近期经历」：每次行动的事件 / 选择 / 结果（纯展示状态），
     * 长度由常量 ACTLOG_MAX 控制。 */
    acts: []
  };
}

function goalName(s) {
  if (!s.goal) return '';
  if (s.goal.nameByGender && s.goal.nameByGender[s.gender]) return s.goal.nameByGender[s.gender];
  return s.goal.name;
}

/* ================= 事件抽取 ================= */
function pickEvent(s, phase, filter) {
  var EVENTS = DB.list('events');
  var ph = phase || s.relationship;
  var pool = EVENTS.filter(function (e) {
    if (e.phase !== 'any' && e.phase !== ph) return false;
    if (!stageOk(s, e)) return false;
    if (filter && !filter(e)) return false;
    if (s.recent.indexOf(e.id) >= 0) return false;
    return true;
  });
  if (!pool.length) {
    var fallback = EVENTS.filter(function (e) {
      return (e.phase === ph || e.phase === 'any') && stageOk(s, e) && (!filter || filter(e));
    });
    if (fallback.length) return weightedPick(fallback);
    return weightedPick(EVENTS.filter(function (e) {
      return (e.phase === ph || e.phase === 'any') && stageOk(s, e);
    }));
  }
  var phaseWeight = C('EVENT_PHASE_WEIGHT', 2.6);
  var items = pool.map(function (e) {
    return { e: e, w: (e.weight || 10) * (e.phase === 'any' ? 1 : phaseWeight) };
  });
  var total = 0;
  for (var i = 0; i < items.length; i++) total += items[i].w;
  var r = Math.random() * total;
  for (var j = 0; j < items.length; j++) {
    r -= items[j].w;
    if (r <= 0) return items[j].e;
  }
  return items[items.length - 1].e;
}

function pickLifeEvent(s) {
  return pickEvent(s, s.relationship, function (e) { return eventCategory(e) === 'life'; });
}
function pickImproveEvent(s) {
  return pickEvent(s, 'any', function (e) { return eventCategory(e) === 'improve'; });
}
function pickMeetingEvent(s) {
  var EVENTS = DB.list('events');
  var pool = EVENTS.filter(function (e) { return e.phase === 'meeting' && stageOk(s, e) && s.recent.indexOf(e.id) < 0; });
  var src = pool.length ? pool : EVENTS.filter(function (e) { return e.phase === 'meeting' && stageOk(s, e); });
  return weightedPick(src);
}

/* ================= 微信闲聊 =================
 * 有人在聊天列表里就能聊：
 *   1. 已经相到人、还没赴约（single + lead）→ 'lead' 阶段的题库（微信上先认识）；
 *   2. 接触中 / 恋爱 / 已婚（有 partner）→ 对应阶段的题库。
 * 所有剧情与数值都来自 chats 集合，这里只做「筛选 + 加权抽取 + 结算」。
 * 效果限定为好感度与情绪两项，不涉及金钱 / 事业 / 健康。
 */

/* 聊天所处的阶段：看此刻聊天框对面站着谁。
 * lead（还没见面只加了微信）不是 RELATION_ORDER 里的正式关系，
 * 它只是 chats.phases 的一个题库标签 —— 见面前有见面前的话题。 */
function chatStage(s) {
  if (!s) return 'single';
  if (s.partner) return s.relationship;
  if (s.lead) return C('CHAT_LEAD_PHASE', 'lead');
  return 'single';
}

function canChat(s) {
  if (!s) return false;
  return chatStage(s) !== 'single';
}

/* 固定的「必须出门约会」剧情的 id 与结构标记，都放在数据库常量里：
 * 想换一段剧情，只改数据，不用动逻辑。 */
function mustDateChatId() { return C('CHAT_MUST_DATE_ID', 'c_mustdate'); }
function mustDateKind() { return String(C('CHAT_MUST_DATE_KIND', 'mustdate')); }
function isMustDateChat(c) { return !!(c && String(c.kind || '') === mustDateKind()); }

/* 是否处于「必须当面约会」状态：微信已经聊不动了。
 * 这个状态下既不会触发对方的主动聊天，玩家也点不开闲聊，
 * 聊天页只会显示一句「我们还是多当面接触吧」。 */
function chatLocked(s) { return !!(s && s.mustDate); }

/* 当前状态下可用的闲聊剧情池（加权抽取 / 是否可点都用它） */
function chatPool(s) {
  if (!canChat(s)) return [];
  var floor = C('CHAT_MIN_AFFECTION', 0);
  var who = s.partner || s.lead;
  var pid = (who && who.personalityId) || '';
  var stage = chatStage(s);
  return DB.list('chats').filter(function (c) {
    if (!c || !c.options || !c.options.length) return false;
    if (isMustDateChat(c)) return false;              // 固定剧情不进随机池
    if ((c.phases || []).indexOf(stage) < 0) return false;
    if (s.affection < Math.max(c.minAffection || 0, floor)) return false;
    /* 人格限定：只有对象人格匹配才投放。
     * 灵魂拷问（grill）与暧昧事件（flirt）都靠它做到「按性格出题」。 */
    if (c.personalityId && c.personalityId !== pid) return false;
    return true;
  });
}

/* 有没有可聊的剧情（没有就不显示「微信闲聊」，玩法自动回到参考项目） */
function chatAvailable(s) {
  return chatPool(s).length > 0;
}

/* 微信上「聊过几次」—— 只统计见面之后（lead 阶段不算账）。
 * 旧存档只有 proactiveChats（当时只记对方主动的），这里做一次兼容折算，
 * 避免老档读进来直接判成「已经聊够」。 */
function chatCount(s) {
  if (!s) return 0;
  if (s.chatCount !== undefined && s.chatCount !== null) return s.chatCount;
  return s.proactiveChats || 0;
}

function pickChat(s) {
  if (!canChat(s)) return null;
  var stage = chatStage(s);
  /* 微信已经聊够次数 → 直接上固定剧情（必须出门约会），不再随机抽题。
   * 「聊够」看的是总次数（玩家点开的 + 对方主动发来的都算，
   * 包括还没见面的 lead 阶段），不然玩家一直自己开聊，规则永远不触发。
   * 固定剧情能不能在这一阶段出现，由它自己的 phases 决定（见 chats 数据）。 */
  if (chatCount(s) >= C('CHAT_MUST_DATE_AFTER', C('PARTNER_CHAT_MUST_DATE_AFTER', 2))) {
    /* 固定剧情可能不止一条（chats 里 kind === mustdate 的都算），
     * 有几条就按 weight 抽一条，避免每次都弹出同一句「出来见一面」。
     * CHAT_MUST_DATE_ID 仍点名主的那条，抽签时它只是权重最高的候选之一。 */
    var fixeds = DB.list('chats').filter(function (c) {
      return isMustDateChat(c) && (c.phases || []).indexOf(stage) >= 0;
    });
    if (fixeds.length) return weightedPick(fixeds);
  }
  var pool = chatPool(s);
  if (!pool.length) return null;
  return weightedPick(pool);
}

/* 对方今天会不会主动发来微信（非单身、且没有被「必须约会」锁住）。
 * 概率走常量 PARTNER_CHAT_RATE，调成 0 即可整体关闭这个玩法。 */
function rollProactiveChat(s) {
  if (!canChat(s)) return false;
  if (chatLocked(s)) return false;
  /* 还没见面（lead）时对方不会主动找上门 —— 这时候每天都弹出别人主动发的消息，
   * 会把「赴约」这件事顶掉，节奏很难受。见面前只接受玩家主动开聊。 */
  if (chatStage(s) === C('CHAT_LEAD_PHASE', 'lead')) return false;
  var rate = C('PARTNER_CHAT_RATE', 0.3);
  if (!(rate > 0)) return false;
  return Math.random() < rate;
}

/* 微信计数的归零。换人 / 见面 / 分手时都要调，
 * 否则新的一段关系会继承上一段的账（用户反馈过两个 bug：
 *   ① 初遇前聊了不算 → 次数永远 0，规则形同不存在；
 *   ② 分手后不清 → 新对象一见面就被「必须约会」锁住）。
 * 归零的三件事：总次数、对方主动次数、以及「必须当面约会」的锁定态。 */
function resetChatTally(s) {
  if (!s) return;
  s.chatCount = 0;
  s.proactiveChats = 0;
  s.mustDate = false;
}

/* 聊完一次之后的记账：
 *   · 每一次微信（玩家点开的 / 对方主动发来的）→ chatCount +1
 *     —— 「微信聊过 2 次就必须当面见一面」看的就是它。
 *     见面之前（lead）同样计入：在微信上聊够了本来就该见面，
 *     这条规则在「还没赴约」时最该生效。
 *   · 对方主动发来的那次另外记一笔 proactiveChats（用于主动聊天的节奏）；
 *   · 本次若是固定剧情 → 进入「必须当面约会」状态。
 * 返回结构化结果，方便渲染层决定接下来跳哪天。 */
function afterChat(s, chat, proactive) {
  s.chatCount = chatCount(s) + 1;
  if (proactive) s.proactiveChats = (s.proactiveChats || 0) + 1;
  if (isMustDateChat(chat)) s.mustDate = true;
  return {
    chatCount: chatCount(s),
    proactiveCount: s.proactiveChats || 0,
    mustDate: !!s.mustDate
  };
}

/* 选定一个回复：只改好感度与情绪，返回真实发生的变化（夹取后）供展示 */
function applyChat(s, opt) {
  if (!opt) return { delta: {}, reply: '' };
  /* 聊天选项与事件选项走同一套结算口径：
   *   · 新数据是 fx（可对全部属性生效，且每项有增有减，见 gen-seed 的 FX 规则）
   *   · 旧数据还是扁平的 affection / mood 字段（云端重新导入前也必须能跑），
   *     这里兜底成 fx，两条路最终都交给 applyFx 结算。 */
  var fx = opt.fx || { affection: opt.affection || 0, mood: opt.mood || 0 };
  var keys = ['money', 'health', 'career', 'looks', 'family', 'mood', 'affection'];
  var before = {};
  keys.forEach(function (k) { before[k] = s[k] || 0; });

  applyFx(s, fx);

  var delta = {};
  keys.forEach(function (k) {
    var d = (s[k] || 0) - before[k];
    if (d) delta[k] = d;
  });
  return { delta: delta, reply: opt.reply || '' };
}

/* ================= 数值结算 =================

 * 好感度是「动态值」：上限随关系阶段变化 ——
 *   单身 / 初次见面 / 接触中 → AFFECTION_CAP_BASE（默认 100）
 *   告白成功（恋爱）/ 已婚   → AFFECTION_CAP_DATING（默认 500）
 * 上限一放大，求婚成功率的计算基座也跟着挪过去（见 proposeChance），
 * 于是「在一起」之外还得多相处一阵子，感情值得到位才敢开口。
 * 这两个数都在 constants 集合里，调快慢不用改逻辑。 */
function affectionCap(s) {
  var rel = s && s.relationship;
  if (rel === 'dating' || rel === 'married') return C('AFFECTION_CAP_DATING', 500);
  return C('AFFECTION_CAP_BASE', 100);
}

function applyStat(s, key, raw) {
  if (!raw) return 0;
  var before = s[key];
  var after;
  if (key === 'money') {
    after = Math.max(0, before + raw);
    /* 关系期间的支出记账：约会 / 送礼 / 求婚 / 生子这类主动花掉的钱
     * 累加到 relSpent，分手时用来说明「你为这段感情付出了多少」。
     * 只有处在关系里（relStartDay 已置位）才记，单身期的花销不算。 */
    if (raw < 0 && s.relStartDay != null) {
      s.relSpent = (s.relSpent || 0) + (before - after);
    }
  } else if (key === 'affection') {
    after = clamp(before + raw, 0, affectionCap(s));
  } else {
    after = clamp(before + raw, 0, 100);
  }
  s[key] = after;
  return after - before;
}

function applyFx(s, fx, amp) {
  if (!fx) return {};
  var ampF = amp || 1;
  /* 数值不再随机浮动（原参考项目的 ±25%「肉鸽感」已按需求移除）：
   * 事件选项写多少就结算多少（乘上难度 / 风格 / 对象等固定系数），
   * 这样「结算里显示的变化」与「主界面上看到的数值」完全对得上。
   * 仍会受每日自然衰减（健康 / 颜值 / 好感度）影响，那是「时间流逝」机制。 */
  function roll(base) {
    if (!base) return 0;
    return Math.round(base);
  }

  /* 对象的加成系数（partner.mod）；旧存档 / 残缺数据里缺失时按 1 兜底，避免崩 */
  var mod = (s.partner && s.partner.mod) || { affection: 1, money: 1, health: 1, career: 1 };
  var delta = { money: 0, health: 0, career: 0, affection: 0, looks: 0, family: 0, mood: 0 };

  if (fx.money) {
    var raw = (fx.money > 0)
      ? Math.round(roll(fx.money) * s.diff.gainMod)
      : Math.round(roll(fx.money) * s.diff.costMod);
    delta.money = applyStat(s, 'money', raw);
  }
  if (fx.health) delta.health = applyStat(s, 'health', roll(fx.health));
  if (fx.career) delta.career = applyStat(s, 'career', roll(fx.career));
  if (fx.looks) delta.looks = applyStat(s, 'looks', roll(fx.looks));
  if (fx.family) delta.family = applyStat(s, 'family', roll(fx.family));
  if (fx.mood) delta.mood = applyStat(s, 'mood', roll(fx.mood));
  /* 好感度：单身期本来没有对象，好感不生效；
   * 但「还没见面的暧昧对象（lead）」是例外 —— 见面前在微信上聊出来的好感要攒着，
   * firstMeet 会把它折成印象分（LEAD_CHAT_AFF_MAX），所以这里必须放行。 */
  if (fx.affection && (s.relationship !== 'single' || !!s.lead)) {
    var style = byId(DB.list('court_styles'), s.courtStyle);
    var styleMod = (style && style.affMod) || 1;
    /* 恋爱之后刻度放大（100 → 500），事件写在旧刻度上的好感数值要换算，
     * 否则爬到能求婚的程度要耗掉整局：
     *   · 加分 → × DATING_AFF_GAIN_AMP（比刻度倍数小，所以「还得再相处」）
     *   · 扣分 → × 刻度倍数（等于自己在「相对掉多少」上与恋爱前保持一致） */
    var cap = affectionCap(s);
    var capBase = C('AFFECTION_CAP_BASE', 100);
    var stageAmp = 1;
    if (cap > capBase) {
      stageAmp = (fx.affection > 0) ? C('DATING_AFF_GAIN_AMP', 1.8) : (cap / capBase);
    }
    var rawAff = Math.round(roll(fx.affection) * (mod.affection || 1) * styleMod * s.diff.affMod * ampF * stageAmp);
    delta.affection = applyStat(s, 'affection', rawAff);
  }
  return { delta: delta };
}

/* ================= 相亲流程 ================= */

/* 寻找相亲「没找到合适的」：情绪下降与本次花费成正比（确定性，不随机）。
 * 花费越高越挫败，但夹在 [最小, 最大] 之间，不会出现 0 或不合理的巨幅波动。 */
function seekFailMood(s, cost) {
  /* 渠道花费跨度很大（免费 ~ 婚介 6000 元），这里按「每花 1000 元掉 2 点情绪」折算：
   * 免费 2 / 自我寻找 2 / 亲戚介绍 2 / 相亲软件 5 / 婚介 12 —— 与花费成正比，
   * 又不会一次落空就把情绪打到 0（mood <= 0 会直接判「抑郁」结局）。 */
  var per = C('SEEK_FAIL_MOOD_PER_COST', 0.002);  // 每花 1 元掉多少情绪
  var min = C('SEEK_FAIL_MOOD_MIN', 2);            // 至少掉这么多（免费渠道也有挫败感）
  var max = C('SEEK_FAIL_MOOD_MAX', 20);           // 最多掉这么多
  var drop = clamp(Math.round(cost * per), min, max);
  return applyStat(s, 'mood', -drop);
}
function seekFailResult(s, cost, paid, N_) {
  return {
    ok: false,
    cost: cost,
    paid: paid,
    delta: { money: -paid, mood: seekFailMood(s, cost) },
    days: Math.max(1, Math.round(C('SEEK_FAIL_DAYS', 10) * s.diff.timeMod)),
    title: (N_ && N_.find_fail && N_.find_fail.title) || '没找到合适的',
    lines: (N_ && N_.find_fail && N_.find_fail.lines) ? N_.find_fail.lines.slice() : []
  };
}

function findDate(s, channelId) {
  var N_ = N();
  var ch = byId(DB.list('channels'), channelId) || byId(DB.list('channels'), 'self');
  var cost = Math.round(ch.cost * s.diff.costMod);
  var paid = -applyStat(s, 'money', -cost);
  var chance = clamp(ch.chance, 0.01, 0.99);
  var ok = Math.random() < chance;
  if (!ok) return seekFailResult(s, cost, paid, N_);
  var p = generatePartner(s.gender, s.looks, s.family, s.met);
  /* 数据库里没有可用的相亲对象（partners 未导入 / 性别不全）→ 按「没找到」处理，
   * 不要把 null 写进 lead，否则后续流程会崩。 */
  if (!p) return seekFailResult(s, cost, paid, N_);
  markMet(s, p);
  s.lead = p;
  /* 换了一个还没见面的人 → 微信计数归零（别让上一段的账挂到新对象头上） */
  resetChatTally(s);
  var desc = describePartner(p);
  var tail = N_.find_ok.tail.slice();
  return {
    ok: true,
    cost: cost,
    paid: paid,
    delta: { money: -paid },
    days: Math.max(1, Math.round(C('SEEK_OK_DAYS', 7) * s.diff.timeMod)),
    title: N_.find_ok.title,
    desc: desc,          // 对象的纯文字介绍（渲染层改用信封卡片时可不展示）
    tail: tail,          // 后续旁白
    lines: desc.concat(tail)
  };
}

/* ---------------- 偶遇 ----------------
 * 「其余安排」（生活 / 提升 / 加班 / 休息）也有小概率认识一个能接触的对象。
 * 只在单身、且当前没有待接触对象时才可能触发，避免覆盖已有 lead。
 * 概率按 action 取 ENCOUNTER_<ACTION>，取不到就退回 ENCOUNTER_BASE。
 * 返回 null 表示没遇到；命中时把人写进 s.lead，由渲染层给出说明。
 * 允许触发的行动由常量 ENCOUNTER_ACTIONS 配置（逗号分隔），改配置即可开关。
 */
function canEncounter(action) {
  var raw = String(C('ENCOUNTER_ACTIONS', 'life,improve,rest,overtime') || '');
  var parts = raw.split(',');
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].trim() === String(action || '')) return true;
  }
  return false;
}

function tryChanceEncounter(s, action) {
  if (s.relationship !== 'single' || s.lead || s.partner) return null;
  action = String(action || '');
  if (!canEncounter(action)) return null;
  var key = 'ENCOUNTER_' + action.toUpperCase();
  var p = C(key, C('ENCOUNTER_BASE', 0.12));
  if (!(p > 0)) return null;
  if (Math.random() >= p) return null;

  var who = generatePartner(s.gender, s.looks, s.family, s.met);
  if (!who) return null;             // 数据库没有可用对象 → 不触发偶遇
  markMet(s, who);
  s.lead = who;
  resetChatTally(s);          // 偶遇换人同样清零微信计数
  var T_ = DB.text('play') || {};          // 偶遇文案放在 play 文档里
  var intro = T_['encounter_' + action] || T_.encounter_intro || '';
  var tail = T_.encounter_tail || '';
  var lines = [];
  if (intro) lines.push(intro);
  lines = lines.concat(describePartner(who));
  if (tail) lines.push(tail);
  return {
    title: T_.encounter_title || '意外认识了一个人',
    intro: intro,
    tail: tail,
    lines: lines,
    partner: who
  };
}

function applyBreakupCooldown(s) {
  if (s.relStartDay == null) return 0;
  var together = Math.max(0, s.day - s.relStartDay);
  s.relStartDay = null;
  if (together <= 0) return 0;
  var cool = clamp(
    Math.round(together * C('BREAK_COOLDOWN_RATE', 0.5)),
    C('BREAK_COOLDOWN_MIN', 5),
    C('BREAK_COOLDOWN_MAX', 40)
  );
  s.singleStreak = (s.singleStreak || 0) + cool;
  s.cooldownFlash = { days: cool, together: together, day: s.day };
  return cool;
}

function firstMeet(s) {
  if (!s.lead) return null;
  var mats = DB.get('materials') || {};
  var lead = s.lead;
  s.partner = s.lead;
  s.lead = null;
  s.relationship = 'meeting';
  /* 真的见面了 → 当初「聊够就该见一面」的义务已兑现，微信计数清零重来 */
  resetChatTally(s);
  /* 第一印象：由玩家属性 + 对方在数据库里登记的「眼缘」first 决定（不再随机）。
   * first 是每个相亲对象自己的固定值（可正可负），这样不同人见面时的
   * 初始好感不同，但同一个人每次见面的结果完全一致。 */
  var first = (C('FIRST_BASE', 33) + (s.looks - 50) * C('FIRST_LOOKS_K', 0.2) +
    (s.family - 50) * C('FIRST_FAMILY_K', 0.12) + (s.mood - 50) * C('FIRST_MOOD_K', 0.1) +
    (lead.first || 0)) * s.diff.chanceMod;
  /* 见面前在微信上聊出来的好感，折算成「见面前的底子」一起算进第一印象：
   * 聊得再好也有天花板（LEAD_CHAT_AFF_MAX），不会把初遇直接抬到满格。 */
  var chatBonus = Math.min(Math.max(0, s.affection || 0), C('LEAD_CHAT_AFF_MAX', 20));
  s.affection = clamp(
    Math.round(first + chatBonus),
    C('FIRST_CLAMP_MIN', 8),
    C('FIRST_CLAMP_MAX', 75)
  );
  return {
    place: randPick(mats.meetPlaces || ['常去的那家咖啡厅']),
    partner: s.partner,
    chatBonus: Math.round(chatBonus),
    days: Math.max(1, Math.round(C('MEET_DAYS', 3) * s.diff.timeMod))
  };
}

function endMeet(s) {
  var N_ = N();
  var ok = s.affection >= C('MEET_AFFECTION_MIN', 32);
  if (ok) {
    s.relationship = 'talking';
    s.relStartDay = s.day;
    var grace = C('MEET_END_GRACE', 30);
    s.singleLimit += grace;
    s.graceFlash = { amount: grace, day: s.day, reason: flow('grace_meet_reason') };
    return {
      ok: true,
      title: N_.meet_ok.title,
      lines: N_.meet_ok.lines.map(function (l) { return fillText(l, s); })
    };
  }
  s.relationship = 'single';
  s.partner = null;
  resetChatTally(s);          // 初遇没成 → 这段告吹，微信计数归零
  var dAff = applyStat(s, 'affection', -s.affection);
  var dMood = applyStat(s, 'mood', C('MEET_END_MOOD', -20));
  return {
    ok: false,
    title: N_.meet_fail.title,
    delta: { mood: dMood, affection: dAff },
    lines: N_.meet_fail.lines.map(function (l) { return fillText(l, s); })
  };
}

function dateSpendLabel(t, gender) {
  return (t.spendLabel && t.spendLabel[gender] && t.spendLabel[gender][t.id]) || t.sub;
}

function monthFinance(s) {
  var sal = s.salary || { income: 0, expense: 0 };
  var baseIncome = sal.income || 0;
  var baseExpense = sal.expense || 0;
  var careerBonus = Math.round(s.career * C('CAREER_INCOME_FACTOR', 150));
  var income = Math.round((baseIncome + careerBonus) * s.diff.salaryMod);
  var expense = Math.round(baseExpense * s.diff.salaryMod);
  return { baseIncome: baseIncome, careerBonus: careerBonus, income: income, expense: expense, net: income - expense };
}

function goDate(s, typeId) {
  var t = byId(DB.list('date_types'), typeId) || byId(DB.list('date_types'), 'simple');
  var EVENTS = DB.list('events');
  var cost = Math.round(t.cost * s.diff.costMod);
  var paid = -applyStat(s, 'money', -cost);
  var dMood = applyStat(s, 'mood', t.mood);

  /* 约会事件按接触阶段过滤：带 stage 的（如「要不要孩子」）只有告白成功后才会出现 */
  var allDate = EVENTS.filter(function (e) {
    return e.phase === 'date' && (!e.dateType || e.dateType === t.id) && stageOk(s, e);
  });
  var styleList = styleEventIds(s.courtStyle);
  var matched = styleList ? allDate.filter(function (e) { return styleList.indexOf(e.id) >= 0; }) : allDate;
  var byStyle = matched.length ? matched : allDate;
  /* 防御：旧存档 / 残缺对象可能没有 seenDates（约会去过哪些事件），补一个空数组 */
  if (s.partner && !s.partner.seenDates) s.partner.seenDates = [];
  var fresh = byStyle.filter(function (e) { return !(s.partner && s.partner.seenDates.indexOf(e.id) >= 0); });
  var pool = fresh.length ? fresh : byStyle;
  var ev = weightedPick(pool);
  if (s.partner && s.partner.seenDates.indexOf(ev.id) < 0) s.partner.seenDates.push(ev.id);

  /* 「必须当面约会」的窗口在这里解除：玩家真的把约会安排下去了，
   * 同时把微信聊天计数清零，重新开始攒次数。 */
  resetChatTally(s);

  var baseDays = t.days || 3;
  var wait = 0;
  var note = '';
  if (s.jobType === 'worker' && !isWeekend(s.day)) {
    wait = daysToWeekend(s.day);
    var noteTpl = flow('worker_date_note');
    note = noteTpl
      ? noteTpl.replace(/\{job\}/g, s.jobName).replace(/\{day\}/g, weekdayName(s.day + wait))
      : '';
  }
  var days = Math.max(1, Math.round((baseDays + wait) * s.diff.timeMod));
  return {
    event: ev, cost: cost, paid: paid, delta: { money: -paid, mood: dMood },
    type: t, days: days, wait: wait, note: note, spend: dateSpendLabel(t, s.gender)
  };
}

function styleEventIds(styleId) {
  var list = DB.list('style_events');
  for (var i = 0; i < list.length; i++) {
    if (list[i].styleId === styleId || list[i].id === styleId) return list[i].eventIds;
  }
  return null;
}

function actionDays(id, s) {
  var AD = C('ACTION_DAYS', { confess: 5, propose: 10, child: 30, breakup: 1, rest: 1, chat: 1 });
  return Math.max(1, Math.round((AD[id] || 1) * s.diff.timeMod));
}

/* ================= 交往风格翻车 ================= */
function applyStyleRisk(s) {
  var st = byId(DB.list('court_styles'), s.courtStyle);
  if (!st || !st.risk) return null;
  if (Math.random() < st.risk * s.diff.riskMod) {
    var capBase = C('AFFECTION_CAP_BASE', 100);
    /* 翻车扣分同样要按刻度换算：恋爱后上限是 500，-8 在旧刻度上很疼、
     * 在新刻度上几乎没感觉，所以乘上刻度倍数保持一致的分量。 */
    var d = Math.round(st.failAff * (affectionCap(s) / capBase));
    s.affection = clamp(s.affection + d, 0, affectionCap(s));
    return { text: st.failText, delta: { affection: d } };
  }
  return null;
}

/* ================= 告白 / 求婚 ================= */
function confessChance(s) {
  var c = (s.affection - C('CONFESS_AFF_BASE', 45)) / C('CONFESS_AFF_DIV', 55);
  c += (s.looks - 50) / C('CONFESS_LOOKS_DIV', 500);
  c += (s.mood - 50) / C('CONFESS_MOOD_DIV', 400);
  return clamp(c * s.diff.chanceMod, C('CHANCE_CLAMP_MIN', 0.05), C('CHANCE_CLAMP_MAX', 0.95));
}

function doConfess(s) {
  var N_ = N();
  var before = s.affection;
  var chance = confessChance(s);
  var ok = Math.random() < chance;
  if (ok) {
    s.relationship = 'dating';
    /* 旧刻度（上限 100）的好感度换算到恋爱后的新刻度（上限 500）：
     * 之前聊得多、处得好，恋爱起点更高，但离「敢求婚」还差得远 ——
     * 剩下的那一段只能靠继续相处补上。 */
    var scaled = Math.round(before * C('CONFESS_AFF_RESCALE', 2.2));
    s.affection = clamp(scaled + C('CONFESS_OK_AFF', 8), 0, affectionCap(s));
    var grace = C('CONFESS_OK_GRACE', 180);
    s.singleLimit += grace;
    s.graceFlash = { amount: grace, day: s.day, reason: flow('grace_confess_reason') };
    return {
      ok: true,
      title: N_.confess_ok.title,
      lines: N_.confess_ok.lines.map(function (l) { return fillText(l, s); }),
      delta: { affection: s.affection - before },
      cap: affectionCap(s)
    };
  }
  s.flags.rejectCount++;
  if (Math.random() < C('CONFESS_FAIL_BREAKUP_RATE', 0.8)) {
    var p = s.partner;
    var br = doBreakup(s, N_.confess_break_reason);
    return {
      ok: false,
      breakup: true,
      title: N_.confess_fail_break.title,
      lines: N_.confess_fail_break.lines.map(function (l) { return fillText(l, s, { _partner: p }); }),
      delta: br.delta
    };
  }
  var lost = applyStat(s, 'affection', -s.affection);
  return {
    ok: false,
    breakup: false,
    title: N_.confess_fail_zero.title,
    lines: N_.confess_fail_zero.lines.map(function (l) { return fillText(l, s); }),
    delta: { affection: lost }
  };
}

/* 敢开口求婚至少需要多少感情（低于这个数界面会劝你再相处一阵） */
function proposeAffectionMin(s) {
  return C('PROPOSE_AFF_MIN', 260);
}

/* 求婚成功率按「恋爱后的动态刻度」计算：
 * 告白成功那一刻好感大概只有 220 上下，成功率几乎为零 —— 还得接着约会、
 * 接着聊天，把感情往上养，才会慢慢有把握。数值同样全部来自常量。 */
function proposeChance(s) {
  var base = (s.affection - C('PROPOSE_AFF_BASE', 300)) / C('PROPOSE_AFF_DIV', 200);
  if (s.money < C('PROPOSE_MONEY_LOW', 60000)) base += C('PROPOSE_MONEY_LOW_PENALTY', -0.25);
  if (s.money >= C('PROPOSE_MONEY_HIGH', 300000)) base += C('PROPOSE_MONEY_HIGH_BONUS', 0.1);
  if (s.career >= C('PROPOSE_CAREER_HIGH', 70)) base += C('PROPOSE_CAREER_BONUS', 0.05);
  base += (s.family - 50) / C('PROPOSE_FAMILY_DIV', 400);
  base += (s.mood - 50) / C('PROPOSE_MOOD_DIV', 400);
  return clamp(base * s.diff.chanceMod, C('CHANCE_CLAMP_MIN', 0.05), C('CHANCE_CLAMP_MAX', 0.95));
}

function doPropose(s) {
  var N_ = N();
  var chance = proposeChance(s);
  var ok = Math.random() < chance;
  if (ok) {
    s.relationship = 'married';
    s.flags.marriedOnce = true;
    var paid = -applyStat(s, 'money', -C('PROPOSE_COST', 60000));
    s.affection = clamp(s.affection + C('PROPOSE_OK_AFF', 40), 0, affectionCap(s));
    return {
      ok: true,
      paid: paid,
      title: N_.propose_ok.title,
      lines: N_.propose_ok.lines.map(function (l) { return fillText(l, s); })
    };
  }
  // 失败：先用 applyStat 扣好感，这样返回的变化量能如实显示在结算里
  s.flags.rejectCount++;
  var dAff = applyStat(s, 'affection', C('PROPOSE_FAIL_AFF', -25));
  // 与告白一致：被拒有可能直接谈崩（分手会清好感、重置关系计时并进入冷却）
  if (Math.random() < C('PROPOSE_FAIL_BREAKUP_RATE', 0.6)) {
    var p = s.partner;
    var pr = doBreakup(s, N_.propose_break_reason || N_.confess_break_reason);
    var lines = N_.propose_fail.lines.map(function (l) { return fillText(l, s, { _partner: p }); });
    lines.push('', '【' + pr.title + '】');
    pr.lines.forEach(function (l) { lines.push(l); });
    return {
      ok: false,
      breakup: true,
      title: (N_.propose_fail_break || N_.propose_fail).title,
      lines: lines,
      delta: pr.delta
    };
  }
  return {
    ok: false,
    breakup: false,
    title: N_.propose_fail.title,
    lines: N_.propose_fail.lines.map(function (l) { return fillText(l, s); }),
    delta: { affection: dAff }
  };
}

/* ================= 分手 / 生子 / 加班 ================= */

/* 分手情绪扣减的档位：与「相处天数」和「这段关系里花的钱」成正比。
 * 阈值全部来自常量 BREAK_MOOD_TIERS（数据驱动，改数据不改逻辑）。
 * 每档语义：
 *   mode='zero'  → 情绪归 0（投入最深：相处超过 1 个月 / 花费超过 5000）
 *   mode='set'   → 情绪压到某个低值（投入不小）
 *   mode='ratio' → 情绪按比例折减（投入有限，最轻）
 * 顺序从最重排到最轻；第一个被超过的档位生效。一档都没超（如当天就分、
 * 零花费）则落到最后一档（最轻的折半），保证「分手总有情绪代价」。 */
function breakupTier(s) {
  var days = (s.relStartDay == null) ? 0 : Math.max(0, s.day - s.relStartDay);
  var spent = s.relSpent || 0;
  var tiers = C('BREAK_MOOD_TIERS', [
    { days: 30, money: 5000, mode: 'zero' },
    { days: 15, money: 2500, mode: 'set', value: 10 },
    { days: 0, money: 0, mode: 'ratio', value: 0.5 }
  ]);
  if (!Array.isArray(tiers)) tiers = [tiers];
  var info = null;
  for (var i = 0; i < tiers.length; i++) {
    var t = tiers[i];
    if (days > (t.days || 0) || spent > (t.money || 0)) {
      info = { index: i + 1, total: tiers.length, tier: t, days: days, spent: spent };
      break;
    }
  }
  if (!info) {
    var last = tiers[tiers.length - 1];
    info = { index: tiers.length, total: tiers.length, tier: last, days: days, spent: spent };
  }
  return info;
}

/* 按档位套用情绪扣减，返回真实变化量（夹取后） */
function applyBreakupMood(s, info) {
  var before = s.mood;
  var t = info.tier;
  var target;
  if (t.mode === 'zero') target = 0;
  else if (t.mode === 'set') target = Math.min(before, t.value != null ? t.value : 10);
  else target = Math.round(before * (t.value != null ? t.value : 0.5));
  s.mood = clamp(target, 0, 100);
  return s.mood - before;
}

function doBreakup(s, reason) {
  var N_ = N();
  var p = s.partner;
  var name = p ? p.name : (flow('default_partner') || '对方');
  s.relationship = 'single';
  s.partner = null;
  var dAff = applyStat(s, 'affection', -s.affection);
  s.flags.breakupCount++;
  var dHealth = applyStat(s, 'health', C('BREAKUP_HEALTH', -5));
  /* 情绪扣减按档位（与相处天数 / 关系内花费成正比），不再是一刀切的 BREAKUP_MOOD */
  var tierInfo = breakupTier(s);
  var dMood = applyBreakupMood(s, tierInfo);
  var cool = applyBreakupCooldown(s);
  var lines = N_.breakup.lines.map(function (l) {
    return fillText(l, s, { _partner: p, name: name, reason: reason || N_.breakup_default_reason });
  });
  /* 明确展示「为什么扣这么多」：相处多久 + 花了多少 + 落在第几档 + 情绪从多少变多少 */
  lines.push(fillText(N_.breakup_basis || '', s, { days: tierInfo.days }));
  if (tierInfo.spent > 0) {
    lines.push(fillText(N_.breakup_spent || '', s, { spent: moneyText(tierInfo.spent) }));
  }
  var tierKey = ['breakup_tier_zero', 'breakup_tier_set', 'breakup_tier_ratio'][tierInfo.index - 1];
  var tierLine = fillText(N_[tierKey] || '', s, { from: s.mood - dMood, to: s.mood });
  if (tierLine) lines.push(tierLine);
  lines.push(fillText(N_.breakup_mood_change || '', s, { from: s.mood - dMood, to: s.mood }));
  if (cool > 0) {
    var tg = (s.cooldownFlash && s.cooldownFlash.together) || 0;
    lines.push(fillText(N_.breakup_cooldown, s, { together: tg, cool: cool }));
  }
  /* 关系结束 → 下一段关系的起点要干净：花费累计与微信计数都归零 */
  s.relSpent = 0;
  resetChatTally(s);
  return {
    title: N_.breakup.title,
    delta: { mood: dMood, health: dHealth, affection: dAff },
    breakupInfo: tierInfo,
    cooldown: cool,
    lines: lines
  };
}

function doChild(s) {
  var N_ = N();
  var minAff = C('CHILD_AFFECTION_MIN', 70);
  if (s.affection < minAff) {
    return {
      ok: false,
      title: N_.child_fail.title,
      lines: N_.child_fail.lines.map(function (l) { return fillText(l, s, { min: minAff }); })
    };
  }
  s.flags.child = true;
  var paid = -applyStat(s, 'money', -C('CHILD_COST', 30000));
  var dHealth = applyStat(s, 'health', C('CHILD_HEALTH', -5));
  s.affection = clamp(s.affection + C('CHILD_AFF', 30), 0, affectionCap(s));
  return {
    ok: true,
    paid: paid,
    delta: { money: -paid, health: dHealth },
    title: N_.child_ok.title,
    lines: N_.child_ok.lines.map(function (l) { return fillText(l, s); })
  };
}

function workdaySkipPenalty(s) {
  if (s.jobType === 'worker' && !isWeekend(s.day)) {
    var dMoney = applyStat(s, 'money', C('WORKDAY_SKIP_MONEY', -1000));
    var dCareer = applyStat(s, 'career', C('WORKDAY_SKIP_CAREER', -3));
    return { money: dMoney, career: dCareer };
  }
  return null;
}

function doOvertime(s) {
  var N_ = N();
  var gain = Math.round((s.career * C('OVERTIME_CAREER_K', 12) + C('OVERTIME_BASE', 2000)) * s.diff.gainMod);
  var dMoney = applyStat(s, 'money', gain);
  var dCareer = applyStat(s, 'career', C('OVERTIME_CAREER', 5));
  var dHealth = applyStat(s, 'health', C('OVERTIME_HEALTH', -6));
  var dMood = applyStat(s, 'mood', C('OVERTIME_MOOD', -3));
  var lines = N_.overtime.slice();
  var delta = { money: dMoney, career: dCareer, health: dHealth, mood: dMood };
  if (s.relationship !== 'single' && s.goal.needRelation) {
    var drop = applyStat(s, 'affection', C('OVERTIME_AFF', -8));
    lines.push(fillText(N_.overtime_aff, s));
    delta.affection = drop;
  }
  return {
    amount: gain,
    days: Math.max(1, Math.round(C('OVERTIME_DAYS', 3) * s.diff.timeMod)),
    lines: lines,
    delta: delta
  };
}

/* ================= 对象主动提分手 ================= */
function checkPartnerLeave(s) {
  if (s.relationship === 'single' || !s.partner) return null;
  var per = byId(DB.list('personalities'), s.partner.personalityId);
  if (!per) return null;
  var res = R.personalityRisk(s, per);
  if (res && res.risk > 0 && Math.random() < res.risk) {
    var r = doBreakup(s, res.reason);
    return { title: flow('partner_leave_title') || '对方提出了分手', lines: r.lines, delta: r.delta, cooldown: r.cooldown || 0 };
  }
  return null;
}

/* ================= 关系破裂 ================= */
function checkBreakup(s) {
  var N_ = N();
  if (s.relationship !== 'single' && s.affection <= 0) {
    var p = s.partner;
    var name = p ? p.name : (flow('default_partner') || '对方');
    var lines = N_.breakup_zero.lines.map(function (l) {
      return fillText(l, s, { name: name });
    });
    var br = doBreakup(s, N_.breakup_zero_reason);
    var dExtra = applyStat(s, 'health', C('BREAKUP_ZERO_EXTRA_HEALTH', -1));
    return {
      title: N_.breakup_zero.title,
      delta: {
        mood: br.delta.mood,
        health: br.delta.health + dExtra,
        affection: br.delta.affection
      },
      cooldown: br.cooldown || 0,
      lines: lines
    };
  }
  return null;
}

/* ================= 胜负判定 ================= */
function endingById(id) {
  return byId(DB.list('endings'), id);
}

function checkEnd(s) {
  if (s.goal && R.goalCheck(s, s.goal)) {
    var e = endingById(s.goal.id) || endingById('marry');
    var winTpl = flow('win_prefix') || '达成目标：{goal} · {title}';
    var strip = flow('ending_strip') || '结局 · ';
    /* 复用 cloneEnding + withReason，确保 id / art 不被丢掉（结局页插画靠 art） */
    var end = withReason(cloneEnding(e), 'win', {
      goal: goalName(s),
      progress: Math.round(R.goalProgress(s, s.goal) * 100),
      day: s.day
    });
    end.title = winTpl
      .replace(/\{goal\}/g, goalName(s))
      .replace(/\{title\}/g, (e.title || '').split(strip).join(''));
    end.lines = e.lines.map(function (l) { return fillText(l, s); });
    return end;
  }
  if (s.money <= 0) return withReason(cloneEnding(endingById('broke')), 'broke', { money: Math.round(s.money), day: s.day });
  if (s.health <= 0) return withReason(cloneEnding(endingById('sick')), 'sick', { health: Math.round(s.health), day: s.day });
  if (s.career <= 0) return withReason(cloneEnding(endingById('jobless')), 'jobless', { career: Math.round(s.career), day: s.day });
  if (s.mood <= 0) return withReason(cloneEnding(endingById('depressed')), 'depressed', { mood: Math.round(s.mood), day: s.day });
  /* 相亲期限（needRelation 目标的唯一时间型结局）——
   * 只有「到点时仍是单身」才算失败；接触中（meeting / talking）倒计时已暂停，
   * 即使剩余天数为 0 也不会在这里判负，可以继续把这段关系走完。 */
  if (s.goal && s.goal.needRelation && s.singleLimit > 0 &&
      s.relationship === 'single' && s.singleStreak >= s.singleLimit) {
    return withReason(cloneEnding(endingById('forced')), 'deadline', {
      day: s.day, streak: s.singleStreak, limit: s.singleLimit,
      goal: goalName(s),
      progress: s.goal ? Math.round(R.goalProgress(s, s.goal) * 100) : 0,
      relation: s.relationship
    });
  }
  /* 非相亲类目标：仍以 maxDays 为兜底，避免无限循环 */
  if (s.day > s.diff.maxDays) {
    return withReason(cloneEnding(endingById('timeout')), 'timeout', {
      day: s.day, maxDays: s.diff.maxDays, goal: goalName(s),
      progress: s.goal ? Math.round(R.goalProgress(s, s.goal) * 100) : 0,
      relation: s.relationship
    });
  }
  return null;
}

/* 给结局挂上「为什么」的结构化原因（文案模板在 texts.end.reasons，逻辑层不放文案） */
function withReason(end, key, vars) {
  if (!end) return null;
  end.reason = { key: key, vars: vars || {} };
  return end;
}

function cloneEnding(e) {
  if (!e) return null;
  /* 必须带上 id 与 art：id 供结局页判断 / 告警使用，
   * art 是结局页头部插画的唯一真源（end_<art>_<性别>.jpg）。
   * 旧版漏拷这两个字段，导致所有结局的 S.ending 都没有 art，
   * 结局页头部永远只剩一块纯色（warnEndingArtIfStale 正是为它报的警）。 */
  return { id: e.id, type: e.type, title: e.title, lines: e.lines.slice(), art: e.art };
}

/* ================= 时间推进 ================= */

/* 相亲倒计时当前走不走表（渲染层与 advanceDays 共用同一套判断，
 * 避免「卡片说暂停、实际却在扣天数」这类两边规则漂移）。
 * state 只给渲染层当文案 key 用，不含任何数值/文案。 */
function deadlineState(s) {
  if (!s) return { running: false, state: 'settled' };
  if (s.relationship === 'dating' || s.relationship === 'married') {
    return { running: false, state: 'settled' };
  }
  if (s.relationship === 'talking') return { running: false, state: 'talking' };
  if (s.relationship === 'meeting') return { running: false, state: 'meeting' };
  /* 单身但已经相到人（还没赴约初遇）→ 同样暂停 */
  if (s.lead) return { running: false, state: 'lead' };
  return { running: true, state: 'single' };
}

function advanceDays(s, n) {
  n = Math.max(1, Math.round(n));
  var payday = C('PAYDAY_INTERVAL', 30);
  for (var i = 0; i < n; i++) {
    s.day += 1;
    /* 相亲倒计时走表规则（唯一判断在 deadlineState 里）：
     *   single 且无对象 → 正常走表
     *   已相到人未初遇 / 初遇中 / 接触中 → 暂停
     *   恋爱 / 婚后 → 归零，不再受期限压力
     * 「拿到对象那一刻」压力就消失，玩家可以从容安排见面。 */
    var ds = deadlineState(s);
    if (s.relationship === 'dating' || s.relationship === 'married') {
      s.singleStreak = 0;
    } else if (ds.running) {
      s.singleStreak += 1;
    }
    s.health = clamp(s.health - C('DAILY_HEALTH_DECAY', 0.22) * s.diff.decayMod, 0, 100);
    s.looks = clamp(s.looks - C('DAILY_LOOKS_DECAY', 0.05) * s.diff.decayMod, 0, 100);
    s.mood = clamp(s.mood + C('DAILY_MOOD_RECOVER', 0.4), 0, 100);
    if (s.relationship !== 'single' && s.partner) {
      /* 好感度的自然衰减同样随关系阶段变化：恋爱后刻度更大，
       * 每天掉得也更多（DAILY_AFFECTION_DECAY_DATING），不然养感情毫无压力。 */
      var decay = (s.relationship === 'dating' || s.relationship === 'married')
        ? C('DAILY_AFFECTION_DECAY_DATING', 0.6)
        : C('DAILY_AFFECTION_DECAY', 0.28);
      s.affection = clamp(s.affection - decay * s.diff.decayMod, 0, affectionCap(s));
    }
    if (s.day % payday === 0) {
      var f = monthFinance(s);
      s.money = Math.max(0, s.money + f.net);
      s.paydayFlash = { day: s.day, baseIncome: f.baseIncome, careerBonus: f.careerBonus, income: f.income, expense: f.expense, net: f.net };
    }
    var end = checkEnd(s);
    if (end) {
      s.over = true;
      s.ending = end;
      return end;
    }
  }
  return null;
}

/* ================= 相亲对象（全部来自数据库） =================
 * 对象不再「随机拼装」：partners 集合里一人一条，登记了
 *   基本信息（姓名 / 性别 / 年龄 / 职业 / 外形描述 / 爱好 / 认识方式）
 *   头像（avatar：assets/images/role/<avatar>-<性别>.png 的 key）
 *   人设（trait 性格 / condition 家庭 / personalityId 人格）
 *   数值（looks 颜值 / family 家境 / weight 抽取权重 / first 眼缘）
 * 逻辑层只做「按性别筛选 → 按玩家条件加权抽取 → 补齐运行时字段」，
 * 不再用 Math.random() 造姓名 / 职业 / 颜值这些字段。
 * mod（对象的加成系数）与各项描述文字，统一从 materials / personalities
 * 里按名字查回来，保持单一数据源。
 */
function genderCode(g) {
  if (g === 'f' || g === '女') return 'f';
  return 'm';
}

function partnerById(id) {
  return byId(DB.list('partners'), id);
}

/* 某个性别的全部相亲对象（异性）：gender 传玩家性别 */
function partnerRoster(playerGender) {
  var pg = playerGender === 'f' ? 'm' : 'f';
  return DB.list('partners').filter(function (p) {
    return p && genderCode(p.gender) === pg;
  });
}

/* 把数据库里的一条对象记录补成运行时对象（加上从 materials 查回来的
 * 职业备注 / 性格系数 / 家庭描述，以及人脸 key、记忆用字段） */
function hydratePartner(doc) {
  if (!doc) return null;
  var mats = DB.get('materials') || {};
  var jobs = mats.jobs || [];
  var traits = mats.traits || [];
  var conds = mats.conditions || [];
  var per = byId(DB.list('personalities'), doc.personalityId);

  var job = null, trait = null, cond = null, i;
  for (i = 0; i < jobs.length; i++) { if (jobs[i] && jobs[i].job === doc.job) { job = jobs[i]; break; } }
  for (i = 0; i < traits.length; i++) { if (traits[i] && traits[i].name === doc.trait) { trait = traits[i]; break; } }
  for (i = 0; i < conds.length; i++) { if (conds[i] && conds[i].name === doc.condition) { cond = conds[i]; break; } }

  /* 描述字段缺失时取池子里的第一条（确定性兜底，不随机） */
  var looks_ = mats.looks || [];
  var hobbies = mats.hobbies || [];
  var places = mats.places || [];

  return {
    id: doc.id,
    name: doc.name,
    gender: genderCode(doc.gender),
    age: doc.age || C('PARTNER_AGE_MIN', 23),
    job: doc.job,
    jobNote: (job && job.note) || doc.jobNote || '',
    /* 头像 key：优先用对象自己的 avatar，再退到职业头像表 */
    avatar: doc.avatar || (job && job.avatar) || null,
    trait: doc.trait || (trait && trait.name) || '',
    traitDesc: (trait && trait.desc) || '',
    condition: doc.condition || (cond && cond.name) || '',
    conditionDesc: (cond && cond.desc) || '',
    look: doc.look || looks_[0] || '',
    place: doc.place || places[0] || '',
    hobby: doc.hobby || hobbies[0] || '',
    personality: per ? per.name : (doc.personality || ''),
    personalityId: per ? per.id : doc.personalityId,
    personalityDesc: per ? per.desc : '',
    looks: clamp(Math.round(doc.looks || C('PARTNER_LOOKS_BASE', 38)),
      C('PARTNER_LOOKS_MIN', 25), C('PARTNER_LOOKS_MAX', 95)),
    family: clamp(Math.round(doc.family || C('PARTNER_FAMILY_BASE', 20)),
      C('PARTNER_FAMILY_MIN', 10), C('PARTNER_FAMILY_MAX', 98)),
    /* 眼缘：见面时的初始好感偏移（数据驱动，替代原来的随机项） */
    first: typeof doc.first === 'number' ? doc.first : 0,
    mod: Object.assign({ affection: 1, money: 1, health: 1, career: 1 }, (trait && trait.mod) || {}),
    moneyMod: ((job && job.money) || 1) * ((cond && cond.money) || 1),
    weight: doc.weight || 10,
    tagline: doc.tagline || '',
    seenDates: []
  };
}

/* 加权抽取：权重 = 基础 weight × 玩家条件带来的倾斜（条件越好越容易抽到
 * 「条件好」的对象）。这里只在「同一批数据库对象」里挑一个，不造新数据。 */
function pickPartnerFrom(pool, q) {
  var K = C('PICK_MONEY_K', 2.2);
  var mats = DB.get('materials') || {};
  var conds = mats.conditions || [];
  var items = pool.map(function (p) {
    var cm = 1, i;
    for (i = 0; i < conds.length; i++) {
      if (conds[i] && conds[i].name === p.condition) { cm = conds[i].money || 1; break; }
    }
    var w = (1 + q * (cm - 1) * K) * (p.weight || 10);
    return { p: p, w: Math.max(0.0001, w) };
  });
  var total = 0;
  for (var i = 0; i < items.length; i++) total += items[i].w;
  var r = Math.random() * total;
  for (var j = 0; j < items.length; j++) {
    r -= items[j].w;
    if (r <= 0) return items[j].p;
  }
  return items[items.length - 1].p;
}

/**
 * 抽一个相亲对象（从数据库的 partners 里取）。
 * @param {string} playerGender 玩家性别（m/f）→ 取异性
 * @param {number} playerLooks  玩家颜值（影响抽到「条件好」的人的概率）
 * @param {number} playerFamily 玩家家境
 * @param {array}  metIds       本局已遇见过的对象 id（优先抽没见过的）
 * @returns {object|null} 补水后的对象；数据库为空时返回 null
 */
function generatePartner(playerGender, playerLooks, playerFamily, metIds) {
  var roster = partnerRoster(playerGender);
  if (!roster.length) return null;

  var met = metIds || [];
  var fresh = roster.filter(function (p) { return met.indexOf(p.id) < 0; });
  var pool = fresh.length ? fresh : roster;

  var q = clamp(((playerLooks || 50) * 0.4 + (playerFamily || 50) * 0.6) / 100, 0, 1);
  return hydratePartner(pickPartnerFrom(pool, q));
}

/* 记下「这一局遇见过他/她」，下次不再抽到同一个人 */
function markMet(s, p) {
  if (!s || !p || !p.id) return;
  if (!s.met) s.met = [];
  if (s.met.indexOf(p.id) < 0) s.met.push(p.id);
}

function describePartner(p) {
  var tpl = N().partner_desc || [];
  var vars = {
    name: p.name, age: p.age, job: p.job, look: p.look, jobNote: p.jobNote,
    trait: p.trait, traitDesc: p.traitDesc, condition: p.condition, conditionDesc: p.conditionDesc,
    looks: p.looks, family: p.family, hobby: p.hobby, place: p.place
  };
  return tpl.map(function (line) {
    var out = String(line);
    for (var k in vars) out = out.split('{' + k + '}').join(String(vars[k]));
    return out;
  });
}

/* ================= 导出 ================= */
module.exports = {
  // 工具
  randPick: randPick,
  clamp: clamp,
  weightedPick: weightedPick,
  moneyText: moneyText,
  fillText: fillText,
  // 时间
  weekdayOf: weekdayOf,
  weekdayName: weekdayName,
  isWeekend: isWeekend,
  daysToWeekend: daysToWeekend,
  // 接触阶段（事件 / 聊天的分级门槛）
  relationOrder: relationOrder,
  stageRank: stageRank,
  stageOk: stageOk,
  // 开局
  createGame: createGame,
  goalName: goalName,
  // 事件
  pickEvent: pickEvent,
  pickLifeEvent: pickLifeEvent,
  pickImproveEvent: pickImproveEvent,
  pickMeetingEvent: pickMeetingEvent,
  canChat: canChat,
  chatStage: chatStage,
  chatAvailable: chatAvailable,
  chatCount: chatCount,
  chatPool: chatPool,
  pickChat: pickChat,
  applyChat: applyChat,
  /* 主动聊天 / 「必须出门约会」 */
  chatLocked: chatLocked,
  isMustDateChat: isMustDateChat,
  rollProactiveChat: rollProactiveChat,
  afterChat: afterChat,
  mustDateChatId: mustDateChatId,
  eventCategory: eventCategory,
  eventDays: eventDays,
  // 结算
  applyStat: applyStat,
  applyFx: applyFx,
  applyStyleRisk: applyStyleRisk,
  /* 好感度的动态上限（单身 100 / 恋爱后 500） */
  affectionCap: affectionCap,
  monthFinance: monthFinance,
  workdaySkipPenalty: workdaySkipPenalty,
  // 流程
  findDate: findDate,
  tryChanceEncounter: tryChanceEncounter,
  canEncounter: canEncounter,
  firstMeet: firstMeet,
  endMeet: endMeet,
  goDate: goDate,
  dateSpendLabel: dateSpendLabel,
  actionDays: actionDays,
  // 关系
  confessChance: confessChance,
  doConfess: doConfess,
  proposeChance: proposeChance,
  proposeAffectionMin: proposeAffectionMin,
  doPropose: doPropose,
  doBreakup: doBreakup,
  breakupTier: breakupTier,
  applyBreakupMood: applyBreakupMood,
  resetChatTally: resetChatTally,
  doChild: doChild,
  doOvertime: doOvertime,
  checkPartnerLeave: checkPartnerLeave,
  checkBreakup: checkBreakup,
  checkEnd: checkEnd,
  deadlineState: deadlineState,
  advanceDays: advanceDays,
  // 对象（全部来自数据库 partners 集合）
  genderCode: genderCode,
  partnerById: partnerById,
  partnerRoster: partnerRoster,
  hydratePartner: hydratePartner,
  generatePartner: generatePartner,
  markMet: markMet,
  describePartner: describePartner,
  pickPartnerFrom: pickPartnerFrom
};

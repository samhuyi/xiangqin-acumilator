/* =========================================================
 * 事件 / 聊天「结算数值」体检与复算（tools/rebalance-fx.js）
 * ---------------------------------------------------------
 * 背景：gen-seed 的 enrichFx 会给每个选项「补齐影响」——
 *   · 作者没写的属性，随机补一个 ±1~4 的附带影响；
 *   · 再强制「至少 2 项为正、2 项为负」。
 * 于是出现了「妈打电话，颜值 +3」「点个赞，存款 -4」这类噪声：
 *   · 存款只在个位数上动，玩家根本看不见；
 *   · 每个选项都把 5 个属性铺满，结算面板全是无关数值。
 *
 * 本脚本把 events / chats 的 fx 按同一套口径复算一遍：
 *   规则 1 存款：|v| < 100 元 → 无影响（删键）。
 *          100 元 ≈ 最便宜的一次约会（400 元）的四分之一，
 *          低于这个数在游戏经济里等于没动（起步存款 5k~80w、求婚 6w）。
 *   规则 2 属性：非存款 |v| < 5 → 无影响（删键）。
 *          0~100 刻度上，健康每天自然掉 0.22、情绪每天回 0.4，
 *          ±4 以内就是「一天的自然波动」，写进结算面板只是噪声；
 *          ±5 起才和一次行动（加班：健康 -6 / 事业 +5 / 情绪 -3）同一个量级。
 *   规则 3 条数：每个选项最多保留 3 项影响（按幅度取前 3），不再铺满全属性。
 *   规则 4 取舍：不再注入随机旁支、也不强制「有增有减」——保留作者本意，
 *          只有当选项本身有取舍时才体现取舍。
 *
 * 作者手写意图优先：n_/x_ 事件（tools/seed-more-events.js、gen-seed 的 EXTRA_EVENTS）
 * 与 n_c_ 聊天（tools/seed-more-chats.js）按原意图 ×FX_AMP 重算，
 * 其余（参考项目继承来的 s_/t_/d_/m_/a_/dt_/up_ 与旧聊天）直接清洗现有种子值。
 *
 * 运行：node tools/rebalance-fx.js            # 写入（并打印体检报告）
 *      node tools/rebalance-fx.js --dry       # 只打印报告，不写文件
 * 写完记得跑 node db/import.js 刷新云导入文件。
 * ========================================================= */

'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var SEED_DIR = path.join(ROOT, 'db', 'seed');
var EXPORT_DIR = path.join(ROOT, 'db', 'export');

var DRY = process.argv.indexOf('--dry') >= 0;

/* ---------------- 规则常量 ---------------- */
var MONEY_MIN = 100;      // 存款影响的最小可见额（元）
var STAT_MIN = 5;         // 非存款属性的最小可见幅度（0~100 刻度）
var MAX_FX = 3;           // 每个选项最多保留几项
var FX_AMP = 2;           // 作者手写数值的放大倍数（与 gen-seed 保持一致）

var MONEY = 'money';
var STAT_KEYS = ['affection', 'health', 'career', 'looks', 'family', 'mood'];
var ALL_KEYS = [MONEY].concat(STAT_KEYS);

/* ---------------- 作者手写意图 ---------------- */

/* 从 gen-seed.js 里把 EXTRA_EVENTS 这类「纯数据数组」抠出来（gen-seed 依赖缺失的
 * 参考项目、没法 require）。用括号配对扫描拿到数组字面量，再当数据求值。 */
function extractArrayLiteral(file, varName) {
  var src = fs.readFileSync(file, 'utf8');
  var at = src.indexOf('const ' + varName + ' = [');
  if (at < 0) return null;
  var start = src.indexOf('[', at);
  var depth = 0, quote = null, esc = false;
  for (var i = start; i < src.length; i++) {
    var ch = src[i];
    if (quote) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (!depth) {
        try {
          return new Function('return (' + src.slice(start, i + 1) + ');')();
        } catch (e) {
          console.warn('  ! 解析 ' + varName + ' 失败：' + e.message);
          return null;
        }
      }
    }
  }
  return null;
}

/* id -> 该选项的作者原始 fx（只收作者真写了的键） */
function authoredIndex() {
  var events = {}, chats = {};

  var more = require('./seed-more-events.js');
  more.forEach(function (e) {
    events[e.id] = (e.options || []).map(function (o) { return o.fx || {}; });
  });

  var moreChats = require('./seed-more-chats.js');
  moreChats.forEach(function (c) {
    chats[c.id] = (c.options || []).map(function (o) { return o.fx || {}; });
  });

  var extra = extractArrayLiteral(path.join(__dirname, 'gen-seed.js'), 'EXTRA_EVENTS') || [];
  extra.forEach(function (e) {
    events[e.id] = (e.options || []).map(function (o) { return o.fx || {}; });
  });

  return { events: events, chats: chats };
}

/* ---------------- 核心规则 ---------------- */

/* 把一份 fx 按规则压一遍；返回 { fx, dropped, zero } —— dropped 供体检报告统计。
 * zero 是「直接清零」的属主列表（fx.zero，婚托卷款 / 情绪被掏空这类断崖式惩罚），
 * 它不是一个数值、不参与「幅度排序取前三」，必须原样保留，
 * 否则复算一次就会把归零语义抹掉（事件退化成「什么都不发生」）。 */
function rebalanceFx(raw) {
  var kept = [], dropped = [];
  ALL_KEYS.forEach(function (k) {
    var v = raw && raw[k];
    if (v === undefined || v === null) return;
    v = Math.round(v);
    if (!v) return;
    var min = (k === MONEY) ? MONEY_MIN : STAT_MIN;
    if (Math.abs(v) >= min) kept.push({ k: k, v: v });
    else dropped.push({ k: k, v: v });
  });

  /* 幅度大的优先；同样幅度时存款优先（花钱/进账是玩家最关心的） */
  kept.sort(function (a, b) {
    if (Math.abs(b.v) !== Math.abs(a.v)) return Math.abs(b.v) - Math.abs(a.v);
    return (a.k === MONEY ? -1 : 1);
  });

  var fx = {};
  kept.slice(0, MAX_FX).forEach(function (e) { fx[e.k] = e.v; });
  kept.slice(MAX_FX).forEach(function (e) { dropped.push(e); });
  var zero = cleanZero(raw && raw.zero);
  if (zero.length) fx.zero = zero;      // 只在真的有时才写这个键，避免污染 diff
  return { fx: fx, dropped: dropped, zero: zero };
}

/* 归零属性列表：只收七项基础属性的名字，去重、去空 */
function cleanZero(list) {
  if (!list) return [];
  if (!Array.isArray(list)) list = [list];
  var out = [];
  list.forEach(function (k) {
    k = String(k || '');
    if (ALL_KEYS.indexOf(k) >= 0 && out.indexOf(k) < 0) out.push(k);
  });
  return out;
}

/* 作者意图 ×FX_AMP，得到「未过规则」的原始数值 */
function fromAuthored(auth) {
  var out = {};
  ALL_KEYS.forEach(function (k) {
    var v = auth && auth[k];
    if (v === undefined || v === null || !v) return;
    out[k] = Math.round(v * FX_AMP);
  });
  out.zero = cleanZero(auth && auth.zero);
  if (!out.zero.length) delete out.zero;
  return out;
}

/* ---------------- 体检报告 ---------------- */

function blank() { return { options: 0, keys: 0, money: [], byCount: {}, zero: 0, zeroKeys: {} }; }
function countOf(o) {
  var n = 0;
  ALL_KEYS.forEach(function (k) { if (o && o[k]) n++; });
  if (o && o.zero && o.zero.length) n++;    // 归零也算「有影响」
  return n;
}

function scan(options) {
  var st = blank();
  options.forEach(function (fx) {
    st.options++;
    var n = 0;
    ALL_KEYS.forEach(function (k) {
      if (fx && fx[k]) {
        st.keys++; n++;
        if (k === MONEY) st.money.push(Math.abs(Math.round(fx[k])));
      }
    });
    if (fx && fx.zero && fx.zero.length) {
      st.zero++;
      fx.zero.forEach(function (k) { st.zeroKeys[k] = (st.zeroKeys[k] || 0) + 1; });
      n++;                                  // 计入「影响项条数」，别让它看起来是空选项
      st.keys++;
    }
    st.byCount[n] = (st.byCount[n] || 0) + 1;
  });
  st.money.sort(function (a, b) { return a - b; });
  return st;
}

function moneySummary(list) {
  if (!list.length) return '无存款影响';
  var tiny = list.filter(function (v) { return v < MONEY_MIN; }).length;
  return '存款项 ' + list.length + ' 个（其中 <' + MONEY_MIN + ' 元 ' + tiny + ' 个）' +
    ' | 最小 ' + list[0] + ' | 中位 ' + list[Math.floor(list.length / 2)] + ' | 最大 ' + list[list.length - 1];
}

function countSummary(byCount) {
  return Object.keys(byCount).sort(function (a, b) { return a - b; })
    .map(function (n) { return n + '项:' + byCount[n]; }).join('  ');
}

/* 「归零」类选项的体检：fx.zero 是断崖式惩罚，最容易写多（一条随机事件秒杀玩家） */
function zeroSummary(st) {
  if (!st.zero) return '断崖式（fx.zero）选项：无';
  return '断崖式（fx.zero）选项：' + st.zero + ' 条 → ' +
    Object.keys(st.zeroKeys).map(function (k) { return k + '×' + st.zeroKeys[k]; }).join('  ');
}

/* ---------------- 主流程 ---------------- */

function toModule(name, data, note) {
  return '/* 自动生成，请勿手改。来源：tools/gen-seed.js' + (note ? '；数值经 tools/rebalance-fx.js 复算' : '') + ' */\n' +
    'module.exports = ' + JSON.stringify(data, null, 2) + ';\n';
}

function main() {
  var auth = authoredIndex();
  var events = JSON.parse(JSON.stringify(require(path.join(SEED_DIR, 'events.js'))));
  var chats = JSON.parse(JSON.stringify(require(path.join(SEED_DIR, 'chats.js'))));

  var samples = { authored: [], cleaned: [] };
  var emptyAfter = [];
  var srcCount = { authored: 0, cleaned: 0 };

  function fixOption(opt, authoredFx, label, family) {
    var isAuthored = !!authoredFx;
    srcCount[isAuthored ? 'authored' : 'cleaned']++;
    var base = isAuthored ? fromAuthored(authoredFx) : (opt.fx || {});
    var r = rebalanceFx(base);
    var before = JSON.stringify(opt.fx || {});
    var after = JSON.stringify(r.fx);
    if (before !== after) {
      var bucket = isAuthored ? samples.authored : samples.cleaned;
      if (bucket.length < 8) {
        bucket.push({ label: label, family: family, before: before, after: after });
      }
      if (!countOf(r.fx)) emptyAfter.push(label + '  ' + before);
    }
    opt.fx = r.fx;
    return r;
  }

  /* ---- 事件 ---- */
  var evBefore = [], evAfter = [];
  events.forEach(function (e) {
    (e.options || []).forEach(function (o, oi) {
      var authoredFx = (auth.events[e.id] || [])[oi];
      evBefore.push(o.fx || {});
      fixOption(o, authoredFx, e.id + '#' + oi + ' ' + String(o.label).slice(0, 16), 'events');
      evAfter.push(o.fx);
    });
  });

  /* ---- 聊天（fx 与扁平的 affection / mood 必须同一份数值） ---- */
  var chBefore = [], chAfter = [];
  chats.forEach(function (c) {
    (c.options || []).forEach(function (o, oi) {
      var authoredFx = (auth.chats[c.id] || [])[oi];
      chBefore.push(o.fx || {});
      fixOption(o, authoredFx, c.id + '#' + oi + ' ' + String(o.label).slice(0, 16), 'chats');
      chAfter.push(o.fx);
      /* 旧字段与 fx 保持同源口径 */
      o.affection = o.fx.affection || 0;
      o.mood = o.fx.mood || 0;
    });
  });

  /* ---- 报告 ---- */
  var sb = scan(evBefore), sa = scan(evAfter);
  var cb = scan(chBefore), ca = scan(chAfter);

  console.log('=== 结算数值体检（事件）===');
  console.log('  选项数        ' + sb.options);
  console.log('  影响项总数    ' + sb.keys + ' → ' + sa.keys +
    '（平均 ' + (sb.keys / sb.options).toFixed(2) + ' → ' + (sa.keys / sa.options).toFixed(2) + ' 项/选项）');
  console.log('  影响项条数分布  ' + countSummary(sb.byCount) + '\n             → ' + countSummary(sa.byCount));
  console.log('  ' + moneySummary(sb.money) + '\n  → ' + moneySummary(sa.money));
  console.log('  ' + zeroSummary(sa));

  console.log('=== 结算数值体检（聊天）===');
  console.log('  选项数        ' + cb.options);
  console.log('  影响项总数    ' + cb.keys + ' → ' + ca.keys +
    '（平均 ' + (cb.keys / cb.options).toFixed(2) + ' → ' + (ca.keys / ca.options).toFixed(2) + ' 项/选项）');
  console.log('  影响项条数分布  ' + countSummary(cb.byCount) + '\n             → ' + countSummary(ca.byCount));
  console.log('  ' + moneySummary(cb.money) + '\n  → ' + moneySummary(ca.money));
  console.log('  ' + zeroSummary(ca));

  console.log('=== 改动样例 ===');
  console.log('  · 按作者手写意图重算（' + srcCount.authored + ' 条走这条路）');
  samples.authored.forEach(function (s) {
    console.log('    [' + s.family + '] ' + s.label);
    console.log('       ' + s.before + '  →  ' + s.after);
  });
  console.log('  · 直接清洗现有种子值（' + srcCount.cleaned + ' 条走这条路）');
  samples.cleaned.forEach(function (s) {
    console.log('    [' + s.family + '] ' + s.label);
    console.log('       ' + s.before + '  →  ' + s.after);
  });

  var emptyCnt = emptyAfter.length;
  console.log('=== 复算后「没有任何数值影响」的选项：' + emptyCnt + ' 条' +
    '（纯剧情选择，结算面板不再硬凑数值）===');
  emptyAfter.slice(0, 6).forEach(function (s) { console.log('  ' + s); });

  if (DRY) { console.log('\n--dry：未写文件。'); return; }

  fs.writeFileSync(path.join(SEED_DIR, 'events.js'), toModule('events', events, true), 'utf8');
  fs.writeFileSync(path.join(SEED_DIR, 'chats.js'), toModule('chats', chats, true), 'utf8');
  fs.writeFileSync(path.join(EXPORT_DIR, 'events.json'), JSON.stringify(events, null, 2), 'utf8');
  fs.writeFileSync(path.join(EXPORT_DIR, 'chats.json'), JSON.stringify(chats, null, 2), 'utf8');
  console.log('\n已写入 db/seed/events.js、db/seed/chats.js、db/export/{events,chats}.json');
  console.log('下一步：node db/import.js 刷新云导入文件。');
}

main();

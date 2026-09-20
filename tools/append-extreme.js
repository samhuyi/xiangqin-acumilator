/* =========================================================
 * 把作者源里新写的极端事件 / 聊天补进 db/seed（tools/append-extreme.js）
 * ---------------------------------------------------------
 * 为什么需要这个脚本：
 *   db/seed/events.js、db/seed/chats.js 是 tools/gen-seed.js 的产物，
 *   而 gen-seed 的参考项目目录（workbuddy/.../xiangqin-simulator）已经不在
 *   这台机器上，整体重跑不了。
 *   所以新增内容走「作者源（tools/seed-more-events.js / seed-more-chats.js）
 *   → 本脚本按 gen-seed 同一套结构补进 db/seed → rebalance-fx 复算数值」。
 *
 * 本脚本只负责「组装 + 追加」，不负责数值：追加进去的 fx 就是作者意图原值，
 * 复算（×FX_AMP、阈值过滤、最多 3 项、保留 fx.zero）交给
 * tools/rebalance-fx.js —— 与既有 348 条事件的最终数值同一条流水线。
 *
 * 运行： node tools/append-extreme.js       # 追加缺失条目
 *        node tools/rebalance-fx.js         # 复算数值（必跑）
 *        node db/import.js                  # 刷新云导入文件（必跑）
 * 幂等：按 id 去重，已存在的条目不会重复追加、也不会被改写。
 * ========================================================= */

'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var SEED = path.join(ROOT, 'db', 'seed');

var MORE_EVENTS = require('./seed-more-events.js');
var MORE_CHATS = require('./seed-more-chats.js');

/* --refresh：连已存在的条目也用作者源覆盖一遍（作者源改了内容时用） */
var REFRESH = process.argv.indexOf('--refresh') >= 0;

function toModule(data) {
  return '/* 自动生成，请勿手改。来源：tools/gen-seed.js；数值经 tools/rebalance-fx.js 复算 */\n' +
    'module.exports = ' + JSON.stringify(data, null, 2) + ';\n';
}
function clone(o) { return JSON.parse(JSON.stringify(o)); }

/* 与 gen-seed 的 buildEvents 同结构（stage 允许作者直接指定） */
function buildEvent(e) {
  return {
    id: e.id,
    phase: e.phase,
    stage: e.stage || null,
    dateType: e.dateType || null,
    weight: typeof e.weight === 'number' ? e.weight : 10,
    days: typeof e.days === 'number' ? e.days : null,
    text: e.text.slice(),
    options: (e.options || []).map(function (o) {
      return {
        label: o.label,
        fx: clone(o.fx || {}),
        result: o.result || '',
        breakup: !!o.breakup
      };
    })
  };
}

/* 与 gen-seed 的 buildChats 同结构 */
function buildChat(c) {
  return {
    id: c.id,
    kind: c.kind || 'normal',
    personalityId: c.personalityId || null,
    phases: (c.phases || []).concat(['lead', 'meeting']).filter(function (p, i, a) {
      return a.indexOf(p) === i;
    }),
    minAffection: c.minAffection || 0,
    weight: typeof c.weight === 'number' ? c.weight : 8,
    opener: (c.opener || []).slice(),
    options: (c.options || []).map(function (o) {
      var fx = clone(o.fx || { affection: o.affection || 0, mood: o.mood || 0 });
      return {
        label: o.label,
        reply: o.reply,
        fx: fx,
        affection: fx.affection || 0,
        mood: fx.mood || 0,
        correct: !!o.correct
      };
    })
  };
}

function append(kind, file, authors, build) {
  var data = JSON.parse(JSON.stringify(require(path.join(SEED, file))));
  var have = {};
  data.forEach(function (x) { have[x.id] = true; });

  var added = [], refreshed = [];
  authors.forEach(function (a) {
    if (have[a.id]) {
      /* 默认幂等：已存在就原样留着。
       * 但作者源改了内容（比如把一条聊天的选项调平）时需要能覆盖，
       * 所以给一个显式的 --refresh —— 只有作者源里列出的 id 会被重写，
       * 其余条目一个字节都不动。 */
      if (!REFRESH) return;
      var i = data.map(function (x) { return x.id; }).indexOf(a.id);
      data[i] = build(a);
      refreshed.push(a.id);
      return;
    }
    data.push(build(a));
    have[a.id] = true;
    added.push(a.id);
  });

  if (added.length || refreshed.length) fs.writeFileSync(path.join(SEED, file), toModule(data), 'utf8');

  console.log('  ' + kind.padEnd(8) + '作者源 ' + String(authors.length).padStart(3) +
    ' 条 | 种子 ' + String(data.length).padStart(3) + ' 条 | 本次新增 ' + added.length +
    ' 条 | 覆盖 ' + refreshed.length + ' 条');
  if (added.length) console.log('    新增：' + added.join(', '));
  if (refreshed.length) console.log('    覆盖：' + refreshed.join(', '));
  return added.length + refreshed.length;
}

function main() {
  console.log('=== 追加极端事件 / 聊天到 db/seed ===');
  var a = append('events', 'events.js', MORE_EVENTS, buildEvent);
  var b = append('chats', 'chats.js', MORE_CHATS, buildChat);

  if (!a && !b) {
    console.log('\n没有缺失条目（幂等，无改动）。');
    return;
  }
  console.log('\n下一步：node tools/rebalance-fx.js  →  node db/import.js');
}

main();

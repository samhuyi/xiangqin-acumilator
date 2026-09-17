/* =========================================================
 * 数据库种子导入脚本
 * ---------------------------------------------------------
 * 把 db/seed 里的数据转成「微信云开发数据库」可导入的文件。
 *
 * 云开发控制台仅支持 .json / .csv，且 JSON 必须是严格的 JSON Lines：
 *   · 每行一个完整对象，行之间用 \n 分隔（不是数组、行尾无逗号）
 *   · 文件末尾不能有多余空行
 *   · UTF-8 无 BOM
 * 本脚本按上述要求输出，并在生成后做 _id 唯一性 / 键名合法性校验。
 *
 * 运行： node db/import.js
 * ========================================================= */

'use strict';

var fs = require('fs');
var path = require('path');
var schema = require('../js/db/schema.js');
var seed = require('./seed/index.js');

var OUT = path.join(__dirname, 'export', 'import');
var EXT = '.json';        // 云开发控制台只认 .json / .csv

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

/* 把一条记录转成带 _id 的云文档 */
function toDocs(name) {
  var shape = schema.shapeOf(name);
  var data = seed[name];

  if (shape === 'array') {
    return data.map(function (item) {
      var doc = JSON.parse(JSON.stringify(item));
      doc._id = String(item.id != null ? item.id : doc._id);
      return doc;
    });
  }
  if (shape === 'object') {
    var doc = JSON.parse(JSON.stringify(data));
    doc._id = name;      // constants / materials 各自单条
    return [doc];
  }
  if (shape === 'map') {
    return data.map(function (item) {
      return { _id: String(item.id), value: item.value };
    });
  }
  return [];
}

/* 校验：_id 唯一 + 键名不含首尾「.」或连续「..」 */
function validate(docs) {
  var issues = [];
  var seen = {};
  docs.forEach(function (d, i) {
    if (d._id === undefined || d._id === null || d._id === '') {
      issues.push('第 ' + (i + 1) + ' 条缺少 _id');
    } else if (seen[d._id]) {
      issues.push('_id 重复：' + d._id);
    }
    seen[d._id] = true;
  });

  var badKeys = [];
  function scan(o, prefix) {
    if (!o || typeof o !== 'object') return;
    Object.keys(o).forEach(function (k) {
      if (/^\./.test(k) || /\.$/.test(k) || /\.\./.test(k)) badKeys.push(prefix + k);
      var v = o[k];
      if (v && typeof v === 'object') scan(v, prefix + k + '.');
    });
  }
  docs.forEach(function (d) { scan(d, ''); });
  if (badKeys.length) {
    issues.push('非法键名（首尾或连续 "."）：' + badKeys.slice(0, 5).join('、'));
  }
  return issues;
}

/* 严格 JSON Lines：行间 \n，末尾不留空行 */
function writeLines(file, docs) {
  var lines = docs.map(function (d) { return JSON.stringify(d); }).join('\n');
  fs.writeFileSync(file, lines, 'utf8');
}

function main() {
  ensureDir(OUT);

  // 清理旧格式文件，避免误传
  fs.readdirSync(OUT).forEach(function (f) {
    if (/\.jsonl$/.test(f)) fs.unlinkSync(path.join(OUT, f));
  });

  var manifest = [];
  var allIssues = [];

  schema.COLLECTIONS.forEach(function (c) {
    var docs = toDocs(c.name);
    var issues = validate(docs);
    if (issues.length) allIssues.push(c.name + '：' + issues.join('；'));

    var file = path.join(OUT, c.name + EXT);
    writeLines(file, docs);
    manifest.push({
      collection: c.name, count: docs.length,
      file: 'db/export/import/' + c.name + EXT,
      size: (fs.statSync(file).size / 1024).toFixed(1) + 'KB'
    });
  });

  // events 额外产出 2 条小样本，便于先用最小文件验证导入通道
  writeLines(path.join(OUT, '_test_events_2' + EXT), toDocs('events').slice(0, 2));

  console.log('已生成云导入文件（严格 JSON Lines，无末尾空行，UTF-8 无 BOM）：');
  manifest.forEach(function (m) {
    console.log('  ' + m.collection.padEnd(14) + String(m.count).padStart(3) + ' 条  ' +
      m.size.padStart(7) + '  →  ' + m.file);
  });

  if (allIssues.length) {
    console.log('\n⚠️ 数据校验发现问题：');
    allIssues.forEach(function (s) { console.log('  - ' + s); });
  } else {
    console.log('\n✓ 数据校验通过：_id 全部唯一，无非法键名');
  }

  console.log('\n导入步骤：');
  console.log('  1. 先用最小样本试通道：把 _test_events_2' + EXT + ' 导入 events 集合');
  console.log('     （只有 2 条，成功了再导完整的 events' + EXT + '）');
  console.log('  2. 云开发控制台 → 数据库 → 建集合：' + schema.COLLECTION_NAMES.join('、'));
  console.log('  3. 逐个集合点「导入」，选对应 ' + EXT + ' 文件：');
  console.log('       · 首次导入（集合为空）→ 冲突处理选 Insert');
  console.log('       · 更新已有数据（改数值/文案后）→ 冲突处理选 Upsert/覆盖，否则已有 _id 会被跳过、改了不生效');
  console.log('  4. 权限设为「所有用户可读」（否则客户端读不到）');
  console.log('\n注意：不要传 .jsonl —— 云开发控制台只支持 .json / .csv。');
}

main();

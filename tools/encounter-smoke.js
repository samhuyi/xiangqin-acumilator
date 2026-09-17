/* =========================================================
 * 偶遇链路冒烟测试
 * ---------------------------------------------------------
 * 「其余安排」（生活 / 提升 / 休息 / 加班）有小概率认识一个可接触对象。
 * 本测试把对应概率常量临时设为 1，验证：
 *   1. 四条行动都能把人写进 S.lead，并返回说明结构
 *   2. s.lead 已存在 / 非单身时不再触发（不覆盖已有对象）
 *   3. 渲染层结算页能把偶遇卡片画出来（含姓名、职业、后续提示）
 *
 * 运行： node tools/encounter-smoke.js
 * ========================================================= */

'use strict';

var hm = require('./helpers/cloud-mock.js');
var cm = require('./helpers/canvas-mock.js');

/* 渲染层在 require 时就会抓取 canvas 上下文，
 * 因此必须先把 wx / Canvas 环境装好，再引入 render。 */
cm.installCloudFixture();
var restoreRaf = cm.installSyncRaf();

var DB = require('../js/db/repository.js');
var engine = require('../js/core/engine.js');

var ACTIONS = ['life', 'improve', 'rest', 'overtime'];
var fails = 0;
function assert(cond, msg) {
  if (cond) { console.log('  ✓ ' + msg); }
  else { console.log('  ✗ ' + msg); fails++; }
}

DB.load({ cloud: { env: 'cloud1-d7gwcey64cad30d91' } }).then(function (r) {
  if (r.source !== 'network') throw new Error('云端数据未就绪：' + JSON.stringify(r.problems));

  var C = DB.constants();
  var backup = {};
  ACTIONS.forEach(function (a) {
    var k = 'ENCOUNTER_' + a.toUpperCase();
    backup[k] = C[k];
    C[k] = 1;              // 命中率 100%，便于确定性验证
  });
  C.ENCOUNTER_ACTIONS = ACTIONS.join(',');

  console.log('--- 一、四条「其余安排」都能偶遇 ---');
  ACTIONS.forEach(function (act) {
    var S = engine.createGame({ gender: '男', bgId: 'xiaozhen', goalId: 'marry', diffId: 'normal' });
    /* createGame 可能已给 lead，先清空以模拟纯粹的单身状态 */
    S.lead = null;
    S.partner = null;
    S.relationship = 'single';
    var ec = engine.tryChanceEncounter(S, act);
    assert(!!ec, act + ' 命中了偶遇');
    if (!ec) return;
    assert(!!S.lead, act + ' 把人写进了 lead（可在「赴约初遇」约出来）');
    assert(S.lead && !!S.lead.name, act + ' 对象有姓名：' + (S.lead && S.lead.name));
    assert(typeof ec.title === 'string' && ec.title.length > 0, act + ' 返回了标题：' + ec.title);
    assert(ec.lines && ec.lines.length > 0, act + ' 返回了说明文案（' + (ec.lines || []).length + ' 行）');
    assert(!!ec.tail, act + ' 返回了「后续怎么接触」的提示');
    assert(ec.intro !== DB.text('narratives').encounter_intro || act === 'life',
      act + ' 使用了该行动专属的开场白');
  });

  console.log('--- 二、不该触发的情况一律不触发 ---');
  var S2 = engine.createGame({ gender: '男', bgId: 'xiaozhen', goalId: 'marry', diffId: 'normal' });
  S2.relationship = 'single'; S2.partner = null;
  S2.lead = { name: '已有对象', job: '老师', gender: '女' };
  assert(engine.tryChanceEncounter(S2, 'life') === null, '已有待接触对象时不再刷新（不覆盖 lead）');

  var S3 = engine.createGame({ gender: '男', bgId: 'xiaozhen', goalId: 'marry', diffId: 'normal' });
  S3.relationship = 'talking'; S3.lead = null;
  assert(engine.tryChanceEncounter(S3, 'life') === null, '非单身状态不触发偶遇');

  console.log('--- 三、行动白名单可配置 ---');
  assert(engine.canEncounter('life') === true, 'life 在白名单内');
  C.ENCOUNTER_ACTIONS = 'life';
  assert(engine.canEncounter('overtime') === false, '把 overtime 移出白名单后即失效');
  C.ENCOUNTER_ACTIONS = ACTIONS.join(',');

  console.log('--- 四、其余安排—— 事件 完成后结算页出现偶遇卡片 ---');
  var render = require('../js/ui/render.js');
  if (typeof render.actRest !== 'function') { assert(false, '渲染层未导出 actRest'); }
  else {
    render.start(cm.makeCanvas());   // 初始化画布（内部会读 wx 系统信息）
    render.startSetup();
    render.setGender('m');
    render.setBg((DB.list('backgrounds')[0] || {}).id);
    render.setGoal((DB.list('goals')[0] || {}).id);
    render.setDifficulty('normal');
    render.beginGame();
    var S4 = render._state().S;
    /* 保证进入「休息一天」这条其余安排路径 */
    S4.lead = null; S4.partner = null; S4.relationship = 'single';
    S4.health = 80; S4.mood = 70;
    render.actRest();
    var t = render._state().today;
    var res = t && t.result;
    assert(!!res, '「休息一天」走完并产出了结算');
    assert(t.action === 'rest', '本次行动被记录为 rest（偶遇才能按行动取概率）');
    assert(!!(res && res.encounter), '结算里带上了偶遇信息（100% 概率下必然有）');
    assert(!!(res && res.encounter && res.encounter.partner), '偶遇卡片带对象数据（可画头像）');
    if (res && res.encounter) {
      var who = res.encounter.partner;
      console.log('    偶遇对象：' + who.name + ' · ' + who.job + ' · 后续：' + res.encounter.tail);
    }
    assert(S4.lead === (res.encounter && res.encounter.partner), '偶遇对象已写入 lead，可去「赴约初遇」约');
    assert((res.lines || []).some(function (l) { return l.indexOf('意外认识') >= 0; }),
      '结算正文里带上了偶遇标题，玩家能读到说明');
  }

  /* 恢复常量 */
  ACTIONS.forEach(function (a) {
    var k = 'ENCOUNTER_' + a.toUpperCase();
    if (backup[k] === undefined) delete C[k]; else C[k] = backup[k];
  });

  console.log(fails ? ('ENCOUNTER SMOKE FAILED（' + fails + ' 项）') : 'ENCOUNTER SMOKE OK');
  process.exit(fails ? 1 : 0);
}).catch(function (e) {
  console.error(e);
  process.exit(1);
});

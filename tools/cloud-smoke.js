/* =========================================================
 * 云数据源链路验证（Node 环境，模拟 wx.cloud）
 * ---------------------------------------------------------
 * 用 db/export/import/*.json（即准备导入云端的内容）mock 云开发数据库，
 * 验证 wx.cloud.init → 分页拉取 → 归一化 → 写缓存 全链路；
 * 并验证云端数据为空 / 残缺时【不再回退内置种子】，而是明确返回
 * source=error + 问题清单，方便排查云端数据哪里有问题。
 *
 * 运行： node tools/cloud-smoke.js
 * ========================================================= */

'use strict';

var hm = require('./helpers/cloud-mock.js');

var ENV_ID = 'cloud1-d7gwcey64cad30d91';

function assert(cond, msg) {
  if (!cond) throw new Error('断言失败: ' + msg);
  console.log('  ✓ ' + msg);
}

function main() {
  var fixture = hm.loadCloudFixture();
  var storage = {};
  hm.installCloudWx(function (name) { return fixture[name]; }, storage);

  console.log('环境 ID：' + ENV_ID);
  console.log('--- 场景一：云端数据就绪 ---');

  var DB1 = hm.freshRepository();
  DB1.load({ cloud: { env: ENV_ID } }).then(function (r) {
    assert(r.source === 'network', '数据源为云数据库（source=network）');
    assert(global.wx.cloud._opt && global.wx.cloud._opt.env === ENV_ID, 'wx.cloud.init 已传入环境 ID');
    assert(DB1.list('events').length === fixture.events.length && fixture.events.length > 20,
      'events 拉取 ' + fixture.events.length + ' 条（超单页 20，分页生效）');
    assert(DB1.list('channels').length === 5, 'channels 拉取 5 条（含新增免费渠道）');
    var seedChats = require('../db/seed/chats.js');
    assert(DB1.list('chats').length === seedChats.length,
      'chats 拉取 ' + seedChats.length + ' 条（微信闲聊剧情，含灵魂拷问 / 暧昧 / 固定剧情，新增集合）');
    assert(DB1.list('chats').some(function (c) { return c.personalityId; }),
      'chats 带 personalityId 字段（刁钻 / 暧昧事件按对象性格投放）');
    assert(DB1.list('backgrounds').every(function (b) { return !!b.avatar; }),
      'backgrounds 带 avatar 字段（头像来自数据库）');
    assert(((DB1.get('materials') || {}).jobs || []).every(function (j) { return !!j.avatar; }),
      'materials.jobs 带 avatar 字段（头像来自数据库）');
    assert(DB1.num('RANDOM_EVENT_CHANCE') !== undefined, 'constants（object 形状）归一化后可读取');
    assert(!!DB1.text('play'), 'texts（map 形状）归一化后可读取');
    assert(!!storage['xq_db_cache'], '云数据已写入本地缓存，下次秒开');

    console.log('--- 场景二：云端集合为空（未导入 / 权限不足） ---');
    var storage2 = {};
    hm.installCloudWx(function () { return []; }, storage2);
    var DB2 = hm.freshRepository();
    return DB2.load({ cloud: { env: ENV_ID } }).then(function (r2) {
      assert(r2.source === 'error', '云端全空 → source=error（不再回退内置种子）');
      assert(r2.problems.length >= 14, '问题清单列出全部 14 个空集合（实际 ' + r2.problems.length + ' 条）');
      assert(r2.problems.some(function (p) { return p.indexOf('events') >= 0; }), '问题清单明确指出 events 为空');

      console.log('--- 场景三：部分集合为空（残缺数据） ---');
      var storage3 = {};
      hm.installCloudWx(function (name) {
        // date_types / texts 为空，模拟「导入了部分集合」
        return (name === 'date_types' || name === 'texts') ? [] : fixture[name];
      }, storage3);
      var DB3 = hm.freshRepository();
      return DB3.load({ cloud: { env: ENV_ID } }).then(function (r3) {
        assert(r3.source === 'error', '残缺数据 → source=error（不做部分加载）');
        assert(r3.problems.some(function (p) { return p.indexOf('date_types') >= 0; }), '问题清单明确指出 date_types 为空');
        assert(r3.problems.some(function (p) { return p.indexOf('texts') >= 0; }), '问题清单明确指出 texts 为空');
      });
    });
  }).then(function () {
    console.log('CLOUD SMOKE OK');
  }).catch(function (e) {
    console.error('  ✗ ' + (e && e.message));
    process.exit(1);
  });
}

main();

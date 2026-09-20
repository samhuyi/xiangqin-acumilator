/* =========================================================
 * 《相亲模拟器》启动入口（主逻辑编排）
 * ---------------------------------------------------------
 * 流程：
 *   1. 先初始化渲染层（显示「正在载入」）
 *   2. 从微信云开发数据库加载全部游戏数据（唯一数据源）
 *   3. 数据就绪后进入开场播片；数据有问题则显示错误页 + 问题清单
 * ========================================================= */

'use strict';

var DB = require('./db/repository.js');
var render = require('./ui/render.js');
var audio = require('./audio.js');

/**
 * 启动游戏。
 * @param {object} canvas 主画布（wx.createCanvas()）
 * @param {object} config 可选配置：
 *   - config.cloud = { env }  微信云开发环境 ID（缺省用默认环境）
 */
function start(canvas, config) {
  config = config || {};
  render.start(canvas);
  audio.bindLifecycle();   // 切后台暂停 BGM / 回前台恢复
  DB.load(config).then(function (r) {
    // 数据源一目了然：network=云数据库 / cache=本地缓存 / error=加载失败
    var src = (r && r.source) || '未知';
    console.log('[相亲模拟器] 数据源：' + src);

    if (src === 'error') {
      var plist = (r && r.problems) || [];
      console.error('[相亲模拟器] 云端数据存在问题，请到云开发控制台排查：');
      plist.forEach(function (p) { console.error('  - ' + p); });
      render.showError(plist);
      return;
    }

    var st = DB.stats();
    var parts = Object.keys(st).map(function (k) { return k + '=' + st[k]; });
    console.log('[相亲模拟器] 集合条数：' + parts.join('  '));
    /* 广告位 ID 在云端 constants（AD_UNIT_ID），数据到位了才能告诉广告模块 */
    render.initAd();
    render.goIntro();
  });
}

module.exports = {
  start: start
};

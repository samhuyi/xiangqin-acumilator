/* =========================================================
 * Provider：微信云开发数据库（wx.cloud.database）
 * ---------------------------------------------------------
 * 唯一正式数据源。要求：
 *   1. 用小游戏 AppID 开通云开发环境（微信开发者工具「云开发」）
 *   2. 运行 `node db/import.js` 生成 db/export/import/*.json
 *   3. 在云控制台创建 13 个集合并导入对应 .json（详见 docs/云开发接入.md）
 *   4. 集合权限设为「所有用户可读」，并在 game.js 填入 CLOUD_ENV_ID
 * ========================================================= */

'use strict';

var schema = require('./schema.js');

// 小程序端单次 get 上限：客户端默认且最大 20 条（云函数端才是 100/1000）。
// 这里必须按客户端上限分页，否则 limit 被截断、分页判断失效，只能拿到前 20 条。
var LIMIT = 20;

function available() {
  return typeof wx !== 'undefined' && wx.cloud && typeof wx.cloud.database === 'function';
}

function init(config) {
  if (wx.cloud._xqInited) return;
  var opt = { traceUser: true };
  if (config && config.env) opt.env = config.env;
  console.log('[云开发] 初始化，环境：' + (opt.env || '默认环境'));
  wx.cloud.init(opt);
  wx.cloud._xqInited = true;
}

/* 单集合拉取：任何异常（未建集合 / 权限不足 / 环境不匹配）都不 reject，
   而是把真实错误信息记录下来，随结果返回给 repository 统一排查报告。
   这样能一次性把 13 个集合各自的问题都列清楚。 */
function fetchCollection(db, name) {
  return new Promise(function (resolve) {
    var all = [];
    var error = null;
    function page(skip) {
      db.collection(name).skip(skip).limit(LIMIT).get().then(function (res) {
        all = all.concat(res.data || []);
        // 用 >= 判断：拿满一页说明可能还有下一页
        if (res.data && res.data.length >= LIMIT) {
          page(skip + LIMIT);
        } else {
          resolve({ name: name, docs: all, error: error });
        }
      }).catch(function (err) {
        error = (err && (err.errMsg || err.message)) || String(err);
        console.warn('[云开发] 集合 ' + name + ' 读取失败：' + error);
        resolve({ name: name, docs: all, error: error });
      });
    }
    page(0);
  });
}

function fetchAll(config) {
  init(config);
  var db = wx.cloud.database();
  var jobs = schema.COLLECTIONS.map(function (c) {
    return fetchCollection(db, c.name);
  });
  return Promise.all(jobs).then(function (results) {
    var collections = {};
    var errors = {};
    var empty = [];
    results.forEach(function (r) {
      collections[r.name] = r.docs;
      if (r.error) {
        errors[r.name] = r.error;
      } else if (!r.docs.length) {
        empty.push(r.name);
      }
    });
    if (empty.length) {
      console.warn('[云开发] 以下集合为空，请确认已导入数据：' + empty.join('、'));
    }
    return { collections: collections, errors: errors };
  });
}

module.exports = {
  name: 'cloud',
  available: available,
  fetchAll: fetchAll
};

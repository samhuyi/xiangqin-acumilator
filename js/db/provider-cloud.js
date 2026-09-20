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
// 单页失败重试：真机上偶发 db.collection() 返回 undefined / 网络抖动，
// 重试时重新 wx.cloud.database() 取句柄，最多 2 次。
var MAX_RETRY = 2;
var RETRY_DELAY = 500;

function available() {
  return typeof wx !== 'undefined' && wx.cloud && typeof wx.cloud.database === 'function';
}

function makeDb(config) {
  return wx.cloud.database();
}

function init(config) {
  if (wx.cloud._xqInited) return;
  var opt = { traceUser: true };
  if (config && config.env) opt.env = config.env;
  console.log('[云开发] 初始化，环境：' + (opt.env || '默认环境'));
  wx.cloud.init(opt);
  wx.cloud._xqInited = true;
}

/* 单页拉取：永不 reject、永不向外抛同步异常。
   真机上偶发「Cannot read properties of undefined (reading 'skip')」——
   即 db.collection() 返回了 undefined（多发生在翻第二页的递归调用里）。
   这里统一防御：
   1. collection 引用异常 / get 失败都算本页失败，走重试；
   2. 重试时重新获取 database 句柄；
   3. 重试耗尽才报错，错误信息带集合名 + skip 偏移，方便定位是第几页。 */
function fetchPage(getDb, name, skip) {
  return new Promise(function (resolve) {
    var n = 0;
    function attempt() {
      var col = null;
      try {
        var db = getDb();
        col = db.collection(name);
        if (!col || typeof col.skip !== 'function') {
          throw new Error('db.collection("' + name + '") 返回异常引用（' +
            (col === undefined ? 'undefined' : typeof col) + '）');
        }
        col.skip(skip).limit(LIMIT).get().then(function (res) {
          resolve({ docs: (res && res.data) || [], error: null });
        }).catch(function (err) {
          fail(err);
        });
      } catch (e) {
        fail(e);
      }
    }
    function fail(err) {
      var msg = (err && (err.errMsg || err.message)) || String(err);
      n += 1;
      if (n <= MAX_RETRY) {
        setTimeout(attempt, RETRY_DELAY);
      } else {
        resolve({ docs: null, error: 'skip=' + skip + ' 页读取失败（已重试 ' + MAX_RETRY + ' 次）：' + msg });
      }
    }
    attempt();
  });
}

/* 单集合拉取：任何异常（未建集合 / 权限不足 / 环境不匹配）都不 reject，
   而是把真实错误信息记录下来，随结果返回给 repository 统一排查报告。
   这样能一次性把 13 个集合各自的问题都列清楚。
   注意：翻页中途某页失败时，保留已拉到的页 + 记录错误，不再整单丢弃。 */
function fetchCollection(getDb, name) {
  return new Promise(function (resolve) {
    var all = [];
    var error = null;
    function page(skip) {
      fetchPage(getDb, name, skip).then(function (r) {
        if (r.error) {
          // 翻页中途失败：记录错误并带已拉到的数据返回（让问题清单更精确）
          error = error || r.error;
          resolve({ name: name, docs: all, error: error });
          return;
        }
        all = all.concat(r.docs);
        // 用 >= 判断：拿满一页说明可能还有下一页
        if (r.docs.length >= LIMIT) {
          page(skip + LIMIT);
        } else {
          resolve({ name: name, docs: all, error: error });
        }
      });
    }
    page(0);
  });
}

function fetchAll(config) {
  init(config);
  var getDb = function () { return makeDb(config); };
  var jobs = schema.COLLECTIONS.map(function (c) {
    return fetchCollection(getDb, c.name);
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

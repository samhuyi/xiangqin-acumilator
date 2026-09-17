/* =========================================================
 * 测试 helper：模拟微信云开发数据库（wx.cloud）
 * ---------------------------------------------------------
 * 用 db/export/import/*.json（即准备导入云端的内容）mock 云数据库，
 * 让 repository 走「云端是唯一数据源」的真实加载链路。
 * 供 cloud-smoke / smoke / ui-smoke 复用。
 * ========================================================= */

'use strict';

var fs = require('fs');
var path = require('path');
var schema = require('../../js/db/schema.js');

var IMPORT_DIR = path.join(__dirname, '..', '..', 'db', 'export', 'import');
var LIMIT = 20;   // 与 js/db/provider-cloud.js 保持一致（小程序端单页上限 20）

/* 读云导入文件，返回 { 集合名: [文档对象, ...] } */
function loadCloudFixture() {
  var data = {};
  schema.COLLECTION_NAMES.forEach(function (name) {
    var p = path.join(IMPORT_DIR, name + '.json');
    if (!fs.existsSync(p)) { data[name] = []; return; }
    var raw = fs.readFileSync(p, 'utf8').trim();
    data[name] = raw ? raw.split('\n').map(function (l) { return JSON.parse(l); }) : [];
  });
  return data;
}

/* 安装 mock wx：按 skip/limit 分页返回数据；附带可注入的 storage */
function installCloudWx(getDocs, storage) {
  storage = storage || {};
  global.wx = {
    cloud: {
      init: function (opt) { global.wx.cloud._opt = opt; },
      database: function () {
        return {
          collection: function (name) {
            var st = { skip: 0, limit: LIMIT };
            var api = {
              skip: function (s) { st.skip = s; return api; },
              limit: function (l) { st.limit = l; return api; },
              get: function () {
                var docs = (getDocs && getDocs(name)) || [];
                return Promise.resolve({ data: docs.slice(st.skip, st.skip + st.limit) });
              }
            };
            return api;
          }
        };
      }
    },
    getStorageSync: function (k) { return storage[k] || ''; },
    setStorageSync: function (k, v) { storage[k] = v; },
    removeStorageSync: function (k) { delete storage[k]; }
  };
  return storage;
}

/* repository 是单例，重复加载前清缓存以模拟冷启动 */
function freshRepository() {
  delete require.cache[require.resolve('../../js/db/repository.js')];
  return require('../../js/db/repository.js');
}

module.exports = {
  loadCloudFixture: loadCloudFixture,
  installCloudWx: installCloudWx,
  freshRepository: freshRepository,
  LIMIT: LIMIT
};

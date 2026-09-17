/* =========================================================
 * 数据仓库（Repository）
 * ---------------------------------------------------------
 * 游戏里「唯一」的数据出口。引擎与渲染层只允许通过本模块取数据，
 * 禁止硬编码任何游戏数值/事件/文案。
 *
 * 数据源：微信云开发数据库（唯一正式数据源）。
 *   - 本地缓存（wx storage）只是云端数据的快照，用于秒开，不作为兜底。
 *   - 云端数据不完整 / 读取失败时，【不再回退内置种子】，而是明确报错
 *     并返回问题清单（source=error），由 main.js 显示到画布，方便排查
 *     云端数据到底哪里有问题。
 * ========================================================= */

'use strict';

var schema = require('./schema.js');
var providerCloud = require('./provider-cloud.js');

var SAVE_KEY = 'xq_db_cache';
var SAVE_VERSION = 1;

var _store = {};       // collection name -> 归一化后的运行时数据
var _loaded = false;
var _lastProblems = []; // 最近一次加载发现的问题清单（供 main.js 读取）

/* ---------------- 归一化 ---------------- */
function strip(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  var out = {};
  Object.keys(doc).forEach(function (k) {
    if (k === '_id' || k === '_openid') return;
    out[k] = doc[k];
  });
  if (out.id === undefined && doc._id) out.id = doc._id;
  return out;
}

function normalize(name, raw) {
  var shape = schema.shapeOf(name);
  if (shape === 'array') {
    var arr = Array.isArray(raw) ? raw : [];
    return arr.map(strip);
  }
  if (shape === 'object') {
    if (Array.isArray(raw)) return strip(raw[0] || {});
    return raw || {};
  }
  if (shape === 'map') {
    var list = Array.isArray(raw) ? raw : [];
    var m = {};
    list.forEach(function (item) {
      var id = item.id || item._id;
      if (id) m[id] = item.value;
    });
    return m;
  }
  return raw;
}

function apply(result) {
  var out = {};
  schema.COLLECTIONS.forEach(function (c) {
    out[c.name] = normalize(c.name, result[c.name]);
  });
  _store = out;
  _loaded = true;
  return out;
}

/* ---------------- 缓存 ---------------- */
function readCache() {
  try {
    if (typeof wx === 'undefined' || !wx.getStorageSync) return null;
    var raw = wx.getStorageSync(SAVE_KEY);
    if (!raw) return null;
    var c = JSON.parse(raw);
    if (c && c.v === SAVE_VERSION && c.data) return c.data;
  } catch (e) { /* ignore */ }
  return null;
}

function writeCache(result) {
  try {
    if (typeof wx === 'undefined' || !wx.setStorageSync) return;
    wx.setStorageSync(SAVE_KEY, JSON.stringify({ v: SAVE_VERSION, data: result }));
  } catch (e) { /* ignore */ }
}

function dropCache() {
  try {
    if (typeof wx !== 'undefined' && wx.removeStorageSync) wx.removeStorageSync(SAVE_KEY);
  } catch (e) { /* ignore */ }
}

/* ---------------- 有效性校验（排查云端数据的核心） ---------------- */
// 云开发「未导入」「部分集合权限未开」「字段缺失」都可能让游戏跑不起来。
// 这里统一收集问题清单：
//   - 某集合读取失败（权限不足 / 环境不匹配 / 未建集合）
//   - 某集合为空（未导入）
//   - backgrounds 缺 init、events 缺 options 等关键结构损坏
// 有问题就整体判为「数据不可用」，不再回退，直接暴露给用户。
function problems(result, errors) {
  var list = [];
  errors = errors || {};
  if (!result) return ['无数据'];
  schema.COLLECTIONS.forEach(function (c) {
    var v = result[c.name];
    if (errors[c.name]) {
      list.push(c.name + ' 读取失败：' + errors[c.name]);
    } else if (!v || (Array.isArray(v) && v.length === 0)) {
      list.push(c.name + ' 为空（未导入，或未设「所有用户可读」）');
    }
  });
  var bgs = result.backgrounds;
  if (Array.isArray(bgs)) {
    bgs.forEach(function (b) {
      if (b && !b.init) list.push('backgrounds.' + (b.id || b._id) + ' 缺 init 字段');
    });
  }
  var evs = result.events;
  if (Array.isArray(evs)) {
    var noOpt = 0;
    evs.forEach(function (e) { if (e && !e.options) noOpt++; });
    if (noOpt) list.push('events 有 ' + noOpt + ' 条缺 options 字段');
  }
  return list;
}

/* ---------------- 加载 ---------------- */
// 云端拉取结果统一格式：{ collections: {name: docs[]}, errors: {name: msg} }
function loadCloud(config) {
  return providerCloud.fetchAll(config && config.cloud);
}

function refresh(config) {
  loadCloud(config).then(function (cloud) {
    var plist = problems(cloud.collections, cloud.errors);
    if (!plist.length) {
      apply(cloud.collections);
      writeCache(cloud.collections);
    } else {
      console.warn('[相亲模拟器] 云端数据不完整（沿用当前数据）：\n  - ' + plist.join('\n  - '));
    }
  }).catch(function (e) {
    console.warn('[相亲模拟器] 云端刷新失败（沿用当前数据）：' + ((e && e.message) || e));
  });
}

function load(config) {
  config = config || {};
  return new Promise(function (resolve) {
    // 1) 缓存命中且完整 → 直接用，后台刷新
    var cached = readCache();
    if (cached && !problems(cached).length) {
      apply(cached);
      refresh(config);
      _lastProblems = [];
      resolve({ source: 'cache', problems: [] });
      return;
    }
    // 缓存存在但不完整 → 丢弃（旧版可能存过残缺数据）
    if (cached) {
      dropCache();
      console.warn('[相亲模拟器] 本地缓存数据不完整，已丢弃并重新从云端加载');
    }

    // 2) 云端是唯一数据源
    if (!providerCloud.available()) {
      _lastProblems = ['未检测到云开发（wx.cloud 不可用）。请在微信开发者工具开通云开发，并在 game.js 填入正确的环境 ID'];
      console.error('[相亲模拟器] 数据加载失败：' + _lastProblems[0]);
      resolve({ source: 'error', problems: _lastProblems });
      return;
    }

    loadCloud(config).then(function (cloud) {
      var plist = problems(cloud.collections, cloud.errors);
      if (!plist.length) {
        apply(cloud.collections);
        writeCache(cloud.collections);
        _lastProblems = [];
        resolve({ source: 'network', problems: [] });
      } else {
        _lastProblems = plist;
        console.error('[相亲模拟器] 云端数据不完整，无法启动：\n  - ' + plist.join('\n  - '));
        resolve({ source: 'error', problems: plist });
      }
    }).catch(function (e) {
      _lastProblems = ['云端读取异常：' + ((e && e.message) || e)];
      console.error('[相亲模拟器] 数据加载失败：' + _lastProblems[0]);
      resolve({ source: 'error', problems: _lastProblems });
    });
  });
}

/* ---------------- 同步读取 API（引擎 / 渲染层使用） ---------------- */
function get(name) {
  return _store[name];
}
function list(name) {
  return _store[name] || [];
}
function constants() {
  return _store.constants || {};
}
/** 取数值常量：c('DAILY_HEALTH_DECAY', 0.22) */
function num(key, fallback) {
  var v = _store.constants ? _store.constants[key] : undefined;
  return (v === undefined) ? fallback : v;
}
/** 取文案（来自 texts 集合） */
function text(id) {
  return (_store.texts || {})[id];
}
function ready() {
  return _loaded;
}

/** 各集合当前已加载的条数（启动自检用） */
function stats() {
  var out = {};
  schema.COLLECTIONS.forEach(function (c) {
    var v = _store[c.name];
    out[c.name] = Array.isArray(v)
      ? v.length
      : (v && typeof v === 'object' ? Object.keys(v).length : 0);
  });
  return out;
}

/** 最近一次加载的问题清单（供外部诊断） */
function lastProblems() {
  return _lastProblems.slice();
}

module.exports = {
  load: load,
  ready: ready,
  get: get,
  list: list,
  constants: constants,
  num: num,
  text: text,
  collection: get,
  stats: stats,
  lastProblems: lastProblems
};

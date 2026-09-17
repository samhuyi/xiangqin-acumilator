/* =========================================================
 * Canvas / wx 环境 mock（Node 测试共用）
 * ---------------------------------------------------------
 * 渲染层依赖 wx.createCanvas() 与 Canvas 2D 上下文，
 * 这里提供一个「不会崩、能记录文字」的最小实现，
 * 让 ui-smoke / click-smoke / encounter-smoke 等测试
 * 能在 Node 下真实跑通绘制流程。
 *
 * 用法：
 *   var cm = require('./helpers/canvas-mock.js');
 *   var fixture = cm.installCloudFixture();   // 返回云端夹具
 *   var drawn = cm.drawnTexts;                // 绘制过的文字
 * ========================================================= */

'use strict';

var fs = require('fs');
var nodePath = require('path');
var hm = require('./cloud-mock.js');

var PROJECT_ROOT = nodePath.join(__dirname, '..', '..');
var drawnTexts = [];
/* 每次 fillText 的几何信息：{ text, x, y, size, w }（y 为基线）。
 * 供「文字是否重叠」这类布局回归使用。 */
var textOps = [];

/* 近似真实 Canvas 的宽度模型：
 *   · CJK / 全角字符 ≈ 1.0 × 字号
 *   · ASCII ≈ 0.55 × 字号
 *   · 其它 ≈ 0.8 × 字号
 * 早先用「长度 × 0.6」会低估中文宽度约 40%，导致换行与右对齐在测试里失真。 */
function textWidth(str, size) {
  str = String(str);
  var w = 0;
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c >= 0x2E80) w += size;                 // CJK 及以后的全角区
    else if (c < 0x80) w += size * 0.55;        // ASCII
    else w += size * 0.8;
  }
  return w;
}

/* 记录所有被请求过的图片路径（供美术资源测试断言） */
var requestedImages = [];
var loadSubpackageCalls = [];
var loadSubpackageFail = {};   // packName -> true 表示模拟该分包下载失败
var brokenImages = {};         // path -> true 表示模拟该图加载失败
var drawnImages = [];          // 真正被 ctx.drawImage 画出去的图片 src
var packRoots = {};            // packName -> root 前缀（来自 game.json）
var downloadedPacks = {};      // packName -> true（分包已下完，包内文件才可取）

/* 从 game.json 读分包根目录：任何位于 root 下的路径都算该分包的文件。
 * 真机上分包没下完时这些文件根本不存在 —— 只读盘是不够的，必须显式建模。 */
function loadPackRoots() {
  packRoots = {};
  var p = nodePath.join(PROJECT_ROOT, 'game.json');
  if (!fs.existsSync(p)) return;
  var cfg;
  try { cfg = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return; }
  ((cfg && cfg.subpackages) || []).forEach(function (sp) {
    if (sp && sp.name && sp.root) {
      packRoots[sp.name] = String(sp.root).replace(/\\/g, '/').replace(/\/+$/, '') + '/';
    }
  });
}

/* 该路径属于哪个分包？（主包图返回 null） */
function packOfAsset(v) {
  var vv = String(v).replace(/\\/g, '/');
  var names = Object.keys(packRoots);
  for (var i = 0; i < names.length; i++) {
    if (vv.indexOf(packRoots[names[i]]) === 0) return names[i];
  }
  return null;
}

function makeCtx() {
  var state = { fillStyle: '', strokeStyle: '', font: '', lineWidth: 1, globalAlpha: 1, lineCap: 'butt' };
  var noop = function () {};
  /* save/restore 必须真的生效：渲染层用 save + globalAlpha 做淡出，
   * 若 restore 是空操作，透明度会泄漏到后续所有绘制上。 */
  var stack = [];
  var ctx = {
    scale: noop, translate: noop,
    save: function () { stack.push({ fillStyle: state.fillStyle, strokeStyle: state.strokeStyle, font: state.font, lineWidth: state.lineWidth, globalAlpha: state.globalAlpha, lineCap: state.lineCap }); },
    restore: function () {
      var s = stack.pop();
      if (s) Object.keys(s).forEach(function (k) { state[k] = s[k]; });
    },
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    arc: noop, arcTo: noop, ellipse: noop,
    bezierCurveTo: noop, quadraticCurveTo: noop,
    fill: noop, stroke: noop, fillRect: noop, strokeRect: noop,
    clearRect: noop, clip: noop, rect: noop,
    setLineDash: noop,
    drawImage: function (img) {
      if (img && img._src) drawnImages.push(img._src);
    },
    measureText: function (t) {
      var size = 15;
      var m = /(\d+)px/.exec(state.font);
      if (m) size = +m[1];
      return { width: textWidth(t, size) };
    },
    createLinearGradient: function () { return { addColorStop: noop }; },
    fillText: function (t, x, y) {
      var size = 15;
      var m = /(\d+)px/.exec(state.font);
      if (m) size = +m[1];
      drawnTexts.push(String(t));
      textOps.push({
        text: String(t),
        x: (typeof x === 'number' ? x : 0),
        y: (typeof y === 'number' ? y : 0),
        size: size,
        w: textWidth(t, size)
      });
    }
  };
  ['fillStyle', 'strokeStyle', 'font', 'lineWidth', 'globalAlpha', 'lineCap'].forEach(function (k) {
    Object.defineProperty(ctx, k, { get: function () { return state[k]; }, set: function (v) { state[k] = v; } });
  });
  return ctx;
}

function makeCanvas() {
  var ctx = makeCtx();
  return { width: 0, height: 0, getContext: function () { return ctx; } };
}

/* 从文件头读出图片真实宽高（PNG / JPEG），避免引入第三方依赖 */
function readImageSize(abs) {
  var buf = fs.readFileSync(abs);
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {   // PNG
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf[0] === 0xFF && buf[1] === 0xD8) {                      // JPEG
    var i = 2;
    while (i < buf.length - 1) {
      if (buf[i] !== 0xFF) { i++; continue; }
      var marker = buf[i + 1];
      if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return { w: 0, h: 0 };
}

/* 安装带云端数据库的 global.wx，并返回云端夹具
 * opts.realImages  : true 时 createImage 会真实读盘、触发 onload（默认 false）
 * opts.subpackageFail : ['art_role'] 模拟指定分包下载失败
 * opts.subpackageDelay: 毫秒。模拟真机分包下载耗时（>0 时异步回调 success）。
 *                      真机上分包没下完就取不到图 —— 这是「除了主界面图
 *                      全都加载失败」的复现条件，测试必须覆盖。
 */
function installCloudFixture(opts) {
  opts = opts || {};
  requestedImages.length = 0;
  loadSubpackageCalls.length = 0;
  drawnImages.length = 0;
  loadSubpackageFail = {};
  brokenImages = {};
  downloadedPacks = {};
  (opts.subpackageFail || []).forEach(function (n) { loadSubpackageFail[n] = true; });
  (opts.breakImages || []).forEach(function (p) { brokenImages[p] = true; });
  loadPackRoots();
  /* 只有「模拟下载耗时」时才启用「分包文件未下载即不可取」的建模。
   * 不开时保持旧行为（等价于开发者工具：文件在本地，直接可取），
   * 这样 subpackageFail 那条兜底用例测的仍是「图其实拿得到」的场景。 */
  var gateOnDownload = (opts.subpackageDelay || 0) > 0;
  var storage = {};
  var touchHandlers = {};
  var fixture = hm.loadCloudFixture();
  var canvas = makeCanvas();

  global.wx = {
    getSystemInfoSync: function () {
      return {
        windowWidth: 375, windowHeight: 667, pixelRatio: 2,
        safeArea: { top: 0, bottom: 667, left: 0, right: 375, width: 375, height: 667 }
      };
    },
    onTouchStart: function (fn) { touchHandlers.start = fn; },
    onTouchMove: function (fn) { touchHandlers.move = fn; },
    onTouchEnd: function (fn) { touchHandlers.end = fn; },
    getStorageSync: function (k) { return storage[k] || ''; },
    setStorageSync: function (k, v) { storage[k] = v; },
    removeStorageSync: function (k) { delete storage[k]; },
    createCanvas: function () { return canvas; },
    createImage: function () {
      var img = { width: 0, height: 0, _src: '' };
      Object.defineProperty(img, 'src', {
        get: function () { return this._src; },
        set: function (v) {
          this._src = v;
          requestedImages.push(v);
          if (!opts.realImages) return;           // 默认不触发 onload（保持旧测试行为）
          var self = this;
          var abs = nodePath.join(PROJECT_ROOT, v);
          setTimeout(function () {
            /* 真机语义：分包没下完，包内文件不存在，必然 onerror */
            var pk = gateOnDownload ? packOfAsset(v) : null;
            if (pk && !downloadedPacks[pk]) {
              if (self.onerror) self.onerror({ errMsg: 'subpackage not ready' });
              return;
            }
            if (brokenImages[v] || !fs.existsSync(abs)) {
              if (self.onerror) self.onerror({ errMsg: 'not found' });
              return;
            }
            /* 真实读取图片尺寸，保证 drawCoverImage 的 width/height 断言有效 */
            var dim = readImageSize(abs);
            self.width = dim.w; self.height = dim.h;
            if (self.onload) self.onload();
          }, 0);
        }
      });
      return img;
    },
    loadSubpackage: function (o) {
      var name = o && o.name;
      loadSubpackageCalls.push(name);
      var delay = opts.subpackageDelay || 0;
      var fire = function () {
        if (loadSubpackageFail[name]) {
          if (o && o.fail) o.fail({ errMsg: 'mock: subpackage fail' });
        } else {
          downloadedPacks[name] = true;      // 分包文件此刻才可用
          if (o && o.success) o.success({});
        }
        if (o && o.complete) o.complete({});
      };
      if (delay > 0) setTimeout(fire, delay); else fire();
    },
    cloud: {
      init: function (opt) { global.wx.cloud._opt = opt; },
      database: function () {
        return {
          collection: function (name) {
            var st = { skip: 0, limit: hm.LIMIT };
            var api = {
              skip: function (s) { st.skip = s; return api; },
              limit: function (l) { st.limit = l; return api; },
              get: function () {
                var docs = fixture[name] || [];
                return Promise.resolve({ data: docs.slice(st.skip, st.skip + st.limit) });
              }
            };
            return api;
          }
        };
      }
    }
  };

  return {
    fixture: fixture,
    storage: storage,
    touchHandlers: touchHandlers,
    canvas: canvas,
    tap: function (x, y) {
      var h = touchHandlers.start;
      if (h) h({ touches: [{ clientX: x, clientY: y }] });
    }
  };
}

/* 同步版 rAF，让渲染层的动画循环在测试里立刻结束 */
function installSyncRaf() {
  var prev = global.requestAnimationFrame;
  global.requestAnimationFrame = function (fn) { fn(); };
  return function () { global.requestAnimationFrame = prev; };
}

/* 找出「互相重叠的文字」（同一帧内），返回明细数组。
 * 用于布局回归：文字之间、文字与固定层之间不应压在一起。
 *   ops              文字几何数组（默认用本模块记录的 textOps；
 *                    测试自建 ctx 时可传入自己的数组）
 *   opts.minOverlap  容差（默认 1.5px，避免亚像素接触被误报）
 *   opts.skipTop     忽略基线 y 小于它的文字（默认 0）
 *   opts.skipBottom  忽略基线 y 大于它的文字（默认不限，可用来排除底部操作区）
 */
function findTextOverlaps(ops, opts) {
  if (!Array.isArray(ops)) { opts = ops; ops = textOps; }
  opts = opts || {};
  var min = (opts.minOverlap === undefined) ? 1.5 : opts.minOverlap;
  var skipTop = opts.skipTop || 0;
  var skipBottom = (opts.skipBottom === undefined) ? Infinity : opts.skipBottom;
  var boxes = (ops || []).filter(function (o) {
    if (!String(o.text).trim()) return false;
    if (o.y < skipTop || o.y > skipBottom) return false;
    return true;
  }).map(function (o) {
    return {
      o: o,
      x1: o.x, x2: o.x + o.w,
      y1: o.y - o.size * 0.82, y2: o.y + o.size * 0.22
    };
  });
  var out = [];
  for (var i = 0; i < boxes.length; i++) {
    for (var j = i + 1; j < boxes.length; j++) {
      var a = boxes[i], b = boxes[j];
      var ox = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
      var oy = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
      if (ox > min && oy > min) {
        out.push({
          a: a.o.text, b: b.o.text,
          overlapX: Math.round(ox), overlapY: Math.round(oy),
          aAt: Math.round(a.o.x) + ',' + Math.round(a.o.y),
          bAt: Math.round(b.o.x) + ',' + Math.round(b.o.y)
        });
      }
    }
  }
  return out;
}

module.exports = {
  drawnTexts: drawnTexts,
  textOps: textOps,
  requestedImages: requestedImages,
  loadSubpackageCalls: loadSubpackageCalls,
  drawnImages: drawnImages,
  makeCtx: makeCtx,
  makeCanvas: makeCanvas,
  readImageSize: readImageSize,
  textWidth: textWidth,
  findTextOverlaps: findTextOverlaps,
  installCloudFixture: installCloudFixture,
  installSyncRaf: installSyncRaf
};

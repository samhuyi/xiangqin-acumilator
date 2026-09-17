/* =========================================================
 * 生成美术资源注册表 assets/images/manifest.js
 * ---------------------------------------------------------
 * 扫描 assets/images 下的图片，按「主包 / 按需 / 分包」分类输出：
 *   · main   ：intro_bg（进入游戏就要用，启动即下载）
 *   · lazy   ：行动页 / 结局页的头部背景（首屏用不到，等真正要画了再下）
 *   · 分包 art_role ：职业头像，文件名「职业-性别」→ key 同名（如 programmer-m）
 *   · 分包 art_scene：约会场景，文件名「bg-场景名」→ key 去掉 bg-（如 bg-cafe → cafe）
 *
 * 每次往目录里加/删图后，重跑一次即可：
 *     node tools/gen-art-manifest.js
 *
 * ⚠️ 分包目录必须与 game.json 的 subpackages 保持一致。
 * ⚠️ 图片文件名必须是 ASCII，含中文会直接报错退出（真机加载不到）。
 * ========================================================= */

'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var IMG_DIR = path.join(ROOT, 'assets', 'images');

/* 按需加载的目录：不进启动队列，画到哪张才下哪张。
 *  keyOf 决定 manifest 里的 key（渲染层按 key 取图，不拼文件名 / 后缀）。 */
var LAZY_DIRS = [
  {
    dir: '',
    // 根目录的行动页头部背景：seek_bg_m → 直接同名
    // 另外单张（不分性别）的浮窗背景 bg_seek_fail 也在这组
    keyOf: function (base) { return base; },
    only: /^(seek_bg|upgrade_bg)_|^bg_seek_fail$/
  },
  {
    dir: 'end',
    // end/end_alone_m → key 保留全名 end_alone_m（和 seek_bg_m 同处一个命名空间，不会撞）
    keyOf: function (base) { return base; },
    only: null
  }
];

var PACKS = [
  {
    name: 'art_role',
    dir: 'role',
    // 文件名「职业-性别.png」→ key 用文件名本体
    keyOf: function (base) { return base; }
  },
  {
    name: 'art_scene',
    dir: 'scene',
    // 文件名「bg-场景名.jpg」→ key 去掉 bg- 前缀
    keyOf: function (base) { return /^bg-/.test(base) ? base.slice(3) : base; }
  }
];

var IMG_EXT = /\.(png|jpe?g)$/i;
var MAIN_KEY = { 'intro_bg': 1 };

function listImages(dir) {
  var abs = path.join(IMG_DIR, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter(function (f) { return IMG_EXT.test(f) && f !== 'game.js'; })
    .sort();
}

function rel(dir, file) {
  return 'assets/images/' + (dir ? dir + '/' : '') + file;
}

function main() {
  var out = { main: {}, lazy: {}, packs: {} };

  // 主包：assets/images 根目录下的图片
  fs.readdirSync(IMG_DIR)
    .filter(function (f) { return IMG_EXT.test(f); })
    .sort()
    .forEach(function (f) {
      var base = f.replace(IMG_EXT, '');
      if (MAIN_KEY[base] || base === 'intro_bg') {
        out.main[base] = 'assets/images/' + f;
      }
    });

  // 按需加载（不进启动队列）
  LAZY_DIRS.forEach(function (d) {
    listImages(d.dir).forEach(function (f) {
      var base = f.replace(IMG_EXT, '');
      if (d.only && !d.only.test(base)) return;
      out.lazy[d.keyOf(base)] = rel(d.dir, f);
    });
  });

  // 分包
  PACKS.forEach(function (p) {
    var files = listImages(p.dir);
    var images = {};
    files.forEach(function (f) {
      var base = f.replace(IMG_EXT, '');
      images[p.keyOf(base)] = rel(p.dir, f);
    });
    out.packs[p.name] = {
      root: 'assets/images/' + p.dir,
      count: files.length,
      images: images
    };
  });

  /* 文件名必须 ASCII：中文文件名在打包 / 真机取图时可能因编码不一致而失败，
   * 表现为「图片全都不显示」。这里直接拦下来，避免又踩一次。 */
  var bad = [];
  ['', 'role', 'scene'].concat(LAZY_DIRS.map(function (d) { return d.dir; })).forEach(function (dir) {
    var abs = dir ? path.join(IMG_DIR, dir) : IMG_DIR;
    if (!fs.existsSync(abs)) return;
    fs.readdirSync(abs).forEach(function (f) {
      if (!IMG_EXT.test(f)) return;
      if (/[^\x00-\x7F]/.test(f)) bad.push((dir ? dir + '/' : '') + f);
    });
  });
  if (bad.length) {
    console.error('✗ 图片文件名含非 ASCII 字符（中文 / 全角），请改成英文：');
    bad.forEach(function (f) { console.error('    ' + f); });
    console.error('  中文文件名可能导致真机加载不到图片。');
    process.exit(1);
  }

  var header = [
    '/* =========================================================',
    ' * 美术资源注册表（由 tools/gen-art-manifest.js 自动生成，请勿手改）',
    ' * ---------------------------------------------------------',
    ' * main  : 启动即下载（进入游戏马上要用的图）',
    ' * lazy  : 按需下载（行动页 / 结局页的头部背景，画到哪张才下哪张）',
    ' * packs : 分包资源，取图前必须先 wx.loadSubpackage({ name })',
    ' *         路径写「从项目根开始的完整路径」，分包加载完即可取到。',
    ' *',
    ' * 取图请一律走 art.js（art.pageBg / art.endBg / art.roleImg …），',
    ' * 不要在渲染层手拼文件名 —— 压图会把 PNG 转成 JPG，后缀会变。',
    ' *',
    ' * 新增图片：放进对应目录 → 先跑 tools/compress-assets.py 压图 → 再跑本脚本',
    ' * 注意：文件名一律用 ASCII（英文 / 数字 / - _），不要用中文。',
    ' * ========================================================= */',
    '',
    "'use strict';",
    '',
    'module.exports = '
  ].join('\n');

  var body = JSON.stringify(out, null, 2)
    .split('\n')
    .join('\n');
  fs.writeFileSync(path.join(IMG_DIR, 'manifest.js'), header + body + ';\n', 'utf8');

  console.log('已生成 assets/images/manifest.js');
  console.log('  主包（启动即下）:', Object.keys(out.main).join(', ') || '（无）');
  console.log('  按需（用到才下）:', Object.keys(out.lazy).join(', ') || '（无）');
  Object.keys(out.packs).forEach(function (k) {
    console.log('  分包 ' + k + ': ' + out.packs[k].count + ' 张');
  });
}

main();

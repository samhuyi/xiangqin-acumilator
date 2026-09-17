/* =========================================================
 * 美术资源冒烟测试
 * ---------------------------------------------------------
 * 图片「全都不显示」这类问题排查成本极高，所以这里把整条链路锁死：
 *   1. 注册表里的每张图，磁盘上必须真实存在，且文件名是 ASCII
 *   2. 主包图（intro_bg）会被真的加载 —— 历史 bug：它不在分包里，
 *      没人加载它，导致标题页背景一直是纯色
 *   3. 分包下载成功后，全部图片都进内存（stats.loaded === total）
 *   4. 分包下载失败时，按路径直取的兜底路径依然尝试过
 *   5. 【真机核心回归】分包下载慢于重试预算时，图仍要全部加载上。
 *      历史 bug：loadSubpackage 之前就排了分包里的图，真机上必然失败，
 *      重试两次（约 1.5 秒）后被标成 FAILED；真机下载往往更慢，
 *      等分包下完再排时被 FAILED 判断挡掉 —— 表现为「除了主界面图
 *      全都加载失败」。开发者工具里分包是本地文件，永远复现不了。
 *   6. 数据库里的每个出身背景 / 对象职业 / 约会档位 / 事件，
 *      都能映射到一张真实存在的图（或明确「不展示背景」）
 *
 * 运行： node tools/art-smoke.js
 * ========================================================= */

'use strict';

var fs = require('fs');
var nodePath = require('path');
var cm = require('./helpers/canvas-mock.js');

var ROOT = nodePath.join(__dirname, '..');
var fails = 0;
function assert(cond, msg) {
  if (cond) { console.log('  ✓ ' + msg); }
  else { console.log('  ✗ ' + msg); fails++; }
}

/* 先装环境再 require（渲染层会立刻抓 canvas 上下文） */
var env = cm.installCloudFixture({ realImages: true });
var restoreRaf = cm.installSyncRaf();

var DB = require('../js/db/repository.js');
var art = require('../js/ui/art.js');
var MANIFEST = require('../assets/images/manifest.js');
var ROLE_MAP = require('../assets/images/role-map.js');

function allPaths() {
  var out = [];
  Object.keys(MANIFEST.main || {}).forEach(function (k) { out.push(['main/' + k, MANIFEST.main[k]]); });
  Object.keys(MANIFEST.lazy || {}).forEach(function (k) { out.push(['lazy/' + k, MANIFEST.lazy[k]]); });
  Object.keys(MANIFEST.packs || {}).forEach(function (p) {
    var im = MANIFEST.packs[p].images || {};
    Object.keys(im).forEach(function (k) { out.push([p + '/' + k, im[k]]); });
  });
  return out;
}

/* 等按需图（lazy）也全部落定 —— 它们不在 stats().pending 里，单独等一次 */
function settleLazy(cb) {
  var n = 0;
  var t = setInterval(function () {
    var st = art.stats();
    if (++n > 40 || st.lazyLoaded === st.lazyTotal) { clearInterval(t); cb(); }
  }, 15);
}

/* 等所有异步加载（含重试）落定 */
function settle(cb) {
  var n = 0;
  var t = setInterval(function () {
    if (++n > 40) { clearInterval(t); cb(); }
    else if (art.stats().pending === 0) { clearInterval(t); cb(); }
  }, 15);
}

DB.load({ cloud: { env: 'cloud1-d7gwcey64cad30d91' } }).then(function (r) {
  if (r.source !== 'network') throw new Error('云端数据未就绪：' + JSON.stringify(r.problems));

  console.log('--- 一、注册表 vs 磁盘文件 ---');
  var paths = allPaths();
  var totalRegistered = paths.length;
  assert(totalRegistered === Object.keys(MANIFEST.main).length +
    Object.keys(MANIFEST.lazy || {}).length +
    Object.keys(MANIFEST.packs.art_role.images).length +
    Object.keys(MANIFEST.packs.art_scene.images).length,
    '注册表登记图数与 manifest 一致（含按需图），实际 ' + totalRegistered);
  var missing = paths.filter(function (p) { return !fs.existsSync(nodePath.join(ROOT, p[1])); });
  assert(missing.length === 0, '注册表里的图在磁盘上都存在' +
    (missing.length ? '（缺 ' + missing.map(function (m) { return m[1]; }).join(', ') + '）' : ''));
  var nonAscii = paths.filter(function (p) { return /[^\x00-\x7F]/.test(p[1]); });
  assert(nonAscii.length === 0, '所有图片路径都是 ASCII（中文文件名会导致真机加载不到）' +
    (nonAscii.length ? '（非 ASCII：' + nonAscii.map(function (m) { return m[1]; }).join(', ') + '）' : ''));

  console.log('--- 二、主包图必须被加载（历史 bug） ---');
  art.ensureMain();
  settle(function () {
    var ib = art.mainImg('intro_bg');
    assert(!!ib, 'art.mainImg("intro_bg") 拿得到图（标题页背景可绘制）');
    assert(!!(ib && ib.width > 0 && ib.height > 0), 'intro_bg 有真实宽高：' +
      (ib ? ib.width + 'x' + ib.height : '无'));

    console.log('--- 三、分包全量加载 ---');
    art.ensureAll();
    settle(function () {
      var st = art.stats();
      assert(st.packs.art_role === 'ready', 'art_role 分包状态 ready');
      assert(st.packs.art_scene === 'ready', 'art_scene 分包状态 ready');
      assert(st.failed.length === 0, '没有加载失败的图' +
        (st.failed.length ? '（失败 ' + st.failed.length + '：' + st.failed.slice(0, 3).join(', ') + '）' : ''));
      assert(st.loaded === st.total, '全部图片已就绪：' + st.loaded + '/' + st.total);

      console.log('--- 四、数据 → 图片 映射完整性 ---');
      var bgs = DB.list('backgrounds');
      var badBg = bgs.filter(function (b) { return !art.heroImg(b.id, 'm') && !art.heroImg(b.id, 'f'); });
      assert(badBg.length === 0, '全部 ' + bgs.length + ' 个出身背景都能取到主角头像' +
        (badBg.length ? '（缺：' + badBg.map(function (b) { return b.id; }).join(', ') + '）' : ''));

      var mats = DB.text('materials') || DB.get('materials') || {};
    var jobs = (mats.jobs || []).map(function (j) { return j.job; });
    var badJob = jobs.filter(function (j) { return !art.partnerImg(j, 'm') && !art.partnerImg(j, 'f'); });
    assert(jobs.length > 0, '从 materials 读到 ' + jobs.length + ' 个相亲对象职业');
    assert(badJob.length === 0, '全部对象职业至少能取到一个性别的头像（同性图缺失时回退反性别，art.js 会打 warn）' +
      (badJob.length ? '（缺：' + badJob.join(', ') + '）' : ''));

      var dts = DB.list('date_types');
      var badDt = dts.filter(function (t) { return !art.sceneImg(ROLE_MAP.dateTypeScene[t.id]); });
      assert(badDt.length === 0, '全部 ' + dts.length + ' 个约会档位都能映射到场景背景' +
        (badDt.length ? '（缺：' + badDt.map(function (t) { return t.id; }).join(', ') + '）' : ''));

      var events = DB.list('events');
      var resolved = 0, fallbackNoBg = 0, broken = [];
      events.forEach(function (ev) {
        var key = art.sceneNameForEvent(ev, null);
        if (key === null) { fallbackNoBg++; return; }
        if (art.sceneImg(key)) resolved++;
        else broken.push(ev.id + '→' + key);
      });
      assert(broken.length === 0, '事件场景映射全部指向存在的图' +
        (broken.length ? '（断链：' + broken.slice(0, 4).join(', ') + '）' : ''));
      console.log('    事件 ' + events.length + ' 条：命中场景 ' + resolved +
        ' 条，兜底不展示背景 ' + fallbackNoBg + ' 条');

      /* 赴约初遇：没有档位、正文也没关键词时，必须兜底到默认场景，
         否则约会的二级页会是一块空白背景。 */
      var meetEv = {
        id: '__meet_probe__',
        text: ['双方约在某个地方见面。'],
        options: [{ label: '打个招呼' }]
      };
      var meetKey = art.sceneNameForEvent(meetEv, null, 'meet', '');
      assert(!!meetKey, '赴约初遇能兜底到默认场景（action=meet）');
      assert(!!art.sceneImg(meetKey), '赴约初遇兜底场景图真实存在：' + meetKey);

      /* 真正的赴约事件（phase=meeting，走 engine.pickMeetingEvent）也要能取到场景 */
      var meetEvents = DB.list('events').filter(function (ev) { return ev.phase === 'meeting'; });
      assert(meetEvents.length > 0, '事件库里有赴约类事件（phase=meeting），实际 ' + meetEvents.length);
      var missMeet = meetEvents.filter(function (ev) {
        return !art.sceneImg(art.sceneNameForEvent(ev, ev.dateType || null, 'meet', ''));
      });
      assert(missMeet.length === 0, '赴约类事件 ' + meetEvents.length + ' 条都能取到背景图' +
        (missMeet.length ? '（缺：' + missMeet.map(function (e) { return e.id; }).join(', ') + '）' : ''));

      console.log('--- 四之二、错性别回退要打 warn（不能再被静默吞掉） ---');
      /* 用一个肯定缺同性图的方向去取：teacher（库里有 teacher-f，没有 teacher-m）
       * —— roleImg 仍会返回 teacher-f（保证不出 null），但必须打 console.warn
       * 点出缺失的图，方便后续补图。这就是「男教师用了女头像」的告警源头。 */
      var captured = [];
      var origWarn = console.warn;
      console.warn = function () { captured.push(Array.prototype.slice.call(arguments).join(' ')); };
      var fallbackImg = art.roleImg('teacher', 'm');
      console.warn = origWarn;
      assert(!!fallbackImg, '缺同性图时回退到反性别图（仍能渲染，不崩）');
      assert(captured.some(function (s) { return s.indexOf('teacher-m.png') >= 0; }),
        '缺同性图时会打 warn 点名缺失文件，实际 warn：' + JSON.stringify(captured));

      console.log('--- 四之三、按需图（行动页 / 结局页头部背景） ---');
      /* 按需图不进启动队列，这里显式排一次，验证它们真能解码出宽高 */
      art.preloadLazy();
      settleLazy(function () {
        var st2 = art.stats();
        assert(st2.lazyTotal > 0, '注册表里有按需图，实际 ' + st2.lazyTotal + ' 张');
        assert(st2.lazyLoaded === st2.lazyTotal,
          '按需图全部就绪：' + st2.lazyLoaded + '/' + st2.lazyTotal);
        ['seek_bg_m', 'seek_bg_f', 'upgrade_bg_m', 'upgrade_bg_f'].forEach(function (k) {
          var im2 = art.lazyImg(k);
          assert(!!im2 && im2.width > 0, '行动页头部背景 ' + k + ' 可绘制（' +
            (im2 ? im2.width + 'x' + im2.height : '无') + '）');
        });
        ['happymarry', 'badmarry', 'alone'].forEach(function (tp) {
          assert(!!art.endBg(tp, 'm') && !!art.endBg(tp, 'f'),
            '结局头部背景 end_' + tp + '_m / _f 两张都在');
        });
        assert(art.pageBg('seek_bg', 'm') !== art.pageBg('seek_bg', 'f'),
          '行动页背景按主角性别取图（男 / 女不是同一张）');
        assert(art.endBg('alone', 'm') !== art.endBg('alone', 'f'),
          '结局背景也分男女');
        assert(art.endBg(null, 'm') === null, '结局没有美术类型时返回 null（渲染层画纯色兜底）');
        assert(art.lazyImg('__not_exist__') === null, '取不存在的按需图返回 null，不崩');

        console.log('--- 五、端到端：图片真的画到了画布上 ---');
        runRenderCase();
      });
    });
  });
}).catch(function (e) {
  console.error(e);
  process.exit(1);
});

/* 真实绘制流程：标题页背景 + 设定页头像 + 主界面头像都要 drawImage */
function runRenderCase() {
  cm.installCloudFixture({ realImages: true });
  delete require.cache[require.resolve('../js/ui/art.js')];
  delete require.cache[require.resolve('../js/ui/render.js')];
  var render = require('../js/ui/render.js');
  var artR = require('../js/ui/art.js');

  render.start(cm.makeCanvas());           // init 里会 ensureAll
  settle3(artR, function () {
    /* 标题页 */
    cm.drawnImages.length = 0;
    render.gotoTitle();
    assert(cm.drawnImages.some(function (s) { return s.indexOf('intro_bg') >= 0; }),
      '标题页把 intro_bg 画了出来（背景不再是纯色）');

    /* 设定页：主角头像 */
    cm.drawnImages.length = 0;
    render.startSetup();
    render.setGender('m');
    render.setBg((DB.list('backgrounds')[0] || {}).id);
    render.setGoal((DB.list('goals')[0] || {}).id);
    render.setDifficulty('normal');
    assert(cm.drawnImages.some(function (s) { return s.indexOf('assets/images/role/') >= 0; }),
      '设定页画出了主角职业头像');

    /* 主界面：主角头像 */
    cm.drawnImages.length = 0;
    render.beginGame();
    var plays = cm.drawnImages.filter(function (s) { return s.indexOf('assets/images/role/') >= 0; });
    assert(plays.length > 0, '主界面画出了头像（' + plays.length + ' 次 drawImage）');

    /* 有新的相亲机会时：对方头像也必须画出来（此前会缺图） */
    var isRole = function (s) { return s.indexOf('assets/images/role/') >= 0; };
    var S = render._state().S;
    cm.drawnImages.length = 0;
    render.draw();
    var noLead = cm.drawnImages.filter(isRole).length;

    var mats = DB.text('materials') || DB.get('materials') || {};
    var firstJob = (mats.jobs && mats.jobs[0] && mats.jobs[0].job) || null;
    assert(!!firstJob, '从 materials 取到职业，用来造一个「待见面」对象');
    var leadGender = S.gender === 'm' ? 'f' : 'm';
    S.lead = {
      name: '测试对象', job: firstJob, gender: leadGender, personality: '温和',
      looks: 6, family: 5, age: 27
    };
    cm.drawnImages.length = 0;
    render.draw();
    var withLead = cm.drawnImages.filter(isRole).length;
    assert(withLead > noLead, '有相亲机会时主界面多画了对方头像（' + noLead + ' → ' + withLead + '）');
    assert(!!artR.partnerImg(firstJob, leadGender),
      '该对象的职业头像图真实存在：' + firstJob + '/' + leadGender);
    S.lead = null;

    /* 相亲机会结果页：信封卡片必须真的把对象头像画到画布上 */
    S.relationship = 'single';
    render.gotoSeek();
    var chB = render._buttons().filter(function (b) { return b.selectable; });
    assert(chB.length > 0, '相亲渠道列表可点（用于验证结果页头像）');
    var savedRnd = Math.random;
    Math.random = function () { return 0; };      // 必中
    chB[0].onClick();
    render.runPending();
    Math.random = savedRnd;
    assert(!!render._state().today.result.lead, '相亲成功，结果页带上了对象');
    cm.drawnImages.length = 0;
    render.draw();
    var envAv = cm.drawnImages.filter(isRole);
    assert(envAv.length >= 1, '信封卡片真的画出了对象头像（' + envAv.length + ' 张 drawImage）');

    runFallbackCase();
  });
}

function settle3(artR, cb) {
  var n = 0;
  var t = setInterval(function () {
    if (++n > 40 || artR.stats().pending === 0) { clearInterval(t); cb(); }
  }, 15);
}

/* 六、分包下载失败：仍按完整路径直取兜底，且不误报 */
function runFallbackCase() {
  var totalExpected = Object.keys(MANIFEST.main).length + Object.keys(MANIFEST.packs.art_role.images).length + Object.keys(MANIFEST.packs.art_scene.images).length;
  cm.installCloudFixture({ realImages: true, subpackageFail: ['art_role', 'art_scene'] });
  delete require.cache[require.resolve('../js/ui/art.js')];
  var artB = require('../js/ui/art.js');

  artB.ensureAll();
  settle2(artB, 4000, function () {
    /* verifyPack 是延时核对（250ms 一轮），等它落定后再断言状态 */
    setTimeout(function () {
      var st = artB.stats();
      assert(cm.loadSubpackageCalls.length === 2,
        '两个分包都触发了 loadSubpackage：' + JSON.stringify(cm.loadSubpackageCalls));
      assert(cm.requestedImages.length >= totalExpected,
        '分包失败时仍登记了全部图片请求：' + cm.requestedImages.length + ' 张');
      assert(st.loaded === st.total,
        '按路径直取兜底生效：' + st.loaded + '/' + st.total + ' 张（图其实取到了，不该误报）');
      assert(st.packs.art_role === 'ready',
        '图全部取到后退回 ready，而不是谎报 failed：' + st.packs.art_role);
      assert(!!artB.mainImg('intro_bg'), '主包图不受分包失败影响');

      runSlowPackCase();
    }, 600);
  });
}

/* 六之二、真机核心回归：分包下载慢于重试预算。
 *
 * 历史 bug（真机「除了主界面图全都加载失败」）：代码在 loadSubpackage 之前
 * 就排了分包里的图，真机上必然 onerror；重试两次约 1.5 秒后就被标成 FAILED，
 * 而真机下载往往超过 1.5 秒 —— 等分包终于下完再排时，被 enqueue 的 FAILED
 * 判断直接挡掉，图就永久没了。开发者工具里分包是本地文件，永远复现不了。
 */
function runSlowPackCase() {
  var DELAY = 2200;                     // 远大于旧代码的重试预算（约 1.5 秒）
  cm.installCloudFixture({ realImages: true, subpackageDelay: DELAY });
  delete require.cache[require.resolve('../js/ui/art.js')];
  var artD = require('../js/ui/art.js');

  artD.ensureAll();

  /* 分包还没下完时的中途快照：不能有任何图被误判为永久失败 */
  setTimeout(function () {
    var mid = artD.stats();
    assert(mid.failed.length === 0,
      '分包下载中（' + DELAY + 'ms）没有任何图被误判为失败' +
      (mid.failed.length ? '（误判 ' + mid.failed.length + ' 张：' + mid.failed.slice(0, 3).join(', ') + '）' : ''));
    assert(mid.loaded < mid.total,
      '分包下载中图确实还没就绪（说明测的的确是「慢分包」场景）：' + mid.loaded + '/' + mid.total);
    assert(mid.packs.art_role === 'loading' && mid.packs.art_scene === 'loading',
      '分包状态为 loading：' + mid.packs.art_role + ' / ' + mid.packs.art_scene);
  }, 1800);

  settle2(artD, 12000, function () {
    setTimeout(function () {
      var st = artD.stats();
      assert(st.loaded === st.total,
        '分包慢于重试预算时仍全部加载上：' + st.loaded + '/' + st.total);
      assert(st.failed.length === 0,
        '没有残留失败图' + (st.failed.length ? '：' + st.failed.slice(0, 3).join(', ') : ''));
      assert(st.packs.art_role === 'ready' && st.packs.art_scene === 'ready',
        '分包最终为 ready：' + st.packs.art_role + ' / ' + st.packs.art_scene);
      assert(!!artD.roleImg('programmer', 'm') && !!artD.sceneImg('cafe'),
        '分包就绪后头像 / 场景图都能取到（真机不再白屏）');

      runBrokenImageCase();
    }, 500);
  });
}

/* 七、真有图取不到时：必须点名报出来，不能静默 */
function runBrokenImageCase() {
  var broke = ['assets/images/role/programmer-m.png', 'assets/images/scene/bg-cafe.jpg'];
  cm.installCloudFixture({ realImages: true, breakImages: broke });
  delete require.cache[require.resolve('../js/ui/art.js')];
  var artC = require('../js/ui/art.js');

  artC.ensureAll();
  settle2(artC, 6000, function () {
    var st = artC.stats();
    assert(st.failed.length === broke.length,
      '取不到的图被准确记入 failed：' + st.failed.length + ' 张');
    assert(broke.every(function (p) { return st.failed.indexOf(p) >= 0; }),
      '失败清单点名到具体文件（便于直接定位）');
    assert(st.loaded === st.total - broke.length,
      '其余图片不受影响：' + st.loaded + '/' + st.total);
    assert(artC.roleImg('programmer', 'm') === null,
      '缺失的头像返回 null，渲染层会画占位而不是崩');

    console.log(fails ? ('ART SMOKE FAILED（' + fails + ' 项）') : 'ART SMOKE OK');
    process.exit(fails ? 1 : 0);
  });
}

function settle2(artMod, maxMs, cb) {
  var t0 = Date.now();
  var t = setInterval(function () {
    if (Date.now() - t0 > maxMs || artMod.stats().pending === 0) { clearInterval(t); cb(); }
  }, 20);
}

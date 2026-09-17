/* =========================================================
 * 微信激励视频广告 —— 结局页「看广告领奖励 · 再开一局」
 * ---------------------------------------------------------
 * 这一层只负责「把广告拉起来，并告诉调用方看没看完」：
 *   · 不发奖励 —— 奖励数值在云端 constants（AD_REWARD_MONEY / MOOD / HEALTH），
 *     由渲染层在下一局开局时发放；
 *   · 不写文案 —— 提示语在云端 texts（end 段的 adLoading / adAbort / adNotReady）；
 *   · 不写死广告位 —— AD_UNIT_ID 也在 constants，后台换广告位不用发版。
 *
 * 结果 reason（调用方按这个决定发不发奖、给什么提示）：
 *   ended       看完了 → 发奖
 *   abort       中途退出 → 不发奖，留在原页面
 *   error       拉不起来（广告位没配 / 没填充 / 网络问题）
 *   unsupported 当前环境没有广告 API（开发者工具、老基础库、测试环境）
 *
 * 微信侧注意：
 *   · 广告实例要单例复用，重复 create 会拉不起广告；
 *   · onClose 每次都要先 offClose 再 onClose，否则一次展示会触发多次回调；
 *   · show() 在部分基础库返回 undefined，不能无脑 .catch。
 * ========================================================= */

'use strict';

var unitId = '';
var ad = null;
var adBroken = false;      // 创建失败过就不再重试，避免每次点击都抛异常
var mockImpl = null;       // 测试注入：mockImpl(finish) 直接产出一个结果

/* 占位 ID 判定：'adunit-0000000000000000' 这类没在后台建过的一律当「没配」，
 * 不去真拉起（微信会因为广告位不存在直接报错，玩家只会看到失败提示）。 */
function isPlaceholder(id) {
  return !id || /^adunit-0+$/.test(id);
}

function setUnitId(id) {
  var next = id || '';
  if (next === unitId) return;
  unitId = next;
  ad = null;
  adBroken = false;
}

function supported() {
  return typeof wx !== 'undefined' && !!wx && typeof wx.createRewardedVideoAd === 'function';
}

/** 这个环境能拉起广告吗（渲染层据此决定要不要显示广告入口） */
function available() {
  if (mockImpl) return true;
  return supported() && !isPlaceholder(unitId);
}

function ensure() {
  if (ad) return ad;
  if (adBroken) return null;
  if (!supported() || isPlaceholder(unitId)) return null;
  try {
    ad = wx.createRewardedVideoAd({ adUnitId: unitId });
  } catch (e) {
    /* 广告位不存在 / 基础库不支持时 create 会直接抛，记下来不再重试 */
    adBroken = true;
    ad = null;
  }
  return ad;
}

/**
 * 拉起一次激励视频。
 * @param {Function} cb 回调 ({ ok:Boolean, reason:String })，保证只调一次
 */
function show(cb) {
  var done = false;
  function finish(reason) {
    if (done) return;
    done = true;
    if (typeof cb === 'function') cb({ ok: reason === 'ended', reason: reason });
  }

  /* 测试 / 无广告环境：注入的 mock 直接给出结果 */
  if (mockImpl) {
    mockImpl(finish);
    return;
  }

  var inst = ensure();
  if (!inst) {
    finish(supported() ? 'error' : 'unsupported');
    return;
  }

  var onClose = function (res) {
    if (inst.offClose) inst.offClose(onClose);
    finish(res && res.isEnded ? 'ended' : 'abort');
  };
  /* 先摘再挂：同一个实例反复 show 会叠加监听，导致一次展示回调好几次 */
  if (inst.offClose) inst.offClose(onClose);
  inst.onClose(onClose);

  var p;
  try {
    p = inst.show();
  } catch (e) {
    finish('error');
    return;
  }

  /* show 可能返回 undefined（老基础库）—— 那种情况下只能等 onClose */
  if (p && typeof p.catch === 'function') {
    p.catch(function () {
      /* 常见是「还没填充好」：补一次 load 再 show，仍失败才判 error */
      if (typeof inst.load !== 'function') { finish('error'); return; }
      var lp;
      try { lp = inst.load(); } catch (e2) { finish('error'); return; }
      if (lp && typeof lp.then === 'function') {
        lp.then(function () { return inst.show(); }).catch(function () { finish('error'); });
      } else {
        finish('error');
      }
    });
  }
}

/** 测试用：注入一个假的广告流程（不碰 wx）。传 null 还原。 */
function setMock(fn) { mockImpl = fn || null; }

/** 测试用：清掉实例，下一次 show 会重新 create */
function reset() { ad = null; adBroken = false; }

module.exports = {
  setUnitId: setUnitId,
  available: available,
  supported: supported,
  isPlaceholder: isPlaceholder,
  show: show,
  setMock: setMock,
  reset: reset
};

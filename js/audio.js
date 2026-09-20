'use strict';

/*
 * 《我妈又催婚》音频管理（BGM）
 * ---------------------------------------------------------
 * 微信小游戏音频 API：wx.createInnerAudioContext()
 * 关键点：
 *   1. iOS 必须有「用户手势」后才能播放 —— 所以 BGM 在第一次触摸时启动；
 *   2. obeyMuteSwitch = false → 即使手机静音键开着也照常播放（游戏惯例）；
 *   3. onHide 暂停、onShow 恢复，避免后台空转与回前台状态错乱；
 *   4. 静音偏好存本地，下次启动沿用。
 *
 * 音频文件：把 bgm.mp3 放到 assets/audio/ 即可（主包内）。
 *   - 小游戏主包仅 4MB，建议 BGM 压到 1~2MB 或做成 30~60s 无缝循环；
 *   - 体积更大就走 CDN：把 BGM_SRC 改成 https 地址（云存储 / 对象存储均可）。
 *   - 格式优先 mp3；若用 ogg 注意 iOS 兼容，稳妥起见统一 mp3。
 */

var BGM_SRC = 'assets/audio/bgm.mp3';   // 本地相对路径 或 https URL
var MUTE_KEY = 'xq_bgm_muted';
var BGM_VOLUME = 0.6;

var bgm = null;
var started = false;   // 是否已触发过播放（onShow 据此判断是否恢复）
var muted = false;

function hasWx() {
  return (typeof wx !== 'undefined') && wx.createInnerAudioContext;
}

function loadMutePref() {
  try { muted = !!wx.getStorageSync(MUTE_KEY); } catch (e) { muted = false; }
}
function saveMutePref() {
  try { wx.setStorageSync(MUTE_KEY, muted); } catch (e) { /* 忽略 */ }
}

function ensureBgm(src) {
  if (!hasWx()) return null;
  if (bgm) return bgm;            // 单例，重复调用只创建一次
  bgm = wx.createInnerAudioContext();
  bgm.src = src || BGM_SRC;
  bgm.loop = true;                // 循环播放
  bgm.volume = BGM_VOLUME;
  bgm.obeyMuteSwitch = false;     // 不被手机静音键拦截
  bgm.onError(function (e) {
    console.warn('[音频] BGM 播放异常：' + ((e && e.errMsg) || e) +
      '（检查音频文件是否存在：' + bgm.src + '）');
  });
  return bgm;
}

/* 在用户手势（第一次触摸）后调用；幂等，可反复调用。 */
function playBgm(src) {
  if (!hasWx()) return;
  loadMutePref();
  if (muted) return;
  var c = ensureBgm(src);
  if (!c) return;
  if (started && !c.paused) return;   // 已在播，跳过
  try { c.play(); started = true; }
  catch (e) { console.warn('[音频] BGM play 失败：' + e); }
}

function pauseBgm() {
  if (bgm && !bgm.paused) { try { bgm.pause(); } catch (e) { /* 忽略 */ } }
}
function resumeBgm() {
  if (!started || muted || !bgm) return;
  if (bgm.paused) { try { bgm.play(); } catch (e) { /* 忽略 */ } }
}

function setMuted(m) {
  muted = !!m;
  saveMutePref();
  if (muted) pauseBgm();
  else resumeBgm();
}
function toggleMute() { setMuted(!muted); return muted; }
function isMuted() { return muted; }

/* 生命周期：切后台暂停、回前台恢复 */
function bindLifecycle() {
  if (!hasWx()) return;
  if (wx.onHide) wx.onHide(function () { pauseBgm(); });
  if (wx.onShow) wx.onShow(function () { resumeBgm(); });
}

module.exports = {
  playBgm: playBgm,
  pauseBgm: pauseBgm,
  resumeBgm: resumeBgm,
  setMuted: setMuted,
  toggleMute: toggleMute,
  isMuted: isMuted,
  bindLifecycle: bindLifecycle,
  BGM_SRC: BGM_SRC
};

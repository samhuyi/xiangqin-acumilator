/* =========================================================
 * 美术资源注册表（由 tools/gen-art-manifest.js 自动生成，请勿手改）
 * ---------------------------------------------------------
 * main  : 启动即下载（进入游戏马上要用的图）
 * lazy  : 按需下载（行动页 / 结局页的头部背景，画到哪张才下哪张）
 * packs : 分包资源，取图前必须先 wx.loadSubpackage({ name })
 *         路径写「从项目根开始的完整路径」，分包加载完即可取到。
 *
 * 取图请一律走 art.js（art.pageBg / art.endBg / art.roleImg …），
 * 不要在渲染层手拼文件名 —— 压图会把 PNG 转成 JPG，后缀会变。
 *
 * 新增图片：放进对应目录 → 先跑 tools/compress-assets.py 压图 → 再跑本脚本
 * 注意：文件名一律用 ASCII（英文 / 数字 / - _），不要用中文。
 * ========================================================= */

'use strict';

module.exports = {
  "main": {
    "intro_bg": "assets/images/intro_bg.jpg",
    "intro_lead_f": "assets/images/intro/lead_f.png",
    "intro_lead_m": "assets/images/intro/lead_m.png"
  },
  "lazy": {
    "bg_seek_fail": "assets/images/bg_seek_fail.png",
    "seek_bg_f": "assets/images/seek_bg_f.jpg",
    "seek_bg_m": "assets/images/seek_bg_m.jpg",
    "upgrade_bg_f": "assets/images/upgrade_bg_f.jpg",
    "upgrade_bg_m": "assets/images/upgrade_bg_m.jpg",
    "end_alone_f": "assets/images/end/end_alone_f.jpg",
    "end_alone_m": "assets/images/end/end_alone_m.jpg",
    "end_badmarry_f": "assets/images/end/end_badmarry_f.jpg",
    "end_badmarry_m": "assets/images/end/end_badmarry_m.jpg",
    "end_happymarry_f": "assets/images/end/end_happymarry_f.jpg",
    "end_happymarry_m": "assets/images/end/end_happymarry_m.jpg"
  },
  "packs": {
    "art_role": {
      "root": "assets/images/role",
      "count": 22,
      "images": {
        "accountant-f": "assets/images/role/accountant-f.png",
        "anime-f": "assets/images/role/anime-f.png",
        "artsy-f": "assets/images/role/artsy-f.png",
        "artsy-m": "assets/images/role/artsy-m.png",
        "chef-m": "assets/images/role/chef-m.png",
        "civil-servant-f": "assets/images/role/civil-servant-f.png",
        "civil-servant-m": "assets/images/role/civil-servant-m.png",
        "coach-m": "assets/images/role/coach-m.png",
        "doctor-f": "assets/images/role/doctor-f.png",
        "doctor-m": "assets/images/role/doctor-m.png",
        "nurse-f": "assets/images/role/nurse-f.png",
        "nurse-m": "assets/images/role/nurse-m.png",
        "older-single-f": "assets/images/role/older-single-f.png",
        "older-single-m": "assets/images/role/older-single-m.png",
        "photographer-m": "assets/images/role/photographer-m.png",
        "programmer-f": "assets/images/role/programmer-f.png",
        "programmer-m": "assets/images/role/programmer-m.png",
        "startup-fail-f": "assets/images/role/startup-fail-f.png",
        "startup-fail-m": "assets/images/role/startup-fail-m.png",
        "teacher-f": "assets/images/role/teacher-f.png",
        "wealthy-f": "assets/images/role/wealthy-f.png",
        "wealthy-m": "assets/images/role/wealthy-m.png"
      }
    },
    "art_scene": {
      "root": "assets/images/scene",
      "count": 9,
      "images": {
        "cafe": "assets/images/scene/bg-cafe.jpg",
        "chinese-restaurant": "assets/images/scene/bg-chinese-restaurant.jpg",
        "cinema": "assets/images/scene/bg-cinema.jpg",
        "concert": "assets/images/scene/bg-concert.jpg",
        "living-room": "assets/images/scene/bg-living-room.jpg",
        "mall": "assets/images/scene/bg-mall.jpg",
        "milk-tea": "assets/images/scene/bg-milk-tea.jpg",
        "theatre": "assets/images/scene/bg-theatre.jpg",
        "western-restaurant": "assets/images/scene/bg-western-restaurant.jpg"
      }
    }
  }
};

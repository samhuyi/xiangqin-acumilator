/* =========================================================
 * 卡片式选项页 · 设计预览生成器
 * ---------------------------------------------------------
 * 用「游戏真实渲染参数（配色 / 尺寸 / 圆角 / chips 配色）」+ 「数据库真实数据」
 * 生成一份 HTML 预览，便于在浏览器里对照原型查看各选项页的卡片化效果。
 * 说明：这是 HTML 复刻的「设计预览」，与 Canvas 真机渲染高度一致但非逐像素。
 *
 * 用法：node tools/gen-cards-preview.js  → 输出 docs/cards-preview.html
 * ========================================================= */
'use strict';

var fs = require('fs');
var path = require('path');

var backgrounds = require('../db/seed/backgrounds.js');
var goals = require('../db/seed/goals.js');
var difficulties = require('../db/seed/difficulties.js');
var channels = require('../db/seed/channels.js');
var dateTypes = require('../db/seed/date_types.js');
var styles = require('../db/seed/court_styles.js');
var textsArr = require('../db/seed/texts.js');

function docText(id) {
  for (var i = 0; i < textsArr.length; i++) if (textsArr[i].id === id) return textsArr[i].value;
  return {};
}
var SETUP = docText('setup');
var PLAY = docText('play');

function money(n) {
  n = Math.round(n || 0);
  if (Math.abs(n) >= 10000) {
    var w = n / 10000;
    return (Math.round(w * 10) / 10) + '万';
  }
  return String(n);
}
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

/* ---- 与 render.js 一致的配色 ---- */
var DIFF_PILL = {
  easy: { bg: '#e8f5ec', fg: '#2e9e5b' }, normal: { bg: '#e9effb', fg: '#4a7fd4' },
  hard: { bg: '#fdf3e0', fg: '#d8852f' }, hell: { bg: '#fdeeec', fg: '#e0657a' },
  gold: { bg: '#fdf3e0', fg: '#c9902f' }
};
var CHIP_TONE = {
  hi: { bg: '#e8f5ec', val: '#2e9e5b' }, mid: { bg: '#fdf3e0', val: '#d8852f' },
  lo: { bg: '#fdeeec', val: '#e0657a' }, money: { bg: '#fdf3e0', val: '#c9902f' },
  neutral: { bg: '#f6f1e5', val: '#7d7369' }
};
function chipTone(v, isMoney) {
  if (isMoney) { if (v >= 150000) return 'hi'; if (v >= 20000) return 'mid'; return 'lo'; }
  if (v >= 70) return 'hi';
  if (v >= 45) return 'mid';
  return 'lo';
}
function bgTierBadge(b) {
  var ini = (b && b.init) || {};
  var moneyScore = Math.min(100, (ini.money || 0) / 5000);
  var comp = (moneyScore + (ini.health || 0) + (ini.career || 0) + (ini.looks || 0) + (ini.family || 0) + (ini.mood || 0)) / 6;
  if (comp >= 68) return { text: '轻松 ★', tone: 'easy' };
  if (comp >= 52) return { text: '普通 ★★', tone: 'normal' };
  if (comp >= 42) return { text: '困难 ★★★', tone: 'hard' };
  return { text: '地狱 ★★★★', tone: 'hell' };
}
var GOAL_EMOJI = { marry: '💍', true_love: '💗', rich_alone: '💰', career_peak: '📈', settle: '🏠' };
/* 图标与 js/ui/render.js 的 ICON / ATTR_META 保持一致：
 * 只用 Unicode 6.0 时代、各平台都有彩色字形的 emoji（详见 render.js 的图标选用约定） */
var DATE_EMOJI = { simple: '🍵', standard: '🍜', activity: '🎡' };

function chip(c) {
  var t = CHIP_TONE[c.tone] || CHIP_TONE.neutral;
  return '<span class="chip" style="background:' + t.bg + '">' + esc(c.label) +
    '<b style="color:' + t.val + '">' + esc(c.value) + '</b></span>';
}
function chips(list) {
  if (!list || !list.length) return '';
  return '<div class="chips">' + list.map(chip).join('') + '</div>';
}
/* 富卡片（对齐 optionCard） */
function card(o) {
  o = o || {};
  var badge = '';
  if (o.badge) {
    var t = DIFF_PILL[o.badgeTone] || DIFF_PILL.normal;
    badge = '<span class="pill" style="background:' + t.bg + ';color:' + t.fg + '">' + esc(o.badge) + '</span>';
  }
  var lead = '';
  if (o.avatar) lead = '<div class="lead avatar" style="background:' + (o.avatarBg || '#efe7da') + '">' + o.avatar + '</div>';
  else if (o.icon) lead = '<div class="lead icon">' + o.icon + '</div>';
  var tagline = o.tagline ? '<div class="tagline">' + esc(o.tagline) + '</div>' : '';
  var sub = o.sub ? '<div class="sub">' + esc(o.sub) + '</div>' : '';
  return '<div class="card' + (o.sel ? ' sel' : '') + (o.dis ? ' dis' : '') + '">' +
    (o.sel ? '<span class="tick">✓</span>' : '') +
    '<div class="ctop">' + lead +
    '<div class="cmain"><div class="trow"><span class="ctitle">' + esc(o.title) + '</span>' + badge + '</div>' + tagline + '</div></div>' +
    sub + chips(o.chips) + '</div>';
}
function seg(items, activeId) {
  return '<div class="seg">' + items.map(function (it) {
    var on = it.id === activeId;
    return '<button class="segitem' + (on ? ' on' : '') + '">' + (it.icon ? '<span class="ico">' + it.icon + '</span>' : '') + esc(it.label) + '</button>';
  }).join('') + '</div>';
}
function head(step, title, sub) {
  return '<div class="head"><div class="step">' + esc(step) + '</div><h1>' + esc(title) + '</h1><div class="hsub">' + esc(sub) + '</div></div>';
}
function sec(no, title, sub) {
  return '<div class="sechead"><span class="no">' + no + '</span>' + esc(title) + '</div>' + (sub ? '<div class="secsub">' + esc(sub) + '</div>' : '');
}
function phone(title, body, hint, confirmLabel) {
  /* 左上角音乐浮窗：所有页面都有（对齐 drawMusicToggle） */
  var music = '<div class="music" title="音乐开关">🔊</div>';
  return '<div class="phone"><div class="screen">' + body + '</div>' + music +
    '<div class="bottombar">' + (hint ? '<div class="hint">' + esc(hint) + '</div>' : '') +
    '<button class="cbtn">' + esc(confirmLabel) + '</button></div>' +
    '<div class="ptitle">' + esc(title) + '</div></div>';
}

/* ---- 各页数据 ---- */
var bgCards = backgrounds.map(function (b, i) {
  var ini = b.init || {};
  var tier = bgTierBadge(b);
  return card({
    avatar: (b.avatar || '🙂'), avatarBg: '#efe7da',
    title: b.name, tagline: b.tag, badge: tier.text, badgeTone: tier.tone,
    sel: i === 1,
    chips: [
      { label: '存款', value: money(ini.money) + '元', tone: chipTone(ini.money, true) },
      { label: '健康', value: ini.health, tone: chipTone(ini.health) },
      { label: '事业', value: ini.career, tone: chipTone(ini.career) },
      { label: '颜值', value: ini.looks, tone: chipTone(ini.looks) },
      { label: '家境', value: ini.family, tone: chipTone(ini.family) },
      { label: '情绪', value: ini.mood, tone: chipTone(ini.mood) }
    ]
  });
}).join('');

var goalCards = goals.filter(function (g) { return g.id === 'marry' || g.id === 'true_love' || g.id === 'rich_alone'; }).map(function (g, i) {
  return card({ icon: GOAL_EMOJI[g.id] || '🎯', title: g.name, sub: g.desc, sel: i === 0 });
}).join('');
var diffCards = difficulties.map(function (d, i) {
  var stars = d.id === 'easy' ? '★' : (d.id === 'normal' ? '★★' : '★★★');
  return card({
    title: d.name, sub: d.desc + '　找对象期限：' + d.partnerDeadline + ' 天内',
    badge: stars, badgeTone: d.id, sel: i === 1
  });
}).join('');

var channelCards = channels.map(function (c, i) {
  var pct = Math.round(c.chance * 100);
  return card({
    icon: '💘', title: c.name, sub: c.sub, sel: i === 2,
    chips: [
      { label: '花费', value: c.cost > 0 ? money(c.cost) + '元' : '免费', tone: 'money' },
      { label: '成功率', value: pct + '%', tone: pct >= 50 ? 'hi' : (pct >= 30 ? 'mid' : 'lo') }
    ]
  });
}).join('');

var upgradeCards = [
  { icon: '🏠', title: PLAY.lifeTitle, sub: PLAY.lifeSub },
  { icon: '📚', title: PLAY.improveTitle, sub: PLAY.improveSub },
  { icon: '💼', title: PLAY.overtimeTitle, sub: PLAY.overtimeSub },
  { icon: '🌙', title: PLAY.restTitle, sub: PLAY.restSub + PLAY.restWorker }
].map(function (o, i) { o.sel = i === 1; return card(o); }).join('');

var dateCards = dateTypes.map(function (t, i) {
  return card({
    icon: DATE_EMOJI[t.id] || '💞', title: t.name, sel: i === 0,
    sub: money(t.cost) + '元 · 好感收益 ×' + t.affMult
  });
}).join('');

var styleCards = styles.map(function (s, i) {
  return card({
    title: s.name, sel: i === 0,
    sub: s.desc + '｜好感 ×' + s.affMod + ' · 翻车风险 ' + Math.round(s.risk * 100) + '%' + (s.suits ? '｜' + s.suits : '')
  });
}).join('');

var eventCards = [0, 1, 2].map(function (i) {
  return card({ title: ['「你平时周末都干嘛呀？」', '「你这车是买的还是租的？」', '「要不……先加个微信？」'][i], compact: true, sel: i === 0 });
}).join('');

/* ---- 事件页（相亲事件 / 随机事件同一套画法） ---- */
var EV_TEXT = [
  '周六傍晚，你们约在河边那条步道上。她比约定时间早到了十分钟，正低头看手机。',
  '你走过去，她抬起头，先笑了一下——你准备好的开场白，忽然一个字都想不起来了。'
];
var EV_PICK = '「你平时周末都干嘛呀？」';
var EV_RESULT = [
  '她愣了一下，然后说了很多。你听着，偶尔插一句，步道走到了尽头又往回走。',
  '临别时她说：「下次别问这种问题了，直接约我就行。」'
];
/* 旁白卡（对齐 noteCard）：白底 + 细描边 + 16 圆角 */
function noteCard(paras) {
  return '<div class="notecard">' + paras.map(function (p) {
    return '<p>' + esc(p) + '</p>';
  }).join('') + '</div>';
}
/* 你的选择（选中态卡片，对齐 drawEventResultInline） */
function pickCard(t) {
  return '<div class="pickcard">' + esc(t) + '</div>';
}
/* 属性变化卡（对齐 drawDeltaTags：双列 · 图标 + 名称 + 增减值） */
var ATTR_META = {
  money: { icon: '💰', bg: '#fdf3e0' }, health: { icon: '💪', bg: '#e8f5ec' },
  career: { icon: '💼', bg: '#e9effb' }, looks: { icon: '✨', bg: '#f3ecfb' },
  family: { icon: '🏠', bg: '#f7efdf' }, mood: { icon: '😊', bg: '#e6f5f2' },
  affection: { icon: '💕', bg: '#fbe9ec' }
};
var ATTR_LABEL = { money: '存款', affection: '好感度', health: '健康', career: '事业', looks: '颜值', family: '家境', mood: '情绪' };
function deltaVal(key, v) {
  var av = Math.abs(v);
  var mag = (key === 'money' && av >= 10000) ? money(av) : String(av);
  return (v > 0 ? '+' : '-') + mag;
}
function deltaCards(list) {
  return '<div class="dgrid">' + list.map(function (it) {
    var m = ATTR_META[it.key] || { icon: '•', bg: '#f3ece0' };
    var up = it.v > 0;
    return '<div class="dcard' + (up ? ' up' : ' down') + '">' +
      '<span class="dicon" style="background:' + m.bg + '">' + m.icon + '</span>' +
      '<span class="dname">' + esc(ATTR_LABEL[it.key] || it.key) + '</span>' +
      '<b class="dval" style="color:' + (up ? '#2e9e5b' : '#c9554a') + '">' + deltaVal(it.key, it.v) + '</b>' +
      '</div>';
  }).join('') + '</div>';
}
var EV_DELTA = [
  { key: 'money', v: -320 }, { key: 'affection', v: 9 },
  { key: 'health', v: -1 }, { key: 'mood', v: 6 }, { key: 'career', v: -1 }
];

var PAGE = [];
PAGE.push(phone('① 开局设定 · 性别 + 出身',
  head('开局设定 · CHARACTER SETUP', '创建你的角色', '性别决定相亲对象与部分剧情措辞，出身背景决定全部初始属性与职业。') +
  sec(1, SETUP.genderHead, SETUP.genderSub) + seg(SETUP.genderOptions, 'm') +
  sec(2, SETUP.bgHead, SETUP.bgSub) + bgCards,
  '当前已选：' + backgrounds[1].name, '确认'));
PAGE.push(phone('② 开局设定 · 目标 + 难度',
  head('开局设定 · CHARACTER SETUP', '设定人生目标', '达成它即为胜利。') +
  sec(1, SETUP.goalHead, SETUP.goalSub) + goalCards +
  sec(2, SETUP.diffHead, SETUP.diffSub) + diffCards,
  '当前已选：' + goals[0].name + ' · ' + difficulties[1].name, '开始这段人生'));
PAGE.push(phone('③ 今天想做什么（行动菜单）',
  head('今日安排', PLAY.actionTitle, PLAY.actionNote) +
  card({ icon: '💝', title: PLAY.seekTitle, sub: PLAY.seekSub, badge: PLAY.mainLine, badgeTone: 'gold' }) +
  card({ icon: '🌱', title: PLAY.otherTitle, sub: PLAY.otherSub }),
  PLAY.confirmPick, '确认'));
PAGE.push(phone('④ 寻找相亲机会 · 选渠道',
  head('寻找相亲机会', PLAY.seekMenuTitle, '还没相到人时，先选一个渠道去认识人。') + channelCards,
  '当前已选：' + channels[2].name, '确认'));
PAGE.push(phone('⑤ 其余安排',
  head('其余安排', PLAY.upgradePageTitle, PLAY.upgradePageSub) + upgradeCards,
  '当前已选：' + PLAY.improveTitle, '确认'));
PAGE.push(phone('⑥ 约会档位',
  head('约会', '和 TA 约会', PLAY.datePageSub) + dateCards,
  '当前已选：' + dateTypes[0].name, '确认'));
PAGE.push(phone('⑦ 交往风格（叠层）', (function () {
  return head('约会', PLAY.styleTitle, PLAY.styleOverlayHint) + styleCards;
})(), '点一次选中，再点一次取消', '确认'));
PAGE.push(phone('⑧ 事件选择 / 微信回复',
  head('事件', '今天的遭遇', '选项统一成卡片，选中后由底部「确认」提交。') + eventCards,
  '当前已选：' + '「你平时周末都干嘛呀？」', '确认'));
PAGE.push(phone('⑨ 事件页 · 选项态（旁白卡 + 选项卡）',
  head('事件 · 河边步道', '初次见面', '相亲事件与随机事件同一套画法：正文用旁白卡承载，选项是卡片。') +
  noteCard(EV_TEXT) + eventCards,
  '当前已选：' + EV_PICK, '确认'));
PAGE.push(phone('⑩ 事件页 · 结果态（复述 + 结果卡 + 属性变化卡）',
  head('事件 · 河边步道', '初次见面', '确认后不跳页：选项卡退场 → 结果卡与属性变化卡错落入场。') +
  noteCard(EV_TEXT) +
  '<div class="minihead">你的选择</div>' + pickCard(EV_PICK) +
  '<div class="minihead">结果</div>' + noteCard(EV_RESULT) +
  deltaCards(EV_DELTA),
  '', '继续（推进 1 天）'));

var html = '<!DOCTYPE html>\n<html lang="zh-CN"><head><meta charset="UTF-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>相亲模拟器 · 选项页卡片式设计预览</title><style>' +
  ':root{--bg:#f6f1ea;--card:#fff;--ink:#2b2622;--ink2:#7d7369;--ink3:#a89d91;--line:#ece4d8;--accent:#c95a45;--accent2:#b04a38;--gold:#c9902f;}' +
  '*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}' +
  'body{font-family:-apple-system,"PingFang SC","HarmonyOS Sans SC","Microsoft YaHei",sans-serif;background:#e9e2d2;color:var(--ink);padding:30px 16px;}' +
  '.note{max-width:1100px;margin:0 auto 22px;background:#fff8ec;border:1px solid #ecd9b8;border-radius:14px;padding:14px 18px;font-size:13px;line-height:1.7;color:#7a5c2e;}' +
  '.note b{color:#b04a38;}' +
  '.wrap{max-width:1180px;margin:0 auto;display:flex;flex-wrap:wrap;gap:26px;justify-content:center;align-items:flex-start;}' +
  '.phone{position:relative;width:360px;background:var(--bg);border-radius:26px;overflow:hidden;box-shadow:0 18px 44px rgba(60,50,30,.22),0 0 0 8px #1f1d19;height:720px;display:flex;flex-direction:column;}' +
  '.screen{flex:1;overflow-y:auto;padding:20px 16px 118px;scrollbar-width:none}.screen::-webkit-scrollbar{display:none}' +
  '.head .step{font-size:11px;color:var(--ink3);letter-spacing:2px;font-weight:600}' +
  '.head h1{font-size:23px;font-weight:800;margin-top:4px}.head .hsub{font-size:12px;color:var(--ink2);margin-top:6px;line-height:1.55}' +
  '.sechead{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;margin:18px 0 8px}' +
  '.sechead .no{width:18px;height:18px;border-radius:6px;background:var(--ink);color:#fff;font-size:10px;display:flex;align-items:center;justify-content:center;font-weight:700}' +
  '.secsub{font-size:12px;color:var(--ink2);margin:-2px 0 10px;line-height:1.5}' +
  '.seg{display:flex;background:#ece4d2;border-radius:12px;padding:4px;gap:4px}' +
  '.segitem{flex:1;height:46px;border:none;border-radius:9px;background:transparent;font-family:inherit;font-size:15px;font-weight:600;color:var(--ink2);display:flex;align-items:center;justify-content:center;gap:6px}' +
  '.segitem.on{background:#fff;color:var(--accent);font-weight:800;box-shadow:0 2px 8px rgba(60,50,30,.12)}' +
  '.segitem .ico{font-size:16px}' +
  '.card{position:relative;background:var(--card);border:1.5px solid var(--line);border-radius:16px;padding:13px 14px;margin-top:12px}' +
  '.card.sel{border-color:var(--accent);background:#fffdfb;box-shadow:0 6px 18px rgba(201,90,69,.13)}' +
  '.card.dis{opacity:.55}' +
  '.tick{position:absolute;top:-8px;right:12px;width:22px;height:22px;border-radius:50%;background:var(--accent);color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(201,90,69,.35)}' +
  '.ctop{display:flex;align-items:center;gap:12px}' +
  '.lead{width:44px;height:44px;border-radius:12px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:24px;border:1px solid var(--line)}' +
  '.lead.icon{background:#f3ece0}' +
  '.cmain{flex:1;min-width:0}' +
  '.trow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.ctitle{font-size:16px;font-weight:800}' +
  '.card.sel .ctitle{color:var(--accent2)}' +
  '.pill{font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;flex-shrink:0}' +
  '.tagline{font-size:11px;color:var(--ink3);margin-top:2px}' +
  '.sub{font-size:12px;color:var(--ink2);margin-top:7px;line-height:1.5}' +
  '.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}' +
  '.chip{font-size:11px;padding:3px 8px;border-radius:8px;background:#f6f1e5;color:var(--ink2);font-weight:600;display:flex;align-items:baseline;gap:3px}' +
  '.chip b{font-size:12px;font-weight:800}' +
  '.card.sel .sub{color:#a8564a}' +
  '.bottombar{position:absolute;left:0;right:0;bottom:0;padding:14px 16px 16px;background:linear-gradient(to top,var(--bg) 72%,rgba(246,241,234,0));display:flex;flex-direction:column;gap:8px}' +
  '.hint{font-size:11px;color:var(--ink3);text-align:center;height:14px}' +
  '.cbtn{height:48px;border-radius:14px;border:none;width:100%;font-size:16px;font-weight:800;color:#fff;background:var(--accent);box-shadow:0 6px 16px rgba(201,90,69,.28);font-family:inherit}' +
  '.ptitle{position:absolute;top:8px;left:50%;transform:translateX(-50%);background:rgba(45,42,36,.86);color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;white-space:nowrap;z-index:5}' +
  /* 左上角音乐浮窗（所有页面都有，对齐 drawMusicToggle） */
  '.music{position:absolute;top:10px;left:12px;width:36px;height:36px;border-radius:50%;background:#fff;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:16px;z-index:6;box-shadow:0 2px 8px rgba(60,50,30,.10)}' +
  /* 事件旁白卡（对齐 noteCard）：白底 + 细描边 + 16 圆角，段落间距 8px */
  '.notecard{background:var(--card);border:1.5px solid var(--line);border-radius:16px;padding:14px 16px;margin-top:12px}' +
  '.notecard p{font-size:15px;line-height:1.6;color:var(--ink)}' +
  '.notecard p+p{margin-top:8px}' +
  '.minihead{font-size:11px;font-weight:800;color:var(--ink3);margin-top:16px;letter-spacing:1px}' +
  '.pickcard{background:#fbeae5;border:2px solid var(--accent);border-radius:14px;padding:12px 14px;margin-top:8px;font-size:15px;font-weight:800;color:var(--accent2)}' +
  /* 属性变化卡（对齐 drawDeltaTags）：双列 · 图标 + 名称 + 增减值 */
  '.dgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}' +
  '.dcard{display:flex;align-items:center;gap:7px;height:40px;border-radius:12px;padding:0 10px;border:1px solid}' +
  '.dcard.up{background:#e9f5ee;border-color:#cde8d9}.dcard.down{background:#fbebe9;border-color:#f2d5d2}' +
  '.dicon{width:22px;height:22px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}' +
  '.dname{font-size:11px;color:var(--ink2)}' +
  '.dval{margin-left:auto;font-size:14px;font-weight:800}' +
  '</style></head><body>' +
  '<div class="note"><b>相亲模拟器 · 选项页卡片式设计预览</b><br>' +
  '本页由 <code>tools/gen-cards-preview.js</code> 用<b>游戏真实渲染参数</b>（配色 / 圆角 / 尺寸 / chips 配色）+ <b>数据库真实数据</b> 生成，' +
  '对照「开局设定原型 V2」把各选项页统一成卡片式。与微信小游戏 Canvas 真机渲染高度一致，但为 HTML 复刻，非逐像素。' +
  '实线圆角=卡片；右上 ✓=当前选中；每个选项都走「点选 → 底部确认」。<br>' +
  '左上角圆形 <b>🔊</b> 是所有页面都常驻的<b>音乐开关浮窗</b>（点一下切换静音）。' +
  '<b>动效</b>（静态预览看不到）：卡片进场按顺序「上移 + 淡入」错落出现；确认后选项卡「下沉 + 淡出」退场，' +
  '再由结果卡与属性变化卡错落入场。</div>' +
  '<div class="wrap">' + PAGE.join('') + '</div></body></html>';

var out = path.join(__dirname, '..', 'docs', 'cards-preview.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html, 'utf8');
console.log('已生成预览：' + out + ' (' + Math.round(html.length / 1024) + ' KB)');

/* =========================================================
 * 相亲图鉴（玩家进度存档）
 * ---------------------------------------------------------
 * 这里存的是「玩家自己」的收集进度，不是游戏数据：
 *   · 遇见过哪些相亲对象（解锁）
 *   · 每个人达到过的最高接触阶段（初次见面 / 接触中 / 恋爱中 / 已结婚）
 *   · 好感度峰值、首次遇见的天数、是否有了孩子
 *
 * 与 partners 集合的分工：
 *   partners  —— 「有哪些人」（姓名 / 头像 / 资料），唯一真源在数据库；
 *   gallery   —— 「你见过谁、走到哪一步」，本局+跨局累计，存本地存档。
 *
 * 阶段顺序（met < meeting < talking < dating < married）来自
 * constants.GALLERY_ORDER，逻辑层只做比较，不写死顺序。
 * ========================================================= */

'use strict';

var DB = require('../db/repository.js');

var KEY = 'xq_gallery_v1';
var VER = 1;
var DEFAULT_ORDER = 'met,meeting,talking,dating,married';

function blank() { return { v: VER, records: {} }; }

function load() {
  try {
    if (typeof wx === 'undefined' || !wx.getStorageSync) return blank();
    var raw = wx.getStorageSync(KEY);
    if (!raw) return blank();
    var g = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!g || g.v !== VER || !g.records) return blank();
    return g;
  } catch (e) { return blank(); }
}

function save(g) {
  try {
    if (typeof wx === 'undefined' || !wx.setStorageSync) return;
    wx.setStorageSync(KEY, JSON.stringify(g));
  } catch (e) { /* ignore */ }
}

function reset() {
  try {
    if (typeof wx !== 'undefined' && wx.removeStorageSync) wx.removeStorageSync(KEY);
  } catch (e) { /* ignore */ }
}

/* 图鉴阶段顺序（唯一真源在数据库常量里） */
function order() {
  var raw = DB.num('GALLERY_ORDER', DEFAULT_ORDER) || DEFAULT_ORDER;
  var list = Array.isArray(raw) ? raw.slice() : String(raw).split(',');
  list = list.map(function (x) { return String(x).trim(); }).filter(function (x) { return x; });
  return list.length ? list : DEFAULT_ORDER.split(',');
}

function rank(stage) {
  var i = order().indexOf(stage);
  return i < 0 ? -1 : i;
}

/**
 * 把当前对局状态里「正在接触 / 待见面」的人同步进图鉴。
 * @param {object} state 引擎状态（含 partner / lead / relationship / affection / flags）
 * @param {number} day   当前天数（用于记录首次 / 最近遇见）
 * @returns {object|null} 本次写入的记录
 */
function sync(state, day) {
  if (!state) return null;
  var who = state.partner || state.lead;
  if (!who || !who.id) return null;

  /* 还没赴约的「待见面」只算遇见；已经确定关系就按关系阶段记 */
  var stage = state.partner ? String(state.relationship || 'meeting') : 'met';
  var d = day || state.day || 0;

  var g = load();
  var rec = g.records[who.id];
  if (!rec) {
    rec = { id: who.id, name: who.name, stage: 'met', aff: 0, child: false, firstDay: d, lastDay: d };
  }
  if (rank(stage) > rank(rec.stage)) rec.stage = stage;
  var aff = Math.round(state.affection || 0);
  if (aff > (rec.aff || 0)) rec.aff = aff;
  if (state.flags && state.flags.child) rec.child = true;
  if (who.name) rec.name = who.name;
  if (!rec.firstDay) rec.firstDay = d;
  rec.lastDay = d;

  g.records[who.id] = rec;
  save(g);
  return rec;
}

/* 某个对象是否已解锁 */
function has(id) {
  return !!load().records[id];
}

/* 某个对象的图鉴记录（未解锁返回 null） */
function record(id) {
  return load().records[id] || null;
}

/* 已解锁条数（传 gender 只统计该性别；不传统计全部） */
function unlockedCount(gender, roster) {
  var recs = load().records;
  var n = 0;
  (roster || []).forEach(function (p) {
    if (!p) return;
    if (gender && p.gender !== gender) return;
    if (recs[p.id]) n++;
  });
  return n;
}

module.exports = {
  KEY: KEY,
  load: load,
  save: save,
  reset: reset,
  order: order,
  rank: rank,
  sync: sync,
  has: has,
  record: record,
  unlockedCount: unlockedCount
};

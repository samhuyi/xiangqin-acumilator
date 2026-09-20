/* =========================================================
 * 规则求值器（Rule Engine）
 * ---------------------------------------------------------
 * 这是「元逻辑」而非「游戏数据」：它负责解释由数据库下发的声明式规则，
 * 包括人生目标的达成条件/进度、对象性格的主动分手条件。
 *
 * 支持的条件节点（check / cond）：
 *   { field, op, value }        比较 s[field]
 *   { flag,  op, value }        比较 s.flags[flag]
 *   { all: [...] }              全部为真
 *   { any: [...] }              任一为真
 *   null                        恒为真
 *
 * 支持的进度表达式节点（progress）：
 *   { ratio: field, target }     min(field/target, 1)
 *   { min: [...] } / { max: [...] } / { mul: [...] }
 *   { cond, then, else }         条件三目（then/else 为数字）
 *   { type:'relation', withChild } 关系阶段进度
 * ========================================================= */

'use strict';

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/* ---------------- 条件 ---------------- */
function cmp(fieldVal, op, value) {
  switch (op) {
    case 'eq': return fieldVal === value;
    case 'neq': return fieldVal !== value;
    case 'lt': return fieldVal < value;
    case 'lte': return fieldVal <= value;
    case 'gt': return fieldVal > value;
    case 'gte': return fieldVal >= value;
  }
  return false;
}

function evalCond(cond, s) {
  if (!cond) return true;
  if (cond.all) {
    for (var i = 0; i < cond.all.length; i++) {
      if (!evalCond(cond.all[i], s)) return false;
    }
    return true;
  }
  if (cond.any) {
    for (var j = 0; j < cond.any.length; j++) {
      if (evalCond(cond.any[j], s)) return true;
    }
    return false;
  }
  if (cond.flag !== undefined) {
    return cmp((s.flags || {})[cond.flag], cond.op, cond.value);
  }
  if (cond.field !== undefined) {
    return cmp(s[cond.field], cond.op, cond.value);
  }
  return false;
}

/* ---------------- 进度表达式 ---------------- */
function evalExpr(expr, s, goal) {
  if (expr.ratio !== undefined) {
    return clamp((s[expr.ratio] || 0) / (expr.target || 1), 0, 1);
  }
  if (expr.min) {
    var mn = 1;
    for (var i = 0; i < expr.min.length; i++) mn = Math.min(mn, evalExpr(expr.min[i], s, goal));
    return mn;
  }
  if (expr.max) {
    var mx = 0;
    for (var j = 0; j < expr.max.length; j++) mx = Math.max(mx, evalExpr(expr.max[j], s, goal));
    return mx;
  }
  if (expr.mul) {
    var prod = 1;
    for (var k = 0; k < expr.mul.length; k++) prod *= evalExpr(expr.mul[k], s, goal);
    return prod;
  }
  if (expr.cond) {
    return evalCond(expr.cond, s) ? (expr.then || 0) : (expr.else || 0);
  }
  if (expr.type === 'relation') {
    return relationProgress(s, goal);
  }
  return 0;
}

/* 关系阶段 → 进度（等价于原 goalRelProgress） */
function relationProgress(s, goal) {
  if (s.relationship === 'married') {
    return s.flags.child
      ? (goal.marriedWithChild !== undefined ? goal.marriedWithChild : 1)
      : (goal.marriedNoChild !== undefined ? goal.marriedNoChild : 0.9);
  }
  var t = goal.relProgressTable || {};
  return (t[s.relationship] !== undefined) ? t[s.relationship] : 0.05;
}

/* ---------------- 目标判定 ---------------- */
function goalCheck(s, goal) {
  return evalCond(goal.check, s);
}
function goalProgress(s, goal) {
  return clamp(evalExpr(goal.progress, s, goal), 0, 1);
}

/* ---------------- 性格分手风险 ----------------
 * 返回 { risk, reason, suddenRisk, suddenReason }，null 表示没有规则命中。
 *
 * 「两段式分手」把风险分成两类，规则里用 warn 区分：
 *   · risk / reason（默认）   可挽回的危机：条件踩线 → 先给预警 → 不处理才分手。
 *     因为有「把这一项补回去，预警就解除」这条路，它必须是可操作的数值条件。
 *   · suddenRisk / suddenReason（规则写 warn:false）
 *     没有预兆的离开（「随便玩玩」的说撤就撤）：不给预警、不吃积怨加成，
 *     就是某一天突然走了。这类规则必须写得非常低，否则玩家没有任何反制手段。
 * 两者在一帧里各掷各的，最终取「至少命中一个」。 */
/* 「踩得多深」的加权上限（SEVERITY_AMP）。
 *
 * 为什么需要它：规则原本只有「命中 / 不命中」两种状态，于是阈值两侧是两个世界 ——
 * 精力 34 分永远安全、30 分就等着分手。玩家看到的是一个断崖，中间没有过渡，
 * 也没有「再差一点就危险了」的体感。
 *
 * 这里给每条命中的规则按「离阈值多远」乘一个 1 ~ 1+SEVERITY_AMP 的系数：
 *   刚好踩线   → ×1.00（还是原来的数值，不改变既有平衡）
 *   踩到阈值的一半 → ×1.4
 *   见底（0 分）→ ×1.8
 * 系数只放大「可挽回的危机」，不放大「无预兆的离开」——
 * 后者本来就低到不该因为状态差而变成必死。 */
var SEVERITY_AMP = 0.8;

/* 一条 cond 的「深度」：0 = 刚好踩线，1 = 见底。取子树里最深的那一支。 */
function condSeverity(cond, s) {
  if (!cond) return 0;
  var kids = cond.any || cond.all;
  if (kids) {
    var m = 0;
    for (var i = 0; i < kids.length; i++) m = Math.max(m, condSeverity(kids[i], s));
    return m;
  }
  if (cond.field === undefined || typeof cond.value !== 'number' || cond.value === 0) return 0;
  var v = s[cond.field];
  if (typeof v !== 'number') return 0;
  var t = Math.abs(cond.value);
  var depth;
  if (cond.op === 'lt') depth = (cond.value - v) / t;
  else if (cond.op === 'gt') depth = (v - cond.value) / t;
  else return 0;
  return clamp(depth, 0, 1);
}

function personalityRisk(s, personality) {
  var rules = personality.rules || [];
  var sum = (personality.combine === 'sum');
  var risk = 0, reason = '', matched = false;
  var suddenRisk = 0, suddenReason = '';

  for (var i = 0; i < rules.length; i++) {
    if (!evalCond(rules[i].cond, s)) continue;
    matched = true;
    var r = rules[i].risk || 0;
    if (rules[i].warn === false) {
      suddenRisk = sum ? (suddenRisk + r) : r;
      suddenReason = rules[i].reason;
    } else {
      /* 越深越危险：同一条规则在「刚好踩线」和「见底」之间是连续变化的 */
      var factor = 1 + condSeverity(rules[i].cond, s) * SEVERITY_AMP;
      var weighted = r * factor;
      risk = sum ? (risk + weighted) : weighted;
      reason = rules[i].reason;
    }
  }
  if (!matched) return null;
  return {
    risk: risk, reason: reason,
    suddenRisk: suddenRisk, suddenReason: suddenReason
  };
}

module.exports = {
  clamp: clamp,
  evalCond: evalCond,
  evalExpr: evalExpr,
  SEVERITY_AMP: SEVERITY_AMP,
  condSeverity: condSeverity,
  goalCheck: goalCheck,
  goalProgress: goalProgress,
  personalityRisk: personalityRisk
};

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

/* ---------------- 性格分手风险 ---------------- */
function personalityRisk(s, personality) {
  var rules = personality.rules || [];
  var risk = 0, reason = '', matched = false;
  for (var i = 0; i < rules.length; i++) {
    if (evalCond(rules[i].cond, s)) {
      matched = true;
      risk = (personality.combine === 'sum') ? risk + (rules[i].risk || 0) : (rules[i].risk || 0);
      reason = rules[i].reason;
    }
  }
  if (!matched) return null;
  return { risk: risk, reason: reason };
}

module.exports = {
  clamp: clamp,
  evalCond: evalCond,
  evalExpr: evalExpr,
  goalCheck: goalCheck,
  goalProgress: goalProgress,
  personalityRisk: personalityRisk
};

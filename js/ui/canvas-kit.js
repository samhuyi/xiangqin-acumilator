/* =========================================================
 * Canvas 绘制工具集（无状态）
 * ---------------------------------------------------------
 * 提供配色、圆角、文字换行等绘制基础能力，供 render.js 使用。
 * 适配竖屏 + 安全区，浅色暖调主题（相亲题材）。
 * ========================================================= */

'use strict';

var PALETTE = {
  bg: '#f6f1ea',
  bgGradTop: '#faf6f0',
  card: '#ffffff',
  text1: '#2b2622',
  text2: '#7d7369',
  text3: '#a89d91',
  line: '#ece4d8',
  primary: '#c95a45',
  primaryDark: '#b04a38',
  accent: '#e0657a',   // 好感 / 女性
  money: '#c9902f',
  health: '#3f9d64',
  career: '#4a7fd4',
  looks: '#a06fcf',
  family: '#c0823c',
  mood: '#3f9f9a',
  up: '#2e9e5b',       // 涨（数值正向）
  down: '#c9554a',     // 跌
  warn: '#d8852f',
  tagBg: '#f1ebe0',
  disabled: '#cfc6b8',
  ghost: '#efe7da'
};

function roundRectPath(ctx, x, y, w, h, r) {
  var rr = Math.min(r || 0, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fillRoundRect(ctx, x, y, w, h, r, fill) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

/* 文本换行：按字符切分（中英混排），返回行数组 */
function wrapText(ctx, text, maxW) {
  var lines = [];
  var chars = String(text).split('');
  var line = '';
  for (var i = 0; i < chars.length; i++) {
    var ch = chars[i];
    var test = line + ch;
    if (ch === '\n') {
      lines.push(line); line = ''; continue;
    }
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/* 多行文本绘制：返回绘制结束后的 y（下一行起始） */
function drawWrapped(ctx, text, x, y, maxW, lineH, color, size, bold) {
  ctx.fillStyle = color || PALETTE.text1;
  setFont(ctx, size || 15, bold);
  var lines = wrapText(ctx, text, maxW);
  for (var i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, y);
    y += lineH || (size || 15) * 1.6;
  }
  return y;
}

function setFont(ctx, size, bold) {
  ctx.font = (bold ? 'bold ' : '') + (size || 15) + 'px sans-serif';
}

module.exports = {
  PALETTE: PALETTE,
  roundRectPath: roundRectPath,
  fillRoundRect: fillRoundRect,
  wrapText: wrapText,
  drawWrapped: drawWrapped,
  setFont: setFont
};

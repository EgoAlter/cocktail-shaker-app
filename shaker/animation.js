// All canvas animation for the shaker sequence.
// Pure visual output — no game logic. All functions are independently swappable.
// Coordinates are in logical (CSS) pixels. All dimensions relative to w/h.

// --- Layout helpers (shared across functions) ---

function shakerRect(w, h) {
  const sw = w * 0.38;
  const sh = h * 0.44;
  const sx = (w - sw) / 2;
  const sy = h * 0.08;
  const lidH = sh * 0.14;
  return { sx, sy, sw, sh, lidH, bodyTop: sy + lidH, bodyBot: sy + sh };
}

function glassRect(w, h, scale = 1) {
  const gTopW = w * 0.34 * scale;
  const gBotW = w * 0.10 * scale;
  const gH    = h * 0.22 * scale;
  const gx    = (w - gTopW) / 2;
  const gy    = h * 0.64;
  return { gx, gy, gTopW, gBotW, gH };
}

// Deterministic colour per ingredient name — avoids needing a colour field on each ingredient.
function ingredientColour(name) {
  const palette = ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#3498db','#9b59b6','#1abc9c','#e91e8c'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return palette[h % palette.length];
}

// --- Public drawing functions ---

/**
 * drawShaker — chunky rectangle shaker body with a lid.
 * lidClosed: 0 = lid floated up (filling open), 1 = lid snapped on (sealed).
 */
export function drawShaker(ctx, w, h, lidClosed = 1) {
  const { sx, sy, sw, sh, lidH } = shakerRect(w, h);
  const lidGap = (1 - lidClosed) * lidH * 1.4;

  // Body
  ctx.fillStyle = '#7a8a8a';
  ctx.beginPath();
  ctx.roundRect(sx, sy + lidH, sw, sh - lidH, [0, 0, 8, 8]);
  ctx.fill();

  // Highlight strip on body
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(sx + sw * 0.12, sy + lidH + 8, sw * 0.08, sh - lidH - 16);

  // Lid (slightly wider, lighter)
  ctx.fillStyle = '#9aabab';
  ctx.beginPath();
  ctx.roundRect(sx - 4, sy - lidGap, sw + 8, lidH + 4, [6, 6, 0, 0]);
  ctx.fill();
}

/**
 * drawIngredient — coloured circle falling into shaker.
 * y: current vertical position (centre of circle).
 */
export function drawIngredient(ctx, w, h, name, y, colour) {
  const r = w * 0.055;
  ctx.beginPath();
  ctx.arc(w / 2, y, r, 0, Math.PI * 2);
  ctx.fillStyle = colour || '#e8d5a3';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Label
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `bold ${Math.floor(w * 0.030)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(name, w / 2, y + r + 4);
}

/**
 * drawLiquid — coloured fill rising inside the shaker body (0–1).
 */
export function drawLiquid(ctx, w, h, fillLevel, colour) {
  if (fillLevel <= 0) return;
  const { sx, sw, bodyTop, bodyBot } = shakerRect(w, h);
  const liquidH = (bodyBot - bodyTop - 8) * fillLevel;
  const liquidY = bodyBot - 4 - liquidH;

  ctx.save();
  // Clip to shaker body interior
  ctx.beginPath();
  ctx.roundRect(sx + 2, bodyTop, sw - 4, bodyBot - bodyTop, [0, 0, 6, 6]);
  ctx.clip();

  ctx.fillStyle = colour || '#e8d5a3';
  ctx.globalAlpha = 0.75;
  ctx.fillRect(sx + 2, liquidY, sw - 4, liquidH + 2);
  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * drawPour — bezier arc of liquid from shaker to glass.
 * progress: 0–1 (pour fill progress, drives opacity and width).
 */
export function drawPour(ctx, w, h, progress, colour) {
  if (progress <= 0) return;
  const { sx, sw, sy, sh } = shakerRect(w, h);
  const { gx, gy, gTopW } = glassRect(w, h);

  // Shaker spout: bottom-centre of tilted shaker
  const startX = sx + sw / 2;
  const startY = sy + sh;
  // Glass rim centre
  const endX = gx + gTopW / 2;
  const endY = gy;
  // Control point (arc mid-point)
  const cpX = (startX + endX) / 2 + w * 0.06;
  const cpY = startY + (endY - startY) * 0.3;

  const lineW = 4 + progress * 6;
  ctx.save();
  ctx.strokeStyle = colour || '#e8d5a3';
  ctx.lineWidth = lineW;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.55 + progress * 0.35;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.quadraticCurveTo(cpX, cpY, endX, endY);
  ctx.stroke();
  ctx.restore();
}

/**
 * drawGlass — trapezoid glass outline + rising liquid fill.
 * fillLevel: 0–1.
 * cx, cy: override centre position (optional).
 */
export function drawGlass(ctx, w, h, fillLevel, colour, cx, cy) {
  const { gx, gy, gTopW, gBotW, gH } = glassRect(w, h);
  const offsetX = cx !== undefined ? cx - (gx + gTopW / 2) : 0;
  const offsetY = cy !== undefined ? cy - gy : 0;

  const x = gx + offsetX;
  const y = gy + offsetY;
  const halfTop = gTopW / 2;
  const halfBot = gBotW / 2;

  // Liquid fill (clipped to glass shape)
  if (fillLevel > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + gTopW, y);
    ctx.lineTo(x + halfTop + halfBot, y + gH);
    ctx.lineTo(x + halfTop - halfBot, y + gH);
    ctx.closePath();
    ctx.clip();

    const fillH = gH * fillLevel;
    ctx.fillStyle = colour || '#e8d5a3';
    ctx.globalAlpha = 0.70;
    ctx.fillRect(x, y + gH - fillH, gTopW, fillH);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Glass outline
  ctx.strokeStyle = 'rgba(255,255,255,0.60)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + gTopW, y);
  ctx.lineTo(x + halfTop + halfBot, y + gH);
  ctx.lineTo(x + halfTop - halfBot, y + gH);
  ctx.closePath();
  ctx.stroke();
}

/**
 * drawShakeEffect — shaker drawn with ctx offset for screen-shake.
 * intensity: 0–1 (drives offset magnitude).
 * lidClosed: passed through to drawShaker.
 */
export function drawShakeEffect(ctx, w, h, intensity) {
  const dx = (Math.random() - 0.5) * intensity * 18;
  const dy = (Math.random() - 0.5) * intensity * 9;
  ctx.save();
  ctx.translate(dx, dy);
  drawShaker(ctx, w, h, 1);
  ctx.restore();
}

/**
 * drawDoneGlass — large centred glass for the DONE screen.
 */
export function drawDoneGlass(ctx, w, h, cocktail) {
  // Larger glass, centred higher on screen to leave room for text below
  const gTopW = w * 0.52;
  const gBotW = w * 0.16;
  const gH    = h * 0.30;
  const x = (w - gTopW) / 2;
  const y = h * 0.24;
  const halfTop = gTopW / 2;
  const halfBot = gBotW / 2;
  const colour = cocktail.colour || '#e8d5a3';

  // Liquid fill
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + gTopW, y);
  ctx.lineTo(x + halfTop + halfBot, y + gH);
  ctx.lineTo(x + halfTop - halfBot, y + gH);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = colour;
  ctx.globalAlpha = 0.75;
  ctx.fillRect(x, y, gTopW, gH);
  ctx.globalAlpha = 1;
  ctx.restore();

  // Glass outline
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + gTopW, y);
  ctx.lineTo(x + halfTop + halfBot, y + gH);
  ctx.lineTo(x + halfTop - halfBot, y + gH);
  ctx.closePath();
  ctx.stroke();

  // Cocktail name
  ctx.fillStyle = '#e8d5a3';
  ctx.font = `bold ${Math.floor(w * 0.09)}px 'Playfair Display', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(cocktail.name, w / 2, y + gH + 24);

  // Description
  const desc = cocktail.description || '';
  ctx.fillStyle = '#777';
  ctx.font = `${Math.floor(w * 0.038)}px sans-serif`;
  ctx.textBaseline = 'top';
  // Simple word-wrap to ~30 chars
  const words = desc.split(' ');
  let line = '';
  let lineY = y + gH + 24 + Math.floor(w * 0.09) + 16;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (test.length > 32 && line) {
      ctx.fillText(line, w / 2, lineY);
      line = word;
      lineY += Math.floor(w * 0.038) + 6;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, w / 2, lineY);
}

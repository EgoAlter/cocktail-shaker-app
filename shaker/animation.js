// All canvas animation for the shaker sequence.
// Pure visual output — no game logic. All functions are independently swappable.
// Coordinates are in logical (CSS) pixels. All dimensions relative to w/h.
//
// Tuning constants — edit these directly in VSCode while the tunnel is live:
const SHAKER_TOP  = 0.12; // fraction of h — shaker top edge (moves shaker up/down)
const GLASS_TOP   = 0.64; // fraction of h — glass top edge (moves glass up/down)

// --- Layout helpers ---

// Exported so engine.js can compute ingredient positions without duplicating the layout.
export function shakerRect(w, h) {
  const sw   = w * 0.38;
  const sh   = h * 0.44;
  const sx   = (w - sw) / 2;
  const sy   = h * SHAKER_TOP;
  const lidH = sh * 0.14;
  return { sx, sy, sw, sh, lidH, bodyTop: sy + lidH, bodyBot: sy + sh };
}

function glassRect(w, h) {
  const gTopW = w * 0.34;
  const gBotW = w * 0.10;
  const gH    = h * 0.22;
  const gx    = (w - gTopW) / 2;
  const gy    = h * GLASS_TOP;
  return { gx, gy, gTopW, gBotW, gH };
}

// Deterministic colour per ingredient name — no per-ingredient colour field needed.
function ingredientColour(name) {
  const palette = ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#3498db','#9b59b6','#1abc9c','#e91e8c'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  return palette[hash % palette.length];
}

// --- Public drawing functions ---

/**
 * drawShaker — filled shaker body + lid (no outline stroke).
 * Call drawShakerStroke after drawing ingredients to put the outline on top.
 * lidClosed: 0 = lid floated up (ingredients can fall in), 1 = sealed.
 */
export function drawShaker(ctx, w, h, lidClosed = 1) {
  const { sx, sy, sw, sh, lidH } = shakerRect(w, h);
  const lidGap = (1 - lidClosed) * lidH * 1.4;

  // Body fill
  ctx.fillStyle = '#7a8a8a';
  ctx.beginPath();
  ctx.roundRect(sx, sy + lidH, sw, sh - lidH, [0, 0, 8, 8]);
  ctx.fill();

  // Highlight strip
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(sx + sw * 0.12, sy + lidH + 8, sw * 0.08, sh - lidH - 16);

  // Lid fill
  ctx.fillStyle = '#9aabab';
  ctx.beginPath();
  ctx.roundRect(sx - 4, sy - lidGap, sw + 8, lidH + 4, [6, 6, 0, 0]);
  ctx.fill();
}

/**
 * drawShakerStroke — outline only, drawn on top of ingredients so they appear
 * contained inside the shaker. Call after all interior content is rendered.
 */
export function drawShakerStroke(ctx, w, h, lidClosed = 1) {
  const { sx, sy, sw, sh, lidH } = shakerRect(w, h);
  const lidGap = (1 - lidClosed) * lidH * 1.4;

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.roundRect(sx, sy + lidH, sw, sh - lidH, [0, 0, 8, 8]);
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(sx - 4, sy - lidGap, sw + 8, lidH + 4, [6, 6, 0, 0]);
  ctx.stroke();

  ctx.restore();
}

/**
 * drawIngredient — coloured circle. Clip to shaker interior before calling so
 * circles disappear when above the shaker opening.
 * y: centre of circle in logical pixels.
 */
export function drawIngredient(ctx, w, h, name, y, colour) {
  const r = w * 0.055;
  ctx.beginPath();
  ctx.arc(w / 2, y, r, 0, Math.PI * 2);
  ctx.fillStyle = colour || '#e8d5a3';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.20)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `bold ${Math.floor(w * 0.028)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(name, w / 2, y + r + 3);
}

/**
 * drawLiquid — coloured fill rising inside the shaker body (0–1).
 * Kept in API for future use; not called during FILLING (no internal liquid animation).
 */
export function drawLiquid(ctx, w, h, fillLevel, colour) {
  if (fillLevel <= 0) return;
  const { sx, sw, bodyTop, bodyBot } = shakerRect(w, h);
  const liquidH = (bodyBot - bodyTop - 8) * fillLevel;
  const liquidY = bodyBot - 4 - liquidH;

  ctx.save();
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
 * drawPour — bezier arc of liquid from shaker bottom to glass rim.
 */
export function drawPour(ctx, w, h, progress, colour) {
  if (progress <= 0) return;
  const { sx, sw, sy, sh } = shakerRect(w, h);
  const { gx, gy, gTopW }  = glassRect(w, h);

  const startX = sx + sw / 2;
  const startY = sy + sh;
  const endX   = gx + gTopW / 2;
  const endY   = gy;
  const cpX    = (startX + endX) / 2 + w * 0.06;
  const cpY    = startY + (endY - startY) * 0.3;

  ctx.save();
  ctx.strokeStyle = colour || '#e8d5a3';
  ctx.lineWidth   = 4 + progress * 6;
  ctx.lineCap     = 'round';
  ctx.globalAlpha = 0.55 + progress * 0.35;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.quadraticCurveTo(cpX, cpY, endX, endY);
  ctx.stroke();
  ctx.restore();
}

/**
 * drawGlass — trapezoid glass with rising liquid fill.
 */
export function drawGlass(ctx, w, h, fillLevel, colour) {
  const { gx, gy, gTopW, gBotW, gH } = glassRect(w, h);
  const halfTop = gTopW / 2;
  const halfBot = gBotW / 2;

  if (fillLevel > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + gTopW, gy);
    ctx.lineTo(gx + halfTop + halfBot, gy + gH);
    ctx.lineTo(gx + halfTop - halfBot, gy + gH);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle   = colour || '#e8d5a3';
    ctx.globalAlpha = 0.70;
    ctx.fillRect(gx, gy + gH * (1 - fillLevel), gTopW, gH * fillLevel);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.60)';
  ctx.lineWidth   = 2.5;
  ctx.beginPath();
  ctx.moveTo(gx, gy);
  ctx.lineTo(gx + gTopW, gy);
  ctx.lineTo(gx + halfTop + halfBot, gy + gH);
  ctx.lineTo(gx + halfTop - halfBot, gy + gH);
  ctx.closePath();
  ctx.stroke();
}

/**
 * drawShakeEffect — shaker body with random translate for screen-shake.
 * intensity: 0–1 drives offset magnitude.
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
 * drawDoneGlass — large centred glass for the DONE screen with name + description.
 */
export function drawDoneGlass(ctx, w, h, cocktail) {
  const gTopW  = w * 0.52;
  const gBotW  = w * 0.16;
  const gH     = h * 0.30;
  const x      = (w - gTopW) / 2;
  const y      = h * 0.20;
  const halfTop = gTopW / 2;
  const halfBot = gBotW / 2;
  const colour = cocktail.colour || '#e8d5a3';

  // Fill
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + gTopW, y);
  ctx.lineTo(x + halfTop + halfBot, y + gH);
  ctx.lineTo(x + halfTop - halfBot, y + gH);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle   = colour;
  ctx.globalAlpha = 0.78;
  ctx.fillRect(x, y, gTopW, gH);
  ctx.globalAlpha = 1;
  ctx.restore();

  // Outline
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth   = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + gTopW, y);
  ctx.lineTo(x + halfTop + halfBot, y + gH);
  ctx.lineTo(x + halfTop - halfBot, y + gH);
  ctx.closePath();
  ctx.stroke();

  // Cocktail name
  const nameY = y + gH + 20;
  ctx.fillStyle     = '#e8d5a3';
  ctx.font          = `bold ${Math.floor(w * 0.09)}px 'Playfair Display', serif`;
  ctx.textAlign     = 'center';
  ctx.textBaseline  = 'top';
  ctx.fillText(cocktail.name, w / 2, nameY);

  // Description — word-wrapped
  const desc  = cocktail.description || '';
  const lineH = Math.floor(w * 0.038) + 6;
  ctx.fillStyle    = '#777';
  ctx.font         = `${Math.floor(w * 0.038)}px sans-serif`;
  const words = desc.split(' ');
  let line = '';
  let lineY = nameY + Math.floor(w * 0.09) + 14;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (test.length > 32 && line) {
      ctx.fillText(line, w / 2, lineY);
      line  = word;
      lineY += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, w / 2, lineY);
}

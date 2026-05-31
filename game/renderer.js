// Pure visual output. No game logic here.
// Called by engine.js each frame with the current state and ctx.

export const Renderer = {
  drawPlaceholder(ctx, w, h, text = 'COCKTAIL SHAKER') {
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#e8d5a3';
    ctx.font = `bold ${Math.floor(w * 0.08)}px 'Playfair Display', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);

    ctx.fillStyle = '#666';
    ctx.font = `${Math.floor(w * 0.035)}px sans-serif`;
    ctx.fillText('Phase 1A — Skeleton', w / 2, h / 2 + w * 0.12);
  },
};

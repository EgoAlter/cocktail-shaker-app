// Pure visual output. No game logic here.
// Called by engine.js each frame with the current state and ctx.

export const Renderer = {
  drawPlaceholder(ctx, canvas, text = 'COCKTAIL SHAKER') {
    // Use clientWidth/clientHeight (CSS logical pixels), not canvas.width/height
    // (physical pixels). The ctx is already scaled by DPR in app.js — all draw
    // coordinates must be in logical pixels or everything lands off-screen on retina.
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

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

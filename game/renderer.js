// Pure visual output. No game logic here.
// Called by engine.js each frame with the current state and ctx.

export const Renderer = {
  drawPlaceholder(ctx, canvas, text = 'COCKTAIL SHAKER') {
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#e8d5a3';
    ctx.font = `bold ${Math.floor(canvas.width * 0.08)}px 'Playfair Display', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    ctx.fillStyle = '#666';
    ctx.font = `${Math.floor(canvas.width * 0.035)}px sans-serif`;
    ctx.fillText('Phase 1A — Skeleton', canvas.width / 2, canvas.height / 2 + canvas.width * 0.12);
  },
};

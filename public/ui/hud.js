// In-shaker HUD — shake progress bar.
// Pure visual output, no game logic.

export const HUD = {
  // progress: 0–1 (shakeCount / SHAKES_REQUIRED)
  // intensity: 0–1 (last shake magnitude, drives pulse brightness)
  drawShakeMeter(ctx, w, h, progress, intensity) {
    const barW = w * 0.6;
    const barH = 10;
    const x = (w - barW) / 2;
    const y = h - 60;
    const radius = barH / 2;

    // Track background
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, radius);
    ctx.fill();

    // Filled portion — pulses brighter on each shake
    if (progress > 0) {
      const brightness = 0.7 + intensity * 0.3;
      ctx.fillStyle = `rgba(232, 213, 163, ${brightness})`;
      ctx.beginPath();
      ctx.roundRect(x, y, barW * progress, barH, radius);
      ctx.fill();
    }

    // Label
    ctx.fillStyle = 'rgba(232,213,163,0.5)';
    ctx.font = `${Math.floor(w * 0.032)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Keep shaking', w / 2, y + barH + 8);
  },
};

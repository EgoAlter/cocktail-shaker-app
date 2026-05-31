// Canvas snapshot → downloadable PNG.
//
// Decision: canvas.toDataURL() + programmatic <a download> click.
// This is the standard Web API approach and works on desktop browsers.
//
// iOS Safari caveat: <a download> does NOT save to Files — it opens a new
// browser tab showing the image. The user must long-press → "Add to Photos"
// to save it. This is an iOS constraint, not a bug. The caller should show
// a hint message on iOS (detect via navigator.userAgent or just always show it).

export function exportCocktailImage(canvas, cocktailName) {
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${cocktailName.replace(/\s+/g, '-').toLowerCase()}.png`;
  a.click();
  a.remove();
}

// Canvas snapshot → native share sheet (Web Share API) with download fallback.
//
// Why Web Share API over <a download>: on iOS Safari, <a download> saves to
// Files, not Photos. navigator.share({ files: [...] }) surfaces the native
// share sheet so the user can save to Photos, AirDrop, send via iMessage, etc.
//
// Why synchronous data URL → Blob: navigator.share() must be called within the
// same call stack as the user gesture (iOS Safari enforces this). canvas.toBlob()
// is callback-based and would break the gesture chain. atob() conversion is
// synchronous, keeping navigator.share() reachable without an await gap.
//
// Why the cocktail image lives on the canvas: engine.js draws it as the DONE
// screen background via getCachedImage(). exportCocktailImage() just snapshots
// the canvas — the image is already there, no async load needed at share time.
//
// Why offscreen canvas: the visible canvas must not be mutated. The name
// overlay is drawn onto a clone, exported from there.
//
// Fallback: <a download> on desktop where navigator.share is unavailable.

const _imageCache = {};

// Called by engine.js at RESULT entry — starts loading the image into cache.
export function preloadCocktailImage(cocktailName) {
  const slug = _cocktailSlug(cocktailName);
  if (_imageCache[slug]) return;
  const img = new Image();
  img.onload = () => { _imageCache[slug] = img; };
  img.src = `/assets/cocktails/${slug}.png`;
}

// Called by engine.js _renderDone() to draw the image onto the canvas.
export function getCachedImage(cocktailName) {
  return _imageCache[_cocktailSlug(cocktailName)] || null;
}

export async function exportCocktailImage(canvas, cocktailName) {
  const slug     = _cocktailSlug(cocktailName);
  const filename = `${slug}.png`;

  // Snapshot the canvas — the cocktail image is already drawn on it by _renderDone().
  const offscreen = document.createElement('canvas');
  offscreen.width  = canvas.width;
  offscreen.height = canvas.height;
  const ctx = offscreen.getContext('2d');
  ctx.drawImage(canvas, 0, 0);

  const w = offscreen.width;
  const h = offscreen.height;
  ctx.fillStyle = 'rgba(0,0,0,0.48)';
  ctx.fillRect(0, h * 0.78, w, h * 0.15);
  ctx.fillStyle = '#e8d5a3';
  ctx.font = `bold ${Math.floor(w * 0.065)}px 'Playfair Display', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(cocktailName, w / 2, h * 0.855);

  const dataUrl = offscreen.toDataURL('image/png');

  if (navigator.share) {
    const blob = _dataUrlToBlob(dataUrl);
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: cocktailName });
        return;
      } catch (err) {
        if (err.name !== 'AbortError') _downloadFallback(dataUrl, filename);
        return;
      }
    }
  }

  _downloadFallback(dataUrl, filename);
}

// Normalise cocktail name to a filename-safe kebab-case slug.
// Handles: accented chars (Piña → pina), 'n' contractions (Dark 'n' Stormy → dark-n-stormy),
// ampersands (Gin & Tonic → gin-and-tonic).
function _cocktailSlug(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/'n'/gi, 'n')
    .replace(/[^a-z0-9\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function _dataUrlToBlob(dataUrl) {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function _downloadFallback(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
  a.remove();
}

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
// Why preloadCocktailImage: the cocktail image must be in _imageCache before the
// share button is tapped. Loading inside the tap handler would introduce an await
// before navigator.share(), breaking the iOS gesture chain. Preload is called
// when _selectedCocktail is set (RESULT entry) — well before the user reaches DONE.
//
// Why offscreen canvas: the visible canvas must not be mutated. The cocktail image
// and name overlay are drawn onto a clone, exported from there.
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

export async function exportCocktailImage(canvas, cocktailName) {
  const slug     = _cocktailSlug(cocktailName);
  const filename = `${slug}.png`;

  const offscreen = document.createElement('canvas');
  offscreen.width  = canvas.width;
  offscreen.height = canvas.height;
  const ctx = offscreen.getContext('2d');

  const img = _imageCache[slug];
  if (img) {
    // Cover-fit: scale to fill canvas, centred.
    const scale  = Math.max(offscreen.width / img.naturalWidth, offscreen.height / img.naturalHeight);
    const drawW  = img.naturalWidth  * scale;
    const drawH  = img.naturalHeight * scale;
    const drawX  = (offscreen.width  - drawW) / 2;
    const drawY  = (offscreen.height - drawH) / 2;
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  } else {
    // Fallback: snapshot the live canvas if image didn't load in time.
    ctx.drawImage(canvas, 0, 0);
  }

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
    .replace(/[̀-ͯ]/g, '')   // strip combining diacritics
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

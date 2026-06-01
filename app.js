// Entry point. Responsibilities: font load gate, canvas sizing with DPR,
// cocktail data fetch, engine init, SW registration.

import { Engine } from './game/engine.js';
import { Renderer } from './game/renderer.js';

const canvas = document.getElementById('canvas');

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  Engine.logicalWidth = w;
  Engine.logicalHeight = h;
}

// matchMedia is used instead of screen.orientation.lock() because
// screen.orientation.lock() is unavailable in iOS Safari. The media query
// listener fires on every orientation change on both iOS and Android,
// requires no permissions, and works equally in Safari and installed PWA mode.
function setupOrientationGuard() {
  const landscape = window.matchMedia('(orientation: landscape)');
  const overlay = document.getElementById('orientation-overlay');

  function onOrientationChange(mq) {
    overlay.style.display = mq.matches ? 'flex' : 'none';
  }

  landscape.addEventListener('change', onOrientationChange);
  onOrientationChange(landscape);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW registration failed:', err);
    });
  }
}

async function waitForFont(family) {
  try {
    await document.fonts.load(`bold 48px '${family}'`);
  } catch {
    // Non-fatal — falls back to system serif.
  }
}

async function fetchCocktails() {
  const resp = await fetch('/api/cocktails');
  if (!resp.ok) throw new Error(`API ${resp.status}`);
  return resp.json();
}

async function main() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  setupOrientationGuard();

  await waitForFont('Playfair Display');

  Engine.init(canvas);

  try {
    Engine.cocktails = await fetchCocktails();
  } catch (err) {
    console.error('Failed to load cocktails:', err);
    Renderer.drawError(
      Engine.ctx,
      Engine.logicalWidth,
      Engine.logicalHeight,
      'Could not reach the bar.'
    );
    return; // Don't start the engine — app can't function without cocktail data
  }

  Engine.start();
  registerServiceWorker();
}

main();

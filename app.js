// Entry point. Responsibilities: font load gate, canvas sizing with DPR, SW registration, engine init.
// DPR scaling pattern ported directly from TiltJump — draws at physical pixel resolution
// so text and lines are crisp on retina screens (iPhone 12 Mini is 3× DPR).

import { Engine } from './game/engine.js';

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
  // Store logical (CSS pixel) dimensions on the engine so all rendering
  // uses the same coordinate space regardless of DPR.
  Engine.logicalWidth = w;
  Engine.logicalHeight = h;
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
    // Font load failure is non-fatal — fall back to system serif.
  }
}

async function main() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  await waitForFont('Playfair Display');

  Engine.init(canvas);
  Engine.start();

  registerServiceWorker();
}

main();

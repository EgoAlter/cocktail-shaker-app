// Full-screen HTML overlays for WELCOME, QUESTIONING, RESULT states.
// HTML overlays sit above the canvas — real buttons, real tap targets.
//
// CSS strategy: inject one <style> block into <head> on first call.
// Keeps overlay CSS co-located with the JS that drives it, and avoids
// adding another file to the SW cache manifest.

const overlay = document.getElementById('overlay');
let _stylesInjected = false;

function _injectStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .screen {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      /* Respect iPhone notch and home indicator */
      padding: max(32px, env(safe-area-inset-top))
               24px
               max(32px, env(safe-area-inset-bottom))
               24px;
      background: #0d0d0d;
      overflow-y: auto;
    }

    .screen__label {
      font-family: sans-serif;
      font-size: 12px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #555;
      margin-bottom: 16px;
    }

    .screen__title {
      font-family: 'Playfair Display', serif;
      font-size: clamp(28px, 9vw, 48px);
      font-weight: 700;
      color: #e8d5a3;
      text-align: center;
      line-height: 1.15;
      margin-bottom: 12px;
    }

    .screen__desc {
      font-family: sans-serif;
      font-size: 16px;
      color: #777;
      text-align: center;
      line-height: 1.6;
      max-width: 300px;
      margin-bottom: 44px;
    }

    .screen__buttons {
      width: 100%;
      max-width: 400px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .btn {
      width: 100%;
      min-height: 56px;
      padding: 14px 20px;
      border: none;
      border-radius: 10px;
      font-family: sans-serif;
      font-size: 17px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      -webkit-tap-highlight-color: transparent;
      transition: opacity 0.1s ease;
    }

    .btn:active { opacity: 0.6; }

    .btn--primary {
      background: #e8d5a3;
      color: #0d0d0d;
    }

    .btn--secondary {
      background: transparent;
      color: #e8d5a3;
      border: 1px solid rgba(232, 213, 163, 0.35);
    }

    .result__swatch {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      margin-bottom: 20px;
      flex-shrink: 0;
    }

    .done-buttons {
      width: 100%;
      padding: 20px 24px max(20px, env(safe-area-inset-bottom));
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
  `;
  document.head.appendChild(style);
}

function _setContent(html) {
  _injectStyles();
  overlay.innerHTML = html;
  overlay.style.display = 'flex';
}

export const Screens = {
  showWelcome(onStart) {
    _setContent(`
      <div class="screen">
        <h1 class="screen__title">Cocktail<br>Shaker</h1>
        <p class="screen__desc">Answer three questions.<br>We'll find your drink.</p>
        <div class="screen__buttons">
          <button class="btn btn--primary" id="btn-start">Tap to begin</button>
        </div>
      </div>
    `);
    document.getElementById('btn-start')
      .addEventListener('click', onStart, { once: true });
  },

  showQuestion(question, questionNumber, totalQuestions, onAnswer) {
    _setContent(`
      <div class="screen">
        <p class="screen__label">Question ${questionNumber} of ${totalQuestions}</p>
        <h1 class="screen__title">${question.text}</h1>
        <div class="screen__buttons">
          ${question.options.map((opt, i) =>
            `<button class="btn btn--primary" data-idx="${i}">${opt}</button>`
          ).join('')}
        </div>
      </div>
    `);
    overlay.querySelectorAll('.btn[data-idx]').forEach((btn) => {
      btn.addEventListener('click', () => onAnswer(btn.textContent.trim()), { once: true });
    });
  },

  showResult(cocktail, onConfirm, onBack) {
    _setContent(`
      <div class="screen">
        <div class="result__swatch" style="background:${cocktail.colour || '#e8d5a3'}"></div>
        <h1 class="screen__title">${cocktail.name}</h1>
        <p class="screen__desc">${cocktail.description || ''}</p>
        <div class="screen__buttons">
          <button class="btn btn--primary" id="btn-confirm">Make it →</button>
          <button class="btn btn--secondary" id="btn-back">Start over</button>
        </div>
      </div>
    `);
    document.getElementById('btn-confirm')
      .addEventListener('click', onConfirm, { once: true });
    document.getElementById('btn-back')
      .addEventListener('click', onBack, { once: true });
  },

  // Bottom-anchored overlay with gradient — canvas is visible above it.
  // Used by DONE state so the filled glass renders behind the action buttons.
  showDone(onDownload, onRestart) {
    _injectStyles();
    overlay.innerHTML = `<div class="done-buttons">
      <button class="btn btn--primary" id="btn-download">Save image</button>
      <button class="btn btn--secondary" id="btn-restart">Start over</button>
    </div>`;
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'flex-end';
    overlay.style.background = 'linear-gradient(transparent 40%, rgba(13,13,13,0.94) 100%)';
    document.getElementById('btn-download').addEventListener('click', onDownload, { once: true });
    document.getElementById('btn-restart').addEventListener('click', onRestart, { once: true });
  },

  hide() {
    overlay.style.display = 'none';
    overlay.style.flexDirection = '';
    overlay.style.justifyContent = '';
    overlay.style.background = '';
    overlay.innerHTML = '';
  },
};

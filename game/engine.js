// State machine + rAF game loop.
// engine.js is the single source of truth for current state.
// Only engine.js calls transition(). Other modules respond via onTransition().
//
// _stateEntered: resets on every transition(). Guards one-time entry side effects.
// _fillingEntered: only resets in _doReset(). Guards animation init per session.
// Teardown contract: _doReset() is the single teardown point. Every state that
// acquires a resource (sensor callback, DOM listener) must release it there.

import { Renderer } from './renderer.js';
import { Screens } from '../ui/screens.js';
import { Questionnaire } from '../bartender/questionnaire.js';
import { QUESTIONS } from '../bartender/questions.js';
import { selectCocktail } from '../bartender/selector.js';
import { SensorManager } from './sensors.js';
import {
  shakerRect,
  drawShaker, drawShakerStroke, drawIngredient,
  drawPour, drawGlass, drawShakeEffect, drawDoneGlass,
} from '../shaker/animation.js';
import { HUD } from '../ui/hud.js';
import { exportCocktailImage } from '../shaker/export.js';

export const STATES = {
  WELCOME:           'WELCOME',
  QUESTIONING:       'QUESTIONING',
  RESULT:            'RESULT',
  FILLING:           'FILLING',
  SEALED:            'SEALED',
  SHAKING:           'SHAKING',
  STILL:             'STILL',
  POURING:           'POURING',
  DONE:              'DONE',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
};

// --- Tuning constants — edit these in VSCode while the tunnel is live ---
const DROP_DURATION         = 0.55;  // seconds per ingredient drop
const LID_CLOSE_SPEED       = 2.8;   // lid closes in ~0.36s
const SHAKE_COUNT_REQUIRED  = 5;     // distinct shake peaks needed
const SHAKE_MIN_DURATION_MS = 2500;  // minimum ms of shaking before completion
const SHAKE_COOLDOWN_MS     = 300;   // min ms between counted peaks (prevents double-counting)
const SWIPE_UP_THRESHOLD    = 40;    // px upward swipe distance to remove lid in SEALED
const POUR_START_GAMMA      = 20;    // degrees of tilt before pour progress accumulates
const POUR_RATE             = 0.35;  // glass fills in ~2.9s of sustained tilt

export const Engine = {
  canvas: null,
  ctx: null,
  state: STATES.WELCOME,
  logicalWidth: 0,
  logicalHeight: 0,
  cocktails: [],
  _selectedCocktail: null,
  _stateEntered: false,

  // --- FILLING ---
  _fillingEntered: false,
  _fillIngredients: [],
  _fillIngredientIdx: 0,
  _fillIngredientTimer: 0,
  _droppedCount: 0,

  // --- SEALED ---
  _lidClosed: 0,
  _sealReady: false,
  _sealTouchStart: null,
  _sealTouchEnd: null,

  // --- SHAKING ---
  _shakeCount: 0,
  _shakeIntensity: 0,
  _shakeDone: false,
  _lastShakePeak: 0,
  _firstShakeTime: 0,

  // --- STILL ---
  _stillReady: false,
  _stillTapHandler: null,

  // --- POURING ---
  _pourProgress: 0,

  // --- PERMISSION_DENIED ---
  _permissionDeniedRetry: null,

  _lastTime: 0,
  _rafId: null,
  _transitionListeners: [],

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  },

  start() {
    this._rafId = requestAnimationFrame((t) => this._loop(t));
  },

  stop() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;
  },

  transition(newState) {
    if (!STATES[newState]) {
      console.warn(`Engine: unknown state "${newState}"`);
      return;
    }
    this.state = newState;
    this._stateEntered = false;
    this._transitionListeners.forEach((fn) => fn(newState));
  },

  onTransition(fn) {
    this._transitionListeners.push(fn);
  },

  // Teardown contract — single point for releasing all session resources.
  _doReset() {
    SensorManager.stop();
    Questionnaire.reset();
    Screens.hide();

    if (this._stillTapHandler) {
      this.canvas.removeEventListener('click', this._stillTapHandler);
      this._stillTapHandler = null;
    }
    this._teardownSealSwipe();
    if (this._permissionDeniedRetry) {
      this.canvas.removeEventListener('click', this._permissionDeniedRetry);
      this._permissionDeniedRetry = null;
    }

    this._selectedCocktail   = null;
    this._fillingEntered      = false;
    this._fillIngredients     = [];
    this._fillIngredientIdx   = 0;
    this._fillIngredientTimer = 0;
    this._droppedCount        = 0;
    this._lidClosed           = 0;
    this._sealReady           = false;
    this._shakeCount          = 0;
    this._shakeIntensity      = 0;
    this._shakeDone           = false;
    this._lastShakePeak       = 0;
    this._firstShakeTime      = 0;
    this._stillReady          = false;
    this._pourProgress        = 0;

    this.transition(STATES.WELCOME);
  },

  _loop(timestamp) {
    const dt = this._lastTime ? Math.min((timestamp - this._lastTime) / 1000, 0.1) : 0;
    this._lastTime = timestamp;
    this._update(dt);
    this._render();
    this._rafId = requestAnimationFrame((t) => this._loop(t));
  },

  _update(dt) {
    switch (this.state) {
      case STATES.FILLING:  this._updateFilling(dt);  break;
      case STATES.SEALED:   this._updateSealed(dt);   break;
      case STATES.SHAKING:  this._updateShaking(dt);  break;
      case STATES.STILL:    this._updateStill(dt);    break;
      case STATES.POURING:  this._updatePouring(dt);  break;
      default: break;
    }
  },

  _render() {
    switch (this.state) {
      case STATES.WELCOME:           this._renderWelcome();          break;
      case STATES.QUESTIONING:       this._renderQuestioning();      break;
      case STATES.RESULT:            this._renderResult();           break;
      case STATES.FILLING:           this._renderFilling();          break;
      case STATES.SEALED:            this._renderSealed();           break;
      case STATES.SHAKING:           this._renderShaking();          break;
      case STATES.STILL:             this._renderStill();            break;
      case STATES.POURING:           this._renderPouring();          break;
      case STATES.DONE:              this._renderDone();             break;
      case STATES.PERMISSION_DENIED: this._renderPermissionDenied(); break;
    }
  },

  // ==========================================================================
  // WELCOME / QUESTIONING / RESULT
  // ==========================================================================

  _renderWelcome() {
    Renderer.drawBackground(this.ctx, this.logicalWidth, this.logicalHeight);
    if (!this._stateEntered) {
      this._stateEntered = true;
      Screens.showWelcome(() => this.transition(STATES.QUESTIONING));
    }
  },

  _renderQuestioning() {
    Renderer.drawBackground(this.ctx, this.logicalWidth, this.logicalHeight);
    if (!this._stateEntered) {
      this._stateEntered = true;
      Questionnaire.init(QUESTIONS);
      this._showNextQuestion();
    }
  },

  _showNextQuestion() {
    const q   = Questionnaire.current();
    const num = Questionnaire.currentIndex + 1;
    Screens.showQuestion(q, num, QUESTIONS.length, (value) => {
      Questionnaire.answer(value);
      if (Questionnaire.isComplete()) {
        this._selectedCocktail = selectCocktail(this.cocktails, Questionnaire.getAnswers());
        this.transition(STATES.RESULT);
      } else {
        this._showNextQuestion();
      }
    });
  },

  _renderResult() {
    Renderer.drawBackground(this.ctx, this.logicalWidth, this.logicalHeight);
    if (!this._stateEntered) {
      this._stateEntered = true;
      const cocktail = this._selectedCocktail;
      if (!cocktail) {
        Screens.showWelcome(() => this.transition(STATES.QUESTIONING));
        return;
      }
      Screens.showResult(
        cocktail,
        // "Make it →" — permission MUST be requested inside this click handler.
        // iOS 13+ checks the activation stack; calling from rAF would silently fail.
        async () => {
          try {
            await SensorManager.requestPermission();
            SensorManager.startOrientation();
            SensorManager.startMotion();
            this.transition(STATES.FILLING);
          } catch (err) {
            console.warn('Motion permission denied:', err);
            this.transition(STATES.PERMISSION_DENIED);
          }
        },
        () => this._doReset()
      );
    }
  },

  // ==========================================================================
  // FILLING — ingredients drop one by one, then transition to SEALED
  // No internal liquid fill — you can't see inside a real shaker.
  // ==========================================================================

  _updateFilling(dt) {
    if (!this._fillingEntered) {
      this._fillingEntered    = true;
      this._fillIngredients   = [...(this._selectedCocktail?.ingredients || ['Spirit', 'Mixer'])];
      this._fillIngredientIdx = 0;
      this._fillIngredientTimer = 0;
      this._droppedCount      = 0;
    }

    if (this._fillIngredientIdx >= this._fillIngredients.length) {
      this.transition(STATES.SEALED);
      return;
    }
    this._fillIngredientTimer += dt;
    if (this._fillIngredientTimer >= DROP_DURATION) {
      this._droppedCount++;
      this._fillIngredientIdx++;
      this._fillIngredientTimer = 0;
    }
  },

  _renderFilling() {
    const { ctx, logicalWidth: w, logicalHeight: h } = this;
    if (!this._stateEntered) {
      this._stateEntered = true;
      Screens.hide();
    }
    Renderer.drawBackground(ctx, w, h);

    // Draw order: shaker body fill → ingredients (clipped inside) → shaker outline.
    // The outline on top ensures ingredients appear contained inside the shaker.
    drawShaker(ctx, w, h, 0);

    // Clip to shaker interior so falling ingredients disappear above the opening.
    const { sx, sw, bodyTop, bodyBot } = shakerRect(w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx + 2, bodyTop, sw - 4, bodyBot - bodyTop);
    ctx.clip();

    // Already-dropped ingredients (stacked inside)
    for (let i = 0; i < this._droppedCount; i++) {
      const name = this._fillIngredients[i] || '';
      const iy   = bodyTop + (bodyBot - bodyTop) * 0.20 + (i % 3) * (bodyBot - bodyTop) * 0.22;
      drawIngredient(ctx, w, h, name, iy, _ingredientColour(name));
    }

    // Currently falling ingredient
    if (this._fillIngredientIdx < this._fillIngredients.length) {
      const t       = this._fillIngredientTimer / DROP_DURATION;
      const eased   = t * t;
      const startY  = bodyTop - (bodyBot - bodyTop) * 0.5;
      const endY    = bodyTop + (bodyBot - bodyTop) * 0.20 + (this._droppedCount % 3) * (bodyBot - bodyTop) * 0.22;
      const currentY = startY + eased * (endY - startY);
      const name    = this._fillIngredients[this._fillIngredientIdx];
      drawIngredient(ctx, w, h, name, currentY, _ingredientColour(name));
    }

    ctx.restore();

    // Shaker outline drawn last — visually contains the ingredients
    drawShakerStroke(ctx, w, h, 0);
  },

  // ==========================================================================
  // SEALED — lid animation, then swipe-up to start shaking
  // ==========================================================================

  _updateSealed(dt) {
    if (!this._sealReady) {
      this._lidClosed = Math.min(1, this._lidClosed + dt * LID_CLOSE_SPEED);
      if (this._lidClosed >= 1) {
        this._sealReady = true;
        this._setupSealSwipe();
      }
    }
  },

  _setupSealSwipe() {
    let touchStartY = 0;
    this._sealTouchStart = (e) => {
      touchStartY = e.touches[0]?.clientY ?? 0;
    };
    this._sealTouchEnd = (e) => {
      const endY = e.changedTouches[0]?.clientY ?? 0;
      if (touchStartY - endY >= SWIPE_UP_THRESHOLD) {
        this._teardownSealSwipe();
        this.transition(STATES.SHAKING);
      }
    };
    this.canvas.addEventListener('touchstart', this._sealTouchStart, { passive: true });
    this.canvas.addEventListener('touchend',   this._sealTouchEnd,   { passive: true });
  },

  _teardownSealSwipe() {
    if (this._sealTouchStart) {
      this.canvas.removeEventListener('touchstart', this._sealTouchStart);
      this._sealTouchStart = null;
    }
    if (this._sealTouchEnd) {
      this.canvas.removeEventListener('touchend', this._sealTouchEnd);
      this._sealTouchEnd = null;
    }
  },

  _renderSealed() {
    const { ctx, logicalWidth: w, logicalHeight: h } = this;
    Renderer.drawBackground(ctx, w, h);
    drawShaker(ctx, w, h, this._lidClosed);
    drawShakerStroke(ctx, w, h, this._lidClosed);

    if (this._sealReady) {
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle    = '#e8d5a3';
      ctx.font         = `bold ${Math.floor(w * 0.09)}px 'Playfair Display', serif`;
      ctx.fillText('Shake it!', w / 2, h * 0.76);

      ctx.fillStyle = '#555';
      ctx.font      = `${Math.floor(w * 0.038)}px sans-serif`;
      ctx.fillText('Swipe up to shake', w / 2, h * 0.84);
    }
  },

  // ==========================================================================
  // SHAKING — count peaks with cooldown + minimum duration, then wait for still
  // ==========================================================================

  _updateShaking(dt) {
    if (!this._stateEntered) {
      this._stateEntered   = true;
      this._shakeCount     = 0;
      this._shakeIntensity = 0;
      this._shakeDone      = false;
      this._lastShakePeak  = 0;
      this._firstShakeTime = 0;

      SensorManager.onShake((magnitude) => {
        if (this._shakeDone) return;
        const now = Date.now();

        // Cooldown prevents counting the same shake motion twice.
        // Use shakeCount > 0 (not lastShakePeak truthiness) — lastShakePeak can be 0
        // on the very first counted shake, making it falsy and bypassing the cooldown.
        if (this._shakeCount > 0 && now - this._lastShakePeak < SHAKE_COOLDOWN_MS) return;

        if (this._shakeCount === 0) this._firstShakeTime = now;
        this._lastShakePeak  = now;
        this._shakeCount++;
        this._shakeIntensity = Math.min(1, magnitude / 35);

        const elapsed = now - this._firstShakeTime;
        if (this._shakeCount >= SHAKE_COUNT_REQUIRED && elapsed >= SHAKE_MIN_DURATION_MS) {
          this._shakeDone = true;
          SensorManager.onShake(null);
          SensorManager.onStill(1500, () => this.transition(STATES.STILL));
        }
      });
    }

    this._shakeIntensity = Math.max(0, this._shakeIntensity - dt * 4);
  },

  _renderShaking() {
    const { ctx, logicalWidth: w, logicalHeight: h } = this;
    Renderer.drawBackground(ctx, w, h);
    drawShakeEffect(ctx, w, h, this._shakeIntensity);

    const progress = Math.min(1, this._shakeCount / SHAKE_COUNT_REQUIRED);
    HUD.drawShakeMeter(ctx, w, h, progress, this._shakeIntensity);
  },

  // ==========================================================================
  // STILL — wait for device to settle, then tap to proceed to POURING
  // ==========================================================================

  _updateStill(dt) {
    if (!this._stateEntered) {
      this._stateEntered = true;
      this._stillReady   = false;
    }
    if (!this._stillReady && SensorManager.isStill(1000)) {
      this._stillReady = true;
      this._stillTapHandler = () => {
        this._stillTapHandler = null;
        this.transition(STATES.POURING);
      };
      this.canvas.addEventListener('click', this._stillTapHandler, { once: true });
    }
  },

  _renderStill() {
    const { ctx, logicalWidth: w, logicalHeight: h } = this;
    Renderer.drawBackground(ctx, w, h);
    drawShaker(ctx, w, h, 1);
    drawShakerStroke(ctx, w, h, 1);

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    if (!this._stillReady) {
      ctx.fillStyle = '#777';
      ctx.font      = `${Math.floor(w * 0.055)}px 'Playfair Display', serif`;
      ctx.fillText('Hold still…', w / 2, h * 0.76);
    } else {
      ctx.fillStyle = '#e8d5a3';
      ctx.font      = `bold ${Math.floor(w * 0.07)}px 'Playfair Display', serif`;
      ctx.fillText('Tap to pour', w / 2, h * 0.76);
    }
  },

  // ==========================================================================
  // POURING — tilt sideways (gamma) accumulates pour progress
  // ==========================================================================

  _updatePouring(dt) {
    // getPour() returns 0–1 where 1 = 90° of lateral tilt.
    // POUR_START_GAMMA (degrees) is the dead zone before accumulation begins.
    const pourValue = SensorManager.getPour();
    if (pourValue > POUR_START_GAMMA / 90) {
      this._pourProgress = Math.min(1, this._pourProgress + dt * POUR_RATE);
    }
    if (this._pourProgress >= 1.0) this.transition(STATES.DONE);
  },

  _renderPouring() {
    const { ctx, logicalWidth: w, logicalHeight: h } = this;
    Renderer.drawBackground(ctx, w, h);

    // Rotate shaker around its centre to suggest the tilting motion.
    const { sy, sh } = shakerRect(w, h);
    const pivotY = sy + sh / 2;
    ctx.save();
    ctx.translate(w / 2, pivotY);
    ctx.rotate(-0.28);
    ctx.translate(-w / 2, -pivotY);
    drawShaker(ctx, w, h, 1);
    drawShakerStroke(ctx, w, h, 1);
    ctx.restore();

    drawPour(ctx, w, h, this._pourProgress, this._selectedCocktail?.colour);
    drawGlass(ctx, w, h, this._pourProgress, this._selectedCocktail?.colour);

    // ↺ "Tilt to pour" — centred between shaker bottom and glass top
    const shakerBottom = sy + sh;
    const { gy }       = _glassTopY(w, h);
    const textMidY     = shakerBottom + (gy - shakerBottom) * 0.45;

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#e8d5a3';
    ctx.font         = `${Math.floor(w * 0.08)}px sans-serif`;
    ctx.fillText('↺', w / 2, textMidY - Math.floor(w * 0.03));

    ctx.font = `bold ${Math.floor(w * 0.048)}px 'Playfair Display', serif`;
    ctx.fillText('Tilt to pour', w / 2, textMidY + Math.floor(w * 0.045));
  },

  // ==========================================================================
  // DONE — filled glass on canvas, overlay buttons
  // ==========================================================================

  _renderDone() {
    const { ctx, logicalWidth: w, logicalHeight: h } = this;
    if (!this._stateEntered) {
      this._stateEntered = true;
      const cocktail = this._selectedCocktail;
      Screens.showDone(
        () => exportCocktailImage(this.canvas, cocktail?.name || 'cocktail'),
        () => this._doReset()
      );
    }
    Renderer.drawBackground(ctx, w, h);
    if (this._selectedCocktail) drawDoneGlass(ctx, w, h, this._selectedCocktail);
  },

  // ==========================================================================
  // PERMISSION_DENIED — tap to retry sensor permission
  // ==========================================================================

  _renderPermissionDenied() {
    const { ctx, logicalWidth: w, logicalHeight: h } = this;
    if (!this._stateEntered) {
      this._stateEntered = true;

      // Re-request permission on tap — this IS a user gesture, so iOS will show
      // the dialog again. If still denied, the message stays and user can tap again
      // or reload the page.
      this._permissionDeniedRetry = async () => {
        try {
          await SensorManager.requestPermission();
          SensorManager.startOrientation();
          SensorManager.startMotion();
          this.canvas.removeEventListener('click', this._permissionDeniedRetry);
          this._permissionDeniedRetry = null;
          this.transition(STATES.FILLING);
        } catch {
          // Still denied — message remains, user can tap again or reload.
        }
      };
      this.canvas.addEventListener('click', this._permissionDeniedRetry);
    }

    Renderer.drawBackground(ctx, w, h);

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#e8d5a3';
    ctx.font         = `bold ${Math.floor(w * 0.075)}px 'Playfair Display', serif`;
    ctx.fillText('Motion access', w / 2, h * 0.35);
    ctx.fillText('needed', w / 2, h * 0.44);

    ctx.fillStyle = '#888';
    ctx.font      = `${Math.floor(w * 0.042)}px sans-serif`;
    ctx.fillText('to shake your drink.', w / 2, h * 0.54);

    ctx.fillStyle = '#e8d5a3';
    ctx.fillText('Tap to try again.', w / 2, h * 0.64);

    ctx.fillStyle = '#555';
    ctx.font      = `${Math.floor(w * 0.032)}px sans-serif`;
    ctx.fillText('If it keeps failing, reload the page.', w / 2, h * 0.73);
  },
};

// Module-level colour helper — mirrors the one in animation.js to keep the
// engine self-contained for ingredient rendering.
function _ingredientColour(name) {
  const palette = ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#3498db','#9b59b6','#1abc9c','#e91e8c'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return palette[h % palette.length];
}

// Tiny helper to access glassRect gy without importing the whole module twice.
function _glassTopY(w, h) {
  // Mirrors GLASS_TOP = 0.64 from animation.js. If you change GLASS_TOP, change this too.
  return { gy: h * 0.64 };
}

// State machine + rAF game loop.
// engine.js is the single source of truth for current state.
// Only engine.js calls transition(). Other modules respond via onTransition().
//
// _stateEntered flag: resets on every transition(). Guards one-time entry side effects
// (showing overlays, hiding overlays) that must not re-run every frame.
//
// _fillingEntered flag: only resets in _doReset(). Guards the animation initialisation
// and sensor start, which must survive accidental re-entry of FILLING.
//
// Teardown contract: _doReset() is the single teardown point. Any state that acquires
// resources (sensors, overlays, tap listeners) must release them there.

import { Renderer } from './renderer.js';
import { Screens } from '../ui/screens.js';
import { Questionnaire } from '../bartender/questionnaire.js';
import { QUESTIONS } from '../bartender/questions.js';
import { selectCocktail } from '../bartender/selector.js';
import { SensorManager } from './sensors.js';
import {
  shakerRect,
  drawShaker, drawIngredient,
  drawPour, drawGlass, drawShakeEffect, drawDoneGlass,
} from '../shaker/animation.js';
import { HUD } from '../ui/hud.js';
import { exportCocktailImage } from '../shaker/export.js';

export const STATES = {
  WELCOME:     'WELCOME',
  QUESTIONING: 'QUESTIONING',
  RESULT:      'RESULT',
  FILLING:     'FILLING',
  SEALED:      'SEALED',
  SHAKING:     'SHAKING',
  STILL:       'STILL',
  POURING:     'POURING',
  DONE:        'DONE',
};

const SHAKES_REQUIRED = 8;   // shakes needed before transitioning to STILL
const POUR_RATE       = 0.35; // glass fills in ~2.9s of sustained tilt
const DROP_DURATION   = 0.55; // seconds per ingredient drop
const LID_CLOSE_SPEED = 2.8;  // lid closes in ~0.36s

export const Engine = {
  canvas: null,
  ctx: null,
  state: STATES.WELCOME,
  logicalWidth: 0,
  logicalHeight: 0,
  cocktails: [],
  _selectedCocktail: null,
  _stateEntered: false,

  // --- FILLING session state ---
  _fillingEntered: false,   // per-session guard; only reset in _doReset()
  _fillIngredients: [],
  _fillIngredientIdx: 0,
  _fillIngredientTimer: 0,
  _droppedCount: 0,

  // --- SEALED session state ---
  _lidClosed: 0,             // 0 = open, 1 = sealed
  _sealReady: false,

  // --- SHAKING session state ---
  _shakeCount: 0,
  _shakeIntensity: 0,
  _shakeDone: false,

  // --- STILL session state ---
  _stillReady: false,
  _stillTapHandler: null,

  // --- POURING session state ---
  _pourProgress: 0,

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

  // Teardown contract — releases all resources acquired during a cocktail session.
  // Called from "Start over" in DONE, and from "Start over" in RESULT.
  _doReset() {
    SensorManager.stop();
    Questionnaire.reset();
    Screens.hide();

    // Clear tap listeners
    if (this._stillTapHandler) {
      this.canvas.removeEventListener('click', this._stillTapHandler);
      this._stillTapHandler = null;
    }

    // Reset all session state
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
      case STATES.WELCOME:     this._renderWelcome();     break;
      case STATES.QUESTIONING: this._renderQuestioning(); break;
      case STATES.RESULT:      this._renderResult();      break;
      case STATES.FILLING:     this._renderFilling();     break;
      case STATES.SEALED:      this._renderSealed();      break;
      case STATES.SHAKING:     this._renderShaking();     break;
      case STATES.STILL:       this._renderStill();       break;
      case STATES.POURING:     this._renderPouring();     break;
      case STATES.DONE:        this._renderDone();        break;
    }
  },

  // ==========================================================================
  // WELCOME / QUESTIONING / RESULT — overlay states (Phase 1C)
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
    const q = Questionnaire.current();
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
        // "Make it →" — request sensor permission while still inside the tap gesture.
        // iOS 13+ requires requestPermission() to be called from within a user gesture.
        // This callback IS the click handler, so the gesture requirement is satisfied.
        async () => {
          try {
            await SensorManager.requestPermission();
            SensorManager.startOrientation();
            SensorManager.startMotion();
          } catch (err) {
            console.warn('Motion permission denied:', err);
            Renderer.drawError(
              this.ctx, this.logicalWidth, this.logicalHeight,
              'Motion access is needed to shake your drink.'
            );
            return;
          }
          this.transition(STATES.FILLING);
        },
        () => {
          this._doReset();
        }
      );
    }
  },

  // ==========================================================================
  // FILLING — ingredients drop one by one, then immediately seal
  // ==========================================================================

  _updateFilling(dt) {
    // _fillingEntered (not _stateEntered) so this runs once per cocktail session,
    // not once per state entry — guards animation state initialisation.
    if (!this._fillingEntered) {
      this._fillingEntered = true;
      this._fillIngredients = [...(this._selectedCocktail?.ingredients || ['Spirit', 'Mixer'])];
      this._fillIngredientIdx   = 0;
      this._fillIngredientTimer = 0;
      this._droppedCount        = 0;
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
    drawShaker(ctx, w, h, 0); // lid open

    const { sh, lidH, bodyTop } = shakerRect(w, h);
    const bodyH = sh - lidH;

    // Falling ingredient — clipped to above bodyTop so it disappears into the shaker
    if (this._fillIngredientIdx < this._fillIngredients.length) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, bodyTop);
      ctx.clip();
      const t        = this._fillIngredientTimer / DROP_DURATION;
      const eased    = t * t; // ease-in (gravity)
      const startY   = -w * 0.07;
      const endY     = bodyTop + bodyH * 0.18 + (this._droppedCount % 3) * (bodyH * 0.22);
      const currentY = startY + eased * (endY - startY);
      const name     = this._fillIngredients[this._fillIngredientIdx];
      drawIngredient(ctx, w, h, name, currentY, _ingredientColour(name));
      ctx.restore();
    }

    ctx.fillStyle = '#e8d5a3';
    ctx.font = `bold ${Math.floor(w * 0.07)}px 'Playfair Display', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Filling your shaker…', w / 2, h * 0.80);
  },

  // ==========================================================================
  // SEALED — lid snap animation + "Shake it!" prompt
  // ==========================================================================

  _updateSealed(dt) {
    if (!this._sealReady) {
      this._lidClosed = Math.min(1, this._lidClosed + dt * LID_CLOSE_SPEED);
      if (this._lidClosed >= 1) {
        this._sealReady = true;
        // First shake transitions to SHAKING
        SensorManager.onShake(() => this.transition(STATES.SHAKING));
      }
    }
  },

  _renderSealed() {
    const { ctx, logicalWidth: w, logicalHeight: h } = this;
    Renderer.drawBackground(ctx, w, h);
    drawShaker(ctx, w, h, this._lidClosed);

    if (this._sealReady) {
      ctx.fillStyle = '#e8d5a3';
      ctx.font = `bold ${Math.floor(w * 0.09)}px 'Playfair Display', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Shake it!', w / 2, h * 0.76);

      ctx.fillStyle = '#555';
      ctx.font = `${Math.floor(w * 0.038)}px sans-serif`;
      ctx.fillText('Give it everything', w / 2, h * 0.84);
    }
  },

  // ==========================================================================
  // SHAKING — count shakes, HUD meter, screen shake visual
  // ==========================================================================

  _updateShaking(dt) {
    if (!this._stateEntered) {
      this._stateEntered = true;
      this._shakeCount     = 0;
      this._shakeIntensity = 0;
      this._shakeDone      = false;

      SensorManager.onShake((magnitude) => {
        if (this._shakeDone) return;
        this._shakeCount++;
        this._shakeIntensity = Math.min(1, magnitude / 35);
        if (this._shakeCount >= SHAKES_REQUIRED) {
          this._shakeDone = true;
          SensorManager.onShake(null); // stop counting
          SensorManager.onStill(1500, () => this.transition(STATES.STILL));
        }
      });
    }

    // Decay intensity between shakes for visual smoothness
    this._shakeIntensity = Math.max(0, this._shakeIntensity - dt * 4);
  },

  _renderShaking() {
    const { ctx, logicalWidth: w, logicalHeight: h } = this;
    Renderer.drawBackground(ctx, w, h);
    drawShakeEffect(ctx, w, h, this._shakeIntensity);

    const progress = Math.min(1, this._shakeCount / SHAKES_REQUIRED);
    HUD.drawShakeMeter(ctx, w, h, progress, this._shakeIntensity);
  },

  // ==========================================================================
  // STILL — wait for device to settle, then prompt to pour
  // ==========================================================================

  _updateStill(dt) {
    if (!this._stateEntered) {
      this._stateEntered = true;
      this._stillReady   = false;
    }

    if (!this._stillReady && SensorManager.isStill(1000)) {
      this._stillReady = true;
      // Add tap listener on canvas to start pour
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

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (!this._stillReady) {
      ctx.fillStyle = '#777';
      ctx.font = `${Math.floor(w * 0.055)}px 'Playfair Display', serif`;
      ctx.fillText('Hold still…', w / 2, h * 0.76);
    } else {
      ctx.fillStyle = '#e8d5a3';
      ctx.font = `bold ${Math.floor(w * 0.07)}px 'Playfair Display', serif`;
      ctx.fillText('Tap to pour', w / 2, h * 0.76);

      ctx.fillStyle = '#555';
      ctx.font = `${Math.floor(w * 0.038)}px sans-serif`;
      ctx.fillText('Tilt the phone forward to pour', w / 2, h * 0.84);
    }
  },

  // ==========================================================================
  // POURING — tilt accumulates pour progress
  // ==========================================================================

  _updatePouring(dt) {
    const tilt = SensorManager.getPour();
    // Pour accumulates as a rate while phone is tilted past threshold.
    // User must hold the tilt for ~2.5s — intentional, not accidental.
    if (tilt > 0.28) {
      this._pourProgress = Math.min(1, this._pourProgress + dt * POUR_RATE);
    }
    if (this._pourProgress >= 1.0) this.transition(STATES.DONE);
  },

  _renderPouring() {
    const { ctx, logicalWidth: w, logicalHeight: h } = this;
    Renderer.drawBackground(ctx, w, h);

    // Shaker slightly rotated to suggest tilting — pivot at shaker centre
    const { sy: pourSY, sh: pourSH } = shakerRect(w, h);
    const pourPivotY = pourSY + pourSH / 2;
    ctx.save();
    ctx.translate(w / 2, pourPivotY);
    ctx.rotate(-0.28); // ~16 degrees
    ctx.translate(-w / 2, -pourPivotY);
    drawShaker(ctx, w, h, 1);
    ctx.restore();

    drawPour(ctx, w, h, this._pourProgress, this._selectedCocktail?.colour);
    drawGlass(ctx, w, h, this._pourProgress, this._selectedCocktail?.colour);

    // Instruction text
    ctx.fillStyle = '#e8d5a3';
    ctx.font = `${Math.floor(w * 0.040)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Tilt to pour', w / 2, h * 0.92);
  },

  // ==========================================================================
  // DONE — filled glass on canvas + download/restart overlay
  // ==========================================================================

  _renderDone() {
    const { ctx, logicalWidth: w, logicalHeight: h } = this;
    if (!this._stateEntered) {
      this._stateEntered = true;
      const cocktail = this._selectedCocktail;

      Screens.showDone(
        () => {
          // iOS Safari: <a download> opens image in new tab — user must long-press → save.
          // Desktop: downloads normally.
          exportCocktailImage(this.canvas, cocktail?.name || 'cocktail');
        },
        () => this._doReset()
      );
    }
    Renderer.drawBackground(ctx, w, h);
    if (this._selectedCocktail) {
      drawDoneGlass(ctx, w, h, this._selectedCocktail);
    }
  },
};

// Module-level helper — avoids importing into animation.js
function _ingredientColour(name) {
  const palette = ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#3498db','#9b59b6','#1abc9c','#e91e8c'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return palette[h % palette.length];
}

// State machine + rAF game loop.
// engine.js is the single source of truth for current state.
// Only engine.js calls transition(). Other modules call engine.setState() or listen via onTransition().

import { Renderer } from './renderer.js';

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

export const Engine = {
  canvas: null,
  ctx: null,
  state: STATES.WELCOME,
  logicalWidth: 0,
  logicalHeight: 0,
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
    this._transitionListeners.forEach((fn) => fn(newState));
  },

  onTransition(fn) {
    this._transitionListeners.push(fn);
  },

  _loop(timestamp) {
    const dt = this._lastTime ? (timestamp - this._lastTime) / 1000 : 0;
    this._lastTime = timestamp;

    this._update(dt);
    this._render();

    this._rafId = requestAnimationFrame((t) => this._loop(t));
  },

  _update(dt) {
    switch (this.state) {
      case STATES.WELCOME:     this._updateWelcome(dt);     break;
      case STATES.QUESTIONING: this._updateQuestioning(dt); break;
      case STATES.RESULT:      this._updateResult(dt);      break;
      case STATES.FILLING:     this._updateFilling(dt);     break;
      case STATES.SEALED:      this._updateSealed(dt);      break;
      case STATES.SHAKING:     this._updateShaking(dt);     break;
      case STATES.STILL:       this._updateStill(dt);       break;
      case STATES.POURING:     this._updatePouring(dt);     break;
      case STATES.DONE:        this._updateDone(dt);        break;
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

  // --- State update stubs ---
  _updateWelcome(dt)     {},
  _updateQuestioning(dt) {},
  _updateResult(dt)      {},
  _updateFilling(dt)     {},
  _updateSealed(dt)      {},
  _updateShaking(dt)     {},
  _updateStill(dt)       {},
  _updatePouring(dt)     {},
  _updateDone(dt)        {},

  // --- State render stubs ---
  _renderWelcome()     { Renderer.drawPlaceholder(this.ctx, this.logicalWidth, this.logicalHeight, 'WELCOME'); },
  _renderQuestioning() { Renderer.drawPlaceholder(this.ctx, this.logicalWidth, this.logicalHeight, 'QUESTIONING'); },
  _renderResult()      { Renderer.drawPlaceholder(this.ctx, this.logicalWidth, this.logicalHeight, 'RESULT'); },
  _renderFilling()     { Renderer.drawPlaceholder(this.ctx, this.logicalWidth, this.logicalHeight, 'FILLING'); },
  _renderSealed()      { Renderer.drawPlaceholder(this.ctx, this.logicalWidth, this.logicalHeight, 'SEALED'); },
  _renderShaking()     { Renderer.drawPlaceholder(this.ctx, this.logicalWidth, this.logicalHeight, 'SHAKING'); },
  _renderStill()       { Renderer.drawPlaceholder(this.ctx, this.logicalWidth, this.logicalHeight, 'STILL'); },
  _renderPouring()     { Renderer.drawPlaceholder(this.ctx, this.logicalWidth, this.logicalHeight, 'POURING'); },
  _renderDone()        { Renderer.drawPlaceholder(this.ctx, this.logicalWidth, this.logicalHeight, 'DONE'); },
};

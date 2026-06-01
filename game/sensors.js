// SensorManager — ported from TiltJump, extended with pour detection.
// Do not modify the inherited API surface. See CLAUDE.md for the full contract.

export const SensorManager = {
  _tilt: 0,
  _smoothedTilt: 0,
  _smoothedGamma: 0,      // raw gamma (no calibration offset) — used by getPour()
  _lastMotionTime: 0,
  _calibrationOffset: 0,
  _shakeCallback: null,
  _stillCallback: null,
  _stillMs: 0,
  _shakingStartTime: null, // timestamp of first spike in current shake run
  _minShakeDurationMs: 2000,
  _orientationHandler: null,
  _motionHandler: null,
  _alpha: 0.2, // EMA smoothing factor

  async requestPermission() {
    // iOS 13+ requires explicit permission for DeviceMotion/DeviceOrientation.
    // MUST be called synchronously within a user gesture handler (tap/click).
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      const result = await DeviceMotionEvent.requestPermission();
      if (result !== 'granted') throw new Error('Motion permission denied');
    }
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      await DeviceOrientationEvent.requestPermission();
    }
  },

  startOrientation() {
    this._orientationHandler = (e) => {
      const rawGamma = e.gamma ?? 0;

      // Calibrated tilt for getTilt() (left/right lean, ±1 over ±45°)
      const calibrated = rawGamma - this._calibrationOffset;
      this._smoothedTilt = this._alpha * calibrated + (1 - this._alpha) * this._smoothedTilt;
      this._tilt = Math.max(-1, Math.min(1, this._smoothedTilt / 45));

      // Raw gamma for getPour() — no calibration offset, physical vertical is the reference
      this._smoothedGamma = this._alpha * rawGamma + (1 - this._alpha) * this._smoothedGamma;
    };
    window.addEventListener('deviceorientation', this._orientationHandler);
  },

  startMotion() {
    // Initialise to now so isStill() is measured from sensor start, not from epoch.
    this._lastMotionTime = Date.now();
    this._motionHandler = (e) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const magnitude = Math.sqrt((acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2);
      const now = Date.now();

      // Reset shake run if gap between spikes exceeds 500ms (shake was interrupted)
      if (this._shakingStartTime !== null && now - this._lastMotionTime > 500) {
        this._shakingStartTime = null;
      }

      const SHAKE_THRESHOLD = 15;
      if (magnitude > SHAKE_THRESHOLD) {
        if (this._shakingStartTime === null) this._shakingStartTime = now;
        this._lastMotionTime = now;
        if (this._shakeCallback) this._shakeCallback(magnitude);
      }
      if (this._stillCallback && this.isStill(this._stillMs)) {
        const cb = this._stillCallback;
        this._stillCallback = null;
        cb();
      }
    };
    window.addEventListener('devicemotion', this._motionHandler);
  },

  calibrate() {
    this._calibrationOffset = this._smoothedTilt * 45;
  },

  getTilt() {
    return this._tilt;
  },

  onShake(callback) {
    this._shakeCallback = callback;
  },

  isStill(ms) {
    return Date.now() - this._lastMotionTime > ms;
  },

  isShakingLongEnough() {
    return this._shakingStartTime !== null &&
      Date.now() - this._shakingStartTime >= this._minShakeDurationMs;
  },

  getPour() {
    // gamma goes negative (toward −90°) as phone rotates anti-clockwise in portrait —
    // the natural pouring gesture when holding a shaker in the right hand.
    // Map 0° → −90° to pour progress 0 → 1. Clamp at both ends.
    return Math.max(0, Math.min(1, -this._smoothedGamma / 90));
  },

  onStill(ms, callback) {
    this._stillMs = ms;
    this._stillCallback = callback;
  },

  stop() {
    if (this._orientationHandler) {
      window.removeEventListener('deviceorientation', this._orientationHandler);
      this._orientationHandler = null;
    }
    if (this._motionHandler) {
      window.removeEventListener('devicemotion', this._motionHandler);
      this._motionHandler = null;
    }
    this._shakeCallback    = null;
    this._stillCallback    = null;
    this._shakingStartTime = null;
  },
};

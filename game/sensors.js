// SensorManager — ported from TiltJump, extended with pour detection.
// Do not modify the inherited API surface. See CLAUDE.md for the full contract.

export const SensorManager = {
  _tilt: 0,
  _smoothedTilt: 0,
  _smoothedAbsGamma: 0,   // EMA of |gamma|, used by getPour()
  _lastMotionTime: 0,
  _calibrationOffset: 0,
  _shakeCallback: null,
  _stillCallback: null,
  _stillMs: 0,
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
      // gamma: left/right roll, used for both tilt (TiltJump) and pour detection.
      const rawGamma = e.gamma ?? 0;

      // Calibrated tilt for TiltJump-style left/right tracking.
      const raw = rawGamma - this._calibrationOffset;
      this._smoothedTilt = this._alpha * raw + (1 - this._alpha) * this._smoothedTilt;
      this._tilt = Math.max(-1, Math.min(1, this._smoothedTilt / 45));

      // Absolute (uncalibrated) gamma for pour detection.
      // abs() so tilting either left or right both register as pouring.
      this._smoothedAbsGamma = this._alpha * Math.abs(rawGamma) + (1 - this._alpha) * this._smoothedAbsGamma;
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
      const SHAKE_THRESHOLD = 15;
      if (magnitude > SHAKE_THRESHOLD) {
        this._lastMotionTime = Date.now();
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

  getPour() {
    // Pour uses gamma (roll axis — tilting the phone sideways like tipping a shaker).
    // abs() means left or right tilt both count.
    // Map 0°–90° to 0–1. POUR_START_GAMMA in engine.js is the threshold before
    // accumulation begins — tune that constant, not this function.
    return Math.max(0, Math.min(1, this._smoothedAbsGamma / 90));
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
    this._shakeCallback = null;
    this._stillCallback = null;
  },
};

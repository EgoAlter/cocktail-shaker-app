// SensorManager — ported from TiltJump, extended with pour detection.
// Do not modify the inherited API surface. See CLAUDE.md for the full contract.

export const SensorManager = {
  _tilt: 0,
  _smoothedTilt: 0,
  _beta: 0,
  _smoothedBeta: 0,
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
      const raw = (e.gamma ?? 0) - this._calibrationOffset;
      this._smoothedTilt = this._alpha * raw + (1 - this._alpha) * this._smoothedTilt;
      this._tilt = Math.max(-1, Math.min(1, this._smoothedTilt / 45));

      const rawBeta = e.beta ?? 0;
      this._smoothedBeta = this._alpha * rawBeta + (1 - this._alpha) * this._smoothedBeta;
      this._beta = this._smoothedBeta;
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
    // beta increases as phone tilts forward (nodding = pouring).
    // Map 0–90° of forward tilt to 0–1.
    const clamped = Math.max(0, Math.min(90, this._beta));
    return clamped / 90;
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

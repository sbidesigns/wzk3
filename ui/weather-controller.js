// ui/weather-controller.js — Weather System Controller (Cycle 51)
// Manages dynamic weather effects during races
// CSS: ui/styles/weather-effects.css (created in Cycle 48)
//
// Weather types: clear, rain, sandstorm, fog, snow, wind
// Features: automatic transitions, intensity control, HUD indicator,
//          physics-affecting parameters, toast notifications

/**
 * @enum {string}
 * Available weather types
 */
export const WEATHER_TYPE = {
  CLEAR: 'clear',
  RAIN: 'rain',
  SANDSTORM: 'sandstorm',
  FOG: 'fog',
  SNOW: 'snow',
  WIND: 'wind'
};

/**
 * Weather physics parameters that affect gameplay
 */
const WEATHER_PHYSICS = {
  [WEATHER_TYPE.CLEAR]:   { grip: 1.0, visibility: 1.0, maxSpeed: 1.0, drag: 1.0 },
  [WEATHER_TYPE.RAIN]:    { grip: 0.75, visibility: 0.8, maxSpeed: 0.92, drag: 1.05 },
  [WEATHER_TYPE.SANDSTORM]: { grip: 0.6, visibility: 0.5, maxSpeed: 0.8, drag: 1.15 },
  [WEATHER_TYPE.FOG]:     { grip: 0.9, visibility: 0.4, maxSpeed: 0.85, drag: 1.02 },
  [WEATHER_TYPE.SNOW]:    { grip: 0.65, visibility: 0.7, maxSpeed: 0.88, drag: 1.08 },
  [WEATHER_TYPE.WIND]:    { grip: 0.85, visibility: 0.95, maxSpeed: 0.95, drag: 1.1 }
};

/**
 * @class WeatherController
 * Manages weather state, transitions, and effects during gameplay
 */
class WeatherController {
  constructor() {
    this._currentWeather = WEATHER_TYPE.CLEAR;
    this._previousWeather = null;
    this._intensity = 0; // 0-1
    this._targetIntensity = 0;
    this._transitioning = false;
    this._transitionTimer = 0;
    this._transitionDuration = 3.0; // seconds
    this._autoWeather = false;
    this._autoInterval = 30; // seconds between changes
    this._autoTimer = 0;
    this._hudIndicator = null;
    this._toastEl = null;
    this._listener = null;
  }

  /**
   * Initialize the weather controller
   */
  init() {
    this._createHudIndicator();
    this._createToast();
    console.log('[Weather] Controller initialized');
    return this;
  }

  /**
   * Set weather type with optional intensity and transition
   * @param {string} weatherType - One of WEATHER_TYPE values
   * @param {Object} options - { intensity: 0-1, transition: seconds }
   */
  setWeather(weatherType, options = {}) {
    if (!WEATHER_PHYSICS[weatherType]) {
      console.warn('[Weather] Unknown weather type:', weatherType);
      return this;
    }

    this._previousWeather = this._currentWeather;
    this._currentWeather = weatherType;
    this._targetIntensity = options.intensity ?? 0.7;

    // Start transition if duration specified
    if (options.transition && options.transition > 0) {
      this._transitioning = true;
      this._transitionDuration = options.transition;
      this._transitionTimer = 0;
    } else {
      this._intensity = this._targetIntensity;
    }

    this._applyWeatherClasses();
    this._updateHudIndicator();
    this._showToast(weatherType);

    this._emit('weather:change', {
      type: weatherType,
      intensity: this._targetIntensity,
      previous: this._previousWeather,
      physics: this.getPhysicsParams()
    });

    return this;
  }

  /**
   * Get current physics parameters (multiplied by intensity)
   */
  getPhysicsParams() {
    const base = WEATHER_PHYSICS[this._currentWeather];
    if (!base) return WEATHER_PHYSICS[WEATHER_TYPE.CLEAR];

    // Blend between clear and current weather based on intensity
    const clear = WEATHER_PHYSICS[WEATHER_TYPE.CLEAR];
    const i = this._intensity;
    return {
      grip: clear.grip + (base.grip - clear.grip) * i,
      visibility: clear.visibility + (base.visibility - clear.visibility) * i,
      maxSpeed: clear.maxSpeed + (base.maxSpeed - clear.maxSpeed) * i,
      drag: clear.drag + (base.drag - clear.drag) * i
    };
  }

  /**
   * Enable/disable automatic weather changes
   */
  setAutoWeather(enabled, interval = 30) {
    this._autoWeather = enabled;
    this._autoInterval = interval;
    this._autoTimer = 0;
    return this;
  }

  /**
   * Update weather state (call each frame)
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    // Handle intensity transition
    if (this._transitioning) {
      this._transitionTimer += dt;
      const t = Math.min(1, this._transitionTimer / this._transitionDuration);
      this._intensity = this._targetIntensity * t;
      if (t >= 1) this._transitioning = false;
    }

    // Auto weather cycle
    if (this._autoWeather) {
      this._autoTimer += dt;
      if (this._autoTimer >= this._autoInterval) {
        this._autoTimer = 0;
        this._cycleToNextWeather();
      }
    }
  }

  /**
   * Get current weather type
   */
  get currentWeather() { return this._currentWeather; }

  /**
   * Get current intensity (0-1)
   */
  get intensity() { return this._intensity; }

  // ==================== PRIVATE METHODS ====================

  _applyWeatherClasses() {
    document.body.classList.remove('weather-rain', 'weather-sandstorm', 'weather-fog', 'weather-snow', 'weather-wind', 'weather-clear');
    if (this._currentWeather !== WEATHER_TYPE.CLEAR) {
      document.body.classList.add('weather-' + this._currentWeather);
    } else {
      document.body.classList.add('weather-clear');
    }
  }

  _createHudIndicator() {
    if (this._hudIndicator) return;
    var el = document.createElement('div');
    el.className = 'weather-hud-indicator';
    el.id = 'weather-hud-indicator';
    el.innerHTML = '<span class="weather-icon" id="weather-icon">\u2600</span>' +
      '<span class="weather-name" id="weather-name">CLEAR</span>';
    el.style.cssText = 'position:fixed;top:90px;left:50%;transform:translateX(-50%);z-index:101;pointer-events:none;display:flex;align-items:center;gap:6px;font-family:Inter,sans-serif;font-size:10px;color:rgba(255,255,255,0.4);letter-spacing:2px;text-transform:uppercase;opacity:0;transition:opacity 0.5s ease;';
    document.body.appendChild(el);
    this._hudIndicator = el;
  }

  _updateHudIndicator() {
    if (!this._hudIndicator) return;
    var icons = {
      [WEATHER_TYPE.CLEAR]: '\u2600',
      [WEATHER_TYPE.RAIN]: '\uD83C\uDF27',
      [WEATHER_TYPE.SANDSTORM]: '\uD83C\uDFDC',
      [WEATHER_TYPE.FOG]: '\uD83C\uDF2B',
      [WEATHER_TYPE.SNOW]: '\u2744',
      [WEATHER_TYPE.WIND]: '\uD83C\uDF2C'
    };
    var names = {
      [WEATHER_TYPE.CLEAR]: 'CLEAR',
      [WEATHER_TYPE.RAIN]: 'RAIN',
      [WEATHER_TYPE.SANDSTORM]: 'SANDSTORM',
      [WEATHER_TYPE.FOG]: 'FOG',
      [WEATHER_TYPE.SNOW]: 'SNOW',
      [WEATHER_TYPE.WIND]: 'WIND'
    };
    var icon = this._hudIndicator.querySelector('#weather-icon');
    var name = this._hudIndicator.querySelector('#weather-name');
    if (icon) icon.textContent = icons[this._currentWeather] || '\u2600';
    if (name) name.textContent = names[this._currentWeather] || 'CLEAR';
    // Show indicator briefly
    this._hudIndicator.style.opacity = '1';
    if (this._hudTimeout) clearTimeout(this._hudTimeout);
    this._hudTimeout = setTimeout(() => {
      if (this._hudIndicator) this._hudIndicator.style.opacity = '0.4';
    }, 3000);
  }

  _createToast() {
    if (this._toastEl) return;
    var el = document.createElement('div');
    el.className = 'weather-toast';
    el.id = 'weather-toast';
    el.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%) translateY(-100%);z-index:200;pointer-events:none;padding:10px 24px;background:rgba(10,12,20,0.85);backdrop-filter:blur(12px);border:1px solid rgba(0,229,255,0.2);border-radius:8px;font-family:Inter,sans-serif;font-size:12px;color:rgba(255,255,255,0.7);letter-spacing:1px;transition:transform 0.4s cubic-bezier(0.34,1.56,0.64,1),opacity 0.4s ease;opacity:0;white-space:nowrap;';
    document.body.appendChild(el);
    this._toastEl = el;
  }

  _showToast(weatherType) {
    if (!this._toastEl) return;
    var messages = {
      [WEATHER_TYPE.CLEAR]: 'Weather clearing up',
      [WEATHER_TYPE.RAIN]: 'Rain incoming — reduced grip',
      [WEATHER_TYPE.SANDSTORM]: 'Sandstorm approaching — low visibility',
      [WEATHER_TYPE.FOG]: 'Dense fog rolling in',
      [WEATHER_TYPE.SNOW]: 'Snowfall starting — slippery roads',
      [WEATHER_TYPE.WIND]: 'Strong winds detected'
    };
    this._toastEl.textContent = messages[weatherType] || 'Weather changing';
    this._toastEl.style.transform = 'translateX(-50%) translateY(0)';
    this._toastEl.style.opacity = '1';
    if (this._toastTimeout) clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      if (this._toastEl) {
        this._toastEl.style.transform = 'translateX(-50%) translateY(-100%)';
        this._toastEl.style.opacity = '0';
      }
    }, 3000);
  }

  _cycleToNextWeather() {
    var types = Object.values(WEATHER_TYPE);
    var idx = types.indexOf(this._currentWeather);
    var next = types[(idx + 1) % types.length];
    this.setWeather(next, { intensity: 0.4 + Math.random() * 0.4, transition: 3.0 });
  }

  _emit(event, data) {
    document.dispatchEvent(new CustomEvent(event, { detail: data }));
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this._hudIndicator && this._hudIndicator.parentNode) this._hudIndicator.remove();
    if (this._toastEl && this._toastEl.parentNode) this._toastEl.remove();
    document.body.classList.remove('weather-rain', 'weather-sandstorm', 'weather-fog', 'weather-snow', 'weather-wind', 'weather-clear');
    this._hudIndicator = null;
    this._toastEl = null;
  }
}

// Singleton
let _instance = null;

export function getWeatherController() {
  if (!_instance) {
    _instance = new WeatherController();
  }
  return _instance;
}

if (typeof window !== 'undefined') {
  window.__weatherController = getWeatherController();
}

export default getWeatherController();

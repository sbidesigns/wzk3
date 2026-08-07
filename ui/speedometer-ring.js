// ui/speedometer-ring.js — SVG Speedometer Ring Controller (Cycle 51)
// Drives the SVG arc speedometer defined in speedometer-ring.css
// Replaces/enhances the canvas gauge in race-scene.js

/**
 * @class SpeedometerRing
 * SVG-based speedometer with animated needle, color zones, gear indicator,
 * and critical-speed pulse effect.
 */
class SpeedometerRing {
  constructor(options = {}) {
    this._container = options.container || document.body;
    this._maxSpeed = options.maxSpeed || 300;
    this._dangerZone = options.dangerZone || 0.85; // 85% = critical
    this._currentSpeed = 0;
    this._displaySpeed = 0;
    this._element = null;
    this._arcPath = null;
    this._needleEl = null;
    this._speedTextEl = null;
    this._gearTextEl = null;
    this._unitTextEl = null;
    this._critical = false;
    this._size = options.size || 200;
    this._strokeWidth = options.strokeWidth || 8;
    this._visible = false;
  }

  /**
   * Create and mount the SVG speedometer ring
   */
  init() {
    if (this._element) return this;

    var svgNS = 'http://www.w3.org/2000/svg';
    var size = this._size;
    var cx = size / 2;
    var cy = size / 2;
    var r = (size / 2) - (this._strokeWidth + 4);
    var circumference = 2 * Math.PI * r;

    // Arc goes from 135deg to 405deg (270deg sweep)
    var startAngle = 135;
    var endAngle = 405;
    var sweepAngle = endAngle - startAngle;

    var el = document.createElement('div');
    el.className = 'speedometer-ring-container';
    el.id = 'speedometer-ring';
    el.style.cssText = 'position:fixed;bottom:24px;left:24px;z-index:101;pointer-events:none;opacity:0;transition:opacity 0.5s ease;';

    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.style.cssText = 'display:block;filter:drop-shadow(0 0 12px rgba(0,229,255,0.15));';

    // Background track
    var bgArc = document.createElementNS(svgNS, 'path');
    bgArc.setAttribute('d', this._describeArc(cx, cy, r, startAngle, endAngle));
    bgArc.setAttribute('fill', 'none');
    bgArc.setAttribute('stroke', 'rgba(255,255,255,0.06)');
    bgArc.setAttribute('stroke-width', String(this._strokeWidth));
    bgArc.setAttribute('stroke-linecap', 'round');
    svg.appendChild(bgArc);

    // Color zone markers (danger, warning, safe)
    var zones = [
      { start: 0, end: 0.6, color: 'rgba(0,255,136,0.08)' },     // safe - green
      { start: 0.6, end: 0.85, color: 'rgba(255,210,63,0.08)' },  // caution - gold
      { start: 0.85, end: 1.0, color: 'rgba(255,77,46,0.08)' }   // danger - red
    ];
    zones.forEach(function(zone) {
      var zStart = startAngle + sweepAngle * zone.start;
      var zEnd = startAngle + sweepAngle * zone.end;
      var zArc = document.createElementNS(svgNS, 'path');
      zArc.setAttribute('d', this._describeArc(cx, cy, r, zStart, zEnd));
      zArc.setAttribute('fill', 'none');
      zArc.setAttribute('stroke', zone.color);
      zArc.setAttribute('stroke-width', String(this._strokeWidth + 4));
      zArc.setAttribute('stroke-linecap', 'round');
      svg.appendChild(zArc);
    }.bind(this));

    // Active arc (speed fill)
    var arcPath = document.createElementNS(svgNS, 'path');
    arcPath.setAttribute('d', this._describeArc(cx, cy, r, startAngle, startAngle + 1));
    arcPath.setAttribute('fill', 'none');
    arcPath.setAttribute('stroke', '#00e5ff');
    arcPath.setAttribute('stroke-width', String(this._strokeWidth));
    arcPath.setAttribute('stroke-linecap', 'round');
    arcPath.style.transition = 'stroke 0.3s ease';
    arcPath.id = 'speedo-arc';
    svg.appendChild(arcPath);
    this._arcPath = arcPath;

    // Needle
    var needleLen = r - 12;
    var nx1 = cx + needleLen * Math.cos((startAngle * Math.PI) / 180);
    var ny1 = cy + needleLen * Math.sin((startAngle * Math.PI) / 180);
    var needle = document.createElementNS(svgNS, 'line');
    needle.setAttribute('x1', String(cx));
    needle.setAttribute('y1', String(cy));
    needle.setAttribute('x2', String(nx1));
    needle.setAttribute('y2', String(ny1));
    needle.setAttribute('stroke', '#fff');
    needle.setAttribute('stroke-width', '2');
    needle.setAttribute('stroke-linecap', 'round');
    needle.style.filter = 'drop-shadow(0 0 4px rgba(255,255,255,0.5))';
    needle.style.transition = 'all 0.15s ease-out';
    needle.id = 'speedo-needle';
    svg.appendChild(needle);
    this._needleEl = needle;

    // Center dot
    var dot = document.createElementNS(svgNS, 'circle');
    dot.setAttribute('cx', String(cx));
    dot.setAttribute('cy', String(cy));
    dot.setAttribute('r', '4');
    dot.setAttribute('fill', '#00e5ff');
    dot.style.filter = 'drop-shadow(0 0 6px rgba(0,229,255,0.6))';
    svg.appendChild(dot);

    // Speed text (center)
    var speedGroup = document.createElementNS(svgNS, 'g');
    var speedText = document.createElementNS(svgNS, 'text');
    speedText.setAttribute('x', String(cx));
    speedText.setAttribute('y', String(cy + 8));
    speedText.setAttribute('text-anchor', 'middle');
    speedText.setAttribute('fill', '#fff');
    speedText.setAttribute('font-family', 'Bebas Neue, sans-serif');
    speedText.setAttribute('font-size', '42');
    speedText.setAttribute('letter-spacing', '2');
    speedText.textContent = '0';
    speedText.id = 'speedo-speed-text';
    speedGroup.appendChild(speedText);

    var unitText = document.createElementNS(svgNS, 'text');
    unitText.setAttribute('x', String(cx));
    unitText.setAttribute('y', String(cy + 24));
    unitText.setAttribute('text-anchor', 'middle');
    unitText.setAttribute('fill', 'rgba(255,255,255,0.3)');
    unitText.setAttribute('font-family', 'Inter, sans-serif');
    unitText.setAttribute('font-size', '9');
    unitText.setAttribute('letter-spacing', '3');
    unitText.textContent = 'KM/H';
    speedGroup.appendChild(unitText);

    // Gear indicator (bottom of ring)
    var gearText = document.createElementNS(svgNS, 'text');
    gearText.setAttribute('x', String(cx));
    gearText.setAttribute('y', String(cy + 46));
    gearText.setAttribute('text-anchor', 'middle');
    gearText.setAttribute('fill', 'rgba(0,229,255,0.6)');
    gearText.setAttribute('font-family', 'Bebas Neue, sans-serif');
    gearText.setAttribute('font-size', '16');
    gearText.setAttribute('letter-spacing', '2');
    gearText.textContent = 'N1';
    gearText.id = 'speedo-gear-text';
    speedGroup.appendChild(gearText);

    svg.appendChild(speedGroup);
    this._speedTextEl = speedText;
    this._gearTextEl = gearText;

    el.appendChild(svg);
    this._container.appendChild(el);
    this._element = el;
    this._svgParams = { cx, cy, r, startAngle, sweepAngle, needleLen };

    console.log('[SpeedometerRing] Initialized');
    return this;
  }

  /**
   * Update speed display
   * @param {number} speed - Current speed in km/h
   * @param {number} gear - Current gear (1-6)
   */
  setSpeed(speed, gear) {
    this._currentSpeed = Math.max(0, Math.min(this._maxSpeed, speed));
    if (gear !== undefined) {
      if (this._gearTextEl) this._gearTextEl.textContent = 'N' + gear;
    }
  }

  /**
   * Update display (call from animation loop for smooth interpolation)
   * @param {number} dt - Delta time
   */
  update(dt) {
    if (!this._element) return;

    // Smooth interpolation
    var lerpSpeed = 8;
    this._displaySpeed += (this._currentSpeed - this._displaySpeed) * Math.min(1, lerpSpeed * dt);
    var display = Math.round(this._displaySpeed);

    // Update text
    if (this._speedTextEl) this._speedTextEl.textContent = String(display);

    // Update arc and needle
    var pct = this._displaySpeed / this._maxSpeed;
    var p = this._svgParams;
    var currentAngle = p.startAngle + p.sweepAngle * pct;

    if (this._arcPath) {
      var endA = Math.max(p.startAngle + 1, currentAngle);
      this._arcPath.setAttribute('d', this._describeArc(p.cx, p.cy, p.r, p.startAngle, endA));
      // Color based on speed zone
      var color;
      if (pct >= this._dangerZone) {
        color = '#ff4d2e';
        if (!this._critical) {
          this._critical = true;
          this._element.classList.add('critical');
        }
      } else if (pct >= 0.6) {
        color = '#ffd23f';
        this._critical = false;
        this._element.classList.remove('critical');
      } else {
        color = '#00e5ff';
        this._critical = false;
        this._element.classList.remove('critical');
      }
      this._arcPath.setAttribute('stroke', color);
    }

    if (this._needleEl) {
      var nx = p.cx + p.needleLen * Math.cos((currentAngle * Math.PI) / 180);
      var ny = p.cy + p.needleLen * Math.sin((currentAngle * Math.PI) / 180);
      this._needleEl.setAttribute('x2', String(nx));
      this._needleEl.setAttribute('y2', String(ny));
    }
  }

  /**
   * Show the speedometer
   */
  show() {
    if (this._element) this._element.style.opacity = '1';
    this._visible = true;
    return this;
  }

  /**
   * Hide the speedometer
   */
  hide() {
    if (this._element) this._element.style.opacity = '0';
    this._visible = false;
    return this;
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    if (this._element && this._element.parentNode) this._element.remove();
    this._element = null;
    this._arcPath = null;
    this._needleEl = null;
  }

  // ==================== HELPERS ====================

  /**
   * Describe an SVG arc path
   */
  _describeArc(cx, cy, r, startAngle, endAngle) {
    var start = this._polarToCartesian(cx, cy, r, endAngle);
    var end = this._polarToCartesian(cx, cy, r, startAngle);
    var largeArcFlag = (endAngle - startAngle) > 180 ? 1 : 0;
    return 'M ' + start.x + ' ' + start.y + ' A ' + r + ' ' + r + ' 0 ' + largeArcFlag + ' 0 ' + end.x + ' ' + end.y;
  }

  _polarToCartesian(cx, cy, r, angleDeg) {
    var rad = (angleDeg - 90) * Math.PI / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad)
    };
  }
}

// Singleton
let _instance = null;

export function getSpeedometerRing() {
  if (!_instance) {
    _instance = new SpeedometerRing();
  }
  return _instance;
}

if (typeof window !== 'undefined') {
  window.__speedometerRing = getSpeedometerRing();
}

export default getSpeedometerRing();

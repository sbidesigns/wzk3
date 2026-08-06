// barrel/controllers/controller.touch.js
// Renders on-screen touch controls. Activated only when touch is detected.
// Uses closure-based state instead of 'this' for ES module compatibility.

let _active = false;
let _container = null;

// Public accessor for activation state
export function isActive() { return _active; }

export function activate(inputManager) {
  _active = true;
  _container = document.createElement('div');
  _container.id = 'touch-controls';
  // Start hidden - only show if touch device detected
  _container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:50;display:none;visibility:hidden';
  document.body.appendChild(_container);

  const layout = inputManager._bindings?.controllers?.touch?.layout || {
    leftSide: ['steerLeft', 'steerRight'],
    rightSide: ['throttle', 'brake', 'drift', 'useItem']
  };
  const size = inputManager._bindings?.controllers?.touch?.buttonSize || 96;
  const opacity = inputManager._bindings?.controllers?.touch?.opacity || 0.55;

  // Left side: steer
  const leftGroup = document.createElement('div');
  leftGroup.style.cssText = `position:absolute;left:24px;bottom:24px;display:flex;gap:12px;pointer-events:auto`;
  for (const action of layout.leftSide) {
    leftGroup.appendChild(_makeButton(action, size, opacity, inputManager));
  }
  _container.appendChild(leftGroup);

  // Right side: action buttons
  const rightGroup = document.createElement('div');
  rightGroup.style.cssText = `position:absolute;right:24px;bottom:24px;display:flex;gap:12px;pointer-events:auto`;
  for (const action of layout.rightSide) {
    rightGroup.appendChild(_makeButton(action, size, opacity, inputManager));
  }
  _container.appendChild(rightGroup);

  // Only show on actual touch devices (not desktop with mouse)
  // Use a more reliable check: wait for first touch event before showing
  const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
  const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const isTouchDevice = hasCoarsePointer || (!hasFinePointer && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0)));
  if (isTouchDevice) {
    _container.style.display = 'block';
    _container.style.visibility = 'visible';
  }
  // Listen for first touch as fallback detection
  const onFirstTouch = function() {
    _container.style.display = 'block';
    _container.style.visibility = 'visible';
    document.removeEventListener('touchstart', onFirstTouch, { once: true });
  };
  if (!isTouchDevice) {
    document.addEventListener('touchstart', onFirstTouch, { once: true });
  }
  inputManager.ctx?.engine?.bus?.emit('controller:activated', { id: 'touch' });
}

export function deactivate(inputManager) {
  _active = false;
  if (_container) {
    _container.remove();
    _container = null;
  }
  inputManager.ctx?.engine?.bus?.emit('controller:deactivated', { id: 'touch' });
}

export function poll(inputManager, dt) { /* no-op; touch events are immediate */ }

// Call this when actual touch input is detected to show controls
export function show() {
  if (_container) {
    _container.style.display = 'block';
    _container.style.visibility = 'visible';
  }
}

function _makeButton(action, size, opacity, inputManager) {
  const btn = document.createElement('div');
  btn.dataset.action = action;
  btn.style.cssText = `
    width:${size}px;height:${size}px;border-radius:50%;
    background:rgba(255,255,255,${opacity});border:2px solid rgba(255,255,255,0.4);
    display:flex;align-items:center;justify-content:center;
    color:#fff;font:600 11px 'Inter',sans-serif;text-transform:uppercase;
    user-select:none;-webkit-user-select:none;touch-action:none;
    backdrop-filter:blur(4px);
  `;
  btn.textContent = action.replace(/([A-Z])/g, ' $1').replace('steer', '');
  const press = (e) => {
    e.preventDefault();
    inputManager.setAction(action, 1);
    btn.style.background = 'rgba(255,77,46,0.7)';
  };
  const release = (e) => {
    e.preventDefault();
    inputManager.setAction(action, 0);
    btn.style.background = `rgba(255,255,255,${opacity})`;
  };
  btn.addEventListener('touchstart', press, { passive: false });
  btn.addEventListener('touchend', release, { passive: false });
  btn.addEventListener('touchcancel', release, { passive: false });
  btn.addEventListener('mousedown', press);
  btn.addEventListener('mouseup', release);
  btn.addEventListener('mouseleave', release);
  return btn;
}

export default { activate, deactivate, poll, isActive, show };

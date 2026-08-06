// barrel/controllers/controller.gamepad.js
// Polls navigator.getGamepads() and feeds normalized actions into InputManager.
// Uses closure-based state for ES module compatibility.

let _active = false;

export function activate(inputManager) {
  _active = true;
  inputManager.ctx?.engine?.bus?.emit('controller:activated', { id: 'gamepad' });
}

export function deactivate(inputManager) {
  _active = false;
  inputManager.ctx?.engine?.bus?.emit('controller:deactivated', { id: 'gamepad' });
}

export function poll(inputManager, dt) {
  if (!_active) return;
  // The actual gamepad polling is handled by InputManager.pollGamepadForUI()
  // which runs every frame. This module's poll is a no-op hook for future
  // per-platform vibration / LED effects.
}

export default { activate, deactivate, poll };

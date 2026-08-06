// ui/race-scene.js -- ENHANCED RACE SCENE (Cycle 42)
// Performance: Merged geometries, minimal draw calls
// HUD: Glassmorphism panels, minimap, boost pips, progress bar
// Features: AI opponents, speed gauge, particle trail, finish line, lap splits, track markers

import * as THREE from '../vendor/three.module.js';

export class RaceScene {
  constructor() {
    this.id = 'race-scene';
    this._scene = null;
    this._camera = null;
    this._renderer = null;
    this._track = null;
    this._vehicle = null;
    this._lights = { ambient: null, directional: null, pointLights: [], spotLights: [] };
    this._clock = new THREE.Clock();
    this._state = { running: false, speed: 0, position: 1, lap: 1, totalLaps: 3, countdown: false, raceStarted: false };
    this._trackLength = 2000;
    this._trackWidth = 20;
    this._keys = { throttle: false, brake: false, steerLeft: false, steerRight: false, drift: false, boost: false };
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp = this._handleKeyUp.bind(this);
    this._hudElement = null;
    this._hudRefs = {};
    this._wheels = [];
    this._inputListenersAdded = false;
    this._paused = false;
    this._pauseElement = null;
    this._startRaceTime = 0;
    this._itemBoxes = [];
    this._boostPads = [];
    this._trackEdges = [];
    this._underGlowLight = null;
    this._minimapCanvas = null;
    this._minimapCtx = null;
    this._minimapSize = 140;
    this._driftScore = 0;
    this._driftPopupTimer = 0;
    this._totalDriftScore = 0;
    this._edgeGlowTime = 0;
    this._currentFOV = 75;
    this._targetFOV = 75;
    this._cameraOffset = new THREE.Vector3(0, 4, -8);
    this._cameraLookOffset = new THREE.Vector3(0, 1.5, 4);
    this._boostCharges = 3;
    this._boostMaxCharges = 3;
    this._boostActive = false;
    this._boostTimer = 0;
    this._boostDuration = 2.0;
    this._boostMultiplier = 1.5;
    this._boostRefillTimer = 0;
    this._boostRefillInterval = 8.0;
    this._curve = null;
    this._trackData = null;
    // === Cycle 42: New state vars ===
    this._opponents = [];
    this._opponentColors = [0x33ccff, 0xff6633, 0x66ff33];
    this._lapSplits = [];
    this._bestLapTime = Infinity;
    this._lastLapStartTime = 0;
    this._particlePool = [];
    this._particleActiveCount = 0;
    this._particleSpawnTimer = 0;
    this._cameraShakeIntensity = 0;
    this._cameraShakeDecay = 5.0;
    this._finishLineGroup = null;
    this._trackMarkerMeshes = [];
    this._gaugeCanvas = null;
    this._gaugeCtx = null;
    this._gaugeSize = 180;
    this._centerLineDashes = [];
    this._itemPickupFlash = 0;
    this._skyGradientTop = new THREE.Color(0x0a0a15);
    this._skyGradientBot = new THREE.Color(0x0a0a20);
    this._checkeredTexture = null;
  }

  _setupInputListeners() {
    if (this._inputListenersAdded) return;
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    this._inputListenersAdded = true;
  }

  _removeInputListeners() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this._inputListenersAdded = false;
  }

  _handleKeyDown(e) {
    if (!this._state.running || this._paused) return;
    var eng = window.__engine;
    if (!eng || !eng.input) return;
    switch(e.code) {
      case 'KeyW': case 'ArrowUp': eng.input._setAction('throttle', 1); break;
      case 'KeyS': case 'ArrowDown': eng.input._setAction('brake', 1); break;
      case 'KeyA': case 'ArrowLeft': eng.input._setAction('steerLeft', 1); break;
      case 'KeyD': case 'ArrowRight': eng.input._setAction('steerRight', 1); break;
      case 'Space': eng.input._setAction('drift', 1); break;
      case 'ShiftLeft': case 'ShiftRight': eng.input._setAction('boost', 1); this._tryActivateBoost(); break;
      case 'Escape': this._togglePause(); break;
      case 'KeyR': if (e.ctrlKey) { e.preventDefault(); } break;
    }
  }

  _handleKeyUp(e) {
    if (!this._state.running) return;
    var eng = window.__engine;
    if (!eng || !eng.input) return;
    switch(e.code) {
      case 'KeyW': case 'ArrowUp': eng.input._setAction('throttle', 0); break;
      case 'KeyS': case 'ArrowDown': eng.input._setAction('brake', 0); break;
      case 'KeyA': case 'ArrowLeft': eng.input._setAction('steerLeft', 0); break;
      case 'KeyD': case 'ArrowRight': eng.input._setAction('steerRight', 0); break;
      case 'Space': eng.input._setAction('drift', 0); break;
      case 'ShiftLeft': case 'ShiftRight': eng.input._setAction('boost', 0); break;
    }
  }

  async mount(payload) {
    if (window.__engine) {
      this._renderer = window.__engine.renderer;
      this._scene = new THREE.Scene();
      this._camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      this._lights.ambient = new THREE.AmbientLight(0x334466, 0.5);
      this._lights.directional = new THREE.DirectionalLight(0xaabbff, 0.4);
      this._scene.add(this._lights.ambient);
      this._scene.add(this._lights.directional);
      this._scene.fog = new THREE.FogExp2(0x0a0a15, 0.008);
      this._createTrack();
      this._createVehicle();
      this._createOpponents();
      this._createFinishLine();
      this._createTrackMarkers();
      this._createParticlePool();
      if (this._vehicle) {
        this._camera.position.copy(this._vehicle.position).add(this._cameraOffset);
        this._camera.lookAt(this._vehicle.position);
      }
      this._setupHUD();
      this._setupInputListeners();
      this._startCountdown();
      this._state.running = true;
    }
    if (!this._scene || !this._camera || !this._renderer) {
      console.error('[RaceScene] Failed to initialize');
      return;
    }
    var canvas = document.getElementById('game-canvas');
    if (canvas) canvas.style.display = 'block';
    if (window.__engine && window.__engine.bus) {
      window.__engine.bus.emit('race:sceneMounted', { scene: this });
    }
  }

  // ==================== TRACK CREATION ====================

  _createTrack() {
    var tg = new THREE.Group();
    this._track = tg;
    this._scene.add(tg);
    var hw = this._trackWidth / 2;
    var tl = this._trackLength;
    // Ground — reflective wet-look surface
    var gnd = new THREE.Mesh(
      new THREE.PlaneGeometry(this._trackWidth * 3, tl * 1.5),
      new THREE.MeshStandardMaterial({ color: 0x080810, roughness: 0.6, metalness: 0.3 })
    );
    gnd.rotation.x = -Math.PI / 2; gnd.position.y = -0.01; gnd.receiveShadow = true;
    tg.add(gnd);
    // Grid
    var grid = new THREE.GridHelper(tl * 1.5, 60, 0x111133, 0x0a0a1a);
    grid.position.y = 0.01; tg.add(grid);
    // Track surface — slightly reflective asphalt
    var tMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(this._trackWidth, tl),
      new THREE.MeshStandardMaterial({ color: 0x1a1a24, roughness: 0.65, metalness: 0.15 })
    );
    tMesh.rotation.x = -Math.PI / 2; tMesh.receiveShadow = true; tg.add(tMesh);
    // Animated center line dashes
    this._centerLineDashes = [];
    var dashLen = 3;
    var gapLen = 3;
    var dashCount = Math.floor(tl / (dashLen + gapLen));
    var dashMat = new THREE.MeshBasicMaterial({ color: 0x222244, transparent: true, opacity: 0.4 });
    for (var d = 0; d < dashCount; d++) {
      var dash = new THREE.Mesh(new THREE.PlaneGeometry(0.15, dashLen), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.02, -tl / 2 + d * (dashLen + gapLen) + dashLen / 2);
      tg.add(dash);
      this._centerLineDashes.push(dash);
    }
    // Lane markers (subtle)
    var laneMat = new THREE.MeshBasicMaterial({ color: 0x181830, transparent: true, opacity: 0.2 });
    for (var ln = -1; ln <= 1; ln += 2) {
      for (var ld = 0; ld < dashCount; ld++) {
        var lm = new THREE.Mesh(new THREE.PlaneGeometry(0.08, dashLen * 0.7), laneMat);
        lm.rotation.x = -Math.PI / 2;
        lm.position.set(ln * this._trackWidth * 0.25, 0.02, -tl / 2 + ld * (dashLen + gapLen) + dashLen / 2);
        tg.add(lm);
      }
    }
    // Edges with emissive glow
    var eGeo = new THREE.BoxGeometry(0.3, 0.5, tl);
    var eMatL = new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0xff00ff, emissiveIntensity: 0.4, transparent: true, opacity: 0.8 });
    var eMatR = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.4, transparent: true, opacity: 0.8 });
    var le = new THREE.Mesh(eGeo, eMatL); le.position.set(-hw - 0.15, 0.25, 0); tg.add(le); this._trackEdges.push(le);
    var re = new THREE.Mesh(eGeo, eMatR); re.position.set(hw + 0.15, 0.25, 0); tg.add(re); this._trackEdges.push(re);
    // Edge glow strips (wider, more vivid)
    var gGeo = new THREE.PlaneGeometry(3, tl);
    var lg = new THREE.Mesh(gGeo, new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.12 }));
    lg.rotation.x = -Math.PI / 2; lg.position.set(-hw - 1.5, 0.03, 0); tg.add(lg); this._trackEdges.push(lg);
    var rg = new THREE.Mesh(gGeo, new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.12 }));
    rg.rotation.x = -Math.PI / 2; rg.position.set(hw + 1.5, 0.03, 0); tg.add(rg); this._trackEdges.push(rg);
    // Second glow layer — wider, softer
    var gGeo2 = new THREE.PlaneGeometry(6, tl);
    var lg2 = new THREE.Mesh(gGeo2, new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.04 }));
    lg2.rotation.x = -Math.PI / 2; lg2.position.set(-hw - 3, 0.03, 0); tg.add(lg2); this._trackEdges.push(lg2);
    var rg2 = new THREE.Mesh(gGeo2, new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.04 }));
    rg2.rotation.x = -Math.PI / 2; rg2.position.set(hw + 3, 0.03, 0); tg.add(rg2); this._trackEdges.push(rg2);
    this._addScenery(tg, hw, tl);
    this._createItemBoxes(tg, tl);
    this._createBoostPads(tg, tl);
    this._curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, -tl / 2), new THREE.Vector3(0, 0, -tl / 4),
      new THREE.Vector3(0, 0, tl / 4), new THREE.Vector3(0, 0, tl / 2)
    ], false);
    this._trackData = { startPos: { x: 0, y: 0, z: -tl / 2 + 25 }, startTan: new THREE.Vector3(0, 0, 1) };
  }

  _addScenery(tg, hw, tl) {
    var bMat = new THREE.MeshStandardMaterial({ color: 0x151525, roughness: 0.9 });
    for (var i = 0; i < 16; i++) {
      var h = 15 + Math.random() * 45;
      var w = 8 + Math.random() * 14;
      var d = 8 + Math.random() * 14;
      var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bMat);
      var side = i % 2 === 0 ? -1 : 1;
      b.position.set(side * (hw + w / 2 + 12 + Math.random() * 20), h / 2, (i - 8) * (tl / 15));
      b.castShadow = true; b.receiveShadow = true; tg.add(b);
      // Neon accent — double stripe on roof
      var ac = [0xff00ff, 0x00ffff, 0xff0066, 0xffaa00][i % 4];
      var accMat = new THREE.MeshBasicMaterial({ color: ac });
      var acc = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.4, d + 0.5), accMat);
      acc.position.copy(b.position); acc.position.y = h + 0.2; tg.add(acc);
      // Second accent line (slightly smaller, offset)
      var acc2 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.3, d * 0.8), accMat);
      acc2.position.copy(b.position); acc2.position.y = h - 2; tg.add(acc2);
      // Window lights — more varied
      if (h > 25) {
        for (var wr = 0; wr < Math.min(Math.floor(h / 5), 5); wr++) {
          for (var wc = 0; wc < Math.min(Math.floor(w / 3.5), 3); wc++) {
            if (Math.random() > 0.4) continue;
            var wc2 = [0xffddaa, 0x88ccff, 0xffaa44, 0xff6688][Math.floor(Math.random() * 4)];
            var wm = new THREE.Mesh(
              new THREE.PlaneGeometry(1.2, 1.8),
              new THREE.MeshBasicMaterial({ color: wc2, transparent: true, opacity: 0.5 + Math.random() * 0.5 })
            );
            wm.position.set(b.position.x - side * (w / 2 + 0.1), 3 + wr * 5, b.position.z + (wc - 1) * (d / 4));
            wm.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
            tg.add(wm);
          }
        }
      }
      // Ground-level neon reflection puddle
      var puddleMat = new THREE.MeshBasicMaterial({ color: ac, transparent: true, opacity: 0.06 });
      var puddle = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.5, d * 1.2), puddleMat);
      puddle.rotation.x = -Math.PI / 2;
      puddle.position.set(b.position.x, 0.02, b.position.z);
      tg.add(puddle);
    }
    // Street lamps with improved design
    for (var l = 0; l < 24; l++) {
      var poleMat = new THREE.MeshStandardMaterial({ color: 0x333344, metalness: 0.8, roughness: 0.2 });
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 8, 8), poleMat);
      var ls = l % 2 === 0 ? -1 : 1;
      var lz = (l - 12) * (tl / 23);
      pole.position.set(ls * (hw - 2), 4, lz); tg.add(pole);
      // Lamp arm
      var arm = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 0.1), poleMat);
      arm.position.set(ls * (hw - 1), 8, lz); tg.add(arm);
      // Lamp housing
      var housing = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.4), poleMat);
      housing.position.set(ls * (hw - 0.1), 7.85, lz); tg.add(housing);
      var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
      lamp.position.set(ls * (hw - 0.1), 7.7, lz); tg.add(lamp);
      var ll = new THREE.PointLight(0xffaa00, 0.6, 35);
      ll.position.copy(lamp.position); this._lights.pointLights.push(ll); tg.add(ll);
      // Lamp glow halo
      var halo = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 4),
        new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.05, side: THREE.DoubleSide })
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.set(ls * (hw - 0.1), 0.02, lz);
      tg.add(halo);
    }
  }

  // ==================== VEHICLE ====================

  _createVehicle() {
    var cg = new THREE.Group();
    // Body — more detailed shape
    var body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 4), new THREE.MeshStandardMaterial({ color: 0xff3366, metalness: 0.8, roughness: 0.2 }));
    body.position.y = 0.6; body.castShadow = true; cg.add(body);
    // Front bumper
    var bumperMat = new THREE.MeshStandardMaterial({ color: 0x222233, metalness: 0.6, roughness: 0.4 });
    var frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.3, 0.4), bumperMat);
    frontBumper.position.set(0, 0.35, 2.1); cg.add(frontBumper);
    // Rear bumper
    var rearBumper = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.3, 0.4), bumperMat);
    rearBumper.position.set(0, 0.35, -2.1); cg.add(rearBumper);
    // Cabin
    var cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 2), new THREE.MeshStandardMaterial({ color: 0x111122, metalness: 0.9, roughness: 0.1 }));
    cab.position.set(0, 1.15, -0.3); cab.castShadow = true; cg.add(cab);
    // Windshield
    var windMat = new THREE.MeshStandardMaterial({ color: 0x334466, metalness: 0.95, roughness: 0.05, transparent: true, opacity: 0.6 });
    var wind = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.6), windMat);
    wind.position.set(0, 1.2, 0.7); wind.rotation.x = -0.3; cg.add(wind);
    // Spoiler
    var spMat = new THREE.MeshStandardMaterial({ color: 0x222233, metalness: 0.7, roughness: 0.3 });
    var sp = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.5), spMat); sp.position.set(0, 1.3, -1.9); cg.add(sp);
    var spSupL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.1), spMat);
    spSupL.position.set(-0.8, 1.1, -1.9); cg.add(spSupL);
    var spSupR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.1), spMat);
    spSupR.position.set(0.8, 1.1, -1.9); cg.add(spSupR);
    // Side skirts (neon strips)
    var skMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.8 });
    var skGeo = new THREE.BoxGeometry(0.08, 0.15, 3.5);
    var skL = new THREE.Mesh(skGeo, skMat); skL.position.set(-1.05, 0.35, 0); cg.add(skL);
    var skR = new THREE.Mesh(skGeo, skMat); skR.position.set(1.05, 0.35, 0); cg.add(skR);
    // Hood scoop
    var scoop = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.8), spMat);
    scoop.position.set(0, 1.05, 1.0); cg.add(scoop);
    // Exhaust pipes
    var exMat = new THREE.MeshStandardMaterial({ color: 0x444455, metalness: 0.9, roughness: 0.1 });
    var exL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.3, 8), exMat);
    exL.rotation.x = Math.PI / 2; exL.position.set(-0.5, 0.3, -2.2); cg.add(exL);
    var exR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.3, 8), exMat);
    exR.rotation.x = Math.PI / 2; exR.position.set(0.5, 0.3, -2.2); cg.add(exR);
    // Wheels
    var wGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.4, 16);
    var wMat = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.6 });
    var wps = [[-1.1, 0.45, 1.3], [1.1, 0.45, 1.3], [-1.1, 0.45, -1.3], [1.1, 0.45, -1.3]];
    this._wheels = [];
    for (var i = 0; i < wps.length; i++) {
      var wh = new THREE.Mesh(wGeo, wMat); wh.position.set(wps[i][0], wps[i][1], wps[i][2]);
      wh.rotation.z = Math.PI / 2; wh.castShadow = true; cg.add(wh); this._wheels.push(wh);
    }
    // Headlights
    var hlGeo = new THREE.SphereGeometry(0.25, 8, 8);
    var hlMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
    var hlL = new THREE.Mesh(hlGeo, hlMat); hlL.position.set(-0.7, 0.8, 2); cg.add(hlL);
    var hlR = new THREE.Mesh(hlGeo, hlMat); hlR.position.set(0.7, 0.8, 2); cg.add(hlR);
    // Headlight cones (visible volumetric)
    var coneMat = new THREE.MeshBasicMaterial({ color: 0xffffcc, transparent: true, opacity: 0.03, side: THREE.DoubleSide });
    var coneL = new THREE.Mesh(new THREE.ConeGeometry(6, 30, 12, 1, true), coneMat);
    coneL.rotation.x = Math.PI / 2; coneL.position.set(-0.7, 0.5, 17); cg.add(coneL);
    var coneR = new THREE.Mesh(new THREE.ConeGeometry(6, 30, 12, 1, true), coneMat);
    coneR.rotation.x = Math.PI / 2; coneR.position.set(0.7, 0.5, 17); cg.add(coneR);
    // Headlight spots
    var hlSL = new THREE.SpotLight(0xffffcc, 3, 50, Math.PI / 5, 0.6);
    hlSL.position.set(-0.7, 0.8, 2); hlSL.target.position.set(-0.7, 0, 20); cg.add(hlSL); cg.add(hlSL.target);
    var hlSR = new THREE.SpotLight(0xffffcc, 3, 50, Math.PI / 5, 0.6);
    hlSR.position.set(0.7, 0.8, 2); hlSR.target.position.set(0.7, 0, 20); cg.add(hlSR); cg.add(hlSR.target);
    this._lights.spotLights.push(hlSL, hlSR);
    // Taillights
    var tlMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    var tlL = new THREE.Mesh(hlGeo, tlMat); tlL.position.set(-0.7, 0.8, -2); cg.add(tlL);
    var tlR = new THREE.Mesh(hlGeo, tlMat); tlR.position.set(0.7, 0.8, -2); cg.add(tlR);
    // Taillight glow
    var tlGlow = new THREE.PointLight(0xff0000, 0.5, 8);
    tlGlow.position.set(0, 0.8, -2.3); cg.add(tlGlow);
    // Undercar glow
    this._underGlowLight = new THREE.PointLight(0x00e5ff, 1.5, 8);
    this._underGlowLight.position.set(0, 0.2, 0); cg.add(this._underGlowLight);
    cg.position.set(0, 0, -this._trackLength / 2 + 25);
    this._vehicle = cg; this._scene.add(cg);
  }

  // ==================== AI OPPONENTS (Cycle 42) ====================

  _createOpponents() {
    this._opponents = [];
    var offsets = [-3, 2, 4];
    var speedFactors = [0.75, 0.85, 0.65];
    var steerFreqs = [0.4, 0.6, 0.3];
    for (var i = 0; i < 3; i++) {
      var og = new THREE.Group();
      // Opponent body
      var bodyMat = new THREE.MeshStandardMaterial({ color: this._opponentColors[i], metalness: 0.7, roughness: 0.3 });
      var ob = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 3.5), bodyMat);
      ob.position.y = 0.55; og.add(ob);
      // Cabin
      var oc = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 1.6), new THREE.MeshStandardMaterial({ color: 0x111122, metalness: 0.9, roughness: 0.1 }));
      oc.position.set(0, 1.0, -0.2); og.add(oc);
      // Opponent wheels
      var owps = [[-0.9, 0.4, 1.1], [0.9, 0.4, 1.1], [-0.9, 0.4, -1.1], [0.9, 0.4, -1.1]];
      var owGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
      var owMat = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.6 });
      var oWheels = [];
      for (var w = 0; w < owps.length; w++) {
        var ow = new THREE.Mesh(owGeo, owMat);
        ow.position.set(owps[w][0], owps[w][1], owps[w][2]);
        ow.rotation.z = Math.PI / 2; og.add(ow); oWheels.push(ow);
      }
      // Tail lights
      var otl = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
      otl.position.set(-0.5, 0.65, -1.75); og.add(otl);
      var otl2 = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
      otl2.position.set(0.5, 0.65, -1.75); og.add(otl2);
      // Position on track
      og.position.set(offsets[i], 0, -this._trackLength / 2 + 20 - i * 8);
      this._scene.add(og);
      this._opponents.push({
        mesh: og, wheels: oWheels,
        speedFactor: speedFactors[i],
        steerFreq: steerFreqs[i],
        currentSpeed: 0,
        baseX: offsets[i],
        steerPhase: Math.random() * Math.PI * 2
      });
    }
  }

  // ==================== FINISH LINE (Cycle 42) ====================

  _createFinishLine() {
    var fg = new THREE.Group();
    this._finishLineGroup = fg;
    var hw = this._trackWidth / 2;
    // Checkered pattern using small squares
    var squareSize = 2;
    var cols = Math.ceil(this._trackWidth / squareSize);
    for (var c = 0; c < cols; c++) {
      for (var r = 0; r < 2; r++) {
        var isWhite = (c + r) % 2 === 0;
        var sq = new THREE.Mesh(
          new THREE.PlaneGeometry(squareSize, squareSize),
          new THREE.MeshBasicMaterial({ color: isWhite ? 0xffffff : 0x111111, side: THREE.DoubleSide })
        );
        sq.rotation.x = -Math.PI / 2;
        sq.position.set(-hw + c * squareSize + squareSize / 2, 0.03, r * squareSize + squareSize / 2);
        fg.add(sq);
      }
    }
    // Finish posts
    var postMat = new THREE.MeshStandardMaterial({ color: 0x444466, metalness: 0.8, roughness: 0.2 });
    var postL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 10, 8), postMat);
    postL.position.set(-hw - 0.5, 5, 1); fg.add(postL);
    var postR = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 10, 8), postMat);
    postR.position.set(hw + 0.5, 5, 1); fg.add(postR);
    // Crossbar
    var bar = new THREE.Mesh(new THREE.BoxGeometry(this._trackWidth + 1.4, 0.4, 0.4), postMat);
    bar.position.set(0, 10, 1); fg.add(bar);
    // "FINISH" text banner — simple box placeholder with emissive
    var bannerMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.8 });
    var banner = new THREE.Mesh(new THREE.BoxGeometry(8, 1.5, 0.1), bannerMat);
    banner.position.set(0, 9, 1); fg.add(banner);
    // Finish line glow lights
    var flMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    for (var fl = 0; fl < 8; fl++) {
      var flMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), flMat);
      flMesh.position.set(-hw + fl * (this._trackWidth / 7), 10.5, 1);
      fg.add(flMesh);
    }
    this._scene.add(fg);
  }

  // ==================== TRACK PROGRESS MARKERS (Cycle 42) ====================

  _createTrackMarkers() {
    this._trackMarkerMeshes = [];
    var tl = this._trackLength;
    var hw = this._trackWidth / 2;
    var positions = [0.25, 0.5, 0.75];
    var labels = ['25%', '50%', '75%'];
    for (var i = 0; i < positions.length; i++) {
      var z = -tl / 2 + tl * positions[i];
      var mg = new THREE.Group();
      // Marker arch
      var archMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.6 });
      var archL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 0.3), archMat);
      archL.position.set(-hw - 0.5, 3, z); mg.add(archL);
      var archR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 0.3), archMat);
      archR.position.set(hw + 0.5, 3, z); mg.add(archR);
      var archTop = new THREE.Mesh(new THREE.BoxGeometry(this._trackWidth + 1.3, 0.3, 0.3), archMat);
      archTop.position.set(0, 6, z); mg.add(archTop);
      // Ground stripe
      var stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(this._trackWidth, 1.5),
        new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.15 })
      );
      stripe.rotation.x = -Math.PI / 2; stripe.position.set(0, 0.025, z); mg.add(stripe);
      this._scene.add(mg);
      this._trackMarkerMeshes.push({ group: mg, position: positions[i], z: z });
    }
  }

  // ==================== PARTICLE TRAIL (Cycle 42) ====================

  _createParticlePool() {
    this._particlePool = [];
    this._particleActiveCount = 0;
    var poolSize = 60;
    var pGeo = new THREE.SphereGeometry(0.08, 4, 4);
    var colors = [0x00e5ff, 0x00ff88, 0xff3366, 0xffd23f];
    for (var i = 0; i < poolSize; i++) {
      var mat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true, opacity: 0 });
      var p = new THREE.Mesh(pGeo, mat);
      p.visible = false;
      this._scene.add(p);
      this._particlePool.push({
        mesh: p, active: false,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 0
      });
    }
  }

  _spawnParticle(x, y, z) {
    for (var i = 0; i < this._particlePool.length; i++) {
      var p = this._particlePool[i];
      if (!p.active) {
        p.active = true;
        p.mesh.visible = true;
        p.mesh.position.set(x, y, z);
        p.mesh.material.opacity = 0.8;
        p.vx = (Math.random() - 0.5) * 2;
        p.vy = Math.random() * 1.5 + 0.5;
        p.vz = (Math.random() - 0.5) * 2 - 1;
        p.life = 0;
        p.maxLife = 0.5 + Math.random() * 0.8;
        p.mesh.scale.setScalar(0.5 + Math.random() * 0.8);
        this._particleActiveCount++;
        return;
      }
    }
  }

  _updateParticles(dt) {
    for (var i = 0; i < this._particlePool.length; i++) {
      var p = this._particlePool[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        this._particleActiveCount--;
        continue;
      }
      var t = p.life / p.maxLife;
      p.mesh.material.opacity = 0.8 * (1 - t);
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= dt * 2; // gravity
      p.mesh.scale.setScalar((0.5 + Math.random() * 0.3) * (1 - t * 0.5));
    }
  }

  // ==================== ITEM BOXES & BOOST PADS ====================

  _createItemBoxes(tg, tl) {
    var bMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 0.5, transparent: true, opacity: 0.7 });
    this._itemBoxes = [];
    for (var i = 0; i < 10; i++) {
      var t = (i + 0.5) / 10;
      var box = new THREE.Mesh(new THREE.OctahedronGeometry(0.8), bMat);
      var side = i % 2 === 0 ? -1 : 1;
      box.position.set(side * this._trackWidth * 0.35, 1.2, (t - 0.5) * tl * 0.9);
      box.userData = { type: 'item-box', cooldownUntil: 0, index: i, baseY: 1.2 };
      tg.add(box); this._itemBoxes.push(box);
      // Item box glow ring
      var ring = new THREE.Mesh(
        new THREE.RingGeometry(1.0, 1.3, 16),
        new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(box.position.x, 0.03, box.position.z);
      tg.add(ring);
    }
  }

  _createBoostPads(tg, tl) {
    var pMat = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff44, emissiveIntensity: 0.6, transparent: true, opacity: 0.5 });
    this._boostPads = [];
    var ps = [0.15, 0.35, 0.55, 0.75, 0.9];
    for (var i = 0; i < ps.length; i++) {
      var pad = new THREE.Mesh(new THREE.PlaneGeometry(5, 14), pMat);
      pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.02, (ps[i] - 0.5) * tl * 0.9);
      pad.userData = { type: 'boost-pad' }; tg.add(pad); this._boostPads.push(pad);
      // Boost pad edge arrows
      var arrowMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.3 });
      for (var a = -1; a <= 1; a += 2) {
        var arrow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 3), arrowMat);
        arrow.rotation.x = -Math.PI / 2;
        arrow.position.set(a * 2.5, 0.05, (ps[i] - 0.5) * tl * 0.9 + 5);
        tg.add(arrow);
      }
    }
  }

  // ==================== HUD SETUP ====================

  _setupHUD() {
    if (document.getElementById('game-hud-root')) { this._hudElement = document.getElementById('game-hud-root'); return; }
    var hud = document.createElement('div'); hud.id = 'game-hud-root';
    var s = '';
    // Speed panel with arc gauge
    s += '<div id="hud-speed-panel" style="position:fixed;bottom:24px;left:24px;z-index:100;pointer-events:none;display:flex;align-items:flex-end;gap:16px;">';
    s += '<div>';
    s += '<div style="font-family:Inter,sans-serif;font-size:11px;color:rgba(0,229,255,0.7);letter-spacing:3px;text-transform:uppercase;margin-bottom:2px;">SPEED</div>';
    s += '<div id="hud-speed" style="font-family:Bebas Neue,sans-serif;font-size:64px;color:#fff;line-height:1;text-shadow:0 0 20px rgba(0,229,255,0.6),0 0 40px rgba(0,229,255,0.3);transition:text-shadow 0.3s;">0</div>';
    s += '<div style="font-family:Inter,sans-serif;font-size:13px;color:rgba(255,255,255,0.4);letter-spacing:2px;margin-top:-4px;">KM/H</div>';
    s += '</div>';
    s += '<canvas id="hud-speed-gauge" width="180" height="180" style="width:90px;height:90px;opacity:0.85;"></canvas>';
    s += '</div>';
    // Lap panel
    s += '<div id="hud-lap-panel" style="position:fixed;top:24px;left:24px;z-index:100;background:rgba(10,12,20,0.75);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 20px;">';
    s += '<div style="font-family:Inter,sans-serif;font-size:10px;color:rgba(255,255,255,0.4);letter-spacing:2px;text-transform:uppercase;">LAP</div>';
    s += '<div style="display:flex;align-items:baseline;gap:4px;margin-top:2px;"><span id="hud-lap-num" style="font-family:Bebas Neue,sans-serif;font-size:32px;color:#fff;">1</span>';
    s += '<span style="font-family:Inter,sans-serif;font-size:14px;color:rgba(255,255,255,0.3);">/ <span id="hud-lap-total">3</span></span></div></div>';
    // Position panel
    s += '<div id="hud-pos-panel" style="position:fixed;top:24px;right:24px;z-index:100;background:rgba(10,12,20,0.75);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 20px;text-align:right;">';
    s += '<div style="font-family:Inter,sans-serif;font-size:10px;color:rgba(255,255,255,0.4);letter-spacing:2px;text-transform:uppercase;">POSITION</div>';
    s += '<div id="hud-pos-num" style="font-family:Bebas Neue,sans-serif;font-size:32px;color:#fff;margin-top:2px;">1st</div></div>';
    // Timer panel
    s += '<div id="hud-time-panel" style="position:fixed;top:90px;left:24px;z-index:100;background:rgba(10,12,20,0.6);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.05);border-radius:8px;padding:8px 14px;">';
    s += '<div id="hud-time" style="font-family:JetBrains Mono,monospace;font-size:18px;color:#fff;letter-spacing:1px;">00:00.000</div>';
    // Lap split time (Cycle 42)
    s += '<div id="hud-lap-split" style="font-family:JetBrains Mono,monospace;font-size:11px;color:rgba(0,229,255,0.6);margin-top:4px;display:none;">LAST: --:--.---</div>';
    s += '<div id="hud-best-lap" style="font-family:JetBrains Mono,monospace;font-size:11px;color:rgba(255,210,63,0.6);margin-top:2px;display:none;">BEST: --:--.---</div>';
    s += '</div>';
    // Boost pips
    s += '<div id="hud-boost-pips" style="position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:100;display:flex;gap:8px;align-items:center;">';
    s += '<div style="font-family:Inter,sans-serif;font-size:10px;color:rgba(255,255,255,0.4);letter-spacing:2px;margin-right:8px;">NITRO</div>';
    for (var bp = 0; bp < 3; bp++) s += '<div class="boost-pip" data-pip="' + bp + '" style="width:28px;height:8px;border-radius:4px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);transition:all 0.3s ease;"></div>';
    s += '</div>';
    // Progress bar
    s += '<div id="hud-progress-container" style="position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:100;width:300px;padding-top:8px;">';
    s += '<div id="hud-progress-bar" style="width:100%;height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;">';
    s += '<div id="hud-progress-fill" style="width:0%;height:100%;background:linear-gradient(90deg,#00e5ff,#00ff88);border-radius:2px;transition:width 0.5s ease;"></div></div>';
    s += '<div id="hud-progress-text" style="font-family:JetBrains Mono,monospace;font-size:10px;color:rgba(255,255,255,0.35);text-align:center;margin-top:4px;">0%</div></div>';
    // Minimap
    s += '<div id="hud-minimap-container" style="position:fixed;bottom:24px;right:24px;z-index:100;background:rgba(10,12,20,0.75);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:8px;overflow:hidden;">';
    s += '<canvas id="hud-minimap-canvas" width="140" height="140" style="display:block;border-radius:8px;"></canvas></div>';
    // Drift popup
    s += '<div id="hud-drift-popup" style="position:fixed;right:24px;top:50%;transform:translateY(-50%);z-index:100;text-align:right;pointer-events:none;opacity:0;transition:opacity 0.3s;">';
    s += '<div id="hud-drift-score" style="font-family:Bebas Neue,sans-serif;font-size:48px;color:#ffd23f;text-shadow:0 0 20px rgba(255,210,63,0.6);">0</div>';
    s += '<div style="font-family:Inter,sans-serif;font-size:12px;color:rgba(255,210,63,0.6);letter-spacing:3px;">DRIFT SCORE</div></div>';
    // Lap notify
    s += '<div id="hud-lap-notify" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.8);z-index:200;pointer-events:none;opacity:0;transition:opacity 0.4s,transform 0.4s;">';
    s += '<div id="hud-lap-notify-text" style="font-family:Bebas Neue,sans-serif;font-size:28px;color:#00e5ff;letter-spacing:6px;text-shadow:0 0 30px rgba(0,229,255,0.8);">LAP 2</div></div>';
    // Item pickup flash (Cycle 42)
    s += '<div id="hud-item-flash" style="position:fixed;inset:0;z-index:95;pointer-events:none;opacity:0;transition:opacity 0.15s;background:radial-gradient(circle at center,rgba(0,229,255,0.2),transparent 70%);mix-blend-mode:screen;"></div>';
    // Speed lines
    s += '<div id="hud-speed-lines" style="position:fixed;inset:0;z-index:90;pointer-events:none;opacity:0;transition:opacity 0.5s;background:repeating-linear-gradient(85deg,transparent,transparent 40%,rgba(255,255,255,0.02) 40%,rgba(255,255,255,0.02) 100%);mix-blend-mode:screen;"></div>';
    // Nitro aura
    s += '<div id="hud-nitro-aura" style="position:fixed;inset:0;z-index:85;pointer-events:none;opacity:0;transition:opacity 0.3s;box-shadow:inset 0 0 120px rgba(0,229,255,0.15),inset 0 0 60px rgba(0,255,136,0.1);"></div>';
    // Camera shake vignette (Cycle 42)
    s += '<div id="hud-shake-vignette" style="position:fixed;inset:0;z-index:88;pointer-events:none;opacity:0;transition:opacity 0.1s;box-shadow:inset 0 0 80px rgba(255,50,50,0.15);"></div>';
    // Countdown
    s += '<div id="hud-countdown" style="position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);z-index:1000;"></div>';
    // Opponent indicators (Cycle 42)
    s += '<div id="hud-opponents-panel" style="position:fixed;top:90px;right:24px;z-index:100;background:rgba(10,12,20,0.6);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.05);border-radius:8px;padding:8px 14px;font-family:JetBrains Mono,monospace;font-size:11px;">';
    s += '<div style="color:rgba(255,255,255,0.4);font-size:10px;letter-spacing:2px;margin-bottom:6px;">RIVALS</div>';
    for (var oi = 0; oi < 3; oi++) {
      var oc = ['#33ccff', '#ff6633', '#66ff33'][oi];
      s += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;"><span style="width:8px;height:8px;border-radius:50%;background:' + oc + ';display:inline-block;box-shadow:0 0 6px ' + oc + ';"></span><span id="hud-opp-' + oi + '" style="color:rgba(255,255,255,0.6);">P' + (oi + 2) + ' ---</span></div>';
    }
    s += '</div>';
    hud.innerHTML = s;
    document.body.appendChild(hud);
    this._hudElement = hud;
    this._hudRefs = {
      speed: hud.querySelector('#hud-speed'),
      lapNum: hud.querySelector('#hud-lap-num'),
      lapTotal: hud.querySelector('#hud-lap-total'),
      posNum: hud.querySelector('#hud-pos-num'),
      time: hud.querySelector('#hud-time'),
      countdown: hud.querySelector('#hud-countdown'),
      progressFill: hud.querySelector('#hud-progress-fill'),
      progressText: hud.querySelector('#hud-progress-text'),
      driftPopup: hud.querySelector('#hud-drift-popup'),
      driftScore: hud.querySelector('#hud-drift-score'),
      lapNotify: hud.querySelector('#hud-lap-notify'),
      lapNotifyText: hud.querySelector('#hud-lap-notify-text'),
      speedLines: hud.querySelector('#hud-speed-lines'),
      nitroAura: hud.querySelector('#hud-nitro-aura'),
      itemFlash: hud.querySelector('#hud-item-flash'),
      shakeVignette: hud.querySelector('#hud-shake-vignette'),
      lapSplit: hud.querySelector('#hud-lap-split'),
      bestLap: hud.querySelector('#hud-best-lap'),
      boostPips: hud.querySelectorAll('.boost-pip'),
      oppSlots: []
    };
    for (var os = 0; os < 3; os++) {
      var oppEl = hud.querySelector('#hud-opp-' + os);
      if (oppEl) this._hudRefs.oppSlots.push(oppEl);
    }
    this._minimapCanvas = hud.querySelector('#hud-minimap-canvas');
    if (this._minimapCanvas) this._minimapCtx = this._minimapCanvas.getContext('2d');
    this._gaugeCanvas = hud.querySelector('#hud-speed-gauge');
    if (this._gaugeCanvas) this._gaugeCtx = this._gaugeCanvas.getContext('2d');
    if (this._hudRefs.lapTotal) this._hudRefs.lapTotal.textContent = String(this._state.totalLaps);
    this._updateBoostPips();
  }

  // ==================== COUNTDOWN ====================

  _startCountdown() {
    this._state.countdown = true;
    this._lastLapStartTime = 0;
    var cdEl = this._hudRefs.countdown;
    if (!cdEl) return;
    cdEl.style.display = 'flex';
    cdEl.innerHTML = '<div style="font-family:Bebas Neue,sans-serif;font-size:140px;color:#00e5ff;text-shadow:0 0 60px rgba(0,229,255,0.8);animation:countPulse 0.5s ease-out;" id="cd-number">3</div>';
    var st = document.createElement('style');
    st.textContent = '@keyframes countPulse{0%{transform:scale(2);opacity:0;}50%{opacity:1;}100%{transform:scale(1);opacity:1;}}';
    document.head.appendChild(st);
    var count = 3;
    var self = this;
    function next() {
      count--;
      var el = document.getElementById('cd-number');
      if (count > 0) {
        if (el) {
          el.textContent = String(count);
          el.style.color = count === 2 ? '#ffd23f' : '#ff4d2e';
          el.style.textShadow = count === 2 ? '0 0 60px rgba(255,210,63,0.8)' : '0 0 60px rgba(255,77,46,0.8)';
          el.style.animation = 'none'; el.offsetHeight; el.style.animation = 'countPulse 0.5s ease-out';
        }
        setTimeout(next, 1000);
      } else if (count === 0) {
        if (el) {
          el.textContent = 'GO!'; el.style.color = '#22c55e';
          el.style.textShadow = '0 0 80px rgba(34,197,94,0.9)';
          el.style.animation = 'none'; el.offsetHeight; el.style.animation = 'countPulse 0.5s ease-out';
        }
        setTimeout(function() {
          cdEl.style.display = 'none';
          self._state.countdown = false;
          self._state.raceStarted = true;
          self._startRaceTime = performance.now();
          self._lastLapStartTime = performance.now();
          if (window.__engine && window.__engine.bus) window.__engine.bus.emit('race:go');
        }, 800);
      }
    }
    setTimeout(next, 1000);
  }

  // ==================== PAUSE ====================

  _togglePause() {
    this._paused = !this._paused;
    if (this._paused) { this._showPauseOverlay(); this._removeInputListeners(); }
    else { this._removePauseOverlay(); this._setupInputListeners(); }
    if (window.__engine && window.__engine.bus) window.__engine.bus.emit(this._paused ? 'race:paused' : 'race:resumed');
  }

  _showPauseOverlay() {
    if (this._pauseElement) return;
    var ov = document.createElement('div'); ov.id = 'pause-overlay';
    ov.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);z-index:999;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);animation:pauseFadeIn 0.2s ease-out;';
    ov.innerHTML = '<div style="padding:48px 60px;background:linear-gradient(145deg,rgba(26,26,46,0.95),rgba(13,13,20,0.98));border:1px solid rgba(0,229,255,0.15);border-radius:20px;text-align:center;box-shadow:0 0 80px rgba(0,229,255,0.08);">' +
      '<h2 style="font-size:42px;font-weight:900;color:#fff;margin:0 0 8px;font-family:Bebas Neue,sans-serif;letter-spacing:8px;text-shadow:0 0 30px rgba(0,229,255,0.5);">PAUSED</h2>' +
      '<p style="color:rgba(255,255,255,0.35);margin:0 0 32px;font-size:14px;letter-spacing:1px;">Press ESC or click to resume</p>' +
      '<button id="pause-resume-btn" style="padding:14px 40px;background:linear-gradient(135deg,#00e5ff,#0088cc);border:none;border-radius:10px;color:#fff;font-size:15px;font-weight:600;cursor:pointer;letter-spacing:2px;box-shadow:0 0 20px rgba(0,229,255,0.3);">RESUME</button></div>';
    document.body.appendChild(ov); this._pauseElement = ov;
    var btn = ov.querySelector('#pause-resume-btn');
    if (btn) btn.addEventListener('click', () => this._togglePause());
    ov.addEventListener('click', (e) => { if (e.target === ov) this._togglePause(); });
  }

  _removePauseOverlay() { if (this._pauseElement) { this._pauseElement.remove(); this._pauseElement = null; } }

  // ==================== BOOST ====================

  _tryActivateBoost() {
    if (this._boostCharges > 0 && !this._boostActive) {
      this._boostActive = true; this._boostCharges--; this._boostTimer = this._boostDuration;
      this._updateBoostPips();
      this._cameraShakeIntensity = 0.3; // Camera shake on boost
      if (window.__engine && window.__engine.bus) window.__engine.bus.emit('player:boostStart', { charges: this._boostCharges });
    }
  }

  _updateBoostPips() {
    if (!this._hudRefs.boostPips) return;
    for (var i = 0; i < this._hudRefs.boostPips.length; i++) {
      var p = this._hudRefs.boostPips[i];
      if (i < this._boostCharges) {
        p.style.background = 'linear-gradient(90deg,#00e5ff,#00ff88)'; p.style.borderColor = 'rgba(0,229,255,0.5)'; p.style.boxShadow = '0 0 8px rgba(0,229,255,0.4)';
      } else {
        p.style.background = 'rgba(255,255,255,0.1)'; p.style.borderColor = 'rgba(255,255,255,0.15)'; p.style.boxShadow = 'none';
      }
    }
  }

  // ==================== LAP NOTIFY ====================

  _showLapNotify(lapNum) {
    if (!this._hudRefs.lapNotify || !this._hudRefs.lapNotifyText) return;
    if (lapNum > this._state.totalLaps) return;
    var txt = lapNum === this._state.totalLaps ? 'FINAL LAP' : ('LAP ' + lapNum);
    this._hudRefs.lapNotifyText.textContent = txt;
    if (lapNum === this._state.totalLaps) {
      this._hudRefs.lapNotifyText.style.color = '#ff4d2e'; this._hudRefs.lapNotifyText.style.textShadow = '0 0 30px rgba(255,77,46,0.8)';
    } else {
      this._hudRefs.lapNotifyText.style.color = '#00e5ff'; this._hudRefs.lapNotifyText.style.textShadow = '0 0 30px rgba(0,229,255,0.8)';
    }
    this._hudRefs.lapNotify.style.opacity = '1'; this._hudRefs.lapNotify.style.transform = 'translate(-50%,-50%) scale(1)';
    var self = this;
    setTimeout(function() {
      if (self._hudRefs.lapNotify) { self._hudRefs.lapNotify.style.opacity = '0'; self._hudRefs.lapNotify.style.transform = 'translate(-50%,-50%) scale(0.8)'; }
    }, 1500);
  }

  // ==================== MAIN UPDATE LOOP ====================

  update(dt) {
    if (!this._state.running || this._paused) return;
    // Boost
    if (this._boostActive) { this._boostTimer -= dt; if (this._boostTimer <= 0) { this._boostActive = false; this._boostRefillTimer = 0; } }
    else { this._boostRefillTimer += dt; if (this._boostRefillTimer >= this._boostRefillInterval && this._boostCharges < this._boostMaxCharges) { this._boostCharges++; this._boostRefillTimer = 0; this._updateBoostPips(); if (window.__engine && window.__engine.bus) window.__engine.bus.emit('player:boostRecharged', { charges: this._boostCharges }); } }
    // Speed
    var ts = 0; if (this._keys.throttle) ts += dt * 60; if (this._keys.brake) ts -= dt * 80; if (this._boostActive) ts *= this._boostMultiplier;
    ts = Math.max(0, Math.min(220, ts)); this._state.speed += (ts - this._state.speed) * Math.min(1, dt * 3);
    // Vehicle
    if (this._vehicle && this._state.raceStarted) {
      var ms = this._state.speed * dt * 0.5; this._vehicle.position.z += ms;
      var sa = (this._keys.steerRight ? 1 : 0) - (this._keys.steerLeft ? 1 : 0);
      if (Math.abs(sa) > 0.01) { this._vehicle.rotation.y -= sa * dt * 2; this._vehicle.rotation.z += (-sa * 0.08 - this._vehicle.rotation.z) * Math.min(1, dt * 5); }
      else { this._vehicle.rotation.z += (0 - this._vehicle.rotation.z) * Math.min(1, dt * 3); }
      for (var w = 0; w < this._wheels.length; w++) this._wheels[w].rotation.x += ms * 0.5;
      // Lap detection
      if (this._vehicle.position.z > this._trackLength / 2) {
        this._vehicle.position.z = -this._trackLength / 2;
        // Record lap split
        if (this._lastLapStartTime > 0) {
          var splitTime = performance.now() - this._lastLapStartTime;
          this._lapSplits.push(splitTime);
          if (splitTime < this._bestLapTime) {
            this._bestLapTime = splitTime;
            if (this._hudRefs.bestLap) {
              this._hudRefs.bestLap.textContent = 'BEST: ' + this._formatTime(splitTime);
              this._hudRefs.bestLap.style.display = 'block';
              this._hudRefs.bestLap.style.color = 'rgba(255,210,63,0.9)';
            }
          }
          if (this._hudRefs.lapSplit) {
            this._hudRefs.lapSplit.textContent = 'LAST: ' + this._formatTime(splitTime);
            this._hudRefs.lapSplit.style.display = 'block';
          }
        }
        this._lastLapStartTime = performance.now();
        this._state.lap++;
        if (this._hudRefs.lapNum) this._hudRefs.lapNum.textContent = String(Math.min(this._state.lap, this._state.totalLaps));
        this._showLapNotify(this._state.lap);
        if (window.__engine && window.__engine.bus) window.__engine.bus.emit('race:lapComplete', { lap: this._state.lap, time: performance.now() - this._startRaceTime });
        if (this._state.lap > this._state.totalLaps) this._finishRace();
      }
      this._checkItemPickups(); this._checkBoostPads();
      // Particle trail
      this._particleSpawnTimer += dt;
      if (this._state.speed > 30 && this._particleSpawnTimer > 0.03) {
        this._particleSpawnTimer = 0;
        var pCount = this._boostActive ? 3 : 1;
        for (var pi = 0; pi < pCount; pi++) {
          this._spawnParticle(
            this._vehicle.position.x + (Math.random() - 0.5) * 1.5,
            0.3 + Math.random() * 0.3,
            this._vehicle.position.z - 2.5
          );
        }
      }
    }
    // Update opponents
    this._updateOpponents(dt);
    // Camera with shake
    if (this._vehicle && this._camera) {
      var targetCamPos = this._vehicle.position.clone().add(this._cameraOffset);
      // Apply camera shake
      if (this._cameraShakeIntensity > 0.001) {
        this._cameraShakeIntensity *= Math.exp(-this._cameraShakeDecay * dt);
        targetCamPos.x += (Math.random() - 0.5) * this._cameraShakeIntensity;
        targetCamPos.y += (Math.random() - 0.5) * this._cameraShakeIntensity * 0.5;
      }
      this._camera.position.lerp(targetCamPos, Math.min(1, dt * 5));
      this._camera.lookAt(this._vehicle.position.clone().add(this._cameraLookOffset));
    }
    // FOV
    this._targetFOV = 75 + (this._state.speed / 220) * 20; if (this._boostActive) this._targetFOV += 5;
    this._currentFOV += (this._targetFOV - this._currentFOV) * Math.min(1, dt * 3);
    if (this._camera) { this._camera.fov = this._currentFOV; this._camera.updateProjectionMatrix(); }
    // Visual updates
    this._updateEdgeGlow(dt);
    this._updateItemBoxAnim(dt);
    this._updateBoostPadAnim(dt);
    this._updateUnderGlow(dt);
    this._updateParticles(dt);
    this._updateCenterLineAnim(dt);
    this._updateTrackMarkerAnim(dt);
    this._updateItemPickupFlash(dt);
    this._updateSkyGradient(dt);
    this._updateHUD(dt);
    this._updateMinimap(dt);
    this._updateSpeedGauge();
    this._updateSpeedVisuals(dt);
    this._updateDriftPopup(dt);
    this._updateOpponentsHUD();
  }

  // ==================== OPPONENT UPDATE (Cycle 42) ====================

  _updateOpponents(dt) {
    if (!this._state.raceStarted) return;
    var tl = this._trackLength;
    for (var i = 0; i < this._opponents.length; i++) {
      var opp = this._opponents[i];
      // Speed with variation
      var targetSpeed = 80 + Math.sin(performance.now() * 0.001 * opp.steerFreq + opp.steerPhase) * 20;
      targetSpeed *= opp.speedFactor;
      opp.currentSpeed += (targetSpeed - opp.currentSpeed) * Math.min(1, dt * 2);
      opp.mesh.position.z += opp.currentSpeed * dt * 0.5;
      // Gentle steering
      opp.mesh.position.x = opp.baseX + Math.sin(performance.now() * 0.001 * opp.steerFreq + opp.steerPhase) * 2;
      // Wheel rotation
      for (var w = 0; w < opp.wheels.length; w++) {
        opp.wheels[w].rotation.x += opp.currentSpeed * dt * 0.5 * 0.5;
      }
      // Lap wrap
      if (opp.mesh.position.z > tl / 2) {
        opp.mesh.position.z = -tl / 2;
      }
      // Update position calculation
      var playerProgress = this._vehicle ? (this._state.lap - 1) * tl + (this._vehicle.position.z + tl / 2) : 0;
      var oppProgress = (opp.currentSpeed > 0 ? Math.floor(playerProgress / tl) : 0) * tl + (opp.mesh.position.z + tl / 2);
      opp.progress = oppProgress;
    }
    // Calculate player position
    if (this._vehicle) {
      var myProgress = (this._state.lap - 1) * tl + (this._vehicle.position.z + tl / 2);
      var pos = 1;
      for (var j = 0; j < this._opponents.length; j++) {
        if (this._opponents[j].progress > myProgress) pos++;
      }
      this._state.position = pos;
    }
  }

  _updateOpponentsHUD() {
    if (!this._hudRefs.oppSlots) return;
    for (var i = 0; i < this._opponents.length; i++) {
      if (this._hudRefs.oppSlots[i]) {
        var dist = 0;
        if (this._vehicle) {
          dist = this._vehicle.position.z - this._opponents[i].mesh.position.z;
        }
        var distStr = dist > 50 ? '+' + Math.round(dist) + 'm' : (dist < -50 ? Math.round(dist) + 'm' : (Math.abs(dist) < 5 ? 'CLOSE' : (dist > 0 ? '+' + Math.round(dist) + 'm' : Math.round(dist) + 'm')));
        this._hudRefs.oppSlots[i].textContent = 'P' + (i + 2) + '  ' + distStr;
      }
    }
  }

  // ==================== VISUAL UPDATES ====================

  _updateEdgeGlow(dt) {
    this._edgeGlowTime += dt; var intensity = 0.3 + Math.sin(this._edgeGlowTime * 1.5) * 0.2;
    for (var i = 0; i < this._trackEdges.length; i++) { var e = this._trackEdges[i]; if (e.material && e.material.emissiveIntensity !== undefined) e.material.emissiveIntensity = intensity; }
  }

  _updateItemBoxAnim(dt) {
    var t = performance.now() * 0.001; for (var i = 0; i < this._itemBoxes.length; i++) { var b = this._itemBoxes[i]; if (b.visible && b.userData.baseY) { b.position.y = b.userData.baseY + Math.sin(t * 2 + i) * 0.3; b.rotation.y += dt * 1.5; } }
  }

  _updateBoostPadAnim(dt) {
    var t = performance.now() * 0.001; for (var i = 0; i < this._boostPads.length; i++) { var p = this._boostPads[i]; if (p.material) p.material.opacity = 0.3 + Math.sin(t * 3 + i * 1.5) * 0.2; }
  }

  _updateUnderGlow(dt) {
    if (!this._underGlowLight) return; var c = new THREE.Color();
    if (this._boostActive) { c.set(0x00ff88); this._underGlowLight.intensity = 3 + Math.sin(performance.now() * 0.01) * 0.5; }
    else if (this._keys.drift) { c.set(0xffd23f); this._underGlowLight.intensity = 2; }
    else { c.set(0x00e5ff); this._underGlowLight.intensity = 1.5 + Math.sin(performance.now() * 0.003) * 0.3; }
    this._underGlowLight.color.lerp(c, Math.min(1, dt * 3));
  }

  _updateCenterLineAnim(dt) {
    // Animate center line dashes flowing forward
    var t = performance.now() * 0.001;
    var offset = (t * 20) % 6; // Speed of flow
    for (var i = 0; i < this._centerLineDashes.length; i++) {
      var dash = this._centerLineDashes[i];
      var z = -this._trackLength / 2 + i * 6 + 1.5 + offset;
      if (z > this._trackLength / 2) z -= this._trackLength;
      dash.position.z = z;
      // Brightness pulse based on proximity to vehicle
      if (this._vehicle) {
        var dist = Math.abs(dash.position.z - this._vehicle.position.z);
        if (dist < 30) {
          dash.material.opacity = 0.4 + (1 - dist / 30) * 0.4;
        } else {
          dash.material.opacity = 0.3;
        }
      }
    }
  }

  _updateTrackMarkerAnim(dt) {
    var t = performance.now() * 0.001;
    for (var i = 0; i < this._trackMarkerMeshes.length; i++) {
      var m = this._trackMarkerMeshes[i];
      // Pulse opacity when player is near
      if (this._vehicle) {
        var dist = Math.abs(this._vehicle.position.z - m.z);
        var nearFactor = Math.max(0, 1 - dist / 50);
        m.group.children.forEach(function(child) {
          if (child.material && child.material.opacity !== undefined) {
            child.material.opacity = child.material.userData?.baseOpacity !== undefined
              ? child.material.userData.baseOpacity + nearFactor * 0.3
              : 0.6 + nearFactor * 0.3;
          }
        });
      }
    }
  }

  _updateItemPickupFlash(dt) {
    if (this._itemPickupFlash > 0) {
      this._itemPickupFlash -= dt * 4;
      if (this._hudRefs.itemFlash) {
        this._hudRefs.itemFlash.style.opacity = String(Math.max(0, this._itemPickupFlash));
      }
    }
  }

  _updateSkyGradient(dt) {
    // Subtle sky color shift during boost
    if (this._scene && this._scene.fog) {
      var targetDensity = this._boostActive ? 0.005 : 0.008;
      this._scene.fog.density += (targetDensity - this._scene.fog.density) * Math.min(1, dt * 2);
    }
  }

  _updateSpeedVisuals(dt) {
    var sr = this._state.speed / 220;
    if (this._hudRefs.speedLines) this._hudRefs.speedLines.style.opacity = sr > 0.5 ? String((sr - 0.5) * 0.4) : '0';
    if (this._hudRefs.nitroAura) this._hudRefs.nitroAura.style.opacity = this._boostActive ? '1' : '0';
    // Camera shake vignette
    if (this._hudRefs.shakeVignette) {
      this._hudRefs.shakeVignette.style.opacity = this._cameraShakeIntensity > 0.01 ? String(Math.min(1, this._cameraShakeIntensity * 2)) : '0';
    }
    if (this._hudRefs.speed) {
      var gs = 20 + sr * 30; if (this._boostActive) gs += 20;
      var col = this._boostActive ? 'rgba(0,255,136,' : 'rgba(0,229,255,';
      this._hudRefs.speed.style.textShadow = '0 0 ' + gs + 'px ' + col + '0.6), 0 0 ' + (gs * 2) + 'px ' + col + '0.3)';
    }
  }

  // ==================== SPEED GAUGE (Cycle 42) ====================

  _updateSpeedGauge() {
    if (!this._gaugeCtx) return;
    var ctx = this._gaugeCtx, sz = this._gaugeSize, cx = sz / 2, cy = sz / 2, r = sz * 0.4;
    ctx.clearRect(0, 0, sz, sz);
    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25, false);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.stroke();
    // Speed arc
    var sr = Math.min(1, this._state.speed / 220);
    var endAngle = Math.PI * 0.75 + sr * Math.PI * 1.5;
    var grad = ctx.createLinearGradient(0, sz, sz, 0);
    if (this._boostActive) {
      grad.addColorStop(0, '#00ff88');
      grad.addColorStop(1, '#00e5ff');
    } else if (sr > 0.7) {
      grad.addColorStop(0, '#ffd23f');
      grad.addColorStop(1, '#ff4d2e');
    } else {
      grad.addColorStop(0, '#00e5ff');
      grad.addColorStop(1, '#00ff88');
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 0.75, endAngle, false);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.stroke();
    // Glow on speed arc
    ctx.shadowColor = this._boostActive ? '#00ff88' : '#00e5ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 0.75, endAngle, false);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3; ctx.stroke();
    ctx.shadowBlur = 0;
    // Tick marks
    for (var t = 0; t <= 10; t++) {
      var angle = Math.PI * 0.75 + (t / 10) * Math.PI * 1.5;
      var inner = r - 14;
      var outer = r - 8;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
      ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
      ctx.strokeStyle = t % 2 === 0 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = t % 2 === 0 ? 2 : 1; ctx.stroke();
    }
    // Needle
    var needleAngle = Math.PI * 0.75 + sr * Math.PI * 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(needleAngle) * (r - 4), cy + Math.sin(needleAngle) * (r - 4));
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke();
    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
  }

  _updateDriftPopup(dt) {
    if (!this._hudRefs.driftPopup) return;
    if (this._keys.drift && this._state.speed > 20 && this._state.raceStarted) {
      this._driftScore += dt * this._state.speed * 0.5; this._driftPopupTimer = 2;
      if (this._hudRefs.driftScore) this._hudRefs.driftScore.textContent = String(Math.floor(this._driftScore));
      this._hudRefs.driftPopup.style.opacity = '1';
    } else if (this._driftPopupTimer > 0) { this._driftPopupTimer -= dt; if (this._driftPopupTimer <= 0) { this._hudRefs.driftPopup.style.opacity = '0'; if (this._driftScore > 0) { this._totalDriftScore += Math.floor(this._driftScore); this._driftScore = 0; } } }
  }

  // ==================== MINIMAP ====================

  _updateMinimap(dt) {
    if (!this._minimapCtx || !this._minimapCanvas || !this._vehicle) return;
    var ctx = this._minimapCtx, sz = this._minimapSize, hs = sz / 2;
    ctx.fillStyle = 'rgba(10,12,20,0.9)'; ctx.fillRect(0, 0, sz, sz);
    var sc = sz / (this._trackLength * 1.2), tw = this._trackWidth * sc;
    // Track
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = Math.max(1, tw); ctx.beginPath(); ctx.moveTo(hs, 5); ctx.lineTo(hs, sz - 5); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,0,255,0.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hs - tw / 2, 5); ctx.lineTo(hs - tw / 2, sz - 5); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,255,255,0.3)'; ctx.beginPath(); ctx.moveTo(hs + tw / 2, 5); ctx.lineTo(hs + tw / 2, sz - 5); ctx.stroke();
    // Track markers on minimap
    for (var mi = 0; mi < this._trackMarkerMeshes.length; mi++) {
      var mz = hs + this._trackMarkerMeshes[mi].z * sc;
      ctx.strokeStyle = 'rgba(255,210,63,0.3)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hs - tw / 2, mz); ctx.lineTo(hs + tw / 2, mz); ctx.stroke();
    }
    // Finish line on minimap
    var finZ = hs + 1 * sc;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(hs - tw / 2, finZ - 1, tw, 2);
    // Item boxes
    for (var i = 0; i < this._itemBoxes.length; i++) { var b = this._itemBoxes[i]; if (!b.visible) continue; ctx.fillStyle = 'rgba(0,229,255,0.7)'; ctx.fillRect(hs + b.position.x * sc - 2, hs + b.position.z * sc - 2, 4, 4); }
    // Boost pads
    for (var j = 0; j < this._boostPads.length; j++) { var p = this._boostPads[j]; ctx.fillStyle = 'rgba(0,255,136,0.4)'; ctx.fillRect(hs + p.position.x * sc - 3, hs + p.position.z * sc - 5, 6, 10); }
    // Opponents on minimap
    for (var oi = 0; oi < this._opponents.length; oi++) {
      var opp = this._opponents[oi];
      var ox = hs + opp.mesh.position.x * sc;
      var oy = hs + opp.mesh.position.z * sc;
      ctx.fillStyle = '#' + this._opponentColors[oi].toString(16).padStart(6, '0');
      ctx.beginPath(); ctx.arc(ox, oy, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // Player
    var px = hs + this._vehicle.position.x * sc, py = hs + this._vehicle.position.z * sc;
    ctx.fillStyle = 'rgba(0,229,255,0.2)'; ctx.beginPath(); ctx.arc(px, py, 6 + Math.sin(performance.now() * 0.005) * 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#00e5ff'; ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.strokeRect(0, 0, sz, sz);
  }

  // ==================== PICKUPS ====================

  _checkItemPickups() {
    if (!this._vehicle) return; var now = performance.now();
    for (var i = 0; i < this._itemBoxes.length; i++) {
      var b = this._itemBoxes[i]; if (now < b.userData.cooldownUntil || !b.visible) continue;
      if (this._vehicle.position.distanceTo(b.position) < 3) {
        b.userData.cooldownUntil = now + 5000; b.visible = false;
        var items = ['boost', 'shield', 'missile', 'speed']; var item = items[Math.floor(Math.random() * items.length)];
        // Trigger pickup flash
        this._itemPickupFlash = 1.0;
        if (window.__engine && window.__engine.bus) window.__engine.bus.emit('item:picked', { item: item, boxIndex: i });
        (function(x) { setTimeout(function() { x.visible = true; }, 5000); })(b);
      }
    }
  }

  _checkBoostPads() {
    if (!this._vehicle) return;
    for (var i = 0; i < this._boostPads.length; i++) {
      var p = this._boostPads[i]; if (this._vehicle.position.distanceTo(p.position) < 4 && !p.userData.active) {
        p.userData.active = true; this._boostCharges = Math.min(this._boostMaxCharges, this._boostCharges + 1); this._updateBoostPips();
        (function(x) { setTimeout(function() { x.userData.active = false; }, 2000); })(p);
        if (window.__engine && window.__engine.bus) window.__engine.bus.emit('player:boostPadHit');
      }
    }
  }

  // ==================== HUD UPDATE ====================

  _updateHUD(dt) {
    if (this._hudRefs.speed) this._hudRefs.speed.textContent = String(Math.round(this._state.speed));
    if (this._hudRefs.time && this._startRaceTime) this._hudRefs.time.textContent = this._formatTime(performance.now() - this._startRaceTime);
    if (this._hudRefs.posNum) {
      var p = this._state.position, sfx = p === 1 ? 'st' : (p === 2 ? 'nd' : (p === 3 ? 'rd' : 'th'));
      this._hudRefs.posNum.textContent = p + sfx;
      this._hudRefs.posNum.style.color = p === 1 ? '#00e5ff' : (p <= 3 ? '#ffd23f' : '#fff');
    }
    if (this._hudRefs.progressFill && this._vehicle) {
      var td = this._trackLength * this._state.totalLaps;
      var cd = (this._state.lap - 1) * this._trackLength + (this._vehicle.position.z + this._trackLength / 2);
      var pr = Math.max(0, Math.min(100, (cd / td) * 100));
      this._hudRefs.progressFill.style.width = pr + '%';
      if (this._hudRefs.progressText) this._hudRefs.progressText.textContent = Math.floor(pr) + '%';
    }
  }

  _formatTime(ms) {
    var ts = ms / 1000, m = Math.floor(ts / 60), s = ts % 60, ms2 = Math.floor((s % 1) * 1000);
    return String(m).padStart(2, '0') + ':' + String(Math.floor(s)).padStart(2, '0') + '.' + String(ms2).padStart(3, '0');
  }

  // ==================== FINISH ====================

  _finishRace() {
    this._state.running = false; this._removeInputListeners();
    var ft = performance.now() - this._startRaceTime;
    // Final lap split
    if (this._lastLapStartTime > 0) {
      var finalSplit = performance.now() - this._lastLapStartTime;
      this._lapSplits.push(finalSplit);
      if (finalSplit < this._bestLapTime) this._bestLapTime = finalSplit;
    }
    if (window.__engine && window.__engine.bus) window.__engine.bus.emit('race:end', {
      result: {
        finished: true, timeMs: ft, lapsCompleted: this._state.lap - 1,
        position: this._state.position, totalTime: ft, topSpeed: this._state.speed,
        driftScore: this._totalDriftScore,
        lapSplits: this._lapSplits, bestLap: this._bestLapTime
      }
    });
    console.log('[RaceScene] Race finished! Time:', this._formatTime(ft), 'Best Lap:', this._bestLapTime < Infinity ? this._formatTime(this._bestLapTime) : 'N/A');
  }

  // ==================== CLEANUP ====================

  async unmount() {
    this._state.running = false; this._paused = false; this._removePauseOverlay(); this._removeInputListeners();
    if (this._scene) this._scene.traverse(function(o) { if (o.geometry) o.geometry.dispose(); if (o.material) { if (Array.isArray(o.material)) o.material.forEach(function(m) { m.dispose(); }); else o.material.dispose(); } });
    if (this._hudElement && this._hudElement.parentNode) this._hudElement.remove();
    console.log('[RaceScene] Unmounted');
  }

  getSpeedKmh() { return this._state.speed; }
  getSpeed() { return this._state.speed / 3.6; }
}

var _instance = null;
export function getRaceScene() { if (!_instance) _instance = new RaceScene(); return _instance; }
if (typeof window !== 'undefined') window.__raceScene = getRaceScene();

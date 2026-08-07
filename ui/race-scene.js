// ui/race-scene.js — AAA RACING SCENE
// Dual Mode: Track-Bound (NFS/Mario Kart) AND Open-World (Free Roam)
// Performance: Merged geometries, instanced meshes, minimal draw calls
// HUD: Proper DOM structure matching hud.css exactly

import * as THREE from 'three';
import { AIOpponentSystem } from './ai-opponents.js';

export class RaceScene {
  // Racing mode constants
  static get MODE() { return { TRACK_BOUND: 'track_bound', OPEN_WORLD: 'open_world' }; }
  static get RACE_TYPE() { return { QUICK_RACE: 'quick_race', TIME_TRIAL: 'time_trial', CAREER: 'career', TOURNAMENT: 'tournament', ONLINE: 'online' }; }
  
  constructor(raceConfig) {
    // raceConfig: { mode: 'track_bound'|'open_world', raceType: 'quick_race'|'time_trial'|..., laps: 3, ... }
    // FIXED: Default to OPEN_WORLD mode for proper free-roam driving (user can switch to TRACK_BOUND)
    this._raceConfig = raceConfig || { mode: RaceScene.MODE.OPEN_WORLD, raceType: RaceScene.RACE_TYPE.QUICK_RACE, laps: 3 };
    
    this._scene = null;
    this._camera = null;
    this._renderer = null;
    this._track = null;
    this._vehicle = null;
    this._sky = null;
    this._lights = {
      ambient: null,
      directional: null,
      pointLights: [],
      spotLights: []
    };
    this._clock = new THREE.Clock();
    
    this._barrelVehicle = null;
    this._useBarrelVehicle = false;
    this._vehicleContext = null;
    
    // Track-following state (for track-bound mode)
    this._trackProgress = 0;        // Position along spline (0-1)
    this._lateralOffset = 0;        // Left/right offset on track (-1 to 1)
    this._targetLateralOffset = 0;  // Smoothed lateral target
    
    this._state = {
      running: false,
      speed: 0,
      position: 0,
      lap: 1,
      totalLaps: this._raceConfig.laps || 3,
      countdown: false,
      raceStarted: false,
      countdownValue: 3,
      bestLapTime: Infinity,
      lapTimes: [],
      checkpointsPassed: 0,
      totalCheckpoints: 16
    };
    
    this._trackSegments = [];
    this._trackLength = 2000;
    this._trackWidth = 20;
    
    this._keys = {
      throttle: false,
      brake: false,
      steerLeft: false,
      steerRight: false,
      drift: false,
      nitro: false
    };
    
    // Nitro fuel system
    this._nitroFuel = 100;
    this._nitroMax = 100;
    this._nitroRechargeRate = 8;   // fuel/sec when not in use
    this._nitroDrainRate = 25;      // fuel/sec when active
    
    // Shield system
    this._shieldActive = false;
    this._shieldTimer = 0;
    
    // === CYCLE 21: DRIFT SCORING SYSTEM ===
    this._driftScore = 0;
    this._driftChain = 0;
    this._currentDriftScore = 0;
    this._isDrifting = false;
    this._driftTimer = 0;
    this._driftThreshold = 0.25;    // Min steer angle to count as drift
    this._driftFadeTimer = 0;
    this._totalDriftScore = 0;
    this._bestDriftScore = 0;
    
    // === CYCLE 21: BOOST PADS ===
    this._boostPads = [];
    this._boostPadCooldowns = {};
    this._boostPadEffectTimer = 0;
    
    // === CYCLE 21: REAR-VIEW MIRROR ===
    this._rearviewCanvas = null;
    this._rearviewCtx = null;
    this._rearviewCamera = null;
    this._rearviewRenderTimer = 0;
    
    // === CYCLE 21: POSITION TRACKING ===
    this._currentRacePosition = 1;
    this._lastRacePosition = 1;
    this._positionAnnounceTimer = 0;
    
    // === CYCLE 33: Update Race Progress Ring ===
    if (this._progressRingEl && this._progressRingCirc) {
      var totalProgress = ((this._state.lap - 1) + this._trackProgress) / this._state.totalLaps;
      totalProgress = Math.min(1, Math.max(0, totalProgress));
      var offset = this._progressRingCirc * (1 - totalProgress);
      this._progressRingEl.setAttribute('stroke-dashoffset', String(offset));
      var plabel = document.getElementById('hud-progress-label');
      if (plabel) plabel.textContent = Math.round(totalProgress * 100) + '%';
    }

    // === CYCLE 33: Update Lap Split Time ===
    var splitEl = document.getElementById('hud-lap-split');
    if (splitEl && this._state.raceStarted) {
      var elapsed = this._clock.getElapsedTime();
      var lapStart = 0;
      if (this._state.lapTimes.length > 0) {
        // Approximate: use total elapsed minus previous lap times
        for (var li = 0; li < this._state.lapTimes.length - 1; li++) {
          lapStart += this._state.lapTimes[li];
        }
      }
      var splitTime = elapsed - lapStart;
      var splitMin = Math.floor(splitTime / 60);
      var splitSec = Math.floor((splitTime % 60));
      var splitMs = Math.floor((splitTime % 1) * 100);
      splitEl.textContent = String(splitMin).padStart(2, '0') + ':' + String(splitSec).padStart(2, '0') + '.' + String(splitMs).padStart(2, '0');
    }

    // === CYCLE 33: NEW VISUAL OVERLAY STATE ===
    this._speedLinesOverlay = null;
    this._chromaticOverlay = null;
    this._overboostFlash = null;
    this._driftComboEl = null;
    this._closePassCombo = 0;
    this._closePassTimer = 0;
    this._lastClosePassTime = 0;
    this._raceEventsShown = {};
    this._motionBlurTimer = 0;

    // FPS counter
    this._fpsFrames = 0;
    this._fpsTime = 0;
    this._fpsDisplay = 0;
    this._topSpeeds = [];  // Track top speeds for results
    
    // === CYCLE 27: NEW VISUAL EFFECT STATE ===
    this._positionAnnounceTimer = 0;
    this._lastAnnouncedPosition = 1;
    this._driftIndicatorEl = null;
    this._nitroFlashEl = null;
    this._nitroBorderEl = null;
    this._shieldOverlayEl = null;
    this._checkpointFlashEl = null;
    this._lapCompleteEl = null;
    this._finalLapShown = false;
    this._driftTrailParticles = null;
    this._driftTrailData = null;

    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp = this._handleKeyUp.bind(this);
    this._hudElement = null;
  }
  
  _setupInputListeners() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }
  
  _removeInputListeners() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
  
  _handleKeyDown(e) {
    switch(e.code) {
      case 'KeyW': case 'ArrowUp': 
        this._keys.throttle = true; 
        if (window.__engine && window.__engine.input) window.__engine.input._setAction('throttle', 1);
        this._fadeControlsHint();
        break;
      case 'KeyS': case 'ArrowDown': 
        this._keys.brake = true; 
        if (window.__engine && window.__engine.input) window.__engine.input._setAction('brake', 1);
        break;
      case 'KeyA': case 'ArrowLeft': 
        this._keys.steerLeft = true; 
        if (window.__engine && window.__engine.input) window.__engine.input._setAction('steerLeft', 1);
        break;
      case 'KeyD': case 'ArrowRight': 
        this._keys.steerRight = true; 
        if (window.__engine && window.__engine.input) window.__engine.input._setAction('steerRight', 1);
        break;
      case 'Space': 
        this._keys.drift = true; 
        if (window.__engine && window.__engine.input) window.__engine.input._setAction('drift', 1);
        break;
      case 'ShiftLeft': case 'ShiftRight':
        this._keys.nitro = true;
        break;
      case 'KeyE':
        this._useItem();
        break;
      case 'KeyR':
        this._toggleWeather();
        break;
      case 'Escape':
        this._togglePause();
        break;
    }
  }
  
  _handleKeyUp(e) {
    switch(e.code) {
      case 'KeyW': case 'ArrowUp': 
        this._keys.throttle = false; 
        if (window.__engine && window.__engine.input) window.__engine.input._setAction('throttle', 0);
        break;
      case 'KeyS': case 'ArrowDown': 
        this._keys.brake = false; 
        if (window.__engine && window.__engine.input) window.__engine.input._setAction('brake', 0);
        break;
      case 'KeyA': case 'ArrowLeft': 
        this._keys.steerLeft = false; 
        if (window.__engine && window.__engine.input) window.__engine.input._setAction('steerLeft', 0);
        break;
      case 'KeyD': case 'ArrowRight': 
        this._keys.steerRight = false; 
        if (window.__engine && window.__engine.input) window.__engine.input._setAction('steerRight', 0);
        break;
      case 'Space':
        this._keys.drift = false;
        if (window.__engine && window.__engine.input) window.__engine.input._setAction('drift', 0);
        break;
      case 'ShiftLeft': case 'ShiftRight':
        this._keys.nitro = false;
        break;
    }
  }

  async mount(payload = {}) {
    console.log('[RaceScene] Mounting (OPTIMIZED)...');
    
    if (window.__engine) {
      this._renderer = window.__engine.renderer.getRenderer();
      this._scene = window.__engine.renderer.getScene();
      this._camera = window.__engine.renderer.getCamera();
      this._applyRendererOptimizations();
    }
    
    if (!this._scene || !this._camera || !this._renderer) {
      console.error('[RaceScene] Cannot mount');
      return;
    }
    
    this._config = payload;
    this._state.totalLaps = payload.laps || 3;
    this._state.track = payload.track || 'neon-dragway';
    
    const canvas = document.getElementById('game-canvas');
    if (canvas) canvas.style.display = 'block';
    
    // FIX: Remove any previous UI screens and the OLD HUD system (ui/hud.js) to prevent duplicates
    document.querySelectorAll('.screen-container, .screen-panel, [role="application"]').forEach(function(el) {
      el.style.display = 'none';
      el.remove();
    });
    // Remove old HUD from ui/hud.js (id="game-hud", different from our "game-hud-root")
    var oldHud = document.getElementById('game-hud');
    if (oldHud) { oldHud.style.display = 'none'; oldHud.remove(); console.log('[RaceScene] Removed old #game-hud'); }
    // Also hide via the HUD system API if available
    if (window.__hud && window.__hud.hide) { try { window.__hud.hide(); } catch(e) {} }
    console.log('[RaceScene] Previous screens cleaned up');

    this._setupInputListeners();
    
    try { this._createSky(); } catch (e) { console.error('[RaceScene] Sky failed:', e); }
    // CYCLE 32: Scene graph sanitization — remove null children that cause null.visible errors in bloom pass
    if (this._scene) {
      var toRemove = [];
      for (var si = 0; si < this._scene.children.length; si++) {
        if (this._scene.children[si] === null || this._scene.children[si] === undefined) {
          toRemove.push(si);
        }
      }
      for (var ri = toRemove.length - 1; ri >= 0; ri--) {
        this._scene.children.splice(toRemove[ri], 1);
      }
    }
    try { this._createLights(); } catch (e) { console.error('[RaceScene] Lights failed:', e); }
    try { this._createGround(); } catch (e) { console.error('[RaceScene] Ground failed:', e); }
    try { await this._createTrack(); } catch (e) { console.error('[RaceScene] Track failed:', e); }
    
    // AAA FIX: Always use fallback vehicle (barrel vehicle physics is broken - no ground plane)
    this._useBarrelVehicle = false;
    this._createVehicle();
    this._positionVehicleAtStart();
    
    try { this._createScenery(); } catch (e) { console.error('[RaceScene] Scenery failed:', e); }
    // === CYCLE 27: CREATE DRIFT TRAIL PARTICLE SYSTEM ===
    try { this._createDriftTrail(); } catch (e) { console.error('[RaceScene] Drift trail failed:', e); }
    
    // === CYCLE 21: CREATE BOOST PADS ON TRACK ===
    try { this._createBoostPads(); } catch (e) { console.error('[RaceScene] Boost pads failed:', e); }
    
    // === CYCLE 26: CREATE ITEM BOXES ===
    try { this._createItemBoxes(); } catch (e) { console.error('[RaceScene] Item boxes failed:', e); }
    
    // === CYCLE 33: MINIMAP LEGEND ===
    if (this._hudElement) {
      var mc = this._hudElement.querySelector('.hud-minimap-container');
      if (mc && !mc.querySelector('.hud-minimap-legend')) {
        var legend = document.createElement('div');
        legend.className = 'hud-minimap-legend';
        legend.innerHTML = '<span><span class="legend-dot player"></span>YOU</span>' +
          '<span><span class="legend-dot opponent"></span>OPP</span>' +
          '<span><span class="legend-dot item"></span>ITEM</span>';
        mc.appendChild(legend);
      }
    }

    // === CYCLE 21: SETUP REAR-VIEW MIRROR ===
    try { this._setupRearviewMirror(); } catch (e) { console.error('[RaceScene] Rear-view mirror failed:', e); }
    
    // === CYCLE 33: SETUP VISUAL OVERLAYS ===
    try { this._setupCycle33Overlays(); } catch (e) { console.error('[RaceScene] Cycle 33 overlays failed:', e); }
    
    // === ENHANCEMENT: SETUP BLOOM POST-PROCESSING ===
    try { this._setupBloom(); } catch (e) { console.error('[RaceScene] Bloom setup failed:', e); }
    
    // === ENHANCEMENT: WEATHER SYSTEM ===
    this._weather = 'clear';
    try { this._createWeatherSystem(); } catch (e) { console.error('[RaceScene] Weather system failed:', e); }
    
    // Spawn AI opponents on the track
    try {
      if (this._trackCurve) {
        this._aiSystem = new AIOpponentSystem(this._scene, this._trackCurve, this._trackWidth, {
          numOpponents: ((this._config && this._config.opponents) ? Number(this._config.opponents) : 5),
          difficulty: ((this._config && this._config.difficulty) ? this._config.difficulty : 'normal')
        });
        this._aiSystem.spawn();
        console.log('[RaceScene] AI opponents spawned');
      }
    } catch (e) { console.error('[RaceScene] AI spawn failed:', e); }
    
    try { this._createHUDElements(); } catch (e) { console.error('[RaceScene] HUD failed:', e); }
    
    // AAA FIX: Set camera BEHIND vehicle based on heading (not hardcoded offset)
    if (this._camera && this._vehicle) {
      var startHeading = this._heading || 0;
      var camDist = 14;
      var camH = 6;
      this._camera.position.set(
        this._vehicle.position.x - Math.sin(startHeading) * camDist,
        this._vehicle.position.y + camH,
        this._vehicle.position.z - Math.cos(startHeading) * camDist
      );
      var lookAhead = new THREE.Vector3(
        this._vehicle.position.x + Math.sin(startHeading) * 20,
        this._vehicle.position.y + 0.5,
        this._vehicle.position.z + Math.cos(startHeading) * 20
      );
      this._camera.lookAt(lookAhead);
    }
    
    // CYCLE 33: Hide HUD until race actually starts (prevents HUD on menu)
    if (this._hudElement) {
      this._hudElement.classList.remove('visible');
      this._hudElement.style.opacity = '0';
      this._hudElement.style.pointerEvents = 'none';
    }
    
    // CYCLE 32: Reset all state to prevent stale overlays
    this._state.running = true;
    this._state.speed = 0;
    this._state.position = 0;
    this._state.lap = 1;
    this._state.checkpointsPassed = 0;
    this._state.bestLapTime = Infinity;
    this._state.lapTimes = [];
    this._isDrifting = false;
    this._driftScore = 0;
    this._driftChain = 0;
    this._currentDriftScore = 0;
    this._driftTimer = 0;
    this._totalDriftScore = 0;
    this._bestDriftScore = 0;
    this._nitroFuel = 100;
    this._shieldActive = false;
    this._shieldTimer = 0;
    this._currentRacePosition = 1;
    this._lastRacePosition = 1;
    this._comboCount = 0;
    this._comboTimer = 0;
    this._topSpeedKmh = 0;
    this._topSpeeds = [];
    this._driftScoreDisplay = 0;
    this._driftMultiplier = 1.0;
    this._steerInput = 0;
    this._vehicleRoll = 0;
    this._vehiclePitch = 0;
    this._trackProgress = 0;
    this._lateralOffset = 0;
    this._targetLateralOffset = 0;
    this._minimapUpdateTimer = 0;
    this._finalLapShown = false;
    this._weather = this._config.weather || 'clear';
    this._pauseActive = false;
    // Clear all key states
    this._keys.throttle = false;
    this._keys.brake = false;
    this._keys.steerLeft = false;
    this._keys.steerRight = false;
    this._keys.drift = false;
    this._keys.nitro = false;
    // CRITICAL: Update global reference so external systems can access THIS race instance
    window.__raceScene = this;
    console.log('[RaceScene] Mounted' + (this._useBarrelVehicle ? ' +BARREL' : ' +FALLBACK'));
    console.log('[RaceScene] Scene children:', this._scene.children.length, '| Vehicle:', !!this._vehicle, '| Track:', !!this._track, '| Curve:', !!this._trackCurve);
    
    // CYCLE 33: Auto-fade controls hint after 5 seconds
    setTimeout(() => { if (!this._controlsHintFaded) this._fadeControlsHint(); }, 5000);
    
    // FIX: Start countdown sequence after mounting
    this._startCountdownSequence();
    
    if (window.__engine && window.__engine.bus) {
      window.__engine.bus.emit('race:sceneReady', { scene: this });
      window.__engine.bus.once('race:go', () => {
        this._state.raceStarted = true;
        this._barrelVehicleWatchdogStart = this._clock.getElapsedTime();
      });
    }
  }
  
  /**
   * FIX: Proper countdown sequence (3, 2, 1, GO!)
   * This replaces the broken HUD-based countdown
   */
  _startCountdownSequence() {
    let count = 3;
    
    // Show initial countdown
    this._showCountdown(count);
    console.log('[RaceScene] Countdown started:', count);
    
    // Countdown interval - every second
    this._countdownInterval = setInterval(() => {
      count--;
      
      if (count > 0) {
        // Show next number
        this._showCountdown(count);
        console.log('[RaceScene] Countdown:', count);
        
        // Play countdown sound effect
        if (window.__engine?.audio) {
          try { window.__engine.audio.play('game.countdown'); } catch(e) {}
        }
      } else if (count === 0) {
        // Show GO!
        this._showCountdown('GO!');
        // CYCLE 33: Show HUD now that race is starting
        if (this._hudElement) {
          this._hudElement.classList.add('visible');
          this._hudElement.style.opacity = '1';
          this._hudElement.style.pointerEvents = 'auto';
        }
        console.log('[RaceScene] GO!');
        
        // Play GO sound
        if (window.__engine?.audio) {
          try { window.__engine.audio.play('game.go'); } catch(e) {}
        }
        
        // Emit race:go after brief delay
        setTimeout(() => {
          this._hideCountdown();
          
          // Clear interval
          if (this._countdownInterval) {
            clearInterval(this._countdownInterval);
            this._countdownInterval = null;
          }
          
          // Mark race as started
          this._state.raceStarted = true;
          this._state.countdown = false;
          
          // Notify engine
          if (window.__engine?.bus) {
            window.__engine.bus.emit('race:go');
          }
          
          // Start engine sound
          if (window.__engine?.audio?.startEngine) {
            try { window.__engine.audio.startEngine(); } catch(e) {}
          }
          // Start background music
          if (window.__engine?.audio?.startMusic) {
            try { window.__engine.audio.startMusic(); } catch(e) {}
          }
          
          console.log('[RaceScene] Race STARTED!');
        }, 800);
      }
    }, 1000);
    
    // Store countdown state
    this._state.countdown = true;
  }
  
  _applyRendererOptimizations() {
    if (!this._renderer) return;
    this._renderer.shadowMap.enabled = false;
    const pixelRatio = Math.min(window.devicePixelRatio, 1.5);
    this._renderer.setPixelRatio(pixelRatio);
    
    // Bloom is set up via _setupBloom() in mount() after scene is ready
    // This avoids duplicate setup and import path issues
  }
  
  /**
   * Setup Unreal Bloom post-processing for neon glow
   */
  async _setupBloomEffect() {
    try {
      const { EffectComposer } = await import('three/examples/jsm/postprocessing/EffectComposer.js');
      const { RenderPass } = await import('three/examples/jsm/postprocessing/RenderPass.js');
      const { UnrealBloomPass } = await import('three/examples/jsm/postprocessing/UnrealBloomPass.js');
      const { OutputPass } = await import('three/examples/jsm/postprocessing/OutputPass.js');
      
      this._composer = new EffectComposer(this._renderer);
      this._composer.addPass(new RenderPass(this._scene, this._camera));
      
      // Neon bloom settings - subtle but noticeable
      this._bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.8,   // strength - moderate bloom
        0.3,   // radius - tight glow
        0.9    // threshold - only bright things glow
      );
      this._composer.addPass(this._bloomPass);
      this._composer.addPass(new OutputPass());
      
      console.log('[RaceScene] Bloom effect enabled');
    } catch (e) {
      console.warn('[RaceScene] Bloom not available:', e.message);
      this._composer = null;
    }
  }

  async _spawnBarrelVehicle(payload = {}) {
    const vehicleRegistry = window.__vehicleRegistry;
    const defaultVehicle = window.__defaultVehicle;
    
    if (!vehicleRegistry || vehicleRegistry.length === 0 || !defaultVehicle) return false;
    
    const entry = defaultVehicle.entry;
    const module = defaultVehicle.module;
    
    this._vehicleContext = {
      engine: window.__engine,
      physics: window.__engine ? window.__engine.physics : null,
      renderer: window.__engine ? window.__engine.renderer : null,
      input: window.__engine ? window.__engine.input : null,
      scene: this._scene
    };
    
    if (!this._vehicleContext.physics || !this._vehicleContext.physics.getCANNON) return false;
    
    try {
      if (typeof module.spawn === 'function') {
        // FIXED: Use proper starting position from track data instead of hardcoded coords
        var spawnPos = [0, 1, -this._trackLength / 2 + 15];
        if (this._trackData && this._trackData.startPos) {
          spawnPos = [this._trackData.startPos.x, 1, this._trackData.startPos.z];
        }
        this._barrelVehicle = module.spawn(entry, this._vehicleContext, spawnPos);
        if (!this._barrelVehicle || !this._barrelVehicle.physicsBody) return false;
        
        // FIXED: Immediately set correct orientation from track start tangent
        if (this._trackData && this._trackData.startTan && this._barrelVehicle.physicsBody.quaternion) {
          var angle = Math.atan2(this._trackData.startTan.x, this._trackData.startTan.z);
          var q = new THREE.Quaternion();
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
          this._barrelVehicle.physicsBody.quaternion.copy(q);
          this._heading = angle;
        }
        
        this._useBarrelVehicle = true;
        window.__raceScene._barrelVehicle = this._barrelVehicle;
        this._barrelVehicleWatchdogStart = this._clock.getElapsedTime();
        this._barrelVehicleWatchdogActive = true;
        return true;
      }
      return false;
    } catch (e) {
      console.warn('[RaceScene] Barrel spawn failed:', e);
      return false;
    }
  }

  async unmount() {
    this._state.running = false;
    this._removeInputListeners();
    
    // Dispose AI opponents
    if (this._aiSystem) {
      try { this._aiSystem.dispose(); } catch(e) {}
      this._aiSystem = null;
    }
    
    // Stop engine sound & music
    if (window.__engine?.audio?.stopEngine) {
      try { window.__engine.audio.stopEngine(); } catch(e) {}
    }
    if (window.__engine?.audio?.stopMusic) {
      try { window.__engine.audio.stopMusic(); } catch(e) {}
    }

    if (this._barrelVehicle && this._useBarrelVehicle) {
      try { if (typeof this._barrelVehicle.despawn === 'function') this._barrelVehicle.despawn(); } catch(e) {}
      this._barrelVehicle = null;
      this._useBarrelVehicle = false;
    }
    
    if (this._scene) {
      while (this._scene.children.length > 0) {
        const obj = this._scene.children[0];
        this._disposeObject(obj);
        this._scene.remove(obj);
      }
    }
    
    // Clean up ALL DOM elements created by this scene
    var domCleanups = [
      this._hudElement, this._driftHUDElement,
      this._driftIndicatorEl, this._nitroFlashEl, this._nitroBorderEl,
      this._shieldOverlayEl, this._checkpointFlashEl, this._lapCompleteEl,
      this._tachBarEl, this._rpmValueEl, this._speedLinesOverlayEl, this._driftChainBadgeEl,
      this._offTrackWarningEl, this._weatherIndicatorEl,
      this._vignetteOverlay,
      document.getElementById('hud-rearview-container'),
      document.getElementById('speed-vignette'),
      document.getElementById('hud-controls-hint'),
      document.getElementById('hud-sector-progress'),
      document.getElementById('final-lap-indicator')
    ];
    domCleanups.forEach(function(el) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    // CYCLE 32: Clean up ALL additional HUD overlays created during race
    var extraCleanups = [
      'proximity-warning', 'boost-trail-overlay', 'combo-counter',
      'drift-score-hud', 'race-finish-overlay', 'weather-toggle-btn',
      'track-edge-warning', 'checkpoint-progress-popup',
      'lap-time-delta', 'pause-overlay-container', 'race-photo-flash'
    ];
    extraCleanups.forEach(function(cls) {
      document.querySelectorAll('.' + cls).forEach(function(el) { el.remove(); });
    });
    document.querySelectorAll('.position-announce, .drift-score-popup, .final-lap-indicator, .countdown-go-flash, .countdown-speed-lines').forEach(function(el) { el.remove(); });
    // CYCLE 32: Clean up rearview canvas
    var rvCanvas = document.getElementById('rearview-canvas');
    if (rvCanvas && rvCanvas.parentNode) rvCanvas.parentNode.removeChild(rvCanvas);
    var rvContainer = document.getElementById('hud-rearview-container');
    if (rvContainer && rvContainer.parentNode) rvContainer.parentNode.removeChild(rvContainer);
    // CYCLE 32: Remove screen shake class
    document.body.classList.remove('fx-screen-shake');
    if (this._countdownInterval) { clearInterval(this._countdownInterval); this._countdownInterval = null; }

    this._track = null;
    this._vehicle = null;
    this._sky = null;
    this._trackSegments = [];
    this._hudElement = null;
  }
  
  _disposeObject(obj) {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(function(m) { m.dispose(); });
      else obj.material.dispose();
    }
    if (obj.children) obj.children.forEach(function(c) { this._disposeObject(c); }.bind(this));
  }

  update(dt) {
    // DEFENSIVE: Ensure dt is always a valid number (prevent ReferenceError cascade)
    if (typeof dt !== 'number' || !isFinite(dt)) dt = 0.016;
    if (!this._state.running) return;
    
    // Always use fallback vehicle (barrel physics disabled)
    if (this._vehicle) {
      this._updateFallbackVehicle(dt);
    }
    
    // Update AI opponents
    if (this._aiSystem && this._trackCurve) {
      var playerProgress = this._trackProgress;
      // For open-world mode, estimate progress from position
      if (this._raceConfig.mode === 'open_world' || !playerProgress) {
        if (this._trackCurve && this._vehicle) {
          var minDist = Infinity;
          for (var st = 0; st < 100; st++) {
            var t = st / 100;
            var pt = this._trackCurve.getPoint(t);
            var dx = this._vehicle.position.x - pt.x;
            var dz = this._vehicle.position.z - pt.z;
            var d = dx * dx + dz * dz;
            if (d < minDist) { minDist = d; playerProgress = t; }
          }
        }
      }
      this._aiSystem.update(dt, playerProgress);
    }
    
    // === CYCLE 33: PROXIMITY WARNING ===
    this._checkProximity();

    this._updateCamera(dt);
    this._updateHUDDirect();
    
    // WRAP: All remaining update logic in try/catch to prevent cascade failures
    try {
    if (this._floatingRings) {
      var time = this._clock.getElapsedTime();
      for (var fi = 0; fi < this._floatingRings.length; fi++) {
        var ring = this._floatingRings[fi];
        ring.position.y = ring.userData.baseY + Math.sin(time * ring.userData.floatSpeed + ring.userData.floatOffset) * 1.5;
        ring.rotation.y += dt * 0.5;
        // Pulse ring opacity
        ring.material.opacity = 0.4 + Math.sin(time * 2 + fi) * 0.2;
      }
    }
    
    // === CYCLE 26: ANIMATE SCENERY NEON ELEMENTS ===
    if (this._neonStrips) {
      var stime = this._clock.getElapsedTime();
      // Color cycle the left strip (red-magenta-pink)
      var lhue = (stime * 0.1) % 1;
      this._neonStrips.left.material.color.setHSL(lhue * 0.1 + 0.95, 1, 0.5);
      // Color cycle the right strip (cyan-blue-teal)
      var rhue = (stime * 0.1 + 0.5) % 1;
      this._neonStrips.right.material.color.setHSL(rhue * 0.1 + 0.45, 1, 0.5);
    }
    
    // Update engine sound based on current speed
    if (window.__engine?.audio?.updateEngineSound) {
      try { window.__engine.audio.updateEngineSound(this._state.speed); } catch(e) {}
    }
    
    // === CYCLE 21: NEW FEATURE UPDATES ===
    this._updateDriftScoring(dt);
    this._checkBoostPads(dt);
    this._updateRearviewMirror();
    this._updatePositionTrackingEnhanced();
    // === CYCLE 33: NEW VISUAL OVERLAY UPDATES ===
    this._updateCycle33Overlays(dt);
    this._updateDriftComboDisplay();
    this._checkClosePassCombo(dt);
    this._checkRaceMilestones();
    this._updateWeather(dt);
    this._checkItemBoxes(dt);

    // === CYCLE 27: NEW VISUAL EFFECTS UPDATE ===
    this._updateVisualEffects(dt);
    } catch (updateErr) {
      // CYCLE 33: Catch any error in update to prevent killing the game loop
      if (!this._updateErrorLogged || (this._clock.getElapsedTime() - (this._updateErrorLogged || 0)) > 5) {
        console.warn('[RaceScene] Update error (non-fatal):', updateErr.message);
        this._updateErrorLogged = this._clock.getElapsedTime();
      }
    }
  }
  
  _switchToFallbackVehicle() {
    if (this._barrelVehicle && typeof this._barrelVehicle.despawn === 'function') {
      try { this._barrelVehicle.despawn(); } catch(e) {}
    }
    this._barrelVehicle = null;
    this._useBarrelVehicle = false;
    this._barrelVehicleWatchdogActive = false;
    if (!this._vehicle) this._createVehicle();
    // FIXED: Use proper start position when switching to fallback
    if (this._vehicle) this._positionVehicleAtStart();
  }
  
  _updateBarrelVehicle(dt) {
    if (!this._barrelVehicle) return;
    try {
      if (typeof this._barrelVehicle.update === 'function') this._barrelVehicle.update(dt);
      
      var speedKmh = this._barrelVehicle.speedKmh || 0;
      this._state.speed = speedKmh / 3.6;
      
      if (window.__engine && window.__engine.bus) {
        window.__engine.bus.emit('player:speedChanged', { speed: this._state.speed, maxSpeed: 60, speedKmh: Math.round(speedKmh * 10) / 10 });
        
        var pos = this._barrelVehicle.physicsBody ? this._barrelVehicle.physicsBody.position : null;
        if (pos) {
          this._state.position = Math.abs(pos.z) + this._trackLength / 2;
          if (this._state.position > this._trackLength) {
            this._state.position = 0;
            this._state.lap++;
            window.__engine.bus.emit('player:lapCompleted', { lapNumber: this._state.lap - 1, lapTime: this._clock.getElapsedTime() });
          }
          this._minimapUpdateTimer = (this._minimapUpdateTimer || 0) + dt;
          if (this._minimapUpdateTimer > 0.15) {
            this._minimapUpdateTimer = 0;
            window.__engine.bus.emit('player:positionUpdate', { x: pos.x, y: pos.z, rotation: this._vehicle ? this._vehicle.rotation.y : 0, opponents: this._aiSystem ? this._aiSystem.getOpponentData() : [] });
          }
        }
        window.__engine.bus.emit('player:positionChanged', { position: 1, totalRacers: 8 });
        var gear = Math.min(6, Math.max(1, Math.floor(speedKmh / 30) + 1));
        window.__engine.bus.emit('player:gearChanged', { gear: gear });
      }
    } catch (e) {
      console.warn('[RaceScene] Barrel update error:', e);
    }
  }
  
  _updateFallbackVehicle(dt) {
    if (!this._vehicle) return;
    
    // DUAL MODE: Track-Bound (NFS style) OR Open-World (free roam)
    if (this._raceConfig.mode === RaceScene.MODE.TRACK_BOUND && this._trackData && this._trackData.curve) {
      this._updateTrackBoundVehicle(dt);
    } else {
      this._updateOpenWorldVehicle(dt);
    }
  }
  
  // TRACK-BOUND MODE: Car follows spline curve like NFS/Mario Kart
  _updateTrackBoundVehicle(dt) {
    var curve = this._trackData.curve;
    var trackLen = curve.getLength();
    
    // Physics constants
    var accelRate = 55;
    var brakeRate = 95;
    var maxSpeed = 65;
    var steerRate = 4.0;
    var lateralSpeed = 12; // How fast car moves side-to-side on track
    var friction = 1.5;
    var halfWidth = (this._trackWidth || 20) / 2 - 1.5; // Usable track width
    
    // Speed control
    if (this._keys.throttle && !this._keys.brake) {
      this._state.speed = Math.min(maxSpeed, this._state.speed + accelRate * dt);
      this._topSpeeds.push(this._state.speed);
    } else if (this._keys.brake && !this._keys.throttle) {
      if (this._state.speed > 0) this._state.speed = Math.max(0, this._state.speed - brakeRate * dt);
      else this._state.speed = Math.max(-maxSpeed * 0.2, this._state.speed - accelRate * dt * 0.5);
    } else {
      if (this._state.speed > 0) this._state.speed = Math.max(0, this._state.speed - friction * dt);
      else if (this._state.speed < 0) this._state.speed = Math.min(0, this._state.speed + friction * dt);
      if (Math.abs(this._state.speed) < 0.1) this._state.speed = 0;
    }
    
    // FIXED: Lateral steering - Left key now moves LEFT (negative offset), Right key moves RIGHT (positive offset)
    // In screen space: left side of screen = negative X = negative lateral offset
    if (this._keys.steerLeft) this._targetLateralOffset = Math.max(-1, this._targetLateralOffset - steerRate * dt * 0.8);
    else if (this._keys.steerRight) this._targetLateralOffset = Math.min(1, this._targetLateralOffset + steerRate * dt * 0.8);
    else this._targetLateralOffset *= 0.9; // Center slowly when no input
    
    // Smooth lateral movement
    this._lateralOffset += (this._targetLateralOffset - this._lateralOffset) * Math.min(1, lateralSpeed * dt);
    
    // Clamp to track bounds
    this._lateralOffset = Math.max(-1, Math.min(1, this._lateralOffset));
    
    // Progress along track based on speed
    var progressDelta = (this._state.speed / trackLen) * dt;
    this._trackProgress += progressDelta;
    
    // Handle lap completion (loop around)
    if (this._trackProgress >= 1) {
      this._trackProgress -= 1;
      var lapTime = this._clock.getElapsedTime();
      var prevLapTime = this._state.lapTimes.length > 0 ? this._state.lapTimes[this._state.lapTimes.length - 1] : null;
      this._state.lapTimes.push(lapTime);
      
      if (lapTime < this._state.bestLapTime) {
        this._state.bestLapTime = lapTime;
        this._showNotification('NEW BEST LAP: ' + this._formatTime(lapTime), 'success');
      }
      
      // CYCLE 32: Show lap time delta
      if (prevLapTime !== null) {
        var delta = lapTime - prevLapTime;
        this._showLapTimeDelta(delta, lapTime);
      }
      
      this._state.lap++;
      if (window.__engine) window.__engine.bus.emit('player:lapCompleted', { 
        lapNumber: this._state.lap - 1, 
        lapTime: lapTime,
        bestLapTime: this._state.bestLapTime
      });
      
      // Play lap complete sound
      if (window.__engine?.audio) {
        try { window.__engine.audio.play('game.lapComplete'); } catch(e) {}
      }
      
      // Show lap complete overlay
      if (this._lapCompleteEl) {
        this._lapCompleteEl.classList.remove('active');
        void this._lapCompleteEl.offsetWidth; // force reflow
        this._lapCompleteEl.classList.add('active');
        setTimeout(function() { if (this && this._lapCompleteEl) this._lapCompleteEl.classList.remove('active'); }.bind(this), 1300);
      }
      
      // Check race completion
      if (this._state.lap > this._state.totalLaps) {
        this._finishRace();
        return;
      }
    }
    
    // Handle reverse (going backwards on track)
    if (this._trackProgress < 0) {
      this._trackProgress += 1;
      this._state.lap--;
      if (this._state.lap < 1) this._state.lap = 1;
    }
    
    // Get position and orientation from curve
    var point = curve.getPoint(this._trackProgress);
    var tangent = curve.getTangent(this._trackProgress);
    
    // Calculate perpendicular direction for lateral offset
    // FIXED: Perpendicular now correctly maps: positive offset = right side, negative offset = left side
    var perp = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    
    // Apply lateral offset (positive = right, negative = left)
    var finalPos = point.clone().add(perp.multiplyScalar(this._lateralOffset * halfWidth));
    
    // Update vehicle position
    this._vehicle.position.copy(finalPos);
    this._vehicle.position.y = 0.5 + Math.sin(this._clock.getElapsedTime() * 6) * 0.015; // Slight bounce
    
    // Orient vehicle along track tangent
    var targetAngle = Math.atan2(tangent.x, tangent.z);
    
    // Add slight steering tilt visually
    var steerTilt = this._lateralOffset * 0.15;
    if (this._keys.drift) steerTilt *= 2.5;
    
    this._heading = targetAngle + steerTilt;
    this._vehicle.rotation.y = this._heading;
    
    // Roll effect when drifting/steering
    var rollTarget = this._keys.drift ? this._targetLateralOffset * 0.25 : this._targetLateralOffset * 0.08;
    this._vehicleRoll = this._vehicleRoll || 0;
    this._vehicleRoll += (rollTarget - this._vehicleRoll) * 0.15;
    this._vehicle.rotation.z = this._vehicleRoll;
    
    // Update state position (for HUD/display)
    this._state.position = this._trackProgress * trackLen;
    
    // Checkpoint detection (for lap validation)
    var checkpointIdx = Math.floor(this._trackProgress * this._state.totalCheckpoints);
    if (checkpointIdx > this._state.checkpointsPassed) {
      this._state.checkpointsPassed = checkpointIdx;
      // CYCLE 32: Show checkpoint progress popup
      var sectorNames = ['SECTOR 1', 'SECTOR 2', 'SECTOR 3', 'SECTOR 4'];
      var sectorIdx = Math.floor(checkpointIdx / (this._state.totalCheckpoints / 4));
      this._showCheckpointPopup(sectorNames[Math.min(sectorIdx, 3)] || ('CP ' + checkpointIdx));
      window.__engine.bus.emit('player:checkpointPassed', { 
        checkpoint: checkpointIdx, 
        total: this._state.totalCheckpoints 
      });
    }
    
    // Emit telemetry events
    if (window.__engine && window.__engine.bus) {
      var spdKmh = Math.abs(this._state.speed) * 3.6;
      var gr = Math.min(6, Math.max(1, Math.floor(spdKmh / 25) + 1));
      
      window.__engine.bus.emit('player:speedChanged', { 
        speed: Math.abs(this._state.speed), 
        maxSpeed: maxSpeed, 
        speedKmh: Math.round(spdKmh * 10) / 10 
      });
      window.__engine.bus.emit('player:positionChanged', { position: 1, totalRacers: 8 });
      window.__engine.bus.emit('player:gearChanged', { gear: gr });
      
      // Minimap update
      this._minimapUpdateTimer = (this._minimapUpdateTimer || 0) + dt;
      if (this._minimapUpdateTimer > 0.15) {
        this._minimapUpdateTimer = 0;
        window.__engine.bus.emit('player:positionUpdate', { 
          x: this._vehicle.position.x, 
          y: this._vehicle.position.z, 
          rotation: this._heading, 
          progress: this._trackProgress,
          opponents: this._aiSystem ? this._aiSystem.getOpponentData() : [] 
        });
      }
    }
  }
  
  // OPEN-WORLD MODE: Free roam driving (AAA feel)
  _updateOpenWorldVehicle(dt) {
    if (!this._vehicle) return;
    
    var accelRate = 55;
    var brakeRate = 100;
    var maxSpeed = 65;
    var maxReverseSpeed = 15;
    var steerRate = 3.2;
    var maxSteerAngle = Math.PI / 3.5;
    var friction = 2.5;
    var driftFriction = 0.6;
    
    if (this._heading === undefined) this._heading = 0;
    
    // Speed control with smooth feel
    if (this._keys.throttle && !this._keys.brake) {
      // Acceleration decreases at high speed (realistic)
      var speedFactor = 1 - (this._state.speed / maxSpeed) * 0.5;
      this._state.speed = Math.min(maxSpeed, this._state.speed + accelRate * speedFactor * dt);
      this._topSpeeds.push(this._state.speed);
    } else if (this._keys.brake && !this._keys.throttle) {
      if (this._state.speed > 0) {
        this._state.speed = Math.max(0, this._state.speed - brakeRate * dt);
      } else {
        this._state.speed = Math.max(-maxReverseSpeed, this._state.speed - accelRate * 0.4 * dt);
      }
    } else {
      // Natural deceleration
      var decel = this._keys.drift ? friction * driftFriction : friction;
      if (this._state.speed > 0) this._state.speed = Math.max(0, this._state.speed - decel * dt);
      else if (this._state.speed < 0) this._state.speed = Math.min(0, this._state.speed + decel * dt);
      if (Math.abs(this._state.speed) < 0.15) this._state.speed = 0;
    }
    
    // Steering: speed-dependent (less steering at high speed, more at low speed)
    // FIXED: Inverted signs - steerLeft now actually turns LEFT (negative heading change = turn left when facing +Z)
    var targetSteer = 0;
    if (this._keys.steerLeft) targetSteer = -1;
    if (this._keys.steerRight) targetSteer = 1;
    
    // Speed factor for steering: responsive at low speed, stable at high speed
    var steerSpeedFactor = Math.max(0.3, 1 - Math.abs(this._state.speed) / maxSpeed * 0.6);
    
    // ENHANCEMENT: Rain reduces effective grip by 10%
    if (this._weather === 'rain') {
      steerSpeedFactor *= 0.9;
    }
    
    if (Math.abs(this._state.speed) > 0.5) {
      this._steerInput = this._steerInput || 0;
      this._steerInput += (targetSteer - this._steerInput) * Math.min(1, steerRate * dt * 4);
      var steerAmount = this._steerInput * maxSteerAngle * steerSpeedFactor * dt;
      
      // Reverse steering when going backwards
      if (this._state.speed >= 0) this._heading += steerAmount;
      else this._heading -= steerAmount;
    }
    
    // Apply movement
    var moveDist = this._state.speed * dt;
    var dx = Math.sin(this._heading) * moveDist;
    var dz = Math.cos(this._heading) * moveDist;
    
    this._vehicle.position.x += dx;
    this._vehicle.position.z += dz;
    this._state.position += Math.abs(moveDist);
    
    // Keep vehicle on ground with slight hover
    this._vehicle.position.y = 0.5 + Math.sin(this._clock.getElapsedTime() * 5) * 0.02;
    
    // Visual rotation
    this._vehicle.rotation.y = this._heading;
    
    // Roll effect (body lean during turns)
    var rollTarget = this._keys.drift ? this._steerInput * 0.22 : this._steerInput * 0.08;
    this._vehicleRoll = this._vehicleRoll || 0;
    this._vehicleRoll += (rollTarget - this._vehicleRoll) * 0.12;
    this._vehicle.rotation.z = this._vehicleRoll;
    
    // Pitch effect (nose down during acceleration, up during braking)
    var pitchTarget = 0;
    if (this._keys.throttle && this._state.speed > 5) pitchTarget = -0.02;
    else if (this._keys.brake && this._state.speed > 5) pitchTarget = 0.03;
    this._vehiclePitch = this._vehiclePitch || 0;
    this._vehiclePitch += (pitchTarget - this._vehiclePitch) * 0.08;
    this._vehicle.rotation.x = this._vehiclePitch;
    
    // === EXHAUST TRAIL ANIMATION ===
    if (this._exhaustTrailData) {
      var ep = this._exhaustTrailData.positions;
      var speedFactor = Math.abs(this._state.speed) / 65;
      for (var ei = 0; ei < this._exhaustTrailData.count; ei++) {
        ep[ei * 3 + 2] -= dt * (2 + speedFactor * 8);
        if (ep[ei * 3 + 2] < -14) {
          ep[ei * 3 + 2] = -2.05;
          ep[ei * 3] = (Math.random() - 0.5) * 0.6;
          ep[ei * 3 + 1] = 0.25 + Math.random() * 0.1;
        }
      }
      this._exhaustTrail.geometry.attributes.position.needsUpdate = true;
      this._exhaustTrail.material.opacity = 0.2 + speedFactor * 0.5;
    }
    
    // === NITRO BOOST (with fuel system) ===
    if (this._nitroFlames) {
      var nitroActive = this._keys.nitro && this._state.speed > 5 && this._nitroFuel > 0;
      if (nitroActive && !this._nitroWasActive) {
        // Nitro just activated - play sound
        if (window.__engine?.audio) {
          try { window.__engine.audio.play('game.nitroActivate'); } catch(e) {}
        }
      }
      this._nitroWasActive = nitroActive;
      if (nitroActive) {
        this._nitroFuel = Math.max(0, this._nitroFuel - this._nitroDrainRate * dt);
        if (this._nitroFuel <= 0) nitroActive = false;
      } else {
        this._nitroFuel = Math.min(this._nitroMax, this._nitroFuel + this._nitroRechargeRate * dt);
      }
      for (var ni = 0; ni < this._nitroFlames.length; ni++) {
        this._nitroFlames[ni].visible = nitroActive;
        if (nitroActive) {
          var flicker = 0.8 + Math.random() * 0.5;
          this._nitroFlames[ni].scale.set(flicker, 0.6 + Math.random() * 1.0, flicker);
        }
      }
      if (this._nitroLight) {
        this._nitroLight.intensity = nitroActive ? 4 + Math.random() * 2 : 0;
      }
      if (nitroActive) {
        this._state.speed = Math.min(90, this._state.speed + 80 * dt);
        this._exhaustTrail.material.color.set('#00ccff');
        this._exhaustTrail.material.size = 0.6;
      } else {
        this._exhaustTrail.material.color.set('#ff6633');
        this._exhaustTrail.material.size = 0.35;
      }
      // Update nitro bar in HUD
      if (this._hudRefs && this._hudRefs.nitroBar) {
        this._hudRefs.nitroBar.style.width = (this._nitroFuel / this._nitroMax * 100) + '%';
        // Nitro glow class when full
        if (this._nitroFuel >= this._nitroMax) this._hudRefs.nitroBar.classList.add('full');
        else this._hudRefs.nitroBar.classList.remove('full');
        if (this._nitroFuel < 20) {
          this._hudRefs.nitroBar.style.background = 'linear-gradient(90deg, #ff3d5a, #ff8c00)';
        } else {
          this._hudRefs.nitroBar.style.background = 'linear-gradient(90deg, #00ccff, #00ffaa)';
        }
      }
    }
    
    // Soft world bounds (generous)
    var hitWall = false;
    if (Math.abs(this._vehicle.position.x) > 150) {
      this._vehicle.position.x = Math.sign(this._vehicle.position.x) * 150;
      this._state.speed *= 0.5;
      hitWall = true;
    }
    if (Math.abs(this._vehicle.position.z) > 250) {
      this._vehicle.position.z = Math.sign(this._vehicle.position.z) * 250;
      this._state.speed *= 0.5;
      hitWall = true;
      // === CYCLE 29: OFF-TRACK WARNING ===
      if (this._offTrackWarningEl) {
        this._offTrackWarningEl.classList.add('active');
        this._offTrackWarningTimer = 0.6;
      }
      if (this._hudRefs && this._hudRefs.speedValue) this._hudRefs.speedValue.style.color = '#ff3d5a';
    }

    // Track-bound collision: bounce off barrel track barriers if near track
    if (this._trackBounds) {
      // Only apply track bounds when car is near the track Z range
      var trackMinZ = this._trackBounds.minZ;
      var trackMaxZ = this._trackBounds.maxZ;
      if (trackMinZ !== undefined && this._vehicle.position.z >= trackMinZ && this._vehicle.position.z <= trackMaxZ) {
        if (this._vehicle.position.x < this._trackBounds.left) {
          this._vehicle.position.x = this._trackBounds.left;
          this._state.speed *= 0.7;
          this._steerInput *= -0.3;
          hitWall = true;
          if (this._offTrackWarningEl) { this._offTrackWarningEl.classList.add('active'); this._offTrackWarningTimer = 0.6; }
        }
        if (this._vehicle.position.x > this._trackBounds.right) {
          this._vehicle.position.x = this._trackBounds.right;
          this._state.speed *= 0.7;
          this._steerInput *= -0.3;
          hitWall = true;
          if (this._offTrackWarningEl) { this._offTrackWarningEl.classList.add('active'); this._offTrackWarningTimer = 0.6; }
        }
      }
    }
    
    // Lap counting for open world - SECTOR-BASED CHECKPOINT SYSTEM
    // Uses 4 sectors around the oval track for reliable lap detection
    if (!this._lapSectors) {
      // Define 4 checkpoint sectors for the oval track (centered on track path)
      this._lapSectors = [
        { x: 0, z: 0, r: 35, id: 0 },     // Start/Finish line
        { x: 110, z: -200, r: 50, id: 1 }, // Back straight / far end
        { x: 220, z: 0, r: 50, id: 2 },    // Right side turn
        { x: 110, z: 140, r: 50, id: 3 }   // Front straight return
      ];
      this._currentSector = -1;  // Which sector we last passed
      this._sectorsPassed = 0;    // How many unique sectors passed this lap
      this._passedSectorFlags = [false, false, false, false];
      this._lastLapDist = 0;      // Distance at last lap completion
    }
    
    var vx = this._vehicle.position.x;
    var vz = this._vehicle.position.z;
    
    // Check each sector
    for (var si = 0; si < this._lapSectors.length; si++) {
      var sector = this._lapSectors[si];
      var distToSector = Math.sqrt((vx - sector.x) * (vx - sector.x) + (vz - sector.z) * (vz - sector.z));
      
      if (distToSector < sector.r && !this._passedSectorFlags[si]) {
        // Entered a new sector
        this._passedSectorFlags[si] = true;
        this._currentSector = si;
        this._sectorsPassed++;
        
        // Emit checkpoint event
        if (window.__engine && window.__engine.bus) {
          window.__engine.bus.emit('player:checkpointPassed', {
            checkpoint: si,
            total: this._lapSectors.length
          });
        }
        
        // Update sector dots in HUD
        this._updateSectorDots();
        
        // === CYCLE 31: CHECKPOINT PROGRESS POPUP ===
        if (si > 0) {
          var cpPopup = document.createElement('div');
          cpPopup.className = 'checkpoint-progress-popup';
          var sectorNames = ['START/FINISH', 'BACK STRAIGHT', 'RIGHT TURN', 'HOME STRAIGHT'];
          cpPopup.innerHTML = '<div class="checkpoint-progress-text">CHECKPOINT ' + (si) + '/3 \u2014 ' + (sectorNames[si] || 'SECTOR ' + si) + '</div>';
          document.body.appendChild(cpPopup);
          setTimeout(function() { if (cpPopup.parentNode) cpPopup.parentNode.removeChild(cpPopup); }, 1600);
          // Sound
          if (window.__engine?.audio) {
            try { window.__engine.audio.play('game.checkpoint'); } catch(e) {}
          }
        }
        
        // Check for lap completion: crossed start/finish (sector 0) after passing all other sectors
        if (si === 0 && this._sectorsPassed >= this._lapSectors.length) {
          // LAP COMPLETED!
          var lapTime = this._clock.getElapsedTime();
          this._state.lap++;
          this._state.lapTimes.push(lapTime);
          
          if (lapTime < this._state.bestLapTime || this._state.bestLapTime === Infinity) {
            this._state.bestLapTime = lapTime;
          }
          
          if (window.__engine) window.__engine.bus.emit('player:lapCompleted', { 
            lapNumber: this._state.lap - 1, 
            lapTime: lapTime,
            bestLapTime: this._state.bestLapTime
          });
          
          // Play lap complete sound
          if (window.__engine?.audio) {
            try { window.__engine.audio.play('game.lapComplete'); } catch(e) {}
          }
          
          // Show lap complete overlay
          if (this._lapCompleteEl) {
            this._lapCompleteEl.classList.remove('active');
            void this._lapCompleteEl.offsetWidth;
            this._lapCompleteEl.classList.add('active');
            setTimeout(function() { if (this && this._lapCompleteEl) this._lapCompleteEl.classList.remove('active'); }.bind(this), 1300);
          }
          
          // === CYCLE 31: LAP TIME DELTA ===
          if (this._lastLapTime > 0) {
            var delta = lapTime - this._lastLapTime;
            this._lapTimeDeltas.push(delta);
            var lapIdx = this._state.lap - 2;
            var lapRow = document.getElementById('hud-lap-time-' + this._state.lap);
            if (lapRow) {
              var valSpan = lapRow.querySelector('.lap-time-value');
              if (valSpan) {
                var deltaEl = document.createElement('span');
                if (delta < 0) {
                  deltaEl.className = 'lap-time-delta faster';
                  deltaEl.textContent = ' ' + this._formatTime(Math.abs(delta));
                } else if (delta > 0) {
                  deltaEl.className = 'lap-time-delta slower';
                  deltaEl.textContent = ' +' + this._formatTime(delta);
                } else {
                  deltaEl.className = 'lap-time-delta best';
                  deltaEl.textContent = ' EQUAL';
                }
                valSpan.appendChild(deltaEl);
              }
            }
          }
          this._lastLapTime = lapTime;
          // Track best lap
          if (lapTime < this._bestLapTime) {
            this._bestLapTime = lapTime;
            this._showNotification('BEST LAP: ' + this._formatTime(lapTime), 'warning');
          }
          
          // Show checkpoint flash
          if (this._checkpointFlashEl) {
            this._checkpointFlashEl.classList.remove('active');
            void this._checkpointFlashEl.offsetWidth;
            this._checkpointFlashEl.classList.add('active');
            setTimeout(function() { if (this && this._checkpointFlashEl) this._checkpointFlashEl.classList.remove('active'); }.bind(this), 900);
          }
          
          // Reset sector tracking for next lap
          this._sectorsPassed = 1;  // Just passed sector 0
          this._passedSectorFlags = [true, false, false, false];
          this._lastLapDist = this._state.position;
          
          // Check race completion
          if (this._state.lap > this._state.totalLaps) {
            this._finishRace();
            return;
          }
        }
      }
    }
    
    // === UPDATE SPEED LINE PARTICLES ===
    if (this._speedLines) {
      var speedRatio = Math.abs(this._state.speed) / 65;
      this._speedLines.material.opacity = Math.max(0, (speedRatio - 0.5) * 1.5);
      if (speedRatio > 0.5) {
        var slp = this._speedLines.geometry.attributes.position.array;
        for (var sli = 0; sli < this._speedLineData.count; sli++) {
          // Reset line start positions around vehicle
          var angle = (sli / this._speedLineData.count) * Math.PI * 2 + this._clock.getElapsedTime() * 0.3;
          var dist = 3 + Math.random() * 5;
          slp[sli * 6] = this._vehicle.position.x + Math.cos(angle) * dist;
          slp[sli * 6 + 1] = this._vehicle.position.y + Math.random() * 3 + 0.5;
          slp[sli * 6 + 2] = this._vehicle.position.z + Math.sin(angle) * dist;
          // Line end trails behind vehicle based on speed
          var trailLen = 2 + speedRatio * 8;
          slp[sli * 6 + 3] = slp[sli * 6] - Math.sin(this._heading) * trailLen;
          slp[sli * 6 + 4] = slp[sli * 6 + 1];
          slp[sli * 6 + 5] = slp[sli * 6 + 2] - Math.cos(this._heading) * trailLen;
        }
        this._speedLines.geometry.attributes.position.needsUpdate = true;
      }
    }
    
    // === UPDATE DRIFT SMOKE ===
    if (this._driftSmoke) {
      var isDrifting = this._keys.drift && Math.abs(this._state.speed) > 10 && Math.abs(this._steerInput || 0) > 0.3;
      this._driftSmoke.visible = isDrifting;
      if (isDrifting) {
        this._driftSmoke.material.opacity = Math.min(0.4, Math.abs(this._steerInput || 0) * 0.5);
        this._driftSmoke.position.copy(this._vehicle.position);
        this._driftSmoke.position.y = 0.3;
        var dsp = this._driftSmokeData.positions;
        for (var dsi = 0; dsi < this._driftSmokeData.count; dsi++) {
          this._driftSmokeData.ages[dsi] += dt;
          if (this._driftSmokeData.ages[dsi] > 0.8) {
            this._driftSmokeData.ages[dsi] = 0;
            dsp[dsi * 3] = (Math.random() - 0.5) * 1.5;
            dsp[dsi * 3 + 1] = 0.1;
            dsp[dsi * 3 + 2] = (Math.random() - 0.5) * 1.5 - 1.5;
          } else {
            dsp[dsi * 3 + 1] += dt * 1.5;  // Rise
            dsp[dsi * 3] += (Math.random() - 0.5) * dt * 2; // Spread
            dsp[dsi * 3 + 2] += (Math.random() - 0.5) * dt * 2;
          }
        }
        this._driftSmoke.geometry.attributes.position.needsUpdate = true;
      }
    }
    
    // === UPDATE GROUND DUST ===
    if (this._groundDust && Math.abs(this._state.speed) > 3) {
      var dustIntensity = Math.min(0.25, Math.abs(this._state.speed) / 65 * 0.3);
      this._groundDust.material.opacity = dustIntensity;
      this._groundDust.position.copy(this._vehicle.position);
      this._groundDust.position.y = 0.1;
      var gdp = this._groundDustData.positions;
      for (var gdi = 0; gdi < this._groundDustData.count; gdi++) {
        gdp[gdi * 3 + 1] += dt * 0.5;
        gdp[gdi * 3] += (Math.random() - 0.5) * dt;
        gdp[gdi * 3 + 2] -= Math.abs(this._state.speed) * dt * 0.3;
        if (gdp[gdi * 3 + 1] > 0.5 || Math.abs(gdp[gdi * 3 + 2]) > 4) {
          gdp[gdi * 3] = (Math.random() - 0.5) * 2.5;
          gdp[gdi * 3 + 1] = Math.random() * 0.1;
          gdp[gdi * 3 + 2] = (Math.random() - 0.5) * 2 - 2;
        }
      }
      this._groundDust.geometry.attributes.position.needsUpdate = true;
    } else if (this._groundDust) {
      this._groundDust.material.opacity = 0;
    }
    
    // === UPDATE SPEED VIGNETTE OVERLAY ===
    if (this._vignetteOverlay) {
      var vRatio = Math.min(1, Math.abs(this._state.speed) / 80);
      this._vignetteOverlay.style.opacity = vRatio * 0.6;
      if (this._keys.nitro && this._nitroFuel > 0) {
        this._vignetteOverlay.style.background = 'radial-gradient(ellipse at center, transparent 40%, rgba(0,180,255,0.25) 100%)';
      } else if (vRatio > 0.6) {
        this._vignetteOverlay.style.background = 'radial-gradient(ellipse at center, transparent 50%, rgba(255,60,60,0.2) 100%)';
      } else {
        this._vignetteOverlay.style.background = 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.3) 100%)';
      }
    }
    
    // === FPS COUNTER ===
    this._fpsFrames++;
    this._fpsTime += dt;
    if (this._fpsTime >= 0.5) {
      this._fpsDisplay = Math.round(this._fpsFrames / this._fpsTime);
      this._fpsFrames = 0;
      this._fpsTime = 0;
      if (this._hudRefs && this._hudRefs.fpsCounter) {
        this._hudRefs.fpsCounter.textContent = this._fpsDisplay + ' FPS';
        this._hudRefs.fpsCounter.style.color = this._fpsDisplay >= 50 ? '#3ddc84' : this._fpsDisplay >= 30 ? '#ffb13d' : '#ff3d5a';
      }
    }
    
    // === SCREEN SHAKE ON COLLISION ===
    if (hitWall && this._renderer) {
      var canvas = this._renderer.domElement;
      canvas.classList.add('fx-screen-shake');
      setTimeout(function() { canvas.classList.remove('fx-screen-shake'); }, 300);
    }
    
    // === BRAKE LIGHTS GLOW ===
    if (this._brakeLights) {
      var isBraking = this._keys.brake && this._state.speed > 2;
      for (var bli = 0; bli < this._brakeLights.length; bli++) {
        this._brakeLights[bli].intensity = isBraking ? 3 + Math.random() * 2 : 0;
      }
    }
    
    // Emit telemetry
    if (window.__engine && window.__engine.bus) {
      var spd = Math.abs(this._state.speed) * 3.6;
      var gr = Math.min(6, Math.max(1, Math.floor(spd / 20) + 1));
      window.__engine.bus.emit('player:speedChanged', { 
        speed: Math.abs(this._state.speed), 
        maxSpeed: maxSpeed, 
        speedKmh: Math.round(spd * 10) / 10 
      });
      window.__engine.bus.emit('player:positionChanged', { position: 1, totalRacers: 8 });
      window.__engine.bus.emit('player:gearChanged', { gear: gr });
      
      this._minimapUpdateTimer = (this._minimapUpdateTimer || 0) + dt;
      if (this._minimapUpdateTimer > 0.15) {
        this._minimapUpdateTimer = 0;
        var opponents = this._aiSystem ? this._aiSystem.getOpponentData() : [];
        window.__engine.bus.emit('player:positionUpdate', { 
          x: this._vehicle.position.x, 
          y: this._vehicle.position.z, 
          rotation: this._heading, 
          progress: this._trackProgress,
          opponents: opponents
        });
      }
    }
  }
  
  // Race completion handler
  _finishRace() {
    this._state.running = false;
    
    // === CYCLE 33: FINISH FIREWORKS ===
    this._spawnFireworks();
    this._state.speed = 0;
    
    // Stop engine sound & music
    if (window.__engine?.audio?.stopEngine) {
      try { window.__engine.audio.stopEngine(); } catch(e) {}
    }
    if (window.__engine?.audio?.stopMusic) {
      try { window.__engine.audio.stopMusic(); } catch(e) {}
    }
    
    var totalTime = this._clock.getElapsedTime();
    var results = {
      laps: this._state.totalLaps,
      lapTimes: this._state.lapTimes.slice(),
      bestLapTime: this._state.bestLapTime,
      totalTime: totalTime,
      raceType: this._raceConfig.raceType,
      totalDriftScore: this._totalDriftScore,
      bestDriftScore: this._bestDriftScore,
      position: this._currentRacePosition,
      topSpeed: Math.round(Math.max(...(this._topSpeeds || [0])) * 3.6)
    };
    
    console.log('[RaceScene] Race Complete!', results);
    
    // === CYCLE 31: RACE FINISH IN-GAME OVERLAY ===
    if (this._raceFinishOverlayEl) {
      var ordinals = ['', '1st', '2nd', '3rd', '4th', '5th', '6th'];
      var posNum = results.position || 1;
      var posEl = document.getElementById('race-finish-position');
      var timeEl = document.getElementById('race-finish-time');
      if (posEl) posEl.textContent = ordinals[posNum] || (posNum + 'th');
      if (timeEl) timeEl.textContent = this._formatTime(results.totalTime);
      this._raceFinishOverlayEl.classList.add('active');
      // Remove after 3 seconds (results overlay takes over)
      setTimeout(function() { if (this && this._raceFinishOverlayEl) this._raceFinishOverlayEl.classList.remove('active'); }.bind(this), 3000);
    }
    
    // Show results overlay
    this._showRaceResults(results);
    
    if (window.__engine && window.__engine.bus) {
      window.__engine.bus.emit('race:finished', results);
    }
  }

  _showRaceResults(results) {
    var overlay = document.createElement('div');
    overlay.id = 'race-results-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;background:rgba(5,6,10,0.85);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);opacity:0;transition:opacity 0.5s ease;';
    
    var pos = results.position || 1;
    var posSuffixes = ['ST', 'ND', 'RD', 'TH', 'TH', 'TH'];
    var posColors = ['#ffd700', '#c0c0c0', '#cd7f32', '#3ddc84', '#00e5ff', '#ff8c00'];
    var posColor = posColors[Math.min(pos - 1, posColors.length - 1)];
    
    var lapTimesHTML = '';
    for (var li = 0; li < results.lapTimes.length; li++) {
      var lt = results.lapTimes[li];
      var mins = Math.floor(lt / 60);
      var secs = Math.floor(lt % 60);
      var ms = Math.floor((lt % 1) * 100);
      var timeStr = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0') + '.' + String(ms).padStart(2, '0');
      var isBest = lt <= results.bestLapTime + 0.001;
      lapTimesHTML += '<div class="result-lap-row' + (isBest ? ' best' : '') + '"><span class="result-lap-num">LAP ' + (li + 1) + '</span><span class="result-lap-time">' + timeStr + (isBest ? ' BEST' : '') + '</span></div>';
    }
    
    var bestLapStr = results.bestLapTime < Infinity ? this._formatTime(results.bestLapTime) : '--:--.--';
    var totalTimeStr = this._formatTime(results.totalTime);
    
    overlay.innerHTML = '\n      <div class="results-card">\n        <div class="results-header">\n          <div class="results-title">RACE COMPLETE</div>\n          <div class="results-position" style="color:' + posColor + ';text-shadow:0 0 20px ' + posColor + '">' + pos + posSuffixes[Math.min(pos - 1, 5)] + ' PLACE</div>\n        </div>\n        <div class="results-stats">\n          <div class="result-stat"><span class="stat-label">TOTAL TIME</span><span class="stat-value">' + totalTimeStr + '</span></div>\n          <div class="result-stat"><span class="stat-label">BEST LAP</span><span class="stat-value best-lap">' + bestLapStr + '</span></div>\n          <div class="result-stat"><span class="stat-label">TOP SPEED</span><span class="stat-value">' + (results.topSpeed || 0) + ' KM/H</span></div>\n          <div class="result-stat"><span class="stat-label">DRIFT SCORE</span><span class="stat-value">' + Math.round(results.totalDriftScore || 0) + '</span></div>\n        </div>\n        <div class="results-laps">\n          <div class="results-laps-title">LAP TIMES</div>\n          ' + lapTimesHTML + '\n        </div>\n        <button class="results-restart-btn" onclick="location.reload()">RACE AGAIN</button>\n      </div>\n    ';
    
    document.body.appendChild(overlay);
    
    // Fade in
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        overlay.style.opacity = '1';
      });
    });
    
    // Play finish fanfare
    if (window.__engine?.audio) {
      try { window.__engine.audio.play('game.finish'); } catch(e) {}
    }
    
    // === CYCLE 28: FIREWORKS CELEBRATION ===
    this._spawnFireworks();
  }

  // === CYCLE 28: FIREWORK BURST EFFECT ===
  _spawnFireworks() {
    var colors = ['#ff3d5a', '#00e5ff', '#ffcc00', '#3ddc84', '#ff4d2e', '#ff8c00'];
    var self = this;
    for (var wave = 0; wave < 5; wave++) {
      (function(w) {
        setTimeout(function() {
          for (var i = 0; i < 12; i++) {
            var fw = document.createElement('div');
            fw.className = 'firework-particle';
            var c = colors[Math.floor(Math.random() * colors.length)];
            var size = 4 + Math.random() * 8;
            fw.style.cssText = 'width:' + size + 'px;height:' + size + 'px;background:' + c + ';box-shadow:0 0 ' + (size * 2) + 'px ' + c + ';left:' + (15 + Math.random() * 70) + '%;top:' + (10 + Math.random() * 50) + '%;animation-delay:' + (Math.random() * 0.3) + 's;animation-duration:' + (0.8 + Math.random() * 0.8) + 's;';
            document.body.appendChild(fw);
            setTimeout(function(el) { if (el.parentNode) el.parentNode.removeChild(el); }, 2000, fw);
          }
        }, w * 400);
      })(wave);
    }
  }

  // SCENE CREATION
  // === CYCLE 32: PAUSE SYSTEM ===
  _togglePause() {
    if (!this._state.running && !this._pauseActive) return;
    this._pauseActive = !this._pauseActive;
    if (this._pauseActive) {
      this._state.running = false;
      // CYCLE 33: Lower canvas z-index so pause is clickable
      var canvas = document.getElementById('game-canvas');
      if (canvas) canvas.style.zIndex = '1';
      // Create pause overlay
      if (!document.getElementById('pause-overlay-container')) {
        var pauseEl = document.createElement('div');
        pauseEl.id = 'pause-overlay-container';
        pauseEl.className = 'pause-overlay-container';
        // CYCLE 33: Ensure pause is above everything
        pauseEl.style.cssText = 'position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;pointer-events:all;';
        pauseEl.innerHTML = '<div class="pause-card" style="position:relative;z-index:2;pointer-events:auto;">' +
          '<h2 class="pause-title">PAUSED</h2>' +
          '<div class="pause-buttons">' +
          '<button class="pause-btn pause-btn-resume" id="pause-resume-btn" style="pointer-events:auto;position:relative;z-index:2;">RESUME</button>' +
          '<button class="pause-btn pause-btn-restart" id="pause-restart-btn" style="pointer-events:auto;position:relative;z-index:2;">RESTART</button>' +
          '<button class="pause-btn pause-btn-quit" id="pause-quit-btn" style="pointer-events:auto;position:relative;z-index:2;">QUIT TO MENU</button>' +
          '</div>' +
          '</div>' +
          '<div class="pause-backdrop" style="position:absolute;inset:0;z-index:1;pointer-events:none;"></div>';
        document.body.appendChild(pauseEl);
        var self = this;
        document.getElementById('pause-resume-btn').addEventListener('click', function() { self._togglePause(); });
        document.getElementById('pause-restart-btn').addEventListener('click', function() { self._togglePause(); self._restartRace(); });
        document.getElementById('pause-quit-btn').addEventListener('click', function() { self._quitRace(); });
      }
      if (window.__engine?.audio) { try { window.__engine.audio.play('game.countdown'); } catch(e) {} }
      console.log('[RaceScene] Paused');
    } else {
      this._state.running = true;
      // CYCLE 33: Restore canvas z-index
      var canvas = document.getElementById('game-canvas');
      if (canvas) canvas.style.zIndex = '10';
      var pauseEl = document.getElementById('pause-overlay-container');
      if (pauseEl) pauseEl.remove();
      if (window.__engine?.audio) { try { window.__engine.audio.play('game.go'); } catch(e) {} }
      console.log('[RaceScene] Resumed');
    }
  }

  _restartRace() {
    if (window.__engine?.bus) {
      window.__engine.bus.emit('race:end');
      setTimeout(function() {
        window.__engine.bus.emit('race:start', window.__raceScene._config || {});
      }, 500);
    }
  }

  _quitRace() {
    if (window.__engine?.bus) {
      window.__engine.bus.emit('race:end');
    }
    var uiShell = document.getElementById('ui-shell');
    if (uiShell) uiShell.style.display = 'block';
    if (window.__uiRouter) window.__uiRouter.popToRoot();
  }

  _createSky() {
    var canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 512;
    var ctx = canvas.getContext('2d');
    var gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#050510');
    gradient.addColorStop(0.3, '#0a0a20');
    gradient.addColorStop(0.6, '#1a1035');
    gradient.addColorStop(1, '#2d1b4e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 512);
    var texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    this._scene.background = texture;
    this._scene.fog = new THREE.FogExp2('#0a0a15', 0.008);
    this._createStars();
  }

  _createGround() {
    // Large ground plane so the car is never over the purple void
    var groundGeo = new THREE.PlaneGeometry(800, 800);
    var groundMat = new THREE.MeshStandardMaterial({ color: '#08080f', roughness: 1, metalness: 0 });
    var ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.name = 'ground-plane';
    this._scene.add(ground);
    
    // Subtle grid lines on ground for sense of movement
    var gridHelper = new THREE.GridHelper(800, 80, '#151525', '#0e0e18');
    gridHelper.position.y = -0.02;
    gridHelper.name = 'ground-grid';
    this._scene.add(gridHelper);
  }

  _createStars() {
    var starCount = 800;
    var geometry = new THREE.BufferGeometry();
    var positions = new Float32Array(starCount * 3);
    var colors = new Float32Array(starCount * 3);
    
    for (var i = 0; i < starCount; i++) {
      var radius = 800 + Math.random() * 200;
      var theta = Math.random() * Math.PI * 2;
      var phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.abs(radius * Math.cos(phi));
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      var c = Math.random();
      if (c < 0.7) { colors[i * 3] = 1; colors[i * 3 + 1] = 1; colors[i * 3 + 2] = 1; }
      else if (c < 0.85) { colors[i * 3] = 0.8; colors[i * 3 + 1] = 0.9; colors[i * 3 + 2] = 1; }
      else { colors[i * 3] = 1; colors[i * 3 + 1] = 0.95; colors[i * 3 + 2] = 0.8; }
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    var material = new THREE.PointsMaterial({ size: 1.5, vertexColors: true, transparent: true, opacity: 0.85, sizeAttenuation: true });
    var stars = new THREE.Points(geometry, material);
    stars.name = 'starfield';
    this._scene.add(stars);
  }

  _createLights() {
    this._lights.ambient = new THREE.AmbientLight('#334466', 0.5);
    this._scene.add(this._lights.ambient);
    
    this._lights.directional = new THREE.DirectionalLight('#aabbff', 0.4);
    this._lights.directional.position.set(50, 100, -30);
    this._scene.add(this._lights.directional);
    
    var neonColors = [0xff00ff, 0x00ffff, 0xff0066, 0x00ff66];
    var spacing = this._trackLength / 5;
    
    for (var i = 0; i < 4; i++) {
      var light = new THREE.PointLight(neonColors[i], 3, 80);
      light.position.set((i % 2 === 0 ? -1 : 1) * (this._trackWidth / 3), 6, -this._trackLength / 2 + spacing * (i + 1));
      this._scene.add(light);
      this._lights.pointLights.push(light);
    }
    
    var hemi = new THREE.HemisphereLight('#223355', '#110822', 0.3);
    this._scene.add(hemi);
  }

  // =========================================================================
  // ENHANCEMENT: BLOOM POST-PROCESSING SETUP
  // =========================================================================
  _setupBloom() {
    var engine = window.__engine;
    if (!engine || !engine.renderer || typeof engine.renderer.setupPostFx !== 'function') {
      console.log('[RaceScene] Engine renderer has no setupPostFx, skipping bloom');
      return;
    }

    // Enable bloom on the renderer (it uses its own EffectComposer internally)
    // Force bloom parameters: strength 0.4, radius 0.4, threshold 0.85
    engine.renderer._bloomEnabled = true;
    engine.renderer._bloomStrength = 0.4;
    engine.renderer.setupPostFx().then(() => {
      // Only log success if composer was actually created
      if (engine.renderer._composer) {
        console.log('[RaceScene] Bloom post-processing enabled (strength=0.4, radius=0.4, threshold=0.85)');
      } else {
        console.warn('[RaceScene] Bloom setup returned but no composer was created');
      }
    }).catch(err => {
      console.warn('[RaceScene] Bloom setup failed:', err.message);
    });
  }

  // =========================================================================
  // ENHANCEMENT: WEATHER SYSTEM (Rain toggle with R key)
  // =========================================================================
  _createWeatherSystem() {
    // 200 rain particles using Points with additive blending
    var count = 200;
    var positions = new Float32Array(count * 3);
    var velocities = [];
    var spread = 80;
    var height = 60;

    for (var i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = Math.random() * height;
      positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
      velocities.push({
        speed: 15 + Math.random() * 20,
        drift: (Math.random() - 0.5) * 2
      });
    }

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    var material = new THREE.PointsMaterial({
      color: 0xaaddff,
      size: 0.3,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });

    this._rainMesh = new THREE.Points(geometry, material);
    this._rainMesh.name = 'weather-rain';
    this._rainMesh.visible = false;
    this._rainVelocities = velocities;
    this._rainCount = count;
    this._rainSpread = spread;
    this._rainHeight = height;
    this._scene.add(this._rainMesh);
    console.log('[RaceScene] Weather system created (R to toggle)');
  }

  _updateWeather(dt) {
    if (this._weather !== 'rain' || !this._rainMesh || !this._rainMesh.visible) return;

    var pos = this._rainMesh.geometry.attributes.position;
    var vehicleX = this._vehicle ? this._vehicle.position.x : 0;
    var vehicleZ = this._vehicle ? this._vehicle.position.z : 0;
    var halfSpread = this._rainSpread / 2;

    for (var i = 0; i < this._rainCount; i++) {
      var vel = this._rainVelocities[i];
      var y = pos.getY(i) - vel.speed * dt;
      var x = pos.getX(i) + vel.drift * dt;

      // Reset raindrop if below ground or too far from player
      if (y < -1 || Math.abs(x - vehicleX) > halfSpread) {
        y = this._rainHeight * (0.5 + Math.random() * 0.5);
        x = vehicleX + (Math.random() - 0.5) * this._rainSpread;
        pos.setZ(i, vehicleZ + (Math.random() - 0.5) * this._rainSpread);
      }

      pos.setX(i, x);
      pos.setY(i, y);
    }

    pos.needsUpdate = true;
  }

  _toggleWeather() {
    if (this._weather === 'clear') {
      this._weather = 'rain';
      if (this._rainMesh) this._rainMesh.visible = true;
      console.log('[RaceScene] Weather: RAIN (grip reduced by 10%)');
      this._showNotification('WEATHER: RAIN — Grip reduced!', 'warning');
    } else {
      this._weather = 'clear';
      if (this._rainMesh) this._rainMesh.visible = false;
      console.log('[RaceScene] Weather: CLEAR');
      this._showNotification('WEATHER: CLEAR', 'info');
    }
    if (window.__engine?.audio) {
      try { window.__engine.audio.play('game.countdown'); } catch(e) {}
    }
  }

  async _createTrack() {
    var built = await this._tryBuildBarrelTrack();
    if (built) { console.log('[RaceScene] Barrel track loaded'); return; }
    this._createProceduralTrack();
  }

  async _tryBuildBarrelTrack() {
    var trackRegistry = window.__trackRegistry;
    if (!trackRegistry || trackRegistry.length === 0) return false;
    var trackEntry = trackRegistry[0];
    if (!trackEntry || !trackEntry.module || !trackEntry.module.build) return false;
    try {
      var ctx = { renderer: window.__engine ? window.__engine.renderer : null, scene: this._scene, engine: window.__engine };
      var result = trackEntry.module.build(ctx, trackEntry.entry);
      if (result && result.group) {
        this._track = result.group;
        // NOTE: barrel track.downtown.js adds group to scene via ctx.renderer.addObject()
        // so we do NOT add again — avoids double-add which causes render duplication
        // this._scene.add(this._track);  // REMOVED: already added by barrel build()
        this._trackData = result;
        if (result.curve) {
          this._trackCurve = result.curve;  // CRITICAL: set curve so AI can spawn
          this._trackLength = result.curve.getLength();
        }
        console.log('[RaceScene] Barrel track loaded | Curve length:', Math.round(this._trackLength), 'm');
        return true;
      }
      return false;
    } catch (e) {
      console.warn('[RaceScene] Barrel track build failed, using procedural fallback:', e.message);
      return false;
    }
  }

  _createProceduralTrack() {
    this._track = new THREE.Group();
    this._track.name = 'racetrack';
    
    var halfWidth = this._trackWidth / 2;
    var trackLength = this._trackLength;
    
    var trackGeo = new THREE.PlaneGeometry(this._trackWidth, trackLength, 20, 40);
    var trackMat = new THREE.MeshStandardMaterial({ color: '#1a1a24', roughness: 0.85, metalness: 0.05 });
    var trackMesh = new THREE.Mesh(trackGeo, trackMat);
    trackMesh.rotation.x = -Math.PI / 2;
    this._track.add(trackMesh);
    
    var dashCount = Math.floor(trackLength / 8);
    var dashGeo = new THREE.PlaneGeometry(0.3, 5);
    var dashMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    var centerLines = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);
    var matrix = new THREE.Matrix4();
    for (var di = 0; di < dashCount; di++) {
      matrix.setPosition(0, 0.01, -trackLength / 2 + 4 + di * 8);
      centerLines.setMatrixAt(di, matrix);
    }
    centerLines.rotation.x = -Math.PI / 2;
    this._track.add(centerLines);
    
    var edgeSegLen = 50;
    var edgeCount = Math.ceil(trackLength / edgeSegLen);
    var edgeGeo = new THREE.PlaneGeometry(0.4, edgeSegLen);
    
    var leftEdgeMat = new THREE.MeshBasicMaterial({ color: '#ff00ff' });
    var leftEdges = new THREE.InstancedMesh(edgeGeo, leftEdgeMat, edgeCount);
    for (var li = 0; li < edgeCount; li++) {
      matrix.setPosition(-(halfWidth - 0.5), 0.02, -trackLength / 2 + edgeSegLen / 2 + li * edgeSegLen);
      leftEdges.setMatrixAt(li, matrix);
    }
    leftEdges.rotation.x = -Math.PI / 2;
    this._track.add(leftEdges);
    
    var rightEdgeMat = new THREE.MeshBasicMaterial({ color: '#00ffff' });
    var rightEdges = new THREE.InstancedMesh(edgeGeo, rightEdgeMat, edgeCount);
    for (var ri = 0; ri < edgeCount; ri++) {
      matrix.setPosition(halfWidth - 0.5, 0.02, -trackLength / 2 + edgeSegLen / 2 + ri * edgeSegLen);
      rightEdges.setMatrixAt(ri, matrix);
    }
    rightEdges.rotation.x = -Math.PI / 2;
    this._track.add(rightEdges);
    
    var startGeo = new THREE.PlaneGeometry(this._trackWidth, 3);
    var startCanvas = document.createElement('canvas');
    startCanvas.width = 128;
    startCanvas.height = 32;
    var startCtx = startCanvas.getContext('2d');
    startCtx.fillStyle = '#ffffff';
    startCtx.fillRect(0, 0, 128, 32);
    for (var sx = 0; sx < 16; sx++) {
      for (var sy = 0; sy < 4; sy++) {
        if ((sx + sy) % 2 === 0) { startCtx.fillStyle = '#000000'; startCtx.fillRect(sx * 8, sy * 8, 8, 8); }
      }
    }
    var startTexture = new THREE.CanvasTexture(startCanvas);
    var startMat = new THREE.MeshBasicMaterial({ map: startTexture });
    var startLine = new THREE.Mesh(startGeo, startMat);
    startLine.rotation.x = -Math.PI / 2;
    startLine.position.set(0, 0.03, -trackLength / 2 + 10);
    this._track.add(startLine);
    
    var groundGeo = new THREE.PlaneGeometry(500, trackLength + 200);
    var groundMat = new THREE.MeshStandardMaterial({ color: '#0a0a12', roughness: 1, metalness: 0 });
    var ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    this._track.add(ground);
    
    // AAA FIX: Add proper 3D barrier walls (not just flat lines)
    this._createBarrierWalls(this._track, halfWidth, trackLength);
    
    // Store track bounds for collision
    this._trackBounds = { left: -halfWidth + 1.5, right: halfWidth - 1.5, length: trackLength };
    
    this._scene.add(this._track);
  }

  // Position vehicle at correct track start
  _positionVehicleAtStart() {
    if (!this._vehicle) return;
    
    // Reset vehicle state
    this._steerInput = 0;
    this._vehicleRoll = 0;
    this._vehiclePitch = 0;
    this._state.speed = 0;
    
    if (this._trackData && this._trackData.curve) {
      if (this._raceConfig.mode === RaceScene.MODE.TRACK_BOUND) {
        this._trackProgress = 0;
        this._lateralOffset = 0;
        this._targetLateralOffset = 0;
        var point = this._trackData.curve.getPoint(0);
        var tangent = this._trackData.curve.getTangent(0);
        this._vehicle.position.copy(point);
        this._vehicle.position.y = 0.5;
        var angle = Math.atan2(tangent.x, tangent.z);
        this._vehicle.rotation.y = angle;
        this._heading = angle;
      } else {
        if (this._trackData.startPos) {
          this._vehicle.position.copy(this._trackData.startPos);
          this._vehicle.position.y = 0.5;
          if (this._trackData.startTan) {
            var angle = Math.atan2(this._trackData.startTan.x, this._trackData.startTan.z);
            this._vehicle.rotation.y = angle;
            this._heading = angle;
          }
        }
      }
      console.log('[RaceScene] Mode:', this._raceConfig.mode, '| Track:', Math.round(this._trackLength), 'm | Heading:', ((this._heading || 0) * 180 / Math.PI).toFixed(0) + 'deg');
    } else {
      this._vehicle.position.set(0, 0.5, -this._trackLength / 2 + 15);
      this._vehicle.rotation.y = 0;
      this._heading = 0;
      console.log('[RaceScene] Procedural track | Mode:', this._raceConfig.mode);
    }
    
    // Point headlight in driving direction
    var spotlight = this._vehicle.children.find(function(c) { return c instanceof THREE.SpotLight; });
    if (spotlight && spotlight.target) {
      var hd = this._heading || 0;
      spotlight.target.position.set(
        this._vehicle.position.x + Math.sin(hd) * 20,
        0,
        this._vehicle.position.z + Math.cos(hd) * 20
      );
    }
  }

  // AAA FIX: Create proper 3D barrier walls for procedural track
  _createBarrierWalls(trackGroup, halfWidth, trackLength) {
    var wallHeight = 1.2;
    var wallThickness = 0.5;
    var segmentLength = 25;
    var wallSegments = Math.ceil(trackLength / segmentLength);
    
    // Wall materials with neon glow effect
    var leftWallMat = new THREE.MeshStandardMaterial({ 
      color: '#ff2266', emissive: '#ff2266', emissiveIntensity: 0.4,
      metalness: 0.7, roughness: 0.3 
    });
    var rightWallMat = new THREE.MeshStandardMaterial({ 
      color: '#00ffff', emissive: '#00ffff', emissiveIntensity: 0.4,
      metalness: 0.7, roughness: 0.3 
    });
    var topStripeMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    
    // Create instanced walls for performance
    var wallGeo = new THREE.BoxGeometry(wallThickness, wallHeight, segmentLength);
    var stripeGeo = new THREE.BoxGeometry(wallThickness + 0.05, 0.15, segmentLength);
    
    var leftWalls = new THREE.InstancedMesh(wallGeo, leftWallMat, wallSegments);
    var rightWalls = new THREE.InstancedMesh(wallGeo, rightWallMat, wallSegments);
    var leftStripes = new THREE.InstancedMesh(stripeGeo, topStripeMat, wallSegments);
    var rightStripes = new THREE.InstancedMesh(stripeGeo, topStripeMat, wallSegments);
    
    var matrix = new THREE.Matrix4();
    var leftX = -(halfWidth - wallThickness / 2);
    var rightX = halfWidth - wallThickness / 2;
    
    for (var i = 0; i < wallSegments; i++) {
      var zPos = -trackLength / 2 + segmentLength / 2 + i * segmentLength;
      var yPos = wallHeight / 2;
      
      // Left wall
      matrix.setPosition(leftX, yPos, zPos);
      leftWalls.setMatrixAt(i, matrix);
      leftStripes.setMatrixAt(i, matrix);
      
      // Right wall  
      matrix.setPosition(rightX, yPos, zPos);
      rightWalls.setMatrixAt(i, matrix);
      rightStripes.setMatrixAt(i, matrix);
    }
    
    trackGroup.add(leftWalls);
    trackGroup.add(rightWalls);
    trackGroup.add(leftStripes);
    trackGroup.add(rightStripes);
    
    // Add glowing posts at intervals for visual flair
    var postCount = Math.floor(trackLength / 50);
    var postGeo = new THREE.CylinderGeometry(0.15, 0.2, wallHeight + 0.5, 8);
    var postMat = new THREE.MeshStandardMaterial({ color: '#333344', metalness: 0.8, roughness: 0.2 });
    var glowPostMat = new THREE.MeshBasicMaterial({ color: '#ff00ff' });
    
    var posts = new THREE.InstancedMesh(postGeo, postMat, postCount * 2);
    var glowTops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.25, 8, 8), glowPostMat, postCount * 2);
    
    for (var p = 0; p < postCount; p++) {
      var pz = -trackLength / 2 + 50 + p * 50;
      var py = (wallHeight + 0.5) / 2;
      
      // Left post
      matrix.setPosition(leftX, py, pz);
      posts.setMatrixAt(p * 2, matrix);
      glowTops.setMatrixAt(p * 2, matrix);
      
      // Right post
      matrix.setPosition(rightX, py, pz);
      posts.setMatrixAt(p * 2 + 1, matrix);
      glowTops.setMatrixAt(p * 2 + 1, matrix);
    }
    
    trackGroup.add(posts);
    trackGroup.add(glowTops);
    
    console.log('[RaceScene] Created barrier walls:', wallSegments * 2, 'segments,', postCount * 2, 'posts');
  }

  _createVehicle() {
    this._vehicle = new THREE.Group();
    this._vehicle.name = 'player-vehicle';
    
    var bodyMat = new THREE.MeshStandardMaterial({ color: '#ff3366', metalness: 0.8, roughness: 0.2 });
    var darkMat = new THREE.MeshStandardMaterial({ color: '#111122', metalness: 0.9, roughness: 0.1 });
    var accentMat = new THREE.MeshStandardMaterial({ color: '#00ffff', metalness: 0.9, roughness: 0.1, emissive: '#003344', emissiveIntensity: 0.3 });
    var wheelMat = new THREE.MeshStandardMaterial({ color: '#222233', roughness: 0.6 });
    var rimMat = new THREE.MeshStandardMaterial({ color: '#00ffff', metalness: 1, roughness: 0.2 });
    var glowMat = new THREE.MeshBasicMaterial({ color: '#00ffff', transparent: true, opacity: 0.6 });
    
    // Main body - wider, lower, more aggressive
    var bodyGeo = new THREE.BoxGeometry(2.2, 0.7, 4.5);
    var body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.45;
    this._vehicle.add(body);
    
    // Hood scoop (raised center section)
    var scoopGeo = new THREE.BoxGeometry(0.8, 0.2, 1.2);
    var scoop = new THREE.Mesh(scoopGeo, darkMat);
    scoop.position.set(0, 0.9, 1.0);
    this._vehicle.add(scoop);
    
    // Hood accent stripe
    var stripeGeo = new THREE.BoxGeometry(0.3, 0.01, 3.5);
    var stripeMat = new THREE.MeshBasicMaterial({ color: '#00ffff', transparent: true, opacity: 0.4 });
    var stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.set(0, 0.81, 0);
    this._vehicle.add(stripe);
    
    // Cabin / Windshield - sleeker profile
    var cabinGeo = new THREE.BoxGeometry(1.7, 0.55, 1.8);
    var cabin = new THREE.Mesh(cabinGeo, darkMat);
    cabin.position.set(0, 1.0, -0.3);
    this._vehicle.add(cabin);
    
    // Windshield (angled glass)
    var windshieldGeo = new THREE.BoxGeometry(1.5, 0.45, 0.1);
    var windshieldMat = new THREE.MeshStandardMaterial({ color: '#4488aa', metalness: 1, roughness: 0, transparent: true, opacity: 0.5 });
    var windshield = new THREE.Mesh(windshieldGeo, windshieldMat);
    windshield.position.set(0, 1.05, 0.55);
    windshield.rotation.x = 0.35;
    this._vehicle.add(windshield);
    
    // REAR SPOILER
    var spoilerWingGeo = new THREE.BoxGeometry(2.0, 0.06, 0.4);
    var spoilerWing = new THREE.Mesh(spoilerWingGeo, accentMat);
    spoilerWing.position.set(0, 1.25, -2.0);
    this._vehicle.add(spoilerWing);
    // Spoiler supports
    [-0.7, 0.7].forEach(function(x) {
      var supportGeo = new THREE.BoxGeometry(0.06, 0.45, 0.06);
      var support = new THREE.Mesh(supportGeo, darkMat);
      support.position.set(x, 1.0, -2.0);
      this._vehicle.add(support);
    }.bind(this));
    
    // SIDE SKIRTS
    [-1.15, 1.15].forEach(function(x) {
      var skirtGeo = new THREE.BoxGeometry(0.12, 0.2, 3.5);
      var skirt = new THREE.Mesh(skirtGeo, darkMat);
      skirt.position.set(x, 0.25, 0);
      this._vehicle.add(skirt);
      // Neon accent line on skirt
      var accentGeo = new THREE.BoxGeometry(0.14, 0.03, 2.5);
      var accent = new THREE.Mesh(accentGeo, glowMat);
      accent.position.set(x, 0.18, 0);
      this._vehicle.add(accent);
    }.bind(this));
    
    // WING MIRRORS
    [-1.2, 1.2].forEach(function(x) {
      var mirrorGeo = new THREE.BoxGeometry(0.2, 0.12, 0.15);
      var mirror = new THREE.Mesh(mirrorGeo, darkMat);
      mirror.position.set(x, 0.95, 0.4);
      this._vehicle.add(mirror);
    }.bind(this));
    
    // WHEELS with improved geometry
    var wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 16);
    var wheels = new THREE.InstancedMesh(wheelGeo, wheelMat, 4);
    var rimGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.34, 8);
    var rims = new THREE.InstancedMesh(rimGeo, rimMat, 4);
    
    var wheelPositions = [[-1.1, 0.42, 1.4], [1.1, 0.42, 1.4], [-1.1, 0.42, -1.4], [1.1, 0.42, -1.4]];
    var mat4 = new THREE.Matrix4();
    wheelPositions.forEach(function(pos, i) {
      mat4.makeRotationFromEuler(new THREE.Euler(0, 0, Math.PI / 2));
      mat4.setPosition(pos[0], pos[1], pos[2]);
      wheels.setMatrixAt(i, mat4);
      rims.setMatrixAt(i, mat4);
    });
    this._vehicle.add(wheels);
    this._vehicle.add(rims);
    this._wheelInstancedMesh = wheels;
    
    // UNDERGLOW - wider, brighter
    var underglowGeo = new THREE.BoxGeometry(2.4, 0.04, 4.6);
    var underglow = new THREE.Mesh(underglowGeo, glowMat);
    underglow.position.y = 0.12;
    this._vehicle.add(underglow);
    // Underglow point light
    var underglowLight = new THREE.PointLight('#00ffff', 1.5, 6);
    underglowLight.position.y = 0.2;
    this._vehicle.add(underglowLight);
    
    // HEADLIGHTS and TAILLIGHTS - larger, more visible
    var lightGeo = new THREE.CircleGeometry(0.18, 8);
    var headMat = new THREE.MeshBasicMaterial({ color: '#ffffcc' });
    var tailMat = new THREE.MeshBasicMaterial({ color: '#ff2200' });
    [-0.7, 0.7].forEach(function(x) {
      var hl = new THREE.Mesh(lightGeo, headMat);
      hl.position.set(x, 0.5, 2.26);
      this._vehicle.add(hl);
      var tl = new THREE.Mesh(lightGeo, tailMat);
      tl.position.set(x, 0.5, -2.26);
      tl.rotation.y = Math.PI;
      this._vehicle.add(tl);
    }.bind(this));
    
    // HEADLIGHT SPOTLIGHT
    var headlightL = new THREE.SpotLight('#ffffdd', 3, 50, Math.PI / 5, 0.6);
    headlightL.position.set(-0.7, 0.5, 2.3);
    headlightL.target.position.set(-0.7, 0, 20);
    this._vehicle.add(headlightL);
    this._vehicle.add(headlightL.target);
    var headlightR = new THREE.SpotLight('#ffffdd', 3, 50, Math.PI / 5, 0.6);
    headlightR.position.set(0.7, 0.5, 2.3);
    headlightR.target.position.set(0.7, 0, 20);
    this._vehicle.add(headlightR);
    this._vehicle.add(headlightR.target);
    
    // BRAKE LIGHTS (red point lights that intensify when braking)
    this._brakeLights = [];
    [-0.7, 0.7].forEach(function(x) {
      var bl = new THREE.PointLight('#ff2200', 0, 8);
      bl.position.set(x, 0.5, -2.5);
      this._vehicle.add(bl);
      this._brakeLights.push(bl);
    }.bind(this));
    
    // Position will be set by _positionVehicleAtStart() after track loads
    this._vehicle.position.set(0, 0.5, 0);
    this._scene.add(this._vehicle);
    
    // === PLAYER EXHAUST TRAIL ===
    var trailCount = 20;
    var trailGeo = new THREE.BufferGeometry();
    var trailPos = new Float32Array(trailCount * 3);
    var trailAlpha = new Float32Array(trailCount);
    for (var ti = 0; ti < trailCount; ti++) {
      trailPos[ti * 3] = 0;
      trailPos[ti * 3 + 1] = 0.3;
      trailPos[ti * 3 + 2] = -2.05 - ti * 0.5;
      trailAlpha[ti] = Math.max(0, 1 - ti / trailCount);
    }
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    var trailMat = new THREE.PointsMaterial({
      color: '#ff6633', size: 0.35, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    this._exhaustTrail = new THREE.Points(trailGeo, trailMat);
    this._exhaustTrailData = { positions: trailPos, count: trailCount };
    this._vehicle.add(this._exhaustTrail);
    
    // === SPEED LINE PARTICLES (world-space streaks at high speed) ===
    var speedLineCount = 80;
    var speedLineGeo = new THREE.BufferGeometry();
    var speedLinePos = new Float32Array(speedLineCount * 6); // 2 vertices per line
    var speedLineCol = new Float32Array(speedLineCount * 6);
    for (var sli = 0; sli < speedLineCount; sli++) {
      var angle = Math.random() * Math.PI * 2;
      var dist = 3 + Math.random() * 5;
      var baseX = Math.cos(angle) * dist;
      var baseZ = Math.sin(angle) * dist;
      speedLinePos[sli * 6] = baseX;
      speedLinePos[sli * 6 + 1] = Math.random() * 3 + 0.5;
      speedLinePos[sli * 6 + 2] = baseZ;
      speedLinePos[sli * 6 + 3] = baseX;
      speedLinePos[sli * 6 + 4] = Math.random() * 3 + 0.5;
      speedLinePos[sli * 6 + 5] = baseZ;
      var brightness = 0.3 + Math.random() * 0.7;
      for (var ci = 0; ci < 6; ci++) speedLineCol[sli * 6 + ci] = brightness;
    }
    speedLineGeo.setAttribute('position', new THREE.BufferAttribute(speedLinePos, 3));
    speedLineGeo.setAttribute('color', new THREE.BufferAttribute(speedLineCol, 3));
    var speedLineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this._speedLines = new THREE.LineSegments(speedLineGeo, speedLineMat);
    this._speedLines.frustumCulled = false;
    this._speedLineData = { count: speedLineCount };
    this._scene.add(this._speedLines);
    
    // === DRIFT SMOKE PARTICLES ===
    var smokeCount = 30;
    var smokeGeo = new THREE.BufferGeometry();
    var smokePos = new Float32Array(smokeCount * 3);
    var smokeSizes = new Float32Array(smokeCount);
    for (var smi = 0; smi < smokeCount; smi++) {
      smokePos[smi * 3] = (Math.random() - 0.5) * 2;
      smokePos[smi * 3 + 1] = 0.1;
      smokePos[smi * 3 + 2] = (Math.random() - 0.5) * 2 - 1.5;
      smokeSizes[smi] = 0.5 + Math.random() * 1.0;
    }
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
    var smokeMat = new THREE.PointsMaterial({ color: '#aaaaaa', size: 1.2, transparent: true, opacity: 0, blending: THREE.NormalBlending, depthWrite: false, sizeAttenuation: true });
    this._driftSmoke = new THREE.Points(smokeGeo, smokeMat);
    this._driftSmoke.visible = false;
    this._driftSmokeData = { positions: smokePos, count: smokeCount, ages: new Float32Array(smokeCount) };
    this._scene.add(this._driftSmoke);
    
    // === GROUND DUST PARTICLES ===
    var dustCount = 40;
    var dustGeo = new THREE.BufferGeometry();
    var dustPos = new Float32Array(dustCount * 3);
    for (var di = 0; di < dustCount; di++) {
      dustPos[di * 3] = (Math.random() - 0.5) * 3;
      dustPos[di * 3 + 1] = Math.random() * 0.3;
      dustPos[di * 3 + 2] = (Math.random() - 0.5) * 3 - 2;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    var dustMat = new THREE.PointsMaterial({ color: '#665544', size: 0.4, transparent: true, opacity: 0, blending: THREE.NormalBlending, depthWrite: false, sizeAttenuation: true });
    this._groundDust = new THREE.Points(dustGeo, dustMat);
    this._groundDustData = { positions: dustPos, count: dustCount };
    this._scene.add(this._groundDust);
    
    // === NITRO FLAME EFFECTS ===
    var nitroGeo = new THREE.ConeGeometry(0.35, 3.0, 6);
    var nitroMat = new THREE.MeshBasicMaterial({ color: '#00ccff', transparent: true, opacity: 0.7 });
    var nitroMat2 = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5 });
    this._nitroFlames = [];
    [-0.4, 0.4].forEach(function(x) {
      var flame = new THREE.Mesh(nitroGeo, nitroMat.clone());
      flame.position.set(x, 0.4, -2.7);
      flame.rotation.x = Math.PI / 2;
      flame.visible = false;
      this._vehicle.add(flame);
      this._nitroFlames.push(flame);
      
      var core = new THREE.Mesh(new THREE.ConeGeometry(0.18, 2.2, 6), nitroMat2.clone());
      core.position.set(x, 0.4, -2.4);
      core.rotation.x = Math.PI / 2;
      core.visible = false;
      this._vehicle.add(core);
      this._nitroFlames.push(core);
    }.bind(this));
    
    // Nitro point light (blue glow when active)
    this._nitroLight = new THREE.PointLight('#00ccff', 0, 15);
    this._nitroLight.position.set(0, 0.5, -3);
    this._vehicle.add(this._nitroLight);
  }

  // === CYCLE 21: BOOST PADS ON TRACK ===
  _createBoostPads() {
    if (!this._trackCurve) return;
    
    var padPositions = [0.15, 0.38, 0.62, 0.85]; // 4 boost pads at these track progress values
    var padGeo = new THREE.BoxGeometry(this._trackWidth * 0.6, 0.05, 3);
    var padGlowGeo = new THREE.BoxGeometry(this._trackWidth * 0.6 + 1, 0.02, 4);
    
    for (var pi = 0; pi < padPositions.length; pi++) {
      var t = padPositions[pi];
      var point = this._trackCurve.getPoint(t);
      var tangent = this._trackCurve.getTangent(t);
      var angle = Math.atan2(tangent.x, tangent.z);
      
      // Pad surface
      var padMat = new THREE.MeshBasicMaterial({ color: '#00ffaa', transparent: true, opacity: 0.35 });
      var pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(point.x, 0.03, point.z);
      pad.rotation.y = angle;
      pad.name = 'boost-pad-' + pi;
      this._scene.add(pad);
      
      // Glow underlay
      var glowMat = new THREE.MeshBasicMaterial({ color: '#00ffaa', transparent: true, opacity: 0.15 });
      var glow = new THREE.Mesh(padGlowGeo, glowMat);
      glow.position.set(point.x, 0.01, point.z);
      glow.rotation.y = angle;
      this._scene.add(glow);
      
      // Arrow indicators on pad (3 small arrows pointing forward)
      for (var ai = 0; ai < 3; ai++) {
        var arrowGeo = new THREE.ConeGeometry(0.3, 0.8, 4);
        var arrowMat = new THREE.MeshBasicMaterial({ color: '#00ffaa', transparent: true, opacity: 0.5 });
        var arrow = new THREE.Mesh(arrowGeo, arrowMat);
        var arrowOffset = (ai - 1) * 1.2;
        arrow.position.set(
          point.x + Math.sin(angle) * arrowOffset,
          0.08,
          point.z + Math.cos(angle) * arrowOffset
        );
        arrow.rotation.x = Math.PI / 2;
        arrow.rotation.z = -angle;
        this._scene.add(arrow);
      }
      
      // Point light for glow effect
      var padLight = new THREE.PointLight('#00ffaa', 2, 12);
      padLight.position.set(point.x, 1, point.z);
      this._scene.add(padLight);
      
      this._boostPads.push({
        mesh: pad, glow: glow, light: padLight,
        x: point.x, z: point.z, radius: 8,
        id: pi, cooldown: 0
      });
    }
    console.log('[RaceScene] ' + this._boostPads.length + ' boost pads created');
  }

  // === CYCLE 21: REAR-VIEW MIRROR ===
  _setupRearviewMirror() {
    // Create rear-view canvas element
    var container = document.createElement('div');
    container.className = 'hud-rearview-container';
    container.id = 'hud-rearview-container';
    var canvas = document.createElement('canvas');
    canvas.className = 'rearview-canvas';
    canvas.width = 240;
    canvas.height = 135;
    container.appendChild(canvas);
    document.body.appendChild(container);
    
    this._rearviewCanvas = canvas;
    this._rearviewCtx = canvas.getContext('2d');
    
    // Create a second camera for rear view
    this._rearviewCamera = new THREE.PerspectiveCamera(75, 240 / 135, 0.5, 200);
    console.log('[RaceScene] Rear-view mirror initialized');
  }

  _updateRearviewMirror() {
    if (!this._rearviewCamera || !this._camera || !this._vehicle || !this._renderer) return;
    
    // Only update every 3rd frame for performance
    this._rearviewRenderTimer++;
    if (this._rearviewRenderTimer % 3 !== 0) return;
    
    var vehPos = this._vehicle.position;
    var heading = this._heading || 0;
    
    // Position rear camera behind and above, looking backward
    this._rearviewCamera.position.set(
      vehPos.x - Math.sin(heading) * 2,
      vehPos.y + 2.5,
      vehPos.z - Math.cos(heading) * 2
    );
    
    // Look behind the vehicle
    var lookBehind = new THREE.Vector3(
      vehPos.x - Math.sin(heading) * 30,
      vehPos.y + 1,
      vehPos.z - Math.cos(heading) * 30
    );
    this._rearviewCamera.lookAt(lookBehind);
    
    // Render to the canvas
    this._renderer.render(this._scene, this._rearviewCamera);
    
    // Apply to 2D canvas with slight tint
    var ctx = this._rearviewCtx;
    ctx.drawImage(this._renderer.domElement, 0, 0, 240, 135);
    
    // Add dark overlay for mirror tint
    ctx.fillStyle = 'rgba(0, 10, 20, 0.25)';
    ctx.fillRect(0, 0, 240, 135);
    
    // Draw mirror frame border
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 238, 133);
    // === CYCLE 29: Enhanced mirror frame ===
    // Corner brackets
    var cLen = 15;
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.8)';
    ctx.lineWidth = 2;
    // Top-left
    ctx.beginPath(); ctx.moveTo(1, cLen); ctx.lineTo(1, 1); ctx.lineTo(cLen, 1); ctx.stroke();
    // Top-right
    ctx.beginPath(); ctx.moveTo(239 - cLen, 1); ctx.lineTo(239, 1); ctx.lineTo(239, cLen); ctx.stroke();
    // Bottom-left
    ctx.beginPath(); ctx.moveTo(1, 133 - cLen); ctx.lineTo(1, 133); ctx.lineTo(cLen, 133); ctx.stroke();
    // Bottom-right
    ctx.beginPath(); ctx.moveTo(239 - cLen, 133); ctx.lineTo(239, 133); ctx.lineTo(239, 133 - cLen); ctx.stroke();
    // REAR label
    ctx.fillStyle = 'rgba(0, 229, 255, 0.5)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('REAR', 6, 12);
  }

  // === CYCLE 33: SETUP VISUAL OVERLAYS ===
  _setupCycle33Overlays() {
    // Speed lines overlay
    if (!document.getElementById('speed-lines-overlay')) {
      this._speedLinesOverlay = document.createElement('div');
      this._speedLinesOverlay.id = 'speed-lines-overlay';
      document.body.appendChild(this._speedLinesOverlay);
    } else {
      this._speedLinesOverlay = document.getElementById('speed-lines-overlay');
    }
    // Chromatic aberration overlay
    if (!document.getElementById('chromatic-overlay')) {
      this._chromaticOverlay = document.createElement('div');
      this._chromaticOverlay.id = 'chromatic-overlay';
      document.body.appendChild(this._chromaticOverlay);
    } else {
      this._chromaticOverlay = document.getElementById('chromatic-overlay');
    }
    // Overboost flash
    if (!document.querySelector('.overboost-flash')) {
      this._overboostFlash = document.createElement('div');
      this._overboostFlash.className = 'overboost-flash';
      document.body.appendChild(this._overboostFlash);
    } else {
      this._overboostFlash = document.querySelector('.overboost-flash');
    }
    // Drift combo display
    if (!document.querySelector('.drift-combo-display')) {
      this._driftComboEl = document.createElement('div');
      this._driftComboEl.className = 'drift-combo-display';
      this._driftComboEl.innerHTML = '<div class="drift-combo-number">0</div>' +
        '<div class="drift-combo-label">DRIFT POINTS</div>' +
        '<div class="drift-combo-multiplier">x1.0</div>';
      document.body.appendChild(this._driftComboEl);
    } else {
      this._driftComboEl = document.querySelector('.drift-combo-display');
    }
  }

  // === CYCLE 33: UPDATE SPEED LINES + CHROMATIC + OVERBOOST ===
  _updateCycle33Overlays(dt) {
    if (!this._speedLinesOverlay) return;
    var speedRatio = Math.abs(this._state.speed) / 65;
    var isNitro = this._keys.nitro && this._nitroFuel > 0 && this._state.speed > 5;

    // Speed lines: active above 60% speed, intense above 85%
    if (speedRatio > 0.6) {
      this._speedLinesOverlay.classList.add('active');
      if (speedRatio > 0.85 || isNitro) this._speedLinesOverlay.classList.add('intense');
      else this._speedLinesOverlay.classList.remove('intense');
    } else {
      this._speedLinesOverlay.classList.remove('active', 'intense');
    }

    // Chromatic aberration during nitro
    if (isNitro) this._chromaticOverlay.classList.add('active');
    else this._chromaticOverlay.classList.remove('active');

    // Overboost flash when speed > 55 AND nitro
    if (this._overboostFlash) {
      if (isNitro && this._state.speed > 55) this._overboostFlash.classList.add('active');
      else this._overboostFlash.classList.remove('active');
    }

    // Motion blur streaks at very high speed
    if (speedRatio > 0.75) {
      this._motionBlurTimer += dt;
      if (this._motionBlurTimer > 0.08) {
        this._motionBlurTimer = 0;
        this._spawnMotionStreak();
      }
    }
  }

  // === CYCLE 33: SPAWN MOTION BLUR STREAK ===
  _spawnMotionStreak() {
    var streak = document.createElement('div');
    streak.className = 'motion-blur-streak';
    var w = 60 + Math.random() * 120;
    var y = Math.random() * window.innerHeight;
    streak.style.cssText = 'left:0;top:' + y + 'px;width:' + w + 'px;' +
      'background:linear-gradient(90deg, transparent, rgba(0,229,255,' + (0.1 + Math.random() * 0.2).toFixed(2) + '), transparent);';
    document.body.appendChild(streak);
    setTimeout(function() { if (streak.parentNode) streak.remove(); }, 400);
  }

  // === CYCLE 33: DRIFT COMBO DISPLAY UPDATE ===
  _updateDriftComboDisplay() {
    if (!this._driftComboEl) return;
    var numEl = this._driftComboEl.querySelector('.drift-combo-number');
    var multEl = this._driftComboEl.querySelector('.drift-combo-multiplier');
    if (!numEl || !multEl) return;

    if (this._isDrifting && this._currentDriftScore > 10) {
      this._driftComboEl.classList.add('active');
      if (this._driftChain > 0) this._driftComboEl.classList.add('chain-active');
      else this._driftComboEl.classList.remove('chain-active');
      numEl.textContent = Math.round(this._currentDriftScore).toLocaleString();
      var mult = 1.0 + this._driftChain * 0.5;
      multEl.textContent = 'x' + mult.toFixed(1);
    } else if (this._driftFadeTimer > 0 && this._driftScore > 0) {
      // Show fading score
      this._driftComboEl.classList.add('active');
      this._driftComboEl.classList.remove('chain-active');
      numEl.textContent = Math.round(this._driftScore).toLocaleString();
      multEl.textContent = this._driftChain > 0 ? 'x' + (1.0 + this._driftChain * 0.5).toFixed(1) : 'x1.0';
    } else {
      this._driftComboEl.classList.remove('active', 'chain-active');
    }
  }

  // === CYCLE 33: POSITION CHANGE ARROWS ===
  _showPositionChangeArrow(gained) {
    var arrow = document.createElement('div');
    arrow.className = 'position-change-arrow ' + (gained ? 'gained' : 'lost');
    arrow.textContent = gained ? '\u25B2 OVERTAKE' : '\u25BC PASSED';
    document.body.appendChild(arrow);
    setTimeout(function() { if (arrow.parentNode) arrow.remove(); }, 900);
  }

  // === CYCLE 33: RACE EVENT TOAST ===
  _showRaceEventToast(text, type, duration) {
    var toast = document.createElement('div');
    toast.className = 'race-event-toast ' + (type || 'info');
    toast.textContent = text;
    document.body.appendChild(toast);
    // Trigger animation
    requestAnimationFrame(function() {
      toast.classList.add('visible');
    });
    var dur = duration || 2000;
    setTimeout(function() {
      toast.classList.remove('visible');
      toast.classList.add('fade-out');
      setTimeout(function() { if (toast.parentNode) toast.remove(); }, 500);
    }, dur);
  }

  // === CYCLE 33: CLOSE PASS COMBO SYSTEM ===
  _checkClosePassCombo(dt) {
    if (!this._aiSystem || !this._vehicle) return;
    var playerPos = this._vehicle.position;
    var opponents = this._aiSystem.getOpponentData ? this._aiSystem.getOpponentData() : [];
    var now = this._clock.getElapsedTime();
    var closePass = false;

    for (var oi = 0; oi < opponents.length; oi++) {
      var opp = opponents[oi];
      if (!opp || !opp.position) continue;
      var dx = playerPos.x - opp.position.x;
      var dz = playerPos.z - opp.position.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      // Very close pass: within 3 units at speed > 20
      if (dist < 3 && Math.abs(this._state.speed) > 20 && (now - this._lastClosePassTime) > 1.5) {
        closePass = true;
        this._lastClosePassTime = now;
        break;
      }
    }

    if (closePass) {
      this._closePassCombo++;
      this._closePassTimer = 3;
      if (this._closePassCombo === 1) {
        this._showRaceEventToast('CLOSE PASS!', 'overtake', 1200);
      } else if (this._closePassCombo === 3) {
        this._showRaceEventToast('TRIPLE CLOSE PASS!', 'milestone', 2000);
        // Bonus nitro for skillful driving
        this._nitroFuel = Math.min(this._nitroMax, this._nitroFuel + 10);
      } else if (this._closePassCombo === 5) {
        this._showRaceEventToast('UNSTOPPABLE!', 'milestone', 2500);
        this._nitroFuel = Math.min(this._nitroMax, this._nitroFuel + 20);
      } else if (this._closePassCombo > 1 && this._closePassCombo % 3 === 0) {
        this._showRaceEventToast('CLOSE PASS x' + this._closePassCombo + '!', 'overtake', 1500);
      }
    }

    if (this._closePassTimer > 0) {
      this._closePassTimer -= dt;
      if (this._closePassTimer <= 0) this._closePassCombo = 0;
    }
  }

  // === CYCLE 33: RACE MILESTONE EVENTS ===
  _checkRaceMilestones() {
    if (!this._state.raceStarted) return;
    var speedKmh = Math.abs(this._state.speed) * 3.6;
    var elapsed = this._clock.getElapsedTime();

    // Top speed milestone
    if (speedKmh > 200 && !this._raceEventsShown.topSpeed200) {
      this._raceEventsShown.topSpeed200 = true;
      this._showRaceEventToast('200+ KM/H!', 'danger', 2000);
    }
    if (speedKmh > 220 && !this._raceEventsShown.topSpeed220) {
      this._raceEventsShown.topSpeed220 = true;
      this._showRaceEventToast('INSANE SPEED!', 'danger', 2000);
    }

    // Drift score milestones
    if (this._totalDriftScore > 5000 && !this._raceEventsShown.drift5k) {
      this._raceEventsShown.drift5k = true;
      this._showRaceEventToast('DRIFT MASTER: 5000 PTS', 'milestone', 2500);
    }
    if (this._totalDriftScore > 15000 && !this._raceEventsShown.drift15k) {
      this._raceEventsShown.drift15k = true;
      this._showRaceEventToast('DRIFT LEGEND: 15K PTS', 'milestone', 2500);
    }

    // Half-race milestone
    var totalProgress = ((this._state.lap - 1) + this._trackProgress) / this._state.totalLaps;
    if (totalProgress > 0.5 && !this._raceEventsShown.halfRace) {
      this._raceEventsShown.halfRace = true;
      this._showRaceEventToast('HALFWAY THERE!', 'info', 2000);
    }
  }

  // === CYCLE 33: ENHANCED POSITION TRACKING WITH ARROWS ===
  _updatePositionTrackingEnhanced() {
    if (!this._aiSystem || !this._vehicle || !this._trackCurve) return;
    var playerT = this._trackProgress;
    if (!playerT) return;
    var position = 1;
    var opponents = this._aiSystem.getOpponentData ? this._aiSystem.getOpponentData() : [];
    for (var oi = 0; oi < opponents.length; oi++) {
      var opp = opponents[oi];
      if (!opp || !opp.progress) continue;
      if (opp.progress > playerT) position++;
    }
    if (position !== this._lastRacePosition && this._state.raceStarted) {
      var gained = position < this._lastRacePosition;
      this._showPositionChangeArrow(gained);
      this._lastRacePosition = position;
    }
    this._currentRacePosition = position;
  }

  // === CYCLE 21: DRIFT SCORING ===
  // === CYCLE 27: MASTER VISUAL EFFECTS UPDATE ===
  _updateVisualEffects(dt) {
    // Speed critical class
    var sv = this._hudRefs ? this._hudRefs.speedValue : null;
    if (sv) {
      if (this._state.speed > 55) sv.classList.add('critical');
      else sv.classList.remove('critical');
    }
    // Nitro visual effects
    if (this._nitroFlashEl) {
      if (this._keys.nitro && this._state.speed > 5 && this._nitroFuel > 0) this._nitroFlashEl.classList.add('active');
      else this._nitroFlashEl.classList.remove('active');
    }
    if (this._nitroBorderEl) {
      if (this._keys.nitro && this._state.speed > 5 && this._nitroFuel > 0) this._nitroBorderEl.classList.add('active');
      else this._nitroBorderEl.classList.remove('active');
    }
    // Shield overlay management
    if (this._shieldOverlayEl) {
      if (this._shieldActive) this._shieldOverlayEl.classList.add('active');
      else this._shieldOverlayEl.classList.remove('active');
    }
    // Shield timer countdown
    if (this._shieldActive && this._shieldTimer > 0) {
      this._shieldTimer -= dt;
      if (this._shieldTimer <= 0) {
        this._shieldActive = false;
        this._shieldTimer = 0;
        this._showNotification('SHIELD EXPIRED', 'warning');
        // Update shield bar
        if (this._hudRefs && this._hudRefs.shieldBar) this._hudRefs.shieldBar.style.width = '0%';
        if (this._hudRefs && this._hudRefs.shieldValue) this._hudRefs.shieldValue.textContent = '0';
      } else {
        // Update shield bar during active shield
        var shieldPct = Math.round((this._shieldTimer / 5) * 100);
        if (this._hudRefs && this._hudRefs.shieldBar) this._hudRefs.shieldBar.style.width = shieldPct + '%';
        if (this._hudRefs && this._hudRefs.shieldValue) this._hudRefs.shieldValue.textContent = String(shieldPct);
      }
    }
    // Drift indicator
    if (this._driftIndicatorEl) {
      if (this._isDrifting) this._driftIndicatorEl.classList.add('active');
      else this._driftIndicatorEl.classList.remove('active');
    }
    // Drift trail
    this._updateDriftTrail(dt);
    // FPS counter color
    var fv = this._hudRefs ? this._hudRefs.fpsCounter : null;
    if (fv) {
      fv.classList.remove('warning', 'critical');
      if (this._fpsDisplay < 25) fv.classList.add('critical');
      else if (this._fpsDisplay < 40) fv.classList.add('warning');
    }
    // Final lap check
    if (this._state.raceStarted && this._state.lap === this._state.totalLaps && !this._finalLapShown) {
      this._showFinalLapIndicator();
    }
    // === CYCLE 28: TACHOMETER UPDATE ===
    if (this._tachBarEl) {
      var speedKmh = Math.abs(this._state.speed) * 3.6;
      var gear = speedKmh < 1 ? 0 : Math.min(6, Math.max(1, Math.floor(speedKmh / 20) + 1));
      var gearMin = (gear - 1) * 20;
      var gearMax = gear * 20;
      var rpmPct = gear > 0 ? ((speedKmh - gearMin) / (gearMax - gearMin)) * 100 : 0;
      rpmPct = Math.max(0, Math.min(100, rpmPct));
      // Add variation when accelerating
      if (this._keys.throttle) rpmPct = Math.min(100, rpmPct + 5 + Math.random() * 8);
      this._tachBarEl.style.width = rpmPct + '%';
      if (rpmPct > 85) this._tachBarEl.classList.add('redline');
      else this._tachBarEl.classList.remove('redline');
      if (this._rpmValueEl) {
        var rpm = Math.round(rpmPct * 80 + 800 + Math.random() * 200);
        this._rpmValueEl.textContent = rpm + ' RPM';
      }
    }
    // === CYCLE 28: SPEED LINES OVERLAY ===
    if (this._speedLinesOverlayEl) {
      var speedRatio = Math.abs(this._state.speed) / 65;
      if (speedRatio > 0.6) this._speedLinesOverlayEl.classList.add('active');
      else this._speedLinesOverlayEl.classList.remove('active');
    }
    // === CYCLE 28: DRIFT CHAIN BADGE ===
    if (this._driftChainBadgeEl) {
      if (this._driftChain > 0 && this._isDrifting) {
        this._driftChainBadgeEl.textContent = 'CHAIN x' + (this._driftChain + 1);
        this._driftChainBadgeEl.classList.add('visible');
        this._driftChainBadgeEl.classList.add('pulse');
        setTimeout(function() { if (this && this._driftChainBadgeEl) this._driftChainBadgeEl.classList.remove('pulse'); }.bind(this), 300);
      } else if (this._driftChain > 0 && this._driftFadeTimer > 0) {
        this._driftChainBadgeEl.textContent = 'CHAIN x' + (this._driftChain + 1);
        this._driftChainBadgeEl.classList.add('visible');
      } else {
        this._driftChainBadgeEl.classList.remove('visible');
      }
    }
    // === CYCLE 28: POSITION MEDAL COLOR ===
    if (this._hudRefs && this._hudRefs.positionNumber) {
      var posNum = this._hudRefs.positionNumber;
      posNum.classList.remove('pos-1', 'pos-2', 'pos-3');
      if (this._currentRacePosition <= 3) posNum.classList.add('pos-' + this._currentRacePosition);
    }
    // === CYCLE 29: OFF-TRACK WARNING FADE ===
    if (this._offTrackWarningEl && this._offTrackWarningTimer > 0) {
      this._offTrackWarningTimer -= dt;
      if (this._offTrackWarningTimer <= 0) {
        this._offTrackWarningEl.classList.remove('active');
      }
    }
    // === CYCLE 29: WEATHER INDICATOR ===
    if (this._weatherIndicatorEl) {
      if (this._weather === 'rain') this._weatherIndicatorEl.classList.add('active');
      else this._weatherIndicatorEl.classList.remove('active');
    }
  }

  _updateDriftScoring(dt) {
    var steerAngle = Math.abs(this._steerInput || 0);
    var isDriftKey = this._keys.drift;
    var speed = Math.abs(this._state.speed);
    
    // Check if drifting: need speed > 8, steering > threshold, and either drift key or high speed turn
    var isActivelyDrifting = speed > 8 && steerAngle > this._driftThreshold && (isDriftKey || speed > 25);
    
    if (isActivelyDrifting) {
      if (!this._isDrifting) {
        // Start new drift
        this._isDrifting = true;
        this._currentDriftScore = 0;
        this._driftTimer = 0;
        // Play drift start sound
        if (window.__engine?.audio) {
          try { window.__engine.audio.play('game.drift'); } catch(e) {}
        }
      }
      
      // Accumulate drift score based on speed, angle, and time
      this._driftTimer += dt;
      var angleBonus = steerAngle * 8;
      var speedBonus = speed * 0.3;
      var timeBonus = Math.min(3, this._driftTimer * 0.5);
      this._currentDriftScore += (angleBonus + speedBonus + timeBonus) * dt * 60;
      
      // Update HUD drift display
      this._showDriftScore(this._currentDriftScore, this._driftTimer);
    } else if (this._isDrifting) {
      // End drift - bank the score
      this._isDrifting = false;
      this._driftFadeTimer = 2.0; // Show popup for 2 seconds
      
      if (this._currentDriftScore > 50) {
        // Chain bonus
        this._driftChain++;
        var chainMultiplier = Math.min(5, 1 + (this._driftChain - 1) * 0.5);
        var finalScore = Math.round(this._currentDriftScore * chainMultiplier);
        
        this._totalDriftScore += finalScore;
        if (finalScore > this._bestDriftScore) this._bestDriftScore = finalScore;
        
        this._showDriftPopup(finalScore, chainMultiplier);
      } else {
        // Too short, no score
        this._driftChain = 0;
      }
      
      this._currentDriftScore = 0;
      this._hideDriftScore();
    }
    
    // Fade out drift popup
    if (this._driftFadeTimer > 0) {
      this._driftFadeTimer -= dt;
    }
  }

  _showDriftScore(score, time) {
    if (!this._driftHUDElement) {
      var el = document.createElement('div');
      el.className = 'hud-drift-score';
      el.id = 'hud-drift-score';
      el.innerHTML = '<div class="drift-score-label">DRIFT SCORE</div>' +
        '<div class="drift-score-value" id="drift-score-value">0</div>' +
        '<div class="drift-score-chain" id="drift-score-chain"></div>';
      document.body.appendChild(el);
      this._driftHUDElement = el;
    }
    this._driftHUDElement.style.opacity = '1';
    var valEl = document.getElementById('drift-score-value');
    if (valEl) valEl.textContent = String(Math.round(score));
    var chainEl = document.getElementById('drift-score-chain');
    if (chainEl && this._driftChain > 0) {
      chainEl.textContent = 'CHAIN x' + (this._driftChain + 1);
    }
  }

  _hideDriftScore() {
    if (this._driftHUDElement) {
      this._driftHUDElement.style.opacity = '0';
    }
  }

  _showDriftPopup(score, multiplier) {
    var popup = document.createElement('div');
    popup.className = 'fx-drift-score-popup';
    popup.textContent = '+' + score + (multiplier > 1 ? ' (x' + multiplier + ')' : '');
    document.body.appendChild(popup);
    setTimeout(function() { if (popup.parentNode) popup.parentNode.removeChild(popup); }, 2000);
  }

  // === CYCLE 21: BOOST PAD COLLISION ===
  _checkBoostPads(dt) {
    if (!this._vehicle || !this._boostPads.length) return;
    
    var vx = this._vehicle.position.x;
    var vz = this._vehicle.position.z;
    
    for (var pi = 0; pi < this._boostPads.length; pi++) {
      var pad = this._boostPads[pi];
      
      // Update cooldown
      if (pad.cooldown > 0) {
        pad.cooldown -= dt;
        // Dim the pad while on cooldown
        pad.mesh.material.opacity = 0.1;
        pad.glow.material.opacity = 0.05;
        pad.light.intensity = 0.3;
        continue;
      }
      
      // Check collision with pad
      var dx = vx - pad.x;
      var dz = vz - pad.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      
      if (dist < pad.radius && this._state.speed > 3) {
        // BOOST HIT!
        this._state.speed = Math.min(this._state.speed + 25, 80);
        pad.cooldown = 5; // 5 second cooldown
        
        // Visual flash
        pad.mesh.material.opacity = 0.8;
        pad.light.intensity = 8;
        
        // Show boost effect
        var fx = document.createElement('div');
        fx.className = 'fx-boost-pad-hit';
        document.body.appendChild(fx);
        setTimeout(function() { if (fx.parentNode) fx.parentNode.removeChild(fx); }, 500);
        
        if (window.__engine && window.__engine.bus) {
          window.__engine.bus.emit('player:boostPadHit');
        }
        
        this._showNotification('SPEED BOOST!', 'success');
      } else {
        // Animate pad glow pulsing
        var pulse = 0.25 + Math.sin(Date.now() * 0.003 + pi * 1.5) * 0.1;
        pad.mesh.material.opacity = pulse;
        pad.glow.material.opacity = pulse * 0.4;
        pad.light.intensity = 1.5 + Math.sin(Date.now() * 0.004 + pi) * 0.5;
      }
    }
  }

  // === CYCLE 21: POSITION TRACKING ===
  _updatePositionTracking() {
    if (!this._aiSystem || !this._vehicle) return;
    
    // Count how many opponents are ahead of player
    var playerProgress = this._getApproxTrackProgress();
    var aheadCount = 0;
    
    try {
      var oppData = this._aiSystem.getOpponentData();
      if (oppData && oppData.length) {
        for (var oi = 0; oi < oppData.length; oi++) {
          var opp = oppData[oi];
          if (opp.mesh && opp.progress > playerProgress) {
            aheadCount++;
          }
        }
      }
    } catch(e) {}
    
    this._currentRacePosition = aheadCount + 1;
    var totalRacers = 6; // 5 AI + 1 player
    
    // Update HUD position
    if (this._hudRefs) {
      if (this._hudRefs.positionNumber) this._hudRefs.positionNumber.textContent = String(this._currentRacePosition);
      if (this._hudRefs.racersCount) this._hudRefs.racersCount.textContent = '/ ' + totalRacers;
      
      // Update position suffix
      if (this._hudRefs.positionSuffix) {
        var suffixes = ['st', 'nd', 'rd', 'th', 'th', 'th'];
        this._hudRefs.positionSuffix.textContent = suffixes[this._currentRacePosition - 1] || 'th';
      }
      
      // Position display class
      var posDisplay = this._hudRefs.positionNumber ? this._hudRefs.positionNumber.parentElement : null;
      if (posDisplay) {
        posDisplay.className = 'position-display';
        if (this._currentRacePosition === 1) posDisplay.classList.add('first');
        else if (this._currentRacePosition <= 3) posDisplay.classList.add('top3');
      }
    }
    
    // Detect position changes and announce
    if (this._currentRacePosition !== this._lastRacePosition && this._lastRacePosition > 0) {
      var gained = this._lastRacePosition - this._currentRacePosition;
      
      if (this._hudRefs && this._hudRefs.positionChange) {
        this._hudRefs.positionChange.className = 'position-change';
        if (gained > 0) {
          this._hudRefs.positionChange.textContent = '+' + gained;
          this._hudRefs.positionChange.classList.add('up');
          
          // Overtake notification
          var fxEl = document.createElement('div');
          fxEl.className = 'fx-position-gain';
          fxEl.textContent = 'P' + this._currentRacePosition;
          document.body.appendChild(fxEl);
          setTimeout(function() { if (fxEl.parentNode) fxEl.parentNode.removeChild(fxEl); }, 1500);
          
          if (this._currentRacePosition === 1) {
            this._showNotification('P1 — YOU TOOK THE LEAD!', 'success');
          } else {
            this._showNotification('P' + this._currentRacePosition + ' — OVERTAKE!', 'success');
          }
          
          if (window.__engine && window.__engine.bus) {
            window.__engine.bus.emit('player:overtake');
          }
        } else if (gained < 0) {
          this._hudRefs.positionChange.textContent = String(gained);
          this._hudRefs.positionChange.classList.add('down');
          
          var fxEl2 = document.createElement('div');
          fxEl2.className = 'fx-position-loss';
          fxEl2.textContent = 'P' + this._currentRacePosition;
          document.body.appendChild(fxEl2);
          setTimeout(function() { if (fxEl2.parentNode) fxEl2.parentNode.removeChild(fxEl2); }, 1500);
        }
      }
      
      // CYCLE 27: Announce position gains
    if (this._currentRacePosition < this._lastRacePosition && this._state.raceStarted) {
      this._announcePositionChange(this._lastRacePosition, this._currentRacePosition);
    }
    this._lastRacePosition = this._currentRacePosition;
    }
  }

  _getApproxTrackProgress() {
    if (!this._vehicle || !this._trackCurve) return 0;
    
    // Estimate progress by finding closest point on track
    var vx = this._vehicle.position.x;
    var vz = this._vehicle.position.z;
    var minDist = Infinity;
    var closestT = 0;
    
    for (var ti = 0; ti <= 40; ti++) {
      var t = ti / 40;
      var pt = this._trackCurve.getPoint(t);
      var dx = vx - pt.x;
      var dz = vz - pt.z;
      var d = dx * dx + dz * dz;
      if (d < minDist) { minDist = d; closestT = t; }
    }
    
    return closestT;
  }

  _createScenery() {
    var scenery = new THREE.Group();
    scenery.name = 'scenery';
    
    var bldgCount = 40;
    var bldgGeo = new THREE.BoxGeometry(1, 1, 1);
    var bldgMat = new THREE.MeshStandardMaterial({ color: '#151525', roughness: 0.9 });
    var buildings = new THREE.InstancedMesh(bldgGeo, bldgMat, bldgCount);
    var matrix = new THREE.Matrix4();
    var color = new THREE.Color();
    
    for (var bi = 0; bi < bldgCount; bi++) {
      var side = bi % 2 === 0 ? -1 : 1;
      var bw = 10 + Math.random() * 20;
      var bh = 20 + Math.random() * 60;
      var bd = 10 + Math.random() * 15;
      matrix.makeScale(bw, bh, bd);
      matrix.setPosition(side * (this._trackWidth / 2 + 20 + Math.random() * 30), bh / 2 - 2, (bi / bldgCount) * this._trackLength - this._trackLength / 2);
      buildings.setMatrixAt(bi, matrix);
      color.setHSL(0.7, 0.3, 0.05 + Math.random() * 0.1);
      buildings.setColorAt(bi, color);
    }
    scenery.add(buildings);
    
    var winAtlasCanvas = document.createElement('canvas');
    winAtlasCanvas.width = 64;
    winAtlasCanvas.height = 64;
    var wCtx = winAtlasCanvas.getContext('2d');
    wCtx.fillStyle = 'rgba(20, 20, 35, 0.9)';
    wCtx.fillRect(0, 0, 64, 64);
    for (var wx = 0; wx < 4; wx++) {
      for (var wy = 0; wy < 4; wy++) {
        if (Math.random() > 0.5) { wCtx.fillStyle = Math.random() > 0.5 ? '#ffaa00' : '#aaddff'; wCtx.globalAlpha = 0.7; wCtx.fillRect(wx * 14 + 4, wy * 14 + 4, 10, 14); }
      }
    }
    var winTexture = new THREE.CanvasTexture(winAtlasCanvas);
    var winPlaneGeo = new THREE.PlaneGeometry(8, 12);
    var winMat = new THREE.MeshBasicMaterial({ map: winTexture, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    var winPlanes = new THREE.InstancedMesh(winPlaneGeo, winMat, bldgCount);
    for (var wi = 0; wi < bldgCount; wi++) {
      var ws = wi % 2 === 0 ? -1 : 1;
      var wh = 30;
      var wz = (wi / bldgCount) * this._trackLength - this._trackLength / 2;
      matrix.identity();
      matrix.setPosition(ws * (this._trackWidth / 2 + 18), wh / 2, wz);
      if (ws > 0) matrix.multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2));
      else matrix.multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
      winPlanes.setMatrixAt(wi, matrix);
    }
    scenery.add(winPlanes);
    
    var neonSigns = [{ text: 'RACE', color: '#ff00ff', z: -200 }, { text: 'ZONE', color: '#00ffff', z: 0 }, { text: 'KART', color: '#ffff00', z: 200 }, { text: 'GO!', color: '#00ff00', z: 400 }];
    neonSigns.forEach(function(sign) {
      var signCanvas = document.createElement('canvas');
      signCanvas.width = 128;
      signCanvas.height = 64;
      var sCtx = signCanvas.getContext('2d');
      sCtx.fillStyle = sign.color;
      sCtx.font = 'bold 48px Arial, sans-serif';
      sCtx.textAlign = 'center';
      sCtx.fillText(sign.text, 64, 48);
      var signTexture = new THREE.CanvasTexture(signCanvas);
      var signGeo = new THREE.PlaneGeometry(8, 4);
      var signMat = new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, side: THREE.DoubleSide });
      var signMesh = new THREE.Mesh(signGeo, signMat);
      signMesh.position.set(-18, 15, sign.z);
      signMesh.rotation.y = Math.PI / 6;
      scenery.add(signMesh);
    });
    
    var poleCount = 60;
    var poleHt = 12;
    var poleGeo = new THREE.CylinderGeometry(0.15, 0.2, poleHt, 6);
    var poleMat = new THREE.MeshStandardMaterial({ color: '#333344' });
    var poles = new THREE.InstancedMesh(poleGeo, poleMat, poleCount);
    var lampGeo = new THREE.SphereGeometry(0.5, 6, 6);
    var lampMat = new THREE.MeshBasicMaterial({ color: '#ff00ff' });
    var lamps = new THREE.InstancedMesh(lampGeo, lampMat, poleCount);
    var pIdx = 0;
    for (var pi = 0; pi < 30; pi++) {
      var pz = (pi / 30) * this._trackLength - this._trackLength / 2;
      [-1, 1].forEach(function(side) {
        var px = side * (this._trackWidth / 2 + 3);
        matrix.setPosition(px, poleHt / 2, pz);
        poles.setMatrixAt(pIdx, matrix);
        matrix.setPosition(px, poleHt + 0.5, pz);
        lamps.setMatrixAt(pIdx, matrix);
        color.setHex(pi % 2 === 0 ? 0xff00ff : 0x00ffff);
        lamps.setColorAt(pIdx, color);
        pIdx++;
      }.bind(this));
    }
    scenery.add(poles);
    scenery.add(lamps);
    
    // === CYCLE 24: ENHANCED SCENERY ===
    
    // Neon barrier glow strips along track edges
    var stripGeo = new THREE.BoxGeometry(0.3, 0.3, this._trackLength);
    var stripMatLeft = new THREE.MeshBasicMaterial({ color: '#ff3366' });
    var stripMatRight = new THREE.MeshBasicMaterial({ color: '#00e5ff' });
    var leftStrip = new THREE.Mesh(stripGeo, stripMatLeft);
    leftStrip.position.set(-this._trackWidth / 2 - 0.5, 0.15, 0);
    var rightStrip = new THREE.Mesh(stripGeo, stripMatRight);
    rightStrip.position.set(this._trackWidth / 2 + 0.5, 0.15, 0);
    scenery.add(leftStrip);
    scenery.add(rightStrip);
    // Store references for animation
    this._neonStrips = { left: leftStrip, right: rightStrip };
    
    // Additional neon signs on the RIGHT side too
    var neonSignsRight = [
      { text: 'NEON', color: '#ff3366', z: -300 },
      { text: 'UNDER', color: '#ff8c00', z: -100 },
      { text: 'GROUND', color: '#00ff88', z: 100 },
      { text: 'TURBO', color: '#ff00ff', z: 300 }
    ];
    neonSignsRight.forEach(function(sign) {
      var signCanvas = document.createElement('canvas');
      signCanvas.width = 128;
      signCanvas.height = 64;
      var sCtx = signCanvas.getContext('2d');
      sCtx.fillStyle = sign.color;
      sCtx.font = 'bold 48px Arial, sans-serif';
      sCtx.textAlign = 'center';
      sCtx.fillText(sign.text, 64, 48);
      var signTexture = new THREE.CanvasTexture(signCanvas);
      var signGeo = new THREE.PlaneGeometry(8, 4);
      var signMat = new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, side: THREE.DoubleSide });
      var signMesh = new THREE.Mesh(signGeo, signMat);
      signMesh.position.set(18, 15, sign.z);
      signMesh.rotation.y = -Math.PI / 6;
      scenery.add(signMesh);
    });
    
    // Overhead archway gates at start/finish and mid-track
    var archPositions = [0, -this._trackLength / 4, this._trackLength / 4, -this._trackLength / 2];
    var archColors = [0xff3366, 0x00e5ff, 0xffaa00, 0x00ff88];
    archPositions.forEach(function(z, idx) {
      var archGroup = new THREE.Group();
      var pillarGeo = new THREE.BoxGeometry(1, 14, 1);
      var archMat = new THREE.MeshStandardMaterial({ color: '#1a1a2e' });
      var leftPillar = new THREE.Mesh(pillarGeo, archMat);
      leftPillar.position.set(-this._trackWidth / 2 - 2, 7, z);
      var rightPillar = new THREE.Mesh(pillarGeo, archMat);
      rightPillar.position.set(this._trackWidth / 2 + 2, 7, z);
      var beamGeo = new THREE.BoxGeometry(this._trackWidth + 6, 1.5, 1);
      var beamMat = new THREE.MeshBasicMaterial({ color: archColors[idx] });
      var beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(0, 14, z);
      archGroup.add(leftPillar, rightPillar, beam);
      scenery.add(archGroup);
    }.bind(this));
    
    // Floating holographic rings (decorative, near track)
    for (var ri = 0; ri < 6; ri++) {
      var ringGeo = new THREE.TorusGeometry(3 + Math.random() * 2, 0.15, 8, 32);
      var ringColor = [0xff3366, 0x00e5ff, 0xffaa00, 0x00ff88, 0xff00ff, 0xffff00][ri];
      var ringMat = new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.6 });
      var ring = new THREE.Mesh(ringGeo, ringMat);
      var rSide = ri % 2 === 0 ? -1 : 1;
      ring.position.set(rSide * (this._trackWidth / 2 + 12), 8 + Math.random() * 10, (ri / 6) * this._trackLength - this._trackLength / 2);
      ring.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.5;
      ring.rotation.z = Math.random() * Math.PI;
      ring.userData.floatSpeed = 0.3 + Math.random() * 0.5;
      ring.userData.floatOffset = Math.random() * Math.PI * 2;
      ring.userData.baseY = ring.position.y;
      scenery.add(ring);
    }
    this._floatingRings = scenery.children.filter(function(c) { return c.geometry && c.geometry.type === 'TorusGeometry'; });
    
    // === CYCLE 26: HOLOGRAPHIC BILLBOARDS ===
    var billboardData = [
      { text: 'WARZONE', sub: 'KART SERIES', color: '#ff3366', z: -400 },
      { text: 'NEON', sub: 'CITY GP', color: '#00e5ff', z: -100 },
      { text: 'TURBO', sub: 'CHAMPIONSHIP', color: '#ffaa00', z: 200 },
      { text: 'FINAL', sub: 'LAP', color: '#00ff88', z: 500 }
    ];
    billboardData.forEach(function(bb) {
      var bbGroup = new THREE.Group();
      
      // Billboard frame
      var frameGeo = new THREE.BoxGeometry(14, 8, 0.3);
      var frameMat = new THREE.MeshStandardMaterial({ color: '#0a0a15', metalness: 0.9, roughness: 0.1 });
      var frame = new THREE.Mesh(frameGeo, frameMat);
      bbGroup.add(frame);
      
      // Glowing border
      var borderGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(14.2, 8.2, 0.1));
      var borderMat = new THREE.LineBasicMaterial({ color: bb.color, transparent: true, opacity: 0.6 });
      var border = new THREE.LineSegments(borderGeo, borderMat);
      bbGroup.add(border);
      
      // Main text canvas
      var bbCanvas = document.createElement('canvas');
      bbCanvas.width = 512; bbCanvas.height = 256;
      var bbCtx = bbCanvas.getContext('2d');
      // Background gradient
      var grad = bbCtx.createLinearGradient(0, 0, 512, 256);
      grad.addColorStop(0, 'rgba(10, 10, 20, 0.9)');
      grad.addColorStop(1, 'rgba(20, 10, 30, 0.9)');
      bbCtx.fillStyle = grad;
      bbCtx.fillRect(0, 0, 512, 256);
      // Main text
      bbCtx.fillStyle = bb.color;
      bbCtx.font = 'bold 80px Arial, sans-serif';
      bbCtx.textAlign = 'center';
      bbCtx.fillText(bb.text, 256, 130);
      // Sub text
      bbCtx.fillStyle = 'rgba(255,255,255,0.5)';
      bbCtx.font = '28px Arial, sans-serif';
      bbCtx.fillText(bb.sub, 256, 180);
      // Decorative lines
      bbCtx.strokeStyle = bb.color;
      bbCtx.lineWidth = 2;
      bbCtx.globalAlpha = 0.4;
      bbCtx.strokeRect(20, 20, 472, 216);
      bbCtx.globalAlpha = 1;
      
      var bbTexture = new THREE.CanvasTexture(bbCanvas);
      var bbPlaneGeo = new THREE.PlaneGeometry(13.5, 7.5);
      var bbPlaneMat = new THREE.MeshBasicMaterial({ map: bbTexture, transparent: true, side: THREE.DoubleSide });
      var bbPlane = new THREE.Mesh(bbPlaneGeo, bbPlaneMat);
      bbPlane.position.z = 0.2;
      bbGroup.add(bbPlane);
      
      // Point light for billboard glow
      var bbLight = new THREE.PointLight(bb.color, 2, 25);
      bbLight.position.set(0, 0, 3);
      bbGroup.add(bbLight);
      
      var side = (billboardData.indexOf(bb) % 2 === 0) ? -1 : 1;
      bbGroup.position.set(side * (this._trackWidth / 2 + 25), 18, bb.z);
      bbGroup.rotation.y = side > 0 ? -Math.PI / 8 : Math.PI / 8;
      
      scenery.add(bbGroup);
    }.bind(this));
    
    // === CYCLE 26: GROUND NEON GRID ACCENT LINES ===
    var gridAccentCount = 20;
    for (var gi = 0; gi < gridAccentCount; gi++) {
      var gz = (gi / gridAccentCount) * this._trackLength - this._trackLength / 2;
      var gSide = gi % 2 === 0 ? -1 : 1;
      var lineGeo = new THREE.PlaneGeometry(0.15, 30);
      var lineColor = gi % 3 === 0 ? '#ff3366' : gi % 3 === 1 ? '#00e5ff' : '#ffaa00';
      var lineMat = new THREE.MeshBasicMaterial({ color: lineColor, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
      var line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(gSide * (this._trackWidth / 2 + 8), 0.02, gz);
      line.rotation.z = gSide * 0.3;
      scenery.add(line);
    }
    
    this._scene.add(scenery);
  }

  // HUD SYSTEM
  _createHUDElements() {
    if (this._hudElement && this._hudElement.parentNode) this._hudElement.parentNode.removeChild(this._hudElement);
    if (this._driftHUDElement && this._driftHUDElement.parentNode) this._driftHUDElement.parentNode.removeChild(this._driftHUDElement);
    var rvEl = document.getElementById('hud-rearview-container');
    if (rvEl && rvEl.parentNode) rvEl.parentNode.removeChild(rvEl);
    var vigEl = document.getElementById('speed-vignette');
    if (vigEl && vigEl.parentNode) vigEl.parentNode.removeChild(vigEl);
    
    // Speed vignette overlay (CSS-based screen edge effect)
    var vignette = document.createElement('div');
    vignette.id = 'speed-vignette';
    vignette.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:45;opacity:0;transition:opacity 0.3s ease;background:radial-gradient(ellipse at center,transparent 60%,rgba(0,0,0,0.3) 100%);';
    document.body.appendChild(vignette);
    this._vignetteOverlay = vignette;
    
    var hud = document.createElement('div');
    hud.className = 'game-hud';
    hud.id = 'game-hud-root';
    hud.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:50;opacity:0;transition:opacity 0.5s ease;';
    
    // Speed panel
    var sp = document.createElement('div');
    sp.className = 'hud-panel hud-speed-panel';
    var sc = document.createElement('div');
    sc.className = 'speed-container';
    var sv = document.createElement('span');
    sv.className = 'speed-value low';
    sv.id = 'hud-speed-value';
    sv.textContent = '0';
    var su = document.createElement('span');
    su.className = 'speed-unit';
    su.textContent = 'KM/H';
    sc.appendChild(sv); sc.appendChild(su); sp.appendChild(sc);
    var sbc = document.createElement('div');
    sbc.className = 'speed-bar-container';
    var sb = document.createElement('div');
    sb.className = 'speed-bar'; sb.id = 'hud-speed-bar'; sb.style.width = '0%';
    sbc.appendChild(sb); sp.appendChild(sbc);
    var gi = document.createElement('div');
    gi.className = 'gear-indicator';
    var gl = document.createElement('span'); gl.className = 'gear-label'; gl.textContent = 'GEAR';
    var gv = document.createElement('span'); gv.className = 'gear-value'; gv.id = 'hud-gear-value'; gv.textContent = 'N';
    gi.appendChild(gl); gi.appendChild(gv); sp.appendChild(gi);
    hud.appendChild(sp);
    
    // Position panel
    var pp = document.createElement('div');
    pp.className = 'hud-panel hud-position-panel';
    var pd = document.createElement('div'); pd.className = 'position-display first';
    var pn = document.createElement('span'); pn.className = 'position-number'; pn.id = 'hud-position-number'; pn.textContent = '1';
    var ps = document.createElement('span'); ps.className = 'position-suffix'; ps.id = 'hud-position-suffix'; ps.textContent = 'st';
    pd.appendChild(pn); pd.appendChild(ps); pp.appendChild(pd);
    var pc = document.createElement('div'); pc.className = 'position-change'; pc.id = 'hud-position-change';
    pp.appendChild(pc);
    var totalRacers = ((this._config && this._config.opponents) ? Number(this._config.opponents) : 5) + 1;
    var rc = document.createElement('div'); rc.className = 'racers-count'; rc.id = 'hud-racers-count'; rc.textContent = '/ '+ totalRacers;
    pp.appendChild(rc);
    var lc = document.createElement('div'); lc.className = 'lap-container';
    var lcp = document.createElement('div'); lcp.className = 'lap-counter';
    var lcur = document.createElement('span'); lcur.className = 'lap-current'; lcur.id = 'hud-lap-current'; lcur.textContent = '1';
    var lsp = document.createElement('span'); lsp.className = 'lap-separator'; lsp.textContent = '/';
    var ltot = document.createElement('span'); ltot.className = 'lap-total'; ltot.id = 'hud-lap-total'; ltot.textContent = '3';
    lcp.appendChild(lcur); lcp.appendChild(lsp); lcp.appendChild(ltot); lc.appendChild(lcp);
    var ll = document.createElement('div'); ll.className = 'lap-label'; ll.textContent = 'LAP'; lc.appendChild(ll);
    var lpc = document.createElement('div'); lpc.className = 'lap-progress-container';
    var lpb = document.createElement('div'); lpb.className = 'lap-progress-bar'; lpb.id = 'hud-lap-progress'; lpb.style.width = '0%';
    lpc.appendChild(lpb); lc.appendChild(lpc); pp.appendChild(lc); hud.appendChild(pp);
    
    // Timer
    var tp = document.createElement('div'); tp.className = 'hud-panel hud-timer-panel';
    var td = document.createElement('div'); td.className = 'timer-display'; td.id = 'hud-timer-display'; td.textContent = '00:00.00';
    var tl = document.createElement('div'); tl.className = 'timer-label'; tl.textContent = 'RACE TIME';
    tp.appendChild(td); tp.appendChild(tl); hud.appendChild(tp);
    
    // Nitro indicator (styled properly)
    var np = document.createElement('div'); np.className = 'hud-panel hud-nitro-panel';
    var nl = document.createElement('div'); nl.className = 'nitro-label'; nl.textContent = 'NITRO [SHIFT]';
    var nbc = document.createElement('div'); nbc.className = 'nitro-bar-track';
    var nb = document.createElement('div'); nb.className = 'nitro-bar-fill'; nb.id = 'hud-nitro-bar'; nb.style.width = '100%';
    var nvl = document.createElement('span'); nvl.className = 'nitro-value'; nvl.id = 'hud-nitro-value'; nvl.textContent = '100';
    nbc.appendChild(nb); np.appendChild(nl); np.appendChild(nbc); np.appendChild(nvl); hud.appendChild(np);
    
    // FPS counter
    var fp = document.createElement('div'); fp.className = 'hud-fps-counter';
    var fv = document.createElement('span'); fv.id = 'hud-fps-counter'; fv.textContent = '-- FPS'; fv.style.cssText = 'font-size:11px;font-family:var(--font-mono,monospace);color:#3ddc84;letter-spacing:1px;';
    fp.appendChild(fv); hud.appendChild(fp);
    
    // Item panel
    var ip = document.createElement('div'); ip.className = 'hud-panel hud-item-panel';
    var ib = document.createElement('div'); ib.className = 'item-box'; ib.id = 'hud-item-box';
    var ii = document.createElement('div'); ii.className = 'item-icon'; ii.id = 'hud-item-icon';
    ii.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
    var ipt = document.createElement('div'); ipt.className = 'item-prompt'; ipt.textContent = '[E]';
    var ist = document.createElement('div'); ist.className = 'item-status'; ist.id = 'hud-item-status'; ist.textContent = 'EMPTY';
    ib.appendChild(ii); ib.appendChild(ipt); ib.appendChild(ist); ip.appendChild(ib); hud.appendChild(ip);
    
    // Status panel
    var stp = document.createElement('div'); stp.className = 'hud-panel hud-status-panel'; stp.id = 'hud-status-panel';
    var sbs = document.createElement('div'); sbs.className = 'status-bars';
    var shc = document.createElement('div'); shc.className = 'shield-bar-container';
    var shl = document.createElement('span'); shl.className = 'status-label'; shl.innerHTML = '\uD83D\uDEE1 SHIELD';
    var sht = document.createElement('div'); sht.className = 'bar-track';
    var shf = document.createElement('div'); shf.className = 'bar-fill shield-fill'; shf.id = 'hud-shield-bar'; shf.style.width = '0%';
    var shv = document.createElement('span'); shv.className = 'bar-value'; shv.id = 'hud-shield-value'; shv.textContent = '0';
    sht.appendChild(shf); shc.appendChild(shl); shc.appendChild(sht); shc.appendChild(shv); sbs.appendChild(shc);
    var hec = document.createElement('div'); hec.className = 'health-bar-container';
    var hel = document.createElement('span'); hel.className = 'status-label'; hel.innerHTML = '\u2764 HEALTH';
    var het = document.createElement('div'); het.className = 'bar-track';
    var hef = document.createElement('div'); hef.className = 'bar-fill health-fill'; hef.id = 'hud-health-bar'; hef.style.width = '100%';
    var hev = document.createElement('span'); hev.className = 'bar-value'; hev.id = 'hud-health-value'; hev.textContent = '100';
    het.appendChild(hef); hec.appendChild(hel); hec.appendChild(het); hec.appendChild(hev); sbs.appendChild(hec);
    stp.appendChild(sbs); hud.appendChild(stp);
    
    // Countdown
    var cd = document.createElement('div'); cd.className = 'hud-countdown'; cd.id = 'hud-countdown';
    var cdn = document.createElement('div'); cdn.className = 'countdown-number'; cdn.id = 'hud-countdown-number'; cdn.textContent = '3';
    cd.appendChild(cdn); hud.appendChild(cd);
    
    // Notifications
    var nf = document.createElement('div'); nf.className = 'hud-notifications'; nf.id = 'hud-notifications';
    hud.appendChild(nf);
    
    // Lap times
    var ltm = document.createElement('div'); ltm.className = 'hud-lap-times'; ltm.id = 'hud-lap-times';
    var lth = document.createElement('div'); lth.className = 'lap-time-row'; lth.innerHTML = '<span class="lap-time-label">LAP TIMES</span><span class="lap-time-value"></span>';
    ltm.appendChild(lth);
    for (var li = 1; li <= 3; li++) {
      var lr = document.createElement('div'); lr.className = 'lap-time-row'; lr.id = 'hud-lap-time-' + li;
      lr.innerHTML = '<span class="lap-time-label">LAP ' + li + '</span><span class="lap-time-value">--:--.--</span>';
      ltm.appendChild(lr);
    }
    hud.appendChild(ltm);
    
    // Minimap - larger with border glow
    var mmc = document.createElement('div'); mmc.className = 'hud-minimap-container'; mmc.id = 'hud-minimap-container';
    var mmcv = document.createElement('canvas'); mmcv.id = 'minimap-canvas'; mmcv.width = 180; mmcv.height = 180;
    mmcv.style.cssText = 'width:180px;height:180px;border-radius:12px;border:2px solid rgba(0,229,255,0.25);box-shadow:0 0 15px rgba(0,229,255,0.15),inset 0 0 20px rgba(0,0,0,0.5);background:rgba(5,6,10,0.85);';
    mmc.appendChild(mmcv); hud.appendChild(mmc);
    
    // === CYCLE 33: RACE PROGRESS RING (SVG) ===
    var progressRing = document.createElement('div');
    progressRing.style.cssText = 'position:absolute;top:80px;left:24px;width:60px;height:60px;pointer-events:none;';
    var ringSize = 60;
    var ringRadius = 25;
    var ringCirc = 2 * Math.PI * ringRadius;
    progressRing.innerHTML = 
      '<svg width="' + ringSize + '" height="' + ringSize + '" viewBox="0 0 ' + ringSize + ' ' + ringSize + '">' +
      '<circle class="ring-bg" cx="' + (ringSize/2) + '" cy="' + (ringSize/2) + '" r="' + ringRadius + '"/>' +
      '<circle class="ring-fill" id="hud-progress-ring" cx="' + (ringSize/2) + '" cy="' + (ringSize/2) + '" r="' + ringRadius + '" ' +
      'stroke-dasharray="' + ringCirc + '" stroke-dashoffset="' + ringCirc + '"/>' +
      '</svg>' +
      '<div class="race-progress-label" id="hud-progress-label">0%</div>';
    hud.appendChild(progressRing);
    this._progressRingEl = document.getElementById('hud-progress-ring');
    this._progressRingCirc = ringCirc;

    // Controls hint (fades after first input)
    var ch = document.createElement('div'); ch.className = 'hud-controls-hint'; ch.id = 'hud-controls-hint';
    ch.innerHTML = '<div class="hint-group"><span class="hint-key">W</span> <span class="hint-text">GAS</span></div><div class="hint-separator"></div><div class="hint-group"><span class="hint-key">S</span> <span class="hint-text">BRAKE</span></div><div class="hint-separator"></div><div class="hint-group"><span class="hint-key">A</span> <span class="hint-key">D</span> <span class="hint-text">STEER</span></div><div class="hint-separator"></div><div class="hint-group"><span class="hint-key">SPACE</span> <span class="hint-text">DRIFT</span></div><div class="hint-separator"></div><div class="hint-group"><span class="hint-key">SHIFT</span> <span class="hint-text">NITRO</span></div><div class="hint-separator"></div><div class="hint-group"><span class="hint-key">E</span> <span class="hint-text">ITEM</span></div>';
    document.body.appendChild(ch);
    this._controlsHint = ch;
    this._controlsHintShown = true;
    
    // HIDE TOUCH CONTROLS ON NON-TOUCH DEVICES
    var touchControls = document.querySelector('.touch-controls-layer');
    if (touchControls && !('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
      touchControls.style.display = 'none';
    }
    
    // Sector progress dots
    var sp = document.createElement('div'); sp.className = 'hud-sector-progress'; sp.id = 'hud-sector-progress';
    for (var sdi = 0; sdi < 4; sdi++) {
      var dot = document.createElement('div'); dot.className = 'sector-dot'; dot.id = 'sector-dot-' + sdi;
      sp.appendChild(dot);
    }
    hud.appendChild(sp);
    this._sectorDots = sp;
    
    document.body.appendChild(hud);
    this._hudElement = hud;
    
    this._hudRefs = { speedValue: sv, speedBar: sb, gearValue: gv, positionNumber: pn, positionSuffix: ps, positionChange: pc, racersCount: rc, lapCurrent: lcur, lapTotal: ltot, lapProgress: lpb, timerDisplay: td, nitroBar: nb, nitroValue: nvl, fpsCounter: fv, itemBox: ib, itemIcon: ii, itemStatus: ist, statusPanel: stp, shieldBar: shf, shieldValue: shv, healthBar: hef, healthValue: hev, countdown: cd, countdownNumber: cdn, notifications: nf, lapTimes: ltm, minimapCanvas: mmcv };
    
    // === CYCLE 28: TACHOMETER / RPM GAUGE ===
    var tach = document.createElement('div'); tach.className = 'hud-tachometer';
    tach.innerHTML = '<div class="tach-bar-track"><div class="tach-bar-fill" id="hud-tach-bar" style="width:0%"></div></div>' +
      '<div class="tach-label"><span class="tach-min">0</span><span class="tach-rpm-unit">RPM</span><span class="tach-max">8</span></div>' +
      '<div class="tach-rpm-value" id="hud-rpm-value">0 RPM</div>';
    hud.appendChild(tach);
    this._tachBarEl = document.getElementById('hud-tach-bar');
    this._rpmValueEl = document.getElementById('hud-rpm-value');
    
    // === CYCLE 28: SPEED LINES OVERLAY ===
    var speedLines = document.createElement('div');
    speedLines.className = 'speed-lines-overlay';
    document.body.appendChild(speedLines);
    this._speedLinesOverlayEl = speedLines;
    
    // === CYCLE 28: MINIMAP LEGEND ===
    var legend = document.createElement('div'); legend.className = 'minimap-legend';
    legend.innerHTML = '<div class="minimap-legend-item"><div class="minimap-legend-dot" style="background:#ff3366;box-shadow:0 0 4px #ff3366"></div>YOU</div>' +
      '<div class="minimap-legend-item"><div class="minimap-legend-dot" style="background:#ffaa00"></div>AI</div>' +
      '<div class="minimap-legend-item"><div class="minimap-legend-dot" style="background:#00ffaa"></div>BOOST</div>' +
      '<div class="minimap-legend-item"><div class="minimap-legend-dot" style="background:#ffcc00"></div>ITEM</div>';
    hud.appendChild(legend);
    
    // === CYCLE 28: DRIFT CHAIN BADGE ===
    var chainBadge = document.createElement('div');
    chainBadge.className = 'drift-chain-badge';
    chainBadge.id = 'drift-chain-badge';
    chainBadge.textContent = 'CHAIN x1';
    document.body.appendChild(chainBadge);
    this._driftChainBadgeEl = chainBadge;

    // === CYCLE 29: OFF-TRACK WARNING ===
    var offTrack = document.createElement("div");
    offTrack.className = "off-track-warning";
    offTrack.style.opacity = '0';
    offTrack.innerHTML = '<span class="off-track-icon">⚠</span><span>OFF TRACK</span>';
    document.body.appendChild(offTrack);
    this._offTrackWarningEl = offTrack;
    this._offTrackWarningTimer = 0;

    // === CYCLE 29: WEATHER INDICATOR ===
    var weatherInd = document.createElement("div");
    weatherInd.className = "weather-indicator";
    weatherInd.innerHTML = '<span class="weather-icon" id="weather-icon-el">☀️</span><span class="weather-label" id="weather-label-el">CLEAR</span>';
    hud.appendChild(weatherInd);
    this._weatherIndicatorEl = weatherInd;

    // === CYCLE 27: DRIFT ACTIVE INDICATOR ===
    var driftInd = document.createElement('div');
    driftInd.className = 'drift-active-indicator';
    driftInd.style.opacity = '0';
    driftInd.textContent = 'DRIFT';
    document.body.appendChild(driftInd);
    this._driftIndicatorEl = driftInd;

    // === CYCLE 27: NITRO VISUAL EFFECTS ===
    var nitroFlash = document.createElement('div');
    nitroFlash.className = 'nitro-screen-flash';
    nitroFlash.style.opacity = '0';
    document.body.appendChild(nitroFlash);
    this._nitroFlashEl = nitroFlash;

    var nitroBorder = document.createElement('div');
    nitroBorder.className = 'nitro-border-glow';
    nitroBorder.style.opacity = '0';
    document.body.appendChild(nitroBorder);
    this._nitroBorderEl = nitroBorder;

    // === CYCLE 27: SHIELD ACTIVE OVERLAY ===
    var shieldOv = document.createElement('div');
    shieldOv.className = 'shield-active-overlay';
    shieldOv.style.opacity = '0';
    document.body.appendChild(shieldOv);
    this._shieldOverlayEl = shieldOv;

    // === CYCLE 27: CHECKPOINT FLASH ===
    var cpFlash = document.createElement('div');
    cpFlash.className = 'checkpoint-flash';
    cpFlash.style.opacity = '0';
    document.body.appendChild(cpFlash);
    this._checkpointFlashEl = cpFlash;

    // === CYCLE 27: LAP COMPLETE OVERLAY ===
    var lapComplete = document.createElement('div');
    lapComplete.className = 'lap-complete-overlay';
    lapComplete.style.opacity = '0';
    lapComplete.innerHTML = '<div class="lap-complete-text">LAP COMPLETE</div>';
    document.body.appendChild(lapComplete);
    this._lapCompleteEl = lapComplete;

    // === CYCLE 30: RACE PROGRESS BAR (right edge) ===
    var raceProg = document.createElement('div');
    raceProg.className = 'race-progress-bar-container';
    raceProg.id = 'race-progress-container';
    raceProg.innerHTML = '<div class="race-progress-label">RACE</div>' +
      '<div class="race-progress-bar-fill" id="race-progress-fill"></div>' +
      '<div class="race-progress-player" id="race-progress-player" style="bottom:0"></div>';
    for (var li = 1; li < this._state.totalLaps; li++) {
      var marker = document.createElement('div');
      marker.className = 'race-progress-marker';
      marker.id = 'race-progress-marker-' + li;
      marker.style.bottom = ((li / this._state.totalLaps) * 100) + '%';
      raceProg.appendChild(marker);
    }
    hud.appendChild(raceProg);
    this._raceProgressFillEl = document.getElementById('race-progress-fill');
    this._raceProgressPlayerEl = document.getElementById('race-progress-player');

    // === CYCLE 30: PROXIMITY WARNING ===
    var proxWarn = document.createElement('div');
    proxWarn.className = 'proximity-warning';
    proxWarn.style.opacity = '0';
    document.body.appendChild(proxWarn);
    this._proximityWarningEl = proxWarn;

    // === CYCLE 30: BOOST TRAIL OVERLAY ===
    var boostTrail = document.createElement('div');
    boostTrail.className = 'boost-trail-overlay';
    boostTrail.style.opacity = '0';
    document.body.appendChild(boostTrail);
    this._boostTrailEl = boostTrail;

    // === CYCLE 30: COMBO COUNTER ===
    var comboEl = document.createElement('div');
    comboEl.className = 'combo-counter';
    comboEl.id = 'combo-counter';
    comboEl.innerHTML = '<div class="combo-count" id="combo-count">0</div><div class="combo-label">COMBO</div>';
    document.body.appendChild(comboEl);
    this._comboCounterEl = comboEl;
    // === CYCLE 31: DRIFT SCORE HUD ===
    var driftScoreHUD = document.createElement('div');
    driftScoreHUD.className = 'drift-score-hud';
    driftScoreHUD.id = 'drift-score-hud';
    driftScoreHUD.innerHTML = '<div class="drift-score-value" id="drift-score-value">0</div><div class="drift-score-label">DRIFT SCORE</div><div class="drift-score-multiplier" id="drift-score-multiplier">x1.0</div>';
    document.body.appendChild(driftScoreHUD);
    this._driftScoreHUDEl = driftScoreHUD;
    this._driftScoreDisplay = 0;
    this._driftMultiplier = 1.0;

    // === CYCLE 31: RACE FINISH OVERLAY ===
    var finishOverlay = document.createElement('div');
    finishOverlay.className = 'race-finish-overlay';
    finishOverlay.id = 'race-finish-overlay';
    finishOverlay.style.opacity = '0';
    finishOverlay.innerHTML = '<div class="race-finish-position" id="race-finish-position">1st</div><div class="race-finish-time" id="race-finish-time">00:00.00</div><div class="race-finish-label">RACE COMPLETE</div>';
    document.body.appendChild(finishOverlay);
    this._raceFinishOverlayEl = finishOverlay;

    // === CYCLE 31: WEATHER TOGGLE BUTTON ===
    var weatherBtn = document.createElement('button');
    weatherBtn.className = 'weather-toggle-btn';
    weatherBtn.id = 'weather-toggle-btn';
    weatherBtn.textContent = '\u2600\uFE0F';
    weatherBtn.title = 'Toggle Weather (R)';
    var self = this;
    weatherBtn.addEventListener('click', function() { self._toggleWeather(); });
    document.body.appendChild(weatherBtn);
    this._weatherToggleBtn = weatherBtn;

    // === CYCLE 31: TRACK EDGE WARNING STRIPS ===
    var edgeLeft = document.createElement('div');
    edgeLeft.className = 'track-edge-warning left';
    document.body.appendChild(edgeLeft);
    this._edgeWarnLeft = edgeLeft;
    var edgeRight = document.createElement('div');
    edgeRight.className = 'track-edge-warning right';
    document.body.appendChild(edgeRight);
    this._edgeWarnRight = edgeRight;

    // === CYCLE 31: LAP TIME DELTA STORAGE ===
    this._lapTimeDeltas = [];
    this._bestLapTime = Infinity;

    window.__hud = { element: hud, refs: this._hudRefs, update: function(d) { this._updateHUDData(d); }.bind(this), showCountdown: function(v) { this._showCountdown(v); }.bind(this), hideCountdown: function() { this._hideCountdown(); }.bind(this), showNotification: function(m, t) { this._showNotification(m, t); }.bind(this), setItem: function(it) { this._setItem(it); }.bind(this) };
  }
  
  _updateHUDDirect() {
    if (!this._hudRefs) return;
    var speedKmh = Math.abs(this._state.speed) * 3.6;
    var maxSpeed = 60;

    // === CYCLE 31: TOP SPEED TRACKER ===
    if (speedKmh > this._topSpeedKmh) {
      this._topSpeedKmh = speedKmh;
      // Show new record badge (only once per speed milestone)
      if (speedKmh > 50 && speedKmh < 52) { this._showNotification('NEW TOP SPEED: ' + Math.round(speedKmh) + ' KM/H', 'warning'); }
      if (speedKmh > 180) { this._showNotification('INSANE SPEED: ' + Math.round(speedKmh) + ' KM/H!', 'danger'); }
    }
    // Show top speed in FPS area
    var topSpEl = document.getElementById('hud-top-speed');
    if (!topSpEl && this._topSpeedKmh > 10) {
      topSpEl = document.createElement('div');
      topSpEl.id = 'hud-top-speed';
      topSpEl.style.cssText = 'position:absolute;bottom:4px;left:50%;transform:translateX(-50%);font-family:var(--font-mono);font-size:9px;letter-spacing:1px;color:rgba(255,170,0,0.5);pointer-events:none;white-space:nowrap;';
      if (this._hudElement) this._hudElement.appendChild(topSpEl);
    }
    if (topSpEl) topSpEl.textContent = 'TOP ' + Math.round(this._topSpeedKmh) + ' KM/H';

    if (this._hudRefs.speedValue) { this._hudRefs.speedValue.textContent = String(Math.round(speedKmh)); var cls = speedKmh < 20 ? 'low' : speedKmh < 40 ? 'medium' : speedKmh < 55 ? 'high' : 'critical'; this._hudRefs.speedValue.className = 'speed-value ' + cls; }
    if (this._hudRefs.speedBar) { var pct = Math.min(100, (speedKmh / maxSpeed) * 100); this._hudRefs.speedBar.style.width = pct + '%'; }
    // Speed panel critical state
    var sp = document.querySelector('.hud-speed-panel');
    if (sp) { if (speedKmh >= 55) sp.classList.add('speed-critical'); else sp.classList.remove('speed-critical'); }
    if (this._hudRefs.gearValue) { var gear = speedKmh < 1 ? 'N' : String(Math.min(6, Math.max(1, Math.floor(speedKmh / 20) + 1))); if (this._hudRefs.gearValue.textContent !== gear) { this._hudRefs.gearValue.classList.add('gear-shift'); setTimeout(() => { if (this._hudRefs && this._hudRefs.gearValue) this._hudRefs.gearValue.classList.remove('gear-shift'); }, 200); } this._hudRefs.gearValue.textContent = gear; var gi = this._hudRefs.gearValue.parentElement; if (gi) gi.className = 'gear-indicator gear-' + gear; }
    if (this._hudRefs.lapCurrent) this._hudRefs.lapCurrent.textContent = String(Math.min(this._state.lap, this._state.totalLaps));
    if (this._hudRefs.lapTotal) this._hudRefs.lapTotal.textContent = String(this._state.totalLaps);
    if (this._hudRefs.lapProgress) { var lpct = ((this._state.position % this._trackLength) / this._trackLength) * 100; this._hudRefs.lapProgress.style.width = Math.min(100, lpct) + '%'; }
    if (this._hudRefs.timerDisplay && this._state.running) this._hudRefs.timerDisplay.textContent = this._formatTime(this._clock.getElapsedTime());
    // === CYCLE 32: IMPROVED MINIMAP UPDATE RATE ===
    this._minimapDrawTimer = (this._minimapDrawTimer || 0) + dt;
    if (this._hudRefs.minimapCanvas && this._minimapDrawTimer > 0.1) {
      this._minimapDrawTimer = 0;
      this._drawMinimap();
    }

    // === CYCLE 30: RACE PROGRESS BAR UPDATE ===
    if (this._raceProgressFillEl) {
      var totalProgress = ((this._state.lap - 1) + (this._state.position % this._trackLength) / this._trackLength) / this._state.totalLaps;
      this._raceProgressFillEl.style.height = (Math.min(100, totalProgress * 100)) + '%';
      if (this._state.lap >= this._state.totalLaps) this._raceProgressFillEl.classList.add('final-lap');
      else this._raceProgressFillEl.classList.remove('final-lap');
    }
    if (this._raceProgressPlayerEl) {
      var totalProgress2 = ((this._state.lap - 1) + (this._state.position % this._trackLength) / this._trackLength) / this._state.totalLaps;
      this._raceProgressPlayerEl.style.bottom = (Math.min(100, totalProgress2 * 100)) + '%';
    }
    // Mark passed lap markers
    for (var mi = 1; mi < this._state.lap; mi++) {
      var mEl = document.getElementById('race-progress-marker-' + mi);
      if (mEl) mEl.classList.add('passed');
    }

    // === CYCLE 30: PROXIMITY WARNING ===
    if (this._proximityWarningEl && this._aiSystem) {
      try {
        var oppData2 = this._aiSystem.getOpponentData();
        var closestDist = Infinity;
        if (oppData2 && this._vehicle) {
          for (var oi = 0; oi < oppData2.length; oi++) {
            if (oppData2[oi].mesh && oppData2[oi].mesh.position) {
              var odx = this._vehicle.position.x - oppData2[oi].mesh.position.x;
              var odz = this._vehicle.position.z - oppData2[oi].mesh.position.z;
              var oDist = Math.sqrt(odx * odx + odz * odz);
              if (oDist < closestDist) closestDist = oDist;
            }
          }
        }
        if (closestDist < 4) {
          this._proximityWarningEl.classList.add('active', 'close');
        } else if (closestDist < 8) {
          this._proximityWarningEl.classList.add('active');
          this._proximityWarningEl.classList.remove('close');
        } else {
          this._proximityWarningEl.classList.remove('active', 'close');
        }
      } catch(e) {}
    }

    // === CYCLE 30: BOOST TRAIL OVERLAY ===
    if (this._boostTrailEl) {
      var isBoosting = this._keys && this._keys.nitro && this._nitroFuel > 0 && Math.abs(this._state.speed) > 5;
      if (isBoosting) this._boostTrailEl.classList.add('active');
      else this._boostTrailEl.classList.remove('active');
    }

    // === CYCLE 30: TACHOMETER UPDATE ===
    if (this._tachBarEl) {
      var rpm = (Math.abs(this._state.speed) / 65) * 8000;
      var rpmPct = (rpm / 8000) * 100;
      this._tachBarEl.style.width = rpmPct + '%';
      if (rpmPct > 85) { this._tachBarEl.classList.add('redline'); } else { this._tachBarEl.classList.remove('redline'); }
    }
    if (this._rpmValueEl) {
      var rpm2 = Math.round((Math.abs(this._state.speed) / 65) * 8000);
      this._rpmValueEl.textContent = rpm2 + ' RPM';
      if (rpm2 > 6800) { this._rpmValueEl.classList.add('redline'); } else { this._rpmValueEl.classList.remove('redline'); }
    }

    // === CYCLE 30: NITRO/SHIELD/DRIFT OVERLAY STATES ===
    if (this._nitroFlashEl) {
      var isNitro = this._keys && this._keys.nitro && this._nitroFuel > 0 && Math.abs(this._state.speed) > 5;
      if (isNitro) this._nitroFlashEl.classList.add('active'); else this._nitroFlashEl.classList.remove('active');
    }
    if (this._nitroBorderEl) {
      var isNitro2 = this._keys && this._keys.nitro && this._nitroFuel > 0 && Math.abs(this._state.speed) > 5;
      if (isNitro2) this._nitroBorderEl.classList.add('active'); else this._nitroBorderEl.classList.remove('active');
    }
    if (this._shieldOverlayEl) {
      if (this._shieldActive) this._shieldOverlayEl.classList.add('active'); else this._shieldOverlayEl.classList.remove('active');
    }
    if (this._driftIndicatorEl) {
      if (this._isDrifting) this._driftIndicatorEl.classList.add('active'); else this._driftIndicatorEl.classList.remove('active');
    }

    // === CYCLE 31: SPEED LINES (FIXED: 45 -> 180 km/h threshold) ===
    // === CYCLE 32: WEATHER INDICATOR UPDATE ===
    if (this._weatherIndicatorEl) {
      var wIcon = document.getElementById('weather-icon-el');
      var wLabel = document.getElementById('weather-label-el');
      if (wIcon && wLabel) {
        if (this._weather === 'rain') { wIcon.textContent = '🌧'; wLabel.textContent = 'RAIN'; }
        else { wIcon.textContent = '☀️'; wLabel.textContent = 'CLEAR'; }
      }
    }
    if (this._speedLinesOverlayEl) {
      if (speedKmh > 180) this._speedLinesOverlayEl.classList.add('active'); else this._speedLinesOverlayEl.classList.remove('active');
    }

    // === CYCLE 30: ITEM PANEL GLOW ===
    var itemPanel = document.querySelector('.hud-item-panel');
    if (itemPanel) {
      if (this._currentItem && this._currentItem !== 'EMPTY') itemPanel.classList.add('has-item');
      else itemPanel.classList.remove('has-item');
    }

    // === CYCLE 30: SPEED BAR GLOW ===
    if (this._hudRefs.speedBar) {
      if (speedKmh >= 55) this._hudRefs.speedBar.classList.add('critical'); else this._hudRefs.speedBar.classList.remove('critical');
    }

    // === CYCLE 30: HEALTH LOW PULSE ===
    var healthFill = document.getElementById('hud-health-bar');
    if (healthFill) {
      var healthPct = parseInt(healthFill.style.width) || 100;
      if (healthPct <= 30) healthFill.classList.add('low-health'); else healthFill.classList.remove('low-health');
    }

    // === CYCLE 31: DRIFT SCORE HUD UPDATE ===
    if (this._driftScoreHUDEl && this._isDrifting) {
      this._driftScoreDisplay += Math.abs(this._state.speed) * dt * 2;
      this._driftMultiplier = Math.min(5.0, 1.0 + this._driftScoreDisplay / 500);
      var dsv = document.getElementById('drift-score-value');
      var dsm = document.getElementById('drift-score-multiplier');
      if (dsv) dsv.textContent = String(Math.round(this._driftScoreDisplay));
      if (dsm) dsm.textContent = 'x' + this._driftMultiplier.toFixed(1);
      this._driftScoreHUDEl.classList.add('active');
    } else if (this._driftScoreHUDEl) {
      if (this._driftScoreDisplay > 50) {
        var bankedScore = Math.round(this._driftScoreDisplay * this._driftMultiplier);
        this._showNotification('DRIFT BANKED: +' + bankedScore, 'success');
        this._driftScoreDisplay = 0;
        this._driftMultiplier = 1.0;
      } else {
        this._driftScoreDisplay = 0;
        this._driftMultiplier = 1.0;
      }
      this._driftScoreHUDEl.classList.remove('active');
    }

    // === CYCLE 31: COMBO COUNTER UPDATE ===
    if (this._comboCounterEl && this._comboTimer > 0) {
      this._comboTimer -= dt;
      var ccEl = document.getElementById('combo-count');
      if (ccEl) ccEl.textContent = String(this._comboCount);
      this._comboCounterEl.classList.add('active');
      this._comboCounterEl.classList.add('pulse');
      setTimeout(function() { if (this._comboCounterEl) this._comboCounterEl.classList.remove('pulse'); }.bind(this), 200);
      if (this._comboTimer <= 0) {
        this._comboCount = 0;
        this._comboCounterEl.classList.remove('active');
      }
    }

    // === CYCLE 31: TRACK EDGE WARNINGS ===
    if (this._trackBounds && this._vehicle) {
      var vx2 = this._vehicle.position.x;
      var warnDist = 15;
      if (this._edgeWarnLeft) {
        var leftDist = vx2 - this._trackBounds.left;
        if (leftDist < warnDist && leftDist > 0) {
          this._edgeWarnLeft.classList.add('active');
          this._edgeWarnLeft.style.opacity = String(Math.max(0, 1 - leftDist / warnDist));
        } else { this._edgeWarnLeft.classList.remove('active'); }
      }
      if (this._edgeWarnRight) {
        var rightDist = this._trackBounds.right - vx2;
        if (rightDist < warnDist && rightDist > 0) {
          this._edgeWarnRight.classList.add('active');
          this._edgeWarnRight.style.opacity = String(Math.max(0, 1 - rightDist / warnDist));
        } else { this._edgeWarnRight.classList.remove('active'); }
      }
    }

    // === CYCLE 31: NITRO DEPLETED STATE ===
    if (this._hudRefs.nitroBar) {
      var nitroPct = parseInt(this._hudRefs.nitroBar.style.width) || 100;
      if (nitroPct <= 5) this._hudRefs.nitroBar.classList.add('depleted'); else this._hudRefs.nitroBar.classList.remove('depleted');
    }
  }
  
  _updateHUDData(data) {
    if (!this._hudRefs) return;
    if (data.speed !== undefined && this._hudRefs.speedValue) this._hudRefs.speedValue.textContent = String(Math.round(data.speedKmh || data.speed * 3.6 || 0));
    if (data.position !== undefined && this._hudRefs.positionNumber) this._hudRefs.positionNumber.textContent = String(data.position);
    if (data.gear !== undefined && this._hudRefs.gearValue) this._hudRefs.gearValue.textContent = data.gear === 0 ? 'N' : String(data.gear);
  }
  
  _showCountdown(value) {
    if (!this._hudRefs || !this._hudRefs.countdown) return;
    this._hudRefs.countdown.classList.add('active');
    this._hudRefs.countdownNumber.textContent = String(value);
    this._hudRefs.countdownNumber.className = value === 'GO!' ? 'countdown-number go' : 'countdown-number';
    // Set data attribute for number-specific color styling
    this._hudRefs.countdownNumber.setAttribute('data-count', String(value));
    
    // Add screen shake on GO!
    if (value === 'GO!') {
      document.body.classList.add('fx-screen-shake');
      setTimeout(() => document.body.classList.remove('fx-screen-shake'), 500);

      // === CYCLE 31: GO! FLASH + SPEED LINES ===
      var goFlash = document.createElement('div');
      goFlash.className = 'countdown-go-flash';
      document.body.appendChild(goFlash);
      setTimeout(function() { if (goFlash.parentNode) goFlash.parentNode.removeChild(goFlash); }, 600);
      var speedLines = document.createElement('div');
      speedLines.className = 'countdown-speed-lines';
      document.body.appendChild(speedLines);
      setTimeout(function() { if (speedLines.parentNode) speedLines.parentNode.removeChild(speedLines); }, 800);
    }
  }
  
  _hideCountdown() {
    if (!this._hudRefs || !this._hudRefs.countdown) return;
    // NUCLEAR FIX: Just hide it with display:none — no CSS transition issues
    this._hudRefs.countdown.style.display = 'none';
  }
  
  _showNotification(message, type) {
    if (!this._hudRefs || !this._hudRefs.notifications) return;
    var notif = document.createElement('div');
    notif.className = 'hud-notification ' + type + ' visible';
    notif.innerHTML = '<span class="notif-icon">' + (type === 'success' ? '&#10003;' : type === 'warning' ? '&#9888;' : type === 'danger' ? '&#10007;' : '&#8505;') + '</span><span class="notif-message">' + message + '</span>';
    this._hudRefs.notifications.appendChild(notif);
    setTimeout(function() { notif.classList.remove('visible'); setTimeout(function() { notif.remove(); }, 300); }, 2500);
  }
  
  _setItem(itemType) {
    if (!this._hudRefs || !this._hudRefs.itemBox) return;
    if (itemType) { this._hudRefs.itemBox.classList.add('has-item'); this._hudRefs.itemStatus.textContent = itemType.toUpperCase(); }
    else { this._hudRefs.itemBox.classList.remove('has-item'); this._hudRefs.itemStatus.textContent = 'EMPTY'; }
  }
  
  // === CYCLE 27: POSITION CHANGE ANNOUNCEMENT ===
  _announcePositionChange(oldPos, newPos) {
    if (oldPos === newPos || !this._state.raceStarted) return;
    var ordinals = ['', '1st', '2nd', '3rd', '4th', '5th', '6th'];
    var el = document.createElement('div');
    if (newPos < oldPos) {
      el.className = 'position-announce gain';
      el.textContent = ordinals[newPos] + ' Place!';
      // Update position change arrow
      var pcEl = document.querySelector('.position-change');
      if (pcEl) { pcEl.textContent = '\u25B2'; pcEl.className = 'position-change gained'; }
      // Increment combo
      this._comboCount++;
      this._comboTimer = 3;
    } else {
      el.className = 'position-announce loss';
      el.textContent = ordinals[newPos] + ' Place';
      var pcEl2 = document.querySelector('.position-change');
      if (pcEl2) { pcEl2.textContent = '\u25BC'; pcEl2.className = 'position-change lost'; }
      this._comboCount = 0;
    }
    document.body.appendChild(el);
    setTimeout(function() { el.remove(); }, 1800);
  }

  // === CYCLE 27: FINAL LAP INDICATOR ===
  _showFinalLapIndicator() {
    if (this._finalLapShown) return;
    this._finalLapShown = true;
    var el = document.createElement('div');
    el.className = 'final-lap-indicator';
    el.id = 'final-lap-indicator';
    el.textContent = 'FINAL LAP';
    document.body.appendChild(el);
    if (window.__engine?.audio) { try { window.__engine.audio.play('game.countdown'); } catch(e) {} }
    setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 3000);
  }

  // === CYCLE 32: LAP TIME DELTA INDICATOR ===
  _showLapTimeDelta(delta, lapTime) {
    var el = document.createElement('div');
    el.className = 'lap-time-delta';
    var isFaster = delta < 0;
    var sign = isFaster ? '-' : '+';
    var cls = isFaster ? 'faster' : 'slower';
    var absDelta = Math.abs(delta);
    el.innerHTML = '<span class="delta-sign ' + cls + '">' + sign + '</span>' +
      '<span class="delta-time ' + cls + '">' + this._formatTime(absDelta) + '</span>' +
      '<span class="delta-label">vs last lap</span>';
    document.body.appendChild(el);
    requestAnimationFrame(function() { el.classList.add('visible'); });
    setTimeout(function() {
      el.classList.remove('visible');
      setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
    }, 2500);
  }

  // === CYCLE 32: CHECKPOINT PROGRESS POPUP ===
  _showCheckpointPopup(sectorName) {
    var popup = document.createElement('div');
    popup.className = 'checkpoint-progress-popup';
    popup.innerHTML = '<div class="checkpoint-popup-name">' + sectorName + '</div><div class="checkpoint-popup-bar"><div class="checkpoint-popup-fill"></div></div>';
    document.body.appendChild(popup);
    // Trigger animation
    requestAnimationFrame(function() { popup.classList.add('active'); });
    // Play checkpoint sound
    if (window.__engine?.audio) {
      try { window.__engine.audio.play('game.lapComplete'); } catch(e) {}
    }
    setTimeout(function() {
      popup.classList.remove('active');
      popup.classList.add('fade-out');
      setTimeout(function() { if (popup.parentNode) popup.parentNode.removeChild(popup); }, 400);
    }, 1200);
  }

  // === CYCLE 27: DRIFT TRAIL PARTICLES ===
  _createDriftTrail() {
    var count = 40;
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) { pos[i*3] = 0; pos[i*3+1] = 0.3; pos[i*3+2] = 0; }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.PointsMaterial({
      color: '#ff4d2e', size: 1.2, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    });
    var pts = new THREE.Points(geo, mat);
    this._scene.add(pts);
    this._driftTrailParticles = pts;
    this._driftTrailData = { positions: pos, count: count, head: 0 };
  }

  _updateDriftTrail(dt) {
    if (!this._driftTrailParticles || !this._vehicle || !this._isDrifting) return;
    var data = this._driftTrailData;
    var rearOffset = -2.2;
    var sideOffset = (Math.random() - 0.5) * 1.5;
    var hx = Math.sin(this._heading || 0);
    var hz = Math.cos(this._heading || 0);
    data.positions[data.head*3] = this._vehicle.position.x - hx * rearOffset + hz * sideOffset;
    data.positions[data.head*3+1] = 0.2 + Math.random() * 0.3;
    data.positions[data.head*3+2] = this._vehicle.position.z - hz * rearOffset - hx * sideOffset;
    data.head = (data.head + 1) % data.count;
    this._driftTrailParticles.geometry.attributes.position.needsUpdate = true;
    this._driftTrailParticles.material.opacity = 0.3 + Math.abs(this._state.speed) / 65 * 0.3;
  }

  _drawMinimap() {
    var canvas = this._hudRefs ? this._hudRefs.minimapCanvas : null;
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    var cx = w / 2, cy = h / 2;
    
    // Clear with dark background
    ctx.fillStyle = 'rgba(5, 6, 10, 0.92)';
    ctx.fillRect(0, 0, w, h);
    
    // Draw track shape from spline points
    if (this._trackCurve) {
      var trackPoints = this._trackCurve.getSpacedPoints(80);
      // Calculate track bounds for scaling
      var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (var ti = 0; ti < trackPoints.length; ti++) {
        if (trackPoints[ti].x < minX) minX = trackPoints[ti].x;
        if (trackPoints[ti].x > maxX) maxX = trackPoints[ti].x;
        if (trackPoints[ti].z < minZ) minZ = trackPoints[ti].z;
        if (trackPoints[ti].z > maxZ) maxZ = trackPoints[ti].z;
      }
      var trackW = maxX - minX || 1;
      var trackH = maxZ - minZ || 1;
      var scale = Math.min((w - 30) / trackW, (h - 30) / trackH);
      var offX = cx - (minX + trackW / 2) * scale;
      var offZ = cy - (minZ + trackH / 2) * scale;
      
      // Draw track path
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.5)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (var pi = 0; pi < trackPoints.length; pi++) {
        var px = trackPoints[pi].x * scale + offX;
        var py = trackPoints[pi].z * scale + offZ;
        if (pi === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      
      // Track glow
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
      ctx.lineWidth = 10;
      ctx.stroke();
    }
    
    // Draw AI opponents with position labels
    if (this._aiSystem) {
      try {
        var oppData = this._aiSystem.getOpponentData();
        if (oppData && oppData.length) {
          for (var oi = 0; oi < oppData.length; oi++) {
            var opp = oppData[oi];
            if (opp.mesh && opp.mesh.position) {
              var ox = cx + (opp.mesh.position.x / (this._trackWidth * 4)) * (w * 0.4);
              var oy = cy + (opp.mesh.position.z / (this._trackLength)) * (h * 0.4);
              // Opponent glow
              ctx.fillStyle = (opp.color || '#ffaa00').replace(')', ',0.2)').replace('rgb', 'rgba');
              ctx.beginPath(); ctx.arc(ox, oy, 5, 0, Math.PI * 2); ctx.fill();
              // Opponent dot
              ctx.fillStyle = opp.color || '#ffaa00';
              ctx.globalAlpha = 0.9;
              ctx.beginPath();
              ctx.arc(ox, oy, 3, 0, Math.PI * 2);
              ctx.fill();
              ctx.globalAlpha = 1;
              // === CYCLE 31: Position label ===
              if (opp.position !== undefined) {
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.font = '7px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(String(opp.position + 1), ox, oy - 6);
              }
            }
          }
        }
      } catch(e) {}
    }
    
    // Draw player position
    var veh = this._vehicle || (this._barrelVehicle ? this._barrelVehicle.mesh : null);
    if (veh) {
      var ppx = cx + (veh.position.x / (this._trackWidth * 4)) * (w * 0.4);
      var ppy = cy + (veh.position.z / this._trackLength) * (h * 0.4);
      
      // Player glow
      ctx.fillStyle = 'rgba(255, 51, 102, 0.3)';
      ctx.beginPath(); ctx.arc(ppx, ppy, 7, 0, Math.PI * 2); ctx.fill();
      
      // Player dot
      ctx.fillStyle = '#ff3366';
      ctx.beginPath(); ctx.arc(ppx, ppy, 4, 0, Math.PI * 2); ctx.fill();
      
      // Direction indicator
      var hd = this._heading || (veh.rotation ? veh.rotation.y : 0);
      ctx.strokeStyle = '#ff3366';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ppx, ppy);
      ctx.lineTo(ppx - Math.sin(hd) * 10, ppy - Math.cos(hd) * 10);
      ctx.stroke();
      
      // Direction arrow head
      var ax = ppx - Math.sin(hd) * 10;
      var ay = ppy - Math.cos(hd) * 10;
      ctx.fillStyle = '#ff3366';
      ctx.beginPath(); ctx.arc(ax, ay, 2, 0, Math.PI * 2); ctx.fill();
    }
    
    // Border frame
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(1, 1, w - 2, h - 2);
    
    // Compass indicator (N/S/E/W)
    ctx.fillStyle = 'rgba(0, 229, 255, 0.4)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('N', cx, 10);
    ctx.fillText('S', cx, h - 3);
    ctx.textAlign = 'left';
    ctx.fillText('W', 3, cy + 3);
    ctx.textAlign = 'right';
    ctx.fillText('E', w - 3, cy + 3);
    
    // CYCLE 21: Draw boost pad indicators on minimap
    if (this._boostPads.length) {
      for (var bpi = 0; bpi < this._boostPads.length; bpi++) {
        var bp = this._boostPads[bpi];
        var bpx = cx + (bp.x / (this._trackWidth * 4)) * (w * 0.4);
        var bpy = cy + (bp.z / this._trackLength) * (h * 0.4);
        var bpActive = bp.cooldown <= 0;
        ctx.fillStyle = bpActive ? 'rgba(0, 255, 170, 0.8)' : 'rgba(0, 255, 170, 0.2)';
        ctx.beginPath();
        ctx.arc(bpx, bpy, bpActive ? 4 : 2, 0, Math.PI * 2);
        ctx.fill();
        if (bpActive) {
          ctx.fillStyle = 'rgba(0, 255, 170, 0.2)';
          ctx.beginPath();
          ctx.arc(bpx, bpy, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    
    // === CYCLE 28: Draw item box indicators on minimap ===
    if (this._itemBoxes && this._itemBoxes.length) {
      for (var ibi = 0; ibi < this._itemBoxes.length; ibi++) {
        var ibox = this._itemBoxes[ibi];
        var ibx = cx + (ibox.x / (this._trackWidth * 4)) * (w * 0.4);
        var iby = cy + (ibox.z / this._trackLength) * (h * 0.4);
        var ibActive = ibox.cooldown <= 0;
        ctx.fillStyle = ibActive ? 'rgba(255, 204, 0, 0.8)' : 'rgba(255, 204, 0, 0.15)';
        ctx.fillRect(ibx - 3, iby - 3, 6, 6);
        if (ibActive) {
          ctx.strokeStyle = 'rgba(255, 204, 0, 0.4)';
          ctx.lineWidth = 1;
          ctx.strokeRect(ibx - 5, iby - 5, 10, 10);
        }
      }
    }
  }

  _fadeControlsHint() {
    if (this._controlsHint && this._controlsHintShown) {
      this._controlsHint.classList.add('faded');
      this._controlsHintShown = false;
      setTimeout(function() {
        if (this._controlsHint && this._controlsHint.parentNode) {
          this._controlsHint.parentNode.removeChild(this._controlsHint);
        }
      }.bind(this), 600);
    }
  }
  
  _updateSectorDots() {
    if (!this._sectorDots || !this._passedSectorFlags) return;
    for (var di = 0; di < 4; di++) {
      var dot = document.getElementById('sector-dot-' + di);
      if (!dot) continue;
      dot.className = 'sector-dot';
      if (this._passedSectorFlags[di]) {
        dot.classList.add('passed');
      }
      if (di === this._currentSector) {
        dot.classList.add('current');
      }
    }
  }


  // === CYCLE 26: ITEM PICKUP & USE SYSTEM ===
  _useItem() {
    if (!this._currentItem || this._currentItem === 'EMPTY') {
      return;
    }
    var item = this._currentItem;
    this._currentItem = null;
    this._setItem(null);
    
    if (item === 'boost') {
      this._state.speed = Math.min(85, this._state.speed + 20);
      this._nitroFuel = Math.min(this._nitroMax, this._nitroFuel + 40);
      this._showNotification('TURBO BOOST!', 'success');
      if (window.__engine?.audio) { try { window.__engine.audio.play('game.nitroActivate'); } catch(e) {} }
    } else if (item === 'shield') {
      this._shieldActive = true;
      this._shieldTimer = 5;
      this._showNotification('SHIELD ACTIVE!', 'success');
      if (window.__engine?.audio) { try { window.__engine.audio.play('game.shield'); } catch(e) {} }
    } else if (item === 'missile') {
      this._showNotification('MISSILE LAUNCHED!', 'warning');
      if (window.__engine?.audio) { try { window.__engine.audio.play('game.missile'); } catch(e) {} }
    }
    
    // Visual flash
    var fx = document.createElement('div');
    fx.className = 'fx-item-use';
    fx.setAttribute('data-item', item);
    fx.textContent = item.toUpperCase();
    document.body.appendChild(fx);
    setTimeout(function() { if (fx.parentNode) fx.parentNode.removeChild(fx); }, 1000);
  }

  _createItemBoxes() {
    if (!this._trackCurve) return;
    this._itemBoxes = [];
    this._currentItem = null;
    
    // Place 6 item boxes at various track positions
    var itemPositions = [0.08, 0.25, 0.42, 0.58, 0.75, 0.92];
    var itemTypes = ['boost', 'shield', 'missile', 'boost', 'shield', 'missile'];
    
    for (var ii = 0; ii < itemPositions.length; ii++) {
      var t = itemPositions[ii];
      var point = this._trackCurve.getPoint(t);
      var tangent = this._trackCurve.getTangent(t);
      var angle = Math.atan2(tangent.x, tangent.z);
      var perp = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      
      // Item box group
      var boxGroup = new THREE.Group();
      boxGroup.position.set(point.x, 1.5, point.z);
      boxGroup.rotation.y = angle;
      
      // Question mark box body
      var boxGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
      var boxMat = new THREE.MeshStandardMaterial({ 
        color: '#ffaa00', emissive: '#ff8800', emissiveIntensity: 0.5,
        metalness: 0.6, roughness: 0.3, transparent: true, opacity: 0.85
      });
      var boxMesh = new THREE.Mesh(boxGeo, boxMat);
      boxGroup.add(boxMesh);
      
      // Question mark on front face (canvas texture)
      var qCanvas = document.createElement('canvas');
      qCanvas.width = 128; qCanvas.height = 128;
      var qCtx = qCanvas.getContext('2d');
      qCtx.fillStyle = '#ffcc00';
      qCtx.font = 'bold 96px Arial, sans-serif';
      qCtx.textAlign = 'center';
      qCtx.textBaseline = 'middle';
      qCtx.fillText('?', 64, 64);
      var qTexture = new THREE.CanvasTexture(qCanvas);
      var qPlaneGeo = new THREE.PlaneGeometry(1.2, 1.2);
      var qPlaneMat = new THREE.MeshBasicMaterial({ map: qTexture, transparent: true, side: THREE.DoubleSide });
      var qPlane = new THREE.Mesh(qPlaneGeo, qPlaneMat);
      qPlane.position.z = 0.81;
      boxGroup.add(qPlane);
      
      // ? on back face
      var qPlane2 = qPlane.clone();
      qPlane2.position.z = -0.81;
      qPlane2.rotation.y = Math.PI;
      boxGroup.add(qPlane2);
      
      // Outer wireframe for glow effect
      var wireGeo = new THREE.BoxGeometry(1.8, 1.8, 1.8);
      var wireMat = new THREE.MeshBasicMaterial({ color: '#ffcc00', wireframe: true, transparent: true, opacity: 0.3 });
      var wire = new THREE.Mesh(wireGeo, wireMat);
      boxGroup.add(wire);
      
      // Glow point light
      var itemLight = new THREE.PointLight('#ffaa00', 2, 10);
      itemLight.position.y = 0.5;
      boxGroup.add(itemLight);
      
      // Offset box to side of track
      var sideOffset = (ii % 2 === 0 ? -1 : 1) * (this._trackWidth * 0.25);
      boxGroup.position.x += perp.x * sideOffset;
      boxGroup.position.z += perp.z * sideOffset;
      
      this._scene.add(boxGroup);
      this._itemBoxes.push({
        group: boxGroup, mesh: boxMesh, wire: wire, light: itemLight,
        x: boxGroup.position.x, z: boxGroup.position.z,
        radius: 3, cooldown: 0, type: itemTypes[ii],
        baseY: 1.5, rotSpeed: 1.2 + Math.random() * 0.5
      });
    }
    console.log('[RaceScene] ' + this._itemBoxes.length + ' item boxes created');
  }

  _checkItemBoxes(dt) {
    if (!this._vehicle || !this._itemBoxes || !this._itemBoxes.length) return;
    var vx = this._vehicle.position.x;
    var vz = this._vehicle.position.z;
    var time = this._clock.getElapsedTime();
    
    for (var ii = 0; ii < this._itemBoxes.length; ii++) {
      var ib = this._itemBoxes[ii];
      
      // Update cooldown
      if (ib.cooldown > 0) {
        ib.cooldown -= dt;
        ib.group.visible = ib.cooldown <= 0;
        if (ib.cooldown > 0) continue;
      }
      
      // Rotate and bob
      ib.group.rotation.y += dt * ib.rotSpeed;
      ib.group.position.y = ib.baseY + Math.sin(time * 2 + ii) * 0.3;
      
      // Pulse glow
      var pulse = 0.3 + Math.sin(time * 3 + ii * 1.2) * 0.15;
      ib.wire.material.opacity = pulse;
      ib.light.intensity = 1.5 + Math.sin(time * 4 + ii) * 0.8;
      
      // Check collision
      var dx = vx - ib.x;
      var dz = vz - ib.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      
      if (dist < ib.radius && !this._currentItem) {
        // ITEM PICKUP!
        this._currentItem = ib.type;
        this._setItem(ib.type);
        ib.cooldown = 8;
        ib.group.visible = false;
        
        this._showNotification('GOT: ' + ib.type.toUpperCase() + ' [E to use]', 'success');
        if (window.__engine?.audio) { try { window.__engine.audio.play('game.itemPickup'); } catch(e) {} }
        
        // Spawn pickup particle burst
        this._spawnPickupBurst(ib.x, 1.5, ib.z);

        // === CYCLE 30: Item pickup glow ring ===
        var ring = document.createElement('div');
        ring.className = 'item-pickup-ring';
        document.body.appendChild(ring);
        setTimeout(function() { if (ring.parentNode) ring.parentNode.removeChild(ring); }, 600);
      }
    }
  }

  _spawnPickupBurst(x, y, z) {
    var count = 20;
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(count * 3);
    var vel = [];
    for (var i = 0; i < count; i++) {
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      vel.push({
        x: (Math.random() - 0.5) * 15,
        y: Math.random() * 10 + 3,
        z: (Math.random() - 0.5) * 15,
        life: 0.8 + Math.random() * 0.4
      });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.PointsMaterial({
      color: '#ffcc00', size: 0.5, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    });
    var particles = new THREE.Points(geo, mat);
    this._scene.add(particles);
    var self = this;
    var startTime = this._clock.getElapsedTime();
    function animateBurst() {
      var elapsed = self._clock.getElapsedTime() - startTime;
      if (elapsed > 1.2) { self._scene.remove(particles); geo.dispose(); mat.dispose(); return; }
      var p = particles.geometry.attributes.position;
      for (var i = 0; i < count; i++) {
        p.array[i * 3] += vel[i].x * 0.016;
        p.array[i * 3 + 1] += vel[i].y * 0.016;
        p.array[i * 3 + 2] += vel[i].z * 0.016;
        vel[i].y -= 12 * 0.016;
      }
      p.needsUpdate = true;
      mat.opacity = Math.max(0, 1 - elapsed / 1.0);
      requestAnimationFrame(animateBurst);
    }
    requestAnimationFrame(animateBurst);
  }

  // === CYCLE 33: FIREWORKS PARTICLE SYSTEM ===
  _spawnFireworks() {
    var colors = ['#ff4d2e', '#00e5ff', '#ffd700', '#ff6b35', '#7df9ff', '#ff2d55'];
    for (var fw = 0; fw < 5; fw++) {
      setTimeout(function(fwIdx) {
        var cx = Math.random() * window.innerWidth;
        var cy = Math.random() * (window.innerHeight * 0.5) + 50;
        for (var p = 0; p < 20; p++) {
          var particle = document.createElement('div');
          var color = colors[Math.floor(Math.random() * colors.length)];
          var angle = (p / 20) * Math.PI * 2;
          var dist = 40 + Math.random() * 80;
          var tx = Math.cos(angle) * dist;
          var ty = Math.sin(angle) * dist;
          particle.style.cssText = 
          'position:fixed;left:' + cx + 'px;top:' + cy + 'px;width:4px;height:4px;border-radius:50%;' +
          'background:' + color + ';box-shadow:0 0 8px ' + color + ';pointer-events:none;z-index:60;' +
          'transition:all 0.8s cubic-bezier(0.25,0.46,0.45,0.94);opacity:1;';
          document.body.appendChild(particle);
          requestAnimationFrame(function(particle, tx, ty) {
            return function() {
              particle.style.transform = 'translate(' + tx + 'px, ' + ty + 'px)';
              particle.style.opacity = '0';
              setTimeout(function() { if (particle.parentNode) particle.remove(); }, 800);
            };
          }(particle, tx, ty));
        }
      }, fw * 400, fw);
    }
  }

  _formatTime(seconds) {
    var mins = Math.floor(seconds / 60);
    var secs = Math.floor(seconds % 60);
    var ms = Math.floor((seconds % 1) * 100);
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0') + '.' + String(ms).padStart(2, '0');
  }

  // === CYCLE 33: PROXIMITY WARNING SYSTEM ===
  _checkProximity() {
    if (!this._aiSystem || !this._vehicle) return;
    var playerPos = this._vehicle.position;
    var opponents = this._aiSystem.getOpponentData ? this._aiSystem.getOpponentData() : [];
    var minDist = Infinity;
    for (var oi = 0; oi < opponents.length; oi++) {
      var opp = opponents[oi];
      if (!opp || !opp.position) continue;
      var dx = playerPos.x - opp.position.x;
      var dz = playerPos.z - opp.position.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < minDist) minDist = dist;
    }
    // Show warning when opponent is within 8 units
    var warningEl = document.getElementById('proximity-warning');
    if (minDist < 8 && minDist > 0) {
      if (!warningEl) {
        warningEl = document.createElement('div');
        warningEl.id = 'proximity-warning';
        warningEl.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' +
          'font-family:Bebas Neue,sans-serif;font-size:18px;letter-spacing:4px;color:#ffaa00;' +
          'text-shadow:0 0 15px rgba(255,170,0,0.5);opacity:0;pointer-events:none;transition:opacity 0.3s ease;z-index:55;';
        if (this._hudElement) this._hudElement.appendChild(warningEl);
      }
      warningEl.textContent = '!! CLOSE !!';
      warningEl.style.opacity = String(Math.max(0, 1 - (minDist / 8)));
      // Also flash screen edges
      if (this._vignetteOverlay) {
        this._vignetteOverlay.style.background = 'radial-gradient(ellipse at center, transparent 55%, rgba(255,170,0,' + (0.15 * (1 - minDist/8)).toFixed(3) + ') 85%, rgba(0,0,0,0.3) 100%)';
        this._vignetteOverlay.style.opacity = '1';
      }
    } else {
      if (warningEl) warningEl.style.opacity = '0';
    }
  }

  _updateCamera(dt) {
    if (!this._camera || !this._vehicle) return;
    var vehiclePos = this._vehicle.position;
    var vehicleHeading = this._heading || this._vehicle.rotation.y || 0;
    
    // AAA CAMERA: Chase cam behind and above vehicle (NFS/GTA/Forza style)
    var camDistance = 13;
    var camHeight = 5.5;
    var speedRatio = Math.min(1, Math.abs(this._state.speed) / 65);
    
    // Camera pulls back slightly at higher speed for dramatic effect
    var dynamicDist = camDistance + speedRatio * 3;
    var dynamicHeight = camHeight + speedRatio * 1.5;
    
    // Calculate camera position BEHIND the vehicle (opposite to heading)
    var camOffsetX = -Math.sin(vehicleHeading) * dynamicDist;
    var camOffsetZ = -Math.cos(vehicleHeading) * dynamicDist;
    
    var targetPos = new THREE.Vector3(
      vehiclePos.x + camOffsetX,
      vehiclePos.y + dynamicHeight,
      vehiclePos.z + camOffsetZ
    );
    
    // Smooth camera follow (faster when far, slower when close)
    var lerpSpeed = Math.min(1, dt * 5);
    this._camera.position.lerp(targetPos, lerpSpeed);
    
    // Look at a point ahead of the vehicle (in driving direction)
    var lookAheadDist = 12 + speedRatio * 8;
    var lookTarget = new THREE.Vector3(
      vehiclePos.x + Math.sin(vehicleHeading) * lookAheadDist,
      vehiclePos.y + 0.8,
      vehiclePos.z + Math.cos(vehicleHeading) * lookAheadDist
    );
    
    // Smooth look-at transition
    if (!this._cameraLookTarget) this._cameraLookTarget = lookTarget.clone();
    this._cameraLookTarget.lerp(lookTarget, Math.min(1, dt * 6));
    this._camera.lookAt(this._cameraLookTarget);
    
    // === CYCLE 26: DYNAMIC FOV (speed + nitro warp) ===
    if (!this._baseFOV) this._baseFOV = this._camera.fov;
    var targetFOV = this._baseFOV;
    // Wider FOV at high speed
    targetFOV += speedRatio * 8;
    // Extra FOV warp during nitro
    if (this._keys.nitro && this._nitroFuel > 0 && this._state.speed > 5) {
      targetFOV += 10;
    }
    this._camera.fov += (targetFOV - this._camera.fov) * Math.min(1, dt * 4);
    this._camera.updateProjectionMatrix();
  }

  getState() { return { running: this._state.running, speed: this._state.speed, position: this._state.position, lap: this._state.lap }; }
  getScene() { return this._scene; }
  getCamera() { return this._camera; }
  getVehicle() { return this._barrelVehicle || this._vehicle; }
  isUsingBarrelVehicle() { return this._useBarrelVehicle; }
  setSpeed(speed) { this._state.speed = speed; }
  setPosition(pos) { this._state.position = pos; }
  
  reset() {
    this._state.position = 0; this._state.lap = 1; this._state.speed = 0;
    this._steerAngle = 0; this._steerInput = 0; this._heading = 0; this._vehicleRoll = 0; this._minimapUpdateTimer = 0;
    if (this._useBarrelVehicle && this._barrelVehicle && this._barrelVehicle.physicsBody) { this._barrelVehicle.physicsBody.position.set(0, 1, -this._trackLength / 2 + 15); this._barrelVehicle.physicsBody.velocity.set(0, 0, 0); }
    else if (this._vehicle) { this._vehicle.position.set(0, 0.5, -this._trackLength / 2 + 15); this._vehicle.rotation.y = 0; this._vehicle.rotation.z = 0; }
  }
}

var _instance = null;

export function getRaceScene(raceConfig) {
  // If config provided or no instance, create new; otherwise return existing
  if (raceConfig || !_instance) _instance = new RaceScene(raceConfig);
  // Update config if provided on existing instance
  else if (raceConfig && _instance) _instance._raceConfig = Object.assign(_instance._raceConfig, raceConfig);
  return _instance;
}

// Factory for creating fresh instances (for new races)
export function createRaceScene(raceConfig) {
  return new RaceScene(raceConfig);
}

if (typeof window !== 'undefined') window.__raceScene = getRaceScene;
if (typeof window !== 'undefined') window.__createRaceScene = createRaceScene;

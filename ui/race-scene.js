// ui/race-scene.js — OPTIMIZED RACE SCENE
// Performance: Merged geometries, instanced meshes, minimal draw calls
// HUD: Proper DOM structure matching hud.css exactly

import * as THREE from 'three';

export class RaceScene {
  constructor() {
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
    
    this._state = {
      running: false,
      speed: 0,
      position: 0,
      lap: 1,
      totalLaps: 3,
      countdown: false,
      raceStarted: false,
      countdownValue: 3
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
      boost: false
    };
    
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp = this._handleKeyUp.bind(this);
    this._hudElement = null;
    
    // Boost/Nitro system
    this._boostCharges = 3;
    this._boostMaxCharges = 3;
    this._boostActive = false;
    this._boostTimer = 0;
    this._boostDuration = 2.0;
    this._boostMultiplier = 1.5;
    this._boostRefillTimer = 0;
    this._boostRefillInterval = 8.0;
    this._boostOverlay = null;
    this._boostPips = [];
    this._boostBarFill = null;
    this._originalFOV = 75;
    
    // Tire marks system
    this._tireMarks = [];
    this._tireMarkMaxSegments = 200;
    this._tireMarkFadeTime = 10.0;
    this._tireMarkGeometry = null;
    
    // Collision shake system
    this._shakeIntensity = 0;
    this._shakeDecay = 5.0;
    this._collisionFlash = null;
    
    // CYCLE 27: Pause system
    this._paused = false;
    this._pauseElement = null;
    this._onEscapeKeyDown = this._handleEscapeKey.bind(this);
    
    // CYCLE 27: AI Opponents (simulated for minimap + proximity)
    this._aiOpponents = [];
    this._aiCount = 7;
    this._proximityWarningEl = null;
    this._lastProximityTime = 0;
    
    // CYCLE 29: Item boxes on track
    this._itemBoxes = [];
    this._itemBoxRespawnTime = 10; // seconds before respawn
    this._itemPickupCooldown = 0;
    
    // CYCLE 30: Boost pad zones on track
    this._boostPads = [];
    
    // CYCLE 30: Drift score system
    this._driftScore = 0;
    this._driftCombo = 0;
    this._driftTimer = 0;
    this._driftCooldown = 0;
    this._totalDriftScore = 0;
    this._driftDisplayEl = null;
    this._driftComboEl = null;
    
    // CYCLE 30: Particle trail system
    this._trailParticles = [];
    this._trailMaxParticles = 80;
    
    // CYCLE 30: Enhanced countdown
    this._countdownCameraShake = 0;
    
    // CYCLE 30: Lap split times
    this._lapSplits = [];
    this._raceStartTime = 0;
    this._bestLapTime = null;
    this._currentLapStart = 0;
    this._lastSectorIndex = 0;
    this._speedBoostTimer = 0;
    this._speedBoostMultiplier = 1.0;
    
    // CYCLE 31: Rear-view mirror
    this._rearViewCanvas = null;
    this._rearViewCtx = null;
    this._rearViewCamera = null;
    this._rearViewRenderer = null;
    this._rearViewActive = false;
    
    // CYCLE 31: Track sector progress
    this._sectorCount = 4;
    this._currentSector = 0;
    
    // CYCLE 31: Finish celebration
    this._finishing = false;
    this._finishTimer = 0;
    this._celebrationParticles = [];
    
    // CYCLE 34: Dynamic vignette
    this._vignetteEl = null;
    this._heatShimmerEl = null;
    this._lastVignetteState = '';
    
    // CYCLE 34: Race standings tower
    this._standingsTower = null;
    this._standingsRows = [];
    this._lastPositions = [];
    
    // CYCLE 34: Tachometer / RPM gauge
    this._tachoContainer = null;
    this._tachoFill = null;
    this._tachoRPMValue = null;
    this._currentRPM = 0;
    this._targetRPM = 0;
    
    // CYCLE 34: Weather rain
    this._rainContainer = null;
    this._rainSplash = null;
    this._rainActive = false;
    this._rainToggleTimer = 0;
    
    // CYCLE 34: Track hazard zones
    this._hazardZones = [];
    this._hazardIndicator = null;
    this._inHazardZone = false;
    
    // CYCLE 34: Wrong way detection
    this._wrongWayEl = null;
    this._wrongWayTimer = 0;
    this._lastForwardProgress = 0;
    this._wrongWayDetected = false;

    // CYCLE 35: Slipstream / drafting system
    this._slipstreamActive = false;
    this._slipstreamProgress = 0;
    this._slipstreamTarget = null;
    this._slipstreamBonus = 0;
    this._slipstreamEl = null;
    this._slipstreamFill = null;

    // CYCLE 35: Race stats tracker
    this._raceStats = { maxSpeed: 0, totalDrift: 0, closePasses: 0, timeInLead: 0, cleanLaps: 0, boostUsed: 0, hazardsHit: 0, iceZones: 0 };
    this._statsOverlay = null;
    this._raceFinishShown = false;

    // CYCLE 35: Ghost trail
    this._ghostTrail = [];
    this._ghostTrailMax = 600;
    this._ghostCanvas = null;
    this._ghostCtx = null;

    // CYCLE 35: Speed edge tint
    this._speedEdgeTint = null;
    this._lastSpeedTier = '';

    // CYCLE 35: Lens flare
    this._lensFlareContainer = null;

    // CYCLE 35: Boost cinematic flash
    this._boostCinematicFlash = null;

    // CYCLE 35: Enhanced tire smoke overlay
    this._tireSmokeEnhanced = null;

    // CYCLE 35: Ice surface zones
    this._iceZones = [];
    this._iceIndicator = null;
    this._onIceSurface = false;

    // CYCLE 35: RPM glow on speed panel
    this._speedPanelEl = null;

    // CYCLE 36: Turbo start
    this._turboStartOverlay = null;
    this._turboStartActive = false;
    this._turboStartCountdown = 0;
    this._turboStartTimer = 0;
    this._turboStartWindow = 0.6; // seconds to hit boost
    this._turboStartResult = null;
    this._turboStartZoneFill = null;
    this._turboStartResultEl = null;
    this._turboStartTimerEl = null;

    // CYCLE 36: Combo multiplier
    this._comboMultiplier = 1.0;
    this._comboTimer = 0;
    this._comboMaxTimer = 4.0;
    this._comboSources = { drift: false, slipstream: false, boost: false };
    this._comboDisplayEl = null;
    this._comboFillEl = null;
    this._comboValueEl = null;

    // CYCLE 36: Ambient embers
    this._emberContainer = null;
    this._emberSpawnTimer = 0;

    // CYCLE 36: Track progress ring
    this._progressRingEl = null;
    this._progressRingFill = null;
    this._progressRingLapEl = null;

    // CYCLE 36: AI rubberbanding
    this._aiRubberbandEl = null;
    this._aiRubberbandState = '';

    // CYCLE 36: Neon track signs
    this._neonSigns = [];
    this._neonSignTimer = 0;

    // CYCLE 36: Shortcut detection
    this._shortcutsDetected = 0;

    // CYCLE 40: Neon grid ground plane
    this._neonGridCanvas = null;
    this._neonGridCtx = null;
    this._neonGridOffset = 0;

    // CYCLE 40: Speed blur radial overlay
    this._speedBlurOverlay = null;

    // CYCLE 40: Spark trail on boost
    this._boostSparkTrail = [];
    this._boostSparkTimer = 0;

    // CYCLE 40: Drift angle meter
    this._driftAngleEl = null;

    // CYCLE 40: Lap time delta (current vs best)
    this._lapDeltaEl = null;
    this._currentLapElapsed = 0;

    // CYCLE 40: Proximity alert flash
    this._proximityFlashEl = null;
    this._proximityFlashTimer = 0;

    // CYCLE 40: Nitro flame aura
    this._nitroAuraEl = null;
  }
  
  _setupInputListeners() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('keydown', this._onEscapeKeyDown);
  }
  
  _removeInputListeners() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('keydown', this._onEscapeKeyDown);
  }
  
  _handleKeyDown(e) {
    switch(e.code) {
      case 'KeyW': case 'ArrowUp': 
        this._keys.throttle = true; 
        if (window.__engine && window.__engine.input) window.__engine.input._setAction('throttle', 1);
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
        this._keys.boost = true;
        this._activateBoost();
        break;
      case 'KeyV':
        this._toggleRearView();
        break;
      case 'KeyB':
        this._toggleRearView();
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
        this._keys.boost = false;
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
    
    this._setupInputListeners();
    
    try { this._createSky(); } catch (e) { console.error('[RaceScene] Sky failed:', e); }
    try { this._createLights(); } catch (e) { console.error('[RaceScene] Lights failed:', e); }
    try { await this._createTrack(); } catch (e) { console.error('[RaceScene] Track failed:', e); }
    
    // AAA FIX: Position vehicle at correct start location AFTER track is built
    this._positionVehicleAtStart();
    
    try {
      const spawned = await this._spawnBarrelVehicle(payload);
      if (!spawned) {
        this._createVehicle();
        this._positionVehicleAtStart(); // Re-position after fallback creation
      }
    } catch (e) {
      this._createVehicle();
      this._positionVehicleAtStart();
    }
    
    try { this._createScenery(); } catch (e) { console.error('[RaceScene] Scenery failed:', e); }
    try { this._createHUDElements(); } catch (e) { console.error('[RaceScene] HUD failed:', e); }
    
    // AAA FIX: Set camera to follow from behind start position
    if (this._camera) {
      var camOffset = new THREE.Vector3(0, 8, -15);
      if (this._trackData && this._trackData.startPos) {
        this._camera.position.copy(this._trackData.startPos).add(camOffset);
        var lookTarget = this._trackData.startPos.clone();
        if (this._trackData.startTan) lookTarget.add(this._trackData.startTan.clone().multiplyScalar(20));
        this._camera.lookAt(lookTarget);
      } else {
        this._camera.position.set(0, 8, -15);
        this._camera.lookAt(0, 0, 10);
      }
    }
    
    // CYCLE 27: Initialize AI opponents for minimap
    this._initAIOpponents();
    
    // CYCLE 29: Create item boxes on track
    this._createItemBoxes();
    // CYCLE 30: Create boost pad zones
    this._createBoostPads();
    // CYCLE 34: Setup new systems
    this._setupCycle34Systems();
    // CYCLE 35: Setup new systems
    this._setupCycle35Systems();
    // CYCLE 36: Setup new systems
    this._setupCycle36Systems();
    
    this._state.running = true;
    console.log('[RaceScene] Mounted' + (this._useBarrelVehicle ? ' +BARREL' : ' +FALLBACK'));
    
    // Start countdown sequence
    this._startCountdown();
    
    if (window.__engine && window.__engine.bus) {
      window.__engine.bus.emit('race:sceneReady', { scene: this });
      window.__engine.bus.once('race:go', () => {
        this._state.raceStarted = true;
        this._barrelVehicleWatchdogStart = this._clock.getElapsedTime();
      });
    }
  }
  
  _startCountdown() {
    var self = this;
    var values = ['3', '2', '1', 'GO!'];
    var idx = 0;
    
    // BUG FIX: Show the HUD when countdown starts (not during mount)
    if (this._hudElement) {
      this._hudElement.classList.add('visible');
    }
    
    function showNext() {
      if (idx < values.length) {
        self._showCountdown(values[idx]); if (idx === 0) self._showLetterbox(4.5);
        idx++;
        setTimeout(showNext, idx <= 3 ? 1000 : 800);
      } else {
        self._hideCountdown();
        self._state.countdown = false;
        self._state.raceStarted = true;
        // CYCLE 36: Trigger turbo start window after countdown
        self._triggerTurboStart();
        if (window.__engine && window.__engine.bus) {
          window.__engine.bus.emit('race:go', {});
        }
      }
    }
    
    this._state.countdown = true;
    this._initLapTiming();
    setTimeout(showNext, 500);
  }
  
  _applyRendererOptimizations() {
    if (!this._renderer) return;
    this._renderer.shadowMap.enabled = false;
    const pixelRatio = Math.min(window.devicePixelRatio, 1.5);
    this._renderer.setPixelRatio(pixelRatio);
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
        this._barrelVehicle = module.spawn(entry, this._vehicleContext, [0, 1, -this._trackLength / 2 + 15]);
        if (!this._barrelVehicle || !this._barrelVehicle.physicsBody) return false;
        
        this._useBarrelVehicle = true;
        window.__raceScene._barrelVehicle = this._barrelVehicle;
        this._barrelVehicleWatchdogStart = this._clock.getElapsedTime();
        this._barrelVehicleWatchdogActive = true;
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  async unmount() {
    this._state.running = false;
    this._paused = false;
    this._removePauseOverlay();
    this._removeInputListeners();
    
    // CYCLE 28: Dispose AI 3D meshes
    if (this._aiOpponents) {
      for (var a = 0; a < this._aiOpponents.length; a++) {
        if (this._aiOpponents[a].mesh && this._scene) {
          this._scene.remove(this._aiOpponents[a].mesh);
          this._disposeObject(this._aiOpponents[a].mesh);
        }
      }
    }
    this._aiOpponents = [];
    
    // CYCLE 29: Dispose item boxes
    if (this._itemBoxes) {
      for (var ib = 0; ib < this._itemBoxes.length; ib++) {
        if (this._itemBoxes[ib].mesh && this._scene) {
          this._scene.remove(this._itemBoxes[ib].mesh);
          this._disposeObject(this._itemBoxes[ib].mesh);
        }
      }
    }
    this._itemBoxes = [];
    
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
    
    if (this._hudElement && this._hudElement.parentNode) {
      this._hudElement.parentNode.removeChild(this._hudElement);
    }
    this._hudElement = null;
    
    // Cleanup boost overlay
    if (this._boostOverlay && this._boostOverlay.parentNode) {
      this._boostOverlay.parentNode.removeChild(this._boostOverlay);
      this._boostOverlay = null;
    }
    
    // Cleanup collision flash
    if (this._collisionFlash && this._collisionFlash.parentNode) {
      this._collisionFlash.parentNode.removeChild(this._collisionFlash);
      this._collisionFlash = null;
    }
    
    // Cleanup tire marks
    if (this._tireMarkGeometry) {
      this._tireMarkGeometry.geometry.dispose();
      this._tireMarkGeometry.material.dispose();
      this._tireMarkGeometry = null;
    }
    this._tireMarks = [];
    this._boostPips = [];
    this._boostBarFill = null;
    
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
    if (!this._state.running) return;
    if (this._paused) return;
    
    if (this._useBarrelVehicle && this._barrelVehicleWatchdogActive) {
      const timeSinceSpawn = this._clock.getElapsedTime() - this._barrelVehicleWatchdogStart;
      const currentSpeed = this._barrelVehicle ? this._barrelVehicle.speedKmh : 0;
      if (timeSinceSpawn > 4 && Math.abs(currentSpeed) < 0.5 && this._state.raceStarted) {
        this._switchToFallbackVehicle();
      }
    }
    
    if (this._useBarrelVehicle && this._barrelVehicle) {
      this._updateBarrelVehicle(dt);
    } else if (this._vehicle) {
      this._updateFallbackVehicle(dt);
    }
    
    this._updateBoost(dt);
    this._updateTireMarks(dt);
    this._updateCamera(dt);
    this._updateHUDDirect(dt);
    this._updateSpeedLines(dt);
    this._updateDriftSmoke(dt);
    this._updateFPSCounter(dt);
    this._checkLapCompletion();
    // CYCLE 27: Update AI + proximity
    this._updateAIOpponents(dt);
    this._checkProximityWarning();
    // CYCLE 29: Update item boxes
    this._updateItemBoxes(dt);
    // CYCLE 30: New systems
    this._updateBoostPads(dt);
    this._updateDriftScore(dt);
    this._updateParticleTrail(dt);
    // CYCLE 31: New systems
    this._updateRearView(dt);
    this._updateSectorProgress();
    this._updateFinishCelebration(dt);
    // CYCLE 34: New systems
    this._updateDynamicVignette();
    this._updateStandingsTower();
    this._updateTachometer(dt);
    this._updateWeatherRain(dt);
    this._updateHazardZones();
    this._updateWrongWay(dt);
    // CYCLE 35: New systems
    this._updateSlipstream(dt);
    this._updateRaceStats(dt);
    this._updateSpeedEdgeTint();
    this._updateLensFlare();
    this._updateRPMGlow();
    this._updateGhostTrail();
    this._updateIceZones();
    this._updateTireSmokeEnhanced();
    // CYCLE 36: New systems
    this._updateTurboStart(dt);
    this._updateComboMultiplier(dt);
    this._updateAmbientEmbers(dt);
    this._updateTrackProgressRing();
    this._updateAIRubberband();
    this._updateNeonTrackSigns(dt);
    this._updateRaceLineGuide();

    // CYCLE 37: Update new visual systems
    this._updateMotionBlur();
    this._updateNeonGlow();
    this._updateScanlineEffect();
    this._updateDriftSparks(dt);
    this._updateWheelSpin();
    this._updateBoostChain(dt);
    this._updateEnergyBar();
    this._updateHUDCornerFrame();
    this._applyChromaticSpeedText();

    // CYCLE 38: Update new systems
    this._updateLightningFlash(dt);
    this._updateLetterbox(dt);
    this._updateAfterburner(dt);
    this._updateHoloShimmer(dt);
    this._updateUnderglow(dt);
    this._updateChromaticAberration();
    this._updateVehicleHeadlights();
    this._updateBestLapCelebration(dt);
    this._updatePositionHistory(dt);
    this._updateCheckpointBonus(dt);
    this._updateContextualShake(dt);
    this._updateCameraDutch(dt);
    // CYCLE 39: Update new systems
    this._updateSpeedLinesOverlay();
    this._updateTrackEdgeGlow(dt);
    this._updateExhaustParticles(dt);
    this._updateLowHealthPulse(dt);
    this._updatePowerupBurst(dt);
    this._updateRaceProgressDisplay();
    this._updateFinishSlowMo(dt);
    this._updateMinimapPlayerDot();
    this._updateComboBreak(dt);
    this._updateSpeedZone(dt);
    this._updateTireScreechVisual();
    // CYCLE 40: Update new systems
    this._updateNeonGrid(dt);
    this._updateSpeedBlurOverlay();
    this._updateBoostSparkTrail(dt);
    this._updateDriftAngleMeter();
    this._updateLapTimeDelta(dt);
    this._updateProximityFlash(dt);
    this._updateNitroAura();
  }
  
  // === CYCLE 25 NEW FEATURES ===
  
  // === CYCLE 26: BOOST/NITRO SYSTEM ===
  _activateBoost() {
    if (this._boostActive || this._boostCharges <= 0 || !this._state.raceStarted) return;
    this._boostActive = true;
    this._boostTimer = this._boostDuration;
    this._boostCharges--;
    this._updateBoostHUD();
    
    // Show edge glow overlay
    if (!this._boostOverlay) {
      this._boostOverlay = document.createElement('div');
      this._boostOverlay.className = 'hud-boost-active-overlay';
      document.body.appendChild(this._boostOverlay);
    }
    this._boostOverlay.classList.add('active');
    
    // Store original FOV
    if (this._camera) this._originalFOV = this._camera.fov;
    
    // Play boost sound via ProceduralAudio if available
    if (window.__engine && window.__engine.audio) {
      try { window.__engine.audio.playSFX('boost'); } catch(e) {}
    }
    
    // CYCLE 35: Cinematic flash
    if (this._boostCinematicFlash) {
      this._boostCinematicFlash.classList.remove('flash');
      void this._boostCinematicFlash.offsetWidth;
      this._boostCinematicFlash.classList.add('flash');
    }
    
    // CYCLE 37: Boost chain + burst + event
    this._addBoostChain();
    this._triggerBoostBurst();
    this._addRaceEvent('BOOST #' + (this._boostMaxCharges - this._boostCharges), 'boost');
    console.log('[RaceScene] Boost activated! Charges remaining:', this._boostCharges);
  }
  
  _updateBoost(dt) {
    if (this._boostActive) {
      this._boostTimer -= dt;
      
      // FOV zoom during boost
      if (this._camera) {
        var targetFOV = this._originalFOV + 15;
        this._camera.fov += (targetFOV - this._camera.fov) * 0.1;
        this._camera.updateProjectionMatrix();
      }
      
      // Speed lines intensify during boost
      if (this._speedLinesMesh) {
        this._speedLinesMesh.material.opacity = Math.min(0.7, this._speedLinesMesh.material.opacity + 0.02);
      }
      
      if (this._boostTimer <= 0) {
        // Boost ended
        this._boostActive = false;
        this._boostTimer = 0;
        
        // Restore FOV
        if (this._camera) {
          this._camera.fov += (this._originalFOV - this._camera.fov) * 0.15;
          this._camera.updateProjectionMatrix();
        }
        
        // Hide edge glow
        if (this._boostOverlay) this._boostOverlay.classList.remove('active');
        
        console.log('[RaceScene] Boost ended');
      }
    } else {
      // Refill boost charges over time
      if (this._state.raceStarted && this._boostCharges < this._boostMaxCharges) {
        this._boostRefillTimer += dt;
        if (this._boostRefillTimer >= this._boostRefillInterval) {
          this._boostRefillTimer = 0;
          this._boostCharges = Math.min(this._boostMaxCharges, this._boostCharges + 1);
          this._updateBoostHUD();
          console.log('[RaceScene] Boost charge refilled:', this._boostCharges);
        }
        // Update boost bar fill with refill progress
        if (this._boostBarFill) {
          var refillPct = (this._boostRefillTimer / this._boostRefillInterval) * 100;
          this._boostBarFill.style.width = refillPct + '%';
        }
      }
      
      // Restore FOV smoothly
      if (this._camera && Math.abs(this._camera.fov - this._originalFOV) > 0.5) {
        this._camera.fov += (this._originalFOV - this._camera.fov) * 0.1;
        this._camera.updateProjectionMatrix();
      }
    }
  }
  
  _updateBoostHUD() {
    for (var i = 0; i < this._boostPips.length; i++) {
      if (i < this._boostCharges) {
        this._boostPips[i].classList.add('filled');
        this._boostPips[i].classList.remove('active');
      } else {
        this._boostPips[i].classList.remove('filled', 'active');
      }
    }
    // Mark active pip if boosting
    if (this._boostActive && this._boostCharges < this._boostPips.length) {
      this._boostPips[this._boostCharges].classList.add('active');
    }
  }
  
  // === CYCLE 26: TIRE MARKS / TRACK TRAILS ===
  _updateTireMarks(dt) {
    var isDrifting = this._keys.drift && this._state.speed > 5;
    var veh = this._vehicle;
    if (!veh) return;
    
    if (isDrifting) {
      // Add tire mark segments
      var leftWheelOffset = new THREE.Vector3(-0.9, 0.02, -1.2);
      var rightWheelOffset = new THREE.Vector3(0.9, 0.02, -1.2);
      
      leftWheelOffset.applyQuaternion(veh.quaternion).add(veh.position);
      rightWheelOffset.applyQuaternion(veh.quaternion).add(veh.position);
      
      this._tireMarks.push({
        left: leftWheelOffset.clone(),
        right: rightWheelOffset.clone(),
        time: this._clock.getElapsedTime()
      });
      
      // Trim oldest marks if over limit
      while (this._tireMarks.length > this._tireMarkMaxSegments) {
        this._tireMarks.shift();
      }
      
      // Update visual
      this._drawTireMarks();
    }
    
    // Fade and remove old tire marks
    var now = this._clock.getElapsedTime();
    while (this._tireMarks.length > 0 && (now - this._tireMarks[0].time) > this._tireMarkFadeTime) {
      this._tireMarks.shift();
    }
  }
  
  _drawTireMarks() {
    // Remove old geometry
    if (this._tireMarkGeometry) {
      this._scene.remove(this._tireMarkGeometry);
      this._tireMarkGeometry.geometry.dispose();
      this._tireMarkGeometry.material.dispose();
      this._tireMarkGeometry = null;
    }
    
    if (this._tireMarks.length < 2) return;
    
    var positions = [];
    var alphas = [];
    var now = this._clock.getElapsedTime();
    
    for (var i = 1; i < this._tireMarks.length; i++) {
      var prev = this._tireMarks[i - 1];
      var curr = this._tireMarks[i];
      var age = now - curr.time;
      var alpha = Math.max(0, 1 - age / this._tireMarkFadeTime) * 0.5;
      
      // Left tire mark quad
      positions.push(
        prev.left.x, prev.left.y, prev.left.z,
        curr.left.x, curr.left.y, curr.left.z
      );
      alphas.push(alpha, alpha);
      
      // Right tire mark quad
      positions.push(
        prev.right.x, prev.right.y, prev.right.z,
        curr.right.x, curr.right.y, curr.right.z
      );
      alphas.push(alpha, alpha);
    }
    
    if (positions.length === 0) return;
    
    var geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    var mat = new THREE.LineBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.6 });
    this._tireMarkGeometry = new THREE.LineSegments(geom, mat);
    this._tireMarkGeometry.position.y = 0.01; // Slightly above track surface
    this._scene.add(this._tireMarkGeometry);
  }
  
  // === CYCLE 26: COLLISION SCREEN SHAKE ===
  _triggerCollisionShake(speed) {
    var intensity = Math.min(1.0, Math.abs(speed) / 60) * 0.8;
    this._shakeIntensity = Math.max(this._shakeIntensity, intensity);
    
    // Show collision flash
    if (!this._collisionFlash) {
      this._collisionFlash = document.createElement('div');
      this._collisionFlash.className = 'hud-collision-flash';
      document.body.appendChild(this._collisionFlash);
    }
    this._collisionFlash.classList.add('active');
    setTimeout(function() {
      if (this._collisionFlash) this._collisionFlash.classList.remove('active');
    }.bind(this), 150);
  }
  
  _updateSpeedLines(dt) {
    var speed = this._state.speed || 0;
    var threshold = 40;
    if (!this._speedLinesMesh) {
      var geom = new THREE.BufferGeometry();
      var positions = new Float32Array(60 * 3);
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      var mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
      this._speedLinesMesh = new THREE.LineSegments(geom, mat);
      if (this._scene) this._scene.add(this._speedLinesMesh);
    }
    var mesh = this._speedLinesMesh;
    var positions = mesh.geometry.attributes.position.array;
    var opacity = Math.max(0, (speed - threshold) / 60) * 0.4;
    mesh.material.opacity = opacity;
    if (opacity > 0.01 && this._camera) {
      var cam = this._camera;
      var dir = new THREE.Vector3();
      cam.getWorldDirection(dir);
      for (var i = 0; i < 20; i++) {
        var offset = (Math.random() - 0.5) * 8;
        var dist = 8 + Math.random() * 25;
        var len = 2 + speed * 0.08;
        var idx = i * 3;
        var startX = cam.position.x + dir.x * dist - dir.z * offset;
        var startZ = cam.position.z + dir.z * dist + dir.x * offset;
        positions[idx] = startX;
        positions[idx + 1] = cam.position.y + (Math.random() - 0.5) * 4;
        positions[idx + 2] = startZ;
        positions[idx + 3] = startX + dir.x * len;
        positions[idx + 4] = positions[idx + 1] + (Math.random() - 0.5) * 0.5;
        positions[idx + 5] = startZ + dir.z * len;
      }
      mesh.geometry.attributes.position.needsUpdate = true;
    }
    mesh.visible = opacity > 0.01;
  }
  
  _updateDriftSmoke(dt) {
    var isDrifting = this._keys.drift && this._state.speed > 5;
    if (!isDrifting) {
      if (this._driftSmokeParticles) {
        this._driftSmokeParticles.forEach(function(p) { if (p.parent) p.parent.remove(p); });
        this._driftSmokeParticles = [];
      }
      return;
    }
    if (!this._driftSmokeParticles) this._driftSmokeParticles = [];
    var veh = this._vehicle;
    if (!veh) return;
    if (Math.random() < 0.3 && this._driftSmokeParticles.length < 30) {
      var geom = new THREE.SphereGeometry(0.15 + Math.random() * 0.2, 4, 4);
      var mat = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.5 });
      var p = new THREE.Mesh(geom, mat);
      p.position.copy(veh.position);
      p.position.y += 0.1;
      p.position.x += (Math.random() - 0.5) * 0.5;
      p.position.z += (Math.random() - 0.5) * 0.5;
      p.userData = { life: 0, maxLife: 0.8 + Math.random() * 0.5, vy: 0.5 + Math.random() * 0.5 };
      if (this._scene) this._scene.add(p);
      this._driftSmokeParticles.push(p);
    }
    for (var i = this._driftSmokeParticles.length - 1; i >= 0; i--) {
      var p = this._driftSmokeParticles[i];
      p.userData.life += dt;
      var t = p.userData.life / p.userData.maxLife;
      p.material.opacity = 0.5 * (1 - t);
      p.scale.setScalar(1 + t * 2);
      p.position.y += p.userData.vy * dt;
      if (p.userData.life >= p.userData.maxLife) {
        if (p.parent) p.parent.remove(p);
        p.geometry.dispose();
        p.material.dispose();
        this._driftSmokeParticles.splice(i, 1);
      }
    }
  }
  
  _updateFPSCounter(dt) {
    this._fpsAccum = (this._fpsAccum || 0) + dt;
    this._fpsFrames = (this._fpsFrames || 0) + 1;
    if (this._fpsAccum >= 0.5) {
      var fps = Math.round(this._fpsFrames / this._fpsAccum);
      this._fpsAccum = 0;
      this._fpsFrames = 0;
      var el = document.getElementById('hud-fps-counter');
      if (!el) {
        el = document.createElement('div');
        el.id = 'hud-fps-counter';
        el.style.cssText = 'position:fixed;top:8px;right:8px;font-size:11px;font-family:monospace;color:#666;z-index:100;pointer-events:none;';
        document.body.appendChild(el);
      }
      el.textContent = fps + ' FPS';
      el.className = '';
      if (fps >= 50) el.classList.add('hud-v2-fps-good');
      else if (fps >= 30) el.classList.add('hud-v2-fps-ok');
      else el.classList.add('hud-v2-fps-bad');
    }
  }
  
  _checkLapCompletion() {
    if (!this._vehicle || !this._state.raceStarted || !this._trackData) return;
    var pos = this._vehicle.position.z;
    var totalLen = this._trackLength;
    var progress = ((pos + totalLen / 2) % totalLen) / totalLen;
    if (progress < 0) progress += 1;
    var prevProgress = this._lastLapProgress || 0;
    if (prevProgress > 0.9 && progress < 0.1) {
      this._state.lap++;
      var lapTime = this._clock.getElapsedTime() - (this._currentLapStart || this._clock.getElapsedTime());
      this._currentLapStart = this._clock.getElapsedTime();
      this._currentLapElapsed = 0;
      this._recordLapSplit(this._state.lap - 1, lapTime);
      if (this._hudRefs && this._hudRefs.lapCurrent) {
        this._hudRefs.lapCurrent.textContent = String(Math.min(this._state.lap, this._state.totalLaps));
      }
      if (this._state.lap > this._state.totalLaps) {
        this._triggerFinishCelebration();
        this._showNotification('Race Finished! Time: ' + this._formatTime(this._clock.getElapsedTime()), 'success');
        if (window.__engine && window.__engine.bus) {
          window.__engine.bus.emit('race:end', {
            result: { timeMs: this._clock.getElapsedTime() * 1000, position: 1, lapsCompleted: this._state.totalLaps, trackId: this._state.track }
          });
        }
      }
    }
    this._lastLapProgress = progress;
  }
  
  _switchToFallbackVehicle() {
    if (this._barrelVehicle && typeof this._barrelVehicle.despawn === 'function') {
      try { this._barrelVehicle.despawn(); } catch(e) {}
    }
    this._barrelVehicle = null;
    this._useBarrelVehicle = false;
    this._barrelVehicleWatchdogActive = false;
    if (!this._vehicle) this._createVehicle();
    if (this._vehicle) this._vehicle.position.set(0, 0.5, -this._trackLength / 2 + 15);
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
            window.__engine.bus.emit('player:positionUpdate', { x: pos.x, y: pos.z, rotation: this._vehicle ? this._vehicle.rotation.y : 0, opponents: [] });
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
    
    // CYCLE 30: Speed boost item timer
    if (this._speedBoostTimer > 0) {
      this._speedBoostTimer -= dt;
      if (this._speedBoostTimer <= 0) { this._speedBoostMultiplier = 1.0; }
    }
    var speedMult = this._speedBoostMultiplier || 1.0;
    
    var accelRate = 50;
    var brakeRate = 90;
    var maxSpeed = 60;
    var steerRate = 3.0;
    var maxSteerAngle = Math.PI / 4;
    var friction = 2.0;
    
    // Apply boost multiplier to max speed
    if (this._boostActive) {
      maxSpeed *= this._boostMultiplier;
      accelRate *= this._boostMultiplier; }
    // CYCLE 30: Apply speed item multiplier
    maxSpeed *= speedMult;
    accelRate *= speedMult;
    
    if (this._heading === undefined) this._heading = 0;
    
    if (this._keys.throttle && !this._keys.brake) {
      this._state.speed = Math.min(maxSpeed, this._state.speed + accelRate * dt);
    } else if (this._keys.brake && !this._keys.throttle) {
      if (this._state.speed > 0) this._state.speed = Math.max(0, this._state.speed - brakeRate * dt);
      else this._state.speed = Math.max(-maxSpeed * 0.25, this._state.speed - accelRate * dt * 0.5);
    } else {
      if (this._state.speed > 0) this._state.speed = Math.max(0, this._state.speed - friction * dt);
      else if (this._state.speed < 0) this._state.speed = Math.min(0, this._state.speed + friction * dt);
      if (Math.abs(this._state.speed) < 0.1) this._state.speed = 0;
    }
    
    var targetSteer = 0;
    if (this._keys.steerLeft) targetSteer = 1;
    if (this._keys.steerRight) targetSteer = -1;
    
    var speedFactor = Math.min(1, Math.abs(this._state.speed) / 10);
    
    if (speedFactor > 0.1) {
      this._steerInput = this._steerInput || 0;
      this._steerInput += (targetSteer - this._steerInput) * Math.min(1, steerRate * dt * 4);
      var steerAmount = this._steerInput * maxSteerAngle * speedFactor * dt;
      if (this._state.speed >= 0) this._heading += steerAmount;
      else this._heading -= steerAmount;
    }
    
    var moveDist = this._state.speed * dt;
    // Apply boost speed multiplier to movement
    if (this._boostActive) moveDist *= this._boostMultiplier;
    var dx = Math.sin(this._heading) * moveDist;
    var dz = Math.cos(this._heading) * moveDist;
    
    this._vehicle.position.x += dx;
    this._vehicle.position.z += dz;
    this._state.position += Math.abs(moveDist);
    this._vehicle.rotation.y = this._heading;
    
    var rollTarget = this._keys.drift ? this._steerInput * 0.2 : this._steerInput * 0.08;
    this._vehicleRoll = this._vehicleRoll || 0;
    this._vehicleRoll += (rollTarget - this._vehicleRoll) * 0.15;
    this._vehicle.rotation.z = this._vehicleRoll;
    this._vehicle.position.y = 0.5 + Math.sin(this._clock.getElapsedTime() * 5) * 0.02;
    
    // AAA FIX: Track boundary collision with proper bounds
    if (this._trackBounds) {
      var bounds = this._trackBounds;
      if (this._vehicle.position.x < bounds.left) {
        this._vehicle.position.x = bounds.left;
        this._triggerCollisionShake(this._state.speed);
        this._state.speed *= 0.7; // Bounce back with speed loss
        this._steerInput *= -0.5; // Slight steer correction
      }
      if (this._vehicle.position.x > bounds.right) {
        this._vehicle.position.x = bounds.right;
        this._triggerCollisionShake(this._state.speed);
        this._state.speed *= 0.7;
        this._steerInput *= -0.5;
      }
    } else {
      // Fallback: soft world bounds
      if (Math.abs(this._vehicle.position.x) > 100) { this._vehicle.position.x = Math.sign(this._vehicle.position.x) * 100; this._state.speed *= 0.5; this._triggerCollisionShake(this._state.speed); }
    }
    var trackHalfLen = this._trackLength / 2 + 10;
    if (this._vehicle.position.z > trackHalfLen || this._vehicle.position.z < -trackHalfLen) { this._vehicle.position.z = Math.sign(this._vehicle.position.z) * trackHalfLen; this._state.speed *= 0.5; this._triggerCollisionShake(this._state.speed); }
    
    if (this._state.position > this._trackLength) {
      this._state.position -= this._trackLength;
      this._state.lap++;
      if (window.__engine) window.__engine.bus.emit('player:lapCompleted', { lapNumber: this._state.lap - 1, lapTime: this._clock.getElapsedTime() });
    }
    
    if (window.__engine && window.__engine.bus) {
      var spd = Math.abs(this._state.speed) * 3.6;
      var gr = Math.min(6, Math.max(1, Math.floor(spd / 20) + 1));
      window.__engine.bus.emit('player:speedChanged', { speed: Math.abs(this._state.speed), maxSpeed: maxSpeed, speedKmh: Math.round(spd * 10) / 10 });
      window.__engine.bus.emit('player:positionChanged', { position: 1, totalRacers: 8 });
      window.__engine.bus.emit('player:gearChanged', { gear: gr });
      this._minimapUpdateTimer = (this._minimapUpdateTimer || 0) + dt;
      if (this._minimapUpdateTimer > 0.15) {
        this._minimapUpdateTimer = 0;
        window.__engine.bus.emit('player:positionUpdate', { x: this._vehicle.position.x, y: this._vehicle.position.z, rotation: this._heading, opponents: [] });
      }
    }
  }

  // SCENE CREATION
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
        this._scene.add(this._track);
        this._trackData = result;
        if (result.curve) this._trackLength = result.curve.getLength();
        return true;
      }
      return false;
    } catch (e) { return false; }
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

  // AAA FIX: Position vehicle at correct track start location
  _positionVehicleAtStart() {
    if (!this._vehicle) return;
    
    if (this._trackData && this._trackData.startPos) {
      // Barrel track: use its start position and orientation
      var startPos = this._trackData.startPos;
      var startTan = this._trackData.startTan;
      
      this._vehicle.position.copy(startPos);
      this._vehicle.position.y = 0.5; // Slight elevation above road
      
      // Orient car to face along track tangent
      if (startTan) {
        var angle = Math.atan2(startTan.x, startTan.z);
        this._vehicle.rotation.y = angle;
        this._heading = angle; // Set heading for movement
      }
      
      console.log('[RaceScene] Vehicle positioned at barrel start:', 
        'x=' + startPos.x.toFixed(1), 'z=' + startPos.z.toFixed(1));
        
      // Update track bounds from barrel curve width
      if (this._trackData.curve) {
        var barrelWidth = 18; // Default barrel track width
        this._trackBounds = { left: -barrelWidth/2 + 1.5, right: barrelWidth/2 - 1.5, length: this._trackLength };
      }
    } else {
      // Procedural straight track: position at one end facing +Z
      this._vehicle.position.set(0, 0.5, -this._trackLength / 2 + 15);
      this._vehicle.rotation.y = 0;
      this._heading = 0;
      
      console.log('[RaceScene] Vehicle positioned at procedural start: z=' + (-this._trackLength / 2 + 15).toFixed(1));
    }
    
    // Update spotlight target to face forward
    var spotlight = this._vehicle.children.find(function(c) { return c instanceof THREE.SpotLight; });
    if (spotlight && spotlight.target) {
      var forward = new THREE.Vector3(0, 0, 20);
      if (this._heading !== undefined) {
        forward.set(Math.sin(this._heading) * 20, 0, Math.cos(this._heading) * 20);
      }
      spotlight.target.position.copy(this._vehicle.position).add(forward);
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
    var wheelMat = new THREE.MeshStandardMaterial({ color: '#222233', roughness: 0.6 });
    var rimMat = new THREE.MeshStandardMaterial({ color: '#00ffff', metalness: 1, roughness: 0.2 });
    var glowMat = new THREE.MeshBasicMaterial({ color: '#00ffff', transparent: true, opacity: 0.6 });
    
    var bodyGeo = new THREE.BoxGeometry(2, 0.8, 4);
    var body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.5;
    this._vehicle.add(body);
    
    var cabinGeo = new THREE.BoxGeometry(1.6, 0.6, 2);
    var cabin = new THREE.Mesh(cabinGeo, darkMat);
    cabin.position.set(0, 1.05, -0.3);
    this._vehicle.add(cabin);
    
    var wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12);
    var wheels = new THREE.InstancedMesh(wheelGeo, wheelMat, 4);
    var rimGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.32, 8);
    var rims = new THREE.InstancedMesh(rimGeo, rimMat, 4);
    
    var wheelPositions = [[-1, 0.4, 1.3], [1, 0.4, 1.3], [-1, 0.4, -1.3], [1, 0.4, -1.3]];
    var mat4 = new THREE.Matrix4();
    wheelPositions.forEach(function(pos, i) {
      mat4.makeRotationFromEuler(new THREE.Euler(0, 0, Math.PI / 2));
      mat4.setPosition(pos[0], pos[1], pos[2]);
      wheels.setMatrixAt(i, mat4);
      rims.setMatrixAt(i, mat4);
    });
    this._vehicle.add(wheels);
    this._vehicle.add(rims);
    
    var underglowGeo = new THREE.BoxGeometry(2.2, 0.05, 4.2);
    var underglow = new THREE.Mesh(underglowGeo, glowMat);
    underglow.position.y = 0.15;
    this._vehicle.add(underglow);
    
    var lightGeo = new THREE.CircleGeometry(0.12, 8);
    var headMat = new THREE.MeshBasicMaterial({ color: '#ffffaa' });
    var tailMat = new THREE.MeshBasicMaterial({ color: '#ff0000' });
    [-0.6, 0.6].forEach(function(x) {
      var hl = new THREE.Mesh(lightGeo, headMat);
      hl.position.set(x, 0.5, 2.01);
      this._vehicle.add(hl);
      var tl = new THREE.Mesh(lightGeo, tailMat);
      tl.position.set(x, 0.5, -2.01);
      tl.rotation.y = Math.PI;
      this._vehicle.add(tl);
    }.bind(this));
    
    // Position will be set by _positionVehicleAtStart() after track loads
    this._vehicle.position.set(0, 0.5, 0);
    this._scene.add(this._vehicle);
    
    var spotlight = new THREE.SpotLight('#ffffcc', 2, 40, Math.PI / 6, 0.5);
    spotlight.position.set(0, 2, 2);
    spotlight.target.position.set(0, 0, 15);
    this._vehicle.add(spotlight);
    this._vehicle.add(spotlight.target);
  }

  _createScenery() {
    var scenery = new THREE.Group();
    scenery.name = 'scenery';
    
    var bldgCount = 50;
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
    
    // CYCLE 29: Enhanced neon signs with more variety + glow
    var neonSigns = [
      { text: 'RACE', color: '#ff00ff', z: -200 }, { text: 'ZONE', color: '#00ffff', z: 0 },
      { text: 'KART', color: '#ffff00', z: 200 }, { text: 'GO!', color: '#00ff00', z: 400 },
      { text: 'NEON', color: '#ff4488', z: -500 }, { text: 'DRIFT', color: '#8844ff', z: -350 },
      { text: 'TURBO', color: '#ff8800', z: 600 }, { text: 'BOOST', color: '#00ffaa', z: 100 }
    ];
    neonSigns.forEach(function(sign, idx) {
      var signCanvas = document.createElement('canvas');
      signCanvas.width = 256; signCanvas.height = 96;
      var sCtx = signCanvas.getContext('2d');
      sCtx.shadowColor = sign.color; sCtx.shadowBlur = 20;
      sCtx.fillStyle = sign.color;
      sCtx.font = 'bold 72px Arial, sans-serif';
      sCtx.textAlign = 'center'; sCtx.textBaseline = 'middle';
      sCtx.fillText(sign.text, 128, 48);
      sCtx.shadowBlur = 0; sCtx.fillStyle = '#ffffff'; sCtx.globalAlpha = 0.5;
      sCtx.fillText(sign.text, 128, 48);
      var signTexture = new THREE.CanvasTexture(signCanvas);
      var signGeo = new THREE.PlaneGeometry(12, 4.5);
      var signMat = new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, side: THREE.DoubleSide });
      var signMesh = new THREE.Mesh(signGeo, signMat);
      var signSide = idx % 2 === 0 ? -1 : 1;
      signMesh.position.set(signSide * 18, 12 + Math.random() * 8, sign.z);
      signMesh.rotation.y = signSide * Math.PI / 4;
      scenery.add(signMesh);
      var signLight = new THREE.PointLight(sign.color, 0.8, 25);
      signLight.position.set(signSide * 17, 12, sign.z);
      scenery.add(signLight);
    });
    
    // CYCLE 29: Ground-level neon strip lights
    var stripCount = 80;
    var stripGeo = new THREE.BoxGeometry(0.3, 0.1, 3);
    var strips = new THREE.InstancedMesh(stripGeo, new THREE.MeshBasicMaterial({ color: '#ff00ff' }), stripCount);
    var strips2 = new THREE.InstancedMesh(stripGeo, new THREE.MeshBasicMaterial({ color: '#00ffff' }), stripCount);
    for (var si = 0; si < stripCount; si++) {
      var sz = (si / stripCount) * this._trackLength - this._trackLength / 2;
      matrix.setPosition(-(this._trackWidth / 2 + 1.5), 0.05, sz);
      strips.setMatrixAt(si, matrix);
      matrix.setPosition(this._trackWidth / 2 + 1.5, 0.05, sz);
      strips2.setMatrixAt(si, matrix);
    }
    scenery.add(strips); scenery.add(strips2);
    
    // CYCLE 29: Fog planes for atmosphere
    for (var fi = 0; fi < 10; fi++) {
      var fogCanvas = document.createElement('canvas');
      fogCanvas.width = 128; fogCanvas.height = 128;
      var fCtx = fogCanvas.getContext('2d');
      var fGrad = fCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
      fGrad.addColorStop(0, 'rgba(100, 50, 150, 0.12)');
      fGrad.addColorStop(1, 'rgba(100, 50, 150, 0)');
      fCtx.fillStyle = fGrad;
      fCtx.fillRect(0, 0, 128, 128);
      var fogTex = new THREE.CanvasTexture(fogCanvas);
      var fogPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(30, 30),
        new THREE.MeshBasicMaterial({ map: fogTex, transparent: true, depthWrite: false, side: THREE.DoubleSide })
      );
      fogPlane.position.set((Math.random() - 0.5) * this._trackWidth * 2, 1 + Math.random() * 3, (fi / 10) * this._trackLength - this._trackLength / 2);
      fogPlane.rotation.x = -Math.PI / 2;
      scenery.add(fogPlane);
    }
    
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
    scenery.add(poles); scenery.add(lamps);
    this._scene.add(scenery);
    console.log('[RaceScene] Enhanced scenery: ' + bldgCount + ' buildings, ' + neonSigns.length + ' neon signs, fog planes, ground strips');
  }

  // HUD SYSTEM
  _createHUDElements() {
    if (this._hudElement && this._hudElement.parentNode) this._hudElement.parentNode.removeChild(this._hudElement);
    
    // BUG FIX: Remove any existing #game-hud created by hud.js system to prevent double HUD
    var oldHud = document.getElementById('game-hud');
    if (oldHud && oldHud.parentNode) oldHud.parentNode.removeChild(oldHud);
    // Also remove any previous race HUD root
    var oldRoot = document.getElementById('game-hud-root');
    if (oldRoot && oldRoot.parentNode) oldRoot.parentNode.removeChild(oldRoot);
    
    var hud = document.createElement('div');
    hud.className = 'game-hud';
    hud.id = 'game-hud-root';
    
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
    var rc = document.createElement('div'); rc.className = 'racers-count'; rc.id = 'hud-racers-count'; rc.textContent = '/ 8';
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
    var shf = document.createElement('div'); shf.className = 'bar-fill shield-fill'; shf.id = 'hud-shield-bar'; shf.style.width = '100%';
    var shv = document.createElement('span'); shv.className = 'bar-value'; shv.id = 'hud-shield-value'; shv.textContent = '100';
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
    
    // Boost panel (NEW: Cycle 26)
    var bp = document.createElement('div'); bp.className = 'hud-panel hud-boost-panel';
    var bl = document.createElement('span'); bl.className = 'hud-boost-label'; bl.textContent = 'NITRO';
    var bps = document.createElement('div'); bps.className = 'hud-boost-pips';
    this._boostPips = [];
    for (var bi = 0; bi < 3; bi++) {
      var pip = document.createElement('div'); pip.className = 'hud-boost-pip filled';
      bps.appendChild(pip);
      this._boostPips.push(pip);
    }
    var bbc = document.createElement('div'); bbc.className = 'hud-boost-bar-container';
    this._boostBarFill = document.createElement('div'); this._boostBarFill.className = 'hud-boost-bar-fill'; this._boostBarFill.style.width = '0%';
    bbc.appendChild(this._boostBarFill);
    bp.appendChild(bl); bp.appendChild(bps); bp.appendChild(bbc); hud.appendChild(bp);
    
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
    
    // Minimap
    var mmc = document.createElement('div'); mmc.className = 'hud-minimap-container'; mmc.id = 'hud-minimap-container';
    var mmcv = document.createElement('canvas'); mmcv.id = 'minimap-canvas'; mmcv.width = 150; mmcv.height = 150;
    mmcv.style.cssText = 'width:150px;height:150px;border-radius:8px;background:rgba(0,0,0,0.5);';
    mmc.appendChild(mmcv); hud.appendChild(mmc);
    
    // CYCLE 30: Drift score display
    var dsd = document.createElement('div'); dsd.className = 'hud-drift-score'; dsd.id = 'hud-drift-score';
    var dsl = document.createElement('div'); dsl.className = 'drift-score-label'; dsl.textContent = 'DRIFT';
    var dsv = document.createElement('div'); dsv.className = 'drift-score-value'; dsv.id = 'hud-drift-value'; dsv.textContent = '0';
    dsd.appendChild(dsl); dsd.appendChild(dsv); hud.appendChild(dsd);
    this._driftDisplayEl = dsv;
    
    var dce = document.createElement('div'); dce.className = 'hud-drift-combo'; dce.id = 'hud-drift-combo';
    dce.textContent = 'x1 COMBO';
    hud.appendChild(dce);
    this._driftComboEl = dce;
    
    // CYCLE 30: Total race score
    var tsd = document.createElement('div'); tsd.className = 'hud-total-score'; tsd.id = 'hud-total-score';
    var tsl = document.createElement('span'); tsl.className = 'total-score-label'; tsl.textContent = 'SCORE';
    var tsv = document.createElement('span'); tsv.className = 'total-score-value'; tsv.id = 'hud-total-score-value'; tsv.textContent = '0';
    tsd.appendChild(tsl); tsd.appendChild(tsv); hud.appendChild(tsd);
    
    // CYCLE 31: Sector progress display
    var spd = document.createElement('div'); spd.className = 'hud-sector-display'; spd.id = 'hud-sector-display';
    for (var si = 0; si < 4; si++) {
      var sm = document.createElement('div'); sm.className = 'sector-marker';
      sm.innerHTML = '<span class="sector-num">S' + (si+1) + '</span>';
      spd.appendChild(sm);
    }
    hud.appendChild(spd);
    
    document.body.appendChild(hud);
    this._hudElement = hud;
    
    this._hudRefs = { speedValue: sv, speedBar: sb, gearValue: gv, positionNumber: pn, positionSuffix: ps, positionChange: pc, racersCount: rc, lapCurrent: lcur, lapTotal: ltot, lapProgress: lbp, timerDisplay: td, itemBox: ib, itemIcon: ii, itemStatus: ist, statusPanel: stp, shieldBar: shf, shieldValue: shv, healthBar: hef, healthValue: hev, countdown: cd, countdownNumber: cdn, notifications: nf, lapTimes: ltm, minimapCanvas: mmcv };
    
    window.__hud = { element: hud, refs: this._hudRefs, update: function(d) { this._updateHUDData(d); }.bind(this), showCountdown: function(v) { this._showCountdown(v); }.bind(this), hideCountdown: function() { this._hideCountdown(); }.bind(this), showNotification: function(m, t) { this._showNotification(m, t); }.bind(this), setItem: function(it) { this._setItem(it); }.bind(this) };
  }
  
  _updateHUDDirect(dt) {
    if (!this._hudRefs) return;
    var speedKmh = Math.abs(this._state.speed) * 3.6;
    var maxSpeed = 60;
    if (this._hudRefs.speedValue) { this._hudRefs.speedValue.textContent = String(Math.round(speedKmh)); var cls = speedKmh < 20 ? 'low' : speedKmh < 40 ? 'medium' : speedKmh < 55 ? 'high' : 'critical'; this._hudRefs.speedValue.className = 'speed-value ' + cls; }
    if (this._hudRefs.speedBar) { var pct = Math.min(100, (speedKmh / maxSpeed) * 100); this._hudRefs.speedBar.style.width = pct + '%'; }
    if (this._hudRefs.gearValue) { var gear = speedKmh < 1 ? 'N' : String(Math.min(6, Math.max(1, Math.floor(speedKmh / 20) + 1))); this._hudRefs.gearValue.textContent = gear; var gi = this._hudRefs.gearValue.parentElement; if (gi) gi.className = 'gear-indicator gear-' + gear; }
    if (this._hudRefs.lapCurrent) this._hudRefs.lapCurrent.textContent = String(Math.min(this._state.lap, this._state.totalLaps));
    if (this._hudRefs.lapTotal) this._hudRefs.lapTotal.textContent = String(this._state.totalLaps);
    if (this._hudRefs.lapProgress) { var lpct = ((this._state.position % this._trackLength) / this._trackLength) * 100; this._hudRefs.lapProgress.style.width = Math.min(100, lpct) + '%'; }
    if (this._hudRefs.timerDisplay && this._state.running) this._hudRefs.timerDisplay.textContent = this._formatTime(this._clock.getElapsedTime());
    if (this._hudRefs.minimapCanvas && Math.random() < 0.1) this._drawMinimap();
    // CYCLE 30: Update total score display
    var totalScoreEl = document.getElementById('hud-total-score-value');
    if (totalScoreEl) totalScoreEl.textContent = String(Math.floor(this._totalDriftScore));
  }
  
  _updateHUDData(data) {
    if (!this._hudRefs) return;
    if (data.speed !== undefined && this._hudRefs.speedValue) this._hudRefs.speedValue.textContent = String(Math.round(data.speedKmh || data.speed * 3.6 || 0));
    if (data.position !== undefined && this._hudRefs.positionNumber) this._hudRefs.positionNumber.textContent = String(data.position);
    if (data.gear !== undefined && this._hudRefs.gearValue) this._hudRefs.gearValue.textContent = data.gear === 0 ? 'N' : String(data.gear);
  }
  
  _showCountdown(value) {
    this._showCountdownEnhanced(value);
    if (!this._hudRefs || !this._hudRefs.countdown) return;
    this._hudRefs.countdown.classList.add('active');
    this._hudRefs.countdownNumber.textContent = String(value);
    // Apply Cycle 25 enhanced countdown colors
    var cdn = this._hudRefs.countdownNumber;
    cdn.className = 'countdown-number';
    if (value === '3') cdn.classList.add('hud-v2-countdown-color-3');
    else if (value === '2') cdn.classList.add('hud-v2-countdown-color-2');
    else if (value === '1') cdn.classList.add('hud-v2-countdown-color-1');
    else if (value === 'GO!') cdn.classList.add('hud-v2-countdown-go');
  }
  
  _hideCountdown() {
    if (!this._hudRefs || !this._hudRefs.countdown) return;
    this._hudRefs.countdown.classList.remove('active');
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
  
  _drawMinimap() {
    var canvas = this._hudRefs ? this._hudRefs.minimapCanvas : null;
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    // Dark background with rounded rect
    ctx.fillStyle = 'rgba(5, 6, 10, 0.85)';
    ctx.beginPath(); ctx.roundRect(0, 0, w, h, 8); ctx.fill();
    // Border
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(1, 1, w - 2, h - 2, 7); ctx.stroke();
    // Draw track outline if track data available
    if (this._trackData && this._trackData.points && this._trackData.points.length > 2) {
      ctx.strokeStyle = 'rgba(255, 77, 46, 0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      var pts = this._trackData.points;
      var margin = 15;
      for (var i = 0; i < pts.length; i++) {
        var px = margin + (pts[i].x / (this._trackWidth * 1.5)) * (w - margin * 2);
        var py = margin + (pts[i].z / this._trackLength) * (h - margin * 2);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
    // CYCLE 27: Draw AI opponent dots on minimap
    if (this._aiOpponents.length > 0) {
      for (var a = 0; a < this._aiOpponents.length; a++) {
        var ai = this._aiOpponents[a];
        var ax = w / 2 + (ai.x / (this._trackWidth * 1.5)) * (w / 2 - 25);
        var ay = h / 2 + (ai.z / this._trackLength) * (h / 2 - 15);
        // AI dot
        ctx.fillStyle = ai.color;
        ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.arc(ax, ay, 3, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    // Player dot with glow
    var veh = this._vehicle || (this._barrelVehicle ? this._barrelVehicle.mesh : null);
    if (veh) {
      var px = w / 2 + (veh.position.x / this._trackWidth) * (w / 2 - 25);
      var py = h / 2 + (veh.position.z / this._trackLength) * (h / 2 - 15);
      // Glow
      var grad = ctx.createRadialGradient(px, py, 0, px, py, 10);
      grad.addColorStop(0, 'rgba(255, 77, 46, 0.6)');
      grad.addColorStop(1, 'rgba(255, 77, 46, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(px - 10, py - 10, 20, 20);
      // Dot
      ctx.fillStyle = '#ff4d2e';
      ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
      // Direction indicator
      var hd = this._heading || (veh.rotation ? veh.rotation.y : 0);
      ctx.strokeStyle = '#ff4d2e';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px, py);
      ctx.lineTo(px - Math.sin(hd) * 10, py - Math.cos(hd) * 10); ctx.stroke();
    }
  }
  
  _formatTime(seconds) {
    var mins = Math.floor(seconds / 60);
    var secs = Math.floor(seconds % 60);
    var ms = Math.floor((seconds % 1) * 100);
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0') + '.' + String(ms).padStart(2, '0');
  }

  _updateCamera(dt) {
    // CYCLE 30: Countdown camera shake
    if (this._countdownCameraShake > 0) {
      this._countdownCameraShake -= dt;
      var shakeAmt = this._countdownCameraShake * 0.5;
      if (this._camera) {
        this._camera.position.x += (Math.random() - 0.5) * shakeAmt;
        this._camera.position.y += (Math.random() - 0.5) * shakeAmt * 0.5;
      }
    }
    if (!this._camera) return;
    var vehiclePos = null;
    if (this._useBarrelVehicle && this._barrelVehicle && this._barrelVehicle.physicsBody) vehiclePos = this._barrelVehicle.physicsBody.position;
    else if (this._vehicle) vehiclePos = this._vehicle.position;
    else return;
    var targetPos = new THREE.Vector3(vehiclePos.x, vehiclePos.y + 5, vehiclePos.z - 12);
    this._camera.position.lerp(targetPos, 0.05);
    var lookTarget = new THREE.Vector3(vehiclePos.x, vehiclePos.y + 1, vehiclePos.z + 20);
    this._camera.lookAt(lookTarget);
    
    // Apply screen shake from collisions
    if (this._shakeIntensity > 0.01) {
      var shakeX = (Math.random() - 0.5) * this._shakeIntensity * 0.5;
      var shakeY = (Math.random() - 0.5) * this._shakeIntensity * 0.3;
      this._camera.position.x += shakeX;
      this._camera.position.y += shakeY;
      this._shakeIntensity *= Math.exp(-this._shakeDecay * dt);
      if (this._shakeIntensity < 0.01) this._shakeIntensity = 0;
    }
  }

  // === CYCLE 27: PAUSE SYSTEM ===
  
  _handleEscapeKey(e) {
    if (e.code !== 'Escape' || !this._state.running) return;
    e.preventDefault();
    e.stopPropagation();
    if (this._paused) this._resumeRace();
    else this._pauseRace();
  }
  
  _pauseRace() {
    this._paused = true;
    this._createPauseOverlay();
    if (window.__engine && window.__engine.bus) window.__engine.bus.emit('race:paused', {});
    console.log('[RaceScene] Race paused');
  }
  
  _resumeRace() {
    this._paused = false;
    this._removePauseOverlay();
    this._clock.getDelta(); // consume accumulated delta
    if (window.__engine && window.__engine.bus) window.__engine.bus.emit('race:resumed', {});
    console.log('[RaceScene] Race resumed');
  }
  
  _createPauseOverlay() {
    if (this._pauseElement) return;
    var overlay = document.createElement('div');
    overlay.id = 'race-pause-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:900;display:flex;align-items:center;justify-content:center;opacity:0;animation:pauseFadeIn 0.3s ease forwards;';
    
    var speedKmh = Math.abs(this._state.speed * 3.6);
    var elapsed = this._clock.getElapsedTime();
    
    overlay.innerHTML = '\n      <div style="position:absolute;inset:0;background:rgba(5,6,10,0.85);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);"></div>\n      <div style="position:relative;z-index:10;width:90%;max-width:480px;background:linear-gradient(165deg,rgba(20,22,32,0.98),rgba(12,14,22,0.98));border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:32px;text-align:center;">\n        <h2 style="font-size:42px;font-weight:900;font-family:Bebas Neue,Oswald,Impact,sans-serif;letter-spacing:8px;color:#fff;margin:0 0 6px 0;">PAUSED</h2>\n        <p style="font-size:13px;color:rgba(255,255,255,0.4);letter-spacing:2px;text-transform:uppercase;margin:0 0 24px 0;">Race temporarily halted</p>\n        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;padding:16px;background:rgba(0,0,0,0.25);border-radius:12px;border:1px solid rgba(255,255,255,0.06);">\n          <div><div style="font-size:9px;color:rgba(255,255,255,0.35);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px;">Speed</div><div style="font-size:18px;font-weight:700;color:#00e5ff;">' + Math.round(speedKmh) + '</div></div>\n          <div><div style="font-size:9px;color:rgba(255,255,255,0.35);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px;">Lap</div><div style="font-size:18px;font-weight:700;color:#fff;">' + this._state.lap + '/' + this._state.totalLaps + '</div></div>\n          <div><div style="font-size:9px;color:rgba(255,255,255,0.35);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px;">Time</div><div style="font-size:15px;font-weight:700;color:#fff;font-family:JetBrains Mono,monospace;">' + this._formatTime(elapsed) + '</div></div>\n        </div>\n        <div style="display:flex;flex-direction:column;gap:8px;">\n          <button id="pause-resume-btn" style="display:flex;align-items:center;justify-content:center;gap:12px;width:100%;padding:16px;background:linear-gradient(135deg,rgba(255,107,53,0.2),rgba(255,140,0,0.15));border:1px solid rgba(255,107,53,0.3);border-radius:12px;color:#fff;font-size:15px;font-weight:600;cursor:pointer;transition:all 0.2s ease;">\n            <span style="font-size:20px;">\u25B6</span> Resume Race\n          </button>\n          <button id="pause-quit-btn" style="display:flex;align-items:center;justify-content:center;gap:12px;width:100%;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;color:rgba(255,255,255,0.7);font-size:14px;font-weight:600;cursor:pointer;transition:all 0.2s ease;">\n            <span style="font-size:18px;">\u2715</span> Quit to Menu\n          </button>\n        </div>\n        <p style="font-size:12px;color:rgba(255,255,255,0.3);margin:20px 0 0 0;"><kbd style="padding:2px 8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:5px;font-size:11px;font-family:JetBrains Mono,monospace;">ESC</kbd> to resume</p>\n      </div>\n    ';
    
    // Add the CSS animation
    var styleEl = document.createElement('style');
    styleEl.textContent = '@keyframes pauseFadeIn{from{opacity:0}to{opacity:1}}';
    overlay.appendChild(styleEl);
    
    document.body.appendChild(overlay);
    this._pauseElement = overlay;
    
    // Button handlers
    var self = this;
    document.getElementById('pause-resume-btn').addEventListener('click', function() { self._resumeRace(); });
    document.getElementById('pause-quit-btn').addEventListener('click', function() {
      self._removePauseOverlay();
      self._state.running = false;
      if (window.__engine && window.__engine.bus) window.__engine.bus.emit('race:end', { result: { quit: true, timeMs: elapsed * 1000, lapsCompleted: self._state.lap - 1 } });
    });
    
    // Hover effects
    var resumeBtn = document.getElementById('pause-resume-btn');
    var quitBtn = document.getElementById('pause-quit-btn');
    if (resumeBtn) {
      resumeBtn.addEventListener('mouseenter', function() { this.style.background = 'linear-gradient(135deg, rgba(255,107,53,0.3), rgba(255,140,0,0.2))'; this.style.boxShadow = '0 4px 20px rgba(255,107,53,0.2)'; });
      resumeBtn.addEventListener('mouseleave', function() { this.style.background = 'linear-gradient(135deg, rgba(255,107,53,0.2), rgba(255,140,0,0.15))'; this.style.boxShadow = 'none'; });
    }
    if (quitBtn) {
      quitBtn.addEventListener('mouseenter', function() { this.style.background = 'rgba(239,68,68,0.1)'; this.style.borderColor = 'rgba(239,68,68,0.25)'; this.style.color = '#ef4444'; });
      quitBtn.addEventListener('mouseleave', function() { this.style.background = 'rgba(255,255,255,0.03)'; this.style.borderColor = 'rgba(255,255,255,0.06)'; this.style.color = 'rgba(255,255,255,0.7)'; });
    }
  }
  
  _removePauseOverlay() {
    if (this._pauseElement && this._pauseElement.parentNode) {
      this._pauseElement.style.opacity = '0';
      this._pauseElement.style.transition = 'opacity 0.25s ease';
      var el = this._pauseElement;
      setTimeout(function() { if (el.parentNode) el.remove(); }, 250);
    }
    this._pauseElement = null;
  }
  
  // === CYCLE 27: AI OPPONENTS (Simulated) ===
  
  _initAIOpponents() {
    this._aiOpponents = [];
    var colors = [0x00e5ff, 0xa855f7, 0x22c55e, 0xfbbf24, 0xf97316, 0x3b82f6, 0xec4899];
    var colorHexes = ['#00e5ff', '#a855f7', '#22c55e', '#fbbf24', '#f97316', '#3b82f6', '#ec4899'];
    var names = ['CYAN', 'VIOLET', 'JADE', 'GOLD', 'BLAZE', 'AZURE', 'ROSE'];
    for (var i = 0; i < this._aiCount; i++) {
      var baseSpeed = 0.25 + Math.random() * 0.35;
      var ai = {
        name: names[i] || ('AI-' + i),
        color: colorHexes[i] || '#ffffff',
        colorInt: colors[i] || 0xffffff,
        trackPos: (i + 1) * (this._trackLength / (this._aiCount + 1)),
        lateralOffset: (Math.random() - 0.5) * this._trackWidth * 0.5,
        speed: baseSpeed,
        baseSpeed: baseSpeed,
        lap: 1,
        x: 0, z: 0, heading: 0,
        mesh: null
      };
      // CYCLE 28: Create 3D kart mesh
      if (this._scene) {
        var group = new THREE.Group();
        var bodyGeo = new THREE.BoxGeometry(1.2, 0.4, 2.2);
        var bodyMat = new THREE.MeshPhongMaterial({ color: ai.colorInt, emissive: ai.colorInt, emissiveIntensity: 0.15, flatShading: true });
        var body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.35;
        group.add(body);
        var cabGeo = new THREE.BoxGeometry(0.8, 0.35, 1.0);
        var cabMat = new THREE.MeshPhongMaterial({ color: 0x111122, flatShading: true });
        var cab = new THREE.Mesh(cabGeo, cabMat);
        cab.position.set(0, 0.7, -0.1);
        group.add(cab);
        var wGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.15, 8);
        var wMat = new THREE.MeshPhongMaterial({ color: 0x222222 });
        var wPos = [[-0.65,0.2,0.7],[0.65,0.2,0.7],[-0.65,0.2,-0.7],[0.65,0.2,-0.7]];
        for (var w = 0; w < 4; w++) { var wh = new THREE.Mesh(wGeo, wMat); wh.position.set(wPos[w][0],wPos[w][1],wPos[w][2]); wh.rotation.z = Math.PI/2; group.add(wh); }
        var aiLight = new THREE.PointLight(ai.colorInt, 0.4, 6);
        aiLight.position.set(0, 1, 0);
        group.add(aiLight);
        this._scene.add(group);
        ai.mesh = group;
      }
      this._aiOpponents.push(ai);
    }
    console.log('[RaceScene] ' + this._aiCount + ' AI opponents with 3D meshes');
  }
  
  _updateAIOpponents(dt) {
    if (!this._state.raceStarted || this._aiOpponents.length === 0) return;
    var trackLen = this._trackLength;
    for (var i = 0; i < this._aiOpponents.length; i++) {
      var ai = this._aiOpponents[i];
      ai.speed += (Math.random() - 0.5) * 0.012;
      ai.speed = Math.max(0.18, Math.min(0.70, ai.speed));
      ai.trackPos += ai.speed * 60 * dt;
      if (ai.trackPos >= trackLen) { ai.trackPos -= trackLen; ai.lap++; }
      var t = ai.trackPos / trackLen;
      var angle = t * Math.PI * 2;
      var rx = this._trackWidth * 1.5;
      var rz = trackLen / (Math.PI * 2);
      var prevX = ai.x, prevZ = ai.z;
      ai.x = Math.cos(angle) * rx + ai.lateralOffset;
      ai.z = Math.sin(angle) * rz;
      ai.heading = Math.atan2(ai.x - prevX, ai.z - prevZ);
      // CYCLE 28: Update 3D mesh position
      if (ai.mesh) {
        ai.mesh.position.set(ai.x, 0, ai.z);
        ai.mesh.rotation.y = ai.heading;
      }
    }
    // CYCLE 28: Calculate player position ranking
    this._updatePositionRanking();
  }
  
  _updatePositionRanking() {
    var playerTrackPos = this._state.position || 0;
    var playerLap = this._state.lap || 1;
    var position = 1; // 1st place
    for (var i = 0; i < this._aiOpponents.length; i++) {
      var ai = this._aiOpponents[i];
      if (ai.lap > playerLap || (ai.lap === playerLap && ai.trackPos > playerTrackPos)) {
        position++;
      }
    }
    this._state.position = position;
    // CYCLE 37: Position change banner + event feed
    this._showPositionBanner(position);
    if (position === 1) this._addRaceEvent('TAKING THE LEAD!', 'pass');
    // Update HUD position display
    if (this._hudRefs && this._hudRefs.positionNumber) {
      var suffixes = ['st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th'];
      this._hudRefs.positionNumber.textContent = String(position);
      if (this._hudRefs.positionSuffix) this._hudRefs.positionSuffix.textContent = suffixes[position - 1] || 'th';
      if (this._hudRefs.racersCount) this._hudRefs.racersCount.textContent = String(this._aiCount + 1);
    }
  }
  
  _checkProximityWarning() {
    if (!this._state.raceStarted || !this._hudRefs || this._aiOpponents.length === 0) return;
    var now = Date.now();
    if (now - this._lastProximityTime < 2000) return; // cooldown 2s
    
    var playerX = 0, playerZ = 0;
    if (this._vehicle) { playerX = this._vehicle.position.x; playerZ = this._vehicle.position.z; }
    else if (this._barrelVehicle && this._barrelVehicle.physicsBody) { playerX = this._barrelVehicle.physicsBody.position.x; playerZ = this._barrelVehicle.physicsBody.position.z; }
    
    var minDist = Infinity;
    var closestAI = null;
    for (var i = 0; i < this._aiOpponents.length; i++) {
      var ai = this._aiOpponents[i];
      var dx = ai.x - playerX;
      var dz = ai.z - playerZ;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < minDist) { minDist = dist; closestAI = ai; }
    }
    
    if (minDist < 8 && closestAI) {
      this._lastProximityTime = now;
      this._showProximityWarning(closestAI, minDist);
    }
  }
  
  _showProximityWarning(ai, distance) {
    if (this._hudRefs && this._hudRefs.notifications) {
      var side = (ai.x > 0) ? 'RIGHT' : 'LEFT';
      var notif = document.createElement('div');
      notif.className = 'hud-notification warning visible proximity-warning';
      notif.innerHTML = '<span class="notif-icon">\u26A0</span><span class="notif-message">' + side + ' — ' + ai.name + ' nearby!</span>';
      this._hudRefs.notifications.appendChild(notif);
      setTimeout(function() { notif.classList.remove('visible'); setTimeout(function() { notif.remove(); }, 300); }, 1800);
    }
  }
  
  // === CYCLE 29: ITEM BOXES ON TRACK ===
  _createItemBoxes() {
    this._itemBoxes = [];
    if (!this._scene) return;
    
    var boxPositions = [];
    var trackLen = this._trackLength;
    var halfW = this._trackWidth / 2 - 3;
    
    // Place item boxes in groups of 3-4 at intervals along the track
    var groupSpacing = trackLen / 6;
    for (var g = 0; g < 6; g++) {
      var groupZ = -trackLen / 2 + groupSpacing * (g + 0.5);
      var itemsInGroup = 2 + Math.floor(Math.random() * 2);
      for (var ig = 0; ig < itemsInGroup; ig++) {
        boxPositions.push({
          x: (Math.random() - 0.5) * halfW * 1.5,
          z: groupZ + (Math.random() - 0.5) * 15
        });
      }
    }
    
    // Item types with colors
    var itemTypes = [
      { name: 'boost', color: 0x00ff88, emissive: 0x00ff44 },
      { name: 'shield', color: 0x4488ff, emissive: 0x2266ff },
      { name: 'missile', color: 0xff4444, emissive: 0xff2222 },
      { name: 'speed', color: 0xffaa00, emissive: 0xff8800 }
    ];
    
    var group = new THREE.Group();
    group.name = 'item-boxes';
    
    for (var i = 0; i < boxPositions.length; i++) {
      var pos = boxPositions[i];
      var type = itemTypes[i % itemTypes.length];
      
      // Outer rotating cube (wireframe)
      var outerGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
      var outerMat = new THREE.MeshPhongMaterial({
        color: type.color, emissive: type.emissive, emissiveIntensity: 0.5,
        wireframe: true, transparent: true, opacity: 0.7
      });
      var outerBox = new THREE.Mesh(outerGeo, outerMat);
      
      // Inner glowing cube
      var innerGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
      var innerMat = new THREE.MeshPhongMaterial({
        color: type.color, emissive: type.emissive, emissiveIntensity: 0.8,
        transparent: true, opacity: 0.9
      });
      var innerBox = new THREE.Mesh(innerGeo, innerMat);
      
      // Point light for glow
      var boxLight = new THREE.PointLight(type.color, 0.6, 8);
      
      // Question mark canvas texture
      var qCanvas = document.createElement('canvas');
      qCanvas.width = 64; qCanvas.height = 64;
      var qCtx = qCanvas.getContext('2d');
      qCtx.fillStyle = '#' + type.color.toString(16).padStart(6, '0');
      qCtx.font = 'bold 48px Arial';
      qCtx.textAlign = 'center';
      qCtx.textBaseline = 'middle';
      qCtx.fillText('?', 32, 32);
      var qTexture = new THREE.CanvasTexture(qCanvas);
      var qPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 1.2),
        new THREE.MeshBasicMaterial({ map: qTexture, transparent: true, side: THREE.DoubleSide })
      );
      
      var itemGroup = new THREE.Group();
      itemGroup.add(outerBox);
      itemGroup.add(innerBox);
      itemGroup.add(boxLight);
      itemGroup.add(qPlane);
      itemGroup.position.set(pos.x, 1.5, pos.z);
      
      this._scene.add(itemGroup);
      this._itemBoxes.push({
        mesh: itemGroup,
        outerBox: outerBox,
        innerBox: innerBox,
        type: type,
        position: pos.clone(),
        active: true,
        respawnTimer: 0
      });
    }
    
    console.log('[RaceScene] Created ' + this._itemBoxes.length + ' item boxes on track');
  }
  
  _updateItemBoxes(dt) {
    if (!this._itemBoxes || this._itemBoxes.length === 0) return;
    
    var time = this._clock.getElapsedTime();
    
    for (var i = 0; i < this._itemBoxes.length; i++) {
      var box = this._itemBoxes[i];
      
      if (!box.active) {
        // Respawn timer
        box.respawnTimer -= dt;
        if (box.respawnTimer <= 0) {
          box.active = true;
          box.mesh.visible = true;
          box.outerBox.material.opacity = 0.7;
          box.innerBox.material.opacity = 0.9;
        }
        continue;
      }
      
      // Rotate outer cube
      box.outerBox.rotation.x = time * 1.2 + i;
      box.outerBox.rotation.y = time * 0.8 + i * 0.5;
      
      // Bob up and down
      box.mesh.position.y = 1.5 + Math.sin(time * 2 + i * 1.3) * 0.3;
      
      // Pulse inner glow
      var pulse = 0.6 + Math.sin(time * 3 + i) * 0.3;
      box.innerBox.material.emissiveIntensity = pulse;
    }
    
    // Check player pickup
    if (this._itemPickupCooldown > 0) this._itemPickupCooldown -= dt;
    if (this._itemPickupCooldown <= 0) this._checkItemPickup();
  }
  
  _checkItemPickup() {
    var px = 0, pz = 0;
    if (this._vehicle) { px = this._vehicle.position.x; pz = this._vehicle.position.z; }
    else if (this._barrelVehicle && this._barrelVehicle.physicsBody) { px = this._barrelVehicle.physicsBody.position.x; pz = this._barrelVehicle.physicsBody.position.z; }
    
    for (var i = 0; i < this._itemBoxes.length; i++) {
      var box = this._itemBoxes[i];
      if (!box.active) continue;
      
      var dx = px - box.position.x;
      var dz = pz - box.position.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      
      if (dist < 3.0) {
        // Pickup!
        box.active = false;
        box.mesh.visible = false;
        box.respawnTimer = this._itemBoxRespawnTime;
        this._itemPickupCooldown = 0.5;
        
        // Apply effect based on type
        this._applyItemEffect(box.type);
        break;
      }
    }
  }
  
  _applyItemEffect(type) {
    // Show pickup notification
    if (this._hudRefs && this._hudRefs.notifications) {
      var notif = document.createElement('div');
      notif.className = 'hud-notification item-pickup visible';
      var icon = type.name === 'boost' ? '\u{1F680}' : type.name === 'shield' ? '\u{1F6E1}' : type.name === 'missile' ? '\u{1F680}' : '\u26A1';
      notif.innerHTML = '<span class="notif-icon">' + icon + '</span><span class="notif-message">' + type.name.toUpperCase() + ' picked up!</span>';
      this._hudRefs.notifications.appendChild(notif);
      setTimeout(function() { notif.classList.remove('visible'); setTimeout(function() { notif.remove(); }, 300); }, 1500);
    }
    
    switch (type.name) {
      case 'boost':
        this._boostCharges = Math.min(this._boostMaxCharges, this._boostCharges + 1);
        this._updateBoostHUD();
        break;
      case 'speed':
        // Temporary speed burst (applied via multiplier in next update)
        this._speedBoostTimer = 3.0;
        this._speedBoostMultiplier = 1.3;
        break;
      case 'shield':
        this._shieldActive = true;
        this._shieldTimer = 5.0;
        break;
      case 'missile':
        // Boost forward + shake nearby AI
        this._activateBoost();
        break;
    }
    
    // Play pickup sound
    if (window.__engine && window.__engine.audio) {
      try { window.__engine.audio.playSFX('itemPickup'); } catch(e) {}
    }
  }
  
  // === CYCLE 30: BOOST PAD ZONES ===
  _createBoostPads() {
    this._boostPads = [];
    if (!this._scene) return;
    var trackLen = this._trackLength;
    
    var padPositions = [];
    var spacing = trackLen / 7;
    for (var i = 0; i < 6; i++) {
      padPositions.push({ x: (i % 2 === 0 ? -3 : 3), z: -trackLen / 2 + spacing * (i + 1) });
    }
    
    var padGeo = new THREE.PlaneGeometry(4, 8);
    
    for (var i = 0; i < padPositions.length; i++) {
      var pos = padPositions[i];
      
      var arrowCanvas = document.createElement('canvas');
      arrowCanvas.width = 128; arrowCanvas.height = 256;
      var actx = arrowCanvas.getContext('2d');
      var grad = actx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, 'rgba(0,255,136,0.0)');
      grad.addColorStop(0.5, 'rgba(0,255,136,0.6)');
      grad.addColorStop(1, 'rgba(0,255,136,0.9)');
      actx.fillStyle = grad;
      actx.fillRect(0, 0, 128, 256);
      actx.strokeStyle = '#ffffff';
      actx.lineWidth = 4;
      actx.lineCap = 'round';
      for (var c = 0; c < 3; c++) {
        var cy = 60 + c * 60;
        actx.beginPath();
        actx.moveTo(34, cy + 30); actx.lineTo(64, cy); actx.lineTo(94, cy + 30);
        actx.stroke();
      }
      var arrowTex = new THREE.CanvasTexture(arrowCanvas);
      
      var padMat = new THREE.MeshBasicMaterial({ map: arrowTex, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
      var padMesh = new THREE.Mesh(padGeo, padMat);
      padMesh.rotation.x = -Math.PI / 2;
      padMesh.position.set(pos.x, 0.04, pos.z);
      
      var padLight = new THREE.PointLight(0x00ff88, 0.8, 12);
      padLight.position.set(pos.x, 1.5, pos.z);
      
      var postGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.5, 6);
      var postMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
      var leftPost = new THREE.Mesh(postGeo, postMat);
      leftPost.position.set(pos.x - 2.5, 0.75, pos.z);
      var rightPost = new THREE.Mesh(postGeo, postMat);
      rightPost.position.set(pos.x + 2.5, 0.75, pos.z);
      
      this._scene.add(padMesh);
      this._scene.add(padLight);
      this._scene.add(leftPost);
      this._scene.add(rightPost);
      
      this._boostPads.push({ mesh: padMesh, light: padLight, position: pos.clone(), active: true, cooldown: 0 });
    }
    console.log('[RaceScene] Created ' + this._boostPads.length + ' boost pads');
  }
  
  _updateBoostPads(dt) {
    if (!this._boostPads || this._boostPads.length === 0) return;
    var time = this._clock.getElapsedTime();
    var px = 0, pz = 0;
    if (this._vehicle) { px = this._vehicle.position.x; pz = this._vehicle.position.z; }
    else if (this._barrelVehicle && this._barrelVehicle.physicsBody) { px = this._barrelVehicle.physicsBody.position.x; pz = this._barrelVehicle.physicsBody.position.z; }
    
    for (var i = 0; i < this._boostPads.length; i++) {
      var pad = this._boostPads[i];
      var pulse = 0.5 + Math.sin(time * 3 + i * 1.5) * 0.3;
      pad.mesh.material.opacity = pulse;
      pad.light.intensity = 0.5 + Math.sin(time * 4 + i) * 0.4;
      
      if (pad.cooldown > 0) { pad.cooldown -= dt; continue; }
      
      var dx = px - pad.position.x;
      var dz = pz - pad.position.z;
      if (Math.abs(dx) < 2.5 && Math.abs(dz) < 5) {
        pad.cooldown = 3.0;
        pad.light.intensity = 3.0;
        pad.mesh.material.opacity = 1.0;
        if (!this._boostActive) this._activateBoost();
        this._showNotification('BOOST PAD! +1 Nitro', 'boost');
        this._boostCharges = Math.min(this._boostMaxCharges, this._boostCharges + 1);
        this._updateBoostHUD();
      }
    }
  }
  
  // === CYCLE 30: DRIFT SCORE SYSTEM ===
  _updateDriftScore(dt) {
    var isDrifting = this._keys.drift && this._state.speed > 8;
    var isSteering = this._keys.steerLeft || this._keys.steerRight;
    
    if (isDrifting && isSteering && this._driftCooldown <= 0) {
      this._driftTimer += dt;
      var speedBonus = Math.floor(this._state.speed * 0.5);
      this._driftScore += (dt * 100 + speedBonus * dt) * (1 + Math.floor(this._driftTimer / 2) * 0.5);
      
      if (this._driftDisplayEl) {
        this._driftDisplayEl.textContent = Math.floor(this._driftScore);
        this._driftDisplayEl.parentElement.classList.add('active');
        // CYCLE 36: Combo hook - add drift source
        if (this._driftTimer > 0.5 && this._driftScore > 0 && this._comboMultiplier < 2.0) this._addComboSource('drift');
      }
      if (this._driftComboEl && this._driftTimer > 1) {
        this._driftComboEl.textContent = 'x' + (1 + Math.floor(this._driftTimer / 2)) + ' COMBO';
        this._driftComboEl.classList.add('active');
      }
    } else {
      if (this._driftTimer > 0.5) {
        var banked = Math.floor(this._driftScore);
        if (banked > 10) {
          this._totalDriftScore += banked;
          this._showNotification('DRIFT +' + banked + ' pts!', 'drift');
          // CYCLE 37: Drift event feed
          this._addRaceEvent('DRIFT +' + banked, 'drift');
        }
      }
      this._driftScore = 0;
      this._driftTimer = 0;
      this._driftCooldown = 0.3;
      if (this._driftDisplayEl) this._driftDisplayEl.parentElement.classList.remove('active');
      if (this._driftComboEl) this._driftComboEl.classList.remove('active');
    }
    if (this._driftCooldown > 0) this._driftCooldown -= dt;
  }
  
  // === CYCLE 30: PARTICLE TRAIL SYSTEM ===
  _updateParticleTrail(dt) {
    var shouldSpawn = this._boostActive || (this._keys.drift && this._state.speed > 5);
    if (!shouldSpawn || !this._vehicle) {
      for (var i = this._trailParticles.length - 1; i >= 0; i--) {
        var p = this._trailParticles[i];
        p.userData.life += dt;
        var alpha = 1 - p.userData.life / p.userData.maxLife;
        if (alpha <= 0) {
          if (p.parent) p.parent.remove(p);
          p.geometry.dispose(); p.material.dispose();
          this._trailParticles.splice(i, 1);
        } else {
          p.material.opacity = alpha * 0.8;
          p.position.y += p.userData.vy * dt;
          p.scale.multiplyScalar(0.98);
        }
      }
      return;
    }
    
    if (this._trailParticles.length < this._trailMaxParticles && Math.random() < 0.6) {
      var color = this._boostActive ? 0x00ff88 : (this._keys.drift ? 0xff6600 : 0xff4d2e);
      var size = Math.max(0.01, 0.1 + Math.random() * 0.2);
      var geo = new THREE.SphereGeometry(size, 4, 4);
      var mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8 });
      var particle = new THREE.Mesh(geo, mat);
      var offset = new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.3 + Math.random() * 0.3, -1.5 - Math.random() * 0.5);
      offset.applyQuaternion(this._vehicle.quaternion);
      particle.position.copy(this._vehicle.position).add(offset);
      particle.userData = { life: 0, maxLife: 0.6 + Math.random() * 0.4, vy: 0.3 + Math.random() * 0.5 };
      if (this._scene) this._scene.add(particle);
      this._trailParticles.push(particle);
    }
    
    for (var i = this._trailParticles.length - 1; i >= 0; i--) {
      var p = this._trailParticles[i];
      p.userData.life += dt;
      var alpha = 1 - p.userData.life / p.userData.maxLife;
      if (alpha <= 0) {
        if (p.parent) p.parent.remove(p);
        p.geometry.dispose(); p.material.dispose();
        this._trailParticles.splice(i, 1);
      } else {
        p.material.opacity = alpha * 0.7;
        p.position.y += p.userData.vy * dt;
        p.scale.multiplyScalar(0.97);
      }
    }
  }
  
  // === CYCLE 30: ENHANCED COUNTDOWN ===
  _showCountdownEnhanced(value) {
    this._countdownCameraShake = (value === 'GO!') ? 0.6 : 0.3;
    var flash = document.createElement('div');
    flash.className = 'countdown-flash ' + (value === 'GO!' ? 'flash-go' : 'flash-count');
    document.body.appendChild(flash);
    setTimeout(function() { if (flash.parentNode) flash.remove(); }, 400);
  }
  
  // === CYCLE 30: LAP SPLIT TIMES ===
  _initLapTiming() {
    this._raceStartTime = this._clock.getElapsedTime();
    this._currentLapStart = this._raceStartTime;
    this._currentLapElapsed = 0;
    this._lapSplits = [];
  }
  
  _recordLapSplit(lapNum, lapTime) {
    this._lapSplits.push({ lap: lapNum, time: lapTime });
    if (!this._bestLapTime || lapTime < this._bestLapTime) {
      this._bestLapTime = lapTime;
      this._showNotification('BEST LAP: ' + this._formatTime(lapTime), 'best-lap');
      // CYCLE 37: Record lap event
      this._addRaceEvent('BEST LAP ' + this._formatTime(lapTime), 'record');
    } else {
      this._addRaceEvent('LAP ' + lapNum + ': ' + this._formatTime(lapTime), 'boost');
    }
    var lapRow = document.getElementById('hud-lap-time-' + Math.min(lapNum, 3));
    if (lapRow) {
      var valSpan = lapRow.querySelector('.lap-time-value');
      if (valSpan) {
        valSpan.textContent = this._formatTime(lapTime);
        if (this._bestLapTime && Math.abs(lapTime - this._bestLapTime) < 0.01) {
          lapRow.classList.add('hud-v2-lap-best');
        }
      }
      if (this._bestLapTime && Math.abs(lapTime - this._bestLapTime) > 0.01) {
        var delta = lapTime - this._bestLapTime;
        var deltaSpan = lapRow.querySelector('.lap-time-delta');
        if (!deltaSpan) {
          deltaSpan = document.createElement('span');
          deltaSpan.className = 'lap-time-delta';
          lapRow.appendChild(deltaSpan);
        }
        deltaSpan.textContent = (delta > 0 ? '+' : '') + delta.toFixed(2) + 's';
        deltaSpan.className = 'lap-time-delta ' + (delta > 0 ? 'delta-slow' : 'delta-fast');
      }
    }
  }
  
  // === CYCLE 31: REAR-VIEW MIRROR ===
  _toggleRearView() {
    if (!this._renderer || !this._scene || !this._camera) return;
    if (this._rearViewActive) {
      this._disableRearView();
    } else {
      this._enableRearView();
    }
  }
  
  _enableRearView() {
    if (!THREE.PerspectiveCamera) return;
    this._rearViewCamera = new THREE.PerspectiveCamera(75, 0.5, 0.1, 100);
    this._rearViewRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    this._rearViewRenderer.setSize(220, 140);
    this._rearViewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    
    var container = document.createElement('div');
    container.className = 'hud-rear-mirror';
    container.id = 'hud-rear-mirror';
    container.innerHTML = '<div class="rear-mirror-label">REAR VIEW [V]</div>';
    var canvas = this._rearViewRenderer.domElement;
    canvas.style.cssText = 'width:220px;height:140px;border-radius:8px;border:1px solid rgba(0,229,255,0.3);display:block;';
    container.appendChild(canvas);
    document.body.appendChild(container);
    
    this._rearViewActive = true;
    this._showNotification('Rear view ON', 'info');
  }
  
  _disableRearView() {
    if (this._rearViewRenderer) {
      this._rearViewRenderer.dispose();
    }
    var el = document.getElementById('hud-rear-mirror');
    if (el) el.remove();
    this._rearViewCamera = null;
    this._rearViewRenderer = null;
    this._rearViewActive = false;
  }
  
  _updateRearView(dt) {
    if (!this._rearViewActive || !this._rearViewCamera || !this._camera || !this._renderer) return;
    
    var vehiclePos = null;
    if (this._useBarrelVehicle && this._barrelVehicle && this._barrelVehicle.physicsBody) vehiclePos = this._barrelVehicle.physicsBody.position;
    else if (this._vehicle) vehiclePos = this._vehicle.position;
    if (!vehiclePos) return;
    
    var heading = this._heading || 0;
    // Place camera behind and above vehicle, looking backward
    this._rearViewCamera.position.set(
      vehiclePos.x - Math.sin(heading) * 0.5,
      vehiclePos.y + 2.5,
      vehiclePos.z - Math.cos(heading) * 0.5
    );
    this._rearViewCamera.lookAt(
      vehiclePos.x - Math.sin(heading) * -15,
      vehiclePos.y + 1,
      vehiclePos.z - Math.cos(heading) * -15
    );
    this._rearViewCamera.rotation.z = Math.PI; // Flip horizontally for mirror effect
    
    this._rearViewRenderer.render(this._scene, this._rearViewCamera);
  }
  
  // === CYCLE 31: SECTOR PROGRESS ===
  _updateSectorProgress() {
    if (!this._vehicle || !this._state.raceStarted) return;
    var pos = this._vehicle.position.z;
    var progress = ((pos + this._trackLength / 2) % this._trackLength) / this._trackLength;
    if (progress < 0) progress += 1;
    this._currentSector = Math.min(this._sectorCount - 1, Math.floor(progress * this._sectorCount));
    
    var sectorEl = document.getElementById('hud-sector-display');
    if (sectorEl) {
      var markers = sectorEl.querySelectorAll('.sector-marker');
      for (var i = 0; i < markers.length; i++) {
        markers[i].classList.toggle('active', i <= this._currentSector);
        markers[i].classList.toggle('current', i === this._currentSector);
      }
    }
  }
  
  // === CYCLE 31: FINISH CELEBRATION ===
  _triggerFinishCelebration() {
    if (this._finishing) return;
    this._finishing = true;
    this._finishTimer = 0;
    this._showNotification('FINISH!', 'best-lap');
    
    // CYCLE 35: Show race stats after delay
    setTimeout(function() { this._showRaceStatsOverlay(); }.bind(this), 2500);
    
    // Spawn celebration particles around vehicle
    if (!this._vehicle || !this._scene) return;
    var vPos = this._vehicle.position;
    var colors = [0xff4d2e, 0x00e5ff, 0xffd23f, 0x00ff88, 0xff6600, 0xaa44ff];
    for (var i = 0; i < 60; i++) {
      var geo = new THREE.SphereGeometry(Math.max(0.01, 0.1 + Math.random() * 0.2), 4, 4);
    var mat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true, opacity: 1 });
    var p = new THREE.Mesh(geo, mat);
    p.position.set(vPos.x, vPos.y + 0.5, vPos.z);
    var angle = Math.random() * Math.PI * 2;
    var speed = 3 + Math.random() * 8;
    p.userData = { vx: Math.cos(angle) * speed, vy: 5 + Math.random() * 10, vz: Math.sin(angle) * speed, life: 0, maxLife: 1.5 + Math.random() * 1.5 };
    if (this._scene) this._scene.add(p);
    this._celebrationParticles.push(p);
    }
  }
  
  _updateFinishCelebration(dt) {
    if (!this._finishing) return;
    this._finishTimer += dt;
    
    // Slow-motion effect on camera FOV
    if (this._camera && this._finishTimer < 2) {
      this._camera.fov += (50 - this._camera.fov) * 0.02;
      this._camera.updateProjectionMatrix();
    }
    
    // Update particles
    for (var i = this._celebrationParticles.length - 1; i >= 0; i--) {
      var p = this._celebrationParticles[i];
      p.userData.life += dt;
      if (p.userData.life >= p.userData.maxLife) {
        if (p.parent) p.parent.remove(p);
        p.geometry.dispose(); p.material.dispose();
        this._celebrationParticles.splice(i, 1);
        continue;
      }
      var t = p.userData.life / p.userData.maxLife;
      p.position.x += p.userData.vx * dt;
      p.position.y += p.userData.vy * dt - 9.8 * p.userData.life * dt;
      p.position.z += p.userData.vz * dt;
      p.userData.vy *= 0.98;
      p.material.opacity = 1 - t;
      p.scale.multiplyScalar(0.995);
    }
  }
  
  // === CYCLE 34: SETUP ALL NEW SYSTEMS ===
  _setupCycle34Systems() {
    this._createDynamicVignette();
    this._createHeatShimmer();
    this._createStandingsTower();
    this._createTachometer();
    this._createWeatherRain();
    this._createHazardZones();
    this._createWrongWayIndicator();
    console.log('[RaceScene] Cycle 34 systems initialized');
  }

  // === CYCLE 35: SETUP ALL NEW SYSTEMS ===
  _setupCycle35Systems() {
    this._createSlipstreamSystem();
    this._createSpeedEdgeTint();
    this._createLensFlare();
    this._createBoostCinematicFlash();
    this._createTireSmokeEnhanced();
    this._createGhostTrailCanvas();
    this._createIceZones();
    console.log('[RaceScene] Cycle 35 systems initialized');
  }

  // === CYCLE 36: SETUP ALL NEW SYSTEMS ===
  _setupCycle36Systems() {
    this._createTurboStartSystem();
    this._createComboMultiplierDisplay();
    this._createAmbientEmbers();
    this._createTrackProgressRing();
    this._createAIRubberbandIndicator();
    this._createNeonTrackSigns();
    this._createRaceLineGuide();

    // CYCLE 37: Create new visual systems
    this._createMotionBlurOverlay();
    this._createNeonAmbientGlow();
    this._createScanlineEffect();
    this._createDriftSparkShower();
    this._createDamageVignette();
    this._createWheelSpinIndicator();
    this._createPositionBanner();
    this._createBoostChainDisplay();
    this._createRaceEventFeed();
    this._createEnergyBar();
    this._createTechDotGrid();
    this._createHUDCornerFrame();

    // CYCLE 38: Create new visual + feature systems
    this._setupCycle38Systems();

    this._setupCycle39Systems();
    this._setupCycle40Systems();
    console.log('[RaceScene] Cycle 36 systems initialized');
  }
  
  // === CYCLE 34: DYNAMIC VIGNETTE ===
  _createDynamicVignette() {
    if (document.getElementById('dynamic-vignette')) return;
    var el = document.createElement('div');
    el.id = 'dynamic-vignette';
    el.className = 'speed-low';
    document.body.appendChild(el);
    this._vignetteEl = el;
  }
  
  _updateDynamicVignette() {
    if (!this._vignetteEl) return;
    var speed = this._state.speed || 0;
    var maxSpeed = 55;
    var ratio = Math.min(speed / maxSpeed, 1);
    var state = 'speed-low';
    if (this._boostActive) state = 'nitro-active';
    else if (ratio > 0.85) state = 'speed-critical';
    else if (ratio > 0.6) state = 'speed-high';
    else if (ratio > 0.3) state = 'speed-medium';
    
    // Override for special states
    if (this._shakeIntensity > 0.1) state = 'collision-flash';
    else if (this._driftTimer > 0.5 && this._keys.drift) state = 'drift-active';
    
    if (state !== this._lastVignetteState) {
      this._vignetteEl.className = state;
      this._lastVignetteState = state;
    }
  }
  
  // === CYCLE 34: HEAT SHIMMER ===
  _createHeatShimmer() {
    if (document.getElementById('heat-shimmer')) return;
    var el = document.createElement('div');
    el.id = 'heat-shimmer';
    document.body.appendChild(el);
    this._heatShimmerEl = el;
  }
  
  // (Heat shimmer is toggled via _updateDynamicVignette drift state — separate element for modularity)
  
  // === CYCLE 34: RACE STANDINGS TOWER ===
  _createStandingsTower() {
    if (document.querySelector('.race-standings-tower')) return;
    var tower = document.createElement('div');
    tower.className = 'race-standings-tower';
    tower.id = 'race-standings-tower';
    
    // Player + all AI
    var names = ['YOU'];
    for (var i = 0; i < this._aiCount; i++) {
      names.push(this._aiOpponents[i] ? this._aiOpponents[i].name : 'Racer ' + (i + 2));
    }
    
    this._lastPositions = [];
    for (var i = 0; i <= this._aiCount; i++) this._lastPositions.push(i + 1);
    
    this._standingsRows = [];
    for (var i = 0; i <= this._aiCount; i++) {
      var row = document.createElement('div');
      row.className = 'standings-row' + (i === 0 ? ' player-row' : '');
      row.innerHTML = '<span class="standings-pos pos-' + (i + 1) + '">' + (i + 1) + '</span>' +
        '<span class="standings-name">' + names[i] + '</span>' +
        '<span class="standings-gap"></span>';
      tower.appendChild(row);
      this._standingsRows.push(row);
    }
    
    document.body.appendChild(tower);
    this._standingsTower = tower;
  }
  
  _updateStandingsTower() {
    if (!this._standingsTower || !this._state.raceStarted) return;
    
    // Build sorted list of all racers
    var playerPos = this._state.position || 0;
    var playerLap = this._state.lap || 1;
    var playerTrackPos = this._state.position_raw || 0;
    
    // Get player actual track position
    var px = 0, pz = 0;
    if (this._vehicle) { px = this._vehicle.position.x; pz = this._vehicle.position.z; }
    else if (this._barrelVehicle && this._barrelVehicle.physicsBody) { px = this._barrelVehicle.physicsBody.position.x; pz = this._barrelVehicle.physicsBody.position.z; }
    
    // Calculate actual progress (lap * trackLength + trackPos)
    var halfTrack = this._trackLength / 2;
    var playerProgress = (playerLap - 1) * this._trackLength + ((pz + halfTrack + this._trackLength) % this._trackLength);
    
    var racers = [{ name: 'YOU', progress: playerProgress, isPlayer: true, index: 0 }];
    for (var i = 0; i < this._aiOpponents.length; i++) {
      var ai = this._aiOpponents[i];
      racers.push({ name: ai.name, progress: (ai.lap - 1) * this._trackLength + ai.trackPos, isPlayer: false, index: i + 1 });
    }
    
    // Sort by progress descending
    racers.sort(function(a, b) { return b.progress - a.progress; });
    
    // Update rows
    for (var i = 0; i < racers.length; i++) {
      var racer = racers[i];
      var row = this._standingsRows[racer.index];
      if (!row) continue;
      
      var posSpan = row.querySelector('.standings-pos');
      var gapSpan = row.querySelector('.standings-gap');
      var newPos = i + 1;
      var oldPos = this._lastPositions[racer.index];
      
      if (posSpan) {
        posSpan.textContent = String(newPos);
        posSpan.className = 'standings-pos pos-' + Math.min(newPos, 3);
      }
      
      // Show gap to leader
      if (gapSpan && i > 0) {
        var gap = (racers[0].progress - racer.progress) / this._trackLength * 10; // rough seconds
        gapSpan.textContent = (gap > 0 ? '+' : '') + gap.toFixed(1) + 's';
        gapSpan.className = 'standings-gap ' + (racer.isPlayer ? 'behind' : (i === 0 ? 'ahead' : ''));
      } else if (gapSpan) {
        gapSpan.textContent = 'LEADER';
        gapSpan.className = 'standings-gap ahead';
      }
      
      // Position change animation
      row.classList.remove('position-changed-up', 'position-changed-down');
      if (newPos < oldPos) {
        void row.offsetWidth; // force reflow
        row.classList.add('position-changed-up');
      } else if (newPos > oldPos) {
        void row.offsetWidth;
        row.classList.add('position-changed-down');
      }
      
      this._lastPositions[racer.index] = newPos;
    }
  }
  
  // === CYCLE 34: TACHOMETER / RPM GAUGE ===
  _createTachometer() {
    if (document.querySelector('.hud-tachometer')) return;
    var container = document.createElement('div');
    container.className = 'hud-tachometer';
    container.innerHTML =
      '<div class="tacho-bar-container">' +
        '<span class="tacho-rpm-value">0</span>' +
        '<div class="tacho-bar-fill" style="width:0%"></div>' +
      '</div>' +
      '<div class="tacho-label"><span>0</span><span>RPM</span><span>9000</span></div>';
    document.body.appendChild(container);
    this._tachoContainer = container;
    this._tachoFill = container.querySelector('.tacho-bar-fill');
    this._tachoRPMValue = container.querySelector('.tacho-rpm-value');
  }
  
  _updateTachometer(dt) {
    if (!this._tachoFill) return;
    
    // Simulate RPM based on speed + throttle + gear
    var speed = this._state.speed || 0;
    var maxSpeed = 55;
    var baseRPM = (speed / maxSpeed) * 7000 + 1500;
    
    // Add variation based on throttle
    if (this._keys.throttle) baseRPM += 500 + Math.sin(Date.now() * 0.01) * 300;
    if (this._keys.brake) baseRPM = Math.max(800, baseRPM - 2000);
    if (this._boostActive) baseRPM = Math.min(9500, baseRPM + 1500);
    
    // Drift revs higher
    if (this._keys.drift && this._driftTimer > 0.5) baseRPM += 1000;
    
    this._targetRPM = Math.max(800, Math.min(9500, baseRPM));
    
    // Smooth interpolation
    this._currentRPM += (this._targetRPM - this._currentRPM) * Math.min(1, dt * 8);
    
    var rpmPercent = (this._currentRPM / 9000) * 100;
    var isRedline = this._currentRPM > 7500;
    
    this._tachoFill.style.width = rpmPercent + '%';
    this._tachoFill.classList.toggle('redline', isRedline);
    
    if (this._tachoRPMValue) {
      this._tachoRPMValue.textContent = Math.floor(this._currentRPM);
      this._tachoRPMValue.classList.toggle('redline', isRedline);
    }
  }
  
  // === CYCLE 34: WEATHER RAIN ===
  _createWeatherRain() {
    if (document.querySelector('.weather-rain-container')) return;
    
    var container = document.createElement('div');
    container.className = 'weather-rain-container';
    
    // Pre-create rain drops (pool of 80)
    for (var i = 0; i < 80; i++) {
      var drop = document.createElement('div');
      drop.className = 'rain-drop';
      var h = 15 + Math.random() * 25;
      drop.style.height = h + 'px';
      drop.style.left = Math.random() * 100 + '%';
      drop.style.top = -(Math.random() * 100) + 'px';
      drop.style.animationDuration = (0.4 + Math.random() * 0.3) + 's';
      drop.style.animationDelay = (Math.random() * 2) + 's';
      drop.style.opacity = 0.3 + Math.random() * 0.5;
      container.appendChild(drop);
    }
    document.body.appendChild(container);
    this._rainContainer = container;
    
    // Splash at bottom
    var splash = document.createElement('div');
    splash.className = 'weather-splash';
    document.body.appendChild(splash);
    this._rainSplash = splash;
    
    // Auto-toggle rain every 30-60 seconds for variety
    this._rainToggleTimer = 15 + Math.random() * 20;
  }
  
  _updateWeatherRain(dt) {
    if (!this._rainContainer) return;
    
    this._rainToggleTimer -= dt;
    if (this._rainToggleTimer <= 0) {
      this._rainActive = !this._rainActive;
      this._rainContainer.classList.toggle('active', this._rainActive);
      if (this._rainSplash) this._rainSplash.classList.toggle('active', this._rainActive);
      this._rainToggleTimer = 25 + Math.random() * 35;
      if (this._rainActive) this._showNotification('RAIN STARTING', 'info');
    }
  }
  
  // === CYCLE 34: TRACK HAZARD ZONES ===
  _createHazardZones() {
    this._hazardZones = [];
    if (!this._scene) return;
    var trackLen = this._trackLength;
    
    // Create 3 hazard zones (oil slicks / slow-down areas)
    var positions = [
      { x: -4, z: -trackLen * 0.25 },
      { x: 5, z: trackLen * 0.15 },
      { x: -2, z: trackLen * 0.45 }
    ];
    
    for (var i = 0; i < positions.length; i++) {
      var pos = positions[i];
      
      // Visual: dark translucent plane with animated pattern
      var geo = new THREE.PlaneGeometry(6, 10);
      var canvas = document.createElement('canvas');
      canvas.width = 128; canvas.height = 256;
      var ctx = canvas.getContext('2d');
      
      // Oil slick pattern
      var grad = ctx.createRadialGradient(64, 128, 10, 64, 128, 100);
      grad.addColorStop(0, 'rgba(80, 0, 120, 0.6)');
      grad.addColorStop(0.5, 'rgba(40, 0, 80, 0.4)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 256);
      
      // Add swirl pattern
      ctx.strokeStyle = 'rgba(120, 0, 200, 0.3)';
      ctx.lineWidth = 2;
      for (var s = 0; s < 5; s++) {
        ctx.beginPath();
        ctx.arc(64 + (Math.random() - 0.5) * 40, 128 + (Math.random() - 0.5) * 80, 10 + Math.random() * 20, 0, Math.PI * 1.5);
        ctx.stroke();
      }
      
      var tex = new THREE.CanvasTexture(canvas);
      var mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(pos.x, 0.05, pos.z);
      
      // Warning posts
      var postGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6);
      var postMat = new THREE.MeshBasicMaterial({ color: 0xffa500 });
      var p1 = new THREE.Mesh(postGeo, postMat);
      p1.position.set(pos.x - 3.5, 0.6, pos.z - 5.5);
      var p2 = new THREE.Mesh(postGeo, postMat);
      p2.position.set(pos.x + 3.5, 0.6, pos.z + 5.5);
      
      // Point light
      var light = new THREE.PointLight(0xff6600, 0.5, 10);
      light.position.set(pos.x, 1, pos.z);
      
      this._scene.add(mesh);
      this._scene.add(p1);
      this._scene.add(p2);
      this._scene.add(light);
      
      this._hazardZones.push({ mesh: mesh, light: light, position: pos, cooldown: 0 });
    }
    
    // Create HUD indicator
    var indicator = document.createElement('div');
    indicator.className = 'hazard-zone-indicator';
    indicator.textContent = 'HAZARD ZONE — SPEED REDUCED';
    document.body.appendChild(indicator);
    this._hazardIndicator = indicator;
    
    console.log('[RaceScene] Created ' + this._hazardZones.length + ' hazard zones');
  }
  
  _updateHazardZones() {
    if (!this._hazardZones || !this._state.raceStarted || this._hazardZones.length === 0) return;
    
    var px = 0, pz = 0;
    if (this._vehicle) { px = this._vehicle.position.x; pz = this._vehicle.position.z; }
    else if (this._barrelVehicle && this._barrelVehicle.physicsBody) { px = this._barrelVehicle.physicsBody.position.x; pz = this._barrelVehicle.physicsBody.position.z; }
    
    var inHazard = false;
    for (var i = 0; i < this._hazardZones.length; i++) {
      var hz = this._hazardZones[i];
      if (Math.abs(px - hz.position.x) < 3.5 && Math.abs(pz - hz.position.z) < 6) {
        inHazard = true;
        // Slow down effect
        if (this._speedBoostMultiplier > 0.7) {
          this._speedBoostMultiplier = 0.6;
          this._speedBoostTimer = 0.5;
        }
        // Pulse light
        hz.light.intensity = 1.0 + Math.sin(Date.now() * 0.008) * 0.5;
      } else {
        hz.light.intensity = 0.3 + Math.sin(Date.now() * 0.003) * 0.2;
      }
    }
    
    if (inHazard !== this._inHazardZone) {
      this._inHazardZone = inHazard;
      if (this._hazardIndicator) {
        this._hazardIndicator.classList.toggle('active', inHazard);
      }
    }
  }
  
  // === CYCLE 34: WRONG WAY DETECTION ===
  _createWrongWayIndicator() {
    if (document.querySelector('.wrong-way-indicator')) return;
    var el = document.createElement('div');
    el.className = 'wrong-way-indicator';
    el.textContent = 'WRONG WAY';
    document.body.appendChild(el);
    this._wrongWayEl = el;
  }
  
  _updateWrongWay(dt) {
    if (!this._wrongWayEl || !this._state.raceStarted) return;
    
    // Check if player is moving backward
    var pz = 0;
    if (this._vehicle) pz = this._vehicle.position.z;
    else if (this._barrelVehicle && this._barrelVehicle.physicsBody) pz = this._barrelVehicle.physicsBody.position.z;
    
    var progress = ((pz + this._trackLength / 2 + this._trackLength) % this._trackLength) / this._trackLength;
    
    // Detect backward movement (progress decreasing while throttle is held)
    var movingBackward = false;
    if (this._keys.throttle && progress < this._lastForwardProgress - 0.001) {
      this._wrongWayTimer += dt;
    } else {
      this._wrongWayTimer = Math.max(0, this._wrongWayTimer - dt * 2);
    }
    this._lastForwardProgress = progress;
    
    var shouldShow = this._wrongWayTimer > 1.5;
    if (shouldShow !== this._wrongWayDetected) {
      this._wrongWayDetected = shouldShow;
      this._wrongWayEl.classList.toggle('active', shouldShow);
    }
  }
  
  // === CYCLE 35: SLIPSTREAM / DRAFTING SYSTEM ===
  _createSlipstreamSystem() {
    if (document.getElementById('slipstream-indicator')) return;
    var el = document.createElement('div');
    el.id = 'slipstream-indicator';
    el.innerHTML = '<div class="slipstream-icon">◆</div>' +
      '<div class="slipstream-label">SLIPSTREAM</div>' +
      '<div class="slipstream-bar"><div class="slipstream-bar-fill" style="width:0%"></div></div>';
    document.body.appendChild(el);
    this._slipstreamEl = el;
    this._slipstreamFill = el.querySelector('.slipstream-bar-fill');
    console.log('[RaceScene] Slipstream system created');
  }

  _updateSlipstream(dt) {
    if (!this._slipstreamEl || !this._state.raceStarted || this._aiOpponents.length === 0) return;

    var px = 0, pz = 0;
    if (this._vehicle) { px = this._vehicle.position.x; pz = this._vehicle.position.z; }
    else if (this._barrelVehicle && this._barrelVehicle.physicsBody) { px = this._barrelVehicle.physicsBody.position.x; pz = this._barrelVehicle.physicsBody.position.z; }

    var closestDist = Infinity;
    var closestAI = null;
    var isBehind = false;

    for (var i = 0; i < this._aiOpponents.length; i++) {
      var ai = this._aiOpponents[i];
      var dx = px - ai.x;
      var dz = pz - ai.z;
      var dist = Math.sqrt(dx * dx + dz * dz);

      // Check if player is behind AI (within ~15 units behind, within ~4 units lateral)
      if (dist < closestDist && dz > 0 && dz < 15 && Math.abs(dx) < 4) {
        closestDist = dist;
        closestAI = ai;
        isBehind = true;
      }
    }

    if (isBehind && closestAI && this._state.speed > 15) {
      // Build slipstream progress (closer = faster build, ~2 seconds at optimal distance)
      var optimalDist = 5;
      var distFactor = 1 - Math.min(1, Math.abs(closestDist - optimalDist) / 12);
      this._slipstreamProgress = Math.min(100, this._slipstreamProgress + distFactor * dt * 55);
      this._slipstreamTarget = closestAI;

      // Apply slipstream speed bonus when progress is full
      if (this._slipstreamProgress >= 100 && !this._slipstreamActive) {
        this._slipstreamActive = true;
        this._slipstreamBonus = 1.08; // 8% speed boost
        this._speedBoostMultiplier = Math.max(this._speedBoostMultiplier, this._slipstreamBonus);
        this._speedBoostTimer = 1.5;
        this._addComboSource('slipstream');
        this._showNotification('SLIPSTREAM BOOST!', 'info');
        // Reset for next draft
        setTimeout(function() { this._slipstreamProgress = 0; this._slipstreamActive = false; }.bind(this), 1500);
      }

      this._slipstreamEl.classList.add('active');
      if (this._slipstreamFill) this._slipstreamFill.style.width = this._slipstreamProgress + '%';
    } else {
      // Decay slipstream when not behind anyone
      this._slipstreamProgress = Math.max(0, this._slipstreamProgress - dt * 30);
      if (this._slipstreamProgress <= 0) {
        this._slipstreamEl.classList.remove('active');
        this._slipstreamTarget = null;
      }
    }
  }

  // === CYCLE 35: RACE STATS TRACKER ===
  _updateRaceStats(dt) {
    if (!this._state.raceStarted) return;

    // Track max speed
    var spd = this._state.speed || 0;
    if (spd > this._raceStats.maxSpeed) this._raceStats.maxSpeed = spd;

    // Track total drift score
    if (this._totalDriftScore) this._raceStats.totalDrift = this._totalDriftScore;

    // Track time in lead (position 1)
    if (this._state.position === 1 || this._state.position === '1st') {
      this._raceStats.timeInLead += dt;
    }

    // Track boost usage
    if (this._boostActive) this._raceStats.boostUsed += dt;

    // Track hazard zone hits
    if (this._inHazardZone) this._raceStats.hazardsHit += dt;

    // Track ice zone time
    if (this._onIceSurface) this._raceStats.iceZones += dt;
  }

  _showRaceStatsOverlay() {
    if (this._raceFinishShown) return;
    this._raceFinishShown = true;

    var s = this._raceStats;
    var raceTime = this._raceStartTime > 0 ? ((Date.now() - this._raceStartTime) / 1000) : 0;
    var mins = Math.floor(raceTime / 60);
    var secs = Math.floor(raceTime % 60);
    var ms = Math.floor((raceTime % 1) * 100);

    var overlay = document.createElement('div');
    overlay.id = 'race-stats-overlay';
    overlay.innerHTML =
      '<div class="race-stats-card">' +
        '<div class="race-stats-title">RACE COMPLETE</div>' +
        '<div class="race-stats-subtitle">POSITION ' + (this._state.position || '?') + ' — ' + mins + ':' + String(secs).padStart(2,'0') + '.' + String(ms).padStart(2,'0') + '</div>' +
        '<div class="race-stats-grid">' +
          '<div class="stat-item"><div class="stat-label">TOP SPEED</div><div class="stat-value accent-orange">' + Math.floor(s.maxSpeed * 3.6) + '<span class="stat-unit">KM/H</span></div></div>' +
          '<div class="stat-item"><div class="stat-label">DRIFT SCORE</div><div class="stat-value accent-gold">' + Math.floor(s.totalDrift) + '</div></div>' +
          '<div class="stat-item"><div class="stat-label">TIME IN LEAD</div><div class="stat-value accent-cyan">' + s.timeInLead.toFixed(1) + '<span class="stat-unit">SEC</span></div></div>' +
          '<div class="stat-item"><div class="stat-label">BOOST USED</div><div class="stat-value accent-green">' + s.boostUsed.toFixed(1) + '<span class="stat-unit">SEC</span></div></div>' +
          '<div class="stat-item"><div class="stat-label">HAZARD TIME</div><div class="stat-value" style="color:#ff6b6b">' + s.hazardsHit.toFixed(1) + '<span class="stat-unit">SEC</span></div></div>' +
          '<div class="stat-item"><div class="stat-label">ICE ZONE TIME</div><div class="stat-value" style="color:#64b4ff">' + s.iceZones.toFixed(1) + '<span class="stat-unit">SEC</span></div></div>' +
          '<div class="stat-item full-width"><div class="stat-label">BEST LAP</div><div class="stat-value accent-gold">' + (this._bestLapTime ? this._formatTime(this._bestLapTime) : 'N/A') + '</div></div>' +
        '</div>' +
        '<button class="race-stats-close">CONTINUE ▸</button>' +
      '</div>';

    document.body.appendChild(overlay);
    this._statsOverlay = overlay;

    // Trigger visible
    requestAnimationFrame(function() { overlay.classList.add('visible'); });

    // Close handler
    overlay.querySelector('.race-stats-close').addEventListener('click', function() {
      overlay.classList.remove('visible');
      setTimeout(function() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 500);
    }.bind(this));

    console.log('[RaceScene] Race stats overlay shown');
  }

  _formatTime(ms) {
    var m = Math.floor(ms / 60000);
    var s = Math.floor((ms % 60000) / 1000);
    var mil = Math.floor(ms % 1000);
    return m + ':' + String(s).padStart(2, '0') + '.' + String(mil).padStart(3, '0');
  }

  // === CYCLE 35: SPEED EDGE TINT ===
  _createSpeedEdgeTint() {
    if (document.getElementById('speed-edge-tint')) return;
    var el = document.createElement('div');
    el.id = 'speed-edge-tint';
    document.body.appendChild(el);
    this._speedEdgeTint = el;
  }

  _updateSpeedEdgeTint() {
    if (!this._speedEdgeTint || !this._state.raceStarted) return;
    var speed = this._state.speed || 0;
    var maxSpeed = 55;
    var pct = speed / maxSpeed;
    var tier = '';
    if (pct > 0.9) tier = 'speed-max';
    else if (pct > 0.7) tier = 'speed-high';
    else if (pct > 0.4) tier = 'speed-medium';
    else if (pct > 0.15) tier = 'speed-low';

    if (tier !== this._lastSpeedTier) {
      this._speedEdgeTint.className = tier;
      this._lastSpeedTier = tier;
    }
  }

  // === CYCLE 35: LENS FLARE ===
  _createLensFlare() {
    if (document.getElementById('lens-flare-container')) return;
    var container = document.createElement('div');
    container.id = 'lens-flare-container';
    for (var i = 0; i < 5; i++) {
      var orb = document.createElement('div');
      orb.className = 'lens-flare-orb';
      container.appendChild(orb);
    }
    document.body.appendChild(container);
    this._lensFlareContainer = container;
  }

  _updateLensFlare() {
    if (!this._lensFlareContainer) return;
    var active = this._boostActive || (this._state.speed > 45);
    this._lensFlareContainer.classList.toggle('active', active);
  }

  // === CYCLE 35: BOOST CINEMATIC FLASH ===
  _createBoostCinematicFlash() {
    if (document.getElementById('boost-cinematic-flash')) return;
    var el = document.createElement('div');
    el.id = 'boost-cinematic-flash';
    document.body.appendChild(el);
    this._boostCinematicFlash = el;
  }

  // === CYCLE 35: RPM GLOW ON SPEED PANEL ===
  _updateRPMGlow() {
    if (!this._speedPanelEl) {
      this._speedPanelEl = document.querySelector('.hud-speed-panel');
    }
    if (!this._speedPanelEl) return;

    var rpm = this._currentRPM || 0;
    this._speedPanelEl.classList.remove('rpm-low', 'rpm-mid', 'rpm-high', 'rpm-redline');

    if (rpm > 7500) this._speedPanelEl.classList.add('rpm-redline');
    else if (rpm > 5500) this._speedPanelEl.classList.add('rpm-high');
    else if (rpm > 3000) this._speedPanelEl.classList.add('rpm-mid');
    else if (rpm > 1000) this._speedPanelEl.classList.add('rpm-low');
  }

  // === CYCLE 35: GHOST TRAIL ===
  _createGhostTrailCanvas() {
    if (document.getElementById('ghost-trail-canvas')) return;
    var c = document.createElement('canvas');
    c.id = 'ghost-trail-canvas';
    c.width = 160; c.height = 160;
    document.body.appendChild(c);
    this._ghostCanvas = c;
    this._ghostCtx = c.getContext('2d');
  }

  _updateGhostTrail() {
    if (!this._ghostCanvas || !this._state.raceStarted) return;

    var px = 0, pz = 0;
    if (this._vehicle) { px = this._vehicle.position.x; pz = this._vehicle.position.z; }
    else if (this._barrelVehicle && this._barrelVehicle.physicsBody) { px = this._barrelVehicle.physicsBody.position.x; pz = this._barrelVehicle.physicsBody.position.z; }
    else return;

    this._ghostTrail.push({ x: px, z: pz });
    if (this._ghostTrail.length > this._ghostTrailMax) this._ghostTrail.shift();

    // Draw ghost trail on minimap-style canvas
    var ctx = this._ghostCtx;
    var w = 160, h = 160;
    ctx.clearRect(0, 0, w, h);

    if (this._ghostTrail.length < 2) return;

    // Find bounds
    var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (var i = 0; i < this._ghostTrail.length; i++) {
      var p = this._ghostTrail[i];
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
    }
    var rangeX = Math.max(20, maxX - minX);
    var rangeZ = Math.max(20, maxZ - minZ);
    var scale = Math.min((w - 20) / rangeX, (h - 20) / rangeZ);
    var offX = (w - rangeX * scale) / 2;
    var offZ = (h - rangeZ * scale) / 2;

    ctx.beginPath();
    for (var i = 0; i < this._ghostTrail.length; i++) {
      var p = this._ghostTrail[i];
      var sx = (p.x - minX) * scale + offX;
      var sy = (p.z - minZ) * scale + offZ;
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Current position dot
    var lastP = this._ghostTrail[this._ghostTrail.length - 1];
    var lx = (lastP.x - minX) * scale + offX;
    var ly = (lastP.z - minZ) * scale + offZ;
    ctx.beginPath();
    ctx.arc(lx, ly, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#00e5ff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lx, ly, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 229, 255, 0.2)';
    ctx.fill();
  }

  // === CYCLE 35: ICE SURFACE ZONES ===
  _createIceZones() {
    if (this._iceZones.length > 0) return;
    if (!this._scene) return;

    var trackLen = this._trackLength;
    var positions = [
      { x: 3, z: -trackLen * 0.1 },
      { x: -5, z: trackLen * 0.3 },
      { x: 1, z: trackLen * 0.55 }
    ];

    for (var i = 0; i < positions.length; i++) {
      var pos = positions[i];
      var geo = new THREE.PlaneGeometry(5, 8);
      var canvas = document.createElement('canvas');
      canvas.width = 128; canvas.height = 128;
      var ctx = canvas.getContext('2d');
      var grad = ctx.createRadialGradient(64, 64, 5, 64, 64, 64);
      grad.addColorStop(0, 'rgba(100, 180, 255, 0.35)');
      grad.addColorStop(0.6, 'rgba(150, 220, 255, 0.15)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      // Ice crystal pattern
      ctx.strokeStyle = 'rgba(200, 230, 255, 0.2)';
      ctx.lineWidth = 1;
      for (var j = 0; j < 8; j++) {
        ctx.beginPath();
        var cx = 30 + Math.random() * 68;
        var cy = 30 + Math.random() * 68;
        for (var k = 0; k < 6; k++) {
          var angle = (k / 6) * Math.PI * 2;
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(angle) * (8 + Math.random() * 6), cy + Math.sin(angle) * (8 + Math.random() * 6));
        }
        ctx.stroke();
      }

      var tex = new THREE.CanvasTexture(canvas);
      var mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(pos.x, 0.04, pos.z);
      this._scene.add(mesh);

      var light = new THREE.PointLight(0x64b4ff, 0.3, 8);
      light.position.set(pos.x, 0.5, pos.z);
      this._scene.add(light);

      this._iceZones.push({ mesh: mesh, light: light, position: pos });
    }

    // Ice indicator
    if (!document.getElementById('ice-surface-indicator')) {
      var indicator = document.createElement('div');
      indicator.id = 'ice-surface-indicator';
      indicator.textContent = 'ICE SURFACE — LOW GRIP';
      document.body.appendChild(indicator);
      this._iceIndicator = indicator;
    }

    console.log('[RaceScene] Created ' + this._iceZones.length + ' ice zones');
  }

  _updateIceZones() {
    if (!this._iceZones || !this._state.raceStarted || this._iceZones.length === 0) return;

    var px = 0, pz = 0;
    if (this._vehicle) { px = this._vehicle.position.x; pz = this._vehicle.position.z; }
    else if (this._barrelVehicle && this._barrelVehicle.physicsBody) { px = this._barrelVehicle.physicsBody.position.x; pz = this._barrelVehicle.physicsBody.position.z; }

    var onIce = false;
    for (var i = 0; i < this._iceZones.length; i++) {
      var iz = this._iceZones[i];
      if (Math.abs(px - iz.position.x) < 3 && Math.abs(pz - iz.position.z) < 5) {
        onIce = true;
        // Reduce steering effectiveness (simulated)
        iz.light.intensity = 0.5 + Math.sin(Date.now() * 0.006) * 0.3;
      } else {
        iz.light.intensity = 0.15;
      }
    }

    if (onIce !== this._onIceSurface) {
      this._onIceSurface = onIce;
      if (this._iceIndicator) this._iceIndicator.classList.toggle('active', onIce);
      if (onIce) this._showNotification('ICE ZONE!', 'info');
    }
  }

  // === CYCLE 35: ENHANCED TIRE SMOKE ===
  _createTireSmokeEnhanced() {
    if (document.querySelector('.tire-smoke-enhanced')) return;
    var el = document.createElement('div');
    el.className = 'tire-smoke-enhanced';
    document.body.appendChild(el);
    this._tireSmokeEnhanced = el;
  }

  _updateTireSmokeEnhanced() {
    if (!this._tireSmokeEnhanced) return;
    var isDrifting = this._keys.drift && this._state.speed > 10;
    this._tireSmokeEnhanced.classList.toggle('active', isDrifting);
  }

  // === CYCLE 36: TURBO START SYSTEM ===
  _createTurboStartSystem() {
    if (document.getElementById('turbo-start-overlay')) return;
    var el = document.createElement('div');
    el.id = 'turbo-start-overlay';
    el.innerHTML =
      '<div class="turbo-start-ring"></div>' +
      '<div class="turbo-start-label">TURBO START</div>' +
      '<div class="turbo-start-timer">GO!</div>' +
      '<div class="turbo-start-zone"><div class="turbo-start-zone-fill" style="width:0%"></div></div>' +
      '<div class="turbo-start-result"></div>';
    document.body.appendChild(el);
    this._turboStartOverlay = el;
    this._turboStartZoneFill = el.querySelector('.turbo-start-zone-fill');
    this._turboStartResultEl = el.querySelector('.turbo-start-result');
    this._turboStartTimerEl = el.querySelector('.turbo-start-timer');
    console.log('[RaceScene] Turbo start system created');
  }

  _triggerTurboStart() {
    if (!this._turboStartOverlay || this._turboStartActive) return;
    this._turboStartActive = true;
    this._turboStartCountdown = this._turboStartWindow;
    this._turboStartResult = null;
    this._turboStartOverlay.classList.add('active');
    if (this._turboStartResultEl) { this._turboStartResultEl.className = 'turbo-start-result'; this._turboStartResultEl.textContent = ''; }
    if (this._turboStartZoneFill) this._turboStartZoneFill.style.width = '0%';
    console.log('[RaceScene] Turbo start window OPEN - press SHIFT!');
  }

  _updateTurboStart(dt) {
    if (!this._turboStartActive || !this._turboStartOverlay) return;
    this._turboStartCountdown -= dt;
    var pct = Math.max(0, (this._turboStartCountdown / this._turboStartWindow) * 100);
    if (this._turboStartZoneFill) this._turboStartZoneFill.style.width = pct + '%';
    if (this._turboStartTimerEl) this._turboStartTimerEl.textContent = this._turboStartCountdown > 0 ? this._turboStartCountdown.toFixed(2) : 'GO!';

    // Check for boost press during window
    if (this._keys.boost && this._turboStartCountdown > 0 && this._turboStartCountdown < this._turboStartWindow * 0.85) {
      var timing = this._turboStartCountdown / this._turboStartWindow;
      this._turboStartResult = timing > 0.7 ? 'perfect' : (timing > 0.4 ? 'good' : 'ok');
      var boostBonus = this._turboStartResult === 'perfect' ? 1.25 : (this._turboStartResult === 'good' ? 1.15 : 1.05);
      this._speedBoostMultiplier = Math.max(this._speedBoostMultiplier, boostBonus);
      this._speedBoostTimer = 2.0;
      this._turboStartActive = false;
      if (this._turboStartResultEl) {
        this._turboStartResultEl.textContent = this._turboStartResult === 'perfect' ? 'PERFECT!' : (this._turboStartResult === 'good' ? 'GOOD!' : 'OK');
        this._turboStartResultEl.className = 'turbo-start-result ' + this._turboStartResult;
      }
      this._addComboSource('boost');
      this._showNotification('TURBO ' + this._turboStartResult.toUpperCase() + '!', this._turboStartResult === 'perfect' ? 'milestone' : 'info');
      setTimeout(function() { this._turboStartOverlay.classList.remove('active'); }.bind(this), 2000);
      console.log('[RaceScene] Turbo start: ' + this._turboStartResult + ' (x' + boostBonus + ')');
      return;
    }

    // Window expired - missed
    if (this._turboStartCountdown <= 0) {
      this._turboStartActive = false;
      if (this._turboStartResultEl) { this._turboStartResultEl.textContent = 'MISSED'; this._turboStartResultEl.className = 'turbo-start-result missed'; }
      setTimeout(function() { this._turboStartOverlay.classList.remove('active'); }.bind(this), 1500);
      console.log('[RaceScene] Turbo start: MISSED');
    }
  }

  // === CYCLE 36: COMBO MULTIPLIER ===
  _createComboMultiplierDisplay() {
    if (document.getElementById('combo-multiplier-display')) return;
    var el = document.createElement('div');
    el.id = 'combo-multiplier-display';
    el.innerHTML =
      '<div class="combo-mult-value">x1.0</div>' +
      '<div class="combo-mult-label">COMBO</div>' +
      '<div class="combo-mult-timer-bar"><div class="combo-mult-timer-fill" style="width:100%"></div></div>' +
      '<div class="combo-mult-breakdown">' +
        '<div class="combo-source"><span class="combo-source-dot drift"></span>DRIFT</div>' +
        '<div class="combo-source"><span class="combo-source-dot slipstream"></span>DRAFT</div>' +
        '<div class="combo-source"><span class="combo-source-dot boost"></span>BOOST</div>' +
      '</div>';
    document.body.appendChild(el);
    this._comboDisplayEl = el;
    this._comboFillEl = el.querySelector('.combo-mult-timer-fill');
    this._comboValueEl = el.querySelector('.combo-mult-value');
  }

  _addComboSource(source) {
    this._comboSources[source] = true;
    // Recalculate multiplier
    var count = 0;
    if (this._comboSources.drift) count++;
    if (this._comboSources.slipstream) count++;
    if (this._comboSources.boost) count++;
    var newMult = 1.0 + (count - 1) * 0.5; // x1.0, x1.5, x2.0
    if (newMult > this._comboMultiplier) {
      this._comboMultiplier = newMult;
      this._comboTimer = this._comboMaxTimer;
      if (this._comboDisplayEl) {
        this._comboDisplayEl.classList.add('active', 'pop');
        setTimeout(function() { if (this._comboDisplayEl) this._comboDisplayEl.classList.remove('pop'); }.bind(this), 300);
      }
      if (this._comboValueEl) this._comboValueEl.textContent = 'x' + this._comboMultiplier.toFixed(1);
    }
  }

  _updateComboMultiplier(dt) {
    if (!this._comboDisplayEl || this._comboMultiplier <= 1.0) return;
    this._comboTimer -= dt;
    if (this._comboFillEl) this._comboFillEl.style.width = Math.max(0, (this._comboTimer / this._comboMaxTimer) * 100) + '%';
    if (this._comboTimer <= 0) {
      this._comboMultiplier = 1.0;
      this._comboSources = { drift: false, slipstream: false, boost: false };
      this._comboDisplayEl.classList.remove('active');
      if (this._comboValueEl) this._comboValueEl.textContent = 'x1.0';
    }
    // Apply multiplier to score
    if (this._driftTimer > 0 && this._keys.drift) {
      this._driftScore += dt * 50 * this._comboMultiplier;
    }
  }

  // === CYCLE 36: AMBIENT EMBERS ===
  _createAmbientEmbers() {
    if (document.getElementById('ambient-embers-container')) return;
    var container = document.createElement('div');
    container.id = 'ambient-embers-container';
    document.body.appendChild(container);
    this._emberContainer = container;
  }

  _updateAmbientEmbers(dt) {
    if (!this._emberContainer || !this._state.raceStarted) return;
    this._emberContainer.classList.toggle('active', this._state.speed > 20);
    if (this._state.speed < 20) return;
    this._emberSpawnTimer -= dt;
    if (this._emberSpawnTimer <= 0) {
      this._emberSpawnTimer = 0.15 + Math.random() * 0.3;
      var ember = document.createElement('div');
      var types = ['', 'ember-blue', 'ember-gold'];
      ember.className = 'ambient-ember ' + types[Math.floor(Math.random() * types.length)];
      ember.style.left = (Math.random() * 100) + '%';
      ember.style.bottom = (Math.random() * 30) + '%';
      ember.style.setProperty('--ember-drift', (Math.random() * 60 - 30) + 'px');
      ember.style.animationDuration = (1.5 + Math.random() * 2) + 's';
      ember.style.width = (2 + Math.random() * 3) + 'px';
      ember.style.height = ember.style.width;
      this._emberContainer.appendChild(ember);
      setTimeout(function() { if (ember.parentNode) ember.parentNode.removeChild(ember); }, 4000);
      // Limit particles
      while (this._emberContainer.children.length > 40) {
        this._emberContainer.removeChild(this._emberContainer.children[0]);
      }
    }
  }

  // === CYCLE 36: TRACK PROGRESS RING ===
  _createTrackProgressRing() {
    if (document.getElementById('track-progress-ring')) return;
    var el = document.createElement('div');
    el.id = 'track-progress-ring';
    el.innerHTML =
      '<svg viewBox="0 0 70 70"><defs><linearGradient id="tprGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#00e5ff"/><stop offset="100%" stop-color="#ff4d2e"/></linearGradient></defs>' +
      '<circle class="tpr-track" cx="35" cy="35" r="30"/><circle class="tpr-fill" cx="35" cy="35" r="30"/></svg>' +
      '<div class="tpr-center"><div class="tpr-lap">1</div><div class="tpr-total">/ 3</div><div class="tpr-label">LAP</div></div>';
    document.body.appendChild(el);
    this._progressRingEl = el;
    this._progressRingFill = el.querySelector('.tpr-fill');
    this._progressRingLapEl = el.querySelector('.tpr-lap');
  }

  _updateTrackProgressRing() {
    if (!this._progressRingFill || !this._state.raceStarted) return;
    var lap = this._state.lap || 1;
    var totalLaps = this._state.totalLaps || 3;
    var halfTrack = this._trackLength / 2;
    var pz = 0;
    if (this._vehicle) pz = this._vehicle.position.z;
    else if (this._barrelVehicle && this._barrelVehicle.physicsBody) pz = this._barrelVehicle.physicsBody.position.z;
    var trackPct = ((pz + halfTrack + this._trackLength) % this._trackLength) / this._trackLength;
    var overallPct = ((lap - 1) + trackPct) / totalLaps;
    var circumference = 2 * Math.PI * 30; // r=30
    this._progressRingFill.style.strokeDashoffset = circumference * (1 - overallPct);
    if (this._progressRingLapEl) this._progressRingLapEl.textContent = Math.min(lap, totalLaps);
  }

  // === CYCLE 36: AI RUBBERBANDING ===
  _createAIRubberbandIndicator() {
    if (document.getElementById('ai-rubberband-indicator')) return;
    var el = document.createElement('div');
    el.id = 'ai-rubberband-indicator';
    el.textContent = 'AI CATCHING UP';
    document.body.appendChild(el);
    this._aiRubberbandEl = el;
  }

  _updateAIRubberband() {
    if (!this._aiRubberbandEl || !this._state.raceStarted || this._aiOpponents.length === 0) return;
    var pos = typeof this._state.position === 'number' ? this._state.position : parseInt(this._state.position);
    // If player is far behind (position > 4), AI eases off; if player is far ahead (position 1), AI catches up
    var newState = '';
    if (pos > 4) newState = 'easing-off';
    else if (pos === 1 && this._state.speed > 30) newState = 'catching-up';
    if (newState !== this._aiRubberbandState) {
      this._aiRubberbandState = newState;
      this._aiRubberbandEl.className = newState;
      this._aiRubberbandEl.textContent = newState === 'catching-up' ? 'AI CATCHING UP' : 'AI EASING OFF';
    }
    // Apply rubberband effect to AI speeds
    for (var i = 0; i < this._aiOpponents.length; i++) {
      var ai = this._aiOpponents[i];
      if (newState === 'catching-up' && ai.speedMultiplier < 1.3) ai.speedMultiplier = Math.min(1.3, ai.speedMultiplier + 0.005);
      else if (newState === 'easing-off' && ai.speedMultiplier > 0.8) ai.speedMultiplier = Math.max(0.8, ai.speedMultiplier - 0.003);
      else if (newState === '' && Math.abs(ai.speedMultiplier - 1.0) > 0.01) ai.speedMultiplier += (1.0 - ai.speedMultiplier) * 0.02;
    }
  }

  // === CYCLE 36: NEON TRACK SIGNS ===
  _createNeonTrackSigns() {
    if (this._neonSigns.length > 0) return;
    var signs = [
      { text: 'DANGER ZONE AHEAD', color: 'sign-orange', z: -this._trackLength * 0.25 },
      { text: 'BOOST SECTION', color: 'sign-green', z: this._trackLength * 0.1 },
      { text: 'WATCH YOUR BACK', color: 'sign-pink', z: this._trackLength * 0.4 },
      { text: 'FINISH LINE NEAR', color: 'sign-cyan', z: this._trackLength * 0.45 }
    ];
    for (var i = 0; i < signs.length; i++) {
      var s = signs[i];
      var el = document.createElement('div');
      el.className = 'neon-track-sign ' + s.color;
      el.textContent = s.text;
      el.style.top = '30%';
      el.style.left = (10 + Math.random() * 60) + '%';
      el._signZ = s.z;
      el._signWidth = 80;
      document.body.appendChild(el);
      this._neonSigns.push(el);
    }
  }

  _updateNeonTrackSigns(dt) {
    if (!this._neonSigns.length || !this._state.raceStarted) return;
    var pz = 0;
    if (this._vehicle) pz = this._vehicle.position.z;
    else if (this._barrelVehicle && this._barrelVehicle.physicsBody) pz = this._barrelVehicle.physicsBody.position.z;
    for (var i = 0; i < this._neonSigns.length; i++) {
      var sign = this._neonSigns[i];
      var dist = Math.abs(pz - sign._signZ);
      var visible = dist < sign._signWidth;
      if (visible !== sign.classList.contains('visible')) {
        sign.classList.toggle('visible', visible);
      }
    }
  }

  // === CYCLE 36: RACE LINE GUIDE ===
  _createRaceLineGuide() {
    if (document.getElementById('race-line-guide')) return;
    var el = document.createElement('div');
    el.id = 'race-line-guide';
    el.innerHTML =
      '<span class="rlg-label">NEXT TURN</span>' +
      '<div class="rlg-arrows"><span class="rlg-arrow"></span><span class="rlg-arrow"></span><span class="rlg-arrow"></span></div>' +
      '<span class="rlg-distance">--</span>';
    document.body.appendChild(el);
    this._raceLineGuideEl = el;
    this._rlgDistanceEl = el.querySelector('.rlg-distance');
  }

  _updateRaceLineGuide() {
    if (!this._raceLineGuideEl || !this._state.raceStarted) return;
    var visible = this._state.speed > 10;
    this._raceLineGuideEl.classList.toggle('visible', visible);
    if (!visible) return;
    // Estimate distance to next turn based on track progress
    var halfTrack = this._trackLength / 2;
    var pz = 0;
    if (this._vehicle) pz = this._vehicle.position.z;
    else if (this._barrelVehicle && this._barrelVehicle.physicsBody) pz = this._barrelVehicle.physicsBody.position.z;
    var progress = ((pz + halfTrack + this._trackLength) % this._trackLength) / this._trackLength;
    var distToTurn = Math.floor((1 - progress) * this._trackLength * 0.15);
    if (this._rlgDistanceEl) this._rlgDistanceEl.textContent = distToTurn + 'm';
  }

  getState() { return { running: this._state.running, paused: this._paused, speed: this._state.speed, position: this._state.position, lap: this._state.lap, aiOpponents: this._aiOpponents }; }
  getScene() { return this._scene; }
  getCamera() { return this._camera; }
  getVehicle() { return this._barrelVehicle || this._vehicle; }
  isUsingBarrelVehicle() { return this._useBarrelVehicle; }
  setSpeed(speed) { this._state.speed = speed; }
  setPosition(pos) { this._state.position = pos; }
  
  reset() {
    this._state.position = 0; this._state.lap = 1; this._state.speed = 0;
    this._steerAngle = 0; this._steerInput = 0; this._heading = 0; this._vehicleRoll = 0; this._minimapUpdateTimer = 0;
    this._boostCharges = 3; this._boostActive = false; this._boostTimer = 0; this._boostRefillTimer = 0;
    this._tireMarks = []; this._shakeIntensity = 0;
    // CYCLE 30: Reset new systems
    this._driftScore = 0; this._driftCombo = 0; this._driftTimer = 0; this._totalDriftScore = 0;
    this._trailParticles.forEach(function(p) { if (p.parent) p.parent.remove(p); p.geometry.dispose(); p.material.dispose(); });
    this._trailParticles = [];
    this._lapSplits = []; this._bestLapTime = null;
    this._speedBoostTimer = 0; this._speedBoostMultiplier = 1.0;
    // CYCLE 31: Cleanup new systems
    this._disableRearView();
    this._finishing = false;
    this._celebrationParticles.forEach(function(p) { if (p.parent) p.parent.remove(p); p.geometry.dispose(); p.material.dispose(); });
    this._celebrationParticles = [];
    // CYCLE 34: Cleanup new systems
    var vig = document.getElementById('dynamic-vignette'); if (vig) vig.remove(); this._vignetteEl = null;
    var hs = document.getElementById('heat-shimmer'); if (hs) hs.remove(); this._heatShimmerEl = null;
    var st = document.getElementById('race-standings-tower'); if (st) st.remove(); this._standingsTower = null; this._standingsRows = [];
    var tc = document.querySelector('.hud-tachometer'); if (tc) tc.remove(); this._tachoContainer = null;
    var rc = document.querySelector('.weather-rain-container'); if (rc) rc.remove();
    var rs = document.querySelector('.weather-splash'); if (rs) rs.remove();
    this._rainContainer = null; this._rainSplash = null; this._rainActive = false;
    var ww = document.querySelector('.wrong-way-indicator'); if (ww) ww.remove(); this._wrongWayEl = null;
    var hzi = document.querySelector('.hazard-zone-indicator'); if (hzi) hzi.remove(); this._hazardIndicator = null;
    // Cleanup hazard zone 3D objects
    for (var i = 0; i < this._hazardZones.length; i++) {
      var hz = this._hazardZones[i];
      if (hz.mesh && hz.mesh.parent) hz.mesh.parent.remove(hz.mesh);
      if (hz.light && hz.light.parent) hz.light.parent.remove(hz.light);
      hz.mesh.geometry.dispose(); hz.mesh.material.dispose();
    }
    this._hazardZones = []; this._inHazardZone = false;
    this._wrongWayTimer = 0; this._wrongWayDetected = false;
    // CYCLE 35: Cleanup new systems
    var ss = document.getElementById('slipstream-indicator'); if (ss) ss.remove(); this._slipstreamEl = null; this._slipstreamFill = null;
    this._slipstreamActive = false; this._slipstreamProgress = 0; this._slipstreamTarget = null;
    var set = document.getElementById('speed-edge-tint'); if (set) set.remove(); this._speedEdgeTint = null; this._lastSpeedTier = '';
    var lf = document.getElementById('lens-flare-container'); if (lf) lf.remove(); this._lensFlareContainer = null;
    var bcf = document.getElementById('boost-cinematic-flash'); if (bcf) bcf.remove(); this._boostCinematicFlash = null;
    var tse = document.querySelector('.tire-smoke-enhanced'); if (tse) tse.remove(); this._tireSmokeEnhanced = null;
    var gc = document.getElementById('ghost-trail-canvas'); if (gc) gc.remove(); this._ghostCanvas = null; this._ghostCtx = null; this._ghostTrail = [];
    var iii = document.getElementById('ice-surface-indicator'); if (iii) iii.remove(); this._iceIndicator = null; this._onIceSurface = false;
    for (var i = 0; i < this._iceZones.length; i++) {
      var iz = this._iceZones[i];
      if (iz.mesh && iz.mesh.parent) iz.mesh.parent.remove(iz.mesh);
      if (iz.light && iz.light.parent) iz.light.parent.remove(iz.light);
      iz.mesh.geometry.dispose(); iz.mesh.material.dispose();
    }
    this._iceZones = [];
    this._raceStats = { maxSpeed: 0, totalDrift: 0, closePasses: 0, timeInLead: 0, cleanLaps: 0, boostUsed: 0, hazardsHit: 0, iceZones: 0 };
    this._raceFinishShown = false;
    var rso = document.getElementById('race-stats-overlay'); if (rso) rso.remove(); this._statsOverlay = null;
    this._speedPanelEl = null;
    // CYCLE 36: Cleanup new systems
    var tso = document.getElementById('turbo-start-overlay'); if (tso) tso.remove(); this._turboStartOverlay = null; this._turboStartActive = false;
    var cmd = document.getElementById('combo-multiplier-display'); if (cmd) cmd.remove(); this._comboDisplayEl = null;
    this._comboMultiplier = 1.0; this._comboTimer = 0; this._comboSources = { drift: false, slipstream: false, boost: false };
    var aec = document.getElementById('ambient-embers-container'); if (aec) aec.remove(); this._emberContainer = null;
    var tpr = document.getElementById('track-progress-ring'); if (tpr) tpr.remove(); this._progressRingEl = null;
    var arb = document.getElementById('ai-rubberband-indicator'); if (arb) arb.remove(); this._aiRubberbandEl = null; this._aiRubberbandState = '';
    for (var i = 0; i < this._neonSigns.length; i++) { if (this._neonSigns[i].parentNode) this._neonSigns[i].parentNode.removeChild(this._neonSigns[i]); }
    this._neonSigns = [];
    var rlg = document.getElementById('race-line-guide'); if (rlg) rlg.remove(); this._raceLineGuideEl = null; this._rlgDistanceEl = null;

    // CYCLE 37: Cleanup new systems
    var mbo = document.getElementById('motion-blur-overlay'); if (mbo) mbo.remove(); this._motionBlurEl = null;
    var nag = document.getElementById('neon-ambient-glow'); if (nag) nag.remove(); this._neonGlowEl = null;
    var se = document.getElementById('scanline-effect'); if (se) se.remove(); this._scanlineEl = null;
    var dss = document.getElementById('drift-spark-shower'); if (dss) dss.remove(); this._sparkShowerEl = null;
    var dv = document.getElementById('damage-vignette'); if (dv) dv.remove(); this._damageVignetteEl = null;
    var wsi = document.getElementById('wheel-spin-indicator'); if (wsi) wsi.remove(); this._wheelSpinEl = null;
    var pcb = document.getElementById('position-change-banner'); if (pcb) pcb.remove(); this._posBannerEl = null;
    var bcd = document.getElementById('boost-chain-display'); if (bcd) bcd.remove(); this._boostChainEl = null; this._boostChainCount = 0;
    var ref = document.getElementById('race-event-feed'); if (ref) ref.remove(); this._eventFeedEl = null;
    var ebc = document.getElementById('energy-bar-container'); if (ebc) ebc.remove();
    var ebl = document.getElementById('energy-bar-label'); if (ebl) ebl.remove();
    this._energyFillEl = null;
    var tdg = document.getElementById('tech-dot-grid'); if (tdg) tdg.remove();
    var hcf = document.getElementById('hud-corner-frame'); if (hcf) hcf.remove(); this._cornerFrameEl = null;

    if (this._useBarrelVehicle && this._barrelVehicle && this._barrelVehicle.physicsBody) { this._barrelVehicle.physicsBody.position.set(0, 1, -this._trackLength / 2 + 15); this._barrelVehicle.physicsBody.velocity.set(0, 0, 0); }
    else if (this._vehicle) { this._vehicle.position.set(0, 0.5, -this._trackLength / 2 + 15); this._vehicle.rotation.y = 0; this._vehicle.rotation.z = 0; }
  }
}


  // ==================== CYCLE 37: NEW FEATURES ====================

  // --- 1. MOTION BLUR OVERLAY ---
  _createMotionBlurOverlay() {
    var el = document.createElement('div');
    el.id = 'motion-blur-overlay';
    // Pre-create streak elements
    for (var i = 0; i < 6; i++) {
      var streak = document.createElement('div');
      streak.className = 'blur-streak';
      streak.style.top = (20 + Math.random() * 60) + '%';
      streak.style.width = (80 + Math.random() * 200) + 'px';
      streak.style.animationDelay = (i * 0.12) + 's';
      streak.style.animationDuration = (0.4 + Math.random() * 0.4) + 's';
      el.appendChild(streak);
    }
    document.body.appendChild(el);
    this._motionBlurEl = el;
  }
  _updateMotionBlur() {
    if (!this._motionBlurEl) return;
    var speed = this._state.speed || 0;
    if (speed > 60) {
      this._motionBlurEl.classList.add('active');
      this._motionBlurEl.style.opacity = Math.min(1, (speed - 60) / 80);
    } else {
      this._motionBlurEl.classList.remove('active');
    }
  }

  // --- 2. NEON AMBIENT GLOW ---
  _createNeonAmbientGlow() {
    var el = document.createElement('div');
    el.id = 'neon-ambient-glow';
    document.body.appendChild(el);
    this._neonGlowEl = el;
  }
  _updateNeonGlow() {
    if (!this._neonGlowEl) return;
    var speed = this._state.speed || 0;
    // Intensify glow at higher speeds, shift color when boosting
    if (this._boostActive) {
      this._neonGlowEl.style.boxShadow =
        'inset 0 0 100px -20px rgba(0,229,255,0.15),' +
        'inset 0 0 160px -40px rgba(0,229,255,0.1),' +
        'inset 0 -80px 120px -30px rgba(0,229,255,0.08)';
    } else {
      var intensity = Math.min(1, speed / 100);
      this._neonGlowEl.style.opacity = 0.3 + intensity * 0.4;
    }
  }

  // --- 3. SCANLINE EFFECT ---
  _createScanlineEffect() {
    var el = document.createElement('div');
    el.id = 'scanline-effect';
    document.body.appendChild(el);
    this._scanlineEl = el;
  }
  _updateScanlineEffect() {
    if (!this._scanlineEl) return;
    if (this._boostActive) {
      this._scanlineEl.classList.add('speed-boost');
    } else {
      this._scanlineEl.classList.remove('speed-boost');
    }
  }

  // --- 4. DRIFT SPARK SHOWER ---
  _createDriftSparkShower() {
    var el = document.createElement('div');
    el.id = 'drift-spark-shower';
    document.body.appendChild(el);
    this._sparkShowerEl = el;
    this._sparkShowerTimer = 0;
  }
  _updateDriftSparks(dt) {
    if (!this._sparkShowerEl) return;
    if (this._driftTimer > 0.5 && this._state.speed > 20) {
      this._sparkShowerEl.classList.add('active');
      this._sparkShowerTimer += dt;
      if (this._sparkShowerTimer > 0.05) {
        this._sparkShowerTimer = 0;
        var spark = document.createElement('div');
        spark.className = 'drift-spark';
        spark.style.left = (10 + Math.random() * 100) + 'px';
        spark.style.setProperty('--sx', (Math.random() * 60 - 30) + 'px');
        spark.style.setProperty('--sy', (20 + Math.random() * 40) + 'px');
        spark.style.setProperty('--spark-dur', (0.3 + Math.random() * 0.5) + 's');
        // Random warm colors for sparks
        var colors = ['#ffd23f', '#ff8c00', '#ff4d2e', '#ffffff'];
        spark.style.background = colors[Math.floor(Math.random() * colors.length)];
        spark.style.boxShadow = '0 0 6px ' + spark.style.background;
        this._sparkShowerEl.appendChild(spark);
        setTimeout(function() { if (spark.parentNode) spark.parentNode.removeChild(spark); }, 1000);
      }
    } else {
      this._sparkShowerEl.classList.remove('active');
    }
  }

  // --- 5. DAMAGE VIGNETTE ---
  _createDamageVignette() {
    var el = document.createElement('div');
    el.id = 'damage-vignette';
    document.body.appendChild(el);
    this._damageVignetteEl = el;
    this._damageVignetteTimer = 0;
  }
  _triggerDamageVignette() {
    if (!this._damageVignetteEl) return;
    this._damageVignetteEl.classList.remove('active');
    // Force reflow for animation restart
    void this._damageVignetteEl.offsetWidth;
    this._damageVignetteEl.classList.add('active');
    clearTimeout(this._damageVignetteTimer);
    this._damageVignetteTimer = setTimeout(function() {
      if (this._damageVignetteEl) this._damageVignetteEl.classList.remove('active');
    }.bind(this), 600);
  }

  // --- 6. WHEEL SPIN INDICATOR ---
  _createWheelSpinIndicator() {
    var el = document.createElement('div');
    el.id = 'wheel-spin-indicator';
    el.innerHTML = '<div class="wheel-spin-icon"></div><span class="wheel-spin-label">TIRE SPIN</span>';
    document.body.appendChild(el);
    this._wheelSpinEl = el;
  }
  _updateWheelSpin() {
    if (!this._wheelSpinEl) return;
    var spinning = (this._keys.throttle && this._state.speed < 5 && this._state.raceStarted);
    if (spinning) {
      this._wheelSpinEl.classList.add('active');
    } else {
      this._wheelSpinEl.classList.remove('active');
    }
  }

  // --- 7. POSITION CHANGE BANNER ---
  _createPositionBanner() {
    var el = document.createElement('div');
    el.id = 'position-change-banner';
    document.body.appendChild(el);
    this._posBannerEl = el;
    this._lastPosition = 0;
    this._posBannerTimer = null;
  }
  _showPositionBanner(newPos) {
    if (!this._posBannerEl || !this._lastPosition) { this._lastPosition = newPos; return; }
    if (newPos === this._lastPosition) return;
    var gained = newPos < this._lastPosition;
    this._posBannerEl.textContent = gained ? 'P' + newPos : 'P' + newPos;
    this._posBannerEl.className = gained ? 'show gain' : 'show loss';
    clearTimeout(this._posBannerTimer);
    this._posBannerTimer = setTimeout(function() {
      if (this._posBannerEl) this._posBannerEl.className = '';
    }.bind(this), 1200);
    this._lastPosition = newPos;
  }

  // --- 8. BOOST CHAIN DISPLAY ---
  _createBoostChainDisplay() {
    var el = document.createElement('div');
    el.id = 'boost-chain-display';
    el.innerHTML = '<span class="boost-chain-label">CHAIN</span>';
    for (var i = 0; i < 5; i++) {
      var dot = document.createElement('div');
      dot.className = 'boost-chain-dot';
      el.appendChild(dot);
    }
    document.body.appendChild(el);
    this._boostChainEl = el;
    this._boostChainCount = 0;
    this._boostChainDecay = 0;
  }
  _addBoostChain() {
    if (!this._boostChainEl) return;
    this._boostChainCount = Math.min(5, this._boostChainCount + 1);
    this._boostChainDecay = 4; // 4 seconds to decay
    var dots = this._boostChainEl.querySelectorAll('.boost-chain-dot');
    for (var i = 0; i < dots.length; i++) {
      if (i < this._boostChainCount) dots[i].classList.add('filled');
      else dots[i].classList.remove('filled');
    }
    if (this._boostChainCount >= 2) this._boostChainEl.classList.add('active');
  }
  _updateBoostChain(dt) {
    if (!this._boostChainEl) return;
    if (this._boostChainCount > 0) {
      this._boostChainDecay -= dt;
      if (this._boostChainDecay <= 0) {
        this._boostChainCount = 0;
        var dots = this._boostChainEl.querySelectorAll('.boost-chain-dot');
        for (var i = 0; i < dots.length; i++) dots[i].classList.remove('filled');
        this._boostChainEl.classList.remove('active');
      }
    }
  }

  // --- 9. BOOST BURST PARTICLES ---
  _triggerBoostBurst() {
    var cx = window.innerWidth / 2;
    var cy = window.innerHeight / 2;
    for (var i = 0; i < 12; i++) {
      var p = document.createElement('div');
      p.className = 'boost-burst-particle';
      p.style.left = cx + 'px';
      p.style.top = cy + 'px';
      var angle = (i / 12) * Math.PI * 2;
      var dist = 80 + Math.random() * 120;
      p.style.setProperty('--bx', Math.cos(angle) * dist + 'px');
      p.style.setProperty('--by', Math.sin(angle) * dist + 'px');
      var colors = ['#00e5ff', '#00ffcc', '#ffd23f', '#ffffff'];
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      p.style.boxShadow = '0 0 8px ' + p.style.background;
      document.body.appendChild(p);
      setTimeout(function() { if (p.parentNode) p.parentNode.removeChild(p); }, 900);
    }
  }

  // --- 10. RACE EVENT FEED ---
  _createRaceEventFeed() {
    var el = document.createElement('div');
    el.id = 'race-event-feed';
    document.body.appendChild(el);
    this._eventFeedEl = el;
  }
  _addRaceEvent(text, type) {
    if (!this._eventFeedEl) return;
    var item = document.createElement('div');
    item.className = 'race-event-item event-' + (type || 'boost');
    item.textContent = text;
    this._eventFeedEl.appendChild(item);
    // Auto-remove after animation
    setTimeout(function() { if (item.parentNode) item.parentNode.removeChild(item); }, 3200);
    // Limit feed items
    while (this._eventFeedEl.children.length > 5) {
      this._eventFeedEl.removeChild(this._eventFeedEl.firstChild);
    }
  }

  // --- 11. ENERGY BAR ---
  _createEnergyBar() {
    var label = document.createElement('div');
    label.id = 'energy-bar-label';
    label.textContent = 'NITRO';
    document.body.appendChild(label);
    var container = document.createElement('div');
    container.id = 'energy-bar-container';
    var fill = document.createElement('div');
    fill.id = 'energy-bar-fill';
    container.appendChild(fill);
    document.body.appendChild(container);
    this._energyFillEl = fill;
  }
  _updateEnergyBar() {
    if (!this._energyFillEl) return;
    var pct = (this._boostCharges / this._boostMaxCharges) * 100;
    this._energyFillEl.style.height = pct + '%';
    // Color changes based on charge level
    if (pct <= 33) {
      this._energyFillEl.style.background = 'linear-gradient(0deg, #ff3d5a, #ff6b6b)';
      this._energyFillEl.style.boxShadow = '0 0 10px rgba(255,61,90,0.4)';
    } else if (pct <= 66) {
      this._energyFillEl.style.background = 'linear-gradient(0deg, #ffd23f, #ff8c00)';
      this._energyFillEl.style.boxShadow = '0 0 10px rgba(255,210,63,0.4)';
    } else {
      this._energyFillEl.style.background = 'linear-gradient(0deg, #00e5ff, #00ffcc)';
      this._energyFillEl.style.boxShadow = '0 0 10px rgba(0,229,255,0.4)';
    }
  }

  // --- 12. TECH DOT GRID ---
  _createTechDotGrid() {
    var el = document.createElement('div');
    el.id = 'tech-dot-grid';
    document.body.appendChild(el);
  }

  // --- 13. HUD CORNER FRAME ---
  _createHUDCornerFrame() {
    var el = document.createElement('div');
    el.id = 'hud-corner-frame';
    el.innerHTML = '<div class="corner corner-tl"></div><div class="corner corner-tr"></div><div class="corner corner-bl"></div><div class="corner corner-br"></div>';
    document.body.appendChild(el);
    this._cornerFrameEl = el;

    // CYCLE 38: Lightning flash during rain
    this._lightningFlashEl = null;
    this._lightningTimer = 0;
    this._lightningInterval = 12.0;
    this._lightningActive = false;

    // CYCLE 38: Cinematic letterbox bars
    this._letterboxTop = null;
    this._letterboxBottom = null;
    this._letterboxActive = false;
    this._letterboxTimer = 0;

    // CYCLE 38: Afterburner glow (3D point light + particles)
    this._afterburnerLight = null;
    this._afterburnerParticles = [];
    this._afterburnerMaxParticles = 30;

    // CYCLE 38: Holographic HUD shimmer
    this._holoShimmerEl = null;
    this._holoShimmerPhase = 0;

    // CYCLE 38: Neon underglow under vehicle
    this._underglowLight = null;
    this._underglowColor = new THREE.Color(0x00e5ff);
    this._underglowTargetColor = new THREE.Color(0x00e5ff);

    // CYCLE 38: Screen chromatic aberration
    this._chromaticAberrationEl = null;

    // CYCLE 38: Vehicle headlights
    this._headlights = [];
    this._headlightTarget = null;

    // CYCLE 38: Best lap celebration
    this._bestLapCelebrationEl = null;
    this._bestLapCelebrationTimer = 0;

    // CYCLE 38: Position history sparkline
    this._positionHistory = [];
    this._positionHistoryMax = 120;
    this._positionHistoryTimer = 0;
    this._sparklineCanvas = null;
    this._sparklineCtx = null;

    // CYCLE 38: Checkpoint time bonus
    this._checkpoints = [];
    this._nextCheckpointIndex = 0;
    this._checkpointBonusEl = null;
    this._checkpointBonusTimer = 0;

    // CYCLE 38: Contextual camera shake
    this._contextShakeIntensity = 0;
    this._contextShakeDecay = 8;
    this._cameraDutch = 0;
    // CYCLE 39: Speed lines screen overlay
    this._speedLinesOverlay = null;
    // CYCLE 39: Track edge glow pulse
    this._trackEdgeGlowPhase = 0;
    // CYCLE 39: Exhaust particle emitters
    this._exhaustEmitters = [];
    this._exhaustTimer = 0;
    // CYCLE 39: Dynamic sky color shift
    this._skyShiftActive = false;
    this._skyTargetColor = null;
    // CYCLE 39: Vignette pulse on low health
    this._lowHealthPulseActive = false;
    this._lowHealthPulseTimer = 0;
    // CYCLE 39: Powerup collect burst
    this._powerupBurstEl = null;
    this._powerupBurstTimer = 0;
    // CYCLE 39: Race progress percentage display
    this._raceProgressEl = null;
    // CYCLE 39: Finish line camera slow-mo
    this._finishSlowMo = false;
    this._finishSlowMoTimer = 0;
    this._originalTimeScale = 1.0;
    // CYCLE 39: Minimap position dots for AI
    this._minimapPlayerDot = null;
    // CYCLE 39: Combo break notification
    this._comboBreakEl = null;
    this._comboBreakTimer = 0;
    // CYCLE 39: Speed zone visual
    this._speedZoneEl = null;
    this._inSpeedZone = false;
    // CYCLE 39: Tire screech audio visual
    this._tireScreechEl = null;

    this._cameraDutchTarget = 0;
  }
  _updateHUDCornerFrame() {
    if (!this._cornerFrameEl) return;
    // Show frame only during race, hide in menus
    if (this._state.running) {
      this._cornerFrameEl.style.opacity = '0.12';
    } else {
      this._cornerFrameEl.style.opacity = '0';
    }
  }

  // --- 14. CHROMATIC SPEED TEXT ---
  _applyChromaticSpeedText() {
    if (!this._speedPanelEl) return;
    var speed = this._state.speed || 0;
    var nums = this._speedPanelEl.querySelectorAll('.speed-value, .hud-data-tick');
    for (var i = 0; i < nums.length; i++) {
      if (speed > 70) nums[i].classList.add('chromatic-speed-text', 'intense');
      else if (speed > 40) nums[i].classList.add('chromatic-speed-text');
      else nums[i].classList.remove('chromatic-speed-text', 'intense');
    }
  }



  // ============================================================
  // CYCLE 38: SETUP
  // ============================================================
  _setupCycle38Systems() {
    this._createLightningFlash();
    this._createLetterboxBars();
    this._createAfterburnerSystem();
    this._createHoloShimmer();
    this._createUnderglow();
    this._createChromaticAberration();
    this._createVehicleHeadlights();
    this._createBestLapCelebration();
    this._createPositionSparkline();
    this._createCheckpointBonusDisplay();
    this._createCheckpointZones();
    console.log('[RaceScene] Cycle 38 systems initialized (6 styling + 6 features)');
  }

  // --- STYLING 1: LIGHTNING FLASH ---
  _createLightningFlash() {
    var el = document.createElement('div');
    el.id = 'lightning-flash-overlay';
    el.className = 'lightning-inactive';
    document.body.appendChild(el);
    this._lightningFlashEl = el;
  }

  _updateLightningFlash(dt) {
    if (!this._lightningFlashEl) return;
    if (!this._rainActive) { this._lightningFlashEl.className = 'lightning-inactive'; return; }
    this._lightningTimer += dt;
    if (this._lightningTimer >= this._lightningInterval) {
      this._lightningTimer = 0;
      this._lightningInterval = 8.0 + Math.random() * 10.0;
      var self = this;
      this._lightningFlashEl.classList.add('lightning-active');
      this._lightningActive = true;
      this._triggerContextShake(0.3, 4.0);
      setTimeout(function() {
        if (self._lightningFlashEl) self._lightningFlashEl.classList.replace('lightning-active', 'lightning-afterflash');
        setTimeout(function() {
          if (self._lightningFlashEl) self._lightningFlashEl.classList.replace('lightning-afterflash', 'lightning-inactive');
          self._lightningActive = false;
        }, 150);
      }, 100);
    }
  }

  // --- STYLING 2: CINEMATIC LETTERBOX ---
  _createLetterboxBars() {
    this._letterboxTop = document.createElement('div');
    this._letterboxTop.id = 'letterbox-bar-top';
    this._letterboxBottom = document.createElement('div');
    this._letterboxBottom.id = 'letterbox-bar-bottom';
    document.body.appendChild(this._letterboxTop);
    document.body.appendChild(this._letterboxBottom);
  }
  _showLetterbox(dur) {
    this._letterboxActive = true;
    this._letterboxTimer = dur || 2.0;
    if (this._letterboxTop) this._letterboxTop.classList.add('active');
    if (this._letterboxBottom) this._letterboxBottom.classList.add('active');
  }
  _hideLetterbox() {
    this._letterboxActive = false;
    if (this._letterboxTop) this._letterboxTop.classList.remove('active');
    if (this._letterboxBottom) this._letterboxBottom.classList.remove('active');
  }
  _updateLetterbox(dt) {
    if (!this._letterboxActive) return;
    this._letterboxTimer -= dt;
    if (this._letterboxTimer <= 0) this._hideLetterbox();
  }

  // --- STYLING 3: AFTERBURNER GLOW (3D) ---
  _createAfterburnerSystem() {
    if (!this._scene) return;
    this._afterburnerLight = new THREE.PointLight(0x00e5ff, 0, 15);
    this._afterburnerLight.position.set(0, 0.5, -1.5);
    var geo = new THREE.SphereGeometry(0.08, 4, 4);
    for (var i = 0; i < this._afterburnerMaxParticles; i++) {
      var mat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0 });
      var p = new THREE.Mesh(geo, mat);
      p.visible = false;
      p.userData = { life: 0, maxLife: 0.6, vel: new THREE.Vector3() };
      this._scene.add(p);
      this._afterburnerParticles.push(p);
    }
  }
  _updateAfterburner(dt) {
    if (!this._afterburnerLight) return;
    var v = this._barrelVehicle ? this._barrelVehicle.mesh : this._vehicle;
    if (!v) return;
    if (this._boostActive) {
      var wp = new THREE.Vector3(0, 0.3, -1.5);
      v.localToWorld(wp);
      this._afterburnerLight.position.copy(wp);
      this._afterburnerLight.intensity = 3.0 + Math.sin(Date.now() * 0.02) * 1.5;
      this._afterburnerLight.color.setHex(Math.random() > 0.5 ? 0x00e5ff : 0x00ffcc);
      if (Math.random() < 0.6) {
        for (var i = 0; i < this._afterburnerParticles.length; i++) {
          if (!this._afterburnerParticles[i].visible) {
            var dead = this._afterburnerParticles[i];
            dead.visible = true;
            dead.position.copy(wp);
            dead.material.opacity = 0.9;
            dead.material.color.setHex([0x00e5ff, 0x00ffcc, 0xffd23f, 0xffffff][Math.floor(Math.random()*4)]);
            dead.scale.setScalar(0.5 + Math.random());
            dead.userData.life = dead.userData.maxLife;
            var bk = new THREE.Vector3(0, 0, -1);
            v.localToWorld(bk);
            bk.sub(wp).normalize().multiplyScalar(3 + Math.random() * 5);
            bk.y += (Math.random() - 0.5) * 2;
            dead.userData.vel.copy(bk);
            break;
          }
        }
      }
    } else {
      this._afterburnerLight.intensity *= 0.85;
    }
    for (var j = 0; j < this._afterburnerParticles.length; j++) {
      var p = this._afterburnerParticles[j];
      if (!p.visible) continue;
      p.userData.life -= dt;
      if (p.userData.life <= 0) { p.visible = false; continue; }
      p.position.add(p.userData.vel.clone().multiplyScalar(dt));
      p.material.opacity = (p.userData.life / p.userData.maxLife) * 0.8;
      p.scale.multiplyScalar(0.97);
    }
  }

  // --- STYLING 4: HOLOGRAPHIC HUD SHIMMER ---
  _createHoloShimmer() {
    var el = document.createElement('div');
    el.id = 'holo-shimmer-overlay';
    document.body.appendChild(el);
    this._holoShimmerEl = el;
  }
  _updateHoloShimmer(dt) {
    if (!this._holoShimmerEl) return;
    this._holoShimmerPhase += dt * 0.5;
    if (this._state.running && this._state.raceStarted) {
      var intensity = Math.min(this._state.speed / 50, 1) * 0.06;
      this._holoShimmerEl.style.opacity = String(intensity);
      var hue = (this._holoShimmerPhase * 60) % 360;
      this._holoShimmerEl.style.background = 'linear-gradient(' + hue + 'deg, transparent 0%, rgba(0,229,255,0.03) 25%, transparent 50%, rgba(255,77,46,0.02) 75%, transparent 100%)';
    } else {
      this._holoShimmerEl.style.opacity = '0';
    }
  }

  // --- STYLING 5: NEON UNDERGLOW ---
  _createUnderglow() {
    if (!this._scene) return;
    this._underglowLight = new THREE.PointLight(0x00e5ff, 0, 8);
    this._underglowLight.position.set(0, -0.3, 0);
  }
  _updateUnderglow(dt) {
    if (!this._underglowLight) return;
    var v = this._barrelVehicle ? this._barrelVehicle.mesh : this._vehicle;
    if (!v) return;
    var up = new THREE.Vector3(0, -0.2, 0);
    v.localToWorld(up);
    this._underglowLight.position.copy(up);
    if (this._boostActive) { this._underglowTargetColor.setHex(0x00ffcc); this._underglowLight.intensity = 2.5; }
    else if (this._keys.drift && this._state.speed > 20) { this._underglowTargetColor.setHex(0xffd23f); this._underglowLight.intensity = 2.0; }
    else if (this._slipstreamActive) { this._underglowTargetColor.setHex(0xff4d2e); this._underglowLight.intensity = 1.8; }
    else { this._underglowTargetColor.setHex(0x00e5ff); this._underglowLight.intensity = 1.0 + Math.sin(Date.now() * 0.003) * 0.3; }
    this._underglowColor.lerp(this._underglowTargetColor, 0.1);
    this._underglowLight.color.copy(this._underglowColor);
    if (!this._underglowLight.parent && this._scene) this._scene.add(this._underglowLight);
  }

  // --- STYLING 6: CHROMATIC ABERRATION ---
  _createChromaticAberration() {
    var el = document.createElement('div');
    el.id = 'chromatic-aberration-overlay';
    document.body.appendChild(el);
    this._chromaticAberrationEl = el;
  }
  _updateChromaticAberration() {
    if (!this._chromaticAberrationEl) return;
    var speed = this._state.speed || 0;
    var intensity = 0;
    if (this._boostActive) intensity = 4;
    else if (speed > 50) intensity = 2 + (speed - 50) / 10;
    else if (speed > 30) intensity = (speed - 30) / 20 * 2;
    this._chromaticAberrationEl.style.setProperty('--ca-intensity', intensity + 'px');
  }

  // --- FEATURE 1: VEHICLE HEADLIGHTS ---
  _createVehicleHeadlights() {
    if (!this._scene) return;
    var sl1 = new THREE.SpotLight(0xffeedd, 2, 40, Math.PI / 6, 0.5, 1);
    sl1.position.set(-0.4, 0.2, 1.2);
    var sl2 = new THREE.SpotLight(0xffeedd, 2, 40, Math.PI / 6, 0.5, 1);
    sl2.position.set(0.4, 0.2, 1.2);
    this._headlightTarget = new THREE.Object3D();
    this._headlightTarget.position.set(0, 0, 20);
    sl1.target = this._headlightTarget;
    sl2.target = this._headlightTarget;
    this._headlights = [sl1, sl2];
  }
  _updateVehicleHeadlights() {
    if (!this._headlights.length || !this._scene) return;
    var v = this._barrelVehicle ? this._barrelVehicle.mesh : this._vehicle;
    if (!v) return;
    for (var i = 0; i < this._headlights.length; i++) {
      var hl = this._headlights[i];
      var offset = new THREE.Vector3(i === 0 ? -0.4 : 0.4, 0.2, 1.2);
      v.localToWorld(offset);
      hl.position.copy(offset);
      var ahead = new THREE.Vector3(0, 0, 20);
      v.localToWorld(ahead);
      hl.target.position.copy(ahead);
      if (!hl.parent) this._scene.add(hl);
      if (!hl.target.parent) this._scene.add(hl.target);
      hl.intensity = this._state.speed > 40 ? 2.5 + Math.sin(Date.now() * 0.01) * 0.3 : 2.0;
    }
  }

  // --- FEATURE 2: BEST LAP CELEBRATION ---
  _createBestLapCelebration() {
    var el = document.createElement('div');
    el.id = 'best-lap-celebration';
    el.innerHTML = '<div class="best-lap-icon">NEW BEST</div><div class="best-lap-time" id="best-lap-time-display"></div><div class="best-lap-subtitle">PERSONAL RECORD</div>';
    document.body.appendChild(el);
    this._bestLapCelebrationEl = el;
  }
  _triggerBestLapCelebration(lapTime) {
    if (!this._bestLapCelebrationEl) return;
    var ts = this._formatTime(lapTime);
    var te = document.getElementById('best-lap-time-display');
    if (te) te.textContent = ts;
    this._bestLapCelebrationEl.classList.remove('show');
    void this._bestLapCelebrationEl.offsetWidth;
    this._bestLapCelebrationEl.classList.add('show');
    this._bestLapCelebrationTimer = 3.5;
    this._showLetterbox(2.0);
    this._triggerContextShake(0.15, 2.0);
    this._addRaceEvent('NEW PERSONAL BEST! ' + ts, 'record');
  }
  _updateBestLapCelebration(dt) {
    if (!this._bestLapCelebrationEl || this._bestLapCelebrationTimer <= 0) return;
    this._bestLapCelebrationTimer -= dt;
    if (this._bestLapCelebrationTimer <= 0) this._bestLapCelebrationEl.classList.remove('show');
  }

  // --- FEATURE 3: POSITION HISTORY SPARKLINE ---
  _createPositionSparkline() {
    this._sparklineCanvas = document.createElement('canvas');
    this._sparklineCanvas.id = 'position-sparkline';
    this._sparklineCanvas.width = 200;
    this._sparklineCanvas.height = 50;
    document.body.appendChild(this._sparklineCanvas);
    this._sparklineCtx = this._sparklineCanvas.getContext('2d');
  }
  _updatePositionHistory(dt) {
    this._positionHistoryTimer += dt;
    if (this._positionHistoryTimer < 1.0) return;
    this._positionHistoryTimer = 0;
    if (!this._state.raceStarted) return;
    this._positionHistory.push(this._state.position);
    if (this._positionHistory.length > this._positionHistoryMax) this._positionHistory.shift();
    this._drawSparkline();
  }
  _drawSparkline() {
    if (!this._sparklineCtx || this._positionHistory.length < 2) return;
    var ctx = this._sparklineCtx, w = this._sparklineCanvas.width, h = this._sparklineCanvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(5,6,10,0.7)';
    ctx.fillRect(0, 0, w, h);
    var data = this._positionHistory, maxPos = 8, step = w / (this._positionHistoryMax - 1);
    var startIdx = Math.max(0, this._positionHistoryMax - data.length);
    var grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(0,229,255,0.3)'); grad.addColorStop(1, 'rgba(0,229,255,0.9)');
    ctx.strokeStyle = grad; ctx.lineWidth = 2; ctx.beginPath();
    for (var i = 0; i < data.length; i++) {
      var x = (startIdx + i) * step;
      var y = h - ((maxPos - data[i]) / (maxPos - 1)) * (h - 8) - 4;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    var lastX = (startIdx + data.length - 1) * step;
    ctx.lineTo(lastX, h); ctx.lineTo(startIdx * step, h); ctx.closePath();
    var fg = ctx.createLinearGradient(0, 0, 0, h);
    fg.addColorStop(0, 'rgba(0,229,255,0.15)'); fg.addColorStop(1, 'rgba(0,229,255,0.01)');
    ctx.fillStyle = fg; ctx.fill();
    if (data.length > 0) {
      var lastY = h - ((maxPos - data[data.length - 1]) / (maxPos - 1)) * (h - 8) - 4;
      ctx.beginPath(); ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#00e5ff'; ctx.fill();
      ctx.strokeStyle = 'rgba(0,229,255,0.4)'; ctx.lineWidth = 6; ctx.stroke();
    }
    ctx.font = '9px JetBrains Mono, monospace'; ctx.fillStyle = 'rgba(0,229,255,0.5)';
    ctx.fillText('P' + (data.length > 0 ? data[data.length-1] : '-'), 4, 12);
  }

  // --- FEATURE 4: CHECKPOINT TIME BONUS ---
  _createCheckpointBonusDisplay() {
    var el = document.createElement('div');
    el.id = 'checkpoint-bonus-display';
    document.body.appendChild(el);
    this._checkpointBonusEl = el;
  }
  _createCheckpointZones() {
    // Create 3 checkpoint zones along the track at 25%, 50%, 75%
    if (!this._track) return;
    this._checkpoints = [
      { progress: 0.25, passed: false, name: 'CP1' },
      { progress: 0.50, passed: false, name: 'CP2' },
      { progress: 0.75, passed: false, name: 'CP3' }
    ];
  }
  _updateCheckpointBonus(dt) {
    if (!this._checkpoints.length || !this._state.raceStarted) return;
    if (this._checkpointBonusTimer > 0) {
      this._checkpointBonusTimer -= dt;
      if (this._checkpointBonusTimer <= 0 && this._checkpointBonusEl) {
        this._checkpointBonusEl.classList.remove('show');
      }
    }
    var progress = this._state.position / this._trackLength;
    for (var i = 0; i < this._checkpoints.length; i++) {
      var cp = this._checkpoints[i];
      if (!cp.passed && progress >= cp.progress) {
        cp.passed = true;
        this._showCheckpointBonus(cp.name, i);
      }
    }
    // Reset checkpoints on new lap
    if (this._state.position < 10 && this._checkpoints[0] && this._checkpoints[0].passed) {
      for (var j = 0; j < this._checkpoints.length; j++) this._checkpoints[j].passed = false;
    }
  }
  _showCheckpointBonus(name, index) {
    if (!this._checkpointBonusEl) return;
    var bonuses = ['+0.5s', '+0.3s', '+0.2s'];
    var bonusText = bonuses[index] || '+0.3s';
    this._checkpointBonusEl.textContent = name + ' ' + bonusText + ' TIME BONUS';
    this._checkpointBonusEl.classList.remove('show');
    void this._checkpointBonusEl.offsetWidth;
    this._checkpointBonusEl.classList.add('show');
    this._checkpointBonusTimer = 2.0;
    this._addRaceEvent(name + ' CHECKPOINT ' + bonusText, 'boost');
  }

  // --- FEATURE 5: CONTEXTUAL CAMERA SHAKE ---
  _triggerContextShake(intensity, decay) {
    this._contextShakeIntensity = Math.max(this._contextShakeIntensity, intensity || 0.2);
    this._contextShakeDecay = decay || 8.0;
  }
  _updateContextualShake(dt) {
    if (this._contextShakeIntensity <= 0.001) { this._contextShakeIntensity = 0; return; }
    this._contextShakeIntensity *= Math.exp(-this._contextShakeDecay * dt);
    if (this._camera) {
      this._camera.position.x += (Math.random() - 0.5) * this._contextShakeIntensity * 2;
      this._camera.position.y += (Math.random() - 0.5) * this._contextShakeIntensity;
    }
  }

  // --- FEATURE 6: CAMERA DUTCH ANGLE ---
  _updateCameraDutch(dt) {
    if (!this._camera) return;
    // Target dutch angle based on steering and drift
    if (this._keys.drift && this._state.speed > 20) {
      var steerDir = (this._keys.steerLeft ? -1 : 0) + (this._keys.steerRight ? 1 : 0);
      this._cameraDutchTarget = steerDir * 0.08;
    } else if (this._boostActive) {
      this._cameraDutchTarget = (Math.random() - 0.5) * 0.02;
    } else {
      this._cameraDutchTarget = 0;
    }
    this._cameraDutch += (this._cameraDutchTarget - this._cameraDutch) * 3.0 * dt;
    // Apply roll via up vector rotation
    var up = new THREE.Vector3(0, 1, 0);
    up.applyAxisAngle(new THREE.Vector3(0, 0, 1), this._cameraDutch);
    this._camera.up.copy(up);
  }



  // ============================================================
  // CYCLE 39: SETUP
  // ============================================================
  _setupCycle39Systems() {
    this._createSpeedLinesOverlay();
    this._createPowerupBurst();
    this._createRaceProgressDisplay();
    this._createComboBreakNotification();
    this._createSpeedZoneVisual();
    this._createTireScreechVisual();
    console.log('[RaceScene] Cycle 39 systems initialized (6 styling + 6 features)');
  }

  // --- STYLING 1: SPEED LINES SCREEN OVERLAY ---
  _createSpeedLinesOverlay() {
    var el = document.createElement('div');
    el.id = 'speed-lines-overlay-c39';
    document.body.appendChild(el);
    this._speedLinesOverlay = el;
  }
  _updateSpeedLinesOverlay() {
    if (!this._speedLinesOverlay) return;
    var speed = this._state.speed || 0;
    if (speed > 35) {
      var intensity = Math.min((speed - 35) / 40, 1);
      this._speedLinesOverlay.style.opacity = String(intensity * 0.15);
      var count = Math.floor(intensity * 8) + 2;
      var bg = 'repeating-linear-gradient(90deg, transparent, transparent ' + (60 - intensity * 30) + 'px, rgba(0,229,255,' + (intensity * 0.12) + ') ' + (61 - intensity * 30) + 'px, transparent ' + (62 - intensity * 30) + 'px)';
      this._speedLinesOverlay.style.background = bg;
    } else {
      this._speedLinesOverlay.style.opacity = '0';
    }
  }

  // --- STYLING 2: TRACK EDGE GLOW PULSE ---
  _updateTrackEdgeGlow(dt) {
    if (!this._barrierWalls || !this._barrierWalls.length) return;
    this._trackEdgeGlowPhase += dt * 2.0;
    var pulse = (Math.sin(this._trackEdgeGlowPhase) + 1) * 0.5;
    for (var i = 0; i < this._barrierWalls.length; i++) {
      var wall = this._barrierWalls[i];
      if (wall.material && wall.material.emissive) {
        wall.material.emissiveIntensity = 0.3 + pulse * 0.4;
      }
    }
  }

  // --- STYLING 3: EXHAUST PARTICLE EMITTERS ---
  _updateExhaustParticles(dt) {
    if (!this._scene) return;
    this._exhaustTimer += dt;
    var v = this._barrelVehicle ? this._barrelVehicle.mesh : this._vehicle;
    if (!v) return;
    var speed = this._state.speed || 0;
    if (this._exhaustTimer > 0.05 && speed > 5 && this._exhaustEmitters.length < 40) {
      this._exhaustTimer = 0;
      var geo = new THREE.SphereGeometry(0.06, 3, 3);
      var mat = new THREE.MeshBasicMaterial({ color: 0xff4d2e, transparent: true, opacity: 0.5 });
      var p = new THREE.Mesh(geo, mat);
      var rear = new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.1, -1.0);
      v.localToWorld(rear);
      p.position.copy(rear);
      p.userData = { life: 0.5, maxLife: 0.5, vel: new THREE.Vector3((Math.random()-0.5)*0.5, Math.random()*0.5, -1.0) };
      this._scene.add(p);
      this._exhaustEmitters.push(p);
    }
    for (var i = this._exhaustEmitters.length - 1; i >= 0; i--) {
      var e = this._exhaustEmitters[i];
      e.userData.life -= dt;
      if (e.userData.life <= 0) {
        this._scene.remove(e); e.geometry.dispose(); e.material.dispose();
        this._exhaustEmitters.splice(i, 1);
        continue;
      }
      e.position.add(e.userData.vel.clone().multiplyScalar(dt));
      e.material.opacity = (e.userData.life / e.userData.maxLife) * 0.4;
      e.scale.multiplyScalar(0.96);
    }
  }

  // --- STYLING 4: DYNAMIC SKY COLOR SHIFT ---
  _updateSkyColorShift(dt) {
    if (!this._sky || !this._sky.material) return;
    var speed = this._state.speed || 0;
    if (this._boostActive && !this._skyShiftActive) {
      this._skyShiftActive = true;
      this._skyTargetColor = new THREE.Color(0x0a0520);
    } else if (!this._boostActive && this._skyShiftActive) {
      this._skyShiftActive = false;
      this._skyTargetColor = new THREE.Color(0x050610);
    }
    if (this._skyTargetColor) {
      this._sky.material.color.lerp(this._skyTargetColor, dt * 2.0);
      if (this._sky.material.color.distanceTo(this._skyTargetColor) < 0.01) {
        this._skyShiftActive = false;
      }
    }
  }

  // --- STYLING 5: VIGNETTE PULSE ON LOW HEALTH ---
  _updateLowHealthPulse(dt) {
    if (!this._vignetteEl) return;
    // Check if any health/shield is low
    var isLow = false;
    if (this._state.speed > 0) isLow = false; // placeholder - could check actual health
    if (isLow && !this._lowHealthPulseActive) {
      this._lowHealthPulseActive = true;
    } else if (!isLow && this._lowHealthPulseActive) {
      this._lowHealthPulseActive = false;
      this._vignetteEl.style.boxShadow = '';
    }
    if (this._lowHealthPulseActive) {
      this._lowHealthPulseTimer += dt * 4.0;
      var pulse = (Math.sin(this._lowHealthPulseTimer) + 1) * 0.5;
      this._vignetteEl.style.boxShadow = 'inset 0 0 ' + (120 + pulse * 80) + 'px rgba(255,50,50,' + (0.2 + pulse * 0.15) + ')';
    }
  }

  // --- STYLING 6: POWERUP COLLECT BURST ---
  _createPowerupBurst() {
    var el = document.createElement('div');
    el.id = 'powerup-collect-burst';
    el.innerHTML = '<div class="burst-ring"></div><div class="burst-ring ring2"></div>';
    document.body.appendChild(el);
    this._powerupBurstEl = el;
  }
  _triggerPowerupBurst(color) {
    if (!this._powerupBurstEl) return;
    this._powerupBurstEl.style.setProperty('--burst-color', color || '#00e5ff');
    this._powerupBurstEl.classList.remove('burst');
    void this._powerupBurstEl.offsetWidth;
    this._powerupBurstEl.classList.add('burst');
    this._powerupBurstTimer = 0.6;
  }
  _updatePowerupBurst(dt) {
    if (this._powerupBurstTimer > 0) {
      this._powerupBurstTimer -= dt;
      if (this._powerupBurstTimer <= 0 && this._powerupBurstEl) {
        this._powerupBurstEl.classList.remove('burst');
      }
    }
  }

  // --- FEATURE 1: RACE PROGRESS PERCENTAGE ---
  _createRaceProgressDisplay() {
    var el = document.createElement('div');
    el.id = 'race-progress-pct';
    el.innerHTML = '<span class="pct-value">0</span><span class="pct-symbol">%</span><span class="pct-label">TRACK</span>';
    document.body.appendChild(el);
    this._raceProgressEl = el;
  }
  _updateRaceProgressDisplay() {
    if (!this._raceProgressEl || !this._state.raceStarted) return;
    var pct = Math.min(100, Math.floor((this._state.position / this._trackLength) * 100));
    var valEl = this._raceProgressEl.querySelector('.pct-value');
    if (valEl) valEl.textContent = pct;
  }

  // --- FEATURE 2: FINISH LINE CAMERA SLOW-MO ---
  _updateFinishSlowMo(dt) {
    if (!this._finishing) { this._finishSlowMo = false; return; }
    if (!this._finishSlowMo) {
      this._finishSlowMo = true;
      this._finishSlowMoTimer = 3.0;
      this._originalTimeScale = 1.0;
      this._showLetterbox(3.0);
      this._addRaceEvent('FINISH LINE!', 'record');
    }
    this._finishSlowMoTimer -= dt;
    if (this._finishSlowMoTimer <= 0) {
      this._finishSlowMo = false;
    }
  }

  // --- FEATURE 3: MINIMAP PLAYER DOT ENHANCEMENT ---
  _updateMinimapPlayerDot() {
    if (!this._mmCanvas) return;
    var ctx = this._mmCtx;
    if (!ctx) return;
    // Enhanced pulsing dot for player on minimap
    var pulse = 0.5 + Math.sin(Date.now() * 0.005) * 0.5;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 4 + pulse * 4;
  }

  // --- FEATURE 4: COMBO BREAK NOTIFICATION ---
  _createComboBreakNotification() {
    var el = document.createElement('div');
    el.id = 'combo-break-notification';
    el.textContent = 'COMBO BROKEN';
    document.body.appendChild(el);
    this._comboBreakEl = el;
  }
  _triggerComboBreak() {
    if (!this._comboBreakEl) return;
    if (this._comboMultiplier > 1.5) {
      this._comboBreakEl.classList.remove('show');
      void this._comboBreakEl.offsetWidth;
      this._comboBreakEl.classList.add('show');
      this._comboBreakTimer = 1.5;
      this._addRaceEvent('COMBO BROKEN! x' + this._comboMultiplier.toFixed(1), 'warning');
    }
  }
  _updateComboBreak(dt) {
    if (this._comboBreakTimer > 0) {
      this._comboBreakTimer -= dt;
      if (this._comboBreakTimer <= 0 && this._comboBreakEl) {
        this._comboBreakEl.classList.remove('show');
      }
    }
  }

  // --- FEATURE 5: SPEED ZONE VISUAL ---
  _createSpeedZoneVisual() {
    var el = document.createElement('div');
    el.id = 'speed-zone-indicator';
    el.textContent = 'SPEED ZONE';
    document.body.appendChild(el);
    this._speedZoneEl = el;
  }
  _updateSpeedZone(dt) {
    if (!this._speedZoneEl) return;
    var speed = this._state.speed || 0;
    var wasIn = this._inSpeedZone;
    this._inSpeedZone = speed > 45 && !this._boostActive;
    if (this._inSpeedZone && !wasIn) {
      this._speedZoneEl.classList.add('active');
    } else if (!this._inSpeedZone && wasIn) {
      this._speedZoneEl.classList.remove('active');
    }
  }

  // --- FEATURE 6: TIRE SCREECH VISUAL ---
  _createTireScreechVisual() {
    var el = document.createElement('div');
    el.id = 'tire-screech-indicator';
    el.innerHTML = '<div class="screech-bar"></div><div class="screech-label">TIRE SCREECH</div>';
    document.body.appendChild(el);
    this._tireScreechEl = el;
  }
  _updateTireScreechVisual() {
    if (!this._tireScreechEl) return;
    var isScreeching = this._keys.drift && this._state.speed > 25 && (this._keys.steerLeft || this._keys.steerRight);
    var bar = this._tireScreechEl.querySelector('.screech-bar');
    if (isScreeching) {
      this._tireScreechEl.classList.add('active');
      if (bar) bar.style.width = Math.min(100, (this._state.speed / 55) * 100) + '%';
    } else {
      this._tireScreechEl.classList.remove('active');
    }
  }


  // ============================================================
  // CYCLE 40: SETUP
  // ============================================================
  _setupCycle40Systems() {
    this._createNeonGridOverlay();
    this._createSpeedBlurOverlay();
    this._createDriftAngleMeter();
    this._createLapTimeDeltaDisplay();
    this._createProximityAlertFlash();
    this._createNitroFlameAura();
    console.log('[RaceScene] Cycle 40 systems initialized (6 styling + 6 features)');
  }

  // --- STYLING 1: NEON GRID GROUND OVERLAY ---
  _createNeonGridOverlay() {
    if (document.getElementById('neon-grid-overlay')) return;
    var wrap = document.createElement('div');
    wrap.id = 'neon-grid-overlay';
    var canvas = document.createElement('canvas');
    canvas.id = 'neon-grid-canvas';
    canvas.width = 512;
    canvas.height = 512;
    wrap.appendChild(canvas);
    document.body.appendChild(wrap);
    this._neonGridCanvas = canvas;
    this._neonGridCtx = canvas.getContext('2d');
    this._neonGridOffset = 0;
  }
  _updateNeonGrid(dt) {
    if (!this._neonGridCtx) return;
    var ctx = this._neonGridCtx;
    var w = this._neonGridCanvas.width;
    var h = this._neonGridCanvas.height;
    var speed = this._state.speed || 0;
    this._neonGridOffset = (this._neonGridOffset + speed * dt * 8) % 64;
    ctx.clearRect(0, 0, w, h);
    // Draw perspective grid
    var gridColor = this._boostActive ? 'rgba(0,229,255,' : 'rgba(255,77,46,';
    var baseAlpha = Math.min(0.25, 0.05 + (speed / 55) * 0.2);
    ctx.strokeStyle = gridColor + baseAlpha + ')';
    ctx.lineWidth = 1;
    // Vertical lines
    for (var x = -this._neonGridOffset % 64; x < w; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    // Horizontal lines with perspective
    for (var y = 0; y < h; y += 64) {
      var py = y - (this._neonGridOffset % 64);
      if (py < 0) py += 512;
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
    }
    // Center glow
    var grad = ctx.createRadialGradient(w/2, h*0.7, 0, w/2, h*0.7, w*0.6);
    grad.addColorStop(0, gridColor + (baseAlpha * 0.5) + ')');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // --- STYLING 2: SPEED BLUR RADIAL OVERLAY ---
  _createSpeedBlurOverlay() {
    if (document.getElementById('speed-blur-overlay')) return;
    var el = document.createElement('div');
    el.id = 'speed-blur-overlay';
    document.body.appendChild(el);
    this._speedBlurOverlay = el;
  }
  _updateSpeedBlurOverlay() {
    if (!this._speedBlurOverlay) return;
    var speed = this._state.speed || 0;
    var blur = Math.min(6, (speed / 55) * 6);
    this._speedBlurOverlay.style.backdropFilter = speed > 15 ? 'blur(' + blur.toFixed(1) + 'px)' : 'none';
    this._speedBlurOverlay.style.opacity = speed > 15 ? Math.min(0.3, (speed - 15) / 100).toFixed(2) : '0';
  }

  // --- STYLING 3: SPARK TRAIL ON BOOST (CSS particles) ---
  _updateBoostSparkTrail(dt) {
    if (!this._boostActive) {
      // Fade existing sparks
      for (var i = this._boostSparkTrail.length - 1; i >= 0; i--) {
        this._boostSparkTrail[i].life -= dt * 3;
        if (this._boostSparkTrail[i].life <= 0) {
          if (this._boostSparkTrail[i].el.parentNode) this._boostSparkTrail[i].el.remove();
          this._boostSparkTrail.splice(i, 1);
        } else {
          this._boostSparkTrail[i].el.style.opacity = this._boostSparkTrail[i].life;
          this._boostSparkTrail[i].el.style.transform = 'translate(' + this._boostSparkTrail[i].x + 'px,' + this._boostSparkTrail[i].y + 'px) scale(' + this._boostSparkTrail[i].life + ')';
        }
      }
      return;
    }
    this._boostSparkTimer += dt;
    if (this._boostSparkTimer < 0.03) return;
    this._boostSparkTimer = 0;
    var spark = document.createElement('div');
    spark.className = 'c40-boost-spark';
    var colors = ['#00e5ff', '#ff4d2e', '#ffd23f', '#ffffff'];
    spark.style.background = colors[Math.floor(Math.random() * colors.length)];
    spark.style.left = (20 + Math.random() * 60) + '%';
    spark.style.top = (40 + Math.random() * 30) + '%';
    document.body.appendChild(spark);
    this._boostSparkTrail.push({
      el: spark,
      x: (Math.random() - 0.5) * 80,
      y: 30 + Math.random() * 40,
      life: 1.0
    });
    // Cap at 40
    while (this._boostSparkTrail.length > 40) {
      var old = this._boostSparkTrail.shift();
      if (old.el.parentNode) old.el.remove();
    }
  }

  // --- STYLING 4: DRIFT ANGLE METER ---
  _createDriftAngleMeter() {
    if (document.getElementById('drift-angle-meter')) return;
    var el = document.createElement('div');
    el.id = 'drift-angle-meter';
    el.innerHTML = '<svg viewBox="0 0 80 40" width="80" height="40"><path id="dam-arc" d="M 10 35 A 30 30 0 0 1 70 35" fill="none" stroke="rgba(255,210,63,0.3)" stroke-width="3" stroke-linecap="round"/><path id="dam-fill" d="M 10 35 A 30 30 0 0 1 70 35" fill="none" stroke="#ffd23f" stroke-width="3" stroke-linecap="round" stroke-dasharray="0 100"/><circle id="dam-dot" cx="40" cy="10" r="3" fill="#ffd23f" opacity="0"/></svg><div class="dam-label">DRIFT ANGLE</div>';
    document.body.appendChild(el);
    this._driftAngleEl = el;
  }
  _updateDriftAngleMeter() {
    if (!this._driftAngleEl) return;
    var isDrifting = this._keys.drift && this._state.speed > 15;
    var fill = document.getElementById('dam-fill');
    var dot = document.getElementById('dam-dot');
    if (!fill || !dot) return;
    if (isDrifting) {
      this._driftAngleEl.classList.add('active');
      var steer = 0;
      if (this._keys.steerLeft) steer = -1;
      if (this._keys.steerRight) steer = 1;
      var angle = Math.abs(steer) * (0.3 + (this._state.speed / 55) * 0.7);
      var dashLen = angle * 94; // arc length approx
      fill.setAttribute('stroke-dasharray', dashLen + ' 100');
      // Position dot along arc
      var t = angle;
      var cx = 10 + t * 60;
      var cy = 35 - Math.sin(t * Math.PI) * 30;
      dot.setAttribute('cx', cx);
      dot.setAttribute('cy', cy);
      dot.setAttribute('opacity', '1');
    } else {
      this._driftAngleEl.classList.remove('active');
      fill.setAttribute('stroke-dasharray', '0 100');
      dot.setAttribute('opacity', '0');
    }
  }

  // --- STYLING 5: LAP TIME DELTA ---
  _createLapTimeDeltaDisplay() {
    if (document.getElementById('lap-time-delta')) return;
    var el = document.createElement('div');
    el.id = 'lap-time-delta';
    el.innerHTML = '<div class="ltd-label">LAP DELTA</div><div class="ltd-value" id="ltd-value">--</div>';
    document.body.appendChild(el);
    this._lapDeltaEl = el;
  }
  _updateLapTimeDelta(dt) {
    if (!this._lapDeltaEl || !this._state.raceStarted) return;
    this._currentLapElapsed += dt;
    var valEl = document.getElementById('ltd-value');
    if (!valEl) return;
    if (this._bestLapTime && this._bestLapTime > 0) {
      var delta = this._currentLapElapsed - this._bestLapTime;
      var sign = delta >= 0 ? '+' : '-';
      var absDelta = Math.abs(delta);
      valEl.textContent = sign + this._formatTime(absDelta);
      valEl.className = 'ltd-value ' + (delta <= 0 ? 'ltd-negative' : 'ltd-positive');
    } else {
      valEl.textContent = '--';
      valEl.className = 'ltd-value';
    }
  }

  // --- STYLING 6: PROXIMITY ALERT FLASH ---
  _createProximityAlertFlash() {
    if (document.getElementById('proximity-alert-flash')) return;
    var el = document.createElement('div');
    el.id = 'proximity-alert-flash';
    document.body.appendChild(el);
    this._proximityFlashEl = el;
  }
  _updateProximityFlash(dt) {
    if (!this._proximityFlashEl) return;
    // Check proximity (reuse AI proximity check)
    var minDist = 999;
    if (this._aiOpponents) {
      for (var i = 0; i < this._aiOpponents.length; i++) {
        var ai = this._aiOpponents[i];
        var dist = Math.abs(this._state.position - ai.trackPos);
        if (dist < minDist) minDist = dist;
      }
    }
    if (minDist < 8) {
      this._proximityFlashEl.classList.add('active');
      this._proximityFlashTimer = 0.5;
    }
    if (this._proximityFlashTimer > 0) {
      this._proximityFlashTimer -= dt;
      if (this._proximityFlashTimer <= 0) {
        this._proximityFlashEl.classList.remove('active');
      }
    }
  }

  // --- FEATURE 6: NITRO FLAME AURA ---
  _createNitroFlameAura() {
    if (document.getElementById('nitro-flame-aura')) return;
    var el = document.createElement('div');
    el.id = 'nitro-flame-aura';
    el.innerHTML = '<div class="nitro-flame-left"></div><div class="nitro-flame-right"></div><div class="nitro-flame-core"></div>';
    document.body.appendChild(el);
    this._nitroAuraEl = el;
  }
  _updateNitroAura() {
    if (!this._nitroAuraEl) return;
    if (this._boostActive) {
      this._nitroAuraEl.classList.add('active');
    } else {
      this._nitroAuraEl.classList.remove('active');
    }
  }


var _instance = null;

export function getRaceScene() {
  if (!_instance) _instance = new RaceScene();
  return _instance;
}

if (typeof window !== 'undefined') window.__raceScene = getRaceScene();

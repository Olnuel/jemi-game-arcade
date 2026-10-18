import * as THREE from 'three';
import { animatePlayerCharacter, applyPlayerCharacterStyle, createPlayerCharacter, FOOT_Y, PREVIEW_STYLE } from '../identity/player-character.js';
import { addMarketStall, addStringLights } from '../scene/lagos-night-market.js';
import { applyLighting, LIGHT_PRESETS, readLighting } from '../scene/sky.js';
import { sound } from '../audio/sound.js';
import { QUALITY, createFrameGovernor, rendererOptions } from '../render-quality.js';
import {
  LANES, LANE_COUNT, LANE_WIDTH, OBSTACLES, blocksLane, collectsCoin,
  POWERUPS, POWERUP_KINDS, createPowerups, tickPowerups, activePowerups, MAGNET_REACH,
} from './dash/rules.js';
import {
  createRunner, resetRunner, changeLane, stepLane, laneBlend, jump as runnerJump,
  duck as runnerDuck, isSliding, stepVertical, runnerSnapshot,
} from './dash/runner-state.js';
import { buildRow } from './dash/patterns.js';
import { RUN, speedRamp, nextSpeed, rowInterval, rampLabel } from './dash/progression.js';
import { createObstacle, disposeObstacleResources, PALETTE } from './dash/obstacles.js';
import { createCoin, createPowerupPickup, createHoverboard, createGlow, disposePickupResources } from './dash/pickups.js';

// The runner holds station and the road comes to them, which is what keeps the
// collision maths in one fixed place instead of spread across a moving origin.
const PLAYER_Z = 0;
const SPAWN_Z = -46;
const DESPAWN_Z = 8;
// A row is tested when its leading edge reaches the runner, using its real length so
// a bus blocks for as long as it is actually beside you.
const HIT_DEPTH = 0.34;

// Coins that a magnet is reaching for bend toward the runner rather than vanishing,
// so you can see what it is doing.
const MAGNET_PULL = 7.5;

// The chase camera. Close enough that the runner's arms and legs read, high enough
// and pitched so the next row is on screen before it has to be answered. A camera far
// enough back to show the whole horizon makes the character too small to judge a
// jump, and one close enough to show the character loses the road.
const CAMERA_Y = 3.9;
const CAMERA_Z = 6.4;
const CAMERA_LOOK_Y = 1.35;
const CAMERA_LOOK_Z = -13;

/** Mixed into a message the HUD shows for a few seconds. */
let toastText = '';
let toastTimer = 0;

export class IdentityDash {
  constructor(canvas, { style = PREVIEW_STYLE, lighting = readLighting(), onChange = () => {} } = {}) {
    this.canvas = canvas;
    this.onChange = onChange;
    this.state = 'menu';
    this.score = 0;
    this.coins = 0;
    this.best = this.readBest();
    this.runner = createRunner();
    this.powerups = createPowerups();
    this.elapsed = 0;
    this.speed = RUN.startSpeed;
    this.spawnTimer = 1.1;
    this.recovering = 0;
    this.lastPattern = '';
    this.distance = 0;
    this.shake = 0;
    this.hitFlash = 0;
    this.boardTimer = 0;
    this.invulnerable = 0;
    this.lives = 3;
    this.items = [];
    this.roadMarks = [];
    this.lighting = lighting;
    this.disposed = false;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 190);
    this.camera.position.set(0, CAMERA_Y, CAMERA_Z);
    this.renderer = new THREE.WebGLRenderer(rendererOptions(canvas));
    this.governPixelRatio = createFrameGovernor((ratio) => this.renderer.setPixelRatio(ratio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = QUALITY.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.buildScene(style);
    this.bindInput();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.resize();
    this.lastFrame = performance.now();
    this.frame = this.frame.bind(this);
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  readBest() {
    try { return Number(localStorage.getItem('arcade:identity-dash:best') || 0) || 0; } catch { return 0; }
  }

  buildScene(style) {
    applyLighting(this.scene, this.lighting);

    // Night-market colour: ember on one side, Nigerian green on the other, warm
    // sodium glow overhead. Enough light to read the road, not enough to flatten it.
    this.washes = [];
    const addWash = (color, intensity, x, y, z, distance) => {
      const light = new THREE.PointLight(color, intensity, distance, 2);
      light.position.set(x, y, z);
      this.scene.add(light);
      this.washes.push({ light, base: intensity });
      return light;
    };
    addWash('#ff5722', 26, 3.4, 2.6, -7, 20);
    addWash('#00d98a', 18, -3.9, 2.9, -16, 20);
    addWash('#ffb45e', 22, 0, 5.4, -30, 34);

    const groundMat = new THREE.MeshStandardMaterial({ color: '#2a1c1a', roughness: 0.95 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 140), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.07, -52);
    ground.receiveShadow = true;
    this.scene.add(ground);

    const roadWidth = LANE_COUNT * LANE_WIDTH + 0.7;
    const roadMat = new THREE.MeshStandardMaterial({ color: '#33211d', roughness: 0.88 });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth, 140), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, -0.02, -52);
    road.receiveShadow = true;
    this.scene.add(road);

    const edgeMat = new THREE.MeshStandardMaterial({ color: '#db854a', emissive: '#8f3d19', emissiveIntensity: 0.55 });
    for (const x of [-roadWidth / 2 + 0.03, roadWidth / 2 - 0.03]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 140), edgeMat);
      edge.position.set(x, 0.012, -52);
      this.scene.add(edge);
    }

    // Lane dividers, recycled rather than respawned so the road reads as continuous
    // rather than as objects appearing out of the dark.
    const markMat = new THREE.MeshStandardMaterial({ color: '#b2aaa0', emissive: '#5b4a37', emissiveIntensity: 0.24 });
    const markGeom = new THREE.BoxGeometry(0.038, 0.026, 2.1);
    for (const x of [-LANE_WIDTH / 2, LANE_WIDTH / 2]) {
      for (let i = 0; i < 22; i += 1) {
        const mark = new THREE.Mesh(markGeom, markMat);
        mark.position.set(x, 0.013, -i * 5.6);
        this.roadMarks.push(mark);
        this.scene.add(mark);
      }
    }

    this.createStreet();
    addStringLights(this.scene, { start: [-4.6, 4.6, 1], end: [4.6, 4.6, -12], count: 12 });

    this.character = createPlayerCharacter(style);
    this.character.position.set(0, FOOT_Y, PLAYER_Z);
    this.character.rotation.y = Math.PI;
    // The runner pumps bent arms rather than carrying them at their sides. Set per
    // game so Avatar Jump and Salubata keep the walk they already have.
    this.character.userData.armStyle = 'sprinter';
    this.scene.add(this.character);

    this.playerShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.52, 24),
      new THREE.MeshBasicMaterial({ color: '#0a0f10', transparent: true, opacity: 0.4 }),
    );
    this.playerShadow.rotation.x = -Math.PI / 2;
    this.playerShadow.position.set(0, 0.016, PLAYER_Z);
    this.scene.add(this.playerShadow);

    this.board = createHoverboard();
    this.board.visible = false;
    this.scene.add(this.board);

    this.boardGlow = createGlow(PALETTE.green);
    this.boardGlow.visible = false;
    this.scene.add(this.boardGlow);
  }

  createStreet() {
    const buildingMats = ['#4b3734', '#33434a', '#594337', '#384241', '#413230'].map((color) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.95 }),
    );
    const windowMats = [
      new THREE.MeshStandardMaterial({ color: '#ffbc70', emissive: '#b95c23', emissiveIntensity: 1.35 }),
      new THREE.MeshStandardMaterial({ color: '#55d3c3', emissive: '#148878', emissiveIntensity: 1.3 }),
    ];
    const litWindowMat = new THREE.MeshBasicMaterial({ color: '#ffd9a0' });
    // Recycling buildings down both sides instead of building a fixed set keeps the
    // street endless for the same memory.
    this.buildings = [];
    const buildingGeom = new THREE.BoxGeometry(1, 1, 2.2);
    const windowGeom = new THREE.PlaneGeometry(0.28, 0.38);
    for (let i = 0; i < 34; i += 1) {
      const group = new THREE.Group();
      const width = 2.3 + (i % 3) * 0.7;
      const height = 2.4 + ((i * 7) % 6) * 0.66;
      const building = new THREE.Mesh(buildingGeom, buildingMats[i % buildingMats.length]);
      building.scale.set(width, height, 1);
      building.position.y = height / 2;
      building.castShadow = QUALITY.softShadows;
      group.add(building);
      const rows = Math.max(2, Math.floor(height / 0.9));
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < 2; col += 1) {
          const lit = (row * 3 + col + i) % 5 === 0;
          const windowMesh = new THREE.Mesh(
            windowGeom,
            lit ? litWindowMat : windowMats[(row + col + i) % 7 === 0 ? 1 : 0],
          );
          windowMesh.position.set((col - 0.5) * width * 0.5, 0.65 + row * 0.8, 1.12);
          group.add(windowMesh);
        }
      }
      group.position.set((i % 2 === 0 ? -1 : 1) * (4.5 + (i % 2) * 0.4), 0, -i * 5.2 + 4);
      this.buildings.push({ group, span: 34 * 5.2 });
      this.scene.add(group);
    }

    // Street lamps, also recycled.
    this.lamps = [];
    const poleMat = new THREE.MeshStandardMaterial({ color: '#493b35', roughness: 0.9 });
    const poleGeom = new THREE.CylinderGeometry(0.05, 0.075, 2.5, 8);
    const bulbMatL = new THREE.MeshBasicMaterial({ color: '#45ddc4' });
    const bulbMatR = new THREE.MeshBasicMaterial({ color: '#ff9d5d' });
    const bulbGeom = new THREE.SphereGeometry(0.12, 10, 8);
    for (let i = 0; i < 18; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const pole = new THREE.Mesh(poleGeom, poleMat);
      pole.position.set(side * 3.6, 1.25, -i * 5.4);
      this.scene.add(pole);
      const bulb = new THREE.Mesh(bulbGeom, side < 0 ? bulbMatL : bulbMatR);
      bulb.position.set(side * 3.6, 2.44, -i * 5.4);
      this.scene.add(bulb);
      this.lamps.push({ pole, bulb, span: 18 * 5.4 });
    }
  }

  /** Switches the time of day live, without rebuilding the street. */
  setLighting(id) {
    if (!LIGHT_PRESETS[id]) return;
    this.lighting = id;
    applyLighting(this.scene, id);
    if (this.scene.fog) this.scene.fog.color.set(LIGHT_PRESETS[id].fog);
    const boost = id === 'night' ? 1.35 : id === 'evening' ? 1.1 : 0.55;
    this.washes?.forEach(({ light, base }) => { light.intensity = base * boost; });
  }

  setStyle(style = PREVIEW_STYLE) {
    applyPlayerCharacterStyle(this.character, style);
    this.character.userData.armStyle = 'sprinter';
  }

  bindInput() {
    this.onKeyDown = (event) => this.handleKey(event);
    this.onTouchStart = (event) => this.handleTouchStart(event);
    this.onTouchEnd = (event) => this.handleTouchEnd(event);
    this.onTouchMove = (event) => {
      // A swipe that turns into a scroll is the single worst thing that can happen
      // in a runner, so the whole gesture is claimed up front.
      if (this.state === 'running' || this.state === 'paused') event.preventDefault();
    };
    window.addEventListener('keydown', this.onKeyDown);
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: true });
    this.canvas.addEventListener('touchend', this.onTouchEnd, { passive: true });
    this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
  }

  resize() {
    if (this.disposed) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  handleKey(event) {
    const key = event.key;
    const lower = key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(lower)) {
      if (this.state === 'running' || this.state === 'paused') event.preventDefault();
    }
    if (event.repeat) return;
    if (lower === 'arrowleft' || lower === 'a') this.move(-1);
    else if (lower === 'arrowright' || lower === 'd') this.move(1);
    else if (lower === 'arrowup' || lower === ' ' || lower === 'w') this.primary();
    else if (lower === 'arrowdown' || lower === 's') this.secondary();
    else if (lower === 'escape') this.state === 'running' ? this.pause() : this.state === 'paused' ? this.resume() : null;
    else if ((lower === 'enter' || lower === 'r') && (this.state === 'over' || this.state === 'won')) this.start();
    else if (lower === 'enter' && this.state === 'menu') this.start();
  }

  handleTouchStart(event) {
    if (!event.changedTouches?.[0]) return;
    const touch = event.changedTouches[0];
    this.touchOrigin = { x: touch.clientX, y: touch.clientY, time: performance.now() };
  }

  handleTouchEnd(event) {
    if (!this.touchOrigin || !event.changedTouches?.[0]) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - this.touchOrigin.x;
    const dy = touch.clientY - this.touchOrigin.y;
    const elapsed = performance.now() - this.touchOrigin.time;
    this.touchOrigin = null;
    // A short, small gesture is a tap: use it for jump so the game is playable with
    // one thumb. Anything else is a swipe.
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22 && elapsed < 400) {
      this.primary();
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) this.move(dx > 0 ? 1 : -1);
    else if (dy < 0) this.primary();
    else this.secondary();
  }

  move(direction) {
    if (this.state !== 'running') return;
    changeLane(this.runner, direction, LANE_COUNT);
  }

  /** Up, space, or a tap. Jump when grounded, and use the board when it is armed. */
  primary() {
    if (this.state !== 'running') return;
    if (this.powerups.board && this.runner.jumpTime === 0 && this.runner.jumpsUsed === 0) {
      this.activateBoard();
      return;
    }
    if (runnerJump(this.runner)) sound.playJump();
  }

  /** Down, or a downward swipe. Fast-fall in the air, slide on the ground. */
  secondary() {
    if (this.state !== 'running') return;
    if (runnerDuck(this.runner)) {
      if (this.runner.jumpTime > 0) sound.playLand();
    }
  }

  activateBoard() {
    this.powerups.board = false;
    this.boardTimer = 11;
    this.lives = 3;
    sound.playStart();
    this.toast('HOVERBOARD!');
    this.notify();
  }

  toast(text) {
    toastText = text;
    toastTimer = 1.6;
    this.onChange({
      state: this.state, score: Math.floor(this.score), coins: this.coins, best: this.best,
      lives: this.lives, toast: text,
    });
  }

  spawnRow() {
    const ramp = speedRamp(this.speed);
    const row = buildRow(ramp, this.lastPattern);
    this.lastPattern = row.pattern;
    this.recovering = row.pattern === 'hurdleLine' || row.pattern === 'bannerLine' ? 1 : 0;

    for (const obstacle of row.obstacles) {
      const mesh = createObstacle(obstacle.kind);
      const x = LANES[obstacle.lane];
      mesh.position.set(x, 0, SPAWN_Z);
      this.scene.add(mesh);
      this.items.push({
        type: 'obstacle',
        kind: obstacle.kind,
        lane: obstacle.lane,
        mesh,
        halfLength: (OBSTACLES[obstacle.kind]?.length || 1) / 2,
        tested: false,
        hit: false,
      });
    }

    // Coins mark the safe line, which is what teaches the row without a tutorial.
    // When every lane needs a verb there is no clear line, so the coins are lifted to
    // the height the jump or the slide actually passes through.
    const laneIsClear = row.clearLanes.length > 0;
    const safeLane = laneIsClear ? row.clearLanes[0] : row.safeLane;
    const coinY = laneIsClear ? 0.85 : 1.45;
    const trailLength = 5;
    for (let i = 0; i < trailLength; i += 1) {
      const coin = createCoin();
      coin.position.set(LANES[safeLane], coinY, SPAWN_Z + 4 - i * 1.5);
      this.scene.add(coin);
      this.items.push({ type: 'coin', lane: safeLane, y: coinY, mesh: coin, collected: false, spin: i });
    }

    // The occasional power-up, sitting on the same line so it is a reward for
    // reading the row rather than something found by accident.
    if (Math.random() < RUN.powerupChance) {
      const kind = POWERUP_KINDS[Math.floor(Math.random() * POWERUP_KINDS.length)];
      const pickup = createPowerupPickup(kind);
      pickup.position.set(LANES[safeLane], 1.05, SPAWN_Z + 7.5);
      this.scene.add(pickup);
      this.items.push({ type: 'powerup', kind, lane: safeLane, mesh: pickup, collected: false });
    }
  }

  start() {
    this.clearItems();
    resetRunner(this.runner);
    this.powerups = createPowerups();
    this.state = 'running';
    this.score = 0;
    this.coins = 0;
    this.distance = 0;
    this.lives = 3;
    this.elapsed = 0;
    this.speed = RUN.startSpeed;
    this.spawnTimer = 0.9;
    this.recovering = 0;
    this.lastPattern = '';
    this.shake = 0;
    this.hitFlash = 0;
    this.boardTimer = 0;
    this.invulnerable = 0;
    this.character.visible = true;
    this.character.scale.set(1, 1, 1);
    this.character.position.set(0, FOOT_Y, PLAYER_Z);
    this.board.visible = false;
    this.boardGlow.visible = false;
    this.lastFrame = performance.now();
    sound.playStart();
    this.notify();
  }

  returnToMenu() {
    this.state = 'menu';
    this.clearItems();
    resetRunner(this.runner);
    this.powerups = createPowerups();
    this.boardTimer = 0;
    this.character.position.set(0, FOOT_Y, PLAYER_Z);
    this.character.scale.set(1, 1, 1);
    this.character.visible = true;
    this.board.visible = false;
    this.boardGlow.visible = false;
    this.camera.position.set(0, CAMERA_Y, CAMERA_Z);
    this.camera.lookAt(0, CAMERA_LOOK_Y, CAMERA_LOOK_Z);
    this.notify();
  }

  pause() {
    if (this.state !== 'running') return;
    this.state = 'paused';
    this.notify();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'running';
    this.lastFrame = performance.now();
    this.notify();
  }

  /**
   * A hit. The board absorbs one, otherwise the run ends. This is the one-hit rule
   * that makes the hoverboard worth picking up rather than a bonus you collect.
   */
  hit(obstacle) {
    if (this.invulnerable > 0 || this.state !== 'running') return;
    if (this.boardTimer > 0) {
      // The board breaks: keep running, but the protection is gone.
      this.boardTimer = 0;
      this.invulnerable = 1.5;
      this.speed = Math.max(RUN.startSpeed, this.speed * 0.72);
      this.shake = 0.5;
      this.board.visible = false;
      this.boardGlow.visible = false;
      sound.playHit();
      this.toast('BOARD BROKE');
      return;
    }
    this.lives = 0;
    this.shake = 0.6;
    this.hitFlash = 0.45;
    sound.playHit();
    this.endRun(obstacle?.kind);
  }

  endRun(obstacleKind) {
    this.state = 'over';
    this.distance = Math.floor(this.score);
    this.best = Math.max(this.best, this.distance);
    try { localStorage.setItem('arcade:identity-dash:best', String(this.best)); } catch { /* private mode */ }
    this.newBest = this.distance >= this.best;
    this.resultTitle = obstacleKind === 'gantry'
      ? 'Banner got you.'
      : obstacleKind === 'lowcart'
        ? 'Clipped the cart.'
        : 'Run over.';
    sound.playGameOver();
    this.notify();
  }

  clearItems() {
    for (const item of this.items) this.disposeItem(item);
    this.items.length = 0;
  }

  disposeItem(item) {
    this.scene.remove(item.mesh);
  }

  notify() {
    this.onChange({
      state: this.state,
      score: Math.floor(this.score),
      coins: this.coins,
      best: this.best,
      lives: this.lives,
      distance: Math.floor(this.score),
      ramp: speedRamp(this.speed),
      rampLabel: rampLabel(speedRamp(this.speed)),
      powerups: activePowerups(this.powerups),
      board: this.boardTimer > 0,
      toast: toastTimer > 0 ? toastText : undefined,
      resultTitle: this.state === 'over' ? this.resultTitle : undefined,
      resultBody: this.state === 'over'
        ? `${Math.floor(this.score)} m · ${this.coins} coins · best ${this.best} m`
        : undefined,
      resultAction: this.state === 'over' ? 'Run again' : undefined,
    });
  }

  update(dt) {
    const running = this.state === 'running';
    if (running) this.elapsed += dt;
    // The HUD is driven straight from this state, so a score is never allowed to go
    // negative for even a frame: Math.floor of a value a few hundredths under zero is
    // "-1", which then renders as "-1m" on the way past.
    if (this.score < 0) this.score = 0;
    if (toastTimer > 0) toastTimer = Math.max(0, toastTimer - dt);

    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 2.4);
    if (this.boardTimer > 0) {
      this.boardTimer = Math.max(0, this.boardTimer - dt);
      if (this.boardTimer === 0) {
        this.powerups.board = false;
        this.toast('BOARD RAN OUT');
      }
    }
    tickPowerups(this.powerups, dt);
    this.runner.magnet = this.powerups.magnet > 0;

    stepLane(this.runner, dt);
    const wasSliding = isSliding(this.runner);
    const wasAirborne = this.runner.jumpTime > 0;
    stepVertical(this.runner, dt);
    if (wasSliding && !isSliding(this.runner) && !wasAirborne) sound.playLand();

    const blend = laneBlend(this.runner);
    const targetX = LANES[this.runner.lane];
    const fromX = LANES[this.runner.fromLane] ?? targetX;
    this.characterX = fromX + (targetX - fromX) * blend;

    // Sliding drops and squashes the rig, so a banner genuinely hangs over it.
    const ducking = isSliding(this.runner);
    this.duckBlend = THREE.MathUtils.damp(this.duckBlend || 0, ducking ? 1 : 0, 18, dt);
    this.character.position.x = this.characterX;
    this.character.position.y = FOOT_Y + this.runner.feetY - 0.24 * this.duckBlend + (this.boardTimer > 0 ? 0.42 : 0);
    this.character.scale.set(1, 1 - 0.42 * this.duckBlend, 1);
    // Lean into the turn, which is most of what sells a lane change.
    this.character.rotation.z = THREE.MathUtils.damp(
      this.character.rotation.z,
      -(this.runner.lane - fromX) * 0.09,
      9,
      dt,
    );

    // Flashing only while actually invulnerable, so a run never sits invisible.
    this.character.visible = this.invulnerable > 0
      ? Math.floor(this.elapsed * 18) % 2 === 0
      : true;

    // Tells the rig to play a slide pose rather than only being squashed.
    this.character.userData.sliding = this.duckBlend;

    const riding = this.boardTimer > 0;
    this.board.visible = riding;
    this.boardGlow.visible = riding;
    if (riding) {
      this.board.position.set(this.characterX, 0.1 + Math.sin(this.elapsed * 6) * 0.05, PLAYER_Z);
      this.board.rotation.z = this.character.rotation.z;
      this.boardGlow.position.set(this.characterX, 0.02, PLAYER_Z);
    }

    this.playerShadow.position.x = this.characterX;
    this.playerShadow.position.y = 0.016;
    const height = Math.max(0, this.runner.feetY + (riding ? 0.42 : 0));
    this.playerShadow.material.opacity = 0.4 - Math.min(0.24, height * 0.2);
    const shadowScale = 1 - Math.min(0.4, height * 0.16);
    this.playerShadow.scale.setScalar(shadowScale);

    animatePlayerCharacter(
      this.character,
      this.elapsed,
      running || this.state === 'menu',
      running ? this.speed : 0,
    );

    // ---- world scroll ----
    if (running) {
      this.speed = nextSpeed(this.speed, dt);
      const ramp = speedRamp(this.speed);
      const boost = this.powerups.double > 0 ? 2 : 1;
      this.score += this.speed * dt * boost;
      this.distance = Math.floor(this.score);

      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnRow();
        this.spawnTimer = rowInterval(this.speed, ramp, this.recovering > 0);
        this.recovering = Math.max(0, this.recovering - 1);
      }
    }

    const scroll = running ? this.speed * dt : 0;
    for (const mark of this.roadMarks) {
      mark.position.z += scroll;
      if (mark.position.z > 12) mark.position.z -= 22 * 5.6;
    }
    if (running) {
      const span = this.buildings[0].span;
      for (const { group } of this.buildings) {
        group.position.z += scroll;
        if (group.position.z > 14) group.position.z -= span;
      }
      for (const lamp of this.lamps) {
        lamp.pole.position.z += scroll;
        lamp.bulb.position.z += scroll;
        if (lamp.pole.position.z > 14) {
          lamp.pole.position.z -= lamp.span;
          lamp.bulb.position.z -= lamp.span;
        }
      }
    }

    this.updateItems(dt, scroll);
    this.updateCamera(dt);
  }

  updateItems(dt, scroll) {
    const running = this.state === 'running';
    const snapshot = runnerSnapshot(this.runner);
    const multiplier = this.powerups.double > 0 ? 2 : 1;

    for (let i = 0; i < this.items.length; i += 1) {
      const item = this.items[i];
      if (running && !item.collected) {
        item.mesh.position.z += scroll;
        if (item.type === 'coin' && this.runner.magnet) {
          this.pullCoin(item, dt);
        }
      }
      if (item.type === 'coin') {
        // Spins about the vertical so it turns face-on and edge-on. The wobble is
        // kept off the spin axis entirely, because tilting the coin as it turns is
        // what made it read as a flat disc tumbling rather than a coin spinning.
        item.mesh.rotation.y += dt * 3.4;
      } else if (item.type === 'powerup') {
        item.mesh.rotation.y += dt * 1.5;
        const shell = item.mesh.userData.spin;
        const ring = item.mesh.userData.ring;
        if (shell) shell.rotation.x += dt * 1.1;
        if (ring) ring.rotation.z += dt * 1.8;
      }

      if (!running || item.collected) continue;
      const dz = item.mesh.position.z - PLAYER_Z;

      if (item.type === 'coin') {
        // Only alongside the runner: a coin that has not reached you yet, or has
        // already passed you, cannot be collected. The magnet widens the lane test
        // but never the timing.
        if (Math.abs(dz) > 1.25) {
          continue;
        }
        const reachable = collectsCoin(item, this.runner.lane, snapshot)
          || (this.runner.magnet && Math.abs(item.lane - this.runner.lane) <= 1);
        if (reachable) {
          item.collected = true;
          item.mesh.visible = false;
          this.coins += 1;
          this.score += 4 * multiplier;
          sound.playCoin();
          this.notify();
        }
        continue;
      }

      if (item.type === 'powerup') {
        if (item.lane === this.runner.lane && Math.abs(dz) < 0.8
            && snapshot.bottom < 1.9 && snapshot.top > 0.2) {
          item.collected = true;
          item.mesh.visible = false;
          this.applyPowerup(item.kind);
          continue;
        }
        continue;
      }

      // Obstacle: tested once, when its leading edge reaches the runner.
      if (!item.tested && Math.abs(dz) < item.halfLength + HIT_DEPTH) {
        item.tested = true;
        if (blocksLane(item.kind, item.lane, this.runner.lane, snapshot)) {
          item.hit = true;
          item.mesh.visible = false;
          this.hit(item);
        }
      }
    }

    // Cull behind the camera, reusing the array rather than allocating a new one.
    let write = 0;
    for (let i = 0; i < this.items.length; i += 1) {
      const item = this.items[i];
      const keep = item.mesh.position.z < DESPAWN_Z && !item.collected && !(item.type === 'obstacle' && item.hit);
      if (keep) {
        this.items[write] = item;
        write += 1;
      } else {
        this.disposeItem(item);
      }
    }
    this.items.length = write;
  }

  pullCoin(item, dt) {
    const dx = LANES[this.runner.lane] - item.mesh.position.x;
    const dy = 0.85 - item.mesh.position.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.12 || distance > MAGNET_REACH) return;
    const pull = MAGNET_PULL * dt * (1 - distance / MAGNET_REACH);
    item.mesh.position.x += (dx / distance) * pull;
    item.mesh.position.y += (dy / distance) * pull;
  }

  applyPowerup(kind) {
    if (kind === 'magnet') {
      this.powerups.magnet = POWERUPS.magnet.duration;
      this.toast(POWERUPS.magnet.label);
    } else if (kind === 'double') {
      this.powerups.double = POWERUPS.double.duration;
      this.toast(POWERUPS.double.label);
    } else if (kind === 'board') {
      this.powerups.board = true;
      this.toast('PRESS SPACE TO RIDE');
    }
    sound.playWin();
    this.notify();
  }

  updateCamera(dt) {
    // Sit well back and above, looking a long way down the road. A runner camera that
    // crowds the character cannot show the next row, and in an endless runner the only
    // fair way to give the player a chance is to let them see the decision coming.
    let aimX = this.characterX * 0.4;
    let aimY = CAMERA_Y;
    let aimZ = CAMERA_Z;
    if (this.boardTimer > 0) {
      // Riding drops and pulls the camera in a little, which is most of what sells it.
      aimY = CAMERA_Y - 0.35;
      aimZ = CAMERA_Z - 0.7;
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.9);
      aimX += (Math.random() - 0.5) * this.shake * 0.9;
      aimY += (Math.random() - 0.5) * this.shake * 0.9;
    }
    const follow = this.state === 'menu' ? 3 : 6;
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, aimX, follow, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, aimY, follow, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, aimZ, follow, dt);
    // Aimed well past the runner, at a height that keeps the horizon high in frame.
    this.camera.lookAt(this.characterX * 0.2, CAMERA_LOOK_Y, CAMERA_LOOK_Z);
  }

  frame(now) {
    if (this.disposed) return;
    // Clamped on both sides. The ceiling stops a stall teleporting the runner through
    // an obstacle row. The floor matters just as much: `lastFrame` is seeded with
    // performance.now() but `now` is a requestAnimationFrame timestamp, and the two
    // are not the same clock reading, so the first frame after a launch or a resume
    // can arrive with `now` behind `lastFrame`. A negative dt then runs the whole
    // simulation backwards for a frame, which walks the score below zero and shoves
    // the road the wrong way.
    const dt = Math.min(0.045, Math.max(0, (now - this.lastFrame) / 1000 || 0));
    this.lastFrame = now;
    this.update(dt);
    this.governPixelRatio(dt);
    this.renderer.render(this.scene, this.camera);
    if (this.state === 'running') this.notify();
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
    this.canvas.removeEventListener('touchmove', this.onTouchMove);
    this.clearItems();
    this.scene.traverse((object) => {
      object.geometry?.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material?.dispose();
    });
    disposeObstacleResources();
    disposePickupResources();
    this.renderer.dispose();
  }
}

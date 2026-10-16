import * as THREE from 'three';
import { animatePlayerCharacter, applyPlayerCharacterStyle, createPlayerCharacter, FOOT_Y, PREVIEW_STYLE } from '../identity/player-character.js';
import { addMarketStall, addStringLights } from '../scene/lagos-night-market.js';
import { applyLighting, LIGHT_PRESETS, readLighting } from '../scene/sky.js';
import { sound } from '../audio/sound.js';

const LANES = [-1.55, 0, 1.55];
const randomLane = () => Math.floor(Math.random() * LANES.length);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function createDanfoBus() {
  const bus = new THREE.Group();

  // Iconic Lagos Danfo minibus: vibrant yellow body
  const bodyMat = new THREE.MeshStandardMaterial({
    color: '#fab81e',
    roughness: 0.45,
    metalness: 0.15,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.18, 1.12, 2.25), bodyMat);
  body.position.y = 0.7;
  body.castShadow = true;
  body.receiveShadow = true;
  bus.add(body);

  // Iconic twin black horizontal stripes
  const stripeMat = new THREE.MeshStandardMaterial({ color: '#1a1214', roughness: 0.8 });
  const topStripe = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.085, 2.27), stripeMat);
  topStripe.position.y = 0.74;
  bus.add(topStripe);
  const bottomStripe = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.085, 2.27), stripeMat);
  bottomStripe.position.y = 0.5;
  bus.add(bottomStripe);

  // Dark tinted windows
  const glassMat = new THREE.MeshStandardMaterial({ color: '#241318', roughness: 0.25, metalness: 0.75 });
  const windscreen = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 0.45), glassMat);
  windscreen.position.set(0, 0.9, 1.13);
  bus.add(windscreen);
  const rearWindow = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.42), glassMat);
  rearWindow.rotation.y = Math.PI;
  rearWindow.position.set(0, 0.9, -1.13);
  bus.add(rearWindow);

  // Wheels
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#1d1416', roughness: 0.85 });
  const wheelGeom = new THREE.CylinderGeometry(0.23, 0.23, 0.15, 12);
  wheelGeom.rotateZ(Math.PI / 2);
  [
    [-0.56, 0.23, 0.68],
    [0.56, 0.23, 0.68],
    [-0.56, 0.23, -0.68],
    [0.56, 0.23, -0.68],
  ].forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeom, wheelMat);
    wheel.position.set(x, y, z);
    wheel.castShadow = true;
    bus.add(wheel);
  });

  // Glowing red taillights facing the runner
  const redLightMat = new THREE.MeshStandardMaterial({ color: '#e62e2e', emissive: '#c41919', emissiveIntensity: 1.8 });
  [-0.42, 0.42].forEach((x) => {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.04), redLightMat);
    light.position.set(x, 0.46, 1.135);
    bus.add(light);
  });

  return bus;
}

function createHurdle() {
  const hurdle = new THREE.Group();
  const barMat = new THREE.MeshStandardMaterial({ color: '#e55229', roughness: 0.58, metalness: 0.08 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: '#f5f0e8', roughness: 0.5 });

  // Jumpable barrier crossbar (height 0.42m)
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.22, 0.12), barMat);
  bar.position.y = 0.36;
  bar.castShadow = true;
  hurdle.add(bar);

  // Reflective chevron marks
  [-0.44, -0.22, 0, 0.22, 0.44].forEach((x) => {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.225, 0.13), stripeMat);
    stripe.position.set(x, 0.36, 0);
    hurdle.add(stripe);
  });

  // Support legs
  const legMat = new THREE.MeshStandardMaterial({ color: '#2b1e20', roughness: 0.8 });
  const legGeom = new THREE.BoxGeometry(0.08, 0.48, 0.46);
  [-0.54, 0.54].forEach((x) => {
    const leg = new THREE.Mesh(legGeom, legMat);
    leg.position.set(x, 0.24, 0);
    leg.castShadow = true;
    hurdle.add(leg);
  });
  return hurdle;
}

function createCrate() {
  const crate = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: '#8e562c', roughness: 0.82, metalness: 0.05 });
  const strapMat = new THREE.MeshStandardMaterial({ color: '#dca45a', roughness: 0.6 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.86, 0.86), woodMat);
  box.position.y = 0.43;
  box.castShadow = true;
  crate.add(box);
  const strapH = new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.075, 0.88), strapMat);
  strapH.position.y = 0.43;
  crate.add(strapH);
  const strapV = new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.88, 0.075), strapMat);
  strapV.position.y = 0.43;
  crate.add(strapV);
  return crate;
}

function createCoinMesh() {
  const coinGroup = new THREE.Group();
  const coinMat = new THREE.MeshStandardMaterial({
    color: '#ffc83b',
    emissive: '#d27c18',
    emissiveIntensity: 1.4,
    metalness: 0.7,
    roughness: 0.28,
  });
  const cylinder = new THREE.CylinderGeometry(0.24, 0.24, 0.065, 18);
  cylinder.rotateX(Math.PI / 2);
  const coin = new THREE.Mesh(cylinder, coinMat);
  coin.castShadow = true;
  coinGroup.add(coin);
  return coinGroup;
}

export class IdentityDash {
  constructor(canvas, { style = PREVIEW_STYLE, lighting = readLighting(), onChange = () => {} } = {}) {
    this.canvas = canvas;
    this.lighting = lighting;
    this.onChange = onChange;
    this.state = 'menu';
    this.score = 0;
    this.coins = 0;
    let savedBest = 0;
    try { savedBest = Number(localStorage.getItem('arcade:identity-dash:best') || 0); } catch {}
    this.best = Number.isFinite(savedBest) ? savedBest : 0;
    this.lives = 3;
    this.lane = 1;
    this.targetLane = 1;
    this.jumpTime = 0;
    this.elapsed = 0;
    this.speed = 8;
    this.spawnTimer = 0.7;
    this.hitCooldown = 0;
    this.shake = 0;
    this.items = [];
    this.roadMarks = [];
    this.disposed = false;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2('#6b3352', 0.014);
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
    this.camera.position.set(0, 5.2, 8.8);
    this.camera.lookAt(0, 0.9, -4);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.buildScene(style);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.onKeyDown = (event) => this.handleKey(event);
    this.onTouchStart = (event) => this.handleTouchStart(event);
    this.onTouchEnd = (event) => this.handleTouchEnd(event);
    window.addEventListener('keydown', this.onKeyDown);
    canvas.addEventListener('touchstart', this.onTouchStart, { passive: true });
    canvas.addEventListener('touchend', this.onTouchEnd, { passive: true });
    this.resize();
    this.lastFrame = performance.now();
    this.frame = this.frame.bind(this);
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  buildScene(style) {
    applyLighting(this.scene, this.lighting);
    this.washes = [];
    const addWash = (color, intensity, x, y, z, distance) => {
      const light = new THREE.PointLight(color, intensity, distance, 2);
      light.position.set(x, y, z);
      this.scene.add(light);
      this.washes.push({ light, base: intensity });
      return light;
    };
    addWash('#ff5722', 34, 3.2, 2.4, -4, 16);
    addWash('#00d98a', 20, -3.8, 2.8, -9, 15);
    this.roadMaterials = [];

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 90),
      new THREE.MeshStandardMaterial({ color: '#2a1c1a', roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.06, -29);
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.roadMaterials.push({ mesh: ground, night: '#2a1c1a', day: '#8a6a4a' });

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(5.9, 90),
      new THREE.MeshStandardMaterial({ color: '#33211d', roughness: 0.86 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, -0.025, -29);
    road.receiveShadow = true;
    this.scene.add(road);
    this.roadMaterials.push({ mesh: road, night: '#33211d', day: '#6d6258' });

    const edgeMat = new THREE.MeshStandardMaterial({ color: '#db854a', emissive: '#8f3d19', emissiveIntensity: 0.5 });
    for (const x of [-2.98, 2.98]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.035, 90), edgeMat);
      edge.position.set(x, 0.01, -29);
      this.scene.add(edge);
    }
    const markMat = new THREE.MeshStandardMaterial({ color: '#b2aaa0', emissive: '#5b4a37', emissiveIntensity: 0.22 });
    for (const x of [-0.78, 0.78]) {
      for (let i = 0; i < 14; i += 1) {
        const mark = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 1.55), markMat);
        mark.position.set(x, 0.012, 2 - i * 4.8);
        this.roadMarks.push(mark);
        this.scene.add(mark);
      }
    }

    this.createStreet();
    addStringLights(this.scene, { start: [-4.5, 4.8, 1], end: [4.5, 4.8, -10], count: 12 });
    this.character = createPlayerCharacter(style);
    this.character.position.set(0, FOOT_Y, 2.15);
    // The runner heads away from the camera toward the coins, so face it down the road.
    this.character.rotation.y = Math.PI;
    this.scene.add(this.character);
    this.playerShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 24),
      new THREE.MeshBasicMaterial({ color: '#0c0607', transparent: true, opacity: 0.38 }),
    );
    this.playerShadow.rotation.x = -Math.PI / 2;
    this.playerShadow.position.set(0, 0.015, 2.15);
    this.scene.add(this.playerShadow);
  }

  createStreet() {
    const buildingMats = ['#4b3734', '#33434a', '#594337', '#384241'].map((color) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.95 }),
    );
    const windowMats = [
      new THREE.MeshStandardMaterial({ color: '#ffbc70', emissive: '#b95c23', emissiveIntensity: 1.3 }),
      new THREE.MeshStandardMaterial({ color: '#2ee08a', emissive: '#00875a', emissiveIntensity: 1.25 }),
    ];
    for (let i = 0; i < 28; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const depth = -4 - Math.floor(i / 2) * 5.4;
      const width = 2.3 + (i % 3) * 0.65;
      const height = 2.4 + ((i * 7) % 5) * 0.62;
      const group = new THREE.Group();
      group.position.set(side * (4.3 + (i % 2) * 0.3), 0, depth);
      const building = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, 2.1),
        buildingMats[i % buildingMats.length],
      );
      building.position.y = height / 2;
      building.castShadow = true;
      group.add(building);
      const rows = Math.max(2, Math.floor(height / 0.85));
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < 2; col += 1) {
          const windowMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(0.28, 0.37),
            windowMats[(row + col + i) % 7 === 0 ? 1 : 0],
          );
          windowMesh.position.set((col - 0.5) * width * 0.52, 0.62 + row * 0.72, 1.061);
          group.add(windowMesh);
        }
      }
      this.scene.add(group);
    }

    for (let row = 0; row < 5; row += 1) {
      const z = -5 - row * 14;
      addMarketStall(this.scene, { x: -4.55, z, scale: 0.82, sign: row % 2 ? 'SUYA' : 'LAGOS', accent: '#d77544' });
      addMarketStall(this.scene, { x: 4.55, z: z - 4, scale: 0.82, sign: row % 2 ? 'FRESH' : 'NIGHT BUKA', accent: '#168f7e' });
    }

    for (const side of [-1, 1]) {
      for (let i = 0; i < 7; i += 1) {
        const z = 1 - i * 8.4;
        const postMat = new THREE.MeshStandardMaterial({ color: '#4a3228', roughness: 0.9 });
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 2.45, 8), postMat);
        post.position.set(side * 3.25, 1.22, z);
        post.castShadow = true;
        this.scene.add(post);
        const lamp = new THREE.Mesh(
          new THREE.SphereGeometry(0.115, 12, 10),
          new THREE.MeshBasicMaterial({ color: side < 0 ? '#45ddc4' : '#ff9d5d' }),
        );
        lamp.position.set(side * 3.25, 2.38, z);
        this.scene.add(lamp);
      }
    }
  }

  setStyle(style = PREVIEW_STYLE) {
    applyPlayerCharacterStyle(this.character, style);
  }

  /** Switches the time of day live, without rebuilding the street. */
  setLighting(id) {
    if (!LIGHT_PRESETS[id]) return;
    this.lighting = id;
    const preset = applyLighting(this.scene, id);
    this.scene.fog.color.set(preset.fog);
    const boost = id === 'night' ? 1.35 : id === 'evening' ? 1.1 : 0.55;
    this.washes?.forEach(({ light, base }) => { light.intensity = base * boost; });
    this.roadMaterials?.forEach(({ mesh, night, day }) => {
      mesh.material.color.set(id === 'daylight' ? day : id === 'evening' ? night : night);
    });
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
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) {
      if (['running', 'paused'].includes(this.state)) event.preventDefault();
    }
    if (event.repeat) return;
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') this.move(-1);
    else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') this.move(1);
    else if (event.key === 'ArrowUp' || event.key === ' ' || event.key.toLowerCase() === 'w') this.jump();
    else if (event.key === 'Escape') this.state === 'running' ? this.pause() : this.state === 'paused' ? this.resume() : null;
    else if ((event.key === 'Enter' || event.key.toLowerCase() === 'r') && ['over', 'won'].includes(this.state)) this.start();
    else if (event.key === 'Enter' && this.state === 'menu') this.start();
  }

  handleTouchStart(event) {
    if (!event.changedTouches?.[0]) return;
    this.touchOrigin = { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
  }

  handleTouchEnd(event) {
    if (!this.touchOrigin || !event.changedTouches?.[0]) return;
    const dx = event.changedTouches[0].clientX - this.touchOrigin.x;
    const dy = event.changedTouches[0].clientY - this.touchOrigin.y;
    this.touchOrigin = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) this.move(dx > 0 ? 1 : -1);
    else if (dy < 0) this.jump();
  }

  move(direction) {
    if (this.state !== 'running') return;
    this.targetLane = clamp(this.targetLane + direction, 0, 2);
  }

  jump() {
    if (this.state !== 'running' || this.jumpTime > 0) return;
    this.jumpTime = 0.72;
    sound.playJump();
  }

  spawnObstacleRow() {
    const rand = Math.random();
    // 38% Danfo minibus, 38% Hurdle, 24% Market Crate
    const primaryKind = rand < 0.38 ? 'danfo' : rand < 0.76 ? 'hurdle' : 'crate';
    const primaryLane = randomLane();

    // At higher speeds, occasionally spawn 2 obstacles, but guarantee at least one lane is safe or jumpable
    const spawnDouble = this.speed > 11.5 && Math.random() < 0.38;
    const lanesToSpawn = [primaryLane];
    if (spawnDouble) {
      const secondLane = (primaryLane + (Math.random() < 0.5 ? 1 : 2)) % 3;
      lanesToSpawn.push(secondLane);
    }

    lanesToSpawn.forEach((lane, idx) => {
      // If spawning two obstacles, ensure at least one is a jumpable hurdle to guarantee a fair route
      const kind = (idx === 1 && primaryKind !== 'hurdle') ? 'hurdle' : primaryKind;
      let mesh;
      if (kind === 'danfo') mesh = createDanfoBus();
      else if (kind === 'hurdle') mesh = createHurdle();
      else mesh = createCrate();

      mesh.position.set(LANES[lane], 0, -42);
      this.scene.add(mesh);
      this.items.push({ type: 'obstacle', kind, lane, mesh, hit: false });
    });

    // Spawn coin trail in an unblocked safe lane
    const safeLanes = [0, 1, 2].filter((l) => !lanesToSpawn.includes(l));
    const coinLane = safeLanes.length ? safeLanes[Math.floor(Math.random() * safeLanes.length)] : randomLane();
    const trailLength = Math.random() < 0.4 ? 4 : 3;
    for (let i = 0; i < trailLength; i += 1) {
      const coin = createCoinMesh();
      coin.position.set(LANES[coinLane], 0.72, -38 - i * 1.25);
      this.scene.add(coin);
      this.items.push({ type: 'coin', lane: coinLane, mesh: coin, collected: false });
    }
  }

  start() {
    this.clearItems();
    this.state = 'running';
    this.score = 0;
    this.coins = 0;
    this.lives = 3;
    this.lane = 1;
    this.targetLane = 1;
    this.jumpTime = 0;
    this.elapsed = 0;
    this.speed = 8;
    this.spawnTimer = 0.5;
    this.hitCooldown = 0;
    this.shake = 0;
    this.lastFrame = performance.now();
    sound.playStart();
    this.notify();
  }

  returnToMenu() {
    this.state = 'menu';
    this.clearItems();
    this.lane = 1;
    this.targetLane = 1;
    this.jumpTime = 0;
    this.character.position.set(0, FOOT_Y, 2.15);
    this.character.visible = true;
    this.camera.position.set(0, 5.2, 8.8);
    this.camera.lookAt(0, 0.9, -4);
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

  hit() {
    if (this.hitCooldown > 0 || this.state !== 'running') return;
    this.lives -= 1;
    this.hitCooldown = 1.2;
    this.shake = 0.38;
    sound.playHit();
    if (this.lives <= 0) {
      this.state = 'over';
      this.best = Math.max(this.best, Math.floor(this.score));
      try { localStorage.setItem('arcade:identity-dash:best', String(this.best)); } catch {}
      sound.playGameOver();
    }
    this.notify();
  }

  clearItems() {
    for (const item of this.items) {
      this.disposeItem(item);
    }
    this.items = [];
  }

  disposeItem(item) {
    this.scene.remove(item.mesh);
    item.mesh.traverse((child) => {
      child.geometry?.dispose();
      if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
      else child.material?.dispose();
    });
  }

  notify() {
    this.onChange({ state: this.state, score: Math.floor(this.score), coins: this.coins, best: this.best, lives: this.lives });
  }

  update(dt) {
    this.elapsed += dt;
    const running = this.state === 'running';
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);

    // Character invulnerability flash
    if (this.hitCooldown > 0) {
      this.character.visible = Math.floor(this.elapsed * 16) % 2 === 0;
    } else {
      this.character.visible = true;
    }

    this.lane += (this.targetLane - this.lane) * Math.min(1, dt * 12);
    this.character.position.x = LANES[Math.round(this.lane)] + (LANES[this.targetLane] - LANES[Math.round(this.lane)]) * Math.min(1, Math.abs(this.lane - Math.round(this.lane)) * 2);
    this.character.position.x = THREE.MathUtils.damp(this.character.position.x, LANES[this.targetLane], 11, dt);

    if (this.jumpTime > 0) {
      this.jumpTime = Math.max(0, this.jumpTime - dt);
      const progress = 1 - this.jumpTime / 0.72;
      this.character.position.y = Math.sin(progress * Math.PI) * 1.05;
    } else {
      this.character.position.y = 0;
    }
    this.playerShadow.position.x = this.character.position.x;
    this.playerShadow.material.opacity = 0.38 - Math.min(0.2, this.character.position.y * 0.12);
    animatePlayerCharacter(this.character, this.elapsed, running || this.state === 'menu');

    for (const mark of this.roadMarks) {
      if (running) mark.position.z += this.speed * dt;
      if (mark.position.z > 5) mark.position.z -= 67.2;
    }
    if (running) {
      this.speed = Math.min(18.5, this.speed + dt * 0.11);
      this.score += dt * this.speed * 2.2;
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnObstacleRow();
        this.spawnTimer = Math.max(0.88, 1.45 - (this.speed - 8) * 0.045) + Math.random() * 0.28;
      }
    }

    for (const item of this.items) {
      if (running && !item.collected) item.mesh.position.z += this.speed * dt;
      if (item.type === 'coin') {
        item.mesh.rotation.y += dt * 3.2;
        item.mesh.rotation.x = Math.sin(this.elapsed * 3 + item.mesh.position.z) * 0.12;
        const alignedLane = item.lane === this.targetLane;
        if (running && alignedLane && Math.abs(item.mesh.position.z - 2.15) < 0.65 && Math.abs(this.character.position.y - 0.7) < 0.75) {
          item.collected = true;
          item.mesh.visible = false;
          this.coins += 1;
          this.score += 35;
          sound.playCoin();
          this.notify();
        }
      } else if (running && !item.hit && item.lane === this.targetLane && Math.abs(item.mesh.position.z - 2.15) < 0.82) {
        const clearedHurdle = item.kind === 'hurdle' && this.character.position.y > 0.48;
        if (clearedHurdle) {
          // cleanly cleared the hurdle
        } else {
          item.hit = true;
          item.mesh.visible = false;
          this.hit();
        }
      }
    }
    this.items = this.items.filter((item) => {
      const keep = item.mesh.position.z < 5 && !item.collected && !(item.type === 'obstacle' && item.hit);
      if (!keep) this.disposeItem(item);
      return keep;
    });

    let targetCamX = this.character.position.x * 0.12;
    let targetCamY = 5.2;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.8);
      targetCamX += (Math.random() - 0.5) * this.shake * 0.8;
      targetCamY += (Math.random() - 0.5) * this.shake * 0.8;
    }
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetCamX, 2.8, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetCamY, 2.8, dt);
    this.camera.lookAt(this.character.position.x * 0.1, 0.9, -3.8);
  }

  frame(now) {
    if (this.disposed) return;
    const dt = Math.min(0.045, (now - this.lastFrame) / 1000 || 0);
    this.lastFrame = now;
    this.update(dt);
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
    this.clearItems();
    this.scene.traverse((object) => {
      object.userData.disposeTexture?.dispose();
      object.geometry?.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material?.dispose();
    });
    this.renderer.dispose();
  }
}

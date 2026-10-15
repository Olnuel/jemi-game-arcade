import * as THREE from 'three';
import { animatePlayerCharacter, applyPlayerCharacterStyle, createPlayerCharacter, PREVIEW_STYLE } from '../identity/player-character.js';
import { addMarketStall, addStringLights } from '../scene/lagos-night-market.js';

const LANES = [-1.55, 0, 1.55];
const randomLane = () => Math.floor(Math.random() * LANES.length);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class IdentityDash {
  constructor(canvas, { style = PREVIEW_STYLE, onChange = () => {} } = {}) {
    this.canvas = canvas;
    this.onChange = onChange;
    this.state = 'menu';
    this.score = 0;
    this.coins = 0;
    this.best = Number(localStorage.getItem('arcade:identity-dash:best') || 0);
    this.lives = 3;
    this.lane = 1;
    this.targetLane = 1;
    this.jumpTime = 0;
    this.elapsed = 0;
    this.speed = 8;
    this.spawnTimer = 0.7;
    this.hitCooldown = 0;
    this.items = [];
    this.roadMarks = [];
    this.disposed = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#121b21');
    this.scene.fog = new THREE.FogExp2('#17232a', 0.017);
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
    this.camera.position.set(0, 5.2, 8.8);
    this.camera.lookAt(0, 0.9, -4);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    const ambient = new THREE.HemisphereLight('#d8eaff', '#533528', 2.15);
    this.scene.add(ambient);
    const moon = new THREE.DirectionalLight('#fff0c9', 2.2);
    moon.position.set(-4, 8, 5);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    this.scene.add(moon);
    const signLight = new THREE.PointLight('#ef7740', 34, 16, 2);
    signLight.position.set(3.2, 2.4, -4);
    this.scene.add(signLight);
    const tealLight = new THREE.PointLight('#33d5bf', 20, 15, 2);
    tealLight.position.set(-3.8, 2.8, -9);
    this.scene.add(tealLight);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 90),
      new THREE.MeshStandardMaterial({ color: '#242728', roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.06, -29);
    ground.receiveShadow = true;
    this.scene.add(ground);

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(5.9, 90),
      new THREE.MeshStandardMaterial({ color: '#292d2e', roughness: 0.86 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, -0.025, -29);
    road.receiveShadow = true;
    this.scene.add(road);

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
    this.character.position.set(0, 0, 2.15);
    this.scene.add(this.character);
    this.playerShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 24),
      new THREE.MeshBasicMaterial({ color: '#0a0f10', transparent: true, opacity: 0.38 }),
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
      new THREE.MeshStandardMaterial({ color: '#55d3c3', emissive: '#148878', emissiveIntensity: 1.25 }),
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
        const postMat = new THREE.MeshStandardMaterial({ color: '#493b35', roughness: 0.9 });
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

    const sign = new THREE.Group();
    sign.position.set(4.1, 2.2, -15);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 0.62, 0.1),
      new THREE.MeshStandardMaterial({ color: '#ed7842', emissive: '#9d3013', emissiveIntensity: 0.95 }),
    );
    sign.add(board);
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.73, 0.08),
      new THREE.MeshStandardMaterial({ color: '#f4c36f', emissive: '#795019', emissiveIntensity: 0.35 }),
    );
    frame.position.z = -0.075;
    sign.add(frame);
    this.scene.add(sign);
  }

  setStyle(style = PREVIEW_STYLE) {
    applyPlayerCharacterStyle(this.character, style);
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
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) event.preventDefault();
    if (event.repeat) return;
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') this.move(-1);
    else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') this.move(1);
    else if (event.key === 'ArrowUp' || event.key === ' ' || event.key.toLowerCase() === 'w') this.jump();
    else if (event.key === 'Escape' && this.state === 'running') this.pause();
  }

  handleTouchStart(event) {
    this.touchOrigin = { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
  }

  handleTouchEnd(event) {
    if (!this.touchOrigin) return;
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
  }

  spawnObstacleRow() {
    const kind = Math.random() > 0.58 ? 'crate' : 'hurdle';
    const lane = randomLane();
    const object = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: kind === 'crate' ? '#c66c3b' : '#eea342',
      roughness: 0.62,
      metalness: 0.08,
    });
    const shape = new THREE.Mesh(
      kind === 'crate' ? new THREE.BoxGeometry(0.88, 0.85, 0.76) : new THREE.BoxGeometry(0.95, 0.46, 0.48),
      bodyMat,
    );
    shape.position.y = kind === 'crate' ? 0.46 : 0.23;
    shape.castShadow = true;
    object.add(shape);
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(kind === 'crate' ? 0.9 : 0.97, 0.075, 0.49),
      new THREE.MeshStandardMaterial({ color: '#f6d39b', emissive: '#a55e24', emissiveIntensity: 0.28 }),
    );
    band.position.y = kind === 'crate' ? 0.47 : 0.25;
    object.add(band);
    object.position.set(LANES[lane], 0, -42);
    this.scene.add(object);
    this.items.push({ type: 'obstacle', kind, lane, mesh: object, hit: false });

    const coinLane = (lane + 1 + Math.floor(Math.random() * 2)) % 3;
    for (let i = 0; i < 4; i += 1) {
      const coin = new THREE.Mesh(
        new THREE.TorusGeometry(0.23, 0.075, 8, 18),
        new THREE.MeshStandardMaterial({ color: '#ffd477', emissive: '#d68128', emissiveIntensity: 1.35, metalness: 0.55, roughness: 0.3 }),
      );
      coin.position.set(LANES[coinLane], 1.14, -39 - i * 1.14);
      coin.castShadow = true;
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
    this.lastFrame = performance.now();
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
    this.hitCooldown = 1.1;
    if (this.lives <= 0) {
      this.state = 'over';
      this.best = Math.max(this.best, Math.floor(this.score));
      localStorage.setItem('arcade:identity-dash:best', String(this.best));
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
      this.speed = Math.min(17, this.speed + dt * 0.12);
      this.score += dt * this.speed * 2.2;
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnObstacleRow();
        this.spawnTimer = Math.max(0.93, 1.45 - (this.speed - 8) * 0.045) + Math.random() * 0.3;
      }
    }

    for (const item of this.items) {
      if (running && !item.collected) item.mesh.position.z += this.speed * dt;
      if (item.type === 'coin') {
        item.mesh.rotation.y += dt * 2.4;
        item.mesh.rotation.x = Math.sin(this.elapsed * 3 + item.mesh.position.z) * 0.12;
        const alignedLane = item.lane === this.targetLane;
        if (running && alignedLane && Math.abs(item.mesh.position.z - 2) < 0.54 && Math.abs(this.character.position.y - 0.6) < 0.7) {
          item.collected = true;
          item.mesh.visible = false;
          this.coins += 1;
          this.score += 35;
          this.notify();
        }
      } else if (running && !item.hit && item.lane === this.targetLane && Math.abs(item.mesh.position.z - 2.15) < 0.82) {
        const clearedHurdle = item.kind === 'hurdle' && this.character.position.y > 0.55;
        item.hit = true;
        item.mesh.visible = false;
        if (!clearedHurdle) this.hit();
      }
    }
    this.items = this.items.filter((item) => {
      const keep = item.mesh.position.z < 5 && !item.collected && !(item.type === 'obstacle' && item.hit);
      if (!keep) this.disposeItem(item);
      return keep;
    });
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.character.position.x * 0.12, 2.8, dt);
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

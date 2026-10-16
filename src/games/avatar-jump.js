import { sound } from '../audio/sound.js';
import * as THREE from 'three';
import { animatePlayerCharacter, applyPlayerCharacterStyle, createPlayerCharacter, FOOT_Y, PREVIEW_STYLE } from '../identity/player-character.js';
import { addMarketStall, addStringLights, makeLabel } from '../scene/lagos-night-market.js';
import { applyLighting, LIGHT_PRESETS, readLighting } from '../scene/sky.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
// The figure is modelled with its feet at the root, so the root sits just above
// the surface. Landing maths uses `position.y - PLAYER_FOOT_OFFSET`, which keeps
// feet == platform top exactly as before.
const PLAYER_FOOT_OFFSET = FOOT_Y;

export function getFallLimit(platform) {
  return platform ? platform.userData.top - 2.8 : -2.5;
}

export function persistBestScore(score, best, storage = globalThis.localStorage) {
  const nextBest = Math.max(best, score);
  try { storage?.setItem('arcade:avatar-jump:best', String(nextBest)); } catch {}
  return nextBest;
}

function makeStarGeometry() {
  const shape = new THREE.Shape();
  for (let point = 0; point < 10; point += 1) {
    const radius = point % 2 === 0 ? 0.32 : 0.14;
    const angle = Math.PI / 2 + (point * Math.PI) / 5;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (point === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.035,
    bevelThickness: 0.035,
  });
}

function createWaterTank() {
  const tankGroup = new THREE.Group();
  const standMat = new THREE.MeshStandardMaterial({ color: '#323a3d', roughness: 0.8, metalness: 0.3 });
  const legGeom = new THREE.CylinderGeometry(0.035, 0.035, 0.72, 6);
  [-0.26, 0.26].forEach((x) => {
    [-0.26, 0.26].forEach((z) => {
      const leg = new THREE.Mesh(legGeom, standMat);
      leg.position.set(x, 0.36, z);
      tankGroup.add(leg);
    });
  });

  const tankMat = new THREE.MeshStandardMaterial({ color: '#1a1f21', roughness: 0.5, metalness: 0.1 });
  const tankBody = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.75, 16), tankMat);
  tankBody.position.y = 1.08;
  tankBody.castShadow = true;
  tankGroup.add(tankBody);

  const lid = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.16, 16), tankMat);
  lid.position.y = 1.52;
  tankGroup.add(lid);

  return tankGroup;
}

function createRooftopPergola(width = 2.6) {
  const pergola = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: '#885032', roughness: 0.7, metalness: 0.05 });
  const beamMat = new THREE.MeshStandardMaterial({ color: '#25746b', roughness: 0.6 });

  const postGeom = new THREE.BoxGeometry(0.09, 1.65, 0.09);
  const halfW = width * 0.42;
  [-halfW, halfW].forEach((x) => {
    [-0.75, 0.75].forEach((z) => {
      const post = new THREE.Mesh(postGeom, woodMat);
      post.position.set(x, 0.82, z);
      post.castShadow = true;
      pergola.add(post);
    });
  });

  const beamLong = new THREE.Mesh(new THREE.BoxGeometry(width * 0.95, 0.09, 0.09), beamMat);
  beamLong.position.set(0, 1.65, -0.75);
  pergola.add(beamLong);
  const beamLong2 = beamLong.clone();
  beamLong2.position.z = 0.75;
  pergola.add(beamLong2);

  for (let s = -3; s <= 3; s++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 1.7), woodMat);
    slat.position.set(s * (halfW * 0.3), 1.73, 0);
    pergola.add(slat);
  }

  const bannerMat = new THREE.MeshStandardMaterial({
    color: '#ffc83b',
    emissive: '#e59022',
    emissiveIntensity: 1.2,
    roughness: 0.3,
  });
  const banner = new THREE.Mesh(new THREE.BoxGeometry(width * 0.65, 0.32, 0.04), bannerMat);
  banner.position.set(0, 1.35, 0.76);
  pergola.add(banner);

  return pergola;
}

export class AvatarJump {
  constructor(canvas, { style = PREVIEW_STYLE, lighting = readLighting(), onChange = () => {} } = {}) {
    this.canvas = canvas;
    this.onChange = onChange;
    this.lighting = lighting;
    this.state = 'menu';
    this.score = 0;
    this.stars = 0;
    let savedBest = 0;
    try {
      savedBest = Number(localStorage.getItem('arcade:avatar-jump:best') || 0);
    } catch {}
    this.best = Number.isFinite(savedBest) ? savedBest : 0;
    this.lives = 1;
    this.elapsed = 0;
    this.platforms = [];
    this.collectibles = [];
    this.disposed = false;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
    this.camera.position.set(0, 8, 14);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.14;

    this.buildScene(style);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);

    this.onKeyDown = (event) => this.handleKeyDown(event);
    this.onKeyUp = (event) => this.handleKeyUp(event);
    this.onTouchStart = (event) => this.handleTouchStart(event);
    this.onTouchEnd = (event) => this.handleTouchEnd(event);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('touchstart', this.onTouchStart, { passive: true });
    canvas.addEventListener('touchend', this.onTouchEnd, { passive: true });

    this.resize();
    this.lastFrame = performance.now();
    this.frame = this.frame.bind(this);
    this.animationFrame = requestAnimationFrame(this.frame);
    this.notify();
  }

  buildScene(style) {
    applyLighting(this.scene, this.lighting);

    // Market glow: Nigerian green, ember and danfo yellow. It carries the night,
    // so it is dimmed in daylight.
    this.washes = [];
    const addWash = (color, intensity, x, y, z) => {
      const light = new THREE.PointLight(color, intensity, 22, 2);
      light.position.set(x, y, z);
      this.scene.add(light);
      this.washes.push({ light, base: intensity });
      return light;
    };
    addWash('#00d98a', 25, -4.5, 6, -1.8);
    addWash('#ff5722', 28, 4.5, 7, -1.4);
    addWash('#ffcc00', 32, 0, 13.5, 1);

    const haze = new THREE.Mesh(
      new THREE.PlaneGeometry(55, 65),
      new THREE.MeshBasicMaterial({ color: '#234148', transparent: true, opacity: 0.45 }),
    );
    haze.rotation.x = -Math.PI / 2;
    haze.position.set(0, -1.1, -13);
    this.scene.add(haze);

    this.buildCourse();
    this.character = createPlayerCharacter(style);
    this.character.position.set(0, PLAYER_FOOT_OFFSET, 0);
    // The camera watches from +Z, so turn the rig to face the climb instead of the lens.
    this.character.rotation.y = Math.PI;
    this.scene.add(this.character);

    this.playerShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.48, 24),
      new THREE.MeshBasicMaterial({ color: '#060f12', transparent: true, opacity: 0.4 }),
    );
    this.playerShadow.rotation.x = -Math.PI / 2;
    this.playerShadow.position.set(0, 0.015, 0);
    this.scene.add(this.playerShadow);
  }

  buildCourse() {
    const course = [
      { x: 0, y: 0, start: true, color: '#25574f', edge: '#f09650' },
      { x: 1.25, y: 1.8, color: '#b85e35', edge: '#f3c276' },
      { x: -0.95, y: 3.6, color: '#2a6a62', edge: '#58e3cb' },
      { x: 1.05, y: 5.4, color: '#c77f3a', edge: '#ffe596' },
      { x: -1.1, y: 7.2, color: '#314e60', edge: '#52d1d8' },
      { x: 0.82, y: 9.0, color: '#aa5537', edge: '#fca867' },
      { x: 0, y: 10.8, finish: true, color: '#204f4a', edge: '#ffd166' },
    ];

    for (let index = 0; index < course.length; index += 1) {
      const step = course[index];
      const platform = new THREE.Group();
      const width = step.start ? 2.8 : step.finish ? 2.85 : 2.15;
      const depth = step.finish ? 2.45 : 2.25;

      const slabMat = new THREE.MeshStandardMaterial({
        color: step.color,
        roughness: 0.58,
        metalness: 0.1,
        emissive: step.color,
        emissiveIntensity: 0.22,
      });

      const slab = new THREE.Mesh(new THREE.BoxGeometry(width, 0.24, depth), slabMat);
      slab.position.y = -0.12;
      slab.receiveShadow = true;
      slab.castShadow = true;
      platform.add(slab);

      const edgeMat = new THREE.MeshStandardMaterial({
        color: step.edge,
        emissive: step.edge,
        emissiveIntensity: 0.55,
        roughness: 0.45,
      });
      const frontStripe = new THREE.Mesh(new THREE.BoxGeometry(width * 0.94, 0.04, 0.06), edgeMat);
      frontStripe.position.set(0, 0.015, depth / 2 - 0.04);
      platform.add(frontStripe);

      [-width / 2 + 0.03, width / 2 - 0.03].forEach((sx) => {
        const sideStripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, depth * 0.8), edgeMat);
        sideStripe.position.set(sx, 0.015, 0);
        platform.add(sideStripe);
      });

      if (step.finish) {
        const pergola = createRooftopPergola(width);
        platform.add(pergola);

        const tank = createWaterTank();
        tank.position.set(width * 0.42, 0, -depth * 0.32);
        platform.add(tank);

        const antennaMat = new THREE.MeshStandardMaterial({ color: '#c0c8cc', metalness: 0.8, roughness: 0.3 });
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.8, 6), antennaMat);
        pole.position.set(-width * 0.42, 0.9, -depth * 0.35);
        platform.add(pole);

        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 12, 10),
          new THREE.MeshBasicMaterial({ color: '#ff4d4d' }),
        );
        beacon.position.set(-width * 0.42, 1.82, -depth * 0.35);
        platform.add(beacon);
      }

      platform.position.set(step.x, step.y, 0);
      platform.userData = { top: step.y, width, finish: Boolean(step.finish), index };
      this.scene.add(platform);
      this.platforms.push(platform);

      if (!step.start && !step.finish) {
        const starMat = new THREE.MeshStandardMaterial({
          color: '#ffd677',
          emissive: '#f8a932',
          emissiveIntensity: 1.85,
          metalness: 0.22,
          roughness: 0.25,
        });
        const starMesh = new THREE.Mesh(makeStarGeometry(), starMat);
        const baseY = step.y + 0.82;
        starMesh.position.set(step.x, baseY, 0.02);
        starMesh.rotation.y = Math.PI / 2;
        starMesh.castShadow = true;
        this.scene.add(starMesh);
        this.collectibles.push({ mesh: starMesh, baseY, collected: false, platformIndex: index });
      }
    }

    for (let level = 0; level < 4; level += 1) {
      const y = -0.4 + level * 3.6;
      addMarketStall(this.scene, { x: -5.3, y, z: -2.8, scale: 0.9, sign: level === 0 ? 'LAGOS' : 'SUYA', accent: '#d77544' });
      addMarketStall(this.scene, { x: 5.3, y, z: -3.6, scale: 0.88, sign: level % 2 ? 'NIGHT BUKA' : 'FRESH', accent: '#168f7e' });
      addStringLights(this.scene, { start: [-5.4, y + 3.1, -3], end: [5.4, y + 3.1, -4], count: 9 });
    }

    const skyline = new THREE.Group();
    skyline.position.set(0, 0, -10.5);
    for (let index = 0; index < 12; index += 1) {
      const width = 0.7 + (index % 3) * 0.38;
      const height = 2.4 + ((index * 7) % 6) * 0.65;
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, 0.6),
        new THREE.MeshStandardMaterial({ color: index % 2 ? '#26373d' : '#332d30', roughness: 0.95 }),
      );
      tower.position.set(-6.6 + index * 1.22, height / 2 - 0.5, 0);
      skyline.add(tower);
    }
    const skylineLabel = makeLabel('LAGOS AFTER DARK', '#ffca78');
    skylineLabel.position.set(0, 4.8, 0.3);
    skylineLabel.scale.set(4.5, 0.9, 1);
    skyline.add(skylineLabel);
    this.scene.add(skyline);
  }

  /** Switches the time of day live, without rebuilding the course. */
  setLighting(id) {
    if (!LIGHT_PRESETS[id]) return;
    this.lighting = id;
    applyLighting(this.scene, id);
    const boost = id === 'night' ? 1.35 : id === 'evening' ? 1.1 : 0.55;
    this.washes?.forEach(({ light, base }) => { light.intensity = base * boost; });
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

  handleKeyDown(event) {
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', ' ', 'a', 'd', 'w'].includes(key)) {
      if (['running', 'paused'].includes(this.state)) event.preventDefault();
    }
    if (event.repeat) return;
    if (key === 'arrowleft' || key === 'a') this.move(-1);
    else if (key === 'arrowright' || key === 'd') this.move(1);
    else if (key === 'arrowup' || key === ' ' || key === 'w') this.jump();
    else if (key === 'escape') this.state === 'running' ? this.pause() : this.state === 'paused' ? this.resume() : null;
    else if ((key === 'r' || key === 'enter') && ['won', 'over'].includes(this.state)) this.start();
    else if (key === 'enter' && this.state === 'menu') this.start();
  }

  handleKeyUp() {}

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
    this.targetX = clamp(this.targetX + direction * 0.9, -2.2, 2.2);
  }

  jump() {
    if (this.state !== 'running' || !this.grounded) return;
    this.grounded = false;
    this.velocityY = 10.2;
    sound.playJump();
  }

  start() {
    this.state = 'running';
    this.score = 0;
    this.stars = 0;
    this.platformIndex = 0;
    this.targetX = this.platforms[0].position.x;
    this.character.position.set(this.targetX, this.platforms[0].userData.top + PLAYER_FOOT_OFFSET, 0);
    this.previousFeet = this.platforms[0].userData.top;
    this.velocityY = 0;
    this.grounded = true;
    this.elapsed = 0;
    for (const collectible of this.collectibles) {
      collectible.collected = false;
      collectible.mesh.visible = true;
    }
    this.camera.position.y = 8;
    sound.playStart();
    this.notify();
  }

  returnToMenu() {
    this.state = 'menu';
    this.platformIndex = 0;
    this.targetX = this.platforms[0]?.position.x || 0;
    this.character.position.set(this.targetX, (this.platforms[0]?.userData.top || 0) + PLAYER_FOOT_OFFSET, 0);
    this.character.scale.set(1, 1, 1);
    this.grounded = true;
    this.velocityY = 0;
    this.camera.position.set(0, 8, 14);
    for (const collectible of this.collectibles) {
      collectible.collected = false;
      collectible.mesh.visible = true;
    }
    this.notify();
  }

  pause() {
    if (this.state === 'running') {
      this.state = 'paused';
      this.notify();
    }
  }

  resume() {
    if (this.state === 'paused') {
      this.state = 'running';
      this.lastFrame = performance.now();
      this.notify();
    }
  }

  landOn(platform) {
    this.character.position.y = platform.userData.top + PLAYER_FOOT_OFFSET;
    this.velocityY = 0;
    this.grounded = true;
    this.character.scale.set(1.14, 0.86, 1.14);
    sound.playLand();

    if (platform.userData.index > this.platformIndex) {
      this.platformIndex = platform.userData.index;
      this.score += 100;
    }
    if (platform.userData.finish) {
      this.state = 'won';
      sound.playWin();
      this.best = persistBestScore(this.score, this.best);
    }
    this.notify();
  }

  update(dt) {
    this.elapsed += dt;
    const before = this.character.position.y - PLAYER_FOOT_OFFSET;
    this.previousFeet = before;

    this.character.scale.x = THREE.MathUtils.damp(this.character.scale.x, 1, 12, dt);
    this.character.scale.y = THREE.MathUtils.damp(this.character.scale.y, 1, 12, dt);
    this.character.scale.z = THREE.MathUtils.damp(this.character.scale.z, 1, 12, dt);

    if (this.state === 'running') {
      const currentPlatform = this.platforms[this.platformIndex];
      if (this.grounded && currentPlatform) {
        if (Math.abs(this.character.position.x - currentPlatform.position.x) > currentPlatform.userData.width / 2) {
          this.grounded = false;
          this.velocityY = 0;
        }
      }

      this.character.position.x = THREE.MathUtils.damp(this.character.position.x, this.targetX, 9, dt);

      if (!this.grounded) {
        this.velocityY -= 20 * dt;
        this.character.position.y += this.velocityY * dt;
      }

      const feet = this.character.position.y - PLAYER_FOOT_OFFSET;
      if (!this.grounded && this.velocityY <= 0) {
        const landing = this.platforms.find((platform) => {
          const top = platform.userData.top;
          return (
            platform.userData.index >= this.platformIndex &&
            this.previousFeet >= top &&
            feet <= top &&
            Math.abs(this.character.position.x - platform.position.x) <= platform.userData.width / 2 + 0.22
          );
        });
        if (landing) this.landOn(landing);
      }

      for (const collectible of this.collectibles) {
        if (!collectible.collected) {
          collectible.mesh.rotation.y += dt * 3.0;
          collectible.mesh.position.y = collectible.baseY + Math.sin(this.elapsed * 4 + collectible.platformIndex) * 0.08;
          const star = collectible.mesh.position;
          if (Math.hypot(this.character.position.x - star.x, this.character.position.y - star.y) < 0.76) {
            collectible.collected = true;
            collectible.mesh.visible = false;
            sound.playCoin();
            this.stars += 1;
            this.score += 50;
            this.notify();
          }
        }
      }

      const fallLimit = getFallLimit(currentPlatform);
      if (
        this.character.position.x < -3.2 ||
        this.character.position.x > 3.2 ||
        this.character.position.y < fallLimit
      ) {
        this.state = 'over';
        sound.playGameOver();
        this.best = persistBestScore(this.score, this.best);
        this.notify();
      }

      this.camera.position.y = THREE.MathUtils.damp(
        this.camera.position.y,
        Math.max(8, this.character.position.y + 5.8),
        2.6,
        dt,
      );
    }

    this.playerShadow.position.x = this.character.position.x;
    this.playerShadow.position.z = 0;
    this.playerShadow.position.y = this.grounded ? 0.02 : 0.025;
    this.playerShadow.material.opacity = this.grounded ? 0.38 : 0.12;

    animatePlayerCharacter(this.character, this.elapsed, this.state === 'running' && !this.grounded);
    this.camera.lookAt(0, this.camera.position.y - 4.7, 0);
  }

  notify() {
    this.onChange({
      state: this.state,
      score: this.score,
      coins: this.stars,
      best: this.best,
      lives: 1,
      level: (this.platformIndex || 0) + 1,
      type: 'jump',
      resultTitle: this.state === 'won' ? 'Top of the world.' : 'Missed the landing.',
      resultBody: `${this.stars} stars collected · ${this.score} points`,
      resultAction: 'Climb again',
    });
  }

  frame(now) {
    if (this.disposed) return;
    const dt = Math.min(0.04, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    if (this.state === 'running' && Math.floor(this.elapsed * 5) !== Math.floor((this.elapsed - dt) * 5)) {
      this.notify();
    }
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
    this.scene.traverse((object) => {
      object.userData.disposeTexture?.dispose();
      object.geometry?.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material?.dispose();
    });
    this.renderer.dispose();
  }
}

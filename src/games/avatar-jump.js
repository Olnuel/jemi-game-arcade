import * as THREE from 'three';
import { animatePlayerCharacter, applyPlayerCharacterStyle, createPlayerCharacter, PREVIEW_STYLE } from '../identity/player-character.js';
import { addMarketStall, addStringLights, makeLabel } from '../scene/lagos-night-market.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const PLAYER_FOOT_OFFSET = 0.56;

function makeStarGeometry() {
  const shape = new THREE.Shape();
  for (let point = 0; point < 10; point += 1) {
    const radius = point % 2 === 0 ? 0.32 : 0.14;
    const angle = Math.PI / 2 + point * Math.PI / 5;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (point === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.035, bevelThickness: 0.035 });
}

export class AvatarJump {
  constructor(canvas, { style = PREVIEW_STYLE, onChange = () => {} } = {}) {
    this.canvas = canvas;
    this.onChange = onChange;
    this.state = 'menu';
    this.score = 0;
    this.stars = 0;
    let savedBest = 0;
    try { savedBest = Number(localStorage.getItem('arcade:avatar-jump:best') || 0); } catch {}
    this.best = Number.isFinite(savedBest) ? savedBest : 0;
    this.lives = 1;
    this.elapsed = 0;
    this.platforms = [];
    this.collectibles = [];
    this.disposed = false;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#172631');
    this.scene.fog = new THREE.Fog('#172631', 18, 44);
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
    this.camera.position.set(0, 8, 14);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.buildScene(style);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.onKeyDown = (event) => this.handleKeyDown(event);
    this.onKeyUp = (event) => this.handleKeyUp(event);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.resize();
    this.lastFrame = performance.now();
    this.frame = this.frame.bind(this);
    this.animationFrame = requestAnimationFrame(this.frame);
    this.notify();
  }

  buildScene(style) {
    this.scene.add(new THREE.HemisphereLight('#b8d9df', '#27302c', 2.0));
    const sun = new THREE.DirectionalLight('#ffd19a', 2.5);
    sun.position.set(-5, 10, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    this.scene.add(sun);
    const tealWash = new THREE.PointLight('#36cdb5', 22, 20, 2);
    tealWash.position.set(-4.2, 5, -1.8);
    this.scene.add(tealWash);
    const amberWash = new THREE.PointLight('#ff9352', 27, 19, 2);
    amberWash.position.set(4.4, 6.5, -1.4);
    this.scene.add(amberWash);

    const haze = new THREE.Mesh(
      new THREE.PlaneGeometry(48, 60),
      new THREE.MeshBasicMaterial({ color: '#24444d', transparent: true, opacity: 0.48 }),
    );
    haze.rotation.x = -Math.PI / 2;
    haze.position.set(0, -1.1, -13);
    this.scene.add(haze);

    this.platformMat = new THREE.MeshStandardMaterial({ color: '#24534d', roughness: 0.58, metalness: 0.12, emissive: '#10322f', emissiveIntensity: 0.42 });
    this.platformEdgeMat = new THREE.MeshStandardMaterial({ color: '#e39a59', emissive: '#8c4322', emissiveIntensity: 0.48, roughness: 0.54 });
    this.buildCourse();
    this.character = createPlayerCharacter(style);
    this.character.position.set(0, PLAYER_FOOT_OFFSET, 0);
    this.scene.add(this.character);
    this.playerShadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24), new THREE.MeshBasicMaterial({ color: '#071114', transparent: true, opacity: 0.4 }));
    this.playerShadow.rotation.x = -Math.PI / 2;
    this.playerShadow.position.set(0, 0.015, 0);
    this.scene.add(this.playerShadow);
  }

  buildCourse() {
    const course = [
      { x: 0, y: 0, start: true },
      { x: 1.25, y: 1.8 },
      { x: -0.9, y: 3.6 },
      { x: 1.0, y: 5.4 },
      { x: -1.05, y: 7.2 },
      { x: 0.72, y: 9.0 },
      { x: 0, y: 10.8, finish: true },
    ];
    for (let index = 0; index < course.length; index += 1) {
      const step = course[index];
      const platform = new THREE.Group();
      const width = step.start ? 2.65 : 2.15;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(width, 0.22, 2.25), this.platformMat);
      slab.position.y = -0.11;
      slab.receiveShadow = true;
      slab.castShadow = true;
      platform.add(slab);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(width * 0.83, 0.035, 0.055), this.platformEdgeMat);
      stripe.position.set(0, 0.015, 0.92);
      platform.add(stripe);
      platform.position.set(step.x, step.y, 0);
      platform.userData = { top: step.y, width, finish: Boolean(step.finish), index };
      this.scene.add(platform);
      this.platforms.push(platform);

      if (!step.start && !step.finish) {
        const star = new THREE.Mesh(makeStarGeometry(), new THREE.MeshStandardMaterial({ color: '#ffd57d', emissive: '#f5a83e', emissiveIntensity: 1.8, metalness: 0.18, roughness: 0.3 }));
        star.position.set(step.x, step.y + 0.77, 0.02);
        star.rotation.y = Math.PI / 2;
        star.castShadow = true;
        this.scene.add(star);
        this.collectibles.push({ mesh: star, collected: false, platformIndex: index });
      }
    }

    for (let level = 0; level < 4; level += 1) {
      const y = -0.4 + level * 3.6;
      addMarketStall(this.scene, { x: -5.25, y, z: -2.8, scale: 0.9, sign: level === 0 ? 'LAGOS' : 'SUYA', accent: '#d77544' });
      addMarketStall(this.scene, { x: 5.25, y, z: -3.6, scale: 0.88, sign: level % 2 ? 'NIGHT BUKA' : 'FRESH', accent: '#168f7e' });
      addStringLights(this.scene, { start: [-5.4, y + 3.1, -3], end: [5.4, y + 3.1, -4], count: 9 });
    }
    const skyline = new THREE.Group();
    skyline.position.set(0, 0, -10);
    for (let index = 0; index < 11; index += 1) {
      const width = 0.7 + (index % 3) * 0.35;
      const height = 2.2 + ((index * 7) % 5) * 0.55;
      const tower = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.55), new THREE.MeshStandardMaterial({ color: index % 2 ? '#293a40' : '#332f31', roughness: 0.95 }));
      tower.position.set(-6.3 + index * 1.25, height / 2 - 0.5, 0);
      skyline.add(tower);
    }
    const skylineLabel = makeLabel('LAGOS AFTER DARK', '#ffca78');
    skylineLabel.position.set(0, 4.5, 0.3);
    skylineLabel.scale.set(4.5, 0.9, 1);
    skyline.add(skylineLabel);
    this.scene.add(skyline);
  }

  setStyle(style = PREVIEW_STYLE) { applyPlayerCharacterStyle(this.character, style); }

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
    else if (key === 'r' && ['won', 'over'].includes(this.state)) this.start();
  }

  handleKeyUp() {}

  move(direction) {
    if (this.state !== 'running') return;
    this.targetX = clamp(this.targetX + direction * 0.9, -2.15, 2.15);
  }

  jump() {
    if (this.state !== 'running' || !this.grounded) return;
    this.grounded = false;
    this.velocityY = 10.2;
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
    this.notify();
  }

  returnToMenu() {
    this.state = 'menu';
    this.platformIndex = 0;
    this.targetX = this.platforms[0]?.position.x || 0;
    this.character.position.set(this.targetX, (this.platforms[0]?.userData.top || 0) + PLAYER_FOOT_OFFSET, 0);
    this.grounded = true;
    this.velocityY = 0;
    this.camera.position.set(0, 8, 14);
    for (const collectible of this.collectibles) {
      collectible.collected = false;
      collectible.mesh.visible = true;
    }
    this.notify();
  }

  pause() { if (this.state === 'running') { this.state = 'paused'; this.notify(); } }
  resume() { if (this.state === 'paused') { this.state = 'running'; this.lastFrame = performance.now(); this.notify(); } }

  landOn(platform) {
    this.character.position.y = platform.userData.top + PLAYER_FOOT_OFFSET;
    this.velocityY = 0;
    this.grounded = true;
    if (platform.userData.index > this.platformIndex) {
      this.platformIndex = platform.userData.index;
      this.score += 100;
    }
    if (platform.userData.finish) {
      this.state = 'won';
      this.best = Math.max(this.best, this.score);
      try { localStorage.setItem('arcade:avatar-jump:best', String(this.best)); } catch {}
    }
    this.notify();
  }

  update(dt) {
    this.elapsed += dt;
    const before = this.character.position.y - PLAYER_FOOT_OFFSET;
    this.previousFeet = before;
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
          return platform.userData.index >= this.platformIndex && this.previousFeet >= top && feet <= top && Math.abs(this.character.position.x - platform.position.x) <= platform.userData.width / 2 + 0.22;
        });
        if (landing) this.landOn(landing);
      }
      for (const collectible of this.collectibles) {
        if (collectible.collected) continue;
        const star = collectible.mesh.position;
        if (Math.hypot(this.character.position.x - star.x, this.character.position.y - star.y) < 0.76) {
          collectible.collected = true;
          collectible.mesh.visible = false;
          this.stars += 1;
          this.score += 50;
          this.notify();
        }
      }
      if (this.character.position.x < -3.15 || this.character.position.x > 3.15 || this.character.position.y < -3) {
        this.state = 'over';
        this.best = Math.max(this.best, this.score);
        try { localStorage.setItem('arcade:avatar-jump:best', String(this.best)); } catch {}
        this.notify();
      }
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, Math.max(8, this.character.position.y + 5.8), 2.6, dt);
    }
    this.playerShadow.position.x = this.character.position.x;
    this.playerShadow.position.z = 0;
    this.playerShadow.position.y = this.grounded ? 0.02 : 0.025;
    this.playerShadow.material.opacity = this.grounded ? 0.38 : 0.12;
    animatePlayerCharacter(this.character, this.elapsed, this.state === 'running' && !this.grounded);
    this.camera.lookAt(0, this.camera.position.y - 4.7, 0);
  }

  notify() {
    this.onChange({ state: this.state, score: this.score, coins: this.stars, best: this.best, lives: 1, level: (this.platformIndex || 0) + 1, type: 'jump', resultTitle: this.state === 'won' ? 'Top of the world.' : 'Missed the landing.', resultBody: `${this.stars} stars collected · ${this.score} points`, resultAction: 'Climb again' });
  }

  frame(now) {
    if (this.disposed) return;
    const dt = Math.min(0.04, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    if (this.state === 'running' && Math.floor(this.elapsed * 5) !== Math.floor((this.elapsed - dt) * 5)) this.notify();
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.scene.traverse((object) => {
      object.userData.disposeTexture?.dispose();
      object.geometry?.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material?.dispose();
    });
    this.renderer.dispose();
  }
}

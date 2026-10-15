import * as THREE from 'three';
import { animatePlayerCharacter, applyPlayerCharacterStyle, createPlayerCharacter, PREVIEW_STYLE } from '../identity/player-character.js';
import { addMarketStall, addStringLights, makeLabel } from '../scene/lagos-night-market.js';

const LANES = [-1.45, 0, 1.45];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function createSlipper() {
  const slipper = new THREE.Group();
  const sole = new THREE.Shape();
  sole.moveTo(-0.31, -0.67);
  sole.quadraticCurveTo(-0.4, -0.52, -0.37, -0.2);
  sole.quadraticCurveTo(-0.34, 0.35, -0.22, 0.59);
  sole.quadraticCurveTo(0, 0.86, 0.22, 0.59);
  sole.quadraticCurveTo(0.34, 0.35, 0.37, -0.2);
  sole.quadraticCurveTo(0.4, -0.52, 0.31, -0.67);
  sole.quadraticCurveTo(0, -0.81, -0.31, -0.67);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(sole, { depth: 0.11, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.055, bevelThickness: 0.06 }), new THREE.MeshStandardMaterial({ color: '#d7673b', roughness: 0.54, metalness: 0.05 }));
  body.rotation.x = -Math.PI / 2;
  body.position.y = 0.02;
  body.castShadow = true;
  slipper.add(body);
  const straps = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.045, 8, 22, Math.PI), new THREE.MeshStandardMaterial({ color: '#f4c17c', roughness: 0.48 }));
  straps.rotation.x = Math.PI / 2;
  straps.rotation.z = Math.PI;
  straps.position.set(0, 0.25, -0.08);
  straps.castShadow = true;
  slipper.add(straps);
  return slipper;
}

export class Salubata {
  constructor(canvas, { style = PREVIEW_STYLE, onChange = () => {} } = {}) {
    this.canvas = canvas;
    this.onChange = onChange;
    this.state = 'menu';
    this.phase = 'backward-aim';
    this.turn = 1;
    this.maxTurns = 4;
    this.score = 0;
    this.removed = 0;
    this.elapsed = 0;
    this.bands = [];
    this.throwStart = null;
    this.slipper = null;
    this.disposed = false;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#151e20');
    this.scene.fog = new THREE.FogExp2('#151e20', 0.028);
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
    this.camera.position.set(0, 10, 16);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.buildScene(style);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.onKeyDown = (event) => this.handleKeyDown(event);
    this.onKeyUp = (event) => this.handleKeyUp(event);
    this.onPointerDown = (event) => { event.preventDefault(); this.beginCharge(); };
    this.onPointerUp = (event) => { event.preventDefault(); this.releaseCharge(); };
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.resize();
    this.lastFrame = performance.now();
    this.frame = this.frame.bind(this);
    this.animationFrame = requestAnimationFrame(this.frame);
    this.notify();
  }

  buildScene(style) {
    this.scene.add(new THREE.HemisphereLight('#ffdfbd', '#362d27', 2.05));
    const lamp = new THREE.DirectionalLight('#ffd39a', 2.6);
    lamp.position.set(-4, 9, 5);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(1024, 1024);
    this.scene.add(lamp);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(10, 24), new THREE.MeshStandardMaterial({ color: '#292d29', roughness: 0.96 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.08, -2.5);
    ground.receiveShadow = true;
    this.scene.add(ground);
    const alley = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 23), new THREE.MeshStandardMaterial({ color: '#32312d', roughness: 0.9 }));
    alley.rotation.x = -Math.PI / 2;
    alley.position.set(0, -0.03, -2.5);
    alley.receiveShadow = true;
    this.scene.add(alley);

    const lineMat = new THREE.MeshStandardMaterial({ color: '#d98a4c', emissive: '#713514', emissiveIntensity: 0.38 });
    for (const x of [-4.1, 4.1]) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.025, 23), lineMat);
      line.position.set(x, 0.012, -2.5);
      this.scene.add(line);
    }
    for (let index = 0; index < 6; index += 1) {
      const z = 1 - index * 3.8;
      addMarketStall(this.scene, { x: -5.15, z, scale: 0.95, sign: index % 2 ? 'SUYA' : 'LAGOS', accent: '#df7848' });
      addMarketStall(this.scene, { x: 5.15, z: z - 1.1, scale: 0.93, sign: index % 2 ? 'FRESH' : 'NIGHT BUKA', accent: '#168f7e' });
    }
    addStringLights(this.scene, { start: [-5.2, 4.0, 2], end: [5.2, 4.0, -6], count: 12 });
    const skyline = makeLabel('LAGOS · STREET PLAY', '#f4d49a');
    skyline.position.set(0, 5.4, -8.5);
    skyline.scale.set(5.8, 1.1, 1);
    this.scene.add(skyline);

    this.targetRing = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.045, 8, 64), new THREE.MeshBasicMaterial({ color: '#59dec5' }));
    this.targetRing.rotation.x = Math.PI / 2;
    this.targetRing.position.set(0, 0.035, -2.75);
    this.scene.add(this.targetRing);
    this.buildBands();
    this.character = createPlayerCharacter(style);
    this.character.position.set(0, 0.55, 2.7);
    this.character.rotation.y = Math.PI;
    this.scene.add(this.character);
    this.playerShadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshBasicMaterial({ color: '#080b09', transparent: true, opacity: 0.38 }));
    this.playerShadow.rotation.x = -Math.PI / 2;
    this.playerShadow.position.set(0, 0.015, 2.7);
    this.scene.add(this.playerShadow);
    this.marker = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 8, 28), new THREE.MeshBasicMaterial({ color: '#f2cb82', transparent: true, opacity: 0.9 }));
    this.marker.rotation.x = Math.PI / 2;
    this.marker.visible = false;
    this.scene.add(this.marker);
  }

  buildBands() {
    const positions = [];
    for (const x of LANES) for (const z of [-0.8, -2.35, -3.9]) positions.push([x, z]);
    positions.forEach(([x, z], index) => {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.035, 8, 22), new THREE.MeshStandardMaterial({ color: index % 2 ? '#e5b96d' : '#65d8bd', emissive: index % 2 ? '#81561f' : '#155d4d', emissiveIntensity: 0.65, roughness: 0.42 }));
      band.rotation.x = Math.PI / 2;
      band.position.set(x, 0.09, z);
      band.castShadow = true;
      this.scene.add(band);
      this.bands.push({ mesh: band, x, z, removed: false });
    });
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
    if (['arrowleft', 'arrowright', 'arrowdown', 'arrowup', ' ', 'a', 'd', 's', 'w'].includes(key)) event.preventDefault();
    if (event.repeat) return;
    if (key === 'arrowleft' || key === 'a') this.move(-1);
    else if (key === 'arrowright' || key === 'd') this.move(1);
    else if (key === ' ' || (this.phase === 'backward-aim' && (key === 'arrowdown' || key === 's')) || (this.phase === 'slide-aim' && (key === 'arrowup' || key === 'w'))) this.beginCharge(event.timeStamp);
    else if (key === 'escape') this.state === 'running' ? this.pause() : this.state === 'paused' ? this.resume() : null;
    else if (key === 'r' && ['won', 'over'].includes(this.state)) this.start();
  }

  handleKeyUp(event) {
    const key = event.key.toLowerCase();
    if (key === 'arrowdown' || key === 'arrowup' || key === 'w' || key === 's' || key === ' ') this.releaseCharge(event.timeStamp);
  }

  move(direction) {
    if (this.state !== 'running' || !['backward-aim', 'slide-aim'].includes(this.phase)) return;
    if (this.phase === 'backward-aim') this.aim = clamp(this.aim + direction, 0, 2);
    else this.aim = clamp(this.aim + direction, 0, 2);
    this.notify();
  }

  beginCharge(timeStamp = performance.now()) {
    if (this.state !== 'running' || !['backward-aim', 'slide-aim'].includes(this.phase) || this.throwStart !== null) return;
    this.throwStart = typeof timeStamp === 'number' ? timeStamp : performance.now();
    this.notify();
  }

  releaseCharge(timeStamp = performance.now()) {
    if (this.throwStart === null) return;
    const elapsed = Math.max(0.12, (timeStamp - this.throwStart) / 1000);
    const power = clamp(elapsed / 1.15, 0.12, 1);
    this.throwStart = null;
    if (this.phase === 'backward-aim') this.throwBackward(power);
    else if (this.phase === 'slide-aim') this.throwSlide(power);
  }

  throwAction() {
    if (this.state !== 'running') return;
    this.throwStart = null;
    if (this.phase === 'backward-aim') this.throwBackward(0.72);
    else if (this.phase === 'slide-aim') this.throwSlide(0.72);
  }

  resetSlipper() {
    if (!this.slipper) return;
    this.scene.remove(this.slipper);
    this.slipper.traverse((object) => {
      object.geometry?.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material?.dispose();
    });
    this.slipper = null;
  }

  start() {
    this.resetSlipper();
    this.state = 'running';
    this.phase = 'backward-aim';
    this.turn = 1;
    this.score = 0;
    this.removed = 0;
    this.aim = 1;
    this.marker.visible = false;
    this.playerZ = 2.7;
    this.playerX = 0;
    this.character.position.set(this.playerX, 0.55, this.playerZ);
    this.bands.forEach((band) => { band.removed = false; band.mesh.visible = true; });
    this.lastFrame = performance.now();
    this.notify();
  }

  pause() { if (this.state === 'running') { this.state = 'paused'; this.throwStart = null; this.notify(); } }
  resume() { if (this.state === 'paused') { this.state = 'running'; this.lastFrame = performance.now(); this.notify(); } }

  throwBackward(power) {
    this.phase = 'backward-flight';
    this.slipper = createSlipper();
    this.slipper.position.set(this.character.position.x, 0.16, this.character.position.z - 0.65);
    this.scene.add(this.slipper);
    this.slipperVelocity = { x: (this.aim - 1) * (0.45 + power * 0.65), y: 2.5 + power * 2.1, z: 2.7 + power * 2.2 };
    this.flightElapsed = 0;
    this.notify();
  }

  throwSlide(power) {
    this.phase = 'sliding';
    this.slidePower = power;
    this.slideSpeed = 7 + power * 7.1;
    this.slidePrevZ = this.slipper.position.z;
    this.slipper.position.x = LANES[this.aim];
    this.slipper.rotation.x = -Math.PI / 2;
    this.slipperVelocity = { x: 0, y: 0, z: -this.slideSpeed };
    this.marker.visible = false;
    this.notify();
  }

  landBackwardThrow() {
    this.slipper.position.y = 0.04;
    this.slipperVelocity = { x: 0, y: 0, z: 0 };
    this.phase = 'slide-aim';
    this.aim = 1;
    this.playerZ = this.slipper.position.z + 0.62;
    this.playerX = this.slipper.position.x;
    this.character.position.set(this.playerX, 0.55, this.playerZ);
    this.marker.position.set(this.slipper.position.x, 0.035, this.slipper.position.z);
    this.marker.visible = true;
    this.notify();
  }

  finishSlide() {
    this.phase = 'turn-end';
    if (this.removed === this.bands.length) {
      this.state = 'won';
      this.notify();
      return;
    }
    if (this.turn >= this.maxTurns) {
      this.state = 'over';
      this.notify();
      return;
    }
    this.turn += 1;
    this.resetSlipper();
    this.character.position.set(0, 0.55, 2.7);
    this.playerZ = 2.7;
    this.playerX = 0;
    this.aim = 1;
    this.phase = 'backward-aim';
    this.notify();
  }

  update(dt) {
    this.elapsed += dt;
    if (this.state === 'running' && this.throwStart !== null) this.notify();
    if (this.state === 'running' && this.phase === 'backward-flight') {
      this.flightElapsed += dt;
      this.slipper.position.x += this.slipperVelocity.x * dt;
      this.slipper.position.z += this.slipperVelocity.z * dt;
      this.slipperVelocity.y -= 9.8 * dt;
      this.slipper.position.y += this.slipperVelocity.y * dt;
      this.slipper.rotation.z += dt * 5;
      if (this.slipper.position.y <= 0.13 && this.flightElapsed > 0.25) this.landBackwardThrow();
    } else if (this.state === 'running' && this.phase === 'sliding') {
      this.slidePrevZ = this.slipper.position.z;
      this.slipper.position.z += this.slipperVelocity.z * dt;
      this.slideSpeed = Math.max(0, this.slideSpeed - 4.1 * dt);
      this.slipperVelocity.z = -this.slideSpeed;
      this.slipper.rotation.z = Math.sin(this.elapsed * 28) * 0.035;
      for (const band of this.bands) {
        if (band.removed) continue;
        const crossed = this.slidePrevZ >= band.z - 0.3 && this.slipper.position.z <= band.z + 0.3;
        if (crossed && Math.abs(this.slipper.position.x - band.x) <= 0.54) {
          band.removed = true;
          band.mesh.visible = false;
          band.mesh.geometry.dispose();
          band.mesh.material.dispose();
          this.removed += 1;
          this.score += 100;
          this.notify();
        }
      }
      if (this.slideSpeed <= 0 || this.slipper.position.z < -6) this.finishSlide();
    }
    animatePlayerCharacter(this.character, this.elapsed, this.state === 'running' && this.phase.includes('flight'));
    this.playerShadow.position.x = this.character.position.x;
    this.playerShadow.position.z = this.character.position.z;
    if (this.slipper && this.phase === 'sliding') this.slipper.position.y = 0.04;
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.character.position.x * 0.12, 2.8, dt);
    this.camera.lookAt(0, 0.8, 0);
  }

  notify() {
    const names = { 'backward-aim': 'Back throw', 'backward-flight': 'Throw airborne', 'slide-aim': 'Aim ground slide', sliding: 'Slipper sliding', 'turn-end': 'Turn complete' };
    const label = this.state === 'won' ? 'All bands cleared' : this.state === 'over' ? 'Turns used' : `${names[this.phase]} · turn ${this.turn}/${this.maxTurns}`;
    const phaseText = this.phase === 'backward-aim'
      ? 'HOLD ↓ / SPACE · RELEASE TO THROW BACK'
      : this.phase === 'slide-aim'
        ? '← / → TO AIM · HOLD ↑ / SPACE · RELEASE TO SLIDE'
        : this.phase === 'backward-flight'
          ? 'SLIPPER AIRBORNE · LANDING SETS THROWING MARK'
          : this.phase === 'sliding'
            ? 'SLIDE THE SLIPPER THROUGH THE RUBBER BANDS'
            : '';
    this.onChange({ state: this.state, score: this.score, coins: this.removed, best: 0, lives: this.maxTurns - this.turn + 1, turn: this.turn, maxTurns: this.maxTurns, type: 'salubata', phase: this.phase, phaseLabel: label, phaseText, resultTitle: this.state === 'won' ? 'Street champion.' : 'One more round next time.', resultBody: `${this.removed} bands cleared · ${this.score} points · ${this.turn}/${this.maxTurns} turns`, resultAction: 'Play another round' });
  }

  frame(now) {
    if (this.disposed) return;
    const dt = Math.min(0.04, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
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

import * as THREE from 'three';

const material = (color, roughness = 0.82, emissive = null, intensity = 0) => new THREE.MeshStandardMaterial({
  color,
  roughness,
  ...(emissive ? { emissive, emissiveIntensity: intensity } : {}),
});

/** Low-poly roadside market props shared by every game world. */
export function addMarketStall(scene, { x, y = 0, z, scale = 1, sign = 'LAGOS', accent = '#e98b4f' }) {
  const stall = new THREE.Group();
  stall.position.set(x, y, z);
  stall.scale.setScalar(scale);

  const wood = material('#5c3a30');
  const darkWood = material('#2e1f1c');
  const canvas = material(accent, 0.75, accent, 0.18);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 0.72), wood);
  counter.position.y = 0.47;
  counter.castShadow = true;
  stall.add(counter);
  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.12, 0.82), material('#d49a61'));
  counterTop.position.y = 0.84;
  stall.add(counterTop);

  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.9, 0.09), darkWood);
    post.position.set(side * 0.91, 1.16, -0.22);
    stall.add(post);
  }
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.16, 1.12), canvas);
  canopy.position.set(0, 2.08, -0.12);
  canopy.rotation.z = x < 0 ? -0.025 : 0.025;
  canopy.castShadow = true;
  stall.add(canopy);
  const valance = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.22, 0.1), material('#f2c36d'));
  valance.position.set(0, 1.88, 0.39);
  stall.add(valance);

  // Crates and vivid produce make the stalls read as street vendors at a glance.
  const fruitColors = ['#f1b640', '#cf5844', '#57b779', '#ef8050', '#f4d35e'];
  for (let index = 0; index < 7; index += 1) {
    const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.115, 9, 7), material(fruitColors[index % fruitColors.length], 0.43));
    fruit.position.set(-0.72 + (index % 4) * 0.32, 1.02 + Math.floor(index / 4) * 0.14, 0.05 + (index % 2) * 0.2);
    fruit.scale.y = 0.86;
    stall.add(fruit);
  }

  const board = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.34, 0.08), material('#0b3d2c', 0.52, '#00d98a', 0.45));
  board.position.set(0, 1.62, 0.41);
  stall.add(board);
  const label = makeLabel(sign, '#f6d49b');
  label.position.set(0, 1.62, 0.46);
  label.scale.set(1.02, 0.2, 1);
  stall.add(label);

  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffc36f' }));
  lamp.position.set(0, 1.8, 0.25);
  stall.add(lamp);
  const glow = new THREE.PointLight('#ff9b4e', 9, 5, 2);
  glow.position.set(0, 1.82, 0.25);
  stall.add(glow);

  scene.add(stall);
  return stall;
}

export function addStringLights(scene, { start = [-5, 4.1, -3], end = [5, 4.1, -9], count = 13 } = {}) {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const points = [];
  for (let index = 0; index <= 12; index += 1) {
    const t = index / 12;
    points.push(from.clone().lerp(to, t).add(new THREE.Vector3(0, -Math.sin(t * Math.PI) * 0.7, 0)));
  }
  const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.018, 5, false), material('#4a3428'));
  scene.add(wire);
  for (let index = 0; index < count; index += 1) {
    const t = (index + 0.5) / count;
    const point = from.clone().lerp(to, t).add(new THREE.Vector3(0, -Math.sin(t * Math.PI) * 0.7 - 0.09, 0));
    const color = index % 3 === 1 ? '#2ee08a' : index % 3 === 2 ? '#f5cf72' : '#ff9a51';
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 9, 7), new THREE.MeshBasicMaterial({ color }));
    bulb.position.copy(point);
    scene.add(bulb);
    const glow = new THREE.PointLight(color, 3.5, 3.2, 2);
    glow.position.copy(point);
    scene.add(glow);
  }
}

export function makeLabel(text, color = '#f4d49a') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = '800 58px Manrope, Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.shadowColor = '#ff9a51';
  context.shadowBlur = 16;
  context.fillStyle = color;
  context.fillText(text, 256, 66, 480);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.userData.disposeTexture = texture;
  return sprite;
}

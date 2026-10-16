import * as THREE from 'three';

/**
 * Time-of-day lighting for the arcade. One shared sky, sun, fog and hemisphere
 * setup drives all three games, so switching the time of day keeps the Lagos
 * market consistent between them.
 */
export const LIGHT_PRESETS = {
  daylight: {
    id: 'daylight',
    label: 'Daylight',
    hint: 'Bright afternoon sun',
    sky: ['#2f7fd0', '#6fb3e8', '#bfe0f5', '#ffeccb', '#fff6e4'],
    fog: '#cfe4f2',
    fogNear: 26,
    fogFar: 78,
    hemiSky: '#e6f5ff',
    hemiGround: '#c9a273',
    hemiIntensity: 2.5,
    sun: '#fff7e4',
    sunIntensity: 3.1,
    sunPosition: [-6, 18, 8],
    glow: '#fff3cf',
    glowOpacity: 0.5,
    glowY: 16,
    ground: '#8a6a4a',
  },
  evening: {
    id: 'evening',
    label: 'Evening',
    hint: 'Lagos dusk, sun on the horizon',
    sky: ['#2b1b4d', '#5c2a55', '#a8474f', '#e8823a', '#ffc247'],
    fog: '#6b3352',
    fogNear: 22,
    fogFar: 64,
    hemiSky: '#ffd9b0',
    hemiGround: '#4a2a26',
    hemiIntensity: 2.15,
    sun: '#ffcf94',
    sunIntensity: 2.6,
    sunPosition: [-5, 10, 7],
    glow: '#ffe9a8',
    glowOpacity: 0.32,
    glowY: 7,
    ground: '#4a2a26',
  },
  night: {
    id: 'night',
    label: 'Night',
    hint: 'After dark, market lights only',
    sky: ['#080b1c', '#141a36', '#232b4e', '#333d63', '#4a5478'],
    fog: '#151b33',
    fogNear: 20,
    fogFar: 58,
    hemiSky: '#8ba3dd',
    hemiGround: '#1c1428',
    hemiIntensity: 1.35,
    sun: '#b9cdf5',
    sunIntensity: 1.5,
    sunPosition: [-6, 12, 6],
    glow: '#cfe0ff',
    glowOpacity: 0.14,
    glowY: 11,
    ground: '#1c1428',
  },
};

export const DEFAULT_LIGHTING = 'evening';
const ORDER = ['daylight', 'evening', 'night'];

export function lightPresets() {
  return ORDER.map((id) => ({ id, label: LIGHT_PRESETS[id].label, hint: LIGHT_PRESETS[id].hint }));
}

export function readLighting() {
  try {
    const saved = localStorage.getItem('arcade:lighting');
    if (saved && ORDER.includes(saved)) return saved;
  } catch { /* storage may be unavailable */ }
  return DEFAULT_LIGHTING;
}

export function writeLighting(id) {
  if (!ORDER.includes(id)) return;
  try { localStorage.setItem('arcade:lighting', id); } catch { /* storage may be unavailable */ }
}

function skyTexture(preset) {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  const stops = preset.sky;
  stops.forEach((color, i) => gradient.addColorStop(i / (stops.length - 1), color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
}

/**
 * Installs sky, sun, fog and hemisphere lighting for a preset, and returns a
 * handle so the same preset can be swapped in later without rebuilding the scene.
 */
export function applyLighting(scene, id = DEFAULT_LIGHTING) {
  const preset = LIGHT_PRESETS[id] || LIGHT_PRESETS[DEFAULT_LIGHTING];

  scene.background?.dispose?.();
  scene.background = skyTexture(preset);

  const isExp = scene.fog && scene.fog.isFogExp2;
  if (isExp) scene.fog.color.set(preset.fog);
  else if (scene.fog) scene.fog.color.set(preset.fog);
  else scene.fog = new THREE.Fog(preset.fog, preset.fogNear, preset.fogFar);
  if (scene.fog && !isExp) {
    scene.fog.near = preset.fogNear;
    scene.fog.far = preset.fogFar;
  }

  let hemi = scene.getObjectByName('sky-hemi');
  if (!hemi) {
    hemi = new THREE.HemisphereLight(preset.hemiSky, preset.hemiGround, preset.hemiIntensity);
    hemi.name = 'sky-hemi';
    scene.add(hemi);
  }
  hemi.color.set(preset.hemiSky);
  hemi.groundColor.set(preset.hemiGround);
  hemi.intensity = preset.hemiIntensity;

  let sun = scene.getObjectByName('sky-sun');
  if (!sun) {
    sun = new THREE.DirectionalLight(preset.sun, preset.sunIntensity);
    sun.name = 'sky-sun';
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);
    scene.add(sun.target);
  }
  sun.color.set(preset.sun);
  sun.intensity = preset.sunIntensity;
  sun.position.set(...preset.sunPosition);

  let glow = scene.getObjectByName('sky-glow');
  if (!glow) {
    glow = new THREE.Mesh(
      new THREE.CircleGeometry(9, 32),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false }),
    );
    glow.name = 'sky-glow';
    glow.position.set(0, preset.glowY, -40);
    glow.renderOrder = -1;
    scene.add(glow);
  }
  glow.material.color.set(preset.glow);
  glow.material.opacity = preset.glowOpacity;
  glow.position.y = preset.glowY;

  return preset;
}
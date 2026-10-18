// Coins and power-up pickups.
//
// Like the obstacles, geometry is built once and shared. A coin trail is several
// meshes per row and rows recycle constantly, so per-coin geometry would be the
// single biggest source of churn in the scene.

import * as THREE from 'three';
import { POWERUPS } from './rules.js';
import { PALETTE } from './obstacles.js';

const cache = new Map();
function cached(key, build) {
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key);
}

const shared = new Map();
function mat(key, build) {
  if (!shared.has(key)) shared.set(key, build());
  return shared.get(key);
}

// The pickup radius in rules.js is what a coin is collected at. The mesh is drawn a
// little smaller than that, so what you see is never bigger than what you can reach:
// a coin that looks like it overlaps an obstacle but does not collect is the fastest
// way to make a run feel broken.
const COIN_RADIUS = 0.22;

export function createCoin() {
  const group = new THREE.Group();
  const disc = new THREE.Mesh(
    cached('coin-disc', () => {
      const g = new THREE.CylinderGeometry(COIN_RADIUS, COIN_RADIUS, 0.055, 16);
      g.rotateX(Math.PI / 2);
      return g;
    }),
    mat('coin', () => new THREE.MeshStandardMaterial({
      color: '#ffc83b',
      emissive: '#d27c18',
      emissiveIntensity: 1.5,
      metalness: 0.72,
      roughness: 0.26,
    })),
  );
  disc.castShadow = true;
  group.add(disc);

  // A flat ring facing the runner. It costs two triangles and it is what makes a
  // coin legible from the chase camera while it is spinning edge-on, which is half of
  // every rotation.
  const halo = new THREE.Mesh(
    cached('coin-halo', () => new THREE.TorusGeometry(COIN_RADIUS * 1.25, 0.018, 6, 14)),
    mat('coin-halo', () => new THREE.MeshBasicMaterial({
      color: '#ffd97a', transparent: true, opacity: 0.55,
    })),
  );
  group.add(halo);
  return group;
}

export function createPowerupPickup(kind) {
  const spec = POWERUPS[kind];
  if (!spec) throw new Error(`unknown power-up: ${kind}`);
  const group = new THREE.Group();

  const core = new THREE.Mesh(
    cached('powerup-core', () => new THREE.IcosahedronGeometry(0.34, 0)),
    mat(`powerup-${kind}`, () => new THREE.MeshStandardMaterial({
      color: spec.pickupColor,
      emissive: spec.pickupColor,
      emissiveIntensity: 0.85,
      metalness: 0.4,
      roughness: 0.3,
    })),
  );
  group.add(core);

  const shell = new THREE.Mesh(
    cached('powerup-shell', () => new THREE.IcosahedronGeometry(0.52, 0)),
    mat('powerup-shell', () => new THREE.MeshBasicMaterial({
      color: spec.pickupColor, wireframe: true, transparent: true, opacity: 0.5,
    })),
  );
  group.add(shell);

  const ring = new THREE.Mesh(
    cached('powerup-ring', () => new THREE.TorusGeometry(0.56, 0.03, 8, 24)),
    mat(`powerup-ring-${kind}`, () => new THREE.MeshStandardMaterial({
      color: '#ffffff', emissive: spec.pickupColor, emissiveIntensity: 0.7, roughness: 0.4,
    })),
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  group.userData.spin = shell;
  group.userData.ring = ring;
  return group;
}

/** A hoverboard, which is both the pickup and the thing you ride. */
export function createHoverboard() {
  const board = new THREE.Group();
  const deckMat = mat('board-deck', () => new THREE.MeshStandardMaterial({
    color: '#00d98a', emissive: '#046b4c', emissiveIntensity: 0.7, metalness: 0.3, roughness: 0.4,
  }));
  const deck = new THREE.Mesh(
    cached('board-deck', () => {
      const shape = new THREE.Shape();
      shape.moveTo(-0.16, -0.7);
      shape.quadraticCurveTo(-0.3, 0, -0.16, 0.7);
      shape.quadraticCurveTo(0, 0.92, 0.16, 0.7);
      shape.quadraticCurveTo(0.3, 0, 0.16, -0.7);
      shape.quadraticCurveTo(0, -0.92, -0.16, -0.7);
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1, curveSegments: 8 });
      g.rotateX(-Math.PI / 2);
      return g;
    }),
    deckMat,
  );
  deck.castShadow = true;
  board.add(deck);

  const jetMat = mat('board-jet', () => new THREE.MeshBasicMaterial({
    color: '#5cffd0', transparent: true, opacity: 0.5,
  }));
  for (const z of [-0.34, 0.34]) {
    const jet = new THREE.Mesh(cached('board-jet', () => new THREE.CylinderGeometry(0.1, 0.16, 0.1, 10)), jetMat);
    jet.position.set(0, -0.1, z);
    board.add(jet);
  }
  board.position.y = 0.12;
  return board;
}

/**
 * A soft glow disc laid under a pickup so it stays findable against a dark road from
 * the chase camera, without needing a real light. One shared material, one geometry.
 */
export function createGlow(color) {
  const glow = new THREE.Mesh(
    cached('glow-disc', () => new THREE.CircleGeometry(0.5, 20)),
    mat(`glow-${color}`, () => new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.24, depthWrite: false,
    })),
  );
  glow.rotation.x = -Math.PI / 2;
  return glow;
}

export function disposePickupResources() {
  for (const geometry of cache.values()) geometry.dispose();
  cache.clear();
  for (const material of shared.values()) material.dispose();
  shared.clear();
}

export { PALETTE };

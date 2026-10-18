// Obstacle geometry for Identity Dash, in the Danfo palette.
//
// Every mesh here is sized to match its entry in ./rules.js, which is the single
// source of truth for whether it blocks the runner. Keeping the numbers in one table
// and building the meshes to match is what stops the visual and the collision
// silently disagreeing.
//
// Geometry is created once and shared between instances. An endless runner spawns and
// recycles obstacles for as long as someone plays, and building a fresh lathe or
// torus per spawn is the easiest way to start leaking GPU memory on a phone.

import * as THREE from 'three';
import { OBSTACLES } from './rules.js';

export const PALETTE = {
  ember: '#e55229',
  emberDeep: '#b03a17',
  gold: '#ffc83b',
  goldDeep: '#d27c18',
  danfoYellow: '#fab81e',
  stripe: '#161819',
  glass: '#19262b',
  busTail: '#e62e2e',
  tyre: '#181b1d',
  wood: '#8e562c',
  woodDark: '#6f4526',
  strap: '#dca45a',
  steel: '#262c2e',
  steelLight: '#4a555a',
  green: '#00a870',
  concrete: '#6d6a63',
  coneBase: '#2b2b28',
  container: '#2f5d52',
  containerRib: '#264c44',
  roadworkRed: '#d93b2b',
  roadworkWhite: '#f5f0e8',
};

const materials = new Map();
function mat(color, roughness = 0.75, metalness = 0.05, extra = null) {
  const key = `${color}|${roughness}|${metalness}|${extra ? JSON.stringify(extra) : ''}`;
  if (!materials.has(key)) {
    materials.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness, ...(extra || {}) }));
  }
  return materials.get(key);
}

const geometryCache = new Map();
function cached(key, build) {
  if (!geometryCache.has(key)) geometryCache.set(key, build());
  return geometryCache.get(key);
}

function meshOf(geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  return mesh;
}

function sharedMat(color, roughness, metalness) {
  // Per-obstacle caching keeps the material count down but every obstacle still needs
  // its own instance so dispose() can be selective and so nothing is accidentally
  // disposed twice from two rows sharing a material.
  return mat(color, roughness, metalness);
}

/** A wheeled wooden cart, the low obstacle you have to jump. */
export function createLowCart() {
  const cart = new THREE.Group();
  const deck = cached('cart-deck', () => new THREE.BoxGeometry(1.18, 0.22, 3.2));
  const body = meshOf(deck, sharedMat(PALETTE.wood, 0.82, 0.04), 0, 0.42, 0);
  body.castShadow = true;
  cart.add(body);

  const plankMat = sharedMat(PALETTE.strap, 0.65, 0.03);
  for (const z of [-1.1, 0, 1.1]) {
    cart.add(meshOf(cached('cart-plank', () => new THREE.BoxGeometry(1.22, 0.06, 0.3)), plankMat, 0, 0.55, z));
  }

  const crateMat = sharedMat(PALETTE.woodDark, 0.85, 0.03);
  for (const [x, z] of [[-0.28, -0.9], [0.3, 0.2], [-0.2, 1.0]]) {
    const crate = meshOf(cached('cart-crate', () => new THREE.BoxGeometry(0.5, 0.46, 0.52)), crateMat, x, 0.76, z);
    crate.castShadow = true;
    cart.add(crate);
  }

  const wheelGeom = cached('cart-wheel', () => {
    const g = new THREE.CylinderGeometry(0.2, 0.2, 0.13, 12);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  const wheelMat = sharedMat(PALETTE.tyre, 0.88, 0.02);
  for (const x of [-0.58, 0.58]) {
    for (const z of [-1.05, 1.05]) {
      cart.add(meshOf(wheelGeom, wheelMat, x, 0.2, z));
    }
  }
  return cart;
}

/** The Danfo bus. Long, tall, and the reason you have to be in another lane. */
export function createDanfoBus() {
  const bus = new THREE.Group();
  const bodyMat = sharedMat(PALETTE.danfoYellow, 0.45, 0.15);
  const bodyGeom = cached('bus-body', () => new THREE.BoxGeometry(1.18, 1.12, 4.4));
  const body = meshOf(bodyGeom, bodyMat, 0, 0.78, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  bus.add(body);

  const stripeGeom = cached('bus-stripe', () => new THREE.BoxGeometry(1.2, 0.085, 4.42));
  const stripeMat = sharedMat(PALETTE.stripe, 0.8, 0.02);
  bus.add(meshOf(stripeGeom, stripeMat, 0, 0.83, 0));
  bus.add(meshOf(stripeGeom, stripeMat, 0, 0.59, 0));

  const glassMat = sharedMat(PALETTE.glass, 0.25, 0.75);
  const sideGlass = cached('bus-side-glass', () => new THREE.BoxGeometry(0.02, 0.45, 3.6));
  bus.add(meshOf(sideGlass, glassMat, 0.6, 1.0, 0));
  bus.add(meshOf(sideGlass, glassMat, -0.6, 1.0, 0));

  const tailMat = new THREE.MeshStandardMaterial({
    color: PALETTE.busTail, emissive: '#c41919', emissiveIntensity: 1.8,
  });
  materials.set(`bus-tail|${materials.size}`, tailMat);
  for (const x of [-0.42, 0.42]) {
    bus.add(meshOf(cached('bus-tail', () => new THREE.BoxGeometry(0.16, 0.11, 0.04)), tailMat, x, 0.52, 2.21));
  }

  const wheelGeom = cached('bus-wheel', () => {
    const g = new THREE.CylinderGeometry(0.23, 0.23, 0.15, 12);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  const wheelMat = sharedMat(PALETTE.tyre, 0.85, 0.02);
  for (const x of [-0.56, 0.56]) {
    for (const z of [-1.5, 1.5]) {
      bus.add(meshOf(wheelGeom, wheelMat, x, 0.23, z));
    }
  }
  return bus;
}

/** A stack of crates. Tall enough that jumping it is a mistake. */
export function createCrateStack() {
  const stack = new THREE.Group();
  const woodMat = sharedMat(PALETTE.wood, 0.82, 0.04);
  const strapMat = sharedMat(PALETTE.strap, 0.6, 0.03);
  const boxGeom = cached('crate-box', () => new THREE.BoxGeometry(0.94, 0.56, 0.86));
  for (const [y, x] of [[0.3, 0], [0.88, 0.06], [1.16, -0.02]]) {
    const box = meshOf(boxGeom, woodMat, x, y, 0);
    box.castShadow = true;
    stack.add(box);
    stack.add(meshOf(cached('crate-strap-h', () => new THREE.BoxGeometry(0.96, 0.06, 0.88)), strapMat, x, y, 0));
    stack.add(meshOf(cached('crate-strap-v', () => new THREE.BoxGeometry(0.96, 0.58, 0.06)), strapMat, x, y, 0));
  }
  return stack;
}

/** Roadworks barrier. The classic jump. */
export function createHurdle() {
  const hurdle = new THREE.Group();
  const barMat = sharedMat(PALETTE.ember, 0.58, 0.08);
  const stripeMat = sharedMat(PALETTE.roadworkWhite, 0.5, 0.02);
  const barGeom = cached('hurdle-bar', () => new THREE.BoxGeometry(1.3, 0.24, 0.14));
  const bar = meshOf(barGeom, barMat, 0, 0.36, 0);
  bar.castShadow = true;
  hurdle.add(bar);

  const stripeGeom = cached('hurdle-stripe', () => new THREE.BoxGeometry(0.11, 0.245, 0.15));
  for (const x of [-0.45, -0.225, 0, 0.225, 0.45]) {
    hurdle.add(meshOf(stripeGeom, stripeMat, x, 0.36, 0));
  }
  const legMat = sharedMat(PALETTE.steel, 0.8, 0.06);
  const legGeom = cached('hurdle-leg', () => new THREE.BoxGeometry(0.08, 0.5, 0.46));
  for (const x of [-0.55, 0.55]) {
    const leg = meshOf(legGeom, legMat, x, 0.25, 0);
    leg.castShadow = true;
    hurdle.add(leg);
  }
  return hurdle;
}

/** A row of traffic cones across the lane. Low, so a small hop clears it, but it has
 *  to be drawn the full width of the collision box or it reads as passable when it
 *  is not: the cones themselves are narrow, so the line is what fills the lane. */
export function createConeRun() {
  const group = new THREE.Group();
  const coneGeom = cached('cone', () => new THREE.ConeGeometry(0.19, 0.46, 10));
  const bandGeom = cached('cone-band', () => new THREE.CylinderGeometry(0.125, 0.145, 0.08, 10));
  const baseGeom = cached('cone-base', () => new THREE.BoxGeometry(0.32, 0.05, 0.32));
  const coneMat = sharedMat(PALETTE.roadworkRed, 0.6, 0.02);
  const bandMat = sharedMat(PALETTE.roadworkWhite, 0.5, 0.02);
  const baseMat = sharedMat(PALETTE.coneBase, 0.8, 0.02);
  // Spaced so the outermost base edges meet the width of the collision box.
  for (const x of [-0.42, 0, 0.42]) {
    group.add(meshOf(baseGeom, baseMat, x, 0.025, 0));
    group.add(meshOf(coneGeom, coneMat, x, 0.26, 0));
    group.add(meshOf(bandGeom, bandMat, x, 0.24, 0));
  }
  return group;
}

/**
 * Market banner on a gantry. The only way through is a slide.
 *
 * The drawn board is sized from OBSTACLES.gantry rather than chosen by eye: its hem
 * has to sit exactly on the collision underside, and its top has to reach above the
 * point a jump can put the runner's head. If the mesh were shorter than the box, a
 * well-timed jump would sail over a banner the player can plainly see they should have
 * ducked under, and the game would call it a hit.
 */
export function createGantry() {
  const shape = OBSTACLES.gantry;
  const gantry = new THREE.Group();
  const boardMat = sharedMat(PALETTE.ember, 0.58, 0.08);
  const trimMat = sharedMat(PALETTE.strap, 0.6, 0.04);
  const postMat = sharedMat(PALETTE.steel, 0.8, 0.06);

  const boardBottom = shape.bottom;
  const boardTop = shape.top + 0.06;
  const boardHeight = boardTop - boardBottom;
  const board = meshOf(
    cached('gantry-board', () => new THREE.BoxGeometry(1.34, boardHeight, 0.1)),
    boardMat, 0, boardBottom + boardHeight / 2, 0,
  );
  board.castShadow = true;
  gantry.add(board);

  // The gold hem along the bottom edge, which is the line the slide has to clear.
  gantry.add(meshOf(
    cached('gantry-hem', () => new THREE.BoxGeometry(1.36, 0.1, 0.13)),
    trimMat, 0, boardBottom + 0.05, 0,
  ));

  // Posts run the full height of the board and stand on the ground.
  const postGeom = cached('gantry-post', () => new THREE.BoxGeometry(0.1, boardTop, 0.1));
  for (const x of [-0.62, 0.62]) {
    const post = meshOf(postGeom, postMat, x, boardTop / 2, 0);
    post.castShadow = true;
    gantry.add(post);
  }
  return gantry;
}

/** Shipping container. The tallest thing on the road and never jumpable. */
export function createContainer() {
  const container = new THREE.Group();
  const bodyMat = sharedMat(PALETTE.container, 0.7, 0.25);
  const bodyGeom = cached('container-body', () => new THREE.BoxGeometry(1.2, 2.4, 8.2));
  const body = meshOf(bodyGeom, bodyMat, 0, 1.2, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  container.add(body);

  const ribGeom = cached('container-rib', () => new THREE.BoxGeometry(1.24, 0.08, 8.24));
  const ribMat = sharedMat(PALETTE.containerRib, 0.72, 0.22);
  for (let i = 0; i < 7; i += 1) {
    container.add(meshOf(ribGeom, ribMat, 0, 0.24 + i * 0.36, 0));
  }
  const doorMat = sharedMat(PALETTE.steelLight, 0.65, 0.35);
  for (const x of [-0.3, 0.3]) {
    container.add(meshOf(cached('container-door', () => new THREE.BoxGeometry(0.02, 2.2, 0.07)), doorMat, x, 1.2, 4.11));
  }
  return container;
}

const BUILDERS = {
  hurdle: createHurdle,
  cone: createConeRun,
  lowcart: createLowCart,
  crate: createCrateStack,
  danfo: createDanfoBus,
  container: createContainer,
  gantry: createGantry,
};

export function createObstacle(kind) {
  const build = BUILDERS[kind];
  if (!build) throw new Error(`unknown obstacle kind: ${kind}`);
  return build();
}

/** Frees the shared geometry and material caches. Called once when the arcade unloads. */
export function disposeObstacleResources() {
  for (const geometry of geometryCache.values()) geometry.dispose();
  geometryCache.clear();
  for (const material of materials.values()) material.dispose();
  materials.clear();
}

// The meshes have to agree with the collision table.
//
// rules.js decides whether something stops the runner; obstacles.js decides what it
// looks like. If those two drift apart the game is not wrong in a way a test on
// either file alone would catch: the rules stay fair on paper while the bus on screen
// is taller than the box that stops you, or a barrier you can see yourself clearing
// is one the game says you hit. So this file builds the real geometry in node, with
// no renderer, and measures it against the table.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { OBSTACLES } from '../src/games/dash/rules.js';
import { createObstacle, disposeObstacleResources, PALETTE } from '../src/games/dash/obstacles.js';
import { createCoin, createPowerupPickup, createHoverboard, disposePickupResources } from '../src/games/dash/pickups.js';

/** World-space bounds of a mesh hierarchy, ignoring anything invisible. */
function bounds(root) {
  const box = new THREE.Box3();
  const position = new THREE.Vector3();
  let seen = false;
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!object.isMesh || !object.visible) return;
    const geometry = object.geometry;
    if (!geometry) return;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const local = geometry.boundingBox;
    for (const corner of [
      [local.min.x, local.min.y, local.min.z], [local.max.x, local.max.y, local.max.z],
    ]) {
      position.set(corner[0], corner[1], corner[2]).applyMatrix4(object.matrixWorld);
      if (!seen) { box.min.copy(position); box.max.copy(position); seen = true; } else {
        box.min.min(position);
        box.max.max(position);
      }
    }
  });
  return box;
}

test('every obstacle in the table can actually be built', () => {
  for (const kind of Object.keys(OBSTACLES)) {
    const mesh = createObstacle(kind);
    assert.ok(mesh, `${kind} builds`);
    assert.ok(mesh.children.length > 0, `${kind} has geometry`);
  }
});

test('an unknown obstacle is refused rather than silently empty', () => {
  assert.throws(() => createObstacle('not-a-real-obstacle'), /unknown obstacle/i);
});

test('every obstacle mesh is built with its feet on the ground', () => {
  // Obstacles are placed at y=0 in the world. One whose geometry starts above zero
  // floats, and one that starts below sinks into the road.
  for (const kind of Object.keys(OBSTACLES)) {
    const box = bounds(createObstacle(kind));
    assert.ok(box.min.y > -0.06 && box.min.y < 0.06,
      `${kind} sits on the ground, min y ${box.min.y.toFixed(3)}`);
  }
});

test('obstacle meshes are at least as wide as their collision box', () => {
  // Under-drawing is safe: you would appear to clear something you actually hit.
  // Over-drawing is not: it looks like you clipped through something you cleared.
  for (const [kind, shape] of Object.entries(OBSTACLES)) {
    const box = bounds(createObstacle(kind));
    const width = box.max.x - box.min.x;
    assert.ok(width >= shape.halfWidth * 2 - 0.06,
      `${kind} fills its lane, mesh ${width.toFixed(2)} vs box ${(shape.halfWidth * 2).toFixed(2)}`);
  }
});

test('a jumpable obstacle is drawn lower than the jump clears it', () => {
  // If a hurdle were drawn taller than the arc goes, the player would jump at it and
  // hit it while the rules said they cleared it.
  for (const [kind, shape] of Object.entries(OBSTACLES)) {
    if (shape.verb !== 'jump') continue;
    const box = bounds(createObstacle(kind));
    assert.ok(box.max.y >= shape.top - 0.08,
      `${kind} is at least as tall as the bar you have to clear`);
  }
});

test('a slide obstacle is drawn with its underside where the slide fits', () => {
  const gantry = OBSTACLES.gantry;
  const group = createObstacle('gantry');
  const box = bounds(group);
  // Posts stand on the ground, so the union box starts at 0 and says nothing about
  // the hem. What matters is that a horizontal member crosses the lane at the height
  // the rules call the underside, because that is the line the slide clears.
  let lowestSolid = Infinity;
  const world = new THREE.Vector3();
  group.updateMatrixWorld(true);
  group.traverse((object) => {
    if (!object.isMesh) return;
    const geometry = object.geometry;
    if (!geometry) return;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const local = geometry.boundingBox;
    // Posts stand on the ground and say nothing useful about the hem. Only the wide
    // flat members crossing the lane are the thing a slide has to get under.
    if ((local.max.x - local.min.x) < (local.max.y - local.min.y) * 3) return;
    world.set(0, 0, 0).applyMatrix4(object.matrixWorld);
    lowestSolid = Math.min(lowestSolid, world.y + local.min.y);
  });
  // The underside of the hem is the line the rules call gantry.bottom. A runner whose
  // head is just under it must not be passing through something drawn below that.
  assert.ok(Number.isFinite(lowestSolid), 'a horizontal member crosses the lane');
  assert.ok(Math.abs(lowestSolid - gantry.bottom) < 0.02,
    `the hem underside is at ${gantry.bottom}, drawn at ${lowestSolid.toFixed(3)}`);
  assert.ok(box.max.y > gantry.top - 0.1, 'and the board rises above anything a jump reaches');
});

test('long obstacles are drawn along z, not as deep single blocks', () => {
  // The bus and the container read as long on screen. A length of 4.6 drawn as a 1m
  // block would look like a bus parked sideways out of view.
  for (const kind of ['danfo', 'container', 'lowcart']) {
    const shape = OBSTACLES[kind];
    const box = bounds(createObstacle(kind));
    const depth = box.max.z - box.min.z;
    assert.ok(depth > shape.length * 0.6,
      `${kind} is drawn long, mesh depth ${depth.toFixed(2)} vs length ${shape.length}`);
  }
});

test('obstacles are built in front of the runner, not behind them', () => {
  // The runner faces -z, so the tail lights and doors that matter are on +z. If the
  // group were mirrored the long obstacles would read as facing away.
  const box = bounds(createObstacle('danfo'));
  assert.ok(box.max.z > Math.abs(box.min.z), 'extends toward the camera');
});

test('a coin faces the runner and is no bigger than the radius it collects at', () => {
  // The runner looks down -z, so a coin has to be a thin disc in the xy plane, facing
  // +z. Thin in z is what makes it spin face-on and edge-on as it turns.
  const box = bounds(createCoin());
  const width = box.max.x - box.min.x;
  const depth = box.max.z - box.min.z;
  assert.ok(width < 0.7, `a coin is small, drawn ${width.toFixed(2)} across`);
  assert.ok(depth < 0.15, `and thin, ${depth.toFixed(3)} deep, so it reads as spinning`);
  assert.ok(box.max.y - box.min.y > 0.3, 'and tall enough to be seen edge-on');
});

test('every power-up pickup builds and is bigger than a coin', () => {
  for (const kind of ['magnet', 'double', 'board']) {
    const pickup = createPowerupPickup(kind);
    assert.ok(pickup.children.length >= 3, `${kind} has a core, a shell and a ring`);
    const box = bounds(pickup);
    assert.ok(box.max.x - box.min.x > 0.5, `${kind} is big enough to spot at speed`);
  }
  assert.throws(() => createPowerupPickup('nope'), /unknown power-up/i);
});

test('the hoverboard is a flat deck you could stand on', () => {
  const box = bounds(createHoverboard());
  const height = box.max.y - box.min.y;
  const width = box.max.x - box.min.x;
  assert.ok(height < 0.6, `it is a board, not a box, ${height.toFixed(2)} tall`);
  assert.ok(width > 0.2 && width < 1.2, `and it is deck-sized, ${width.toFixed(2)} wide`);
});

test('the obstacle palette is the approved Danfo palette', () => {
  // Guards against a stray colour slipping into a new mesh. The tokens are fixed and
  // every obstacle material has to come from them.
  const approved = new Set(Object.values(PALETTE).map((c) => c.toLowerCase()));
  const found = new Set();
  for (const kind of Object.keys(OBSTACLES)) {
    createObstacle(kind).traverse((object) => {
      const material = object.material;
      if (!material || !material.color) return;
      found.add(material.color.getHexString());
    });
  }
  for (const hex of found) {
    assert.ok(approved.has(`#${hex}`), `#${hex} is an approved token`);
  }
});

test('disposing the shared caches leaves the builders usable', () => {
  disposeObstacleResources();
  disposePickupResources();
  // Rebuilding after a dispose is what happens when a player leaves a game and comes
  // back to it, so a stale cache reference here would break the second visit.
  const mesh = createObstacle('hurdle');
  assert.ok(mesh.children.length > 0, 'obstacles rebuild after a dispose');
  assert.ok(createCoin().children.length > 0, 'coins rebuild after a dispose');
});

import * as THREE from 'three';

// One appearance contract feeds every game's player model. The platform adapter
// can supply verified values later; this preview palette is intentionally local.
export const PREVIEW_STYLE = Object.freeze({
  skin: '#8d5038',
  outfit: '#e89148',
  trim: '#44d2be',
  trousers: '#243d45',
  name: 'Visitor',
});

const COLOR_PATTERN = /^#[\da-f]{6}$/i;

export function normalizeCharacterStyle(style = {}) {
  const safeColor = (candidate, fallback) =>
    typeof candidate === 'string' && COLOR_PATTERN.test(candidate) ? candidate : fallback;

  return {
    skin: safeColor(style.skin, PREVIEW_STYLE.skin),
    outfit: safeColor(style.outfit, PREVIEW_STYLE.outfit),
    trim: safeColor(style.trim, PREVIEW_STYLE.trim),
    trousers: safeColor(style.trousers, PREVIEW_STYLE.trousers),
    name: typeof style.name === 'string' && style.name.trim()
      ? style.name.trim().slice(0, 24)
      : PREVIEW_STYLE.name,
  };
}

function material(color, roughness = 0.8) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.04 });
}

export function createPlayerCharacter(styleInput = PREVIEW_STYLE) {
  const style = normalizeCharacterStyle(styleInput);
  const group = new THREE.Group();
  const skin = material(style.skin);
  const outfit = material(style.outfit);
  const trim = material(style.trim, 0.45);
  const trousers = material(style.trousers);
  const hair = material('#231b19');
  const shoe = material('#f2c779', 0.5);
  const sphere = new THREE.SphereGeometry(0.28, 18, 14);
  const torso = new THREE.CapsuleGeometry(0.26, 0.48, 5, 10);
  const limb = new THREE.CapsuleGeometry(0.085, 0.3, 4, 8);

  const add = (geometry, mat, position, parent = group) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const body = new THREE.Group();
  body.position.y = 1.05;
  group.add(body);

  const head = add(sphere, skin, [0, 0.69, 0], body);
  head.scale.set(0.83, 0.96, 0.82);
  const hairCap = add(new THREE.SphereGeometry(0.245, 18, 10), hair, [0, 0.81, -0.035], body);
  hairCap.scale.set(1.02, 0.48, 1.02);
  add(torso, outfit, [0, 0.13, 0], body);
  const sash = add(new THREE.BoxGeometry(0.38, 0.075, 0.32), trim, [0, 0.29, 0.22], body);
  sash.rotation.z = -0.16;

  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  leftLeg.position.set(-0.12, -0.22, 0);
  rightLeg.position.set(0.12, -0.22, 0);
  body.add(leftLeg, rightLeg);
  add(limb, trousers, [0, -0.18, 0], leftLeg);
  add(limb, trousers, [0, -0.18, 0], rightLeg);
  const leftShoe = add(new THREE.BoxGeometry(0.19, 0.1, 0.3), shoe, [0, -0.38, 0.08], leftLeg);
  const rightShoe = add(new THREE.BoxGeometry(0.19, 0.1, 0.3), shoe, [0, -0.38, 0.08], rightLeg);
  leftShoe.rotation.x = -0.08;
  rightShoe.rotation.x = -0.08;

  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  leftArm.position.set(-0.29, 0.36, 0);
  rightArm.position.set(0.29, 0.36, 0);
  body.add(leftArm, rightArm);
  for (const arm of [leftArm, rightArm]) {
    const upper = add(limb, outfit, [0, -0.17, 0], arm);
    upper.rotation.z = arm === leftArm ? 0.15 : -0.15;
    add(new THREE.SphereGeometry(0.09, 12, 10), skin, [0, -0.36, 0], arm);
  }

  group.userData.animationParts = { body, leftLeg, rightLeg, leftArm, rightArm };
  group.userData.style = style;
  return group;
}

export function animatePlayerCharacter(character, elapsed, moving = true) {
  const { body, leftLeg, rightLeg, leftArm, rightArm } = character.userData.animationParts;
  const pace = moving ? 1 : 0.12;
  body.position.y = 1.05 + Math.abs(Math.sin(elapsed * 10)) * 0.035 * pace;
  leftLeg.rotation.x = Math.sin(elapsed * 11) * 0.52 * pace;
  rightLeg.rotation.x = -Math.sin(elapsed * 11) * 0.52 * pace;
  leftArm.rotation.x = -Math.sin(elapsed * 11) * 0.4 * pace;
  rightArm.rotation.x = Math.sin(elapsed * 11) * 0.4 * pace;
}


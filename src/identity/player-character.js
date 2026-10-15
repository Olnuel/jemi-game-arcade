import * as THREE from 'three';

// The fields and option values match Start.ng's centrally managed character style.
export const PREVIEW_STYLE = Object.freeze({
  body: 'female',
  primaryColor: '#e89148',
  secondaryColor: '#243d45',
  skinColor: '#8d5524',
  hairColor: '#17120f',
  hair: 'braids',
  hat: 'none',
  accessory: 'none',
  name: 'Visitor',
});

const COLOR_PATTERN = /^#[\da-f]{6}$/i;
const OPTIONS = {
  body: ['female', 'male'],
  hair: ['short', 'afro', 'braids', 'bun', 'ponytail', 'dreads', 'bald'],
  hat: ['none', 'cap', 'beanie', 'tophat', 'crown'],
  accessory: ['none', 'glasses', 'earrings', 'beard', 'scarf', 'backpack'],
};

export function normalizeCharacterStyle(style = {}) {
  if (!style || typeof style !== 'object') style = {};
  const safeColor = (value, fallback) => typeof value === 'string' && COLOR_PATTERN.test(value) ? value : fallback;
  const safeOption = (key, value) => OPTIONS[key].includes(value) ? value : PREVIEW_STYLE[key];
  return {
    body: safeOption('body', style.body),
    primaryColor: safeColor(style.primaryColor, PREVIEW_STYLE.primaryColor),
    secondaryColor: safeColor(style.secondaryColor, PREVIEW_STYLE.secondaryColor),
    skinColor: safeColor(style.skinColor, PREVIEW_STYLE.skinColor),
    hairColor: safeColor(style.hairColor, PREVIEW_STYLE.hairColor),
    hair: safeOption('hair', style.hair),
    hat: safeOption('hat', style.hat),
    accessory: safeOption('accessory', style.accessory),
    name: typeof style.name === 'string' && style.name.trim() ? style.name.trim().slice(0, 24) : PREVIEW_STYLE.name,
  };
}

const HAT_LIFT = { short: 0.08, afro: 0.28, braids: 0.08, bun: 0.08, ponytail: 0.08, dreads: 0.08, bald: 0 };

function makeMaterial(color, roughness = 0.8, metalness = 0.03) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function clearGroup(group) {
  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse((object) => {
      object.geometry?.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material?.dispose();
    });
  }
}

function addMesh(parent, geometry, material, position = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function buildCharacter(character, styleInput) {
  clearGroup(character);
  const style = normalizeCharacterStyle(styleInput);
  const primary = makeMaterial(style.primaryColor, 0.68);
  const secondary = makeMaterial(style.secondaryColor, 0.78);
  const skin = makeMaterial(style.skinColor, 0.83);
  const hair = makeMaterial(style.hairColor, 0.92);
  const dark = makeMaterial('#211b19', 0.75);
  const shoe = makeMaterial('#d3ae78', 0.64);
  const gold = makeMaterial('#f5c45f', 0.36, 0.36);

  const body = new THREE.Group();
  body.position.y = 0.86;
  character.add(body);
  const head = new THREE.Group();
  head.position.y = 1.04;
  body.add(head);

  const headMesh = addMesh(head, new THREE.SphereGeometry(0.28, 18, 14), skin, [0, 0.22, 0]);
  headMesh.scale.set(0.87, 1, 0.84);
  addMesh(head, new THREE.SphereGeometry(0.052, 10, 8), dark, [-0.09, 0.23, 0.226]);
  addMesh(head, new THREE.SphereGeometry(0.052, 10, 8), dark, [0.09, 0.23, 0.226]);

  const torso = addMesh(body, new THREE.CapsuleGeometry(0.25, 0.42, 5, 10), primary, [0, 0.43, 0]);
  torso.scale.x = style.body === 'female' ? 0.88 : 1;
  if (style.body === 'female') {
    addMesh(body, new THREE.CylinderGeometry(0.29, 0.39, 0.25, 12), secondary, [0, 0.05, 0]);
  }
  addMesh(body, new THREE.BoxGeometry(0.42, 0.07, 0.29), secondary, [0, 0.16, 0.02]);

  const limbGeometry = new THREE.CapsuleGeometry(0.085, 0.25, 4, 8);
  const legs = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.12, 0.03, 0);
    body.add(pivot);
    addMesh(pivot, limbGeometry, secondary, [0, -0.19, 0]);
    addMesh(pivot, new THREE.BoxGeometry(0.18, 0.09, 0.28), shoe, [0, -0.38, 0.05]);
    return pivot;
  });
  const arms = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.29, 0.69, 0);
    body.add(pivot);
    const arm = addMesh(pivot, limbGeometry, primary, [0, -0.16, 0]);
    arm.rotation.z = side * -0.13;
    addMesh(pivot, new THREE.SphereGeometry(0.085, 10, 8), skin, [0, -0.33, 0.01]);
    return pivot;
  });

  const hairTop = () => [
    addMesh(head, new THREE.SphereGeometry(0.245, 16, 10), hair, [0, 0.34, -0.035]),
  ];
  switch (style.hair) {
    case 'short':
      hairTop();
      addMesh(head, new THREE.BoxGeometry(0.39, 0.22, 0.11), hair, [0, 0.19, -0.235]);
      break;
    case 'afro': {
      const afro = addMesh(head, new THREE.SphereGeometry(0.34, 16, 12), hair, [0, 0.36, -0.02]);
      afro.scale.y = 0.82;
      break;
    }
    case 'braids':
      hairTop();
      for (const x of [-0.2, -0.1, 0, 0.1, 0.2]) {
        addMesh(head, new THREE.CylinderGeometry(0.033, 0.035, 0.63, 7), hair, [x, -0.02, -0.22]);
      }
      break;
    case 'bun':
      hairTop();
      addMesh(head, new THREE.SphereGeometry(0.1, 12, 8), hair, [0, 0.42, -0.23]);
      break;
    case 'ponytail':
      hairTop();
      addMesh(head, new THREE.CylinderGeometry(0.045, 0.06, 0.52, 8), hair, [0, 0.04, -0.31]);
      break;
    case 'dreads':
      hairTop();
      for (let index = 0; index < 8; index += 1) {
        const angle = (index / 8) * Math.PI * 2;
        addMesh(head, new THREE.CylinderGeometry(0.03, 0.035, 0.5, 7), hair, [Math.sin(angle) * 0.24, 0.02, -0.08 + Math.cos(angle) * 0.22]);
      }
      break;
    case 'bald':
    default:
      break;
  }

  const hatY = 0.42 + (HAT_LIFT[style.hair] ?? HAT_LIFT.short);
  if (style.hat === 'cap') {
    addMesh(head, new THREE.BoxGeometry(0.51, 0.13, 0.43), secondary, [0, hatY, -0.02]);
    addMesh(head, new THREE.BoxGeometry(0.43, 0.045, 0.27), primary, [0, hatY - 0.07, 0.21]);
  } else if (style.hat === 'beanie') {
    addMesh(head, new THREE.SphereGeometry(0.27, 16, 10), primary, [0, hatY - 0.02, -0.03]).scale.y = 0.72;
  } else if (style.hat === 'tophat') {
    addMesh(head, new THREE.CylinderGeometry(0.29, 0.29, 0.06, 16), dark, [0, hatY - 0.12, -0.02]);
    addMesh(head, new THREE.CylinderGeometry(0.19, 0.22, 0.38, 16), dark, [0, hatY + 0.08, -0.02]);
  } else if (style.hat === 'crown') {
    addMesh(head, new THREE.CylinderGeometry(0.2, 0.25, 0.16, 8), gold, [0, hatY - 0.03, -0.02]);
    for (let point = 0; point < 5; point += 1) {
      const angle = (point / 5) * Math.PI * 2;
      addMesh(head, new THREE.ConeGeometry(0.045, 0.12, 5), gold, [Math.sin(angle) * 0.2, hatY + 0.11, -0.02 + Math.cos(angle) * 0.2]);
    }
  }

  if (style.accessory === 'glasses') {
    for (const side of [-1, 1]) {
      addMesh(head, new THREE.BoxGeometry(0.15, 0.11, 0.035), dark, [side * 0.105, 0.23, 0.26]);
    }
    addMesh(head, new THREE.BoxGeometry(0.08, 0.025, 0.025), dark, [0, 0.23, 0.27]);
  } else if (style.accessory === 'earrings') {
    for (const side of [-1, 1]) addMesh(head, new THREE.SphereGeometry(0.045, 8, 6), gold, [side * 0.275, 0.04, 0.035]);
  } else if (style.accessory === 'beard') {
    addMesh(head, new THREE.SphereGeometry(0.17, 12, 8), hair, [0, -0.005, 0.19]).scale.set(1, 0.48, 0.6);
  } else if (style.accessory === 'scarf') {
    addMesh(body, new THREE.TorusGeometry(0.27, 0.07, 8, 16), secondary, [0, 0.68, 0]).rotation.x = Math.PI / 2;
    addMesh(body, new THREE.BoxGeometry(0.12, 0.35, 0.08), secondary, [0.18, 0.43, 0.22]);
  } else if (style.accessory === 'backpack') {
    addMesh(body, new THREE.BoxGeometry(0.48, 0.52, 0.2), secondary, [0, 0.5, -0.31]);
    addMesh(body, new THREE.BoxGeometry(0.42, 0.11, 0.21), primary, [0, 0.69, -0.32]);
  }

  character.userData.animationParts = { body, legs, arms };
  character.userData.style = style;
}

export function createPlayerCharacter(styleInput = PREVIEW_STYLE) {
  const character = new THREE.Group();
  buildCharacter(character, styleInput);
  return character;
}

export function applyPlayerCharacterStyle(character, styleInput) {
  buildCharacter(character, styleInput);
}

export function animatePlayerCharacter(character, elapsed, moving = true) {
  const { body, legs, arms } = character.userData.animationParts;
  const pace = moving ? 1 : 0.12;
  body.position.y = 0.86 + Math.abs(Math.sin(elapsed * 10)) * 0.035 * pace;
  legs[0].rotation.x = Math.sin(elapsed * 11) * 0.52 * pace;
  legs[1].rotation.x = -Math.sin(elapsed * 11) * 0.52 * pace;
  arms[0].rotation.x = -Math.sin(elapsed * 11) * 0.4 * pace;
  arms[1].rotation.x = Math.sin(elapsed * 11) * 0.4 * pace;
}


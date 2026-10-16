// Headless check: does switching body actually rebuild the figure?
import * as THREE from 'three';
import { createPlayerCharacter, applyPlayerCharacterStyle, PREVIEW_STYLE } from '../src/identity/player-character.js';

function stats(character) {
  let meshes = 0;
  let top = -Infinity;
  let bottom = Infinity;
  character.updateWorldMatrix(true, true);
  character.traverse((o) => {
    if (!o.isMesh) return;
    meshes += 1;
    const box = new THREE.Box3().setFromObject(o);
    if (box.max.y > top) top = box.max.y;
    if (box.min.y < bottom) bottom = box.min.y;
  });
  const human = character.userData.human;
  return {
    meshes,
    height: +(top - bottom).toFixed(3),
    bottomY: +bottom.toFixed(3),
    female: human.female,
    torsoR: +(human.torso?.userData?.probe ?? 0),
  };
}

const femaleChar = createPlayerCharacter(PREVIEW_STYLE);
const before = stats(femaleChar);

applyPlayerCharacterStyle(femaleChar, { ...PREVIEW_STYLE, body: 'male' });
const afterMale = stats(femaleChar);

applyPlayerCharacterStyle(femaleChar, { ...PREVIEW_STYLE, body: 'female' });
const backToFemale = stats(femaleChar);

console.log('female (initial) :', JSON.stringify(before));
console.log('after -> male    :', JSON.stringify(afterMale));
console.log('after -> female  :', JSON.stringify(backToFemale));
console.log('');
console.log('femaleFlag before/male/female :', before.female, afterMale.female, backToFemale.female);
console.log('changed at all?               :', JSON.stringify(before) !== JSON.stringify(afterMale));
console.log('height delta                  :', (afterMale.height - before.height).toFixed(3));
// Checks that difficulty rises on wins and eases back on losses.
import { recordDifficulty, difficultyFor, levelFor, LEVELS, maxDifficultyLevel } from '../src/difficulty.js';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const G = 'identity-dash';
console.log('start level:', levelFor(G), `- ${difficultyFor(G).name}\n`);

const seq = ['menu', 'won', 'won', 'won', 'won', 'won', 'won', 'won', 'over', 'over', 'over', 'over', 'over', 'over'];
console.log('step  outcome   level  name             speed  spawn');
seq.forEach((outcome, i) => {
  const lvl = recordDifficulty(G, outcome);
  const d = difficultyFor(G);
  console.log(`${String(i).padStart(3)}  ${outcome.padEnd(8)}  ${lvl}/${maxDifficultyLevel()}    ${d.name.padEnd(15)} ${d.dashSpeed}  ${d.dashSpawn}`);
});

console.log('');
console.log('never above max:', levelFor(G) <= maxDifficultyLevel());
console.log('never below zero:', levelFor(G) >= 0);
console.log('levels defined:', LEVELS.length, '| names:', LEVELS.map((l) => l.name).join(', '));

// each level must be strictly harder than the one before
let monotonic = true;
for (let i = 1; i < LEVELS.length; i++) {
  const a = LEVELS[i - 1], b = LEVELS[i];
  if (!(b.dashSpeed > a.dashSpeed && b.dashRamp >= a.dashRamp && b.jumpWidth < a.jumpWidth && b.jumpGrace < a.jumpGrace && b.saluDecel > a.saluDecel && b.saluReach < a.saluReach)) monotonic = false;
}
console.log('every level is harder than the last:', monotonic);
// Checks reward payouts and that a spoken line is queued.
import { recordResult, earnedBadges, rewardSummary, BADGES } from '../src/rewards.js';
import { speakResult, voiceSupported, readVoiceEnabled } from '../src/audio/voice.js';

// minimal localStorage shim
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

console.log('voice supported:', voiceSupported(), '| enabled:', readVoiceEnabled());
console.log('speaking a win line queues an utterance:', speakResult('avatar-jump', 'won'));
console.log('');

let run = 0;
const step = (game, outcome) => {
  run += 1;
  const fresh = recordResult(game, outcome);
  const { earned, streak } = rewardSummary();
  const names = fresh.map((id) => BADGES.find((b) => b.id === id)?.label || id);
  console.log(`${String(run).padStart(2)}. ${game.padEnd(14)} ${outcome.padEnd(5)} -> new: [${names.join(', ') || '-'}]  earned=${earned.size}/${BADGES.length} streak=${streak}`);
};

console.log('--- a winning streak ---');
step('identity-dash', 'won');
step('identity-dash', 'lost');
step('avatar-jump', 'won');
step('avatar-jump', 'won');
step('salubata', 'won');
step('avatar-jump', 'won');
step('identity-dash', 'won');
step('salubata', 'won');

console.log('');
console.log('final earned:', [...earnedBadges()].join(', '));
console.log('all badges:', BADGES.map((b) => b.id).join(', '));
const missing = BADGES.filter((b) => !earnedBadges().has(b.id)).map((b) => b.id);
console.log('missing:', missing.join(', ') || 'none');
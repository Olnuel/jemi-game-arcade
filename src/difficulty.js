// Difficulty that rises while a player is winning and eases back when they lose.
// The streak is tracked per game and stored locally, so each title ramps on its own.

const KEY = 'arcade:difficulty';
const MAX_LEVEL = 4;

// How each level scales the three games. 0 is the gentlest, MAX_LEVEL the hardest.
export const LEVELS = [
  { level: 0, name: 'Chill',      dashSpeed: 8.0,  dashRamp: 0.10, dashSpawn: 1.45, jumpWidth: 1.00, jumpGrace: 0.24, saluDecel: 3.9, saluReach: 0.58 },
  { level: 1, name: 'Warming up', dashSpeed: 8.6,  dashRamp: 0.115, dashSpawn: 1.38, jumpWidth: 0.96, jumpGrace: 0.22, saluDecel: 4.3, saluReach: 0.56 },
  { level: 2, name: 'Getting real', dashSpeed: 9.3, dashRamp: 0.13, dashSpawn: 1.30, jumpWidth: 0.92, jumpGrace: 0.19, saluDecel: 4.8, saluReach: 0.53 },
  { level: 3, name: 'Tough',      dashSpeed: 10.1, dashRamp: 0.15, dashSpawn: 1.22, jumpWidth: 0.88, jumpGrace: 0.16, saluDecel: 5.3, saluReach: 0.50 },
  { level: 4, name: 'Danfo-bus fast', dashSpeed: 11.0, dashRamp: 0.17, dashSpawn: 1.14, jumpWidth: 0.84, jumpGrace: 0.13, saluDecel: 5.9, saluReach: 0.47 },
];

function blank() {
  return { 'identity-dash': 0, 'avatar-jump': 0, salubata: 0, streak: { 'identity-dash': 0, 'avatar-jump': 0, salubata: 0 } };
}

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || typeof raw !== 'object') return blank();
    const clean = (value) => Math.min(MAX_LEVEL, Math.max(0, Number.isFinite(value) ? value : 0));
    return {
      'identity-dash': clean(raw['identity-dash']),
      'avatar-jump': clean(raw['avatar-jump']),
      salubata: clean(raw.salubata),
      streak: {
        'identity-dash': Math.max(0, raw.streak?.['identity-dash'] || 0),
        'avatar-jump': Math.max(0, raw.streak?.['avatar-jump'] || 0),
        salubata: Math.max(0, raw.streak?.salubata || 0),
      },
    };
  } catch {
    return blank();
  }
}

function write(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
}

/** The tuning table for a game at its current level. */
export function difficultyFor(game) {
  const state = read();
  return LEVELS[state[game] ?? 0];
}

export function levelFor(game) {
  return read()[game] ?? 0;
}

/**
 * A win steps the level up, a loss steps it back down. Only a finished run counts:
 * 'menu', 'running' and 'paused' leave the level alone, so launching a game from
 * the shelf does not read as a loss. Never leaves the 0..MAX range.
 */
export function recordDifficulty(game, outcome) {
  if (outcome !== 'won' && outcome !== 'over') return levelFor(game);
  const state = read();
  if (outcome === 'won') {
    state.streak[game] = (state.streak[game] || 0) + 1;
    state[game] = Math.min(MAX_LEVEL, state[game] + 1);
  } else {
    state.streak[game] = 0;
    state[game] = Math.max(0, state[game] - 1);
  }
  write(state);
  return state[game];
}

export function maxDifficultyLevel() {
  return MAX_LEVEL;
}
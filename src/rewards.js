// Rewards for finishing runs. Badges are earned locally and shown on the shelf.
// Winning a game awards its badge the first time; losing never takes one away.

const KEY = 'arcade:rewards';

export const BADGES = [
  { id: 'first-win', label: 'First Win', hint: 'Finish any run' },
  { id: 'dash', label: 'Road Runner', hint: 'Beat Identity Dash' },
  { id: 'jump', label: 'High Climber', hint: 'Reach the Avatar Jump rooftop' },
  { id: 'salubata', label: 'Street Champion', hint: 'Clear all 9 Salubata bands' },
  { id: 'clean', label: 'Sweep', hint: 'Win all three games' },
  { id: 'streak-3', label: 'Hat Trick', hint: 'Three wins in a row' },
];

const GAME_BADGE = { 'identity-dash': 'dash', 'avatar-jump': 'jump', salubata: 'salubata' };

function blank() {
  return { won: [], streak: 0, bestStreak: 0 };
}

export function readRewards() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || typeof raw !== 'object') return blank();
    return {
      won: Array.isArray(raw.won) ? raw.won.filter((id) => typeof id === 'string') : [],
      streak: Number.isFinite(raw.streak) ? raw.streak : 0,
      bestStreak: Number.isFinite(raw.bestStreak) ? raw.bestStreak : 0,
    };
  } catch {
    return blank();
  }
}

function write(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
}

export function earnedBadges() {
  const state = readRewards();
  const ids = new Set(state.won);
  if (state.won.length > 0) ids.add('first-win');
  if (state.bestStreak >= 3) ids.add('streak-3');
  if (state.won.includes('dash') && state.won.includes('jump') && state.won.includes('salubata')) ids.add('clean');
  return ids;
}

/**
 * Records a finished run and returns the badges newly earned by it, so the
 * caller can celebrate only what was just unlocked.
 */
export function recordResult(game, outcome) {
  const before = earnedBadges();
  const state = readRewards();

  if (outcome === 'won') {
    const badge = GAME_BADGE[game];
    if (badge && !state.won.includes(badge)) state.won.push(badge);
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
  } else {
    state.streak = 0;
  }

  write(state);

  // Derived badges (First Win, Sweep, Hat Trick) are not stored, so compare the
  // badge sets before and after to report each one exactly once.
  const after = earnedBadges();
  return [...after].filter((id) => !before.has(id));
}

export function rewardSummary() {
  const state = readRewards();
  const earned = earnedBadges();
  return { earned, total: BADGES.length, streak: state.streak, bestStreak: state.bestStreak };
}
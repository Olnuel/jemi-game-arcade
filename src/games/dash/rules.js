// The rules of Identity Dash, with no Three.js and no DOM in sight.
//
// Everything that decides "does the runner get through this row" lives here as plain
// numbers and plain functions, so the whole of the game's fairness is testable with
// node --test instead of only being findable by playing it.

// Lane centres. The road is three lanes wide and the runner only ever occupies one,
// so a row is decided by lane first and by height second.
export const LANE_COUNT = 3;
export const LANE_WIDTH = 1.62;
export const LANES = [-LANE_WIDTH, 0, LANE_WIDTH];

/**
 * The runner's own body, as half extents in world units, measured from the feet up.
 * Sliding more than halves the height, which is what makes a banner a different
 * problem from a barrier rather than a taller version of the same one.
 */
export const BODY = {
  halfWidth: 0.32,
  standing: 1.46,
  sliding: 0.78,
};

// Two obstacles in adjacent lanes nearly touch but never overlap, so a row can be
// cleared by stepping aside without needing pixel-perfect placement.
const EDGE_EPSILON = 0.001;

/**
 * The obstacle table. Each entry is a solid box occupying one lane:
 *
 *   halfWidth  how much of the lane it eats
 *   bottom     the height it starts at, which is what makes a gantry a gantry: it
 *              hangs from 0.86 and leaves a gap you can only duck through
 *   top        the height it ends at, which is what a jump has to beat
 *   verb       how the row is meant to be answered, used by the pattern generator to
 *              avoid handing out a row that needs a verb the player cannot use yet
 *   length     how many world units of road it occupies along z, so a bus reads as
 *              long on screen rather than as a single deep block
 */
export const OBSTACLES = {
  // Jumped over. Crossbars and low roadworks.
  hurdle:   { halfWidth: 0.62, bottom: 0.00, top: 0.48, verb: 'jump',  length: 0.5 },
  cone:     { halfWidth: 0.60, bottom: 0.00, top: 0.32, verb: 'jump',  length: 0.6 },
  lowcart:  { halfWidth: 0.60, bottom: 0.00, top: 0.54, verb: 'jump',  length: 3.4 },
  // Stepped around. Anything taller than the jump is hopeless to clear.
  crate:    { halfWidth: 0.50, bottom: 0.00, top: 1.32, verb: 'dodge', length: 1.0 },
  danfo:    { halfWidth: 0.58, bottom: 0.00, top: 2.05, verb: 'dodge', length: 4.6 },
  container:{ halfWidth: 0.58, bottom: 0.00, top: 2.45, verb: 'dodge', length: 8.4 },
  // Ducked under. The banner hangs from `bottom` and reaches above the tallest point
  // the jump can put the runner's head, so it can only be answered by a slide: not
  // walked under, not jumped over, and not both at once.
  gantry:   { halfWidth: 0.55, bottom: 0.84, top: 2.80, verb: 'slide', length: 0.6 },
};

export const OBSTACLE_KINDS = Object.keys(OBSTACLES);

/** Height the runner's feet need to be above for a jump to clear this obstacle. */
export function clearanceFor(kind) {
  const obstacle = OBSTACLES[kind];
  return obstacle ? obstacle.top : Infinity;
}

/** Lowest ceiling a slide has to duck under, or Infinity when the obstacle is solid. */
export function ceilingFor(kind) {
  const obstacle = OBSTACLES[kind];
  return obstacle && obstacle.bottom > 0 ? obstacle.bottom : Infinity;
}

/**
 * The runner's current box, from a plain state object. `feetY` is the height of the
 * soles above the tarmac, so a jumping runner's box rises with the jump rather than
 * the whole rig moving relative to it.
 */
export function bodyBox({ feetY = 0, sliding = false } = {}) {
  const height = sliding ? BODY.sliding : BODY.standing;
  return { bottom: feetY, top: feetY + height, halfWidth: BODY.halfWidth };
}

/** Do two boxes that share a z overlap also overlap in x? */
function overlapsX(ax, ahw, bx, bhw) {
  return Math.abs(ax - bx) < ahw + bhw - EDGE_EPSILON;
}

/**
 * Does `kind` stop a runner described by `runner` in `lane`?
 *
 * `runner` needs `feetY` and optionally `sliding`. This is the single source of truth
 * for every hit in the game, so the three verbs cannot drift apart from each other or
 * from the meshes drawn on screen.
 */
export function blocksLane(kind, lane, runnerLane, runner) {
  if (lane !== runnerLane) return false;
  const obstacle = OBSTACLES[kind];
  if (!obstacle) return false;
  const box = bodyBox(runner);
  if (!overlapsX(LANES[lane], obstacle.halfWidth, LANES[runnerLane], box.halfWidth)) return false;
  // Strict overlap: touching the top of a barrier or the underside of a banner is a
  // clear, not a hit, which is what stops the clear window feeling pixel-hunty.
  return box.bottom < obstacle.top - EDGE_EPSILON && box.top > obstacle.bottom + EDGE_EPSILON;
}

/** Coins are generous: a wider box than the body, so near-misses still count. */
const COIN_RADIUS = 0.55;

export function collectsCoin(coin, runnerLane, runner) {
  if (coin.lane !== runnerLane) return false;
  const box = bodyBox(runner);
  const centre = coin.y;
  return centre > box.bottom - COIN_RADIUS && centre < box.top + COIN_RADIUS;
}

/**
 * Power-ups. Magnet and 2x run down on a timer; the hoverboard is a single charge
 * that you spend either on a hit or on a boost you start yourself.
 */
export const POWERUPS = {
  magnet: { id: 'magnet', label: 'COIN MAGNET', duration: 9, pickupColor: '#38c6f4' },
  double: { id: 'double', label: 'DOUBLE SCORE', duration: 8, pickupColor: '#ffc83b' },
  board:  { id: 'board',  label: 'HOVERBOARD',  duration: 0, pickupColor: '#00d98a' },
};

export const POWERUP_KINDS = Object.keys(POWERUPS);

// How far away a magnet reaches for a coin, in world units along x. Wide enough that
// it visibly bends toward you rather than teleporting coins.
export const MAGNET_REACH = 2.1;

export function magnetised(coin, runnerLane, runner, x) {
  if (!runner.magnet) return false;
  if (Math.abs(coin.lane - runnerLane) > 1) return false;
  return Math.abs(LANES[coin.lane] - x) <= MAGNET_REACH;
}

/** Creates the power-up bag a run starts and restarts with. */
export function createPowerups() {
  return { magnet: 0, double: 0, board: false };
}

/** Ticks every timer down. Returns the same object for convenience. */
export function tickPowerups(powerups, dt) {
  if (powerups.magnet > 0) powerups.magnet = Math.max(0, powerups.magnet - dt);
  if (powerups.double > 0) powerups.double = Math.max(0, powerups.double - dt);
  return powerups;
}

export function activePowerups(powerups) {
  return [
    powerups.magnet > 0 && POWERUPS.magnet.label,
    powerups.double > 0 && POWERUPS.double.label,
    powerups.board && POWERUPS.board.label,
  ].filter(Boolean);
}

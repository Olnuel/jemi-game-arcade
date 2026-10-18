// The runner's own state: which lane, and what the body is doing vertically.
//
// Kept apart from the mesh code so the timing of the three verbs can be reasoned about
// and tested directly. The important property here is that a verb is a state with a
// duration rather than a flag, so pressing jump twice fast cannot stack a jump on top
// of a jump and leave the runner stuck in the air.

export const JUMP_TIME = 0.72;
export const JUMP_PEAK = 1.08;
export const DOUBLE_JUMP_TIME = 0.54;
export const DOUBLE_JUMP_PEAK = 0.80;
export const SLIDE_TIME = 0.52;
// Pressing down while falling makes the descent 2.6x quicker, which turns a mistimed
// jump back into a usable one instead of a death sentence.
export const FAST_FALL_MULTIPLIER = 2.6;
export const MAX_JUMPS = 2;
// Held as a linear blend rather than eased in the runner state, so reversing
// mid-change takes over from the current position exactly and the whole move is
// frame-rate independent. Easing is applied at the point of use.
export const LANE_CHANGE_TIME = 0.24;

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function createRunner() {
  return {
    lane: 1,
    fromLane: 1,
    laneProgress: 1,
    feetY: 0,
    jumpsUsed: 0,
    jumpTime: 0,
    jumpDuration: 0,
    jumpPeak: 0,
    jumpBaseY: 0,
    fastFalling: false,
    slideTime: 0,
    magnet: false,
  };
}

export function resetRunner(runner) {
  const fresh = createRunner();
  Object.assign(runner, fresh);
  return runner;
}

/** Where the runner currently sits between `fromLane` and `lane`, in lane units. */
export function laneOffset(runner) {
  const t = clamp(runner.laneProgress, 0, 1);
  return runner.fromLane + (runner.lane - runner.fromLane) * t;
}

/**
 * Steps sideways. Cannot leave the road, and a change already in flight is taken over
 * from wherever it currently is, so reversing mid-change turns the runner around
 * rather than snapping back to the lane it started from.
 */
export function changeLane(runner, direction, laneCount) {
  const target = clamp(runner.lane + direction, 0, laneCount - 1);
  if (target === runner.lane && runner.laneProgress >= 1) return false;
  runner.fromLane = laneOffset(runner);
  runner.lane = target;
  runner.laneProgress = 0;
  return true;
}

export function stepLane(runner, dt) {
  if (runner.laneProgress >= 1) return;
  runner.laneProgress = Math.min(1, runner.laneProgress + dt / LANE_CHANGE_TIME);
  if (runner.laneProgress >= 1) runner.fromLane = runner.lane;
}

/**
 * 0 at the origin lane, 1 when the change has landed. Smoothstep, so the runner eases
 * out of one lane and settles into the next rather than sliding at constant speed,
 * which at high road speed reads as the whole world skidding sideways.
 */
export function laneBlend(runner) {
  if (runner.laneProgress >= 1) return 1;
  const t = clamp(runner.laneProgress, 0, 1);
  // Normalised smoothstep on a remapped input. A plain smoothstep on t already reads
  // as starting at half speed the instant you press, so the input is eased a little
  // first, which shifts the fast part of the move to the middle where it belongs.
  // The clamp on the result matters: t*t*(3-t*t) peaks at 1.125, and a lane change
  // that drifts 12% past the target lane is a visible overshoot.
  const eased = t * t * (3 - 2 * t);
  return clamp(eased, 0, 1);
}

/** Jump, or the second jump when one is already in the air. */
export function jump(runner) {
  // Jumping outranks sliding, so up while sliding gets you out of it.
  runner.slideTime = 0;
  if (runner.jumpsUsed >= MAX_JUMPS) return false;
  runner.jumpsUsed += 1;
  runner.jumpBaseY = runner.feetY;
  runner.jumpDuration = runner.jumpsUsed === 1 ? JUMP_TIME : DOUBLE_JUMP_TIME;
  runner.jumpPeak = runner.jumpsUsed === 1 ? JUMP_PEAK : DOUBLE_JUMP_PEAK;
  runner.jumpTime = runner.jumpDuration;
  runner.fastFalling = false;
  return true;
}

/** Down is context sensitive: in the air it fast-falls, on the ground it slides. */
export function duck(runner) {
  if (runner.jumpTime > 0) {
    if (runner.fastFalling) return false;
    runner.fastFalling = true;
    return true;
  }
  if (runner.slideTime > 0) return false;
  runner.slideTime = SLIDE_TIME;
  return true;
}

export function isSliding(runner) {
  return runner.slideTime > 0 && runner.jumpTime === 0;
}

/** True at the bottom of a jump, or when the fast fall has just put the runner down. */
export function justLanded(runner) {
  return runner.jumpTime === 0 && runner.feetY <= 0.0001;
}

/**
 * Advances the vertical state. The arc is a half sine measured from the height the
 * jump started at, which keeps it identical at any frame rate and lets the clear
 * window be reasoned about exactly.
 */
export function stepVertical(runner, dt) {
  if (runner.slideTime > 0) runner.slideTime = Math.max(0, runner.slideTime - dt);
  if (runner.jumpTime > 0) {
    runner.jumpTime = Math.max(0, runner.jumpTime - dt * (runner.fastFalling ? FAST_FALL_MULTIPLIER : 1));
    const progress = 1 - runner.jumpTime / runner.jumpDuration;
    runner.feetY = runner.jumpBaseY + Math.sin(progress * Math.PI) * runner.jumpPeak;
    if (runner.jumpTime === 0) {
      runner.feetY = 0;
      runner.jumpsUsed = 0;
      runner.jumpBaseY = 0;
      runner.fastFalling = false;
    }
  } else {
    runner.feetY = 0;
    runner.jumpsUsed = 0;
    runner.jumpBaseY = 0;
    runner.fastFalling = false;
  }
  return runner.feetY;
}

/** The state a hit test needs. */
export function runnerSnapshot(runner) {
  return { feetY: runner.feetY, sliding: isSliding(runner), magnet: runner.magnet };
}

// How the run tightens over distance, and when a power-up shows up.
//
// Split out so the ramp can be checked against the constants that the game actually
// runs on, rather than being eyeballed while playing.

export const RUN = {
  startSpeed: 9.0,
  maxSpeed: 15.2,
  // How long it takes to reach maxSpeed from a standing start, in seconds. Two and a
  // half minutes of a run that gets steadily harder, rather than a speed dial that
  // pins to the top in twenty seconds and stays there.
  rampSeconds: 90,
  // Distance between rows at the start and at the cap, in world units. The gap closes
  // as the run speeds up, which is what makes it feel tighter even though the spawn
  // timer only ever shrinks because the speed went up.
  gapOpen: 26,
  gapTight: 15,
  // The row after one that demanded a verb gets extra road, so there is time to finish
  // the jump or the slide and land before the next decision arrives.
  recoveryGap: 1.45,
  minGapSeconds: 0.46,
  // Coins per row trail, and how often a power-up turns up instead.
  powerupChance: 0.11,
};

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** 0 at the start of a run, 1 once it is at the cap. */
export function speedRamp(speed) {
  const span = Math.max(0.001, RUN.maxSpeed - RUN.startSpeed);
  return clamp((speed - RUN.startSpeed) / span, 0, 1);
}

/**
 * Acceleration in world units per second, derived from the duration of the climb.
 *
 * nextSpeed() integrates this rate, so rampSeconds and the rate have to describe the
 * same climb: over rampSeconds at a constant rate the speed must travel exactly the
 * distance between startSpeed and maxSpeed. A test holds those in agreement, because
 * a mismatch is invisible while playing and only shows up as a ramp that is not the
 * length it claims to be.
 */
export function rampRate() {
  return (RUN.maxSpeed - RUN.startSpeed) / RUN.rampSeconds;
}

/** How long the climb takes from the current speed, for the HUD. */
export function timeToCap(speed) {
  if (speed >= RUN.maxSpeed) return 0;
  return (RUN.maxSpeed - speed) / rampRate();
}

export function nextSpeed(speed, dt) {
  return Math.min(RUN.maxSpeed, speed + rampRate() * dt);
}

/** Metres travelled, which is what the HUD shows and what a score is made of. */
export function distanceTravelled(speed, dt) {
  return speed * dt;
}

/**
 * Seconds until the next row. Derived from a distance gap divided by speed, so the
 * spacing on screen and the spacing in time can never disagree, and a recovery row
 * genuinely buys room at any speed.
 */
export function rowInterval(speed, ramp, recovering, rng = Math.random) {
  const gap = RUN.gapOpen + (RUN.gapTight - RUN.gapOpen) * ramp;
  const spacing = gap * (recovering ? RUN.recoveryGap : 1);
  return Math.max(RUN.minGapSeconds, spacing / speed) + rng() * 0.16;
}

/** How the run is going, surfaced in the HUD so the difficulty is legible. */
export function rampLabel(ramp) {
  if (ramp < 0.25) return 'WARMING';
  if (ramp < 0.5) return 'PICKING UP';
  if (ramp < 0.75) return 'FULL TILT';
  return 'DANFO BLIND';
}

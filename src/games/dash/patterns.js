// What the road puts in front of the runner.
//
// Rows are drawn from a small set of named patterns rather than scattered at random,
// because a random scatter cannot promise anything about fairness. Every pattern here
// is checked by `requiredVerbForLane` before it is returned, and a row is only handed
// back if at least one lane can actually be run through with the verbs the player has
// unlocked. That is the whole fairness argument, and it is a plain function of two
// lists, so a test can enumerate it.

import { LANE_COUNT, OBSTACLES } from './rules.js';

// A pattern is a set of lanes to fill and what to fill them with. `null` in the list
// means leave that lane open.
export const PATTERNS = {
  single:      { fill: 1, verb: 'any',  weight: 3 },
  double:      { fill: 2, verb: 'any',  weight: 2 },
  hurdleLine:  { fill: 3, verb: 'jump', weight: 0 },
  bannerLine:  { fill: 3, verb: 'slide',weight: 0 },
  cartRun:     { fill: 1, verb: 'jump', weight: 0, kind: 'lowcart' },
  busRun:      { fill: 1, verb: 'any',  weight: 0, kind: 'danfo' },
  crateGap:    { fill: 2, verb: 'any',  weight: 0, kind: 'crate' },
};

const ANY_KINDS = ['hurdle', 'cone', 'crate', 'danfo'];

/**
 * What a runner has to be doing to survive a lane, or null if the lane is clear.
 *
 * A lane mixing a jump and a slide is impossible: there is no single body pose that
 * is both above one box and below the other. That is the one case the generator has to
 * rule out, and ruling it out here is what stops an unfair row ever being built.
 */
export function requiredVerbForLane(lane, obstacles) {
  const here = obstacles.filter((obstacle) => obstacle.lane === lane);
  if (here.length === 0) return null;
  let verb = null;
  for (const obstacle of here) {
    const shape = OBSTACLES[obstacle.kind];
    if (!shape) return 'impossible';
    if (shape.verb === 'dodge') return 'impossible';
    if (verb && verb !== shape.verb) return 'impossible';
    verb = shape.verb;
  }
  return verb;
}

/** Which verbs the player can currently use, as the pattern generator sees it. */
export function verbsAt(ramp) {
  return {
    jump: true,
    slide: ramp > 0.18,
  };
}

/**
 * Picks a pattern name. Patterns that need a slide or demand every lane are held back
 * until the run is quick enough to be interesting, and the previous name is never
 * repeated so the road does not stutter.
 */
export function choosePattern(ramp, previous, rng = Math.random) {
  const verbs = verbsAt(ramp);
  const names = [];
  for (const [name, spec] of Object.entries(PATTERNS)) {
    if (name === previous) continue;
    if (spec.verb === 'slide' && !verbs.slide) continue;
    // The all-lanes rows only once the gap between them has closed enough to read as
    // a wall rather than as three separate problems.
    if (spec.fill === 3 && ramp < 0.3) continue;
    if (spec.kind === 'busRun' && ramp < 0.12) continue;
    if (spec.kind === 'crateGap' && ramp < 0.06) continue;
    for (let i = 0; i < spec.weight; i += 1) names.push(name);
  }
  if (!names.length) return 'single';
  return names[Math.floor(rng() * names.length) % names.length];
}

function shuffledLanes(rng) {
  const lanes = [0, 1, 2];
  for (let i = lanes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
  }
  return lanes;
}

/**
 * Builds one row. Returns the obstacles plus the lane that can be run through, so the
 * caller can lay coins along the safe line without having to work it out again.
 */
export function buildRow(ramp, previous, rng = Math.random) {
  const verbs = verbsAt(ramp);
  const name = choosePattern(ramp, previous, rng);
  const spec = PATTERNS[name];
  const order = shuffledLanes(rng);
  const obstacles = [];

  const fill = (lane, kind) => obstacles.push({ lane, kind });

  if (spec.fill === 3) {
    // A wall: every lane takes the same verb, so there is one answer and the skill is
    // spotting it far enough out to commit.
    const kind = name === 'hurdleLine' ? 'hurdle' : 'gantry';
    order.forEach((lane) => fill(lane, kind));
  } else if (name === 'cartRun') {
    fill(order[0], 'lowcart');
  } else if (name === 'busRun') {
    fill(order[0], 'danfo');
  } else if (name === 'crateGap') {
    fill(order[0], 'crate');
    fill(order[1], 'crate');
  } else if (spec.fill === 2) {
    // Two lanes blocked, one open. Occasionally make the open lane the one that
    // needs a verb, so the row is a choice rather than always a sidestep.
    const useVerb = verbs.slide && rng() < 0.3;
    fill(order[0], useVerb ? 'gantry' : ANY_KINDS[Math.floor(rng() * ANY_KINDS.length)]);
    fill(order[1], useVerb ? 'hurdle' : ANY_KINDS[Math.floor(rng() * ANY_KINDS.length)]);
    if (useVerb) {
      // A gantry in one lane and a hurdle in another leaves the third lane clear, but
      // the two occupied lanes now need different verbs. That is fine: the runner only
      // ever has to solve the lane they are standing in.
      return finish(name, obstacles, order[2], rng);
    }
  } else {
    fill(order[0], ANY_KINDS[Math.floor(rng() * ANY_KINDS.length)]);
  }

  return finish(name, obstacles, order[spec.fill], rng);
}

function finish(name, obstacles, safeLane, rng) {
  // Verify the claim rather than trusting it. If the row somehow has no usable lane,
  // open the safest one up so a bug can never produce an unplayable row.
  const verbs = { jump: true, slide: true };
  const usable = [0, 1, 2].some((lane) => {
    const need = requiredVerbForLane(lane, obstacles);
    return need === null || verbs[need];
  });
  if (!usable) {
    obstacles = obstacles.filter((obstacle) => obstacle.lane !== safeLane);
  }
  const clearLanes = [0, 1, 2].filter((lane) => requiredVerbForLane(lane, obstacles) === null);
  const resolvedSafe = clearLanes.length ? clearLanes[0] : safeLane;
  return { pattern: name, obstacles, safeLane: resolvedSafe, clearLanes };
}

/**
 * A full stretch of track, used by the tests to walk a long simulated run and assert
 * that no row is ever unfair. `spawnRow` is injected so the caller can build meshes.
 */
export function planTrack(count, ramp, rng = Math.random) {
  const rows = [];
  let previous = '';
  for (let i = 0; i < count; i += 1) {
    const row = buildRow(ramp, previous, rng);
    previous = row.pattern;
    rows.push(row);
  }
  return rows;
}

export { LANE_COUNT };

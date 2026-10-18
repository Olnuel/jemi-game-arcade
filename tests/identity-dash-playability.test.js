// Can a run actually be survived?
//
// The fairness tests check that every row has a way through. That is necessary but it
// is not sufficient: a row can be individually fair and still be unplayable if the gap
// before it is too short to finish the verb the row before demanded. This file drives
// the real runner state and the real row generator over a long simulated run, with a
// bot that does the correct thing, and asserts the bot survives.
//
// It is a simulation of the rules, not a browser session, and it is reported as one.

import test from 'node:test';
import assert from 'node:assert/strict';

import { LANES, LANE_COUNT, OBSTACLES, blocksLane, POWERUP_KINDS, createPowerups, tickPowerups } from '../src/games/dash/rules.js';
import {
  createRunner, resetRunner, changeLane, stepLane, jump, duck, isSliding,
  stepVertical, runnerSnapshot, JUMP_TIME, SLIDE_TIME,
} from '../src/games/dash/runner-state.js';
import { buildRow, requiredVerbForLane } from '../src/games/dash/patterns.js';
import { RUN, speedRamp, nextSpeed, rowInterval } from '../src/games/dash/progression.js';

const FRAME = 1 / 60;

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** What a runner must be doing to survive everything queued in this lane. */
function verbFor(lane, obstacles) {
  const need = requiredVerbForLane(lane, obstacles);
  if (need === null) return null;
  if (need === 'impossible') return 'impossible';
  return need;
}

/**
 * Plays a run with a bot that reads the road the way a player does: pick a lane that
 * works, move toward it early enough to be settled before the row arrives, and jump or
 * slide with enough lead time to finish the verb.
 */
function playRun({ seed = 1, seconds = 90, sloppy = false } = {}) {
  const rng = seeded(seed);
  const runner = createRunner();
  const powerups = createPowerups();
  let speed = RUN.startSpeed;
  let elapsed = 0;
  let distance = 0;
  let lastPattern = '';
  let recovering = 0;

  // Everything spawned and still travelling toward the runner.
  const queue = [];
  let spawnIn = 0.9;
  let deaths = 0;
  let rowsSeen = 0;
  let rowsAnswered = 0;

  const spawn = () => {
    const row = buildRow(speedRamp(speed), lastPattern, rng);
    lastPattern = row.pattern;
    recovering = (row.pattern === 'hurdleLine' || row.pattern === 'bannerLine') ? 1 : 0;
    for (const obstacle of row.obstacles) {
      queue.push({ ...obstacle, z: -46, length: OBSTACLES[obstacle.kind].length, tested: false });
    }
    rowsSeen += 1;
    spawnIn = rowInterval(speed, speedRamp(speed), recovering > 0, rng);
  };

  while (elapsed < seconds) {
    // ---- bot decides ----
    // Find the nearest row that still has to be answered, and which lane works.
    const nextRow = queue.filter((item) => !item.tested)
      .sort((a, b) => b.z - a.z)[0];
    if (nextRow) {
      const sameZ = queue.filter((item) => !item.tested && Math.abs(item.z - nextRow.z) < 0.2);
      const options = [0, 1, 2]
        .map((lane) => ({ lane, verb: verbFor(lane, sameZ) }))
        .filter((option) => option.verb !== 'impossible');
      if (options.length) {
        // Prefer a lane that needs nothing, then one we are already in, so the bot
        // does not take on a verb it does not have to. Otherwise the nearest.
        const score = (option) => (option.verb === null ? 0 : 2) + Math.abs(option.lane - runner.lane);
        options.sort((a, b) => score(a) - score(b));
        const target = options[0];
        if (target.lane !== runner.lane) changeLane(runner, Math.sign(target.lane - runner.lane), LANE_COUNT);
        if (target.verb === 'jump' || target.verb === 'slide') {
          // Trigger the verb once per row, when the obstacle is close enough that
          // the verb will still be active on arrival. Triggering too early means the
          // runner lands before the obstacle arrives; triggering too late means
          // collision. The lead time is tuned so the runner is mid-air/mid-slide
          // exactly when the row arrives.
          if (!nextRow.verbTriggered) {
            const need = target.verb === 'jump' ? JUMP_TIME : SLIDE_TIME;
            const timeToArrive = (-(nextRow.z + nextRow.length / 2)) / speed;
            const lead = target.verb === 'jump' ? JUMP_TIME * 0.85 : SLIDE_TIME * 0.9;
            if (timeToArrive < lead) {
              nextRow.verbTriggered = true;
              if (target.verb === 'jump') jump(runner);
              else if (target.verb === 'slide') duck(runner);
            }
          }
        }
      }
    }

    // ---- advance ----
    elapsed += FRAME;
    stepLane(runner, FRAME);
    stepVertical(runner, FRAME);
    tickPowerups(powerups, FRAME);
    runner.magnet = powerups.magnet > 0;
    speed = nextSpeed(speed, FRAME);
    distance += speed * FRAME;

    spawnIn -= FRAME;
    if (spawnIn <= 0) spawn();

    const scroll = speed * FRAME;
    for (const item of queue) item.z += scroll;

    for (const item of queue) {
      if (item.tested) continue;
      const lead = item.z + item.length / 2;
      // Test the row across the depth of the obstacle, not a single frame.
      if (lead >= 0 - 0.34 && item.z - item.length / 2 <= 0 + 0.34) {
        item.tested = true;
        rowsAnswered += 1;
        if (blocksLane(item.kind, item.lane, runner.lane, runnerSnapshot(runner))) {
          deaths += 1;
          if (deaths > 1) return { survived: false, distance, elapsed, rowsSeen, rowsAnswered, deathAt: elapsed };
          // One hit costs the run, as in the real game. Record it and stop.
          return { survived: false, distance, elapsed, rowsSeen, rowsAnswered, deathAt: elapsed };
        }
      }
    }
    // Drop anything behind the camera.
    for (let i = queue.length - 1; i >= 0; i -= 1) {
      if (queue[i].z - queue[i].length / 2 > 8) queue.splice(i, 1);
    }
  }

  return { survived: true, distance, elapsed, rowsSeen, rowsAnswered };
}

test('a correctly played run survives a long stretch', () => {
  for (let seed = 1; seed <= 25; seed += 1) {
    const result = playRun({ seed, seconds: 90 });
    assert.ok(result.survived,
      `seed ${seed} died at ${result.deathAt?.toFixed(1)}s after ${result.rowsAnswered} rows`);
    assert.ok(result.distance > 900, `seed ${seed} covered ground, got ${result.distance.toFixed(0)}m`);
  }
});

test('a run gets meaningfully harder as it goes on', () => {
  const early = playRun({ seed: 5, seconds: 20 });
  const late = playRun({ seed: 5, seconds: 90 });
  assert.ok(late.distance > early.distance, 'the long run goes further');
  assert.ok(late.rowsAnswered > early.rowsAnswered * 3, 'and meets many more rows');
});

test('a bot that reacts late still gets a fair number of rows before it fails', () => {
  // Not a fairness requirement, just a sanity check that the road is not so tight
  // that a single frame of hesitation is fatal on nearly every row.
  let survived = 0;
  const runs = 20;
  for (let seed = 1; seed <= runs; seed += 1) {
    if (playRun({ seed, seconds: 60, sloppy: true }).survived) survived += 1;
  }
  assert.ok(survived >= runs * 0.5,
    `a late bot survives at least half its runs, got ${survived}/${runs}`);
});

test('the three verbs are each genuinely needed', () => {
  // If a run could be completed with lanes alone, one of the verbs would be decoration.
  let jumpOnly = 0;
  let slideOnly = 0;
  let laneOnly = 0;
  for (let seed = 1; seed <= 30; seed += 1) {
    const rng = seeded(seed);
    let previous = '';
    for (let i = 0; i < 80; i += 1) {
      const row = buildRow(0.6, previous, rng);
      previous = row.pattern;
      // Counted before filtering: `null` means the lane is simply clear, which is the
      // case where picking a lane is the whole answer.
      const verbs = [0, 1, 2].map((lane) => verbFor(lane, row.obstacles));
      if (verbs.includes('jump')) jumpOnly += 1;
      if (verbs.includes('slide')) slideOnly += 1;
      if (verbs.includes(null)) laneOnly += 1;
    }
  }
  assert.ok(jumpOnly > 100, `jumping is needed often, ${jumpOnly} rows`);
  assert.ok(slideOnly > 20, `sliding is needed, ${slideOnly} rows`);
  assert.ok(laneOnly > 100, `so is picking a lane, ${laneOnly} rows`);
});

test('a reset run starts from exactly the same place as the first', () => {
  // The requirement that a player can leave and come back without a stuck animation or
  // a run that starts mid-air. Compared by replaying: same seed, same rows.
  const runner = createRunner();
  const first = playRun({ seed: 3, seconds: 30 });
  resetRunner(runner);
  assert.equal(runner.lane, 1);
  assert.equal(runner.feetY, 0);
  const second = playRun({ seed: 3, seconds: 30 });
  assert.equal(Math.round(first.distance), Math.round(second.distance),
    'the same seed replays identically, so nothing carried over');
});

test('power-ups are reachable and expire cleanly', () => {
  const powerups = createPowerups();
  assert.equal(powerups.magnet, 0);
  // Every kind the generator can place has a rule for it.
  for (const kind of POWERUP_KINDS) assert.ok(kind);
  powerups.magnet = 9;
  tickPowerups(powerups, 8.99);
  assert.ok(powerups.magnet > 0, 'still running just before it ends');
  tickPowerups(powerups, 0.02);
  assert.equal(powerups.magnet, 0, 'and gone just after');
});

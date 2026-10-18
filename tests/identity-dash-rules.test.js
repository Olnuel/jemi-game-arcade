// The rules of Identity Dash, tested against the same constants the game runs on.
//
// These are the promises the game makes to a player: that a row can always be run
// through, that each verb answers the obstacle it is supposed to and no other, and
// that the road never asks for a jump window tighter than the jump can manage.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LANES, LANE_COUNT, OBSTACLES, blocksLane, collectsCoin, bodyBox, BODY,
  POWERUPS, POWERUP_KINDS, createPowerups, tickPowerups, activePowerups,
} from '../src/games/dash/rules.js';
import {
  createRunner, resetRunner, changeLane, stepLane, laneBlend, laneOffset, jump, duck,
  isSliding, stepVertical, runnerSnapshot, JUMP_TIME, JUMP_PEAK, SLIDE_TIME, MAX_JUMPS,
  LANE_CHANGE_TIME,
} from '../src/games/dash/runner-state.js';
import {
  buildRow, requiredVerbForLane, planTrack, choosePattern, verbsAt,
} from '../src/games/dash/patterns.js';
import {
  RUN, speedRamp, nextSpeed, rowInterval, rampLabel, rampRate, timeToCap,
} from '../src/games/dash/progression.js';

const standing = { feetY: 0, sliding: false };
const sliding = { feetY: 0, sliding: true };

/** A deterministic RNG so a "random" row can be reproduced from a seed. */
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// ---------------------------------------------------------------- lane movement

test('lane changes are clamped to the road', () => {
  const runner = createRunner();
  runner.lane = 0;
  assert.equal(changeLane(runner, -1, LANE_COUNT), false, 'cannot walk off the left');
  assert.equal(runner.lane, 0);

  runner.lane = 2;
  assert.equal(changeLane(runner, 1, LANE_COUNT), false, 'cannot walk off the right');
  assert.equal(runner.lane, 2);
});

test('a lane change completes and lands on the target', () => {
  const runner = createRunner();
  runner.lane = 1;
  assert.equal(changeLane(runner, 1, LANE_COUNT), true);
  assert.equal(runner.lane, 2);

  let guard = 0;
  while (runner.laneProgress < 1 && guard < 600) {
    stepLane(runner, 1 / 60);
    guard += 1;
  }
  assert.equal(runner.laneProgress, 1);
  assert.equal(runner.fromLane, 2, 'settles once landed so it does not drift back');
  assert.equal(laneBlend(runner), 1);
});

test('a lane change lands on the target from any starting frame rate', () => {
  for (const fps of [30, 60, 90, 144]) {
    const runner = createRunner();
    changeLane(runner, -1, LANE_COUNT);
    let guard = 0;
    while (runner.laneProgress < 1 && guard < 1000) { stepLane(runner, 1 / fps); guard += 1; }
    assert.equal(runner.laneProgress, 1, `completes at ${fps}fps`);
    assert.equal(runner.fromLane, 0);
  }
});

test('a lane change eases rather than sliding at constant speed', () => {
  const runner = createRunner();
  changeLane(runner, 1, LANE_COUNT);

  const STEPS = 20;
  const samples = [];
  const progress = [];
  for (let i = 0; i < STEPS; i += 1) {
    stepLane(runner, LANE_CHANGE_TIME / STEPS);
    progress.push(runner.laneProgress);
    samples.push(laneBlend(runner));
  }
  assert.ok(samples[0] < 0.05, `starts from a standstill, got ${samples[0].toFixed(3)}`);
  // Easing means the blend lags the linear progress: behind it early, ahead of it
  // late, and crossing it near the middle. That is the whole claim.
  assert.ok(samples[2] < progress[2],
    `eases out of the first lane, ${samples[2].toFixed(3)} vs linear ${progress[2].toFixed(3)}`);
  assert.ok(samples[samples.length - 3] > progress[progress.length - 3],
    `settles into the last lane, ${samples[samples.length - 3].toFixed(3)} vs linear ${progress[progress.length - 3].toFixed(3)}`);
  assert.equal(samples[samples.length - 1], 1, 'lands');

  // Monotonic: a lane change that overshoots or comes back reads as a glitch.
  for (let i = 1; i < samples.length; i += 1) {
    assert.ok(samples[i] >= samples[i - 1], `never goes backwards, sample ${i}`);
    assert.ok(samples[i] <= 1.0001, `never overshoots, sample ${i}`);
  }
});

test('lane changes do not stack into a teleport', () => {
  const runner = createRunner();
  changeLane(runner, 1, LANE_COUNT);
  stepLane(runner, 0.05);
  // Reverse mid-flight: the runner must come back from where it is, not snap.
  const before = laneOffset(runner);
  assert.ok(before > 1 && before < 2, `caught mid-move at ${before.toFixed(3)}`);
  changeLane(runner, -1, LANE_COUNT);
  const after = laneOffset(runner);
  assert.ok(Math.abs(after - before) < 1e-9, `continues from ${before.toFixed(4)}, jumped to ${after}`);
  assert.equal(runner.lane, 1);
});

test('reversing mid-move returns to the lane the runner started in', () => {
  const runner = createRunner();
  changeLane(runner, 1, LANE_COUNT);
  for (let i = 0; i < 3; i += 1) stepLane(runner, 0.02);
  changeLane(runner, -1, LANE_COUNT);
  for (let i = 0; i < 60; i += 1) stepLane(runner, 1 / 60);
  assert.equal(runner.laneProgress, 1);
  assert.equal(laneOffset(runner), 1, 'ends up back in the middle, not part way off the road');
});

// ---------------------------------------------------------------------- jumping

test('a jump leaves the ground and comes back down', () => {
  const runner = createRunner();
  assert.equal(jump(runner), true);
  assert.ok(runner.jumpTime > 0);

  let peak = 0;
  let guard = 0;
  while (runner.jumpTime > 0 && guard < 600) {
    stepVertical(runner, 1 / 120);
    peak = Math.max(peak, runner.feetY);
    guard += 1;
  }
  assert.ok(peak > 1.0, `reaches a useful height, peaked at ${peak.toFixed(2)}`);
  assert.equal(runner.feetY, 0, 'lands back on the tarmac');
  assert.equal(runner.jumpsUsed, 0, 'the jump allowance resets on landing');
});

test('the jump arc is identical at any frame rate', () => {
  const run = (dt) => {
    const runner = createRunner();
    jump(runner);
    let guard = 0;
    while (guard < 240 && runner.jumpTime > 0) { stepVertical(runner, dt); guard += 1; }
    return runner.feetY;
  };
  for (const dt of [1 / 30, 1 / 60, 1 / 144, 1 / 240]) {
    assert.equal(run(dt), 0, `lands at the same place at ${Math.round(1 / dt)}fps`);
  }
});

test('two jumps are allowed and three are not', () => {
  const runner = createRunner();
  assert.equal(jump(runner), true, 'first jump');
  stepVertical(runner, 0.1);
  assert.equal(jump(runner), true, 'second jump in the air');
  stepVertical(runner, 0.1);
  assert.equal(jump(runner), false, 'a third jump is refused');
  assert.equal(runner.jumpsUsed, MAX_JUMPS);
});

test('a late second jump gains height rather than dropping the runner', () => {
  const runner = createRunner();
  jump(runner);
  stepVertical(runner, JUMP_TIME * 0.92);  // nearly back down
  const before = runner.feetY;
  jump(runner);
  assert.ok(runner.jumpBaseY >= before - 0.01, 'starts from the current height');
  let guard = 0;
  let peak = 0;
  while (guard < 400 && runner.jumpTime > 0) { stepVertical(runner, 1 / 120); peak = Math.max(peak, runner.feetY); guard += 1; }
  assert.ok(peak > before + 0.4, `gains height, from ${before.toFixed(2)} to ${peak.toFixed(2)}`);
});

test('a jump fully clears the highest jumpable obstacle with room to spare', () => {
  const tallest = Math.max(...Object.entries(OBSTACLES)
    .filter(([, shape]) => shape.verb === 'jump')
    .map(([, shape]) => shape.top));
  const runner = createRunner();
  jump(runner);
  // Sample the arc: somewhere there must be a window where the runner is above every
  // jumpable obstacle for long enough to actually be worth timing.
  let window = 0;
  let guard = 0;
  while (guard < 600 && runner.jumpTime > 0) {
    stepVertical(runner, 1 / 120);
    guard += 1;
    const box = bodyBox(runnerSnapshot(runner));
    if (box.bottom > tallest) window += 1 / 120;
  }
  assert.ok(window > 0.2, `clears ${tallest}m for ${window.toFixed(2)}s, needs > 0.2s`);
  assert.ok(JUMP_PEAK > tallest, 'the arc peaks above the tallest hurdle');
});

test('down in the air fast-falls, and on the ground slides', () => {
  const runner = createRunner();
  assert.equal(duck(runner), true, 'grounded down is a slide');
  assert.ok(isSliding(runner));

  const mid = createRunner();
  jump(mid);
  stepVertical(mid, 0.1);
  assert.equal(duck(mid), true, 'airborne down is a fast fall');
  assert.equal(mid.fastFalling, true);
  assert.equal(isSliding(mid), false, 'a fast fall is not a slide');
});

test('a fast fall lands sooner than the same jump without it', () => {
  const timeToLand = (useFastFall) => {
    const runner = createRunner();
    jump(runner);
    stepVertical(runner, 0.12);
    if (useFastFall) duck(runner);
    let guard = 0;
    while (runner.jumpTime > 0 && guard < 600) { stepVertical(runner, 1 / 120); guard += 1; }
    return guard / 120;
  };
  const normal = timeToLand(false);
  const rushed = timeToLand(true);
  assert.ok(rushed < normal * 0.85, `fast fall is quicker, ${rushed.toFixed(2)}s vs ${normal.toFixed(2)}s`);
  assert.ok(normal > JUMP_TIME * 0.7, 'and the normal arc is a plausible jump length');
});

test('jumping outranks sliding', () => {
  const runner = createRunner();
  duck(runner);
  assert.ok(isSliding(runner));
  jump(runner);
  assert.equal(isSliding(runner), false, 'a jump gets you out of a slide');
});

test('a slide ends on its own and cannot be spammed to extend it', () => {
  const runner = createRunner();
  duck(runner);
  assert.equal(duck(runner), false, 'a second press does nothing');
  let guard = 0;
  while (isSliding(runner) && guard < 600) { stepVertical(runner, 1 / 120); guard += 1; }
  assert.ok(!isSliding(runner), 'the slide times out');
});

test('sliding lowers the runner under a banner and standing does not', () => {
  const box = bodyBox(standing);
  assert.ok(box.top > OBSTACLES.gantry.bottom, 'a standing head is inside the banner');
  const low = bodyBox(sliding);
  assert.ok(low.top < OBSTACLES.gantry.bottom, 'a sliding head is under it');
});

// -------------------------------------------------------------------- collision

test('a hurdle blocks a runner on the ground and not one in the air', () => {
  assert.equal(blocksLane('hurdle', 1, 1, standing), true);
  assert.equal(blocksLane('hurdle', 1, 1, { feetY: 0.8, sliding: false }), false);
});

test('a hurdle blocks a runner in any lane when they are in that lane', () => {
  for (let lane = 0; lane < LANE_COUNT; lane += 1) {
    assert.equal(blocksLane('hurdle', lane, lane, standing), true, `hurdle blocks in lane ${lane}`);
    assert.equal(blocksLane('hurdle', lane, lane, { feetY: 0.8, sliding: false }), false, `airborne hurdle miss in lane ${lane}`);
  }
});

test('a gantry blocks a standing runner and not a sliding one', () => {
  assert.equal(blocksLane('gantry', 1, 1, standing), true);
  assert.equal(blocksLane('gantry', 1, 1, sliding), false);
});

test('a gantry cannot be jumped over', () => {
  // It hangs from 0.84 and the runner is 1.46 tall, so standing is blocked, and its
  // top is above the jump peak plus the body, so there is no height to pass over.
  assert.ok(OBSTACLES.gantry.bottom < BODY.standing, 'too low to walk under');
  assert.ok(OBSTACLES.gantry.top > JUMP_PEAK + BODY.standing, 'too tall to jump over');
});

test('a bus cannot be jumped or slid under', () => {
  assert.equal(blocksLane('danfo', 1, 1, standing), true);
  assert.equal(blocksLane('danfo', 1, 1, sliding), true);
  assert.equal(blocksLane('danfo', 1, 1, { feetY: JUMP_PEAK, sliding: false }), true);
});

test('an obstacle in another lane never blocks', () => {
  for (const kind of Object.keys(OBSTACLES)) {
    for (let lane = 0; lane < LANE_COUNT; lane += 1) {
      if (lane === 1) continue;
      assert.equal(blocksLane(kind, lane, 1, standing), false, `${kind} in lane ${lane}`);
    }
  }
});

test('every obstacle in the table has a coherent shape', () => {
  for (const [kind, shape] of Object.entries(OBSTACLES)) {
    assert.ok(shape.top > shape.bottom, `${kind} has height`);
    assert.ok(shape.halfWidth > 0, `${kind} is wider than nothing`);
    // A slide-only obstacle has to stand taller than a jump can lift the runner, so
    // the ceiling is above that, not the 2.5 a jump-only obstacle would need.
    // Every obstacle starts at or below head height, so a slide is never pointless.
    assert.ok(shape.bottom < BODY.standing, `${kind} starts below head height`);
    // And a slide-only obstacle stands above anything a jump can clear.
    assert.ok(shape.verb !== 'slide' || shape.top > JUMP_PEAK + BODY.standing,
      `${kind} cannot be jumped over`);
    assert.ok(shape.length > 0, `${kind} has a length`);
    assert.ok(['jump', 'slide', 'dodge'].includes(shape.verb), `${kind} has a verb`);
  }
});

test('an obstacle never visually reaches into the lane beside it', () => {
  // Collisions are decided by lane index, so an obstacle that spilled into its
  // neighbour would not break the hit test, but it would look wrong: the runner would
  // stand in a clear lane and clip through the side of a bus.
  const laneGap = LANES[1] - LANES[0];
  for (const [kind, shape] of Object.entries(OBSTACLES)) {
    const reaches = LANES[0] + shape.halfWidth;
    const runnerEdge = LANES[1] - BODY.halfWidth;
    assert.ok(reaches < runnerEdge,
      `${kind} stops clear of the next lane, reaches ${reaches.toFixed(2)} vs runner at ${runnerEdge.toFixed(2)}`);
    assert.ok(shape.halfWidth < laneGap, `${kind} is narrower than the lane it sits in`);
  }
});

// ----------------------------------------------------------------------- coins

test('a coin is collected in your own lane and missed from another', () => {
  const coin = { lane: 1, y: 0.85 };
  assert.equal(collectsCoin(coin, 1, standing), true);
  assert.equal(collectsCoin(coin, 0, standing), false);
});

test('a coin above your head or below your feet is missed', () => {
  const box = bodyBox(standing);
  assert.equal(collectsCoin({ lane: 1, y: box.top + 1.5 }, 1, standing), false);
  assert.equal(collectsCoin({ lane: 1, y: box.bottom - 0.6 }, 1, standing), false);
});

test('a coin is collected while sliding at the low height', () => {
  assert.equal(collectsCoin({ lane: 1, y: 0.45 }, 1, sliding), true);
  assert.equal(collectsCoin({ lane: 1, y: 0.45 }, 1, standing), true);
});

// -------------------------------------------------------------------- power-ups

test('power-up timers count down and report what is active', () => {
  const powerups = createPowerups();
  assert.deepEqual(activePowerups(powerups), []);

  powerups.magnet = POWERUPS.magnet.duration;
  powerups.double = POWERUPS.double.duration;
  powerups.board = true;
  assert.equal(activePowerups(powerups).length, 3);

  tickPowerups(powerups, 1);
  assert.ok(powerups.magnet > 0 && powerups.magnet < POWERUPS.magnet.duration);

  tickPowerups(powerups, 60);
  assert.equal(powerups.magnet, 0, 'a timer never goes negative');
  assert.equal(powerups.double, 0);
  assert.deepEqual(activePowerups(powerups), [POWERUPS.board.label], 'the board does not time out');
});

test('every power-up has a duration and a colour', () => {
  for (const kind of POWERUP_KINDS) {
    assert.ok(POWERUPS[kind], `${kind} exists`);
    assert.ok(POWERUPS[kind].duration >= 0);
    assert.match(POWERUPS[kind].pickupColor, /^#[0-9a-f]{6}$/i);
  }
});

// --------------------------------------------------------------------- fairness

test('a lane that mixes a jump and a slide is reported as impossible', () => {
  const need = requiredVerbForLane(1, [
    { lane: 1, kind: 'hurdle' },
    { lane: 1, kind: 'gantry' },
  ]);
  assert.equal(need, 'impossible', 'no single body pose satisfies both');
});

test('a lane blocked by something undodgeable is impossible', () => {
  assert.equal(requiredVerbForLane(0, [{ lane: 0, kind: 'danfo' }]), 'impossible');
});

test('a clear lane needs nothing', () => {
  assert.equal(requiredVerbForLane(2, [{ lane: 0, kind: 'danfo' }]), null);
});

test('every generated row leaves a lane that can be run through', () => {
  // The central fairness promise, checked over a lot of rows at every ramp so it is
  // not just true for the handful the first seed happens to produce.
  let checked = 0;
  for (let seed = 1; seed <= 40; seed += 1) {
    const rng = seeded(seed);
    let previous = '';
    for (let i = 0; i < 60; i += 1) {
      const ramp = i / 60;
      const row = buildRow(ramp, previous, rng);
      previous = row.pattern;

      const verbs = verbsAt(ramp);
      const runnable = [0, 1, 2].some((lane) => {
        const need = requiredVerbForLane(lane, row.obstacles);
        return need === null || (need !== 'impossible' && verbs[need]);
      });
      assert.ok(runnable, `seed ${seed} row ${i} (${row.pattern}) has no way through`);

      // And the stated safe lane must genuinely be safe.
      if (row.clearLanes.length) {
        assert.ok(row.clearLanes.includes(row.safeLane),
          `seed ${seed} safe lane ${row.safeLane} is not actually clear`);
      }
      checked += 1;
    }
  }
  assert.equal(checked, 2400);
});

test('slide rows are held back until the player can slide', () => {
  assert.equal(verbsAt(0).slide, false);
  assert.equal(verbsAt(0.2).slide, true);

  let earlyGantries = 0;
  const rng = seeded(7);
  let previous = '';
  for (let i = 0; i < 200; i += 1) {
    const row = buildRow(0, previous, rng);
    previous = row.pattern;
    if (row.obstacles.some((o) => o.kind === 'gantry')) earlyGantries += 1;
  }
  assert.equal(earlyGantries, 0, 'no banners in the opening stretch');
});

test('a wall row uses one verb consistently', () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const rng = seeded(seed);
    let previous = '';
    for (let i = 0; i < 40; i += 1) {
      const row = buildRow(0.6, previous, rng);
      previous = row.pattern;
      if (row.obstacles.length < LANE_COUNT) continue;
      const kinds = new Set(row.obstacles.map((o) => o.kind));
      assert.equal(kinds.size, 1, `a wall is one obstacle type, got ${[...kinds]}`);
    }
  }
});

test('rows never repeat back to back', () => {
  const rng = seeded(11);
  let previous = '';
  for (let i = 0; i < 200; i += 1) {
    const name = choosePattern(0.7, previous, rng);
    assert.notEqual(name, previous, `row ${i} repeated ${name}`);
    previous = name;
  }
});

test('a long stretch of track stays fair', () => {
  const rows = planTrack(500, 0.5, seeded(99));
  assert.equal(rows.length, 500);
  for (const row of rows) {
    const runnable = [0, 1, 2].some((lane) => {
      const need = requiredVerbForLane(lane, row.obstacles);
      return need === null || need !== 'impossible';
    });
    assert.ok(runnable, `${row.pattern} had no way through`);
  }
});

// ------------------------------------------------------------------ progression

test('speed rises over a run and stops at the cap', () => {
  let speed = RUN.startSpeed;
  assert.equal(speedRamp(speed), 0);
  for (let i = 0; i < 60 * 400; i += 1) speed = nextSpeed(speed, 1 / 60);
  assert.equal(speed, RUN.maxSpeed, 'settles exactly on the cap');
  assert.equal(nextSpeed(RUN.maxSpeed, 1), RUN.maxSpeed, 'and never exceeds it');
  assert.equal(speedRamp(RUN.maxSpeed), 1);
});

test('the ramp is gradual rather than a short burst', () => {
  const atTenSeconds = nextSpeed(RUN.startSpeed, 10);
  // Compare against the speed, not a fraction of the absolute cap: what matters is
  // how much of the *total climb* has happened, and startSpeed is not zero.
  const climb = atTenSeconds - RUN.startSpeed;
  const fraction = climb / (RUN.maxSpeed - RUN.startSpeed);
  assert.ok(fraction < 0.25, `a tenth of the way through the climb covers under a quarter of it, got ${(fraction * 100).toFixed(0)}%`);
  assert.ok(RUN.rampSeconds >= 90, 'the climb is measured in minutes, not seconds');
});

test('rampSeconds and the acceleration rate describe the same climb', () => {
  // nextSpeed integrates rampRate() per second, so over rampSeconds the speed has to
  // travel exactly startSpeed to maxSpeed. If these two drift apart the ramp is not
  // the length it claims and no amount of playing reveals it.
  const span = RUN.maxSpeed - RUN.startSpeed;
  assert.ok(Math.abs(rampRate() * RUN.rampSeconds - span) < 1e-9,
    `rate ${rampRate().toFixed(4)} over ${RUN.rampSeconds}s covers ${(rampRate() * RUN.rampSeconds).toFixed(3)}, expected ${span.toFixed(3)}`);

  // And integrating in real frames must agree with the constant-rate claim.
  let speed = RUN.startSpeed;
  for (let i = 0; i < Math.round(RUN.rampSeconds * 60); i += 1) speed = nextSpeed(speed, 1 / 60);
  assert.ok(Math.abs(speed - RUN.maxSpeed) < 0.01, `reaches the cap, got ${speed.toFixed(3)}`);
});

test('time to the cap agrees with the speed that is left', () => {
  const mid = (RUN.startSpeed + RUN.maxSpeed) / 2;
  assert.ok(Math.abs(timeToCap(RUN.maxSpeed) - 0) < 1e-9, 'already there');
  assert.ok(Math.abs(timeToCap(mid) - (RUN.maxSpeed - mid) / rampRate()) < 1e-9);
});

test('rows get closer together as the run speeds up', () => {
  const early = rowInterval(RUN.startSpeed, 0, false, () => 0);
  const late = rowInterval(RUN.maxSpeed, 1, false, () => 0);
  assert.ok(late < early, `tightens, ${early.toFixed(2)}s -> ${late.toFixed(2)}s`);
  assert.ok(late >= RUN.minGapSeconds, 'never below the floor');
});

test('a recovery row gives you time to finish the verb you just used', () => {
  for (const speed of [RUN.startSpeed, 12, RUN.maxSpeed]) {
    const normal = rowInterval(speed, speedRamp(speed), false, () => 0);
    const recovery = rowInterval(speed, speedRamp(speed), true, () => 0);
    assert.ok(recovery > normal * 1.2, `more room at ${speed.toFixed(1)}u/s`);
  }
});

test('the interval is derived from a distance, so spacing and time cannot drift', () => {
  // Row spacing in the world is gap; the interval is gap / speed. Changing the speed
  // must change the time but not the distance the rows actually sit apart.
  const gapOpen = RUN.gapOpen;
  const gapTight = RUN.gapTight;
  const interval = rowInterval(RUN.maxSpeed, 1, false, () => 0);
  const worldGap = interval * RUN.maxSpeed;
  assert.ok(worldGap > gapTight - 0.01 && worldGap < gapTight + 0.3,
    `tight gap is honoured in world units, got ${worldGap.toFixed(2)}`);
});

test('ramp labels only ever move forward as the run tightens', () => {
  const order = ['WARMING', 'PICKING UP', 'FULL TILT', 'DANFO BLIND'];
  const seen = [];
  let previousIndex = -1;
  for (let i = 0; i <= 100; i += 1) {
    const ramp = i / 100;
    const label = rampLabel(ramp);
    const index = order.indexOf(label);
    assert.ok(index >= 0, `known label at ramp ${ramp}, got ${label}`);
    assert.ok(index >= previousIndex, `never goes backwards, at ramp ${ramp}`);
    previousIndex = index;
    if (seen[seen.length - 1] !== label) seen.push(label);
  }
  assert.deepEqual(seen, order, 'every stage is reached exactly once, in order');
});

// ------------------------------------------------------------------ restartable

test('resetRunner puts everything back, including mid-air and mid-slide state', () => {
  const runner = createRunner();
  runner.lane = 2;
  jump(runner);
  duck(runner);
  stepVertical(runner, 0.2);
  runner.magnet = true;

  resetRunner(runner);
  assert.equal(runner.lane, 1);
  assert.equal(runner.jumpTime, 0);
  assert.equal(runner.slideTime, 0);
  assert.equal(runner.jumpsUsed, 0);
  assert.equal(runner.feetY, 0);
  assert.equal(runner.fastFalling, false);
  assert.equal(runner.magnet, false);
  assert.equal(runner.laneProgress, 1);
});

test('a runner reset mid-air lands cleanly rather than drifting', () => {
  const runner = createRunner();
  jump(runner);
  stepVertical(runner, 0.3);
  resetRunner(runner);
  assert.equal(runner.feetY, 0);
  stepVertical(runner, 1 / 60);
  assert.equal(runner.feetY, 0, 'stays on the ground');
});

test('the runner snapshot reports what the hit test needs', () => {
  const runner = createRunner();
  jump(runner);
  stepVertical(runner, 0.1);
  const snapshot = runnerSnapshot(runner);
  assert.equal(snapshot.sliding, false);
  assert.ok(snapshot.feetY > 0);

  // A fast fall is airborne, not a slide, and the snapshot must say so: mixing the
  // two would let a runner clear a banner by dropping through the air.
  duck(runner);
  assert.equal(runnerSnapshot(runner).sliding, false, 'a fast fall is not a slide');

  let guard = 0;
  while (runner.jumpTime > 0 && guard < 600) { stepVertical(runner, 1 / 120); guard += 1; }
  duck(runner);
  assert.equal(runnerSnapshot(runner).sliding, true, 'reports a ground slide');
});

test('sliding time is long enough to clear a banner at full speed', () => {
  // The banner is 0.6 long and the runner meets it at up to RUN.maxSpeed. If the
  // slide were shorter than the crossing, a correctly timed slide would still fail.
  const crossing = (OBSTACLES.gantry.length + 0.68) / RUN.maxSpeed;
  assert.ok(SLIDE_TIME > crossing * 1.5,
    `slide ${SLIDE_TIME}s covers the ${crossing.toFixed(3)}s crossing`);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { getFallLimit, persistBestScore } from '../src/games/avatar-jump.js';

test('fall threshold follows active platform height', () => {
  assert.equal(getFallLimit({ userData: { top: 7.2 } }), 4.4);
  assert.equal(getFallLimit({ userData: { top: 0 } }), -2.8);
  assert.equal(getFallLimit(null), -2.5);
});

test('fall saves a new high score', () => {
  const writes = [];
  assert.equal(persistBestScore(350, 200, { setItem: (...args) => writes.push(args) }), 350);
  assert.deepEqual(writes, [['arcade:avatar-jump:best', '350']]);
});

test('fall never lowers the saved best', () => {
  assert.equal(persistBestScore(150, 500, { setItem() {} }), 500);
});

test('score persistence tolerates blocked storage', () => {
  assert.equal(persistBestScore(250, 100, null), 250);
  assert.equal(persistBestScore(250, 100, { setItem() { throw new Error('blocked'); } }), 250);
});

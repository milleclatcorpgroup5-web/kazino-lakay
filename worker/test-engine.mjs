import assert from 'node:assert/strict';
import worker, { resolveGame } from './src/index.js';

const cases = {
  crash: { target: 2 }, slots: {}, roulette: { pick: 'red' }, blackjack: { standAt: 17 },
  baccarat: { pick: 'player' }, keno: { numbers: [1, 2, 3, 4, 5] }, dice: { pick: 'over7' },
  mines: { cells: [1, 2] }, plinko: {}, penalty: { shot: 'left' }, coinflip: { pick: 'heads' },
  limbo: { target: 2 }, hilo: { pick: 'high' }, scratch: {}, wheel: {}, sicbo: { pick: 'small' }, casinowar: {}
};

for (const [gameId, choice] of Object.entries(cases)) {
  for (let i = 0; i < 100; i += 1) {
    const output = resolveGame(gameId, 100, choice);
    assert.equal(Number.isInteger(output.payoutPoints), true, `${gameId}: payout must be integer`);
    assert.ok(output.payoutPoints >= 0, `${gameId}: payout cannot be negative`);
    assert.equal(typeof output.result.message, 'string');
    assert.ok(output.result.message.length > 0);
    assert.equal(typeof output.result.animationKey, 'string');
  }
}

assert.throws(() => resolveGame('keno', 100, { numbers: [1, 2, 3, 4] }), /Chwazi egzakteman/);
assert.throws(() => resolveGame('roulette', 100, { pick: 'purple' }), /Chwazi wouj/);
assert.throws(() => resolveGame('mines', 100, { cells: [1, 1] }), /kare diferan/);
assert.throws(() => resolveGame('crash', 100, { target: 99 }), /Objektif Crash/);

const health = await worker.fetch(new Request('https://api.example.test/api/health'), { ALLOWED_ORIGINS: 'https://site.example.test' });
assert.equal(health.status, 200);
assert.deepEqual(await health.json(), { service: 'kazino-lakay-api', status: 'ok', mode: 'points-only', cashValue: false });

console.log(`OK: ${Object.keys(cases).length} jwèt × 100 wonn, validasyon paramèt, ak endpoint health.`);

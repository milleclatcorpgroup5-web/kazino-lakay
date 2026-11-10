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

const env = { ALLOWED_ORIGINS: '' };
const health = await worker.fetch(new Request('https://kazino-lakay.milleclatcorpgroup5.workers.dev/api/health'), env);
assert.equal(health.status, 200);
const healthBody = await health.json();
assert.equal(healthBody.service, 'kazino-lakay');
assert.equal(healthBody.status, 'ok');
assert.equal(healthBody.mode, 'points-only');
assert.equal(healthBody.cashValue, false);
assert.ok(healthBody.endpoints.includes('/api/games/play'));

const rootFallback = await worker.fetch(new Request('https://kazino-lakay.milleclatcorpgroup5.workers.dev/'), env);
assert.equal(rootFallback.status, 200);
assert.equal((await rootFallback.json()).service, 'kazino-lakay');

const sameOriginPost = await worker.fetch(new Request('https://kazino-lakay.milleclatcorpgroup5.workers.dev/api/health', {
  method: 'GET', headers: { Origin: 'https://kazino-lakay.milleclatcorpgroup5.workers.dev' }
}), env);
assert.equal(sameOriginPost.status, 200);
assert.equal(sameOriginPost.headers.get('Access-Control-Allow-Origin'), 'https://kazino-lakay.milleclatcorpgroup5.workers.dev');

const blockedOrigin = await worker.fetch(new Request('https://kazino-lakay.milleclatcorpgroup5.workers.dev/api/health', {
  headers: { Origin: 'https://bad-origin.example' }
}), env);
assert.equal(blockedOrigin.status, 403);

console.log(`OK: ${Object.keys(cases).length} jwèt × 100 wonn, validasyon paramèt, health, root fallback ak CORS.`);

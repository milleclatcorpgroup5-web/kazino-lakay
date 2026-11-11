import assert from 'node:assert/strict';
import worker, { resolveGame } from './src/index.js';
import { GAMES } from '../src/games/catalog.js';
import { readFile } from 'node:fs/promises';

const cases = {
  crash: { target: 2 }, slots: {}, roulette: { pick: 'red' }, blackjack: { standAt: 17 },
  baccarat: { pick: 'player' }, keno: { numbers: [1, 2, 3, 4, 5] }, dice: { pick: 'over7' },
  mines: { cells: [1, 2] }, plinko: {}, penalty: { shot: 'left' }, coinflip: { pick: 'heads' },
  limbo: { target: 2 }, hilo: { pick: 'high' }, scratch: {}, wheel: {}, sicbo: { pick: 'small' }, casinowar: {}
};
const base = 'https://kazino-lakay.milleclatcorpgroup5.workers.dev';
const env = { ALLOWED_ORIGINS: '' };
const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
assert.equal(manifest.display, 'standalone');
assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192'));
assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512'));
const mainHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const adminHtml = await readFile(new URL('../admin.html', import.meta.url), 'utf8');
assert.match(mainHtml, /manifest\.webmanifest/);
assert.match(adminHtml, /src\/admin\.js/);

assert.deepEqual(GAMES.map((game) => game.id), Object.keys(cases), 'Frontend ak backend dwe gen menm 17 jwèt yo nan menm lòd la.');
for (const [gameId, choice] of Object.entries(cases)) {
  for (let i = 0; i < 100; i += 1) {
    const output = resolveGame(gameId, 100, choice);
    assert.equal(Number.isInteger(output.payoutPoints), true, `${gameId}: retou a dwe antye`);
    assert.ok(output.payoutPoints >= 0, `${gameId}: retou pa ka negatif`);
    assert.equal(typeof output.result.message, 'string');
    assert.ok(output.result.message.length > 0);
    assert.equal(output.result.animationKey, gameId);
    if (gameId === 'plinko') {
      assert.equal(output.result.details.path.length, 6, 'Plinko dwe gen sis rebond ak sèt pòch.');
      assert.equal(output.result.details.slot, 1 + output.result.details.path.filter((step) => step === 'R').length, 'Chemen boul la dwe koresponn ak pòch final la.');
    }
    if (gameId === 'blackjack') {
      const cards = [...output.result.details.player, ...output.result.details.dealer];
      assert.equal(new Set(cards).size, cards.length, 'Blackjack pa dwe bay menm kat de fwa nan yon sèl pil.');
    }
    if (gameId === 'baccarat') {
      const cards = [...output.result.details.playerCards, ...output.result.details.bankerCards];
      assert.equal(new Set(cards).size, cards.length, 'Baccarat pa dwe bay menm kat de fwa nan yon sèl pil.');
    }
    if (gameId === 'hilo') assert.notEqual(output.result.details.first, output.result.details.next, 'Hi-Lo dwe tire de kat diferan.');
    if (gameId === 'casinowar') assert.notEqual(output.result.details.playerCard, output.result.details.bankerCard, 'Casino War dwe tire de kat diferan.');
  }
  const demoResponse = await worker.fetch(new Request(`${base}/api/games/demo`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId, stakePoints: 100, choice })
  }), env);
  assert.equal(demoResponse.status, 200, `${gameId}: endpoint demo dwe fonksyone san Firebase`);
  const demo = await demoResponse.json();
  assert.equal(demo.demo, true);
  assert.equal(demo.mode, 'points-only');
  assert.equal(Number.isInteger(demo.result.payoutPoints), true);
}

assert.throws(() => resolveGame('keno', 100, { numbers: [1, 2, 3, 4] }), /Chwazi egzakteman/);
assert.throws(() => resolveGame('roulette', 100, { pick: 'purple' }), /Chwazi wouj/);
assert.throws(() => resolveGame('mines', 100, { cells: [1, 1] }), /kare diferan/);
assert.throws(() => resolveGame('crash', 100, { target: 99 }), /Objektif Crash/);

const invalidStake = await worker.fetch(new Request(`${base}/api/games/demo`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ gameId: 'slots', stakePoints: 1, choice: {} })
}), env);
assert.equal(invalidStake.status, 400, 'Demo pa dwe aksepte pwen ki anba minimòm lan.');

const health = await worker.fetch(new Request(`${base}/api/health`), env);
assert.equal(health.status, 200);
const healthBody = await health.json();
assert.equal(healthBody.service, 'kazino-lakay');
assert.equal(healthBody.status, 'ok');
assert.equal(healthBody.mode, 'points-only');
assert.equal(healthBody.cashValue, false);
assert.equal(healthBody.demoPlayEnabled, true);
assert.equal(healthBody.gamesEnabled, true);
assert.equal(healthBody.gameCount, 17);
assert.equal(healthBody.firebaseConfigured, false);
assert.deepEqual(healthBody.firebaseMissing, ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY']);
assert.equal(healthBody.adminConfigured, false);

const configuredHealth = await worker.fetch(new Request(`${base}/api/health`), {
  FIREBASE_PROJECT_ID: 'kazino-lakay-demo',
  FIREBASE_CLIENT_EMAIL: 'kazino-worker@kazino-lakay-demo.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nTEST_KEY\n-----END PRIVATE KEY-----'
});
const configuredBody = await configuredHealth.json();
assert.equal(configuredBody.firebaseConfigured, true);
assert.deepEqual(configuredBody.firebaseMissing, []);
assert.deepEqual(configuredBody.firebaseInvalid, []);

const gamesResponse = await worker.fetch(new Request(`${base}/api/games`), env);
assert.equal(gamesResponse.status, 200);
const gamesBody = await gamesResponse.json();
assert.equal(gamesBody.count, 17);
assert.deepEqual(gamesBody.games, Object.keys(cases));

for (const path of ['/api/admin/summary', '/api/admin/users', '/api/admin/rounds', '/api/admin/actions']) {
  const denied = await worker.fetch(new Request(`${base}${path}`), env);
  assert.equal(denied.status, 401, `${path} dwe mande yon token Firebase.`);
}
const deniedWrite = await worker.fetch(new Request(`${base}/api/admin/users/update`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: 'somebody', accountStatus: 'suspended', reason: 'test' })
}), env);
assert.equal(deniedWrite.status, 401, 'Aksyon admin dwe pwoteje tou.');

const rootFallback = await worker.fetch(new Request(`${base}/`), env);
assert.equal(rootFallback.status, 200);
assert.equal((await rootFallback.json()).service, 'kazino-lakay');
const sameOrigin = await worker.fetch(new Request(`${base}/api/health`, {
  headers: { Origin: base }
}), env);
assert.equal(sameOrigin.status, 200);
assert.equal(sameOrigin.headers.get('Access-Control-Allow-Origin'), base);
const blockedOrigin = await worker.fetch(new Request(`${base}/api/health`, { headers: { Origin: 'https://bad-origin.example' } }), env);
assert.equal(blockedOrigin.status, 403);

console.log(`OK: ${Object.keys(cases).length} jwèt × 100 rezilta, 17 endpoint DEMO, validasyon, health, lis jwèt, API admin pwoteje ak CORS.`);

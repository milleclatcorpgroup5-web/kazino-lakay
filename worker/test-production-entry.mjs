import assert from 'node:assert/strict';
import worker from './src/production-entry.js';

const base = 'https://kazino-lakay.test';
const env = {
  APP_MODE: 'production',
  DEMO_ENABLED: 'false',
  PAYMENTS_ENABLED: 'false',
  REAL_MONEY_GAMES_ENABLED: 'false'
};

const health = await worker.fetch(new Request(`${base}/api/health`), env);
assert.equal(health.status, 200);
const healthBody = await health.json();
assert.equal(healthBody.mode, 'production');
assert.equal(healthBody.status, 'maintenance');
assert.equal(healthBody.databaseConfigured, false);
assert.equal(healthBody.paymentsEnabled, false);
assert.equal(healthBody.realMoneyGamesEnabled, false);

const games = await worker.fetch(new Request(`${base}/api/games`), env);
assert.equal(games.status, 200);
const gamesBody = await games.json();
assert.equal(gamesBody.mode, 'production');
assert.equal(gamesBody.enabled, false);
assert.equal(gamesBody.count, 0);

for (const path of ['/api/games/demo', '/api/games/play']) {
  const response = await worker.fetch(new Request(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  }), env);
  assert.equal(response.status, 423, `${path} must remain locked`);
  const body = await response.json();
  assert.equal(body.paymentsEnabled, false);
  assert.equal(body.realMoneyGamesEnabled, false);
}

const noAuth = await worker.fetch(new Request(`${base}/api/profile/bootstrap`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}'
}), env);
assert.equal(noAuth.status, 401);

const invalidAuth = await worker.fetch(new Request(`${base}/api/profile/bootstrap`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer invalid.jwt.token' },
  body: '{}'
}), { ...env, FIREBASE_PROJECT_ID: 'test-project' });
assert.equal(invalidAuth.status, 401);

const assetsEnv = { ...env, ASSETS: { fetch: async () => new Response('static asset ok', { status: 200 }) } };
const asset = await worker.fetch(new Request(`${base}/admin.html`), assetsEnv);
assert.equal(asset.status, 200);
assert.equal(await asset.text(), 'static asset ok');

const blockedOrigin = await worker.fetch(new Request(`${base}/api/health`, {
  headers: { Origin: 'https://malicious.example' }
}), env);
assert.equal(blockedOrigin.status, 403);

console.log('Kazino Lakay production entry: health fail-closed, API jwèt fèmen, auth obligatwa, assets routing ak CORS checks OK.');

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { onRequest as gamesRoute } from '../functions/api/games.js';
import { onRequest as demoRoute } from '../functions/api/games/demo.js';
import { onRequest as healthRoute } from '../functions/api/health.js';

const base = 'https://kazino-lakay.pages.dev';
const env = {};

const gamesResponse = await gamesRoute({ request: new Request(base + '/api/games'), env });
assert.equal(gamesResponse.status, 200, 'Pages /api/games route must respond');
const games = await gamesResponse.json();
assert.equal(games.count, 22, 'Pages API must expose all 22 games');
assert.equal(games.enabled, true, 'All games must default to enabled when no admin lock is saved');
assert.equal(games.enabledGameCount, 22, 'All 22 games must be enabled by default');
assert.equal(games.mode, 'points-only');

const demoResponse = await demoRoute({
  request: new Request(base + '/api/games/demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId: 'dice', stakePoints: 100, choice: { pick: 'over7' } })
  }),
  env
});
assert.equal(demoResponse.status, 200, 'Pages demo route must allow a points-only round');
const demo = await demoResponse.json();
assert.equal(demo.demo, true);
assert.equal(demo.mode, 'points-only');
assert.equal(demo.result.animationKey, 'dice');

const healthResponse = await healthRoute({ request: new Request(base + '/api/health'), env });
assert.equal(healthResponse.status, 200, 'Pages health route must respond');

const redirects = await readFile(new URL('../public/_redirects', import.meta.url), 'utf8');
assert.match(redirects, /^\/admin\s+\/admin\.html\s+200/m);
assert.match(redirects, /^\/admin\/\s+\/admin\.html\s+200/m);
const adminHtml = await readFile(new URL('../admin.html', import.meta.url), 'utf8');
assert.match(adminHtml, /src="\/firebase-config\.js"/);
assert.match(adminHtml, /src="\/src\/admin\.js"/);

console.log('Kazino Lakay Pages routing: catalog, demo round, health, admin redirects and same-origin Firebase config OK.');

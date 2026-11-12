import assert from 'node:assert/strict';
import worker, { resolveGame } from './src/index.js';
import { GAMES } from '../src/games/catalog.js';
import { rouletteWheelSvg, renderRouletteScreen } from '../src/games/roulette.js';
import { readFile } from 'node:fs/promises';

const cases = {
  crash: { target: 2, volatility: 'normal' }, slots: {}, roulette: { betType: 'color', betValue: 'red' }, blackjack: { standAt: 17, dealerSoft17: 'stand' },
  baccarat: { pick: 'player' }, keno: { numbers: [1, 2, 3, 4, 5], drawCount: 10 }, dice: { pick: 'over7' },
  mines: { cells: [1, 2], mineCount: 3 }, plinko: { risk: 'normal', rows: 6 }, penalty: { shot: 'top-left', difficulty: 'normal', team: 'haiti', opponent: 'france', power: 0.72 }, coinflip: { pick: 'heads', rounds: 3 },
  limbo: { target: 2 }, hilo: { pick: 'high', risk: 'normal' }, scratch: { risk: 'normal' }, wheel: { risk: 'normal' }, sicbo: { pick: 'small' }, casinowar: { pick: 'player' },
  dragontiger: { pick: 'dragon' }, andarbahar: { pick: 'andar', firstSide: 'andar' }, threecard: { pick: 'player' },
  holdem: { pick: 'player' }, bingo: { pattern: 'row' }
};
const rouletteSvg = rouletteWheelSvg();
assert.equal((rouletteSvg.match(/class="rr-pocket rr-pocket-/g) || []).length, 37, 'Wou SVG a dwe gen 37 pòch Ewopeyen.');
const rouletteUi = renderRouletteScreen({ selection: { type: 'number', value: 0 }, stake: 100, soundOn: true });
assert.match(rouletteUi, /id="roulette-fullscreen"/);
assert.match(rouletteUi, /data-roulette-menu-layer hidden/);
assert.match(rouletteUi, /data-roulette-action="chip" data-chip-value="500"/);
assert.match(rouletteUi, /data-bet-type="parity" data-bet-value="even"/);
const base = 'https://kazino-lakay.milleclatcorpgroup5.workers.dev';
const env = { ALLOWED_ORIGINS: '' };
const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
assert.equal(manifest.display, 'standalone');
assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192'));
assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512'));
const mainHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const viteConfig = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
const serviceWorker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const adminHtml = await readFile(new URL('../admin.html', import.meta.url), 'utf8');
assert.match(mainHtml, /manifest\.webmanifest/);
assert.match(adminHtml, /src\/admin\.js/);
assert.match(viteConfig, /admin: resolve\(here, 'admin\.html'\)/, 'Build la dwe enkli paj admin lan.');
assert.match(viteConfig, /main: resolve\(here, 'index\.html'\)/, 'Build la dwe enkli paj prensipal la.');
assert.ok(await readFile(new URL('../public/icons/icon-192.png', import.meta.url)));
assert.ok(await readFile(new URL('../public/icons/icon-512.png', import.meta.url)));
assert.match(serviceWorker, /'\/admin\.html'/);
assert.match(serviceWorker, /'\/icons\/icon-192\.png'/);

assert.deepEqual(GAMES.map((game) => game.id), Object.keys(cases), 'Frontend ak backend dwe gen menm 22 jwèt yo nan menm lòd la.');
for (const [gameId, choice] of Object.entries(cases)) {
  for (let i = 0; i < 100; i += 1) {
    const output = resolveGame(gameId, 100, choice);
    assert.equal(Number.isInteger(output.payoutPoints), true, `${gameId}: retou a dwe antye`);
    assert.ok(output.payoutPoints >= 0, `${gameId}: retou pa ka negatif`);
    assert.equal(typeof output.result.message, 'string');
    assert.ok(output.result.message.length > 0);
    assert.equal(output.result.animationKey, gameId);
    if (gameId === 'penalty') {
      assert.ok(['top-left','top-center','top-right','middle-left','middle-center','middle-right','bottom-left','bottom-center','bottom-right'].includes(output.result.details.shot));
      assert.ok(['top-left','top-center','top-right','middle-left','middle-center','middle-right','bottom-left','bottom-center','bottom-right'].includes(output.result.details.keeper));
      assert.equal(output.result.details.goal, output.result.details.shot !== output.result.details.keeper);
      assert.notEqual(output.result.details.team, output.result.details.opponent);
    }
    if (gameId === 'plinko') {
      assert.equal(output.result.details.path.length, output.result.details.rows, 'Chemen Plinko a dwe gen kantite liy yo chwazi a.');
      assert.equal(output.result.details.slot, 1 + output.result.details.path.filter((step) => step === 'R').length, 'Chemen boul la dwe koresponn ak pòch final la.');
      assert.equal(output.result.details.multiplier, ({low:[0.8,0.9,1,1.1,1,0.9,0.8],normal:[0,0.2,0.8,1.5,0.8,0.2,0],high:[8,2,0.5,0,0.5,2,8]})[choice.risk][output.result.details.slot-1]);
    }
    if (gameId === 'blackjack') {
      const cards = [...output.result.details.player, ...output.result.details.dealer];
      assert.equal(new Set(cards).size, cards.length, 'Blackjack pa dwe bay menm kat de fwa nan yon sèl pil.');
    }
    if (gameId === 'baccarat') {
      const cards = [...output.result.details.playerCards, ...output.result.details.bankerCards];
      assert.equal(new Set(cards).size, cards.length, 'Baccarat pa dwe bay menm kat de fwa nan yon sèl pil.');
    }
    if (gameId === 'holdem') {
      const cards = [...output.result.details.playerCards, ...output.result.details.bankerCards, ...output.result.details.communityCards];
      assert.equal(cards.length, 9);
      assert.equal(new Set(cards).size, cards.length, 'Texas Hold’em pa dwe bay menm kat de fwa.');
      assert.ok(output.result.details.playerHand && output.result.details.bankerHand);
    }
    if (gameId === 'bingo') {
      const { card, drawn, markedCells } = output.result.details;
      assert.equal(card.length, 25); assert.equal(card[12], 0);
      assert.equal(new Set(card.filter((n) => n > 0)).size, 24);
      assert.equal(drawn.length, 35); assert.equal(new Set(drawn).size, 35);
      assert.ok(markedCells.includes(12), 'Sant Bingo a dwe gratis.');
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


for (const bet of [
  { betType: 'number', betValue: 0 },
  { betType: 'number', betValue: 36 },
  { betType: 'color', betValue: 'red' },
  { betType: 'color', betValue: 'black' },
  { betType: 'parity', betValue: 'even' },
  { betType: 'parity', betValue: 'odd' },
  { betType: 'dozen', betValue: 1 },
  { betType: 'dozen', betValue: 2 },
  { betType: 'dozen', betValue: 3 },
  { betType: 'column', betValue: 1 },
  { betType: 'column', betValue: 2 },
  { betType: 'column', betValue: 3 }
]) {
  for (let i = 0; i < 100; i += 1) {
    const output = resolveGame('roulette', 100, bet);
    const n = output.result.details.number;
    assert.ok(n >= 0 && n <= 36);
    assert.ok(['red','black','green'].includes(output.result.details.color));
    if (bet.betType === 'number') assert.equal(output.result.multiplier, n === bet.betValue ? 36 : 0);
    if (bet.betType === 'color') assert.equal(output.result.multiplier, output.result.details.color === bet.betValue ? 2 : 0);
    if (bet.betType === 'parity') assert.equal(output.result.multiplier, n !== 0 && (n % 2 === 0 ? 'even' : 'odd') === bet.betValue ? 2 : 0);
    if (bet.betType === 'dozen') assert.equal(output.result.multiplier, n > 0 && Math.ceil(n/12) === bet.betValue ? 3 : 0);
    if (bet.betType === 'column') assert.equal(output.result.multiplier, n > 0 && ((n-1)%3)+1 === bet.betValue ? 3 : 0);
  }
}

assert.throws(() => resolveGame('keno', 100, { numbers: [1, 2, 3, 4] }), /Chwazi egzakteman/);
assert.throws(() => resolveGame('roulette', 100, { pick: 'purple' }), /Chwazi wouj/);
assert.throws(() => resolveGame('roulette', 100, { betType: 'number', betValue: 37 }), /nimewo antye/);
assert.throws(() => resolveGame('roulette', 100, { betType: 'color', betValue: 'green' }), /wouj oswa nwa/);
assert.throws(() => resolveGame('roulette', 100, { betType: 'parity', betValue: 'zero' }), /pè oswa enpè/);
assert.throws(() => resolveGame('mines', 100, { cells: [1, 1] }), /kare diferan/);
assert.throws(() => resolveGame('crash', 100, { target: 99 }), /Objektif Crash/);


assert.throws(() => resolveGame('blackjack', 100, { standAt: 17, dealerSoft17: 'invalid' }), /soft 17/);
assert.throws(() => resolveGame('crash', 100, { target: 2, volatility: 'extreme' }), /volatilite Crash/);
assert.throws(() => resolveGame('plinko', 100, { risk: 'normal', rows: 9 }), /6 oswa 8 liy/);
assert.throws(() => resolveGame('dice', 100, { pick: 'exact12' }), /prediksyon Dice/);
assert.throws(() => resolveGame('bingo', 100, { pattern: 'circle' }), /modèl Bingo/);
assert.throws(() => resolveGame('holdem', 100, { pick: 'invalid' }), /Chwazi Jwè/);
assert.throws(() => resolveGame('penalty', 100, { shot: 'outside', difficulty: 'normal' }), /9 zòn/);
assert.throws(() => resolveGame('penalty', 100, { shot: 'top-left', difficulty: 'normal', power: 1.5 }), /Pisans tir la/);
assert.throws(() => resolveGame('penalty', 100, { shot: 'top-left', difficulty: 'normal', team: 'unknown' }), /ekip ki disponib/);
const plinkoEight = resolveGame('plinko', 100, { risk: 'high', rows: 8 });
assert.equal(plinkoEight.result.details.path.length, 8);
assert.equal(plinkoEight.result.details.slot, 1 + plinkoEight.result.details.path.filter((step) => step === 'R').length);
for (const pattern of ['row','column','diagonal','corners']) assert.equal(resolveGame('bingo', 100, { pattern }).result.details.pattern, pattern);
for (const selection of ['player','banker','tie']) {
  const war = resolveGame('casinowar', 100, { pick: selection });
  assert.ok(['player','banker','tie'].includes(war.result.details.winner));
  if (war.result.details.winner === 'tie' && selection !== 'tie') assert.equal(war.result.multiplier, 1);
}

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
assert.equal(healthBody.gameCount, 22);
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
assert.equal(configuredBody.gameControlReadOk, false);
assert.match(configuredBody.gameControlReadError || '', /FIREBASE_PRIVATE_KEY|Service Account|Firestore|OAuth|backend/i);
assert.equal(JSON.stringify(configuredBody).includes('TEST_KEY'), false, 'Health pa dwe ekspoze kle prive a.');
const brokenGamesResponse = await worker.fetch(new Request(`${base}/api/games`), {
  FIREBASE_PROJECT_ID: 'kazino-lakay-demo',
  FIREBASE_CLIENT_EMAIL: 'kazino-worker@kazino-lakay-demo.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nTEST_KEY\n-----END PRIVATE KEY-----'
});
assert.equal(brokenGamesResponse.status, 503, 'Backend Firestore la dwe bay yon erè sèvis eksplisit, pa yon 500 jenerik.');
const brokenGamesBody = await brokenGamesResponse.json();
assert.match(brokenGamesBody.error || '', /FIREBASE_PRIVATE_KEY|Service Account|Firestore|OAuth/i);
assert.equal(JSON.stringify(brokenGamesBody).includes('TEST_KEY'), false, 'API jwèt la pa dwe ekspoze kle prive a.');

const gamesResponse = await worker.fetch(new Request(`${base}/api/games`), env);
assert.equal(gamesResponse.status, 200);
const gamesBody = await gamesResponse.json();
assert.equal(gamesBody.count, 22);
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

console.log(`OK: ${Object.keys(cases).length} jwèt × 100 rezilta, nouvo Texas Hold’em/Bingo, parye roulèt, endpoint DEMO, validasyon, health, lis jwèt, API admin ak CORS.`);

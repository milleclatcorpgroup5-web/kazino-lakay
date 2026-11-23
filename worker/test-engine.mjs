import assert from 'node:assert/strict';
import worker, { resolveGame } from './src/index.js';
import { GAMES } from '../src/games/catalog.js';
import { rouletteWheelSvg, renderRouletteScreen } from '../src/games/roulette.js';
import { readFile } from 'node:fs/promises';

const cases = {
  crash: { target: 2, volatility: 'high' },
  slots: { risk: 'high' },
  roulette: { betType: 'color', betValue: 'red' },
  blackjack: { standAt: 19, dealerSoft17: 'hit' },
  baccarat: { pick: 'player' },
  keno: { numbers: [1, 2, 3, 4, 5], drawCount: 5 },
  dice: { pick: 'over7' },
  mines: { cells: [1, 2], mineCount: 8 },
  plinko: { risk: 'high', rows: 6 },
  penalty: { shot: 'top-left', difficulty: 'hard', team: 'haiti', opponent: 'france', power: 0.72 },
  coinflip: { pick: 'heads', rounds: 3 },
  limbo: { target: 2 },
  hilo: { pick: 'high', risk: 'high' },
  scratch: { risk: 'high' },
  wheel: { risk: 'high' },
  sicbo: { pick: 'small' },
  casinowar: { pick: 'player' },
  dragontiger: { pick: 'dragon' },
  andarbahar: { pick: 'andar', firstSide: 'andar' },
  threecard: { pick: 'player' },
  holdem: { pick: 'player' },
  bingo: { pattern: 'row' }
};

const base = 'https://kazino-lakay.milleclatcorpgroup5.workers.dev';
const env = { ALLOWED_ORIGINS: '' };

const rouletteSvg = rouletteWheelSvg();
assert.equal((rouletteSvg.match(/class="rr-pocket rr-pocket-/g) || []).length, 37, 'Wou Ewopeyen an dwe gen 37 pòch.');
const rouletteUi = renderRouletteScreen({ selection: { type: 'number', value: 0 }, stake: 100, soundOn: true });
assert.match(rouletteUi, /id="roulette-fullscreen"/);
assert.match(rouletteUi, /data-roulette-menu-layer hidden/);
assert.match(rouletteUi, /data-roulette-action="chip" data-chip-value="500"/);
assert.match(rouletteUi, /data-bet-type="parity" data-bet-value="even"/);

const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
assert.equal(manifest.display, 'standalone');
assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192'));
assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512'));

const mainHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const viteConfig = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
const serviceWorker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const adminHtml = await readFile(new URL('../admin.html', import.meta.url), 'utf8');
const firestoreRules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const firebaseJson = JSON.parse(await readFile(new URL('../firebase.json', import.meta.url), 'utf8'));
const workerSource = await readFile(new URL('./src/index.js', import.meta.url), 'utf8');
const adminSource = await readFile(new URL('../src/admin.js', import.meta.url), 'utf8');
const playerSource = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
assert.match(mainHtml, /manifest\.webmanifest/);
assert.match(adminHtml, /src\/admin\.js/, 'Admin HTML dwe sèvi ak entèfas administrasyon points-only la.');
assert.match(workerSource, /requestUrl\.pathname === '\/admin'/, 'Worker dwe sèvi admin dirèkteman san redirect.');
assert.match(adminHtml, /noindex,nofollow/);
assert.match(firestoreRules, /match \/walletAccounts\/{uid}/);
assert.match(firestoreRules, /match \/walletTransactions\/{transactionId}/);
assert.match(firestoreRules, /allow read, write: if false/);
assert.equal(firebaseJson.firestore.indexes, 'firestore-indexes.json', 'Firebase CLI dwe jwenn bon non fichye index la.');
assert.match(workerSource, /platformWallet\/main/);
assert.match(workerSource, /walletAccounts/);
assert.match(workerSource, /walletTransactions/);
assert.match(workerSource, /api\/admin\/setup/);
assert.match(workerSource, /api\/admin\/wallet/);
assert.match(workerSource, /api\/wallet/);
assert.match(adminSource, /Kont pwen platfòm nan/);
assert.match(playerSource, /data-action="wallet"/);
assert.ok(viteConfig.includes("main: resolve(here, 'index.html')"), 'Build la dwe enkli paj prensipal la.');
assert.ok(viteConfig.includes("admin: resolve(here, 'admin.html')"), 'Build la dwe enkli paj admin lan.');
assert.ok(await readFile(new URL('../public/icones/icon-192.png', import.meta.url)));
assert.ok(await readFile(new URL('../public/icones/icon-512.png', import.meta.url)));
assert.match(serviceWorker, /'\/admin'/);
assert.match(serviceWorker, /'\/admin\.html'/);
assert.match(serviceWorker, /'\/icones\/icon-192\.png'/);

assert.deepEqual(GAMES.map((game) => game.id), Object.keys(cases), 'Frontend ak backend dwe gen menm 22 jwèt yo nan menm lòd la.');

for (const [gameId, choice] of Object.entries(cases)) {
  for (let i = 0; i < 100; i += 1) {
    const output = resolveGame(gameId, 100, choice);
    assert.equal(Number.isInteger(output.payoutPoints), true, `${gameId}: retou a dwe antye.`);
    assert.ok(output.payoutPoints >= 0, `${gameId}: retou pa ka negatif.`);
    assert.equal(typeof output.result.message, 'string');
    assert.ok(output.result.message.length > 0);
    assert.equal(output.result.animationKey, gameId);
    if (gameId === 'penalty') {
      const zones = ['top-left','top-center','top-right','middle-left','middle-center','middle-right','bottom-left','bottom-center','bottom-right'];
      assert.ok(zones.includes(output.result.details.shot));
      assert.ok(zones.includes(output.result.details.keeper));
      assert.equal(output.result.details.goal, output.result.details.shot !== output.result.details.keeper);
      assert.notEqual(output.result.details.team, output.result.details.opponent);
    }
    if (gameId === 'plinko') {
      assert.equal(output.result.details.path.length, output.result.details.rows);
      assert.equal(output.result.details.slot, 1 + output.result.details.path.filter((step) => step === 'R').length);
    }
    if (gameId === 'blackjack') {
      const cards = [...output.result.details.player, ...output.result.details.dealer];
      assert.equal(new Set(cards).size, cards.length, 'Blackjack pa dwe repete kat nan menm pil la.');
    }
    if (gameId === 'baccarat') {
      const cards = [...output.result.details.playerCards, ...output.result.details.bankerCards];
      assert.equal(new Set(cards).size, cards.length, 'Baccarat pa dwe repete kat.');
    }
    if (gameId === 'holdem') {
      const cards = [...output.result.details.playerCards, ...output.result.details.bankerCards, ...output.result.details.communityCards];
      assert.equal(cards.length, 9);
      assert.equal(new Set(cards).size, cards.length, 'Texas Hold’em pa dwe repete kat.');
      assert.ok(output.result.details.playerHand && output.result.details.bankerHand);
    }
    if (gameId === 'bingo') {
      const { card, drawn, markedCells } = output.result.details;
      assert.equal(card.length, 25);
      assert.equal(card[12], 0);
      assert.equal(new Set(card.filter((n) => n > 0)).size, 24);
      assert.equal(drawn.length, 35);
      assert.equal(new Set(drawn).size, 35);
      assert.ok(markedCells.includes(12));
    }
    if (gameId === 'hilo') assert.notEqual(output.result.details.first, output.result.details.next);
    if (gameId === 'casinowar') assert.notEqual(output.result.details.playerCard, output.result.details.bankerCard);
  }

  const demoResponse = await worker.fetch(new Request(`${base}/api/games/demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId, stakePoints: 100, choice })
  }), env);
  assert.equal(demoResponse.status, 200, `${gameId}: endpoint demo dwe reponn 200.`);
  const demo = await demoResponse.json();
  assert.equal(demo.demo, true);
  assert.equal(demo.mode, 'points-only');
  assert.ok(demo.result && typeof demo.result.message === 'string');
}

const healthResponse = await worker.fetch(new Request(`${base}/api/health`), env);
assert.equal(healthResponse.status, 200);
const health = await healthResponse.json();
assert.equal(health.status, 'ok');
assert.equal(health.mode, 'points-only');
assert.equal(health.cashValue, false);
assert.equal(health.gameCount, 22);

const gamesResponse = await worker.fetch(new Request(`${base}/api/games`), env);
assert.equal(gamesResponse.status, 200);
const gamesPayload = await gamesResponse.json();
assert.equal(gamesPayload.count, 22);

const firebaseConfigResponse = await worker.fetch(new Request(`${base}/firebase-config.js`), env);
assert.equal(firebaseConfigResponse.status, 200);
assert.match(await firebaseConfigResponse.text(), /window\.__KL_FIREBASE_CONFIG__/);

const protectedAdmin = await worker.fetch(new Request(`${base}/api/admin/summary`), env);
assert.equal(protectedAdmin.status, 401, 'Admin dwe mande idantifikasyon.');
const protectedWallet = await worker.fetch(new Request(`${base}/api/admin/wallet`), env);
assert.equal(protectedWallet.status, 401, 'Bous platfòm nan dwe mande aksè admin.');
const protectedSetup = await worker.fetch(new Request(`${base}/api/admin/setup`, { method: 'POST' }), env);
assert.equal(protectedSetup.status, 401, 'Firestore bootstrap dwe mande aksè admin.');
const protectedPlayerWallet = await worker.fetch(new Request(`${base}/api/wallet`), env);
assert.equal(protectedPlayerWallet.status, 401, 'Bous jwè a dwe mande koneksyon.');

const oversizedDemo = await worker.fetch(new Request(`${base}/api/games/demo`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ gameId: 'crash', stakePoints: 1001, choice: { target: 2, volatility: 'high' } })
}), env);
assert.equal(oversizedDemo.status, 400, 'Limit 1 000 pwen demo a dwe aplike sou sèvè a.');

console.log(`Kazino Lakay 1.9.0: ${Object.keys(cases).length} jwèt × 100 tès + API, admin separe, bous/ledger, Firestore rules, ikon ak manifest OK.`);

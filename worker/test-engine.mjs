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
assert.match(mainHtml, /manifest\.webmanifest/);
assert.match(adminHtml, /src\/admin\.js/);
assert.ok(viteConfig.includes("main: resolve(here, 'index.html')"), 'Build la dwe enkli paj prensipal la.');
assert.ok(viteConfig.includes("admin: resolve(here, 'admin.html')"), 'Build la dwe enkli paj admin lan.');
assert.ok(await readFile(new URL('../public/icones/icon-192.png', import.meta.url)));
assert.ok(await readFile(new URL('../public/icones/icon-512.png', import.meta.url)));
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

const oversizedDemo = await worker.fetch(new Request(`${base}/api/games/demo`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ gameId: 'crash', stakePoints: 1001, choice: { target: 2, volatility: 'high' } })
}), env);
assert.equal(oversizedDemo.status, 400, 'Limit 1 000 pwen demo a dwe aplike sou sèvè a.');

console.log(`Kazino Lakay: ${Object.keys(cases).length} jwèt × 100 tès + API, sekirite debaz, ikon ak manifest OK.`);

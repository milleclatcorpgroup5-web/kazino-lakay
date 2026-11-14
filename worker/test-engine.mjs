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
assert.match(viteConfig, /admin: resolvehere, 'admin\.html'/, 'Build la dwe enkli paj admin lan.');
assert.match(viteConfig, /main: resolvehere, 'index\.html'/, 'Build la dwe enkli paj prensipal la.');

// CHEMEN IKON YO KORIJЕ: icones olye icons
assert.ok(await readFile(new URL('../public/icones/icon-192.png', import.meta.url)));
assert.ok(await readFile(new URL('../public/icones/icon-512.png', import.meta.url)));
assert.match(serviceWorker, /'\/admin\.html'/);
assert.match(serviceWorker, /'\/icones\/icon-192\.png'/);

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
      assert.equal(card.length, 25);
      assert.equal(card[12], 0);
      assert.equal(new Set(card.filter((n) => n > 0)).size, 24);
      assert.equal(drawn.length, 35);
      assert.equal(new Set(drawn).size, 35);
      assert.ok(markedCells.includes(12), 'Sant Bingo a dwe gratis.');
    }

    if (gameId === 'hilo') assert.notEqual(output.result.details.first, output.result.details.next, 'Hi-Lo dwe tire de kat diferan.');
    if (gameId === 'casinowar') assert.notEqual(output.result.details.playerCard, output.result.details.bankerCard, 'Casino War dwe tire de kat diferan.');
  }

  const demoResponse = await worker.fetch(new Request(`${base}/api/games/demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId, stakePoints: 100, choice })
  }), env);

  assert.equal(demoResponse.status, 200, `${gameId}: endpoint

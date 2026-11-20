import assert from 'node:assert/strict';

const close = (actual, expected, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `Expected ${actual} to be within ${tolerance} of ${expected}`);

const choose = (n, k) => {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= k; i += 1) result = result * (n - i + 1) / i;
  return result;
};

// These functions independently reproduce the former V1.9 point-engine
// paytables for an audit. They are NOT imported by the Production API and
// must never be used to settle Production game rounds.

function kenoRtp(drawCount, paytable) {
  let expected = 0;
  const denominator = choose(25, drawCount);
  for (let hits = 0; hits <= 5; hits += 1) {
    const probability = choose(5, hits) * choose(20, drawCount - hits) / denominator;
    expected += probability * (paytable[hits] || 0);
  }
  return expected;
}

function plinkoRtp(rows, paytable) {
  return paytable.reduce((total, multiplier, rightMoves) =>
    total + choose(rows, rightMoves) * multiplier, 0) / (2 ** rows);
}

function slotsRtp(symbolCount, pairMultiplier, tripleMultiplier, specialTripleMultiplier = null) {
  let total = 0;
  for (let symbol = 0; symbol < symbolCount; symbol += 1) {
    total += (specialTripleMultiplier !== null && symbol === 4
      ? specialTripleMultiplier : tripleMultiplier);
  }
  total += symbolCount * (symbolCount - 1) * 3 * pairMultiplier;
  return total / (symbolCount ** 3);
}

function minesRtp(mineCount, selectedCount) {
  let survivalProbability = 1;
  for (let i = 0; i < selectedCount; i += 1) {
    survivalProbability *= (25 - mineCount - i) / (25 - i);
  }
  const grossMultiplier = (25 / (25 - mineCount)) ** selectedCount *
    (1 - selectedCount * 0.018);
  return survivalProbability * grossMultiplier;
}

function diceRtp(hitCount, grossMultiplier) {
  return hitCount / 36 * grossMultiplier;
}

// Roulette: one chosen number (36x gross) or one outside color (18/37 outcomes, 2x gross).
close(36 / 37, 0.972972972972973);
close((18 / 37) * 2, 0.972972972972973);

// Keno: exact hypergeometric distribution for five picks from 25 numbers.
close(kenoRtp(5, { 1: 0.5, 2: 1.5, 3: 4, 4: 8, 5: 15 }), 0.708216, 1e-6);
close(kenoRtp(10, { 3: 1, 4: 2, 5: 5 }), 0.379447, 1e-6);
close(kenoRtp(15, { 3: 0.5, 4: 1, 5: 2 }), 0.562648, 1e-6);

// Dice: two fair six-sided dice, payouts interpreted as gross returns.
close(diceRtp(15, 2.4), 1);
close(diceRtp(5, 6.8), 0.9444444444444444);
close(diceRtp(6, 6), 1);
close(diceRtp(4, 9), 1);
close(diceRtp(3, 12), 1);
close(diceRtp(2, 18), 1);

// Slots and scratch: exact ordered triples from equally likely symbols.
close(slotsRtp(3, 1.3, 3), 1.2);
close(slotsRtp(6, 1.5, 5, 10), 170 / 216);
close(slotsRtp(8, 0, 8, 20), 76 / 512);
close(slotsRtp(3, 1.2, 3), 34 / 30);
close(slotsRtp(6, 1.2, 4), 132 / 216);
close(slotsRtp(8, 0, 12), 96 / 512);

// Plinko: left/right choices are equiprobable, giving a binomial slot distribution.
close(plinkoRtp(6, [0.8,0.9,1,1.1,1,0.9,0.8]), 1.00625);
close(plinkoRtp(6, [0,0.2,0.8,1.5,0.8,0.2,0]), 0.88125);
close(plinkoRtp(6, [8,2,0.5,0,0.5,2,8]), 0.859375);
close(plinkoRtp(8, [0.7,0.8,0.9,1,1.1,1,0.9,0.8,0.7]), 0.990625);
close(plinkoRtp(8, [0,0.1,0.3,0.8,1.5,0.8,0.3,0.1,0]), 0.83203125);
close(plinkoRtp(8, [12,4,1,0.3,0,0.3,1,4,12]), 0.69375);

// Mines: exact probability of avoiding mines, multiplied by the current gross return.
close(minesRtp(1, 1), 0.982);
close(minesRtp(3, 5), 0.8546825396825397);
close(minesRtp(10, 5), 0.6614557823129252);

// Penalty: the current engine returns 2x gross on a goal.
close((1 - 1 / 9) * 2, 16 / 9);
close((1 - 2 / 9) * 2, 14 / 9);
close((1 - 1 / 3) * 2, 4 / 3);

// Three-card/one-deck rank probabilities for Hi-Lo and head-to-head ties.
close((8 / 17) * 1.9, 0.8941176470588236);
close((8 / 17) * 2.4, 1.1294117647058823);
close((1 / 17) * 12, 12 / 17);
close((8 / 17) * 2 + (1 / 17), 1);
close((8 / 17) * 2, 16 / 17);

// Crash: reproduce the one-million-point integer RNG and two-decimal result rounding.
const targets = [1.2, 1.5, 2, 3, 5];
for (const [risk, exponent, expected] of [
  ['low', 1.6, [1.082233,1.236495,1.45645,1.740627,1.76043]],
  ['normal', 2.1, [0.995327,1.101321,1.258774,1.451508,1.40777]],
  ['high', 2.7, [0.896783,0.964813,1.075842,1.206366,1.13387]]
]) {
  const wins = Array(targets.length).fill(0);
  for (let raw = 0; raw < 1_000_000; raw += 1) {
    const crashAt = Math.max(1, Number((1 + (raw / 1_000_000) ** exponent * 8).toFixed(2)));
    targets.forEach((target, index) => { if (crashAt >= target) wins[index] += 1; });
  }
  wins.forEach((count, index) => close(count / 1_000_000 * targets[index], expected[index], 0.00002));
}

// Limbo: cap at 50x and two-decimal rounding move the expected gross return above 100%.
for (const [target, expected] of [
  [1.1,1.004567],[1.5,1.003346],[2,1.002508],[5,1.001005],[10,1.00051],[20,1.00026]
]) {
  let wins = 0;
  for (let raw = 0; raw < 1_000_000; raw += 1) {
    const result = Math.max(1, Math.min(50,
      Number((1 / Math.max(0.0001, raw / 1_000_000)).toFixed(2))));
    if (result >= target) wins += 1;
  }
  close(wins / 1_000_000 * target, expected, 0.00002);
}

console.log('Production Phase 4 math audit: exact legacy paytable calculations reproduced. These figures are diagnostics only; Production games remain locked.');

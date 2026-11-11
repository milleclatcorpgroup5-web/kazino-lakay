import './style.css';
import { GAMES, CATEGORIES } from './games/catalog.js';
import { firebaseReady, firebaseMissing, auth } from './firebase.js';
import { watchAuth, registerAccount, loginAccount, logoutAccount, resendVerification } from './auth.js';
import { api } from './api.js';
import { renderRouletteScreen, rouletteCardIcon, rouletteResultMarkup, animateRouletteSpin, playRouletteSound } from './games/roulette.js';

const root = document.querySelector('#app');
const state = { user: null, profile: null, health: null, category: 'Tout jwèt', query: '', activeGame: null, selected: new Set(), busy: false, installPrompt: null, rouletteStake: 100, rouletteBet: null, rouletteMenuOpen: false, rouletteSoundOn: true, rouletteBusy: false, rouletteResult: null, gameStake: 100, gameMenuOpen: false, gameSoundOn: true, gameResult: null };
const esc = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const fmt = (n = 0) => Math.floor(Number(n) || 0).toLocaleString('fr-FR');

function toast(message, type = 'info') {
  const node = document.querySelector('#toast');
  if (!node) return;
  node.textContent = message;
  node.dataset.type = type;
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 3200);
}

function stageCard(value = '—', hidden = false) {
  if (hidden) return '<span class="playing-card card-back"><i>KL</i></span>';
  const raw = String(value || '—');
  const suit = raw.slice(-1);
  const rank = raw.slice(0, -1) || '—';
  const red = suit === '♥' || suit === '♦';
  return `<span class="playing-card ${red ? 'card-red' : 'card-black'}"><b>${esc(rank)}</b><i>${esc(suit)}</i><small>${esc(rank)}${esc(suit)}</small></span>`;
}

function dieFace(value = 1) {
  const patterns = {
    1: [0,0,0,0,1,0,0,0,0],
    2: [1,0,0,0,0,0,0,0,1],
    3: [1,0,0,0,1,0,0,0,1],
    4: [1,0,1,0,0,0,1,0,1],
    5: [1,0,1,0,1,0,1,0,1],
    6: [1,0,1,1,0,1,1,0,1]
  };
  return `<span class="die-face" aria-label="Zo ${value}">${(patterns[value] || patterns[1]).map((on) => `<i class="${on ? 'pip' : ''}"></i>`).join('')}</span>`;
}

function stageFrame(gameId, heading, subheading, content, phase = 'idle') {
  return `<section class="casino-stage stage-${gameId} phase-${phase}" data-game-stage="${gameId}" data-phase="${phase}" aria-label="Tab jwèt ${esc(heading)}">
    <div class="stage-topline"><span class="stage-live"><i></i>${phase === 'rolling' ? 'ANIMASYON AN KOU' : phase === 'settled' ? 'REZILTA KONFIME' : 'TAB JWÈT'}</span><span class="stage-game-name">${esc(heading)}</span></div>
    <div class="stage-visual">${content}</div>
    <div class="stage-caption"><strong>${esc(heading)}</strong><span>${esc(subheading)}</span></div>
  </section>`;
}

function renderGameStage(gameId, details = null, phase = 'idle') {
  const d = details || {};
  const isRolling = phase === 'rolling';
  switch (gameId) {
    case 'crash': {
      const mult = details ? `${Number(d.crashAt || 1).toFixed(2)}×` : '1.00×';
      const target = details ? `${Number(d.target || 2).toFixed(2)}×` : '2.00×';
      return stageFrame(gameId, 'Vòl Eksprès', 'Gade avyon an monte sou koub la. Rezilta a soti nan sèvè a.', `<div class="crash-screen"><div class="crash-readout"><small>MILTILIKATÈ</small><strong class="stage-result">${mult}</strong><span>OBJEKTIF ${target}</span></div><svg class="crash-chart" viewBox="0 0 520 190" role="img" aria-label="Grafik vòl"><defs><linearGradient id="crashFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#43efcb" stop-opacity=".42"/><stop offset="1" stop-color="#43efcb" stop-opacity="0"/></linearGradient></defs><path class="chart-grid" d="M0 38H520M0 86H520M0 134H520M80 0V190M180 0V190M280 0V190M380 0V190M480 0V190"/><path class="crash-area" d="M0 178 C70 175 82 158 130 155 S205 130 240 122 S300 92 330 88 S405 43 520 12 L520 190 L0 190Z"/><path class="crash-line" d="M0 178 C70 175 82 158 130 155 S205 130 240 122 S300 92 330 88 S405 43 520 12"/><g class="crash-plane"><text x="0" y="0">✈</text></g></svg><div class="crash-foot"><span>● LIVE SIMILASYON</span><span>${details ? `${d.reached ? 'OBJEKTIF ATENN' : 'VÒL LA FINI'} • ${String(d.volatility || 'normal').toUpperCase()}` : 'AP PREPARE'}</span></div></div>`, phase);
    }
    case 'slots': {
      const symbols = d.symbols || ['🍒', '🔔', '💎'];
      return stageFrame(gameId, 'Slots — Fwi an Lò', 'Twa bobin mekanik ak senbòl ki revele youn apre lòt.', `<div class="slots-cabinet"><div class="slots-marquee">✦ FWI AN LÒ ✦ <small>JACKPOT ROOM</small></div><div class="slots-frame">${symbols.map((symbol, i) => `<div class="slot-reel"><div class="reel-ghost">${['⭐','🍋','🔔'][i]}</div><div class="reel-symbol stage-result">${esc(symbol)}</div><div class="reel-ghost">${['💎','🍒','7️⃣'][i]}</div></div>`).join('')}</div><div class="slots-lights"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="slots-status">${details ? (Number(d.multiplier) > 0 ? `KONBO: ${Number(d.multiplier).toFixed(1)}× • ${String(d.risk || 'normal').toUpperCase()}` : `PA GEN KONBO • ${String(d.risk || 'normal').toUpperCase()}`) : 'CHWAZI POU W VIRE BOBIN YO'}</div></div>`, phase);
    }
    case 'roulette': {
      const n = details ? Number(d.number) : 0;
      const color = details ? d.color : 'green';
      const reds = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
      const nums = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
      return stageFrame(gameId, 'Roulèt Royal', 'Wou Ewopeyen 37 pòch la vire epi boul la sispann sou yon nimewo.', `<div class="roulette-table"><div class="roulette-wheel-wrap"><div class="roulette-pointer"></div><div class="roulette-wheel"><div class="roulette-pockets">${nums.map((num,i)=>`<i style="--i:${i}" class="${num === 0 ? 'pocket-green' : reds.has(num) ? 'pocket-red' : 'pocket-black'}">${num}</i>`).join('')}</div><div class="roulette-hub"><small>ROYAL</small><strong class="stage-result">${details ? n : '00'}</strong><span>${details ? color.toUpperCase() : 'SPIN'}</span></div></div><div class="roulette-ball"></div></div><div class="roulette-footer"><span>EUROPEAN ROULETTE</span><b class="stage-result">${details ? `${n} · ${color.toUpperCase()}` : '0 — 36'}</b></div></div>`, phase);
    }
    case 'holdem': {
      const player = d.playerCards || [];
      const banker = d.bankerCards || [];
      const community = d.communityCards || [];
      const cards = (arr, count) => Array.from({length:count},(_,index)=>arr[index] ? stageCard(arr[index]) : stageCard('',true)).join('');
      return stageFrame(gameId, 'Texas Hold’em', 'De kat prive pou chak bò, senk kat kominotè, epi pi bon men senk kat la.', `<div class="holdem-table"><div class="holdem-brand">KAZINO LAKAY <span>NO-LIMIT HOLD’EM • DEMO TABLE</span></div><section class="holdem-player"><header><b>JWÈ</b><strong>${esc(d.playerHand || 'MEN OU')}</strong></header><div class="holdem-hole-cards">${cards(player,2)}</div></section><section class="holdem-board"><small>KAT KOMINOTÈ</small><div>${cards(community,5)}</div></section><section class="holdem-player holdem-banker"><header><b>BANKYE</b><strong>${esc(d.bankerHand || 'MEN BANKYE')}</strong></header><div class="holdem-hole-cards">${cards(banker,2)}</div></section><footer>${details ? `${String(d.winner || '').toUpperCase()} • MEN YO KONPARE` : 'PREPARE POU FLOP • TURN • RIVER'}</footer></div>`, phase);
    }
    case 'bingo': {
      const card = d.card || [1,16,31,46,61,2,17,32,47,62,3,18,0,48,63,4,19,33,49,64,5,20,34,50,65];
      const called = new Set(d.drawn || []);
      const marked = new Set(d.markedCells || []);
      const balls = (d.drawn || []).slice(-16);
      return stageFrame(gameId, 'Bingo Lakay', 'Kat 5×5 la ap make nimewo ki soti nan tiraj 1–75 la.', `<div class="bingo-table"><div class="bingo-header"><strong>BINGO LAKAY</strong><span>${details ? `${d.completedPatterns?.length || 0} MODÈL KONPLÈ` : '35 BOUL • 1–75'}</span></div><div class="bingo-letters"><b>B</b><b>I</b><b>N</b><b>G</b><b>O</b></div><div class="bingo-card-grid">${card.map((number,index)=>`<span class="bingo-cell ${number===0?'is-free':''} ${marked.has(index)||number===0?'is-marked':''} ${called.has(number)&&number!==0?'is-called':''}">${number===0?'KL':number}</span>`).join('')}</div><div class="bingo-draw-history"><small>DÈNYE BOUL KI SOTI</small><div>${balls.map((number)=>`<i>${number}</i>`).join('') || '<span>AP TANN TIRAJ LA</span>'}</div></div><div class="bingo-status">${details ? (d.multiplier>0?'BINGO! MODÈL LA KONPLÈ':'PA GEN BINGO NAN MODÈL SA A') : 'CHWAZI MODÈL OU ANVAN TIRAJ LA'}</div></div>`, phase);
    }
    case 'blackjack':
    case 'baccarat':
    case 'casinowar':
    case 'threecard':
    case 'dragontiger': {
      const blackjack = gameId === 'blackjack';
      const baccarat = gameId === 'baccarat';
      const dragonTiger = gameId === 'dragontiger';
      const threecard = gameId === 'threecard';
      const pCards = blackjack ? (d.player || []) : baccarat || threecard ? (d.playerCards || []) : dragonTiger ? (d.dragonCard ? [d.dragonCard] : []) : (d.playerCard ? [d.playerCard] : []);
      const bCards = blackjack ? (d.dealer || []) : baccarat || threecard ? (d.bankerCards || []) : dragonTiger ? (d.tigerCard ? [d.tigerCard] : []) : (d.bankerCard ? [d.bankerCard] : []);
      const leftName = dragonTiger ? 'DRAGON' : blackjack || baccarat || threecard ? 'JWÈ' : 'OU';
      const rightName = dragonTiger ? 'TIGER' : blackjack ? 'KOUTYE' : 'BANKYE';
      const leftScore = blackjack ? d.playerTotal : baccarat ? d.playerScore : dragonTiger ? d.dragonValue : threecard ? d.playerHand : d.playerValue;
      const rightScore = blackjack ? d.dealerTotal : baccarat ? d.bankerScore : dragonTiger ? d.tigerValue : threecard ? d.bankerHand : d.bankerValue;
      const cards = (arr) => arr.length ? arr.map((c) => stageCard(c)).join('') : stageCard('', true);
      const title = blackjack ? 'Blackjack 21' : baccarat ? 'Baccarat Lakay' : dragonTiger ? 'Dragon Tiger' : threecard ? 'Poker 3 Kat' : 'Casino War';
      return stageFrame(gameId, title, 'Kat yo parèt sou yon tab pwofesyonèl, ak men ak valè yo vizib.', `<div class="felt-table"><div class="felt-brand">KAZINO LAKAY <span>◆</span> TABLE ${baccarat ? 'BACCARAT' : 'CARD ROOM'}</div><div class="card-duel"><div class="card-hand"><div class="hand-label">${leftName}<b class="stage-result">${leftScore ?? '—'}</b></div><div class="hand-cards">${cards(pCards)}</div></div><div class="versus">VS</div><div class="card-hand"><div class="hand-label">${rightName}<b class="stage-result">${rightScore ?? '—'}</b></div><div class="hand-cards">${cards(bCards)}</div></div></div><div class="felt-footer"><span>DEALER • TABLE 01</span><span>${details ? 'MEN REVELE' : 'PARE POU KAT YO'}</span></div></div>`, phase);
    }
    case 'andarbahar': {
      const center = d.centerCard || 'A♠';
      const andar = d.andarCards || [];
      const bahar = d.baharCards || [];
      const winner = d.winner || '';
      return stageFrame(gameId, 'Andar Bahar', 'Kat santral la se referans lan. Kat yo distribye youn apre lòt ant de bò yo.', `<div class="andarbahar-table"><div class="andarbahar-center"><small>KAT SANTRAL</small>${stageCard(center)}<b>${d.centerValue ?? '—'}</b></div><div class="andarbahar-lanes"><section class="andarbahar-lane ${winner==='andar'?'lane-winner':''}"><header>ANDAR <b>${andar.length}</b></header><div>${andar.slice(-7).map((card)=>stageCard(card)).join('') || stageCard('',true)}</div></section><section class="andarbahar-lane ${winner==='bahar'?'lane-winner':''}"><header>BAHAR <b>${bahar.length}</b></header><div>${bahar.slice(-7).map((card)=>stageCard(card)).join('') || stageCard('',true)}</div></section></div><div class="andarbahar-status">${details ? `${winner.toUpperCase()} • ${d.cardsDrawn} KAT TIRE` : 'CHWAZI ANDAR OSWA BAHAR'}</div></div>`, phase);
    }
    case 'hilo': {
      const a = d.first || 'A♠'; const b = d.next || 'K♥';
      return stageFrame(gameId, 'Hi-Lo', 'Konpare de kat yo pou wè si valè a monte oswa desann.', `<div class="hilo-table"><div class="hilo-card-zone"><div class="hilo-card-unit"><small>KAT DEPA</small>${stageCard(a)}</div><span class="hilo-arrow">${details ? (d.nextValue > d.firstValue ? '↑' : d.nextValue < d.firstValue ? '↓' : '=') : '?'}</span><div class="hilo-card-unit"><small>KAT SWIVAN</small>${stageCard(b, !details)}</div></div><div class="hilo-message">${details ? `${d.firstValue}  →  ${d.nextValue}` : 'PI WO OSWA PI BA?'}</div></div>`, phase);
    }
    case 'keno': {
      const selected = new Set(d.selected || [2,5,9,12,21]); const drawn = new Set(d.drawn || []); const hits = new Set(d.hits || []);
      return stageFrame(gameId, 'Keno 20', 'Tablo 5 × 5 la montre nimewo chwazi, nimewo tire ak bon korespondans yo.', `<div class="keno-board-wrap"><div class="keno-head"><span>KEN0 • 25 NIMEWO</span><b>${details ? `${d.hitCount || 0} BON KOU` : 'CHWAZI 5'}</b></div><div class="keno-board">${Array.from({length:25},(_,i)=>{const n=i+1;return `<span class="keno-ball ${selected.has(n)?'is-selected':''} ${drawn.has(n)?'is-drawn':''} ${hits.has(n)?'is-hit':''}" style="--i:${i}">${n}</span>`}).join('')}</div><div class="keno-legend"><span><i class="legend-selected"></i>Chwazi</span><span><i class="legend-drawn"></i>Tire</span><span><i class="legend-hit"></i>Bon kou</span></div></div>`, phase);
    }
    case 'dice':
    case 'sicbo': {
      const dice = d.dice || (gameId === 'dice' ? [3,5] : [2,4,6]);
      return stageFrame(gameId, gameId === 'dice' ? 'Dice — De Chans' : 'Sic Bo', 'Zo yo woule sou sifas tab la epi total la parèt.', `<div class="dice-table"><div class="dice-brand">${gameId === 'dice' ? 'DICE ARENA' : 'SIC BO • THREE DICE'}</div><div class="dice-cup">${dice.map((n,i)=>`<span class="die stage-result" style="--die-delay:${i*90}ms">${dieFace(n)}</span>`).join('')}</div><div class="dice-total"><small>TOTAL</small><strong class="stage-result">${details ? d.total : '—'}</strong></div></div>`, phase);
    }
    case 'mines': {
      const chosen = new Set(d.selectedCells || [3,8,12,18,22]); const mines = new Set(d.revealedMines || []); const hits = new Set(d.hitMines || []);
      return stageFrame(gameId, 'Mines — Min Lakay', 'Tablo sekirite 5 × 5 la revele dyaman ak min yo apre wonn nan.', `<div class="mines-board-wrap"><div class="mines-top"><span>MIN LAKAY <small>${d.mineCount || 3} MIN KACHE</small></span><b>${details ? (hits.size ? 'MIN DETEKTE' : 'ZÒN SEKIRIZE') : 'CHWAZI KARE'}</b></div><div class="mines-board">${Array.from({length:25},(_,i)=>{const n=i+1;const isMine=mines.has(n);const isSafe=details && chosen.has(n) && !isMine;return `<span class="mine-cell ${chosen.has(n)?'is-chosen':''} ${isMine?'is-mine':''} ${isSafe?'is-safe':''}" style="--i:${i}">${isMine?'✹':isSafe?'◆':chosen.has(n)?'•':'?'}</span>`}).join('')}</div><div class="mines-footer"><span>◆ DIAMYAN</span><span>✹ MIN</span></div></div>`, phase);
    }
    case 'plinko': {
      const path = d.path || ['L','R','L','R','L','R']; const slot = Number(d.slot || 4);
      const rows = Number(d.rows || 6); const slotTables = {6:{low:[0.8,0.9,1,1.1,1,0.9,0.8],normal:[0,0.2,0.8,1.5,0.8,0.2,0],high:[8,2,0.5,0,0.5,2,8]},8:{low:[0.7,0.8,0.9,1,1.1,1,0.9,0.8,0.7],normal:[0,0.1,0.3,0.8,1.5,0.8,0.3,0.1,0],high:[12,4,1,0.3,0,0.3,1,4,12]}}; const slots = slotTables[rows][d.risk || 'normal'];
      return stageFrame(gameId, 'Plinko Drop', 'Boul la desann atravè pikèt yo epi fini nan pòch miltiplikatè a.', `<div class="plinko-board-wrap"><div class="plinko-top"><span>PLINKO • ${rows} LINES</span><b class="stage-result">${details ? `${Number(d.multiplier).toFixed(1)}×` : '—'}</b></div><div class="plinko-board"><div class="plinko-pegs">${Array.from({length:rows},(_,row)=>`<div class="peg-row">${Array.from({length:row+1},(_,col)=>`<i></i>`).join('')}</div>`).join('')}</div><span class="plinko-ball stage-result" data-path="${path.join('')}" data-slot="${slot}"></span></div><div class="plinko-slots">${slots.map((v,i)=>`<span class="${details && slot===i+1?'slot-active':''}">${v}×</span>`).join('')}</div></div>`, phase);
    }
    case 'penalty': {
      const shot = d.shot || 'center'; const keeper = d.keeper || 'center';
      return stageFrame(gameId, 'Penalty Lakay', 'Yon teren foutbòl, yon gadyen ak yon tir ki pran direksyon ou te chwazi a.', `<div class="penalty-field"><div class="goal-net"><span class="goal-post left"></span><span class="goal-post right"></span><span class="goal-crossbar"></span><span class="keeper ${details ? `keeper-${keeper}` : ''}">🧤</span><span class="football ${details ? `ball-${shot}` : ''}">⚽</span></div><div class="field-mark"></div><div class="penalty-labels"><span>AGOCH</span><span>MITAN</span><span>ADWAT</span></div><div class="penalty-status stage-result">${details ? (d.goal ? 'GÒL!' : 'BLOKAJ!') : 'PRAN TIR LA'}</div></div>`, phase);
    }
    case 'coinflip': {
      const result = d.result || 'heads';
      const flips = d.flips || [result];
      return stageFrame(gameId, 'Coin Flip', 'Pyès la vire nan lè a epi li montre Fas oswa Pil.', `<div class="coin-table"><div class="coin-shadow"></div><div class="coin-3d stage-result ${details ? `coin-${result}` : ''}"><div class="coin-side coin-front">KL<small>FAS</small></div><div class="coin-side coin-back">✦<small>PIL</small></div></div><div class="coin-outcome">${details ? (result === 'heads' ? 'FAS' : 'PIL') : 'LANSE PYÈS LA'}</div><div class="coin-rounds">${flips.map((flip)=>`<span>${flip==='heads'?'F':'P'}</span>`).join('')}</div></div>`, phase);
    }
    case 'limbo': {
      return stageFrame(gameId, 'Limbo', 'Miltiplikatè a monte sou ekran an jiskaske li sispann sou rezilta final la.', `<div class="limbo-screen"><div class="limbo-lines"></div><small>LI-MIT MULTIPLIER</small><strong class="stage-result">${details ? `${Number(d.result).toFixed(2)}×` : '1.00×'}</strong><div class="limbo-target">OBJEKTIF OU: <b>${details ? `${Number(d.target).toFixed(2)}×` : '2.00×'}</b></div><div class="limbo-meter"><i style="--progress:${details ? Math.min(100,Number(d.result)/20*100) : 8}%"></i></div></div>`, phase);
    }
    case 'scratch': {
      const symbols = d.symbols || ['🍒','🔔','💎'];
      return stageFrame(gameId, 'Scratch Cards', 'Kat la gen yon kouch metalik ki retire pou revele twa senbòl.', `<div class="scratch-table"><div class="scratch-title">LUCKY TICKET <small>INSTANT REVEAL</small></div><div class="scratch-ticket"><div class="scratch-prize">GANYE 3 SENBÒL MENM JAN</div><div class="scratch-symbols">${symbols.map(x=>`<span class="scratch-symbol stage-result">${esc(x)}</span>`).join('')}</div><div class="scratch-foil ${details?'foil-revealed':''}">${details?`REZILTA REVELE • ${String(d.risk || 'normal').toUpperCase()}`:'GRATE POU REVELE'}</div></div><div class="scratch-foot">KAZINO LAKAY • TIKÈ SIMILASYON</div></div>`, phase);
    }
    case 'wheel': {
      const segments = ({low:[0.4,0.6,0.8,1,1,1.2,1.4,1.6],normal:[0,0.2,0.5,0.8,1,1.5,2,3],high:[0,0,0.1,0.2,0.5,1,2,5]})[d.risk || 'normal']; const value = Number(d.multiplier || 0);
      return stageFrame(gameId, 'Wheel of Fortune', 'Wou a vire anba flèch la pou revele segman final la.', `<div class="fortune-table"><div class="fortune-pointer">▼</div><div class="fortune-wheel stage-result" style="--wheel-turn:${details?segments.indexOf(value):0}">${segments.map((v,i)=>`<span class="fortune-segment" style="--i:${i}"><b>${v}×</b></span>`).join('')}<div class="fortune-hub">KL</div></div><div class="fortune-value">${details?`${value}×`:'VIRE WOU A'}</div></div>`, phase);
    }
    default:
      return stageFrame(gameId, 'Kazino Lakay', 'Tab jwèt la pare.', `<div class="generic-stage">${esc(GAMES.find((g)=>g.id===gameId)?.symbol || '✦')}</div>`, phase);
  }
}

function gameCardIcon(game) {
  const art = {
    crash: `<path d="M16 56h48l19 10H57l-10 9H35l7-9H16z"/><path d="M43 56 53 36h11l-3 20M29 56 22 44h11l9 12"/>`,
    slots: `<rect x="12" y="20" width="76" height="60" rx="10"/><path d="M38 20v60M63 20v60"/><path d="M22 54h10M47 54h8M72 54h8"/><text x="25" y="48" font-size="22" font-weight="900" fill="currentColor" stroke="none">7</text><text x="48" y="48" font-size="22" font-weight="900" fill="currentColor" stroke="none">7</text><text x="72" y="48" font-size="22" font-weight="900" fill="currentColor" stroke="none">7</text>`,
    roulette: `<circle cx="50" cy="50" r="37"/><circle cx="50" cy="50" r="26"/><circle cx="50" cy="50" r="9"/><path d="M50 13v28M50 59v28M13 50h28M59 50h28M24 24l19 19M57 57l19 19M76 24 57 43M43 57 24 76"/>`,
    blackjack: `<path d="M23 15h43a7 7 0 0 1 7 7v54H30a7 7 0 0 1-7-7z"/><path d="M34 11h39a7 7 0 0 1 7 7v51"/><text x="35" y="48" font-size="25" font-weight="900" fill="currentColor" stroke="none">A</text><path d="m48 53 7 8 7-8-7-9z"/>`,
    baccarat: `<path d="M18 23q0-8 8-8h35q8 0 8 8v55H26q-8 0-8-8z"/><path d="M35 17 70 9q8-2 10 7l10 51q2 8-6 10l-8 2"/><text x="31" y="48" font-size="23" font-weight="900" fill="currentColor" stroke="none">9</text>`,
    keno: `<circle cx="28" cy="35" r="16"/><circle cx="65" cy="31" r="16"/><circle cx="49" cy="68" r="16"/><text x="21" y="40" font-size="14" font-weight="900" fill="currentColor" stroke="none">7</text><text x="58" y="36" font-size="14" font-weight="900" fill="currentColor" stroke="none">12</text><text x="42" y="73" font-size="14" font-weight="900" fill="currentColor" stroke="none">21</text>`,
    dice: `<rect x="17" y="17" width="66" height="66" rx="13"/><circle cx="34" cy="34" r="5" fill="currentColor" stroke="none"/><circle cx="66" cy="34" r="5" fill="currentColor" stroke="none"/><circle cx="50" cy="50" r="5" fill="currentColor" stroke="none"/><circle cx="34" cy="66" r="5" fill="currentColor" stroke="none"/><circle cx="66" cy="66" r="5" fill="currentColor" stroke="none"/>`,
    mines: `<path d="M50 13 81 40 50 86 19 40z"/><path d="m19 40 31 11 31-11M50 13v38M31 40l19 46 19-46"/><path d="m14 17 5 8 9 2-9 3-5 8-3-8-8-3 8-2z"/>`,
    plinko: `<path d="M20 13v72M80 13v72M20 20h60M20 40h60M20 60h60M20 80h60" stroke-dasharray="2 5"/><g fill="currentColor" stroke="none"><circle cx="35" cy="29" r="3"/><circle cx="50" cy="29" r="3"/><circle cx="65" cy="29" r="3"/><circle cx="28" cy="48" r="3"/><circle cx="42" cy="48" r="3"/><circle cx="57" cy="48" r="3"/><circle cx="72" cy="48" r="3"/><circle cx="35" cy="67" r="3"/><circle cx="50" cy="67" r="3"/><circle cx="65" cy="67" r="3"/></g><circle cx="50" cy="10" r="6"/>`,
    penalty: `<path d="M16 78V25h68v53M16 38h68M26 78V38M74 78V38"/><circle cx="50" cy="67" r="9"/><path d="m44 63 12 8m0-8-12 8"/>`,
    coinflip: `<circle cx="50" cy="50" r="36"/><circle cx="50" cy="50" r="27"/><path d="M50 29v42M40 40h16q9 0 9 7t-9 7H39q-8 0-8 7t9 7h19"/>`,
    limbo: `<path d="M14 78h73M18 74V18"/><path d="m22 67 17-13 13 3 13-22 17-17"/><path d="M66 18h16v16"/><circle cx="65" cy="37" r="4" fill="currentColor" stroke="none"/>`,
    hilo: `<path d="M23 16h42a7 7 0 0 1 7 7v58H30a7 7 0 0 1-7-7z"/><text x="35" y="52" font-size="27" font-weight="900" fill="currentColor" stroke="none">A</text><path d="m57 62 8-9 8 9M65 53v19"/>`,
    scratch: `<rect x="13" y="23" width="74" height="54" rx="7" stroke-dasharray="4 3"/><rect x="24" y="35" width="52" height="30" rx="4"/><path d="m31 58 13-15 8 10 7-7 8 12"/>`,
    wheel: `<circle cx="50" cy="50" r="37"/><circle cx="50" cy="50" r="9"/><path d="M50 13v28M50 59v28M13 50h28M59 50h28M24 24l19 19M57 57l19 19M76 24 57 43M43 57 24 76"/><path d="M50 4v11" stroke-width="5"/>`,
    sicbo: `<rect x="8" y="28" width="38" height="45" rx="8"/><rect x="54" y="10" width="38" height="45" rx="8"/><rect x="38" y="54" width="38" height="38" rx="8"/><g fill="currentColor" stroke="none"><circle cx="20" cy="41" r="3"/><circle cx="34" cy="60" r="3"/><circle cx="67" cy="22" r="3"/><circle cx="79" cy="43" r="3"/><circle cx="50" cy="66" r="3"/><circle cx="64" cy="80" r="3"/></g>`,
    casinowar: `<path d="M15 23q0-8 8-8h39q8 0 8 8v57H23q-8 0-8-8z"/><path d="M34 14 70 9q8-1 10 7l9 53q1 8-7 10l-8 2"/><path d="m42 41 8-13 8 13-8 13zM50 54v12"/>`,
    dragontiger: `<path d="M14 20q20-12 36 4 16-16 36-4v55q-20-12-36 4-16-16-36-4z"/><path d="M50 24v55M26 39l11 11-11 11M74 39 63 50l11 11"/><circle cx="31" cy="29" r="6"/><circle cx="69" cy="29" r="6"/>`,
    andarbahar: `<circle cx="50" cy="50" r="37"/><circle cx="50" cy="50" r="20"/><path d="M50 12v17M50 71v17M12 50h17M71 50h17M23 23l12 12M65 65l12 12M77 23 65 35M35 65 23 77"/><text x="41" y="57" font-size="20" fill="currentColor" stroke="none">A</text>`,
    threecard: `<path d="M14 22q0-8 8-8h34q8 0 8 8v56H22q-8 0-8-8z"/><path d="M34 14h36q8 0 8 8v50"/><path d="m42 41 8-13 8 13-8 13zM50 54v13"/>`,
    holdem: `<path d="M12 22q0-8 8-8h33q8 0 8 8v56H20q-8 0-8-8z"/><path d="M39 14h33q8 0 8 8v56q0 8-8 8H39"/><path d="m38 38 12-11 12 11-12 11z"/><path d="M50 50v20"/>`,
    bingo: `<rect x="15" y="15" width="70" height="70" rx="8"/><path d="M15 33h70M15 51h70M15 69h70M33 15v70M51 15v70M69 15v70"/><circle cx="51" cy="51" r="8"/>`,
  }[game.id] || '<circle cx="50" cy="50" r="30"/><path d="M50 25v50M25 50h50"/>';
  return `<svg class="game-symbol-svg" viewBox="0 0 100 100" role="img" aria-label="${esc(game.name)}" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><circle class="game-icon-halo" cx="50" cy="50" r="45" stroke-width="1.5"/><g>${art}</g></svg>`;
}

function gameCard(game) {
  const art = game.id === 'roulette' ? rouletteCardIcon() : gameCardIcon(game);
  return `<article class="game-card game-${game.tone}" data-open-game="${game.id}" tabindex="0" aria-label="Louvri ${esc(game.name)}">
    <div class="game-card-art"><span class="game-card-artwork">${art}</span><span class="game-category">${esc(game.category)}</span></div>
    <div class="game-card-body"><h3>${esc(game.name)}</h3><p>${esc(game.summary)}</p>
      <button class="button button-small button-primary" type="button" data-open-game="${game.id}">Louvri jwèt la</button></div>
  </article>`;
}

function render() {
  if (state.activeGame?.id === 'roulette' && document.querySelector('#roulette-fullscreen')) {
    const balance = document.querySelector('[data-roulette-balance]');
    if (balance && state.profile) balance.textContent = `${fmt(state.profile.pointsBalance)} P`;
    updateRouletteControls();
    return;
  }
  const filtered = GAMES.filter((game) => {
    const categoryMatch = state.category === 'Tout jwèt' || game.category === state.category;
    const q = state.query.trim().toLowerCase();
    const textMatch = !q || `${game.name} ${game.category} ${game.summary} ${game.how}`.toLowerCase().includes(q);
    return categoryMatch && textMatch;
  });
  root.innerHTML = `<header class="topbar"><a class="brand" href="#top"><span class="brand-mark">KL</span><span>KAZINO <b>LAKAY</b></span></a>
    <div class="topbar-actions"><span class="points"><small>${state.profile ? 'Pwen kont' : 'Mòd demonstrasyon'}</small><strong>${state.profile ? `${fmt(state.profile.pointsBalance)} P` : 'DEMO'}</strong></span>
      ${state.profile?.role === 'admin' ? `<a class="button button-ghost" href="/admin.html">Admin</a>` : ''}
      ${state.installPrompt ? `<button class="button button-ghost" data-action="install-app">Enstale app</button>` : ''}
      ${state.user ? `<button class="button button-ghost" data-action="history">Istwa</button><span class="user-label">${esc(state.user.displayName || state.user.email || 'Jwè')}</span><button class="button button-ghost" data-action="logout">Dekonekte</button>` : `<button class="button button-ghost" data-action="login">Konekte</button><button class="button button-primary" data-action="register">Kreye kont</button>`}
    </div></header>
    <main id="top" class="shell">
      ${!firebaseReady ? `<div class="config-alert"><strong>Kont jwè yo poko aktive.</strong><span>Konfigirasyon frontend Firebase ki manke: ${firebaseMissing.map(esc).join(', ')}. Ou kapab eseye jwèt yo nan mòd demonstrasyon; pou kont, balans sove ak administrasyon, fini konfigirasyon Firebase la.</span></div>` : ''}
      ${state.health && !state.health.firebaseConfigured ? `<div class="config-alert"><strong>Backend Firebase poko konekte.</strong><span>Jwèt DEMO yo disponib. Kont, balans ki sove, istwa ak admin ap rete bloke jiskaske sekrè Firebase Worker yo konfigire. Paramèt ki manke: ${(state.health.firebaseMissing || []).map(esc).join(', ') || 'verifye kle prive a'}.</span></div>` : ''}
      <section class="hero"><div class="hero-copy"><span class="eyebrow">GAME CENTER • KAZINO LAKAY</span><h1>Jwe ak lespri.<br><em>Konprann chak mouvman.</em></h1><p>Eksplore jwèt yo, aprann règ yo, epi swiv rezilta ou. Chak jwèt gen eksplikasyon klè anvan ou kòmanse.</p><div class="hero-actions"><a class="button button-primary" href="#games">Eksplore 22 jwèt yo <span>↘</span></a><span class="hero-note">Pwen jwèt san valè lajan</span></div></div>
        <div class="hero-art" aria-hidden="true"><div class="hero-orbit orbit-a"></div><div class="hero-orbit orbit-b"></div><div class="hero-chip">KL</div><div class="hero-card hero-card-a">A<span>♠</span></div><div class="hero-card hero-card-b">7<span>♦</span></div></div></section>
      ${state.user && !state.user.emailVerified ? `<div class="config-alert verify-alert"><strong>Verifye imel ou.</strong><span>Nou voye yon lyen verifikasyon nan ${esc(state.user.email || 'adrès imel ou')}.</span><button class="button button-ghost" data-action="resend-verification">Voye imel verifikasyon ankò</button></div>` : ''}
      <section class="quick-info"><div><span class="quick-icon">ⓘ</span><div><strong>Sa ou dwe konnen</strong><p>Pwen yo se sèlman pwen jwèt. Yo pa gen valè lajan, yo pa ka achte, transfere, vann oswa retire kòm lajan.</p></div></div><div><span class="quick-icon">🛡️</span><div><strong>Rezilta verifye sou sèvè</strong><p>Rezilta jwèt ak balans lan soti nan backend la, pa nan bouton navigatè a.</p></div></div></section>
      <section class="section-head" id="games"><div><span class="eyebrow">KOLEKSYON AN</span><h2>Chwazi jwèt ou</h2><p class="section-sub">22 jwèt • Plis chwa, plis detay ak règ klè</p></div><label class="search"><span>⌕</span><input id="search" type="search" value="${esc(state.query)}" placeholder="Chèche yon jwèt..." autocomplete="off"></label></section>
      <nav class="category-nav" aria-label="Filtre jwèt">${CATEGORIES.map((cat) => `<button class="category ${state.category === cat ? 'active' : ''}" data-category="${cat}">${cat}</button>`).join('')}</nav>
      <div class="game-grid">${filtered.map(gameCard).join('')}</div>
      ${filtered.length === 0 ? '<div class="empty-state">Pa gen jwèt ki mache ak rechèch sa a.</div>' : ''}
      <section class="help-panel"><div><span class="eyebrow">KONPRANN JWE A</span><h2>Règ yo anvan aksyon an.</h2><p>Chak fich jwèt gen objektif, etap pou jwe, fason pou kalkile retou ak yon rapèl sou pwen jwèt yo.</p></div><div class="help-stat"><strong>22</strong><span>fich jwèt ak règ klè</span></div></section>
    </main>
    <footer><span>© ${new Date().getFullYear()} Kazino Lakay</span><span>Game Center • Pwen jwèt san valè lajan</span></footer>
    <div id="modal-root"></div><div id="toast" class="toast" role="status"></div>`;
  if (state.activeGame) renderGameModal();
}

function gameChoiceMarkup(game) {
  return game.controls.map((field) => {
    if (field.type === 'select') {
      const current = field.value ?? field.options?.[0]?.[0] ?? '';
      return `<section class="kl-control-group"><div class="kl-control-heading"><span>${esc(field.label)}</span><b>CHWAZI YON OPSYON</b></div><input type="hidden" name="${esc(field.id)}" value="${esc(current)}" data-choice-input="${esc(field.id)}"><div class="kl-option-row">${field.options.map(([value,label]) => `<button class="kl-option-chip ${String(value) === String(current) ? 'is-active' : ''}" type="button" data-game-choice="${esc(field.id)}" data-choice-value="${esc(value)}" aria-pressed="${String(value) === String(current)}"><span>${esc(label)}</span></button>`).join('')}</div></section>`;
    }
    if (field.type === 'number') {
      const presets = field.id === 'target' ? [1.5,2,3,5,10,20] : [field.min, field.value, field.max].filter((v,i,a)=>a.indexOf(v)===i);
      const current = Number(field.value || presets[0]);
      return `<section class="kl-control-group"><div class="kl-control-heading"><span>${esc(field.label)}</span><b>${field.min}× — ${field.max}×</b></div><input type="hidden" name="${esc(field.id)}" value="${current}" data-choice-input="${esc(field.id)}"><div class="kl-option-row kl-option-row-wrap">${presets.map((value)=>`<button class="kl-option-chip ${Number(value)===current?'is-active':''}" type="button" data-game-choice="${esc(field.id)}" data-choice-value="${value}" aria-pressed="${Number(value)===current}">${Number(value).toFixed(1)}×</button>`).join('')}</div></section>`;
    }
    if (field.type === 'numbers' || field.type === 'grid') {
      const total = field.type === 'grid' ? field.size : 25;
      const chosen = state.selected;
      return `<section class="kl-control-group kl-number-control"><div class="kl-control-heading"><span>${esc(field.label)}</span><b id="selection-count">${chosen.size}/${field.count || 5}</b></div><div class="number-grid kl-number-grid">${Array.from({length:total},(_,i)=>`<button type="button" class="number-cell ${chosen.has(i+1)?'chosen':''}" data-number="${i+1}" aria-pressed="${chosen.has(i+1)}">${i+1}</button>`).join('')}</div><small class="kl-control-hint">${field.type === 'numbers' ? `Chwazi egzakteman ${field.count} nimewo.` : `Chwazi ant 1 ak ${field.count} kare.`}</small></section>`;
    }
    return '';
  }).join('');
}

function gameResultMarkup(result, game, demoMode, stakePoints) {
  const payout = Number(result.payoutPoints || 0);
  const net = payout - stakePoints;
  const status = net > 0 ? 'win' : net === 0 ? 'neutral' : 'loss';
  const change = net > 0 ? `+${fmt(net)} P` : net < 0 ? `−${fmt(Math.abs(net))} P` : '0 P';
  return `<div class="kl-result-card kl-result-${status}" role="dialog" aria-modal="true" aria-labelledby="kl-result-title">
    <div class="kl-result-glow"></div><span class="kl-result-kicker">${demoMode ? 'MÒD DEMONSTRASYON' : 'REZILTA KONT KONFIME'} • ${esc(game.name.toUpperCase())}</span>
    <div class="kl-result-emblem">${net > 0 ? '✦' : net === 0 ? '◆' : '◈'}</div>
    <h2 id="kl-result-title">${esc(result.title || (net > 0 ? 'Bon kou!' : 'Wonn fini'))}</h2>
    <strong class="kl-result-change">${change}</strong><p>${esc(result.message || '')}</p>
    <div class="kl-result-metrics"><span>Pwen mete<strong>${fmt(stakePoints)} P</strong></span><span>Retou<strong>${fmt(payout)} P</strong></span><span>${demoMode ? 'Balans kont' : 'Nouvo balans'}<strong>${demoMode ? 'Pa modifye' : `${fmt(state.profile?.pointsBalance)} P`}</strong></span></div>
    <small>${demoMode ? 'Rezilta sa a pa modifye balans kont ou.' : 'Balans kont ou mete ajou.'} Pwen yo pa gen valè lajan.</small>
    <button class="kl-result-continue" type="button" data-game-action="result-close">Kontinye</button>
  </div>`;
}

function renderGameModal() {
  const game = state.activeGame;
  if (!game) return;
  if (game.id === 'roulette') {
    const canAccountPlay = Boolean(state.user && state.user.emailVerified && firebaseReady && state.health?.firebaseConfigured === true);
    const balanceLabel = state.profile ? `${fmt(state.profile.pointsBalance)} P` : 'DEMO';
    document.querySelector('#modal-root').innerHTML = renderRouletteScreen({
      balanceLabel,
      stake: state.rouletteStake,
      selection: state.rouletteBet,
      menuOpen: state.rouletteMenuOpen,
      soundOn: state.rouletteSoundOn,
      busy: state.rouletteBusy,
      canAccountPlay,
      result: state.rouletteResult
    });
    return;
  }
  const canAccountPlay = Boolean(state.user && state.user.emailVerified && firebaseReady && state.health?.firebaseConfigured === true);
  const balanceLabel = state.profile ? `${fmt(state.profile.pointsBalance)} P` : 'DEMO';
  const rules = `<div class="kl-rule-card"><strong>Objektif</strong><p>${esc(game.summary)}</p></div><div class="kl-rule-card"><strong>Kijan pou jwe?</strong><p>${esc(game.how)}</p></div><div class="kl-rule-card"><strong>Retou posib</strong><p>${esc(game.payout)}</p></div>`;
  document.querySelector('#modal-root').innerHTML = `<section class="kl-game-screen game-room-${esc(game.id)}" id="game-room-screen" aria-label="${esc(game.name)}">
    <header class="kl-game-topbar"><button type="button" class="kl-back-button" data-game-action="back" aria-label="Retounen nan lis jwèt yo">← <span>RETOU</span></button><button type="button" class="kl-menu-button" data-game-action="menu" aria-label="Ouvri meni" aria-expanded="${state.gameMenuOpen}"><span></span><span></span><span></span></button>
      <div class="kl-game-title"><small>KAZINO LAKAY • GAME CENTER</small><h1>${esc(game.name)}</h1></div>
      <div class="kl-game-stats"><span><small>BALANS</small><b data-game-balance>${balanceLabel}</b></span><span><small>JETON</small><b data-game-stake>${state.gameStake} P</b></span></div>
    </header>
    <main class="kl-game-main">
      <div class="kl-game-overline"><span class="kl-live-indicator"><i></i>${state.busy ? 'WONN AN KOU' : 'TAB JWÈT'} </span><span>${esc(game.category.toUpperCase())} • ${GAMES.length} JWE</span></div>
      <div class="kl-stage-wrap">${renderGameStage(game.id, null, 'idle')}</div>
      <form id="play-form" class="kl-play-panel"><input type="hidden" name="stakePoints" value="${state.gameStake}" data-stake-input>${gameChoiceMarkup(game)}</form>
    </main>
    <footer class="kl-game-footer"><div class="kl-chip-select"><span class="kl-chip-label">JETON</span>${[10,50,100,500].map((value)=>`<button type="button" class="kl-chip kl-chip-${value} ${value===state.gameStake?'is-active':''}" data-game-action="stake" data-stake-value="${value}" aria-pressed="${value===state.gameStake}"><b>${value}</b><small>P</small></button>`).join('')}</div>
      <div class="kl-game-actions"><span class="kl-demo-disclaimer">DEMO • PWEN SAN VALÈ LAJAN</span><button type="button" class="kl-play-account" data-game-action="account" ${canAccountPlay?'':'disabled'}>Jwe ak balans</button><button type="button" class="kl-play-demo" data-game-action="demo" ${state.busy?'disabled':''}>${state.busy?'WONN NAN AP KALKILE…':'JWE DEMO'}</button></div>
    </footer>
    <aside class="kl-menu-layer" data-game-menu-layer ${state.gameMenuOpen?'':'hidden'}><button class="kl-menu-backdrop" type="button" data-game-action="menu-close" aria-label="Fèmen meni"></button><section class="kl-menu-panel" role="dialog" aria-modal="true" aria-labelledby="kl-menu-title"><div class="kl-menu-head"><div><small>KAZINO LAKAY</small><h2 id="kl-menu-title">Gid jwèt la</h2></div><button type="button" data-game-action="menu-close" class="kl-menu-close" aria-label="Fèmen">×</button></div>${rules}<div class="kl-menu-actions"><button type="button" data-game-action="sound" class="kl-menu-action">${state.gameSoundOn?'🔊 Son aktive':'🔇 Son dezaktive'}</button><button type="button" data-game-action="back" class="kl-menu-action">← Retounen nan lis jwèt yo</button></div><p class="kl-menu-disclaimer">Mòd demonstrasyon sèlman. Pwen yo pa gen valè lajan; yo pa kapab achte, vann, transfere oswa retire.</p></section></aside>
    <div class="kl-result-layer" data-game-result-layer hidden></div>
  </section>`;
}


function updateRouletteControls() {
  const screen = document.querySelector('#roulette-fullscreen');
  if (!screen) return;
  screen.querySelectorAll('[data-roulette-action="chip"]').forEach((button) => {
    const active = Number(button.dataset.chipValue) === state.rouletteStake;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  screen.querySelectorAll('[data-roulette-action="bet"]').forEach((button) => {
    const active = Boolean(state.rouletteBet && state.rouletteBet.type === button.dataset.betType && String(state.rouletteBet.value) === String(button.dataset.betValue));
    button.classList.toggle('is-selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
  screen.querySelectorAll('.rr-chip-marker').forEach((marker) => { marker.textContent = String(state.rouletteStake); });
  const label = screen.querySelector('[data-roulette-bet-label]');
  if (label) {
    if (!state.rouletteBet) label.textContent = 'Chwazi yon nimewo oswa yon parye';
    else if (state.rouletteBet.type === 'number') label.textContent = `Nimewo ${state.rouletteBet.value}`;
    else if (state.rouletteBet.type === 'color') label.textContent = state.rouletteBet.value === 'red' ? 'Wouj' : 'Nwa';
    else if (state.rouletteBet.type === 'parity') label.textContent = state.rouletteBet.value === 'even' ? 'Pè' : 'Enpè';
    else if (state.rouletteBet.type === 'dozen') label.textContent = `Douzèn ${state.rouletteBet.value}`;
    else if (state.rouletteBet.type === 'column') label.textContent = `Kolòn ${state.rouletteBet.value}`;
  }
  const stake = screen.querySelector('[data-roulette-stake]');
  if (stake) stake.textContent = `${state.rouletteStake} P`;
  const demo = screen.querySelector('[data-roulette-action="demo"]');
  const account = screen.querySelector('[data-roulette-action="account"]');
  const canAccountPlay = Boolean(state.user && state.user.emailVerified && firebaseReady && state.health?.firebaseConfigured === true);
  if (demo) { demo.disabled = state.rouletteBusy || !state.rouletteBet; demo.textContent = state.rouletteBusy ? 'WOU A AP VIRE…' : 'VIRE WOU A'; }
  if (account) account.disabled = state.rouletteBusy || !state.rouletteBet || !canAccountPlay;
}

async function closeRouletteGame() {
  document.body.style.overflow = '';
  try {
    if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
  } catch { /* Navigatè a ka pa pèmèt sòti Fullscreen API a. */ }
  state.activeGame = null;
  state.rouletteMenuOpen = false;
  state.rouletteBusy = false;
  state.rouletteResult = null;
  render();
}

async function playRouletteRound(demoMode = false) {
  if (!state.rouletteBet) return toast('Chwazi kote ou vle mete jeton an.', 'warning');
  if (!demoMode && !state.user) return toast('Konekte anvan ou jwe ak pwen kont ou.', 'warning');
  if (!demoMode && !state.user.emailVerified) return toast('Verifye imel ou anvan ou jwe ak pwen kont ou.', 'warning');
  if (!demoMode && (!firebaseReady || state.health?.firebaseConfigured !== true)) return toast('Firebase poko konfigire. Sèvi ak mòd demonstrasyon pou kounye a.', 'warning');
  if (state.rouletteBusy) return;
  state.rouletteBusy = true;
  const screen = document.querySelector('#roulette-fullscreen');
  const status = screen?.querySelector('[data-roulette-status]');
  if (status) status.textContent = 'SÈVÈ A AP KONFIME PARyE A';
  updateRouletteControls();
  playRouletteSound(state.rouletteSoundOn, 'spin');
  try {
    const choice = { betType: state.rouletteBet.type, betValue: state.rouletteBet.value };
    const response = await api(demoMode ? '/api/games/demo' : '/api/games/play', {
      method: 'POST',
      body: { gameId: 'roulette', stakePoints: state.rouletteStake, choice }
    });
    const gameResult = response.result;
    await animateRouletteSpin(screen, gameResult.details.number);
    if (!demoMode) {
      state.profile = { ...(state.profile || {}), pointsBalance: response.balancePoints };
      renderTopbarOnly();
      const balance = screen?.querySelector('[data-roulette-balance]');
      if (balance) balance.textContent = `${fmt(response.balancePoints)} P`;
    }
    const resultForScreen = {
      ...gameResult,
      stakePoints: state.rouletteStake,
      demoMode,
      message: gameResult.message
    };
    state.rouletteResult = resultForScreen;
    const layer = screen?.querySelector('[data-roulette-result-layer]');
    if (layer) {
      layer.innerHTML = rouletteResultMarkup(resultForScreen);
      layer.hidden = false;
    }
    if (status) status.textContent = 'REZILTA KONFIME';
    const last = screen?.querySelector('[data-roulette-last]');
    if (last) last.textContent = String(gameResult.details.number);
    playRouletteSound(state.rouletteSoundOn, gameResult.payoutPoints > state.rouletteStake ? 'win' : 'loss');
    toast(demoMode ? 'Rezilta DEMO a pare. Balans kont ou pa chanje.' : 'Wonn fini. Balans kont ou mete ajou.', 'success');
  } catch (error) {
    if (status) status.textContent = 'WOU A PARE';
    toast(error.message || 'Nou pa t kapab lanse roulèt la.', 'error');
  } finally {
    state.rouletteBusy = false;
    updateRouletteControls();
  }
}

async function handleRouletteAction(button) {
  const action = button.dataset.rouletteAction;
  if (action === 'chip') {
    if (state.rouletteBusy) return;
    state.rouletteStake = Number(button.dataset.chipValue);
    state.rouletteResult = null;
    const layer = document.querySelector('[data-roulette-result-layer]');
    if (layer) { layer.hidden = true; layer.innerHTML = ''; }
    playRouletteSound(state.rouletteSoundOn, 'chip');
    updateRouletteControls();
  } else if (action === 'bet') {
    if (state.rouletteBusy) return;
    const type = button.dataset.betType;
    const value = type === 'number' ? Number(button.dataset.betValue) : button.dataset.betValue;
    state.rouletteBet = { type, value };
    state.rouletteResult = null;
    const layer = document.querySelector('[data-roulette-result-layer]');
    if (layer) { layer.hidden = true; layer.innerHTML = ''; }
    playRouletteSound(state.rouletteSoundOn, 'click');
    updateRouletteControls();
  } else if (action === 'menu') {
    state.rouletteMenuOpen = !state.rouletteMenuOpen;
    const layer = document.querySelector('[data-roulette-menu-layer]');
    if (layer) layer.hidden = !state.rouletteMenuOpen;
    button.setAttribute('aria-expanded', String(state.rouletteMenuOpen));
  } else if (action === 'menu-close') {
    state.rouletteMenuOpen = false;
    const layer = document.querySelector('[data-roulette-menu-layer]');
    if (layer) layer.hidden = true;
  } else if (action === 'sound') {
    state.rouletteSoundOn = !state.rouletteSoundOn;
    button.textContent = state.rouletteSoundOn ? '🔊 Son aktive' : '🔇 Son dezaktive';
    playRouletteSound(state.rouletteSoundOn, 'click');
  } else if (action === 'back') {
    await closeRouletteGame();
  } else if (action === 'demo') {
    await playRouletteRound(true);
  } else if (action === 'account') {
    await playRouletteRound(false);
  } else if (action === 'result-close') {
    const layer = document.querySelector('[data-roulette-result-layer]');
    if (layer) { layer.hidden = true; layer.innerHTML = ''; }
    state.rouletteResult = null;
  }
}


async function closeGameRoom() {
  state.activeGame = null;
  state.gameMenuOpen = false;
  state.gameResult = null;
  state.busy = false;
  state.selected = new Set();
  document.body.style.overflow = '';
  try { if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen(); } catch { /* Fullscreen se yon fonksyon opsyonèl. */ }
  render();
}

async function handleGameRoomAction(button) {
  const action = button.dataset.gameAction;
  if (action === 'back') return closeGameRoom();
  if (action === 'menu') {
    state.gameMenuOpen = !state.gameMenuOpen;
    const layer = document.querySelector('[data-game-menu-layer]');
    if (layer) layer.hidden = !state.gameMenuOpen;
    button.setAttribute('aria-expanded', String(state.gameMenuOpen));
    return;
  }
  if (action === 'menu-close') {
    state.gameMenuOpen = false;
    const layer = document.querySelector('[data-game-menu-layer]');
    if (layer) layer.hidden = true;
    return;
  }
  if (action === 'sound') {
    state.gameSoundOn = !state.gameSoundOn;
    button.textContent = state.gameSoundOn ? '🔊 Son aktive' : '🔇 Son dezaktive';
    playRouletteSound(state.gameSoundOn, 'click');
    return;
  }
  if (action === 'stake') {
    if (state.busy) return;
    state.gameStake = Number(button.dataset.stakeValue);
    const input = document.querySelector('[data-stake-input]');
    if (input) input.value = String(state.gameStake);
    document.querySelectorAll('[data-game-action="stake"]').forEach((node) => {
      const active = Number(node.dataset.stakeValue) === state.gameStake;
      node.classList.toggle('is-active', active);
      node.setAttribute('aria-pressed', String(active));
    });
    const label = document.querySelector('[data-game-stake]');
    if (label) label.textContent = `${state.gameStake} P`;
    playRouletteSound(state.gameSoundOn, 'chip');
    return;
  }
  if (action === 'demo' || action === 'account') {
    if (state.busy) return;
    const form = document.querySelector('#play-form');
    if (form) await playGame(form, action === 'demo');
    return;
  }
  if (action === 'result-close') {
    const layer = document.querySelector('[data-game-result-layer]');
    if (layer) { layer.hidden = true; layer.innerHTML = ''; }
    state.gameResult = null;
  }
}

function chooseGameOption(button) {
  if (state.busy) return;
  const fieldId = button.dataset.gameChoice;
  const value = button.dataset.choiceValue;
  const input = document.querySelector(`[data-choice-input="${CSS.escape(fieldId)}"]`);
  if (!input) return;
  input.value = value;
  document.querySelectorAll(`[data-game-choice="${CSS.escape(fieldId)}"]`).forEach((node) => {
    const active = node.dataset.choiceValue === value;
    node.classList.toggle('is-active', active);
    node.setAttribute('aria-pressed', String(active));
  });
  playRouletteSound(state.gameSoundOn, 'click');
}

function renderAuthModal(mode = 'login') {
  const register = mode === 'register';
  document.querySelector('#modal-root').innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button class="modal-backdrop" data-close-modal aria-label="Fèmen fenèt"></button><section class="modal-panel auth-panel"><header class="modal-head"><div><span class="eyebrow">KAZINO LAKAY</span><h2 id="auth-title">${register ? 'Kreye kont jwè' : 'Byenveni ankò'}</h2></div><button class="close-btn" data-close-modal aria-label="Fèmen">×</button></header>
    <form id="auth-form">${register ? '<label class="field"><span>Non ou</span><input name="displayName" type="text" minlength="2" maxlength="60" autocomplete="name" required></label>' : ''}<label class="field"><span>Imel</span><input name="email" type="email" autocomplete="email" required></label><label class="field"><span>Modpas</span><input name="password" type="password" minlength="8" autocomplete="${register ? 'new-password' : 'current-password'}" required><small>Omwen 8 karaktè.</small></label><button class="button button-primary button-wide" type="submit">${register ? 'Kreye kont mwen' : 'Konekte'}</button></form>
    <p class="auth-switch">${register ? 'Ou deja gen kont?' : 'Ou poko gen kont?'} <button data-auth-mode="${register ? 'login' : 'register'}">${register ? 'Konekte' : 'Kreye kont'}</button></p><p class="small-print">Lè ou kreye kont, ou dakò pwen jwèt yo pa gen valè lajan epi yo pa ka konvèti an lajan.</p></section></div>`;
}

function parseChoices(form, game) {
  const data = new FormData(form);
  const choice = {};
  for (const field of game.controls) {
    if (field.type === 'grid' || field.type === 'numbers') {
      const expected = field.count || 5;
      if (state.selected.size < 1 || state.selected.size > expected || (field.type === 'numbers' && state.selected.size !== expected)) {
        throw new Error(`Chwazi ${field.type === 'numbers' ? 'egzakteman ' : 'ant 1 ak '}${expected} nimewo.`);
      }
      choice[field.id] = [...state.selected].sort((a,b) => a-b);
    } else if (field.type === 'number') {
      const value = Number(data.get(field.id));
      if (!Number.isFinite(value) || value < field.min || value > field.max) throw new Error(`Antre yon valè ant ${field.min} ak ${field.max}.`);
      choice[field.id] = value;
    } else {
      choice[field.id] = data.get(field.id);
    }
  }
  return choice;
}

async function playGame(form, demoMode = false) {
  const game = state.activeGame;
  if (!game) return;
  if (!demoMode && !state.user) return toast('Konekte anvan ou jwe ak pwen kont ou.', 'warning');
  if (!demoMode && !state.user.emailVerified) return toast('Verifye imel ou anvan ou jwe ak pwen kont ou.', 'warning');
  if (!demoMode && (!firebaseReady || state.health?.firebaseConfigured !== true)) return toast('Firebase poko konfigire. Sèvi ak mòd demonstrasyon pou kounye a.', 'warning');
  if (state.busy) return;
  const stakePoints = Number(new FormData(form).get('stakePoints'));
  if (![10,50,100,500].includes(stakePoints)) return toast('Chwazi youn nan jeton 10, 50, 100 oswa 500 pwen.', 'warning');
  try {
    const choice = parseChoices(form, game);
    state.busy = true;
    const screen = document.querySelector('#game-room-screen');
    const accountButton = screen?.querySelector('[data-game-action="account"]');
    const demoButton = screen?.querySelector('[data-game-action="demo"]');
    if (accountButton) { accountButton.disabled = true; accountButton.textContent = 'SÈVÈ A AP KONFIME…'; }
    if (demoButton) { demoButton.disabled = true; demoButton.textContent = 'WONN NAN AP KALKILE…'; }
    const result = await api(demoMode ? '/api/games/demo' : '/api/games/play', { method: 'POST', body: { gameId: game.id, stakePoints, choice } });
    const panel = document.querySelector('#game-room-screen');
    const stage = panel?.querySelector('.casino-stage');
    if (stage) stage.outerHTML = renderGameStage(game.id, result.result.details, 'rolling');
    playRouletteSound(state.gameSoundOn, 'spin');
    await animateResult(panel, game.id);
    if (!demoMode) state.profile = { ...(state.profile || {}), pointsBalance: result.balancePoints };
    const balance = panel?.querySelector('[data-game-balance]');
    if (balance) balance.textContent = demoMode ? 'DEMO' : `${fmt(result.balancePoints)} P`;
    if (!demoMode) renderTopbarOnly();
    const layer = panel?.querySelector('[data-game-result-layer]');
    if (layer) {
      layer.innerHTML = gameResultMarkup(result.result, game, demoMode, stakePoints);
      layer.hidden = false;
    }
    state.gameResult = result.result;
    playRouletteSound(state.gameSoundOn, Number(result.result.payoutPoints || 0) > stakePoints ? 'win' : Number(result.result.payoutPoints || 0) === stakePoints ? 'click' : 'loss');
    if (accountButton) { accountButton.disabled = !state.user || !state.user.emailVerified || !firebaseReady || state.health?.firebaseConfigured !== true; accountButton.textContent = 'JWE AK BALANS'; }
    if (demoButton) { demoButton.disabled = false; demoButton.textContent = 'JWE DEMO ANKÒ'; }
    toast(demoMode ? 'Rezilta DEMO pare. Balans kont ou pa chanje.' : 'Wonn fini. Balans kont ou mete ajou.', 'success');
  } catch (error) {
    toast(error.message || 'Nou pa t kapab lanse jwèt la.', 'error');
    const screen = document.querySelector('#game-room-screen');
    const accountButton = screen?.querySelector('[data-game-action="account"]');
    const demoButton = screen?.querySelector('[data-game-action="demo"]');
    if (accountButton) { accountButton.disabled = !state.user || !state.user.emailVerified || !firebaseReady || state.health?.firebaseConfigured !== true; accountButton.textContent = 'JWE AK BALANS'; }
    if (demoButton) { demoButton.disabled = false; demoButton.textContent = 'JWE DEMO'; }
  } finally {
    state.busy = false;
  }
}

async function animateResult(panel, gameId) {
  const stage = panel.querySelector('.casino-stage');
  if (!stage) return;
  const duration = ['crash','roulette','wheel','plinko','slots','andarbahar'].includes(gameId) ? 1900 : 1450;
  stage.classList.add('phase-rolling');
  const moving = [...stage.querySelectorAll('.stage-result, .die, .playing-card')].filter((node) => !node.classList.contains('plinko-ball') && !node.classList.contains('fortune-wheel'));
  const animations = moving.map((node, index) => {
    const isCard = node.classList.contains('playing-card');
    const isDie = node.classList.contains('die');
    const isCoin = node.classList.contains('coin-3d');
    const keyframes = isCard
      ? [{ transform: 'translateY(-18px) rotateY(88deg)', opacity: .35 }, { transform: 'translateY(0) rotateY(0)', opacity: 1 }]
      : isDie
        ? [{ transform: 'translateY(-30px) rotate(0deg)' }, { transform: 'translateY(4px) rotate(360deg)' }, { transform: 'translateY(0) rotate(720deg)' }]
        : isCoin
          ? [{ transform: 'perspective(700px) rotateY(0deg) translateY(0)' }, { transform: 'perspective(700px) rotateY(900deg) translateY(-28px)' }, { transform: 'perspective(700px) rotateY(1440deg) translateY(0)' }]
          : [{ transform: 'translateY(12px) scale(.94)', opacity: .45 }, { transform: 'translateY(-5px) scale(1.035)', opacity: 1 }, { transform: 'translateY(0) scale(1)', opacity: 1 }];
    return node.animate(keyframes, { duration: isCard ? 900 : duration, delay: isCard || isDie ? index * 75 : 0, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' });
  });
  if (gameId === 'plinko') {
    const ball = stage.querySelector('.plinko-ball');
    if (ball) {
      const path = String(ball.dataset.path || 'LRLRLR').split('');
      let offsetX = 0;
      const frames = [{ transform: 'translate(0, 0)' }];
      path.forEach((step, index) => {
        offsetX += step === 'R' ? 25 : -25;
        frames.push({ transform: `translate(${offsetX}px, ${(index + 1) * 23}px)` });
      });
      animations.push(ball.animate(frames, { duration: 1650, easing: 'cubic-bezier(.22,.7,.26,1)', fill: 'forwards' }));
    }
  }
  await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, duration - 500)));
  stage.classList.remove('phase-rolling');
  stage.classList.add('phase-settled');
  stage.dataset.phase = 'settled';
}

async function showHistory() {
  try {
    const data = await api('/api/history');
    const items = data.items || [];
    document.querySelector('#modal-root').innerHTML = `<div class="modal" role="dialog" aria-modal="true"><button class="modal-backdrop" data-close-modal aria-label="Fèmen"></button><section class="modal-panel history-panel"><header class="modal-head"><div><span class="eyebrow">KONT JWÈ A</span><h2>Istwa jwèt mwen</h2></div><button class="close-btn" data-close-modal>×</button></header>${items.length ? `<div class="history-list">${items.map((item) => `<article class="history-item"><div><strong>${esc(GAMES.find((g) => g.id === item.gameId)?.name || item.gameId)}</strong><small>${esc(new Date(item.createdAt).toLocaleString('fr-FR'))}</small></div><div class="history-amount"><b>${item.netPoints >= 0 ? '+' : ''}${fmt(item.netPoints)} P</b><small>${fmt(item.stakePoints)} P mete · ${fmt(item.payoutPoints)} P retou</small></div></article>`).join('')}</div>` : '<p class="empty-state">Poko gen okenn wonn nan istwa ou.</p>'}<p class="small-print">Istwa sa a se yon rejis pwen jwèt. Pwen yo pa gen valè lajan.</p></section></div>`;
  } catch (error) { toast(error.message || 'Istwa a pa disponib.', 'error'); }
}

function renderTopbarOnly() {
  const gameBalance = document.querySelector('[data-game-balance]');
  if (gameBalance && state.profile) gameBalance.textContent = `${fmt(state.profile.pointsBalance)} P`;
  const points = document.querySelector('.points strong');
  if (points) points.textContent = `${fmt(state.profile?.pointsBalance)} P`;
  const rouletteBalance = document.querySelector('[data-roulette-balance]');
  if (rouletteBalance && state.profile) rouletteBalance.textContent = `${fmt(state.profile.pointsBalance)} P`;
}

root.addEventListener('click', async (event) => {
  const rouletteAction = event.target.closest('[data-roulette-action]');
  if (rouletteAction && state.activeGame?.id === 'roulette') { await handleRouletteAction(rouletteAction); return; }
  const gameAction = event.target.closest('[data-game-action]');
  if (gameAction && state.activeGame && state.activeGame.id !== 'roulette') { await handleGameRoomAction(gameAction); return; }
  const gameChoice = event.target.closest('[data-game-choice]');
  if (gameChoice && state.activeGame && state.activeGame.id !== 'roulette') { chooseGameOption(gameChoice); return; }
  const open = event.target.closest('[data-open-game]');
  const category = event.target.closest('[data-category]');
  const action = event.target.closest('[data-action]');
  const close = event.target.closest('[data-close-modal]');
  const authMode = event.target.closest('[data-auth-mode]');
  const number = event.target.closest('[data-number]');
  const demo = event.target.closest('[data-play-demo]');
  if (demo) {
    const form = demo.closest('#play-form');
    if (form) await playGame(form, true);
  } else if (open) {
    state.activeGame = GAMES.find((g) => g.id === open.dataset.openGame);
    state.selected = new Set();
    if (state.activeGame?.id === 'roulette') {
      state.rouletteStake = 100;
      state.rouletteBet = null;
      state.rouletteMenuOpen = false;
      state.rouletteBusy = false;
      state.rouletteResult = null;
      document.body.style.overflow = 'hidden';
      renderGameModal();
      const screen = document.querySelector('#roulette-fullscreen');
      if (screen?.requestFullscreen) screen.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    } else {
      state.gameStake = 100;
      state.gameMenuOpen = false;
      state.gameResult = null;
      state.gameSoundOn = true;
      state.selected = new Set();
      state.busy = false;
      document.body.style.overflow = 'hidden';
      renderGameModal();
      const screen = document.querySelector('#game-room-screen');
      if (screen?.requestFullscreen) screen.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    }
  } else if (category) {
    state.category = category.dataset.category;
    render();
  } else if (action?.dataset.action === 'login') renderAuthModal('login');
  else if (action?.dataset.action === 'register') renderAuthModal('register');
  else if (action?.dataset.action === 'logout') { await logoutAccount(); state.profile = null; }
  else if (action?.dataset.action === 'history') await showHistory();
  else if (action?.dataset.action === 'install-app') {
    if (state.installPrompt) {
      await state.installPrompt.prompt();
      await state.installPrompt.userChoice.catch(() => null);
      state.installPrompt = null;
      render();
    }
  }
  else if (action?.dataset.action === 'resend-verification') { try { await resendVerification(); toast('Nou voye yon nouvo imel verifikasyon.', 'success'); } catch (error) { toast(error.message, 'error'); } }
  else if (close) { document.body.style.overflow = ''; if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); state.activeGame = null; state.busy = false; document.querySelector('#modal-root').innerHTML = ''; }
  else if (authMode) renderAuthModal(authMode.dataset.authMode);
  else if (number && state.activeGame) {
    const max = state.activeGame.controls.find((f) => f.type === 'grid' || f.type === 'numbers')?.count || 5;
    const n = Number(number.dataset.number);
    if (state.selected.has(n)) state.selected.delete(n);
    else if (state.selected.size < max) state.selected.add(n);
    const field = state.activeGame.controls.find((f) => f.type === 'grid' || f.type === 'numbers');
    const count = document.querySelector('#selection-count');
    if (count) count.textContent = `${state.selected.size}/${field.count}`;
    number.classList.toggle('chosen', state.selected.has(n));
    number.setAttribute('aria-pressed', String(state.selected.has(n)));
    playRouletteSound(state.gameSoundOn, 'chip');
  }
});


root.addEventListener('keydown', (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.game-card[tabindex="0"]')) {
    event.preventDefault();
    event.target.querySelector('[data-open-game]')?.click();
  }
  if (event.key === 'Escape' && state.activeGame?.id === 'roulette' && !state.rouletteMenuOpen) {
    void closeRouletteGame();
  } else if (event.key === 'Escape' && state.activeGame && state.activeGame.id !== 'roulette' && !state.gameMenuOpen) {
    void closeGameRoom();
  }
});

root.addEventListener('input', (event) => {
  if (event.target.id === 'search') {
    state.query = event.target.value;
    const pos = event.target.selectionStart;
    render();
    const input = document.querySelector('#search');
    input?.focus(); input?.setSelectionRange(pos, pos);
  }
});

root.addEventListener('submit', async (event) => {
  if (event.target.id === 'auth-form') {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const button = event.target.querySelector('button[type="submit"]');
    button.disabled = true; button.textContent = 'Tanpri tann…';
    try {
      if (data.displayName) await registerAccount({ name: data.displayName, email: data.email, password: data.password });
      else await loginAccount({ email: data.email, password: data.password });
      document.querySelector('#modal-root').innerHTML = '';
      toast(data.displayName ? 'Kont la kreye. Verifye imel ou pou aktive jwèt yo.' : 'Ou konekte.', 'success');
    } catch (error) { toast(error.message, 'error'); button.disabled = false; button.textContent = data.displayName ? 'Kreye kont mwen' : 'Konekte'; }
  }
  if (event.target.id === 'play-form') {
    event.preventDefault();
    await playGame(event.target);
  }
});

async function syncProfile(user) {
  state.user = user;
  if (!user) { state.profile = null; state.activeGame = null; render(); return; }
  render();
  try {
    await api('/api/profile/bootstrap', { method: 'POST', body: { displayName: user.displayName || '' } });
    state.profile = await api('/api/me');
  } catch (error) {
    toast(error.message || 'Pa kapab chaje pwofil la. Verifye koneksyon backend.', 'error');
  }
  render();
}

render();
if (firebaseReady) {
  watchAuth((user) => syncProfile(user));
}

async function loadBackendHealth() {
  try { state.health = await api('/api/health'); }
  catch { state.health = { status: 'unreachable', firebaseConfigured: false, firebaseMissing: ['Worker API pa reponn'] }; }
  render();
}
loadBackendHealth();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}), { once: true });
}
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  state.installPrompt = event;
  render();
});
window.addEventListener('appinstalled', () => {
  state.installPrompt = null;
  toast('Kazino Lakay enstale sou aparèy ou.', 'success');
  render();
});

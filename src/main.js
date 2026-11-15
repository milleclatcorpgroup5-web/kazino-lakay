import './style.css';
import { GAMES, CATEGORIES } from './games/catalog.js';
import { firebaseReady, firebaseMissing, auth } from './firebase.js';
import { watchAuth, registerAccount, loginAccount, logoutAccount, resendVerification } from './auth.js';
import { api } from './api.js';
import { renderRouletteScreen, rouletteCardIcon, rouletteResultMarkup, animateRouletteSpin, playRouletteSound } from './games/roulette.js';

const root = document.querySelector('#app');
const state = { user: null, profile: null, health: null, gameControl: { globalEnabled: true, gameSettings: {} }, category: 'Tout jwèt', query: '', activeGame: null, selected: new Set(), busy: false, installPrompt: null, rouletteStake: 100, rouletteBets: [], rouletteBetHistory: [], rouletteMenuOpen: false, rouletteSoundOn: true, rouletteBusy: false, rouletteResult: null, gameStake: 100, gameMenuOpen: false, gameSoundOn: true, gameResult: null, penaltyTeam: 'haiti', penaltyOpponent: 'france', penaltyAim: null, penaltyGesture: null };

const PENALTY_TEAMS = [
  { id: 'haiti', name: 'Ayiti', flag: '🇭🇹', primary: '#123b89', secondary: '#d92e43' },
  { id: 'france', name: 'Lafrans', flag: '🇫🇷', primary: '#174b9b', secondary: '#f5f7fb' },
  { id: 'argentina', name: 'Ajantin', flag: '🇦🇷', primary: '#75bde8', secondary: '#f7f7f3' },
  { id: 'brazil', name: 'Brezil', flag: '🇧🇷', primary: '#e6c51e', secondary: '#168344' },
  { id: 'cameroon', name: 'Kamewoun', flag: '🇨🇲', primary: '#16864a', secondary: '#d82d37' },
  { id: 'england', name: 'Angletè', flag: '🏴', primary: '#f1f2f5', secondary: '#c92f45' },
  { id: 'germany', name: 'Almay', flag: '🇩🇪', primary: '#292b31', secondary: '#d1ad34' },
  { id: 'ghana', name: 'Gana', flag: '🇬🇭', primary: '#d52e36', secondary: '#e1c132' },
  { id: 'morocco', name: 'Mawòk', flag: '🇲🇦', primary: '#c51e36', secondary: '#16834c' },
  { id: 'nigeria', name: 'Nijerya', flag: '🇳🇬', primary: '#16864a', secondary: '#f2f4ed' },
  { id: 'senegal', name: 'Senegal', flag: '🇸🇳', primary: '#16834c', secondary: '#e0c13c' },
  { id: 'spain', name: 'Espay', flag: '🇪🇸', primary: '#cf283b', secondary: '#e9c33e' },
  { id: 'portugal', name: 'Pòtigal', flag: '🇵🇹', primary: '#bd263b', secondary: '#16864a' },
  { id: 'tunisia', name: 'Tinizi', flag: '🇹🇳', primary: '#d32b36', secondary: '#f5f0e8' },
  { id: 'southafrica', name: 'Afrik di Sid', flag: '🇿🇦', primary: '#16834d', secondary: '#d8bd36' },
  { id: 'ivorycoast', name: 'Kotdivwa', flag: '🇨🇮', primary: '#ef8c26', secondary: '#16864a' }
];
const PENALTY_ZONE_POINTS = {
  'top-left': { x: .22, y: .08 }, 'top-center': { x: .50, y: .08 }, 'top-right': { x: .78, y: .08 },
  'middle-left': { x: .22, y: .50 }, 'middle-center': { x: .50, y: .50 }, 'middle-right': { x: .78, y: .50 },
  'bottom-left': { x: .22, y: .92 }, 'bottom-center': { x: .50, y: .92 }, 'bottom-right': { x: .78, y: .92 }
};
const PENALTY_ZONE_NAMES = { 'top-left':'Anwo agoch', 'top-center':'Anwo mitan', 'top-right':'Anwo adwat', 'middle-left':'Mitan agoch', 'middle-center':'Mitan', 'middle-right':'Mitan adwat', 'bottom-left':'Anba agoch', 'bottom-center':'Anba mitan', 'bottom-right':'Anba adwat' };
const getPenaltyTeam = (id) => PENALTY_TEAMS.find((team) => team.id === id) || PENALTY_TEAMS[0];
const randomPenaltyOpponent = (teamId) => { const options = PENALTY_TEAMS.filter((team) => team.id !== teamId); return options[Math.floor(Math.random() * options.length)]; };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const esc = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const fmt = (n = 0) => Math.floor(Number(n) || 0).toLocaleString('fr-FR');

function toast(message, type = 'info', duration = 3200) {
  const node = document.querySelector('#toast');
  if (!node) return;
  node.textContent = message;
  node.dataset.type = type;
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), duration);
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
    <div class="stage-visual stage-visual-3d" data-render-mode="3d">${content}</div>
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
      const team = getPenaltyTeam(d.team || state.penaltyTeam);
      const opponent = getPenaltyTeam(d.opponent || state.penaltyOpponent);
      const shot = d.shot || state.penaltyAim?.zone || '';
      const keeper = d.keeper || '';
      const goal = Boolean(d.goal);
      const point = PENALTY_ZONE_POINTS[shot] || state.penaltyAim || { x: .5, y: .5 };
      const aimTop = 22 + Number(point.y ?? .5) * 34;
      const aimLeft = Number(point.x ?? .5) * 100;
      const power = Number(d.power || state.penaltyAim?.power || .65);
      const label = details ? (goal ? 'GÒL!' : 'GADYEN AN BLOKE TIR LA') : 'GLISE SOTI SOU BALÒN AN';
      const zoneLabel = keeper ? (PENALTY_ZONE_NAMES[keeper] || keeper) : '';
      return stageFrame(gameId, 'Penalty Lakay', 'Kenbe boul la, glise dwèt ou nan gòl la, epi gade jwè a choute pandan gadyen an plonje.', `<div class="penalty-field" data-team="${team.id}" ${shot ? `data-shot="${esc(shot)}"` : ''} ${keeper ? `data-keeper="${esc(keeper)}"` : ''} ${details ? `data-goal="${goal}"` : ''} data-power="${Math.round(power * 100)}" style="--team-primary:${team.primary};--team-secondary:${team.secondary}">
        <div class="penalty-crowd" aria-hidden="true"></div><div class="penalty-stadium-lights" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <div class="penalty-matchup" data-penalty-matchup><span><b>${team.flag}</b>${esc(team.name)}</span><strong>VS</strong><span><b>${opponent.flag}</b>${esc(opponent.name)}</span><small>ADVÈSÈ OTÒMATIK</small></div>
        <div class="penalty-goal-frame"><div class="penalty-goal-net"></div><i class="penalty-post post-left"></i><i class="penalty-post post-right"></i><i class="penalty-crossbar"></i></div>
        <div class="penalty-goal-shadow"></div>
        <svg class="penalty-aim-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1="50" y1="82" x2="${aimLeft}" y2="${aimTop}" /></svg>
        <div class="penalty-aim-dot" data-penalty-aim-dot ${shot || state.penaltyAim ? `style="left:${aimLeft}%;top:${aimTop}%"` : 'hidden'}></div>
        <div class="penalty-keeper ${details ? `keeper-${goal ? 'missed' : 'saved'}` : ''}" data-penalty-keeper>
          <svg viewBox="0 0 210 190" role="img" aria-label="Gadyen foutbòl devan gòl la">
            <ellipse cx="105" cy="177" rx="61" ry="8" fill="#00150b" opacity=".45"/>
            <g class="keeper-body"><path d="M87 42 Q105 31 123 42 L143 100 Q132 118 105 119 Q78 118 67 100Z" fill="#f3c629" stroke="#9b7713" stroke-width="3"/><path d="M93 47 L105 61 L117 47" fill="none" stroke="#fff1ac" stroke-width="4"/><path d="M88 111 L75 148 L91 174 L106 174 L108 130 L119 174 L137 174 L144 149 L123 111Z" fill="#171f28" stroke="#090f16" stroke-width="3"/><path d="M79 53 Q59 55 43 80 L24 112" fill="none" stroke="#f3c629" stroke-width="18" stroke-linecap="round"/><path d="M131 53 Q151 55 167 80 L186 112" fill="none" stroke="#f3c629" stroke-width="18" stroke-linecap="round"/><path d="M24 112 l-13 8 4 15 17 2 10-13zM186 112 l13 8-4 15-17 2-10-13z" fill="#f4f5f4" stroke="#c6d0d2" stroke-width="3"/><path d="M77 148 L52 177 L72 182 L94 156M132 148 L158 177 L138 182 L116 156" fill="none" stroke="#f1c09a" stroke-width="13" stroke-linecap="round"/><path d="M45 179 l-4 8 38 0 2-9M125 178 l3 9 40 0-6-9" fill="#101820"/><circle cx="105" cy="25" r="17" fill="#9a6546" stroke="#563b2c" stroke-width="2"/><path d="M89 23 Q90 5 106 7 Q122 7 122 25" fill="#25201e"/></g>
          </svg>
        </div>
        <div class="penalty-striker" data-penalty-striker>
          <svg viewBox="0 0 150 250" role="img" aria-label="Jwè k ap pran elan pou choute boul la">
            <ellipse cx="76" cy="242" rx="40" ry="6" fill="#00150b" opacity=".45"/>
            <g class="striker-body"><circle cx="74" cy="25" r="15" fill="#9a6546"/><path d="M60 21 Q62 5 77 8 Q91 9 89 24" fill="#201c1b"/><path d="M67 40 L86 40 L98 55 L106 116 L91 133 L48 130 L40 62 L54 44Z" fill="var(--team-primary)" stroke="#071b39" stroke-width="3"/><path d="M64 43 L75 58 L88 43" fill="none" stroke="var(--team-secondary)" stroke-width="5"/><path d="M58 55 L38 76 L29 111" fill="none" stroke="#9a6546" stroke-width="13" stroke-linecap="round"/><path d="M94 57 L111 76 L120 103" fill="none" stroke="#9a6546" stroke-width="13" stroke-linecap="round"/><path d="M47 126 L95 128 L105 157 L78 164 L43 155Z" fill="#f0f3f4"/><g class="striker-plant-leg"><path d="M49 154 L46 190 L34 225" fill="none" stroke="#9a6546" stroke-width="17" stroke-linecap="round"/><path d="M34 221 L21 235 L57 238 L62 228Z" fill="#101820"/></g><g class="striker-kick-leg"><path d="M89 155 L102 185 L119 210" fill="none" stroke="#9a6546" stroke-width="17" stroke-linecap="round"/><path d="M112 205 L133 211 L143 224 L105 226 L100 217Z" fill="#101820"/></g><text x="73" y="96" fill="var(--team-secondary)" font-size="23" font-weight="1000" text-anchor="middle">10</text></g>
          </svg>
        </div>
        <button type="button" class="penalty-ball" data-penalty-ball aria-label="Kenbe epi glise boul foutbòl la"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="45" fill="#f7f8f4" stroke="#aeb6b6" stroke-width="3"/><path d="M50 30 63 39 58 54 42 54 37 39Z" fill="#18212b"/><path d="m50 7 12 8-4 14-8 1-8-1-4-14zM86 32l-3 15-14 4-6-12 7-10zM78 82 63 89 55 77 61 63l15 1zM22 82l3-15 14-4 6 12-7 10zM14 32l15-3 8 12-8 11-14-5z" fill="#17212a"/><path d="M42 54 25 63M58 54 61 63M37 39 29 29M63 39 70 28" fill="none" stroke="#303942" stroke-width="3"/></svg></button>
        <div class="penalty-aim-help" data-penalty-hint>${details ? (goal ? 'BÒL LA NAN FILE!' : `GADYEN AN PLONJE: ${esc(zoneLabel.toUpperCase())}`) : (state.penaltyAim ? `VIZE: ${esc(PENALTY_ZONE_NAMES[state.penaltyAim.zone] || '')} • ${Math.round(state.penaltyAim.power * 100)}% PISANS` : 'KENBE ⚽ LA EPI GLISE DWÈT OU NAN DIREKSYON OU VLE TIRE A')}</div>
        <button type="button" class="penalty-random-button" data-penalty-random ${details ? 'disabled' : ''}>🎲 VIZE O AZA</button>
        <div class="penalty-goal-status ${details ? goal ? 'status-goal' : 'status-save' : ''}" data-penalty-status>${details ? (goal ? '⚽ GÒL!' : '🧤 ARRÈT!') : 'TIRE NAN 9 ZÒN YO'}</div>
      </div>`, phase);
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

function isGameAvailable(gameId) {
  return state.gameControl?.globalEnabled !== false && state.gameControl?.gameSettings?.[gameId] !== false;
}
function gameCard(game) {
  const art = game.id === 'roulette' ? rouletteCardIcon() : gameCardIcon(game);
  const available = isGameAvailable(game.id);
  return `<article class="game-card game-${game.tone} ${available ? '' : 'game-card-disabled'}" ${available ? `data-open-game="${game.id}" tabindex="0"` : 'aria-disabled="true"'} aria-label="${available ? 'Louvri' : 'Sispann'} ${esc(game.name)}">
    <div class="game-card-art"><span class="game-card-artwork">${art}</span><span class="game-category">${esc(game.category)}</span>${available ? '' : '<span class="game-paused-badge">SISPANN</span>'}</div>
    <div class="game-card-body"><h3>${esc(game.name)}</h3><p>${esc(game.summary)}</p>
      <button class="button button-small ${available ? 'button-primary' : 'button-ghost'}" type="button" ${available ? `data-open-game="${game.id}"` : 'disabled'}>${available ? 'Louvri jwèt la' : 'Tanporèman sispann'}</button></div>
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
      <button class="button button-ghost" data-action="install-app">${state.installPrompt ? 'Enstale app' : 'Kijan pou enstale?'}</button>
      ${state.user ? `<button class="button button-ghost" data-action="history">Istwa</button><span class="user-label">${esc(state.user.displayName || state.user.email || 'Jwè')}</span><button class="button button-ghost" data-action="logout">Dekonekte</button>` : `<button class="button button-ghost" data-action="login">Konekte</button><button class="button button-primary" data-action="register">Kreye kont</button>`}
    </div></header>
    <main id="top" class="shell">
      ${!firebaseReady ? `<div class="config-alert"><strong>Kont jwè yo poko aktive.</strong><span>Konfigirasyon frontend Firebase ki manke: ${firebaseMissing.map(esc).join(', ')}. Mete valè piblik Firebase Web App yo nan Cloudflare Worker Variables; jwèt DEMO yo ap kontinye mache pandan sa.</span></div>` : ''}
      ${state.health && state.health.frontendFirebaseConfigured === false ? `<div class="config-alert"><strong>Konfigirasyon Firebase Web la manke.</strong><span>Mete paramèt piblik yo nan Cloudflare Worker Variables: ${(state.health.frontendFirebaseMissing || []).map(esc).join(', ')}.</span></div>` : ''}
      ${state.health && !state.health.firebaseConfigured ? `<div class="config-alert"><strong>Backend Firebase poko konekte.</strong><span>Kont, balans pwen ki sove, istwa ak Admin ap rete bloke jiskaske service account Firebase la konfigire. Paramèt ki manke: ${(state.health.firebaseMissing || []).map(esc).join(', ') || 'verifye kle prive a'}.</span></div>` : ''}
      ${state.gameControl?.globalEnabled === false ? `<div class="config-alert"><strong>Jwèt yo sou poz.</strong><span>${esc(state.gameControl.maintenanceMessage || 'Administrasyon an mete tout jwèt yo sou poz pou kounye a.')}</span></div>` : ''}
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
    if (game.id === 'penalty' && field.id === 'team') {
      const current = state.penaltyTeam || field.value || 'haiti';
      return `<section class="kl-control-group penalty-team-control"><div class="kl-control-heading"><span>DRAPO EKIP OU</span><b>ADVÈSÈ A CHWAZI OTÒMATIKMAN</b></div><input type="hidden" name="team" value="${esc(current)}" data-choice-input="team"><div class="penalty-team-grid">${PENALTY_TEAMS.map((team) => `<button type="button" class="penalty-team-chip ${team.id === current ? 'is-active' : ''}" data-game-choice="team" data-choice-value="${team.id}" aria-pressed="${team.id === current}"><span>${team.flag}</span><b>${esc(team.name)}</b></button>`).join('')}</div></section>`;
    }
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
      bets: state.rouletteBets,
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
      <div class="kl-game-overline"><span class="kl-live-indicator"><i></i>${state.busy ? 'WONN AN KOU' : 'TAB JWÈT'} </span><span>${esc(game.category.toUpperCase())} • ${GAMES.length} JWE • <b class="difficulty-badge">NIVO DIFISIL</b></span></div>
      <div class="kl-stage-wrap">${renderGameStage(game.id, null, 'idle')}</div>
      <form id="play-form" class="kl-play-panel"><input type="hidden" name="stakePoints" value="${state.gameStake}" data-stake-input>${gameChoiceMarkup(game)}${game.id === 'penalty' ? '<input type="hidden" name="shot" value="" data-penalty-shot><input type="hidden" name="power" value="0.65" data-penalty-power><input type="hidden" name="opponent" value="" data-penalty-opponent>' : ''}</form>
    </main>
    <footer class="kl-game-footer"><div class="kl-chip-select"><span class="kl-chip-label">JETON</span>${[10,50,100,500].map((value)=>`<button type="button" class="kl-chip kl-chip-${value} ${value===state.gameStake?'is-active':''}" data-game-action="stake" data-stake-value="${value}" aria-pressed="${value===state.gameStake}"><b>${value}</b><small>P</small></button>`).join('')}</div>
      <div class="kl-game-actions"><span class="kl-demo-disclaimer">DEMO • NIVO DIFISIL • PWEN SAN VALÈ LAJAN</span><button type="button" class="kl-play-account" data-game-action="account" ${canAccountPlay?'':'disabled'}>Jwe ak balans</button><button type="button" class="kl-play-demo" data-game-action="demo" ${state.busy?'disabled':''}>${state.busy?'WONN NAN AP KALKILE…':'JWE DEMO'}</button></div>
    </footer>
    <aside class="kl-menu-layer" data-game-menu-layer ${state.gameMenuOpen?'':'hidden'}><button class="kl-menu-backdrop" type="button" data-game-action="menu-close" aria-label="Fèmen meni"></button><section class="kl-menu-panel" role="dialog" aria-modal="true" aria-labelledby="kl-menu-title"><div class="kl-menu-head"><div><small>KAZINO LAKAY</small><h2 id="kl-menu-title">Gid jwèt la</h2></div><button type="button" data-game-action="menu-close" class="kl-menu-close" aria-label="Fèmen">×</button></div>${rules}<div class="kl-menu-actions"><button type="button" data-game-action="sound" class="kl-menu-action">${state.gameSoundOn?'🔊 Son aktive':'🔇 Son dezaktive'}</button><button type="button" data-game-action="back" class="kl-menu-action">← Retounen nan lis jwèt yo</button></div><p class="kl-menu-disclaimer">Mòd demonstrasyon sèlman. Pwen yo pa gen valè lajan; yo pa kapab achte, vann, transfere oswa retire.</p></section></aside>
    <div class="kl-result-layer" data-game-result-layer hidden></div>
  </section>`;
}


function updateRouletteControls() {
  const screen = document.querySelector('#roulette-fullscreen');
  if (!screen) return;
  const bets = state.rouletteBets || [];
  const totalStake = bets.reduce((sum, bet) => sum + Number(bet.stakePoints || 0), 0);
  screen.querySelectorAll('[data-roulette-action="bet"]').forEach((button) => {
    const match = bets.find((bet) => bet.betType === button.dataset.betType && String(bet.betValue) === String(button.dataset.betValue));
    const amount = Number(match?.stakePoints || 0);
    button.classList.toggle('is-selected', amount > 0);
    button.setAttribute('aria-pressed', String(amount > 0));
    const marker = button.querySelector('.rr-chip-marker');
    if (marker) marker.textContent = amount ? String(amount) : '';
  });
  const label = screen.querySelector('[data-roulette-bet-label]');
  if (label) label.textContent = bets.length ? `${bets.length} pari sou tab la · ${totalStake.toLocaleString('fr-FR')} P` : 'Chwazi plizyè kote pou mete jeton';
  const total = screen.querySelector('[data-roulette-total-stake]');
  if (total) total.textContent = totalStake.toLocaleString('fr-FR');
  const count = screen.querySelector('[data-roulette-bet-count]');
  if (count) count.textContent = String(bets.length);
  const stake = screen.querySelector('[data-roulette-stake]');
  if (stake) stake.textContent = `${state.rouletteStake} P`;
  screen.querySelectorAll('[data-roulette-action="chip"]').forEach((button) => {
    const active = Number(button.dataset.chipValue) === state.rouletteStake;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const demo = screen.querySelector('[data-roulette-action="demo"]');
  const account = screen.querySelector('[data-roulette-action="account"]');
  const undo = screen.querySelector('[data-roulette-action="undo"]');
  const clear = screen.querySelector('[data-roulette-action="clear"]');
  const canAccountPlay = Boolean(state.user && state.user.emailVerified && firebaseReady && state.health?.firebaseConfigured === true);
  const overLimit = totalStake > 1000;
  if (demo) { demo.disabled = state.rouletteBusy || !bets.length || overLimit; demo.textContent = state.rouletteBusy ? 'WOU A AP VIRE…' : `VIRE WOU A · ${totalStake} P`; }
  if (account) account.disabled = state.rouletteBusy || !bets.length || overLimit || !canAccountPlay;
  if (undo) undo.disabled = state.rouletteBusy || !bets.length;
  if (clear) clear.disabled = state.rouletteBusy || !bets.length;
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
  if (!isGameAvailable('roulette')) return toast(state.gameControl?.maintenanceMessage || 'Roulèt la tanporèman sispann.', 'warning');
  const bets = (state.rouletteBets || []).map((bet) => ({ ...bet }));
  const totalStake = bets.reduce((sum, bet) => sum + Number(bet.stakePoints || 0), 0);
  if (!bets.length) return toast('Mete omwen yon pari anvan ou vire wou a.', 'warning');
  if (!Number.isInteger(totalStake) || totalStake < 10 || totalStake > 1000) return toast('Total pari yo dwe ant 10 ak 1 000 pwen.', 'warning');
  if (!demoMode && !state.user) return toast('Konekte anvan ou jwe ak pwen kont ou.', 'warning');
  if (!demoMode && !state.user.emailVerified) return toast('Verifye imel ou anvan ou jwe ak pwen kont ou.', 'warning');
  if (!demoMode && (!firebaseReady || state.health?.firebaseConfigured !== true)) return toast('Firebase poko konfigire. Sèvi ak mòd demonstrasyon pou kounye a.', 'warning');
  if (state.rouletteBusy) return;
  state.rouletteBusy = true;
  const screen = document.querySelector('#roulette-fullscreen');
  const status = screen?.querySelector('[data-roulette-status]');
  if (status) status.textContent = 'SÈVÈ A AP KONFIME TOUT PARI YO';
  updateRouletteControls();
  playRouletteSound(state.rouletteSoundOn, 'spin');
  try {
    const choice = { bets };
    const response = await api(demoMode ? '/api/games/demo' : '/api/games/play', {
      method: 'POST',
      body: { gameId: 'roulette', stakePoints: totalStake, choice }
    });
    const gameResult = response.result;
    await animateRouletteSpin(screen, gameResult.details.number);
    if (!demoMode) {
      state.profile = { ...(state.profile || {}), pointsBalance: response.balancePoints };
      renderTopbarOnly();
      const balance = screen?.querySelector('[data-roulette-balance]');
      if (balance) balance.textContent = `${fmt(response.balancePoints)} P`;
    }
    const resultForScreen = { ...gameResult, stakePoints: totalStake, demoMode, message: gameResult.message };
    state.rouletteResult = resultForScreen;
    const layer = screen?.querySelector('[data-roulette-result-layer]');
    if (layer) { layer.innerHTML = rouletteResultMarkup(resultForScreen); layer.hidden = false; }
    if (status) status.textContent = 'REZILTA KONFIME';
    const last = screen?.querySelector('[data-roulette-last]');
    if (last) last.textContent = String(gameResult.details.number);
    playRouletteSound(state.rouletteSoundOn, gameResult.payoutPoints > totalStake ? 'win' : 'loss');
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
    const betType = button.dataset.betType;
    const betValue = betType === 'number' || betType === 'dozen' || betType === 'column' ? Number(button.dataset.betValue) : button.dataset.betValue;
    const bets = state.rouletteBets || (state.rouletteBets = []);
    const existing = bets.find((bet) => bet.betType === betType && String(bet.betValue) === String(betValue));
    const total = bets.reduce((sum, bet) => sum + Number(bet.stakePoints || 0), 0);
    if (total + state.rouletteStake > 1000) return toast('Limit total paryaj la se 1 000 pwen pou chak wonn.', 'warning');
    if (!existing && bets.length >= 30) return toast('Ou rive nan limit 30 pari diferan pou yon sèl wonn.', 'warning');
    state.rouletteBetHistory.push({ betType, betValue, stakePoints: state.rouletteStake });
    if (existing) existing.stakePoints += state.rouletteStake;
    else bets.push({ betType, betValue, stakePoints: state.rouletteStake });
    state.rouletteResult = null;
    const layer = document.querySelector('[data-roulette-result-layer]');
    if (layer) { layer.hidden = true; layer.innerHTML = ''; }
    playRouletteSound(state.rouletteSoundOn, 'chip');
    updateRouletteControls();
  } else if (action === 'undo') {
    if (state.rouletteBusy || !state.rouletteBetHistory.length) return;
    const last = state.rouletteBetHistory.pop();
    const item = state.rouletteBets.find((bet) => bet.betType === last.betType && String(bet.betValue) === String(last.betValue));
    if (item) { item.stakePoints -= last.stakePoints; if (item.stakePoints <= 0) state.rouletteBets = state.rouletteBets.filter((bet) => bet !== item); }
    state.rouletteResult = null;
    const layer = document.querySelector('[data-roulette-result-layer]');
    if (layer) { layer.hidden = true; layer.innerHTML = ''; }
    updateRouletteControls();
  } else if (action === 'clear') {
    if (state.rouletteBusy) return;
    state.rouletteBets = []; state.rouletteBetHistory = []; state.rouletteResult = null;
    const layer = document.querySelector('[data-roulette-result-layer]');
    if (layer) { layer.hidden = true; layer.innerHTML = ''; }
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
    if (state.activeGame?.id === 'penalty') {
      state.penaltyAim = null;
      const stage = document.querySelector('.kl-stage-wrap .casino-stage');
      if (stage) stage.outerHTML = renderGameStage('penalty', null, 'idle');
      const shotInput = document.querySelector('[data-penalty-shot]');
      if (shotInput) shotInput.value = '';
      const powerInput = document.querySelector('[data-penalty-power]');
      if (powerInput) powerInput.value = '0.65';
    }
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
  if (state.activeGame?.id === 'penalty' && fieldId === 'team') {
    state.penaltyTeam = value;
    state.penaltyOpponent = randomPenaltyOpponent(value).id;
    const opponent = getPenaltyTeam(state.penaltyOpponent);
    const selected = getPenaltyTeam(value);
    const field = document.querySelector('.penalty-field');
    if (field) {
      field.dataset.team = selected.id;
      field.style.setProperty('--team-primary', selected.primary);
      field.style.setProperty('--team-secondary', selected.secondary);
      const matchup = field.querySelector('[data-penalty-matchup]');
      if (matchup) matchup.innerHTML = `<span class="penalty-home-team"><b>${selected.flag}</b><em>${esc(selected.name)}</em></span><strong class="penalty-score">0<i>:</i>0</strong><span class="penalty-away-team"><b>${opponent.flag}</b><em>${esc(opponent.name)}</em></span><small>SHOOTOUT</small>`;
    }
    const opponentInput = document.querySelector('[data-penalty-opponent]');
    if (opponentInput) opponentInput.value = state.penaltyOpponent;
  }
  playRouletteSound(state.gameSoundOn, 'click');
}

function penaltyAimFromPoint(field, clientX, clientY) {
  const rect = field.getBoundingClientRect();
  const originX = rect.left + rect.width * .5;
  const originY = rect.top + rect.height * .82;
  const dx = clientX - originX;
  const dy = clientY - originY;
  if (dy > -14) return null;
  // Kat jaden an an 3 kolòn ak 3 ranje reyèl anndan zòn gòl la.
  const x = clamp((clientX - rect.left) / rect.width, .08, .92);
  const y = clamp(((clientY - rect.top) / rect.height - .22) / .36, .08, .92);
  const column = x < .34 ? 'left' : x > .66 ? 'right' : 'center';
  const row = y < .34 ? 'top' : y > .66 ? 'bottom' : 'middle';
  const power = clamp(Math.hypot(dx, dy) / (rect.height * .72), .3, 1);
  return { zone: `${row}-${column}`, x, y, power };
}

function showPenaltyAim(field, aim, save = true) {
  if (!field || !aim) return;
  const top = 22 + aim.y * 34;
  const left = aim.x * 100;
  const dot = field.querySelector('[data-penalty-aim-dot]');
  const line = field.querySelector('.penalty-aim-line line');
  if (dot) { dot.hidden = false; dot.style.left = `${left}%`; dot.style.top = `${top}%`; }
  if (line) { line.setAttribute('x2', String(left)); line.setAttribute('y2', String(top)); }
  field.dataset.shot = aim.zone;
  field.dataset.power = String(Math.round(aim.power * 100));
  field.classList.add('has-aim');
  const hint = field.querySelector('[data-penalty-hint]');
  if (hint) hint.textContent = `VIZE: ${PENALTY_ZONE_NAMES[aim.zone]} • ${Math.round(aim.power * 100)}% PISANS`;
  const status = field.querySelector('[data-penalty-status]');
  if (status) status.textContent = 'VIZE A PARE • PEZE JWE';
  if (save) {
    state.penaltyAim = aim;
    const shotInput = document.querySelector('[data-penalty-shot]');
    const powerInput = document.querySelector('[data-penalty-power]');
    if (shotInput) shotInput.value = aim.zone;
    if (powerInput) powerInput.value = String(aim.power.toFixed(2));
  }
}

function setRandomPenaltyAim() {
  const zones = Object.keys(PENALTY_ZONE_POINTS);
  const zone = zones[Math.floor(Math.random() * zones.length)];
  const point = PENALTY_ZONE_POINTS[zone];
  const aim = { zone, x: point.x, y: point.y, power: .72 };
  const field = document.querySelector('.penalty-field');
  if (field) showPenaltyAim(field, aim, true);
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
  if (game.id === 'penalty') {
    if (!state.penaltyAim) throw new Error('Kenbe boul la epi glise dwèt ou nan direksyon kote ou vle tire a.');
    choice.shot = state.penaltyAim.zone;
    choice.power = Number(state.penaltyAim.power.toFixed(2));
    choice.team = String(data.get('team') || state.penaltyTeam || 'haiti');
    choice.opponent = String(data.get('opponent') || state.penaltyOpponent || 'france');
  }
  return choice;
}

async function playGame(form, demoMode = false) {
  const game = state.activeGame;
  if (!game) return;
  if (!isGameAvailable(game.id)) return toast(state.gameControl?.maintenanceMessage || 'Jwèt sa a tanporèman sispann.', 'warning');
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

async function animatePenaltySequence(stage) {
  const field = stage.querySelector('.penalty-field');
  if (!field) return;
  const striker = field.querySelector('[data-penalty-striker]');
  const kickLeg = field.querySelector('.striker-kick-leg');
  const keeper = field.querySelector('[data-penalty-keeper]');
  const ball = field.querySelector('[data-penalty-ball]');
  const rect = field.getBoundingClientRect();
  const shot = field.dataset.shot || 'middle-center';
  const keeperZone = field.dataset.keeper || 'middle-center';
  const shotPoint = PENALTY_ZONE_POINTS[shot] || PENALTY_ZONE_POINTS['middle-center'];
  const keeperPoint = PENALTY_ZONE_POINTS[keeperZone] || PENALTY_ZONE_POINTS['middle-center'];
  const goal = field.dataset.goal === 'true';
  const dx = (shotPoint.x - .5) * rect.width;
  const dy = ((.22 + shotPoint.y * .34) - .82) * rect.height;
  const kdx = (keeperPoint.x - .5) * rect.width * .78;
  const kdy = ((.22 + keeperPoint.y * .34) - .42) * rect.height * .72;
  const rotation = keeperPoint.x < .4 ? -68 : keeperPoint.x > .6 ? 68 : keeperPoint.y < .3 ? -18 : keeperPoint.y > .7 ? 18 : (keeperPoint.x < .5 ? -28 : 28);
  const power = clamp(Number(field.dataset.power || 65) / 100, .3, 1);
  const duration = Math.round(1050 - power * 250);
  stage.classList.add('phase-rolling');
  field.classList.add('is-shooting');
  const animations = [];
  const runDistance = rect.width * .15;
  if (striker?.animate) animations.push(striker.animate([
    { transform: 'translate3d(0,0,0) rotate(0deg)' },
    { transform: `translate3d(${runDistance * .32}px,-${rect.height * .012}px,0) rotate(-3deg)`, offset: .3 },
    { transform: `translate3d(${runDistance * .72}px,-${rect.height * .026}px,0) rotate(2deg)`, offset: .68 },
    { transform: `translate3d(${runDistance}px,-${rect.height * .035}px,0) rotate(5deg)` }
  ], { duration: 820, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }));
  if (kickLeg?.animate) animations.push(kickLeg.animate([
    { transform: 'rotate(0deg)' },
    { transform: 'rotate(-10deg)', offset: .28 },
    { transform: 'rotate(-54deg)', offset: .72 },
    { transform: 'rotate(30deg)' }
  ], { duration: 690, delay: 315, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }));
  if (keeper?.animate) animations.push(keeper.animate([
    { transform: 'translate(-50%,-50%) rotate(0deg) scale(1)' },
    { transform: `translate(calc(-50% + ${kdx * .42}px),calc(-50% + ${kdy * .38}px)) rotate(${rotation * .45}deg) scale(1.05)`, offset: .38 },
    { transform: `translate(calc(-50% + ${kdx}px),calc(-50% + ${kdy}px)) rotate(${rotation}deg) scale(1.1)` }
  ], { duration: 590, delay: 360, easing: 'cubic-bezier(.15,.72,.25,1)', fill: 'forwards' }));
  if (ball?.animate) {
    const kickFrames = [
      { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', offset: 0 },
      { transform: `translate(calc(-50% + ${dx * .42}px),calc(-50% + ${dy * .48 - rect.height * .08}px)) scale(.72) rotate(260deg)`, offset: .5 }
    ];
    if (goal) kickFrames.push({ transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.36) rotate(650deg)`, offset: 1 });
    else kickFrames.push({ transform: `translate(calc(-50% + ${dx * .74}px),calc(-50% + ${dy * .72}px)) scale(.5) rotate(440deg)`, offset: 1 });
    animations.push(ball.animate(kickFrames, { duration, delay: 445, easing: 'cubic-bezier(.25,.15,.3,1)', fill: 'forwards' }));
  }
  await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
  field.classList.remove('is-shooting');
  field.classList.add(goal ? 'is-goal' : 'is-saved');
  stage.classList.remove('phase-rolling');
  stage.classList.add('phase-settled');
  stage.dataset.phase = 'settled';
}

async function animateResult(panel, gameId) {
  const stage = panel.querySelector('.casino-stage');
  if (!stage) return;
  if (gameId === 'penalty') {
    await animatePenaltySequence(stage);
    return;
  }
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
    if (!isGameAvailable(open.dataset.openGame)) return toast('Jwèt sa a tanporèman sispann pa administrasyon an.', 'warning');
    state.activeGame = GAMES.find((g) => g.id === open.dataset.openGame);
    state.selected = new Set();
    if (state.activeGame?.id === 'roulette') {
      state.rouletteStake = 100;
      state.rouletteBets = [];
      state.rouletteBetHistory = [];
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
      state.penaltyAim = null;
      state.penaltyGesture = null;
      if (state.activeGame?.id === 'penalty') {
        state.penaltyTeam = 'haiti';
        state.penaltyOpponent = randomPenaltyOpponent(state.penaltyTeam).id;
      }
      document.body.style.overflow = 'hidden';
      renderGameModal();
      const penaltyOpponentInput = document.querySelector('[data-penalty-opponent]');
      if (penaltyOpponentInput) penaltyOpponentInput.value = state.penaltyOpponent;
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
      const promptEvent = state.installPrompt;
      state.installPrompt = null;
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice.catch(() => null);
      if (choice?.outcome === 'accepted') toast('Enstalasyon an ap fini. Chèche Kazino Lakay sou ekran prensipal la.', 'success', 6500);
      render();
    } else {
      const ua = navigator.userAgent || '';
      let help;
      if (/iPhone|iPad|iPod/i.test(ua)) help = 'Sou iPhone/iPad: ouvri paj la nan Safari, peze bouton Pataje a, epi chwazi “Add to Home Screen / Ajoute sou ekran dakèy”.';
      else if (/Android/i.test(ua)) help = 'Sou Android: ouvri sit la nan Google Chrome, peze meni ⋮ anlè adwat, epi chwazi “Install app / Enstale app” oswa “Add to Home screen”. Si opsyon an pa parèt, verifye w sou adrès HTTPS la epi rafrechi paj la.';
      else help = 'Sou òdinatè: nan Chrome oswa Edge, ouvri meni navigatè a epi chwazi “Install Kazino Lakay” oswa itilize ikòn enstalasyon ki nan ba adrès la.';
      toast(help, 'info', 8500);
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


root.addEventListener('click', (event) => {
  const randomAim = event.target.closest('[data-penalty-random]');
  if (randomAim && state.activeGame?.id === 'penalty' && !state.busy) {
    setRandomPenaltyAim();
    playRouletteSound(state.gameSoundOn, 'click');
  }
});

root.addEventListener('pointerdown', (event) => {
  const ball = event.target.closest('[data-penalty-ball]');
  if (!ball || state.activeGame?.id !== 'penalty' || state.busy) return;
  const field = ball.closest('.penalty-field');
  if (!field) return;
  event.preventDefault();
  const rect = field.getBoundingClientRect();
  state.penaltyGesture = { pointerId: event.pointerId, field, rect };
  try { field.setPointerCapture(event.pointerId); } catch { /* Pointer capture pa obligatwa sou tout navigatè. */ }
  field.classList.add('is-aiming');
});

root.addEventListener('pointermove', (event) => {
  const gesture = state.penaltyGesture;
  if (!gesture || gesture.pointerId !== event.pointerId || state.activeGame?.id !== 'penalty') return;
  event.preventDefault();
  const aim = penaltyAimFromPoint(gesture.field, event.clientX, event.clientY);
  if (aim) showPenaltyAim(gesture.field, aim, false);
});

root.addEventListener('pointerup', (event) => {
  const gesture = state.penaltyGesture;
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  const aim = penaltyAimFromPoint(gesture.field, event.clientX, event.clientY);
  gesture.field.classList.remove('is-aiming');
  state.penaltyGesture = null;
  if (!aim) { toast('Glise dwèt ou anlè soti sou boul la pou vize gòl la.', 'warning'); return; }
  showPenaltyAim(gesture.field, aim, true);
  playRouletteSound(state.gameSoundOn, 'click');
});

root.addEventListener('pointercancel', (event) => {
  if (state.penaltyGesture?.pointerId === event.pointerId) {
    state.penaltyGesture.field.classList.remove('is-aiming');
    state.penaltyGesture = null;
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
  try {
    state.health = await api('/api/health');
  } catch {
    state.health = { status: 'unreachable', firebaseConfigured: false, firebaseMissing: ['Worker API pa reponn'] };
  }
  try {
    const catalog = await api('/api/games');
    state.gameControl = {
      globalEnabled: catalog.enabled !== false,
      gameSettings: catalog.gameSettings || {},
      maintenanceMessage: catalog.maintenanceMessage || ''
    };
  } catch (error) {
    // Fail closed in the UI if a configured Worker cannot read the admin game switches.
    const diagnostic = state.health?.gameControlReadError || error?.message || 'Sistèm nan pa kapab verifye estati jwèt yo kounye a.';
    state.gameControl = { globalEnabled: false, gameSettings: {}, maintenanceMessage: diagnostic };
    console.error('[Kazino Lakay] Game-control check failed:', diagnostic);
  }
  render();
}
loadBackendHealth();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => registration.update().catch(() => {}))
      .catch((error) => {
        console.error('Kazino Lakay service worker registration failed:', error);
        toast('Navigatè a pa aktive sèvis enstalasyon an. Ouvri sit la nan Chrome/Edge sou HTTPS, epi rafrechi paj la.', 'warning', 6500);
      });
  }, { once: true });
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

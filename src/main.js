import './style.css';
import { GAMES, CATEGORIES } from './games/catalog.js';
import { firebaseReady, firebaseMissing, auth } from './firebase.js';
import { watchAuth, registerAccount, loginAccount, logoutAccount, resendVerification } from './auth.js';
import { api } from './api.js';

const root = document.querySelector('#app');
const state = { user: null, profile: null, category: 'Tout jwèt', query: '', activeGame: null, selected: new Set(), busy: false, notice: '' };
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
      return stageFrame(gameId, 'Vòl Eksprès', 'Gade avyon an monte sou koub la. Rezilta a soti nan sèvè a.', `<div class="crash-screen"><div class="crash-readout"><small>MILTILIKATÈ</small><strong class="stage-result">${mult}</strong><span>OBJEKTIF ${target}</span></div><svg class="crash-chart" viewBox="0 0 520 190" role="img" aria-label="Grafik vòl"><defs><linearGradient id="crashFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#43efcb" stop-opacity=".42"/><stop offset="1" stop-color="#43efcb" stop-opacity="0"/></linearGradient></defs><path class="chart-grid" d="M0 38H520M0 86H520M0 134H520M80 0V190M180 0V190M280 0V190M380 0V190M480 0V190"/><path class="crash-area" d="M0 178 C70 175 82 158 130 155 S205 130 240 122 S300 92 330 88 S405 43 520 12 L520 190 L0 190Z"/><path class="crash-line" d="M0 178 C70 175 82 158 130 155 S205 130 240 122 S300 92 330 88 S405 43 520 12"/><g class="crash-plane"><text x="0" y="0">✈</text></g></svg><div class="crash-foot"><span>● LIVE SIMILASYON</span><span>${details ? (d.reached ? 'OBJEKTIF ATENN' : 'VÒL LA FINI') : 'AP PREPARE'}</span></div></div>`, phase);
    }
    case 'slots': {
      const symbols = d.symbols || ['🍒', '🔔', '💎'];
      return stageFrame(gameId, 'Slots — Fwi an Lò', 'Twa bobin mekanik ak senbòl ki revele youn apre lòt.', `<div class="slots-cabinet"><div class="slots-marquee">✦ FWI AN LÒ ✦ <small>JACKPOT ROOM</small></div><div class="slots-frame">${symbols.map((symbol, i) => `<div class="slot-reel"><div class="reel-ghost">${['⭐','🍋','🔔'][i]}</div><div class="reel-symbol stage-result">${esc(symbol)}</div><div class="reel-ghost">${['💎','🍒','7️⃣'][i]}</div></div>`).join('')}</div><div class="slots-lights"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="slots-status">${details ? (Number(d.multiplier) > 0 ? `KONBO: ${Number(d.multiplier).toFixed(1)}×` : 'PA GEN KONBO') : 'CHWAZI POU W VIRE BOBIN YO'}</div></div>`, phase);
    }
    case 'roulette': {
      const n = details ? Number(d.number) : 0;
      const color = details ? d.color : 'green';
      const reds = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
      const nums = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
      return stageFrame(gameId, 'Roulèt Royal', 'Wou Ewopeyen 37 pòch la vire epi boul la sispann sou yon nimewo.', `<div class="roulette-table"><div class="roulette-wheel-wrap"><div class="roulette-pointer"></div><div class="roulette-wheel"><div class="roulette-pockets">${nums.map((num,i)=>`<i style="--i:${i}" class="${num === 0 ? 'pocket-green' : reds.has(num) ? 'pocket-red' : 'pocket-black'}">${num}</i>`).join('')}</div><div class="roulette-hub"><small>ROYAL</small><strong class="stage-result">${details ? n : '00'}</strong><span>${details ? color.toUpperCase() : 'SPIN'}</span></div></div><div class="roulette-ball"></div></div><div class="roulette-footer"><span>EUROPEAN ROULETTE</span><b class="stage-result">${details ? `${n} · ${color.toUpperCase()}` : '0 — 36'}</b></div></div>`, phase);
    }
    case 'blackjack':
    case 'baccarat':
    case 'casinowar': {
      const blackjack = gameId === 'blackjack';
      const baccarat = gameId === 'baccarat';
      const pCards = blackjack ? (d.player || []) : baccarat ? (d.playerCards || []) : (d.playerCard ? [d.playerCard] : []);
      const bCards = blackjack ? (d.dealer || []) : baccarat ? (d.bankerCards || []) : (d.bankerCard ? [d.bankerCard] : []);
      const leftName = blackjack ? 'JWÈ' : baccarat ? 'JWÈ' : 'OU';
      const rightName = blackjack ? 'KOUTYE' : baccarat ? 'BANKYE' : 'BANKYE';
      const leftScore = blackjack ? d.playerTotal : baccarat ? d.playerScore : d.playerValue;
      const rightScore = blackjack ? d.dealerTotal : baccarat ? d.bankerScore : d.bankerValue;
      const cards = (arr) => arr.length ? arr.map((c) => stageCard(c)).join('') : stageCard('', true);
      const title = blackjack ? 'Blackjack 21' : baccarat ? 'Baccarat Lakay' : 'Casino War';
      return stageFrame(gameId, title, 'Kat yo vire sou yon tab vèt, ak valè chak men vizib.', `<div class="felt-table"><div class="felt-brand">KAZINO LAKAY <span>◆</span> TABLE ${baccarat ? 'BACCARAT' : 'CARD ROOM'}</div><div class="card-duel"><div class="card-hand"><div class="hand-label">${leftName}<b class="stage-result">${leftScore ?? '—'}</b></div><div class="hand-cards">${cards(pCards)}</div></div><div class="versus">VS</div><div class="card-hand"><div class="hand-label">${rightName}<b class="stage-result">${rightScore ?? '—'}</b></div><div class="hand-cards">${cards(bCards)}</div></div></div><div class="felt-footer"><span>DEALER • TABLE 01</span><span>${details ? 'MEN REVELE' : 'PARE POU KAT YO'}</span></div></div>`, phase);
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
      return stageFrame(gameId, 'Mines — Min Lakay', 'Tablo sekirite 5 × 5 la revele dyaman ak min yo apre wonn nan.', `<div class="mines-board-wrap"><div class="mines-top"><span>MIN LAKAY <small>3 MIN KACHE</small></span><b>${details ? (hits.size ? 'MIN DETEKTE' : 'ZÒN SEKIRIZE') : 'CHWAZI KARE'}</b></div><div class="mines-board">${Array.from({length:25},(_,i)=>{const n=i+1;const isMine=mines.has(n);const isSafe=details && chosen.has(n) && !isMine;return `<span class="mine-cell ${chosen.has(n)?'is-chosen':''} ${isMine?'is-mine':''} ${isSafe?'is-safe':''}" style="--i:${i}">${isMine?'✹':isSafe?'◆':chosen.has(n)?'•':'?'}</span>`}).join('')}</div><div class="mines-footer"><span>◆ DIAMYAN</span><span>✹ MIN</span></div></div>`, phase);
    }
    case 'plinko': {
      const path = d.path || ['L','R','L','L','R','R','L']; const slot = Number(d.slot || 4);
      return stageFrame(gameId, 'Plinko Drop', 'Boul la desann atravè pikèt yo epi fini nan pòch miltiplikatè a.', `<div class="plinko-board-wrap"><div class="plinko-top"><span>PLINKO • DROP ZONE</span><b class="stage-result">${details ? `${Number(d.multiplier).toFixed(1)}×` : '—'}</b></div><div class="plinko-board"><div class="plinko-pegs">${Array.from({length:7},(_,row)=>`<div class="peg-row">${Array.from({length:row+1},(_,col)=>`<i></i>`).join('')}</div>`).join('')}</div><span class="plinko-ball stage-result" style="--slot:${slot-1};--path:${path.map(x=>x==='R'?'1':'0').join('')}"></span></div><div class="plinko-slots">${[0.5,1,2,5,2,1,0.5].map((v,i)=>`<span class="${details && slot===i+1?'slot-active':''}">${v}×</span>`).join('')}</div></div>`, phase);
    }
    case 'penalty': {
      const shot = d.shot || 'center'; const keeper = d.keeper || 'center';
      return stageFrame(gameId, 'Penalty Lakay', 'Yon teren foutbòl, yon gadyen ak yon tir ki pran direksyon ou te chwazi a.', `<div class="penalty-field"><div class="goal-net"><span class="goal-post left"></span><span class="goal-post right"></span><span class="goal-crossbar"></span><span class="keeper ${details ? `keeper-${keeper}` : ''}">🧤</span><span class="football ${details ? `ball-${shot}` : ''}">⚽</span></div><div class="field-mark"></div><div class="penalty-labels"><span>AGOCH</span><span>MITAN</span><span>ADWAT</span></div><div class="penalty-status stage-result">${details ? (d.goal ? 'GÒL!' : 'BLOKAJ!') : 'PRAN TIR LA'}</div></div>`, phase);
    }
    case 'coinflip': {
      const result = d.result || 'heads';
      return stageFrame(gameId, 'Coin Flip', 'Pyès la vire nan lè a epi li montre Fas oswa Pil.', `<div class="coin-table"><div class="coin-shadow"></div><div class="coin-3d stage-result ${details ? `coin-${result}` : ''}"><div class="coin-side coin-front">KL<small>FAS</small></div><div class="coin-side coin-back">✦<small>PIL</small></div></div><div class="coin-outcome">${details ? (result === 'heads' ? 'FAS' : 'PIL') : 'LANSE PYÈS LA'}</div></div>`, phase);
    }
    case 'limbo': {
      return stageFrame(gameId, 'Limbo', 'Miltiplikatè a monte sou ekran an jiskaske li sispann sou rezilta final la.', `<div class="limbo-screen"><div class="limbo-lines"></div><small>LI-MIT MULTIPLIER</small><strong class="stage-result">${details ? `${Number(d.result).toFixed(2)}×` : '1.00×'}</strong><div class="limbo-target">OBJEKTIF OU: <b>${details ? `${Number(d.target).toFixed(2)}×` : '2.00×'}</b></div><div class="limbo-meter"><i style="--progress:${details ? Math.min(100,Number(d.result)/20*100) : 8}%"></i></div></div>`, phase);
    }
    case 'scratch': {
      const symbols = d.symbols || ['🍒','🔔','💎'];
      return stageFrame(gameId, 'Scratch Cards', 'Kat la gen yon kouch metalik ki retire pou revele twa senbòl.', `<div class="scratch-table"><div class="scratch-title">LUCKY TICKET <small>INSTANT REVEAL</small></div><div class="scratch-ticket"><div class="scratch-prize">GANYE 3 SENBÒL MENM JAN</div><div class="scratch-symbols">${symbols.map(x=>`<span class="scratch-symbol stage-result">${esc(x)}</span>`).join('')}</div><div class="scratch-foil ${details?'foil-revealed':''}">${details?'REZILTA REVELE':'GRATE POU REVELE'}</div></div><div class="scratch-foot">KAZINO LAKAY • TIKÈ SIMILASYON</div></div>`, phase);
    }
    case 'wheel': {
      const segments = [0,0.5,1,1.2,1.5,2,3,5]; const value = Number(d.multiplier || 0);
      return stageFrame(gameId, 'Wheel of Fortune', 'Wou a vire anba flèch la pou revele segman final la.', `<div class="fortune-table"><div class="fortune-pointer">▼</div><div class="fortune-wheel stage-result" style="--wheel-turn:${details?segments.indexOf(value):0}">${segments.map((v,i)=>`<span class="fortune-segment" style="--i:${i}"><b>${v}×</b></span>`).join('')}<div class="fortune-hub">KL</div></div><div class="fortune-value">${details?`${value}×`:'VIRE WOU A'}</div></div>`, phase);
    }
    default:
      return stageFrame(gameId, 'Kazino Lakay', 'Tab jwèt la pare.', `<div class="generic-stage">${esc(GAMES.find((g)=>g.id===gameId)?.symbol || '✦')}</div>`, phase);
  }
}

function gameCard(game) {
  return `<article class="game-card game-${game.tone}">
    <div class="game-card-art"><span class="game-symbol">${game.symbol}</span><span class="game-category">${esc(game.category)}</span></div>
    <div class="game-card-body"><h3>${esc(game.name)}</h3><p>${esc(game.summary)}</p>
      <button class="button button-small button-primary" data-open-game="${game.id}">Gade règ ak jwe</button></div>
  </article>`;
}

function render() {
  const filtered = GAMES.filter((game) => {
    const categoryMatch = state.category === 'Tout jwèt' || game.category === state.category;
    const q = state.query.trim().toLowerCase();
    const textMatch = !q || `${game.name} ${game.category} ${game.summary} ${game.how}`.toLowerCase().includes(q);
    return categoryMatch && textMatch;
  });
  root.innerHTML = `<header class="topbar"><a class="brand" href="#top"><span class="brand-mark">KL</span><span>KAZINO <b>LAKAY</b></span></a>
    <div class="topbar-actions"><span class="points"><small>Pwen jwèt</small><strong>${state.profile ? fmt(state.profile.pointsBalance) : '—'} P</strong></span>
      ${state.user ? `<button class="button button-ghost" data-action="history">Istwa</button><span class="user-label">${esc(state.user.displayName || state.user.email || 'Jwè')}</span><button class="button button-ghost" data-action="logout">Dekonekte</button>` : `<button class="button button-ghost" data-action="login">Konekte</button><button class="button button-primary" data-action="register">Kreye kont</button>`}
    </div></header>
    <main id="top" class="shell">
      ${!firebaseReady ? `<div class="config-alert"><strong>Enstalasyon Firebase poko fini.</strong><span>Konfigirasyon ki manke: ${firebaseMissing.map(esc).join(', ')}. Pa gen kont ni jwèt sèvè ki disponib jiskaske pwojè Firebase la konekte.</span></div>` : ''}
      <section class="hero"><div class="hero-copy"><span class="eyebrow">GAME CENTER • KAZINO LAKAY</span><h1>Jwe ak lespri.<br><em>Konprann chak mouvman.</em></h1><p>Eksplore jwèt yo, aprann règ yo, epi swiv rezilta ou. Chak jwèt gen eksplikasyon klè anvan ou kòmanse.</p><div class="hero-actions"><a class="button button-primary" href="#games">Eksplore 17 jwèt yo <span>↘</span></a><span class="hero-note">Pwen jwèt san valè lajan</span></div></div>
        <div class="hero-art" aria-hidden="true"><div class="hero-orbit orbit-a"></div><div class="hero-orbit orbit-b"></div><div class="hero-chip">KL</div><div class="hero-card hero-card-a">A<span>♠</span></div><div class="hero-card hero-card-b">7<span>♦</span></div></div></section>
      ${state.user && !state.user.emailVerified ? `<div class="config-alert verify-alert"><strong>Verifye imel ou.</strong><span>Nou voye yon lyen verifikasyon nan ${esc(state.user.email || 'adrès imel ou')}.</span><button class="button button-ghost" data-action="resend-verification">Voye imel verifikasyon ankò</button></div>` : ''}
      <section class="quick-info"><div><span class="quick-icon">ⓘ</span><div><strong>Sa ou dwe konnen</strong><p>Pwen yo se sèlman pwen jwèt. Yo pa gen valè lajan, yo pa ka achte, transfere, vann oswa retire kòm lajan.</p></div></div><div><span class="quick-icon">🛡️</span><div><strong>Rezilta verifye sou sèvè</strong><p>Rezilta jwèt ak balans lan soti nan backend la, pa nan bouton navigatè a.</p></div></div></section>
      <section class="section-head" id="games"><div><span class="eyebrow">KOLEKSYON AN</span><h2>Chwazi jwèt ou</h2><p class="section-sub">17 jwèt • Règ yo disponib anvan chak wonn</p></div><label class="search"><span>⌕</span><input id="search" type="search" value="${esc(state.query)}" placeholder="Chèche yon jwèt..." autocomplete="off"></label></section>
      <nav class="category-nav" aria-label="Filtre jwèt">${CATEGORIES.map((cat) => `<button class="category ${state.category === cat ? 'active' : ''}" data-category="${cat}">${cat}</button>`).join('')}</nav>
      <div class="game-grid">${filtered.map(gameCard).join('')}</div>
      ${filtered.length === 0 ? '<div class="empty-state">Pa gen jwèt ki mache ak rechèch sa a.</div>' : ''}
      <section class="help-panel"><div><span class="eyebrow">KONPRANN JWE A</span><h2>Règ yo anvan aksyon an.</h2><p>Chak fich jwèt gen objektif, etap pou jwe, fason pou kalkile retou ak yon rapèl sou pwen jwèt yo.</p></div><div class="help-stat"><strong>17</strong><span>fich jwèt ak règ klè</span></div></section>
    </main>
    <footer><span>© ${new Date().getFullYear()} Kazino Lakay</span><span>Game Center • Pwen jwèt san valè lajan</span></footer>
    <div id="modal-root"></div><div id="toast" class="toast" role="status"></div>`;
  if (state.activeGame) renderGameModal();
}

function renderGameModal() {
  const game = state.activeGame;
  const fields = game.controls.map((field) => {
    if (field.type === 'select') return `<label class="field"><span>${esc(field.label)}</span><select name="${field.id}">${field.options.map(([v,l]) => `<option value="${v}" ${String(field.value) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
    if (field.type === 'number') return `<label class="field"><span>${esc(field.label)}</span><input name="${field.id}" type="number" min="${field.min}" max="${field.max}" step="${field.step}" value="${field.value}" required></label>`;
    if (field.type === 'numbers' || field.type === 'grid') {
      const total = field.type === 'grid' ? field.size : 25;
      return `<div class="number-picker"><div class="picker-top"><span>${esc(field.label)}</span><b id="selection-count">${state.selected.size}/${field.count || 5}</b></div><div class="number-grid">${Array.from({length:total},(_,i)=>`<button type="button" class="number-cell ${state.selected.has(i+1) ? 'chosen' : ''}" data-number="${i+1}">${i+1}</button>`).join('')}</div></div>`;
    }
    return '';
  }).join('');
  document.querySelector('#modal-root').innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="game-title"><button class="modal-backdrop" data-close-modal aria-label="Fèmen fenèt"></button><section class="modal-panel game-modal-panel"><header class="modal-head"><div><span class="eyebrow">FICH JWÈT • ${esc(game.category.toUpperCase())}</span><h2 id="game-title">${esc(game.name)}</h2></div><button class="close-btn" data-close-modal aria-label="Fèmen">×</button></header>
    <div class="game-instructions"><div class="instruction-icon">${game.symbol}</div><div><strong>Objektif jwèt la</strong><p>${esc(game.summary)}</p></div></div>
    ${renderGameStage(game.id)}
    <div class="rules-block"><h3>Kijan pou jwe?</h3><p>${esc(game.how)}</p><div class="payout-note"><strong>Retou posib</strong><span>${esc(game.payout)}</span></div></div>
    <form id="play-form"><label class="field stake-field"><span>Pwen pou mete nan wonn sa a</span><input name="stakePoints" type="number" min="10" max="1000" step="10" value="100" required><small>Ant 10 ak 1 000 pwen. Balans ou: ${state.profile ? fmt(state.profile.pointsBalance) : '—'} P.</small></label>${fields}
      <p class="small-print">Pwen yo pa gen valè lajan. Rezilta a kalkile sou sèvè epi yo pa ka chanje nan navigatè a.</p><button class="button button-primary button-wide" type="submit" ${!state.user || state.user.emailVerified === false || state.busy ? 'disabled' : ''}>${state.busy ? 'Wonn nan ap dewoule…' : 'Kòmanse wonn nan'}</button>
      ${!state.user ? '<p class="form-hint">Konekte oswa kreye kont pou jwe.</p>' : state.user.emailVerified === false ? '<p class="form-hint">Verifye imel ou anvan ou kòmanse yon jwèt.</p>' : ''}
    </form><div id="game-result" class="game-result" aria-live="polite"></div></section></div>`;
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

async function playGame(form) {
  const game = state.activeGame;
  if (!state.user) return toast('Konekte anvan ou jwe.', 'warning');
  if (!state.user.emailVerified) return toast('Verifye imel ou anvan ou jwe.', 'warning');
  if (state.busy) return;
  const stakePoints = Number(new FormData(form).get('stakePoints'));
  if (!Number.isInteger(stakePoints) || stakePoints < 10 || stakePoints > 1000) return toast('Mete ant 10 ak 1 000 pwen.', 'warning');
  try {
    const choice = parseChoices(form, game);
    state.busy = true;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Sèvè a ap kalkile rezilta a…';
    const result = await api('/api/games/play', { method: 'POST', body: { gameId: game.id, stakePoints, choice } });
    const panel = document.querySelector('#game-result');
    const gamePanel = document.querySelector('.game-modal-panel');
    const stage = gamePanel?.querySelector('.casino-stage');
    if (stage) stage.outerHTML = renderGameStage(game.id, result.result.details, 'rolling');
    await animateResult(gamePanel || panel, game.id);
    state.profile = { ...(state.profile || {}), pointsBalance: result.balancePoints };
    panel.innerHTML = `<div class="result-summary ${result.result.payoutPoints > stakePoints ? 'result-win' : result.result.payoutPoints === stakePoints ? 'result-neutral' : 'result-loss'}"><span class="result-symbol">${game.symbol}</span><h3>${esc(result.result.title)}</h3><p>${esc(result.result.message)}</p><div class="result-numbers"><span>Pwen mete<strong>${fmt(stakePoints)} P</strong></span><span>Retou<strong>${fmt(result.result.payoutPoints)} P</strong></span><span>Nouvo balans<strong>${fmt(result.balancePoints)} P</strong></span></div><details><summary>Wè detay wonn nan</summary><pre>${esc(JSON.stringify(result.result.details, null, 2))}</pre></details></div>`;
    state.busy = false;
    renderTopbarOnly();
    const next = panel.querySelector('.result-summary');
    next?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    form.querySelector('button[type="submit"]').disabled = false;
    form.querySelector('button[type="submit"]').textContent = 'Jwe yon lòt wonn';
    toast('Wonn fini. Balans ou mete ajou.', 'success');
  } catch (error) {
    state.busy = false;
    toast(error.message || 'Nou pa t kapab lanse jwèt la.', 'error');
    const submit = form.querySelector('button[type="submit"]');
    if (submit) { submit.disabled = false; submit.textContent = 'Eseye ankò'; }
  }
}

async function animateResult(panel, gameId) {
  const stage = panel.querySelector('.casino-stage');
  if (!stage) return;
  const duration = ['crash','roulette','wheel','plinko','slots'].includes(gameId) ? 1900 : 1450;
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
  const points = document.querySelector('.points strong');
  if (points) points.textContent = `${fmt(state.profile?.pointsBalance)} P`;
}

root.addEventListener('click', async (event) => {
  const open = event.target.closest('[data-open-game]');
  const category = event.target.closest('[data-category]');
  const action = event.target.closest('[data-action]');
  const close = event.target.closest('[data-close-modal]');
  const authMode = event.target.closest('[data-auth-mode]');
  const number = event.target.closest('[data-number]');
  if (open) {
    state.activeGame = GAMES.find((g) => g.id === open.dataset.openGame);
    state.selected = new Set();
    renderGameModal();
  } else if (category) {
    state.category = category.dataset.category;
    render();
  } else if (action?.dataset.action === 'login') renderAuthModal('login');
  else if (action?.dataset.action === 'register') renderAuthModal('register');
  else if (action?.dataset.action === 'logout') { await logoutAccount(); state.profile = null; }
  else if (action?.dataset.action === 'history') await showHistory();
  else if (action?.dataset.action === 'resend-verification') { try { await resendVerification(); toast('Nou voye yon nouvo imel verifikasyon.', 'success'); } catch (error) { toast(error.message, 'error'); } }
  else if (close) { state.activeGame = null; state.busy = false; document.querySelector('#modal-root').innerHTML = ''; }
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

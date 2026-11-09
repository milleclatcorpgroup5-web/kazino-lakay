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
    panel.innerHTML = `<div class="result-animation result-${esc(result.result.animationKey || game.id)}"><span class="result-symbol">${game.symbol}</span><span class="result-loading">Rezilta a ap parèt…</span></div>`;
    await animateResult(panel, game.id);
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
  const element = panel.querySelector('.result-animation');
  const symbol = panel.querySelector('.result-symbol');
  if (!element || !symbol) return;
  const duration = ['crash','roulette','wheel','plinko'].includes(gameId) ? 1700 : 1050;
  const effects = [element.animate([
    { transform: 'translateY(12px) scale(.94)', opacity: .25, filter: 'blur(5px)' },
    { transform: 'translateY(-3px) scale(1.02)', opacity: 1, filter: 'blur(0)' },
    { transform: 'translateY(0) scale(1)', opacity: 1 }
  ], { duration, easing: 'cubic-bezier(.16,1,.3,1)' })];
  const motion = {
    crash: [{ transform: 'translateY(12px) rotate(-12deg) scale(.75)' },{ transform: 'translateY(-16px) rotate(9deg) scale(1.2)'},{ transform: 'translateY(0) rotate(0) scale(1)' }],
    slots: [{ transform: 'translateY(-50px) rotateX(0deg)', filter: 'blur(6px)' },{ transform: 'translateY(12px) rotateX(540deg)', filter: 'blur(2px)' },{ transform: 'translateY(0) rotateX(720deg)', filter: 'blur(0)' }],
    roulette: [{ transform: 'rotate(0) scale(.8)' },{ transform: 'rotate(720deg) scale(1.15)' },{ transform: 'rotate(1080deg) scale(1)' }],
    wheel: [{ transform: 'rotate(0) scale(.8)' },{ transform: 'rotate(900deg) scale(1.12)' },{ transform: 'rotate(1440deg) scale(1)' }],
    dice: [{ transform: 'rotate(0) translateY(-12px)' },{ transform: 'rotate(540deg) translateY(8px)' },{ transform: 'rotate(720deg) translateY(0)' }],
    plinko: [{ transform: 'translateY(-95px) scale(.7)' },{ transform: 'translateY(8px) scale(1.15)' },{ transform: 'translateY(0) scale(1)' }],
    coinflip: [{ transform: 'perspective(300px) rotateY(0)' },{ transform: 'perspective(300px) rotateY(900deg) scale(1.2)' },{ transform: 'perspective(300px) rotateY(1440deg)' }],
    penalty: [{ transform: 'translate(-20px,-25px) rotate(-25deg) scale(.7)' },{ transform: 'translate(25px,5px) rotate(25deg) scale(1.2)' },{ transform: 'translate(0,0) rotate(0) scale(1)' }],
    blackjack: [{ transform: 'translateY(-60px) rotate(-15deg)' },{ transform: 'translateY(8px) rotate(5deg)' },{ transform: 'translateY(0) rotate(0)' }],
    baccarat: [{ transform: 'translateY(-60px) rotate(15deg)' },{ transform: 'translateY(8px) rotate(-5deg)' },{ transform: 'translateY(0) rotate(0)' }],
    hilo: [{ transform: 'rotateY(90deg) scale(.8)' },{ transform: 'rotateY(-15deg) scale(1.12)' },{ transform: 'rotateY(0) scale(1)' }],
    casinowar: [{ transform: 'translateY(-50px) rotate(20deg)' },{ transform: 'translateY(5px) rotate(-8deg)' },{ transform: 'translateY(0) rotate(0)' }],
    mines: [{ transform: 'scale(.3)', filter: 'blur(5px)' },{ transform: 'scale(1.35)', filter: 'blur(0)' },{ transform: 'scale(1)' }],
    keno: [{ opacity: .1, transform: 'scale(.5)' },{ opacity: 1, transform: 'scale(1.2)' },{ opacity: 1, transform: 'scale(1)' }],
    scratch: [{ clipPath: 'inset(0 0 100% 0)' },{ clipPath: 'inset(0 0 0 0)' }],
    limbo: [{ transform: 'translateY(35px) scale(.7)' },{ transform: 'translateY(-12px) scale(1.2)' },{ transform: 'translateY(0) scale(1)' }],
    sicbo: [{ transform: 'rotate(0) translateY(-20px)' },{ transform: 'rotate(720deg) translateY(8px)' },{ transform: 'rotate(1080deg) translateY(0)' }]
  }[gameId];
  if (motion) effects.push(symbol.animate(motion, { duration, easing: 'cubic-bezier(.16,1,.3,1)' }));
  await Promise.all(effects.map((animation) => animation.finished.catch(() => undefined)));
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

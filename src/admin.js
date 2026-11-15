import './style.css';
import './admin.css';
import { GAMES } from './games/catalog.js';
import { auth, firebaseReady, firebaseMissing } from './firebase.js';
import { watchAuth, loginAccount, logoutAccount, resendVerification } from './auth.js';
import { api } from './api.js';

const root = document.querySelector('#admin-root');
let signedUser = null;
let busy = false;
let dashboardData = null;
const esc = (v='') => String(v).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (v=0) => Math.floor(Number(v)||0).toLocaleString('fr-FR');
const DEFAULT_CONTROL = { globalEnabled: true, maintenanceMessage: '', games: Object.fromEntries(GAMES.map((g) => [g.id, true])) };

function notify(message, error=false) {
  const el = document.querySelector('#admin-notice');
  if (!el) return;
  el.textContent = message;
  el.className = `admin-notice ${error?'is-error':'is-ok'}`;
}
function renderLogin(message='') {
  root.innerHTML = `<main class="admin-shell"><header class="admin-brand"><a href="/">← Retounen sou sit la</a><span class="brand-mark">KL</span><div><small>KAZINO LAKAY</small><h1>Sant administrasyon</h1></div></header>
    ${!firebaseReady ? `<div class="config-alert"><strong>Firebase frontend poko konfigire.</strong><span>${firebaseMissing.map(esc).join(', ')}</span></div>` : ''}
    ${message?`<div class="config-alert"><strong>${esc(message)}</strong></div>`:''}
    <section class="admin-login panel"><h2>Koneksyon administratè</h2><p>Antre ak kont Firebase ki gen imel <code>milleclatcorp@gmail.com</code> epi ki verifye. Dwa Admin yo verifye sou sèvè a.</p>
      <form id="admin-login-form"><label class="field"><span>Imel administratè</span><input name="email" type="email" autocomplete="username" required></label><label class="field"><span>Modpas</span><input name="password" type="password" autocomplete="current-password" required></label><button class="button button-primary button-wide" type="submit" ${!firebaseReady||busy?'disabled':''}>Konekte an sekirite</button></form>
      <p class="small-print">Pa gen okenn modpas default. Se kont Firebase verifye ki otorize sèlman.</p>
    </section></main>`;
}
function renderVerify() {
  root.innerHTML = `<main class="admin-shell"><section class="panel admin-denied"><h1>Verifye imel ou</h1><p>Kont ${esc(signedUser?.email||'ou')} poko make kòm verifye nan Firebase.</p><button class="button button-primary" data-admin-action="resend">Voye verifikasyon ankò</button><button class="button button-ghost" data-admin-action="logout">Dekonekte</button></section></main>`;
}
function renderDenied(message='Kont sa a pa gen dwa administratè.') {
  root.innerHTML = `<main class="admin-shell"><section class="panel admin-denied"><span class="brand-mark">KL</span><h1>Aksè refize</h1><p>${esc(message)}</p><p class="small-print">Kont konekte a: <strong>${esc(signedUser?.email||'Pa konekte')}</strong>. Pou antre, imel la dwe koresponn ak <code>INITIAL_ADMIN_EMAILS</code> nan Runtime Variables Cloudflare epi li dwe verifye nan Firebase Authentication.</p><button class="button button-primary" data-admin-action="logout">Dekonekte epi eseye ankò</button><a class="button button-ghost" href="/">Retounen sou jwèt yo</a></section></main>`;
}
function renderGameControl(settings) {
  const control = { ...DEFAULT_CONTROL, ...(settings || {}), games: { ...DEFAULT_CONTROL.games, ...(settings?.games || {}) } };
  const enabledCount = GAMES.filter((g) => control.games[g.id] !== false).length;
  return `<section class="panel admin-section game-control-section"><div class="admin-section-head"><div><small>KONTWÒL GLOBAL</small><h2>Kontwòl 22 jwèt yo</h2><p>Sispann tout jwèt yo yon sèl kou oswa aktive/dezaktive chak jwèt apa. Chanjman yo aplike sou sèvè a tou.</p></div><span class="admin-count">${enabledCount}/${GAMES.length} aktif</span></div>
    <form id="game-control-form">
      <div class="global-control-row"><label class="global-switch"><input type="checkbox" name="globalEnabled" ${control.globalEnabled?'checked':''}><span class="switch-track"></span><span><strong>${control.globalEnabled?'Tout jwèt yo ouvè':'Tout jwèt yo sou poz'}</strong><small>Kontwòl prensipal pou tout sit la</small></span></label><label class="maintenance-field"><span>Mesaj lè jwèt yo sou poz</span><input name="maintenanceMessage" type="text" maxlength="200" value="${esc(control.maintenanceMessage||'')}" placeholder="Egzanp: Nou ap fè antretyen. Tounen pita."></label></div>
      <div class="game-control-toolbar"><strong>Estati chak jwèt</strong><div><button type="button" class="button button-small button-ghost" data-game-control-bulk="on">Aktive tout</button><button type="button" class="button button-small button-ghost" data-game-control-bulk="off">Sispann tout</button></div></div>
      <div class="game-control-grid">${GAMES.map((game)=>`<label class="game-control-item"><span class="game-control-symbol">${esc(game.symbol)}</span><span class="game-control-name"><strong>${esc(game.name)}</strong><small>${esc(game.category)}</small></span><input type="checkbox" name="game:${esc(game.id)}" ${control.games[game.id]!==false?'checked':''}><span class="game-control-state">${control.games[game.id]!==false?'Aktif':'Sispann'}</span></label>`).join('')}</div>
      <div class="admin-save-row"><label class="maintenance-field reason-field"><span>Rezon chanjman an (obligatwa)</span><input name="reason" type="text" minlength="3" maxlength="250" required placeholder="Egzanp: Antretyen teknik / relansman jwèt"></label><button class="button button-primary" type="submit" ${busy?'disabled':''}>Sove kontwòl jwèt yo</button></div>
    </form><p class="small-print">Mòd DEMO sèlman. Kontwòl sa yo chanje disponiblite jwèt yo; yo pa modifye rezilta o aza ni bay pwen valè lajan.</p></section>`;
}
function renderDashboard(data) {
  dashboardData = data;
  const { summary, users, rounds, actions, control } = data;
  const activity = [
    ...rounds.map((item) => ({ kind: 'Wonn jwèt', label: item.gameId || 'Jwèt', detail: item.uid || 'Jwè', date: item.createdAt || '', points: `${fmt(item.netPoints)} P` })),
    ...actions.map((item) => ({ kind: item.type || 'Aksyon admin', label: item.targetEmail || item.targetUid || 'Kontwòl sistèm', detail: `${item.actorEmail || item.actorUid || 'Admin'} · ${item.reason || ''}`, date: item.createdAt || '', points: '—' }))
  ].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 100);
  const returnedPoints = rounds.reduce((sum, item) => sum + Number(item.payoutPoints || 0), 0);
  root.innerHTML = `<main class="admin-shell"><header class="admin-brand"><a href="/">← Sit piblik</a><span class="brand-mark">KL</span><div><small>KAZINO LAKAY • ADMIN</small><h1>Sant kontwòl global</h1></div><div class="admin-header-actions"><span>${esc(signedUser?.email||'')}</span><button class="button button-ghost" data-admin-action="refresh" ${busy?'disabled':''}>Rafrechi</button><button class="button button-ghost" data-admin-action="logout">Dekonekte</button></div></header>
    <div id="admin-notice" class="admin-notice" role="status"></div>
    ${renderGameControl(control)}
    <section class="admin-stats"><article class="panel"><small>Kont nan echantiyon</small><strong>${fmt(summary.usersSampled)}</strong><span>Limit premye lis: ${fmt(summary.usersLimit)}</span></article><article class="panel"><small>Kont aktif</small><strong>${fmt(summary.activeUsers)}</strong><span>Nan lis ki chaje a</span></article><article class="panel"><small>Kont sispann</small><strong>${fmt(summary.suspendedUsers)}</strong><span>Nan lis ki chaje a</span></article><article class="panel"><small>Pwen nan echantiyon</small><strong>${fmt(summary.totalPointsInSample)}</strong><span>Pwen demonstrasyon sèlman</span></article><article class="panel"><small>Wonn resan</small><strong>${fmt(rounds.length)}</strong><span>Jiska 50 dènye wonn</span></article><article class="panel"><small>Pwen retounen</small><strong>${fmt(returnedPoints)} P</strong><span>Sou wonn ki chaje yo</span></article><article class="panel"><small>Aksyon admin</small><strong>${fmt(actions.length)}</strong><span>Jiska 50 dènye aksyon</span></article><article class="panel"><small>Jwèt aktif</small><strong>${fmt(GAMES.filter((g) => (control?.games || {})[g.id] !== false).length)}</strong><span>Sou ${GAMES.length} jwèt</span></article></section>
    <section class="panel admin-section"><div class="admin-section-head"><div><small>JESTYON KONT</small><h2>Jwè yo</h2><p>Aktive/sispann yon kont oswa ajiste pwen demo. Chak chanjman antre nan jounal audit.</p></div><span class="admin-count">${users.length} kont chaje</span></div>
      <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Jwè</th><th>Balans</th><th>Estati</th><th>Aksyon</th></tr></thead><tbody>${users.map((u)=>`<tr><td><strong>${esc(u.displayName||'San non')}</strong><small>${esc(u.email||'')}</small><code>${esc(u.uid||'')}</code></td><td>${fmt(u.pointsBalance)} P</td><td><span class="status-pill ${u.accountStatus==='suspended'?'is-suspended':'is-active'}">${u.accountStatus==='suspended'?'Sispann':'Aktif'}</span></td><td><form class="user-edit-form" data-user-update><input type="hidden" name="uid" value="${esc(u.uid)}"><select name="accountStatus"><option value="active" ${u.accountStatus!=='suspended'?'selected':''}>Aktive</option><option value="suspended" ${u.accountStatus==='suspended'?'selected':''}>Sispann</option></select><input name="pointsDelta" type="number" min="-100000" max="100000" step="10" value="0" aria-label="Ajisteman pwen" placeholder="± pwen"><input name="reason" type="text" minlength="3" maxlength="250" required placeholder="Rezon obligatwa"><button class="button button-small button-primary" type="submit">Sove</button></form></td></tr>`).join('') || '<tr><td colspan="4">Pa gen kont pou montre.</td></tr>'}</tbody></table></div>
    </section>
    <section class="admin-two-col"><section class="panel admin-section"><div class="admin-section-head"><div><small>SIVEYANS</small><h2>Dènye wonn yo</h2></div><span class="admin-count">${rounds.length}</span></div><div class="admin-list">${rounds.map((r)=>`<article><div><strong>${esc(r.gameId||'Jwèt')}</strong><small>${esc(r.uid||'')} · ${esc(r.createdAt||'')}</small></div><b>${fmt(r.netPoints)} P</b></article>`).join('') || '<p class="small-print">Pa gen wonn anrejistre.</p>'}</div></section>
      <section class="panel admin-section"><div class="admin-section-head"><div><small>SEKIRITE</small><h2>Jounal administrasyon</h2></div><span class="admin-count">${actions.length}</span></div><div class="admin-list">${actions.map((a)=>`<article><div><strong>${esc(a.type||'Aksyon admin')}</strong><small>${esc(a.actorEmail||a.actorUid||'')} → ${esc(a.targetEmail||a.targetUid||'')}<br>${esc(a.reason||'')}</small></div><span>${esc(a.createdAt||'')}</span></article>`).join('') || '<p class="small-print">Pa gen aksyon admin anrejistre.</p>'}</div></section></section>
    <section class="panel admin-section admin-activity-feed"><div class="admin-section-head"><div><small>SANT SIVEYANS</small><h2>Flux aktivite resan</h2><p>Wonn jwèt ak aksyon administratè yo mete ansanm selon lè yo fèt.</p></div><span class="admin-count">${activity.length} evènman</span></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Lè</th><th>Kalite</th><th>Aktivite / Sib</th><th>Detay</th><th>Pwen</th></tr></thead><tbody>${activity.map((item) => `<tr><td>${esc(item.date || '—')}</td><td><span class="status-pill">${esc(item.kind)}</span></td><td><strong>${esc(item.label)}</strong></td><td>${esc(item.detail)}</td><td>${esc(item.points)}</td></tr>`).join('') || '<tr><td colspan="5">Pa gen aktivite resan pou montre.</td></tr>'}</tbody></table></div></section>
    <p class="admin-footnote">Tout montan yo se pwen demonstrasyon san valè lajan. Panèl sa a montre jiska 100 dènye evènman (50 wonn + 50 aksyon admin), epi jiska 100 kont nan lis itilizatè a. Li pa reprezante yon achiv san limit.</p></main>`;
}
async function refreshDashboard() {
  if (busy) return;
  busy = true;
  try {
    const [summary, userData, roundData, actionData, controlData] = await Promise.all([
      api('/api/admin/summary'), api('/api/admin/users?limit=100'), api('/api/admin/rounds'), api('/api/admin/actions'), api('/api/admin/games/control')
    ]);
    busy = false;
    renderDashboard({ summary, users: userData.users||[], rounds: roundData.rounds||[], actions: actionData.actions||[], control: controlData.settings||DEFAULT_CONTROL });
  } catch (error) {
    busy = false;
    renderDenied(error.message || 'Nou pa kapab chaje done administrasyon yo.');
  }
}
async function onUser(user) {
  signedUser = user;
  if (!user) { renderLogin(); return; }
  if (!user.emailVerified) { renderVerify(); return; }
  try {
    // Force a fresh token so Firebase's latest email_verified state is used after email confirmation.
    await user.getIdToken(true);
    await api('/api/profile/bootstrap', { method: 'POST', body: { displayName: user.displayName || '' } });
    const profile = await api('/api/me');
    if (profile.role !== 'admin') { renderDenied(`Kont ${user.email} konekte, men imel sa a pa gen wòl administratè sou Worker la.`); return; }
    await refreshDashboard();
  } catch (error) {
    renderDenied(error.message || 'Aksè administratè pa valide.');
  }
}
root.addEventListener('submit', async (event) => {
  if (event.target.id === 'admin-login-form') {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const button = event.target.querySelector('button[type="submit"]');
    if (button) { button.disabled = true; button.textContent = 'Koneksyon an ap fèt…'; }
    try { await loginAccount({ email: data.email, password: data.password }); }
    catch (error) { renderLogin(error.message || 'Koneksyon an echwe.'); }
    finally { if (button?.isConnected) { button.disabled = false; button.textContent = 'Konekte an sekirite'; } }
  }
  if (event.target.id === 'game-control-form') {
    event.preventDefault();
    if (busy) return;
    const form = event.target;
    const data = new FormData(form);
    const games = Object.fromEntries(GAMES.map((game) => [game.id, data.get(`game:${game.id}`) === 'on']));
    const globalEnabled = data.get('globalEnabled') === 'on';
    const maintenanceMessage = String(data.get('maintenanceMessage') || '').trim();
    const reason = String(data.get('reason') || '').trim();
    busy = true;
    const saveButton = form.querySelector('button[type="submit"]');
    if (saveButton) { saveButton.disabled = true; saveButton.textContent = 'Ap anrejistre…'; }
    try {
      await api('/api/admin/games/control', { method: 'POST', body: { globalEnabled, games, maintenanceMessage, reason } });
      busy = false;
      await refreshDashboard();
      notify('Kontwòl global yo sove. Sèvè a ap aplike nouvo estati jwèt yo.');
    } catch (error) {
      notify(error.message || 'Nou pa t kapab sove kontwòl yo.', true);
    } finally {
      busy = false;
      if (saveButton?.isConnected) { saveButton.disabled = false; saveButton.textContent = 'Sove kontwòl jwèt yo'; }
    }
  }
  if (event.target.matches('[data-user-update]')) {
    event.preventDefault();
    if (busy) return;
    const data = Object.fromEntries(new FormData(event.target));
    const pointsDelta = Number(data.pointsDelta||0);
    busy = true;
    try {
      await api('/api/admin/users/update', { method: 'POST', body: { uid: data.uid, accountStatus: data.accountStatus, pointsDelta, reason: data.reason } });
      busy = false;
      await refreshDashboard();
      notify('Chanjman an sove epi li antre nan jounal audit.');
    } catch (error) { notify(error.message || 'Chanjman an pa sove.', true); }
    finally { busy = false; }
  }
});
root.addEventListener('change', (event) => {
  const item = event.target.closest('.game-control-item');
  if (item && event.target.matches('input[type="checkbox"]')) {
    const status = item.querySelector('.game-control-state');
    if (status) status.textContent = event.target.checked ? 'Aktif' : 'Sispann';
  }
  const global = event.target.closest('input[name="globalEnabled"]');
  if (global) {
    const label = global.closest('.global-switch')?.querySelector('strong');
    if (label) label.textContent = global.checked ? 'Tout jwèt yo ouvè' : 'Tout jwèt yo sou poz';
  }
});
root.addEventListener('click', async (event) => {
  const action = event.target.closest('[data-admin-action]')?.dataset.adminAction;
  if (action === 'logout') await logoutAccount();
  if (action === 'refresh') await refreshDashboard();
  if (action === 'resend') {
    try { await resendVerification(); notify('Nou voye yon nouvo lyen verifikasyon.'); }
    catch (error) { notify(error.message, true); }
  }
  const bulk = event.target.closest('[data-game-control-bulk]')?.dataset.gameControlBulk;
  if (bulk) {
    root.querySelectorAll('#game-control-form .game-control-item input[type="checkbox"]').forEach((input) => {
      input.checked = bulk === 'on';
      const status = input.closest('.game-control-item')?.querySelector('.game-control-state');
      if (status) status.textContent = input.checked ? 'Aktif' : 'Sispann';
    });
  }
});
if (!firebaseReady) renderLogin();
else {
  renderLogin();
  watchAuth((user) => { onUser(user); });
}
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {}), { once: true });
}

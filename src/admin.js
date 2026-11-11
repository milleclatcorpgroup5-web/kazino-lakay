import './style.css';
import './admin.css';
import { auth, firebaseReady, firebaseMissing } from './firebase.js';
import { watchAuth, loginAccount, logoutAccount, resendVerification } from './auth.js';
import { api } from './api.js';

const root = document.querySelector('#admin-root');
let signedUser = null;
let adminProfile = null;
let busy = false;
const esc = (v='') => String(v).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (v=0) => Math.floor(Number(v)||0).toLocaleString('fr-FR');
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
    <section class="admin-login panel"><h2>Koneksyon administratè</h2><p>Se sèlman imel verifye ki nan lis <code>INITIAL_ADMIN_EMAILS</code> Cloudflare la ki kapab antre.</p>
      <form id="admin-login-form"><label class="field"><span>Imel administratè</span><input name="email" type="email" autocomplete="username" required></label><label class="field"><span>Modpas</span><input name="password" type="password" autocomplete="current-password" required></label><button class="button button-primary button-wide" type="submit" ${!firebaseReady||busy?'disabled':''}>Konekte an sekirite</button></form>
      <p class="small-print">Pa gen okenn modpas default. Sèvi ak kont Firebase ou a.</p>
    </section></main>`;
}
function renderVerify() {
  root.innerHTML = `<main class="admin-shell"><section class="panel"><h1>Verifye imel ou</h1><p>Imel ${esc(signedUser?.email||'kont ou')} poko verifye. Verifye li anvan administrasyon.</p><button class="button button-primary" data-admin-action="resend">Voye verifikasyon ankò</button><button class="button button-ghost" data-admin-action="logout">Dekonekte</button></section></main>`;
}
function renderDenied(message='Kont sa a pa nan lis administratè ki otorize yo.') {
  root.innerHTML = `<main class="admin-shell"><section class="panel admin-denied"><span class="brand-mark">KL</span><h1>Aksè refize</h1><p>${esc(message)}</p><p class="small-print">Verifye ke imel la ekri egzakteman nan Cloudflare Worker Variable <code>INITIAL_ADMIN_EMAILS</code>, epi imel Firebase la verifye.</p><a class="button button-primary" href="/">Retounen sou jwèt yo</a><button class="button button-ghost" data-admin-action="logout">Dekonekte</button></section></main>`;
}
function renderDashboard(data) {
  const { summary, users, rounds, actions } = data;
  root.innerHTML = `<main class="admin-shell"><header class="admin-brand"><a href="/">← Sit piblik</a><span class="brand-mark">KL</span><div><small>KAZINO LAKAY • ADMIN</small><h1>Sant kontwòl</h1></div><div class="admin-header-actions"><span>${esc(signedUser?.email||'')}</span><button class="button button-ghost" data-admin-action="refresh" ${busy?'disabled':''}>Rafrechi</button><button class="button button-ghost" data-admin-action="logout">Dekonekte</button></div></header>
    <div id="admin-notice" class="admin-notice" role="status"></div>
    <section class="admin-stats"><article class="panel"><small>Kont nan echantiyon</small><strong>${fmt(summary.usersSampled)}</strong><span>Limit premye lis: ${fmt(summary.usersLimit)}</span></article><article class="panel"><small>Kont aktif</small><strong>${fmt(summary.activeUsers)}</strong><span>Nan lis ki chaje a</span></article><article class="panel"><small>Kont sispann</small><strong>${fmt(summary.suspendedUsers)}</strong><span>Nan lis ki chaje a</span></article><article class="panel"><small>Pwen nan echantiyon</small><strong>${fmt(summary.totalPointsInSample)}</strong><span>Pwen demonstrasyon sèlman</span></article></section>
    <section class="panel admin-section"><div class="admin-section-head"><div><small>JESTYON KONT</small><h2>Jwè yo</h2><p>Ou kapab aktive/sispann yon kont oswa ajiste pwen demo. Chak chanjman antre nan jounal audit.</p></div><span class="admin-count">${users.length} kont chaje</span></div>
      <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Jwè</th><th>Balans</th><th>Estati</th><th>Aksyon</th></tr></thead><tbody>${users.map((u)=>`<tr><td><strong>${esc(u.displayName||'San non')}</strong><small>${esc(u.email||'')}</small><code>${esc(u.uid||'')}</code></td><td>${fmt(u.pointsBalance)} P</td><td><span class="status-pill ${u.accountStatus==='suspended'?'is-suspended':'is-active'}">${u.accountStatus==='suspended'?'Sispann':'Aktif'}</span></td><td><form class="user-edit-form" data-user-update><input type="hidden" name="uid" value="${esc(u.uid)}"><select name="accountStatus"><option value="active" ${u.accountStatus!=='suspended'?'selected':''}>Aktive</option><option value="suspended" ${u.accountStatus==='suspended'?'selected':''}>Sispann</option></select><input name="pointsDelta" type="number" min="-100000" max="100000" step="10" value="0" aria-label="Ajisteman pwen" placeholder="± pwen"><input name="reason" type="text" minlength="3" maxlength="250" required placeholder="Rezon obligatwa"><button class="button button-small button-primary" type="submit">Sove</button></form></td></tr>`).join('') || '<tr><td colspan="4">Pa gen kont pou montre.</td></tr>'}</tbody></table></div>
    </section>
    <section class="admin-two-col"><section class="panel admin-section"><div class="admin-section-head"><div><small>SIVEYANS</small><h2>Dènye wonn yo</h2></div><span class="admin-count">${rounds.length}</span></div><div class="admin-list">${rounds.map((r)=>`<article><div><strong>${esc(r.gameId||'Jwèt')}</strong><small>${esc(r.uid||'')} · ${esc(r.createdAt||'')}</small></div><b>${fmt(r.netPoints)} P</b></article>`).join('') || '<p class="small-print">Pa gen wonn anrejistre.</p>'}</div></section>
      <section class="panel admin-section"><div class="admin-section-head"><div><small>SEKIRITE</small><h2>Jounal administrasyon</h2></div><span class="admin-count">${actions.length}</span></div><div class="admin-list">${actions.map((a)=>`<article><div><strong>${esc(a.type||'Aksyon admin')}</strong><small>${esc(a.actorEmail||a.actorUid||'')} → ${esc(a.targetEmail||a.targetUid||'')}<br>${esc(a.reason||'')}</small></div><span>${esc(a.createdAt||'')}</span></article>`).join('') || '<p class="small-print">Pa gen aksyon admin anrejistre.</p>'}</div></section></section>
    <p class="admin-footnote">Tout montan yo se pwen demonstrasyon san valè lajan. Lis kont/wonn yo limite a premye 100 dokiman pou rapò sa a; se pa yon rapò finansye.</p></main>`;
}
async function refreshDashboard() {
  if (busy) return;
  busy = true;
  try {
    const [summary, userData, roundData, actionData] = await Promise.all([
      api('/api/admin/summary'), api('/api/admin/users?limit=100'), api('/api/admin/rounds'), api('/api/admin/actions')
    ]);
    renderDashboard({ summary, users: userData.users||[], rounds: roundData.rounds||[], actions: actionData.actions||[] });
  } catch (error) {
    renderDenied(error.message || 'Nou pa kapab chaje done administrasyon yo.');
  } finally { busy = false; }
}
async function onUser(user) {
  signedUser = user;
  adminProfile = null;
  if (!user) { renderLogin(); return; }
  if (!user.emailVerified) { renderVerify(); return; }
  try {
    await api('/api/profile/bootstrap', { method: 'POST', body: { displayName: user.displayName || '' } });
    adminProfile = await api('/api/me');
    if (adminProfile.role !== 'admin') { renderDenied(); return; }
    await refreshDashboard();
  } catch (error) { renderDenied(error.message || 'Aksè administratè pa valide.'); }
}
root.addEventListener('submit', async (event) => {
  if (event.target.id === 'admin-login-form') {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const button = event.target.querySelector('button[type="submit"]');
    if (button) { button.disabled = true; button.textContent = 'Koneksyon an ap fèt…'; }
    try { await loginAccount({ email: data.email, password: data.password }); }
    catch (error) {
      renderLogin(error.message || 'Koneksyon an echwe.');
    } finally {
      if (button?.isConnected) { button.disabled = false; button.textContent = 'Konekte an sekirite'; }
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
root.addEventListener('click', async (event) => {
  const action = event.target.closest('[data-admin-action]')?.dataset.adminAction;
  if (action === 'logout') await logoutAccount();
  if (action === 'refresh') await refreshDashboard();
  if (action === 'resend') {
    try { await resendVerification(); notify('Nou voye yon nouvo lyen verifikasyon.'); }
    catch (error) { notify(error.message, true); }
  }
});
if (!firebaseReady) renderLogin();
else {
  renderLogin();
  watchAuth((user) => { onUser(user); });
}
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}), { once: true });
}

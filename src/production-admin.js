import './admin.css';
import { auth, firebaseReady, firebaseMissing } from './firebase.js';
import { api } from './api.js';
import { watchAuth, loginAccount, logoutAccount } from './auth.js';

const root = document.querySelector('#admin-root');
const state = { user: null, profile: null, health: null, mfa: null, enrollment: null, summary: null, users: [], audit: [], mode: 'login', busy: false, error: '', success: '' };
const esc = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = value => Number(value||0).toLocaleString('fr-FR');
function notice(message='', type='error') { state.error=type==='error'?message:''; state.success=type==='success'?message:''; render(); }

function loginView() {
  root.innerHTML = `<main class="admin-shell"><section class="panel admin-login">
    <div class="admin-brand"><span class="brand-mark">KL</span><div><small>KAZINO LAKAY</small><h1>Administrasyon pwodiksyon</h1></div></div>
    <p>Antre ak kont Firebase ki gen wòl administratè a nan PostgreSQL. MFA obligatwa.</p>
    ${state.error?'<div class="admin-alert">'+esc(state.error)+'</div>':''}
    ${!firebaseReady?'<p>Firebase pa konfigire: '+firebaseMissing.map(esc).join(', ')+'</p>':`<form id="admin-login-form"><label>Imèl<input name="email" type="email" autocomplete="username" required></label><label>Modpas<input name="password" type="password" autocomplete="current-password" required></label><button class="button button-primary" type="submit" ${state.busy?'disabled':''}>Konekte administratè</button></form>`}
    <a class="button button-ghost" href="/">Retounen sou sit piblik la</a>
  </section></main>`;
}
function deniedView(message) {
  root.innerHTML = `<main class="admin-shell"><section class="panel admin-denied"><span class="brand-mark">KL</span><h1>Aksè refize</h1><p>${esc(message)}</p><p>Kont: ${esc(state.user?.email||'')} · Wòl: ${esc((state.profile?.roles||[]).join(', ')||'pa gen')}</p><button class="button button-ghost" data-admin-action="logout">Dekonekte</button><a class="button button-ghost" href="/">Retounen</a></section></main>`;
}
function mfaView() {
  const enrolled = Boolean(state.mfa?.enrolled || state.enrollment);
  root.innerHTML = `<main class="admin-shell"><section class="panel admin-mfa">
    <div class="admin-brand"><span class="brand-mark">KL</span><div><small>SEKIRITE ADMIN</small><h1>Verifikasyon MFA obligatwa</h1></div></div>
    <p>Administrasyon pwodiksyon an egzije yon aplikasyon otantifikatè TOTP. Pa pataje kle sekrè a oswa kòd yo.</p>
    ${state.error?'<div class="admin-alert">'+esc(state.error)+'</div>':''}
    ${state.success?'<div class="admin-success">'+esc(state.success)+'</div>':''}
    ${state.enrollment?'<div class="mfa-secret-box"><strong>Kle MFA ou (parèt yon sèl fwa)</strong><code>'+esc(state.enrollment.secret)+'</code><p>Ajoute kle a nan Google Authenticator, Microsoft Authenticator oswa yon aplikasyon TOTP ou fè konfyans.</p><details><summary>Montre URI otantifikatè</summary><code>'+esc(state.enrollment.otpauthUri)+'</code></details></div>':''}
    ${!enrolled?`<form id="mfa-enroll-form"><button class="button button-primary" type="submit" ${state.busy?'disabled':''}>Kreye kle MFA</button></form>`:`<form id="mfa-verify-form"><label>Kòd sekirite 6 chif<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required></label><button class="button button-primary" type="submit" ${state.busy?'disabled':''}>Verifye MFA epi antre</button></form>`}
    <p class="small-print">Apre verifikasyon, aksè admin lan dire 10 minit. Peman ak jwèt lajan reyèl toujou dezaktive.</p>
    <button class="button button-ghost" data-admin-action="logout">Dekonekte</button>
  </section></main>`;
}
function dashboardView() {
  const s=state.summary||{};
  const tiles=[
    ['Total kliyan',s.users?.total||0,'Kont anrejistre'],
    ['Kont aktif',s.users?.active||0,'Estati active'],
    ['Kont sispann',s.users?.suspended||0,'Anba revizyon'],
    ['KYC an atant',s.kycPending||0,'Dosye KYC'],
    ['Oto-eksklizyon',s.selfExcludedUsers||0,'Kont bloke'],
    ['Alèt sekirite',s.openFraudAlerts||0,'Alèt ouvè']
  ];
  root.innerHTML = `<main class="admin-shell production-admin">
    <header class="admin-brand"><a href="/">← Sit piblik</a><span class="brand-mark">KL</span><div><small>KAZINO LAKAY • PRODUCTION</small><h1>Administrasyon pwodiksyon</h1></div><div class="admin-header-actions"><span>${esc(state.user?.email||'')}</span><button class="button button-ghost" data-admin-action="refresh" ${state.busy?'disabled':''}>Rafrechi</button><button class="button button-ghost" data-admin-action="logout">Dekonekte</button></div></header>
    <div class="production-status-banner"><strong>MÒD PWODIKSYON — AKSYON FINANSYE FÈMEN</strong><span>Peman: OFF · Jwèt: OFF · KYC: poko konekte · Ledger: lekti/verifye sèlman</span></div>
    ${state.error?'<div class="admin-alert">'+esc(state.error)+'</div>':''}
    ${state.success?'<div class="admin-success">'+esc(state.success)+'</div>':''}
    <section class="admin-stats production-stats">${tiles.map(([label,value,caption])=>`<article class="panel"><small>${esc(label)}</small><strong>${fmt(value)}</strong><span>${esc(caption)}</span></article>`).join('')}</section>
    <section class="panel"><div class="section-title"><div><small>SEKIRITE AKSYON</small><h2>Estati sèvis</h2></div><span class="status-pill">MFA VERIFYE</span></div><p>PostgreSQL: ${state.health?.databaseReady?'READY':'MAINTENANCE'} · Peman: ${s.paymentsEnabled?'ON':'OFF'} · Jwèt: ${s.realMoneyGamesEnabled?'ON':'OFF'}</p><p class="small-print">Aplikasyon sa a pa gen pèmisyon pou aktive peman oswa jwèt. Tout aksyon kont rete anba audit log.</p></section>
    ${state.users.length?`<section class="panel"><h2>Dènye kont kliyan yo</h2><div class="admin-table-wrap"><table><thead><tr><th>Imèl</th><th>Estati</th><th>KYC</th><th>Wòl</th><th>Kreye</th></tr></thead><tbody>${state.users.map(u=>`<tr><td>${esc(u.email)}</td><td>${esc(u.account_status)}</td><td>${esc(u.kyc_status)}</td><td>${esc((u.roles||[]).join(', '))}</td><td>${esc(new Date(u.created_at).toLocaleDateString('fr-FR'))}</td></tr>`).join('')}</tbody></table></div></section>`:''}
    ${state.audit.length?`<section class="panel"><h2>Dènye aksyon sekirite</h2><div class="admin-table-wrap"><table><thead><tr><th>Aksyon</th><th>Wòl</th><th>Rezilta</th><th>Dat</th></tr></thead><tbody>${state.audit.map(x=>`<tr><td>${esc(x.action)}</td><td>${esc(x.actor_role)}</td><td>${esc(x.outcome)}</td><td>${esc(new Date(x.created_at).toLocaleString('fr-FR'))}</td></tr>`).join('')}</tbody></table></div></section>`:''}
    <footer class="admin-footnote">Done yo soti nan PostgreSQL. Okenn pwen demonstrasyon pa enpòte. Depo, retrè ak jwèt rete dezaktive. Wòl yo jere dirèkteman nan bazdone pa administratè ki otorize.</footer>
  </main>`;
}
async function refresh() {
  state.health=await api('/api/health');
  state.profile=await api('/api/me');
  const roles=state.profile.roles||[];
  if (!roles.some(role=>['admin','compliance','finance','auditor','support'].includes(role))) throw new Error('Kont sa a pa gen okenn wòl administrasyon aktif nan PostgreSQL.');
  state.mfa=await api('/api/security/admin-mfa/status');
  if (!state.mfa.enrolled || !state.mfa.verified) { mfaView(); return; }
  state.summary=await api('/api/admin/production/summary');
  const tasks=[];
  if (roles.some(role=>['admin','compliance','support'].includes(role))) tasks.push(api('/api/admin/production/users').then(x=>state.users=x.users||[]));
  if (roles.some(role=>['admin','auditor','compliance'].includes(role))) tasks.push(api('/api/admin/production/audit').then(x=>state.audit=x.logs||[]));
  await Promise.all(tasks);
  dashboardView();
}
async function onAuth(user) {
  state.user=user; state.profile=null; state.mfa=null; state.enrollment=null; state.summary=null; state.users=[]; state.audit=[];
  if (!user) { loginView(); return; }
  try {
    state.busy=true;
    state.health=await api('/api/health');
    await api('/api/profile/bootstrap',{method:'POST',body:{displayName:user.displayName||''}});
    state.profile=await api('/api/me');
    const roles=state.profile.roles||[];
    if (!roles.some(role=>['admin','compliance','finance','auditor','support'].includes(role))) {
      deniedView('Kont sa a pa gen wòl administratè nan bazdone pwodiksyon an.'); return;
    }
    state.mfa=await api('/api/security/admin-mfa/status');
    if (!state.mfa.enrolled) { mfaView(); return; }
    if (!state.mfa.verified) { mfaView(); return; }
    await refresh();
  } catch(error) { deniedView(error.message||'Pa kapab verifye aksè administratè a.'); }
  finally { state.busy=false; }
}
root.addEventListener('click', async event=>{
  const action=event.target.closest('[data-admin-action]')?.dataset.adminAction;
  if (!action) return;
  if (action==='logout') { await logoutAccount(); return; }
  if (action==='refresh') {
    try { state.busy=true; await refresh(); }
    catch(error) { state.error=error.message||'Rafrechisman echwe.'; dashboardView(); }
    finally { state.busy=false; }
  }
});
root.addEventListener('submit', async event=>{
  event.preventDefault();
  try {
    state.busy=true;
    if (event.target.id==='admin-login-form') {
      const data=Object.fromEntries(new FormData(event.target));
      await loginAccount({email:data.email,password:data.password});
    } else if (event.target.id==='mfa-enroll-form') {
      state.enrollment=await api('/api/security/admin-mfa/enroll',{method:'POST',body:{}});
      state.mfa={enrolled:true,verified:false};
      state.success='Kle MFA kreye. Anrejistre li epi antre kòd 6 chif la.';
      mfaView();
    } else if (event.target.id==='mfa-verify-form') {
      const code=String(new FormData(event.target).get('code')||'');
      await api('/api/security/admin-mfa/verify',{method:'POST',body:{code}});
      state.enrollment=null; state.mfa={enrolled:true,verified:true};
      state.success='MFA verifye.';
      await refresh();
    }
  } catch(error) { state.error=error.message||'Demann lan echwe.'; if (state.user) mfaView(); else loginView(); }
  finally { state.busy=false; }
});
if (firebaseReady) watchAuth(onAuth);
loginView();

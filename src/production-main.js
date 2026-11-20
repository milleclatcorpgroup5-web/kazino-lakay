import './style.css';
import { GAMES } from './games/catalog.js';
import { PENALTY_TEAMS, getPenaltyTeam } from './games/penalty-roster.js';
import { auth, firebaseReady, firebaseMissing } from './firebase.js';
import { api } from './api.js';
import { watchAuth, registerAccount, loginAccount, logoutAccount, resendVerification } from './auth.js';

const root = document.querySelector('#app');
const state = { user: null, profile: null, wallet: null, health: null, compliance: null, mode: 'login', penaltyCountry: 'haiti', busy: false, error: '', success: '' };
const esc = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = (minor = 0, currency = 'HTG') => (Number(minor || 0) / 100).toLocaleString('fr-HT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;

function notice(message = '', type = 'info') {
  state.error = type === 'error' ? message : '';
  state.success = type === 'success' ? message : '';
  render();
}
function button(label, action, disabled = false, kind = 'primary') {
  return `<button class="btn ${kind}" data-action="${action}" ${disabled ? 'disabled' : ''}>${label}</button>`;
}
function authPanel() {
  if (!firebaseReady) return `<section class="panel"><h2>Konfigirasyon kont</h2><p>Firebase Web App poko konfigire. Paramèt ki manke: ${firebaseMissing.map(esc).join(', ')}.</p></section>`;
  return `<section class="panel auth"><div class="tabs"><button data-mode="login" class="${state.mode==='login'?'active':''}">Konekte</button><button data-mode="register" class="${state.mode==='register'?'active':''}">Kreye kont</button></div>
    <form id="auth-form">${state.mode==='register'?'<label>Non konplè<input name="displayName" autocomplete="name" minlength="2" maxlength="60" required></label>':''}
    <label>Imèl<input name="email" type="email" autocomplete="email" required></label>
    <label>Modpas<input name="password" type="password" minlength="8" autocomplete="${state.mode==='login'?'current-password':'new-password'}" required></label>
    <button class="btn primary" type="submit" ${state.busy?'disabled':''}>${state.busy?'Tanpri tann…':state.mode==='login'?'Konekte':'Kreye kont mwen'}</button>
    ${state.mode==='login'?'<button class="link" type="button" data-action="reset">Mwen bliye modpas mwen</button>':''}</form>
    <p class="hint">Apre enskripsyon, verifye imel ou. Kont yo rete an revizyon epi okenn jwèt oswa peman pa aktive.</p></section>`;
}
function compliancePanel() {
  const c = state.compliance || {};
  const rows = (c.limits || []).filter(x=>x.currency==='HTG');
  const limit = key => {
    const row = rows[0] || {};
    return row[key] == null ? '' : (Number(row[key])/100).toFixed(2);
  };
  return `<section class="panel"><div class="section-title"><div><small>PWOTEKSYON JWÈ</small><h2>Jwèt responsab</h2></div><span class="pill">PA AKTIVE</span></div>
    <p>Estati kont: <b>${esc(c.accountStatus||'pending_review')}</b> · KYC: <b>${esc(c.kycStatus||'not_started')}</b> · Laj: <b>${esc(c.ageVerificationStatus||'unverified')}</b></p>
    ${c.selfExcluded?'<div class="alert danger">Oto-eksklizyon aktif. Kont sa a rete bloke.</div>':''}
    <form id="limits-form" class="form-grid"><h3>Limit pèsonèl HTG</h3>
      <label>Depo pa jou (HTG)<input name="dailyDepositLimit" type="number" min="0.01" step="0.01" value="${esc(limit('daily_deposit_limit_minor'))}" placeholder="Egzanp: 500"></label>
      <label>Depo pa semèn (HTG)<input name="weeklyDepositLimit" type="number" min="0.01" step="0.01" value="${esc(limit('weekly_deposit_limit_minor'))}" placeholder="Egzanp: 2000"></label>
      <label>Pari pa jou (HTG)<input name="dailyWagerLimit" type="number" min="0.01" step="0.01" value="${esc(limit('daily_wager_limit_minor'))}" placeholder="Egzanp: 300"></label>
      <label>Pèt pa jou (HTG)<input name="dailyLossLimit" type="number" min="0.01" step="0.01" value="${esc(limit('daily_loss_limit_minor'))}" placeholder="Egzanp: 200"></label>
      <button class="btn primary" type="submit">Anrejistre oswa bese limit</button></form>
    <form id="exclude-form" class="form-grid"><h3>Oto-eksklizyon</h3><label>Dire<select name="duration" required><option value="">Chwazi dire</option><option value="1_day">1 jou</option><option value="7_days">7 jou</option><option value="30_days">30 jou</option><option value="90_days">90 jou</option><option value="365_days">365 jou</option><option value="permanent">Pèmanan</option></select></label><button class="btn danger" type="submit" ${c.selfExcluded?'disabled':''}>Bloke kont mwen</button></form>
    <p class="hint">KYC/verifikasyon laj poko konekte ak yon founisè. Pa voye dokiman idantite nan aplikasyon an.</p></section>`;
}

function accountPanel() {
  const profile = state.profile || {};
  const wallet = state.wallet?.wallet || {};
  return `<div class="grid">
    <section class="panel">
      <div class="section-title"><div><small>BOUS KLIYAN</small><h2>Balans kont mwen</h2></div><span class="pill">LEKTI SÈLMAN</span></div>
      <div class="balance">${money(wallet.balanceMinor || 0, wallet.currency || 'HTG')}</div>
      <p>Kont lan kòmanse a zewo. Depo ak retrè pa aktive.</p>
      <div class="bar-actions">${button('Rafrechi bous','refresh',state.busy,'ghost')}${button('Sistèm sekirite','compliance',state.busy,'ghost')}</div>
    </section>
    <section class="panel">
      <small>ESTATI KONFÒMITE</small>
      <h2>${esc(profile.accountStatus || 'pending_review')}</h2>
      <p>Imèl: ${state.user?.emailVerified ? 'verifye' : 'pa verifye'} · KYC: ${esc(profile.kycStatus || 'not_started')} · Laj: ${esc(profile.ageVerificationStatus || 'unverified')}</p>
      <p class="hint">Ou dwe tann verifikasyon idantite ak laj atravè sèvis otorize. Sa poko disponib.</p>
      ${!state.user?.emailVerified ? button('Voye imèl verifikasyon','verify-email',state.busy,'ghost') : ''}
    </section>
  </div>`;
}

function render() {
  const penaltyTeam = getPenaltyTeam(state.penaltyCountry);
  const ready = state.health?.status === 'ok' && state.health?.databaseReady === true;
  const wallet = state.wallet?.wallet || {};
  root.innerHTML = `<style>
  :root{color-scheme:dark;--bg:#080d1c;--panel:#111a2d;--line:#263550;--text:#edf3ff;--muted:#a4b1c8;--gold:#e5bf68;--cyan:#45d6c1;--red:#f47782}
  *{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 85% -10%,#26375d 0,transparent 36%),var(--bg);color:var(--text);font:15px system-ui, sans-serif}#app{min-height:100vh}.wrap{max-width:1120px;margin:auto;padding:22px}.bar{display:flex;gap:16px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding:10px 0 20px}.brand{display:flex;gap:12px;align-items:center}.logo{width:46px;height:46px;border-radius:15px;display:grid;place-items:center;background:linear-gradient(135deg,#e5bf68,#87612a);color:#151b2b;font-weight:900}.brand h1{margin:0;font-size:20px}.brand small,.eyebrow,small{color:var(--muted)}.bar-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.btn{border:1px solid var(--line);border-radius:12px;padding:11px 15px;font-weight:700;color:var(--text);background:#1a2740;cursor:pointer}.btn.primary{background:linear-gradient(135deg,#e5bf68,#c8943e);color:#111827;border:0}.btn.ghost,.link{background:transparent}.btn.danger{background:#492633;border-color:#82404f}.btn:disabled{opacity:.45;cursor:not-allowed}.link{border:0;color:var(--gold);padding:9px;cursor:pointer}.hero{padding:46px 0 30px;display:grid;grid-template-columns:1.3fr .7fr;gap:24px}.hero h2{font-size:clamp(32px,6vw,58px);line-height:1.02;margin:12px 0}.hero h2 em{color:var(--gold);font-style:normal}.hero p{max-width:620px;color:var(--muted);font-size:17px;line-height:1.6}.badge{display:inline-flex;border:1px solid #896d39;color:var(--gold);border-radius:99px;padding:7px 11px;font-weight:800;font-size:11px;letter-spacing:.1em}.lock-card{background:linear-gradient(145deg,#182743,#121b2d);border:1px solid #344761;border-radius:22px;padding:22px;align-self:center}.lock-card b{font-size:25px;display:block;margin:8px 0;color:var(--gold)}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.panel{background:linear-gradient(160deg,#151f34,#101829);border:1px solid var(--line);border-radius:20px;padding:20px;margin:0 0 16px;box-shadow:0 18px 45px #0002}.panel h2{margin:5px 0 12px}.panel p,.hint{color:var(--muted);line-height:1.55}.section-title{display:flex;justify-content:space-between;gap:12px;align-items:center}.pill{border:1px solid #8a6933;color:var(--gold);border-radius:99px;padding:6px 10px;font-size:11px;font-weight:800}.balance{font-size:32px;color:#fff;font-weight:850;margin:10px 0}.hint{font-size:12px}.auth form,.form-grid{display:grid;gap:12px}.tabs{display:flex;gap:8px;margin-bottom:18px}.tabs button{border:1px solid var(--line);background:#0e1727;color:var(--muted);padding:9px 14px;border-radius:10px}.tabs button.active{color:var(--gold);border-color:#b48a42}.panel label{display:grid;gap:6px;color:var(--muted);font-size:13px}.panel input,.panel select{width:100%;background:#0b1322;border:1px solid #31415d;border-radius:10px;padding:12px;color:var(--text)}.form-grid{grid-template-columns:repeat(2,minmax(0,1fr));margin-top:18px}.form-grid h3{grid-column:1/-1;margin:8px 0 0}.form-grid button{grid-column:1/-1}.games{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.game{min-width:0;overflow:hidden;border:1px solid var(--line);border-radius:14px;background:#0d1626}.game-art{position:relative;min-height:82px;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 10%,#fff3,transparent 55%),linear-gradient(145deg,#213f54,#101a2b)}.game-art:after{content:"";position:absolute;inset:auto 0 0;height:35%;background:linear-gradient(transparent,#070d19aa)}.game-art b{position:relative;z-index:1;font-size:36px;filter:drop-shadow(0 8px 9px #0008)}.game-art small{position:absolute;z-index:2;left:8px;bottom:7px;color:#e4edf7;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.game-copy{padding:10px}.game-copy b{display:block;font-size:13px}.game-copy span{display:block;margin-top:4px;font-size:10px;color:var(--muted)}.game[data-tone="teal"] .game-art{background:radial-gradient(circle at 50% 0%,#72e5db66,transparent 56%),linear-gradient(145deg,#0d5a5a,#102338)}.game[data-tone="berry"] .game-art{background:radial-gradient(circle at 50% 0%,#ef88b866,transparent 56%),linear-gradient(145deg,#6a2448,#21182f)}.game[data-tone="green"] .game-art{background:radial-gradient(circle at 50% 0%,#9be6a866,transparent 56%),linear-gradient(145deg,#245a39,#142533)}.game[data-tone="pitch"] .game-art{background:radial-gradient(circle at 50% 0%,#9be6a866,transparent 56%),linear-gradient(145deg,#1b7444,#122c31)}.game[data-tone="navy"] .game-art{background:radial-gradient(circle at 50% 0%,#94b9f266,transparent 56%),linear-gradient(145deg,#273c72,#151d36)}.game[data-tone="wine"] .game-art{background:radial-gradient(circle at 50% 0%,#ee9cbd66,transparent 56%),linear-gradient(145deg,#672d4e,#28182b)}.game[data-tone="gold"] .game-art,.game[data-tone="sand"] .game-art{background:radial-gradient(circle at 50% 0%,#f8d88977,transparent 56%),linear-gradient(145deg,#77552a,#25202b)}.game[data-tone="blue"] .game-art{background:radial-gradient(circle at 50% 0%,#80bbff66,transparent 56%),linear-gradient(145deg,#24577b,#151e38)}.game[data-tone="purple"] .game-art{background:radial-gradient(circle at 50% 0%,#c8a3ff66,transparent 56%),linear-gradient(145deg,#4e357a,#211a36)}.game[data-tone="gold"] .game-art,.game[data-tone="sand"] .game-art{color:#fff0c9}.penalty-roster-preview{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,.9fr);gap:14px;align-items:center;margin-top:16px;padding:16px;border:1px solid #77603b;border-radius:16px;background:linear-gradient(125deg,#17253a,#171e2c 70%,#382d1e)}.penalty-roster-preview h3{margin:4px 0 7px}.penalty-roster-preview label{display:grid;gap:6px;margin-top:10px;color:var(--muted);font-size:12px}.penalty-roster-preview select{width:100%;max-width:330px;background:#0b1322;border:1px solid #8b754a;border-radius:10px;padding:11px;color:var(--text)}.featured-player{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid #9a814d88;border-radius:12px;background:#091322aa}.featured-player-flag{font-size:38px}.featured-player-info{min-width:0;display:grid;gap:4px}.featured-player-info small{color:var(--gold);font-size:9px;font-weight:900;letter-spacing:.13em}.featured-player-info b{font-size:18px}.featured-player-info span{color:var(--muted);font-size:11px}.alert{border-radius:12px;padding:12px;background:#25324b;margin:12px 0}.alert.danger{background:#46232c;color:#ffe1e4}.notice{padding:12px;border-radius:12px;background:#243a39;color:#b9f9e5;margin:12px 0}.error{background:#482833;color:#ffe1e4}.muted{color:var(--muted)}footer{border-top:1px solid var(--line);margin-top:28px;padding:22px 0;color:var(--muted);font-size:12px}@media(max-width:760px){.wrap{padding:15px}.hero,.grid,.penalty-roster-preview{grid-template-columns:1fr}.hero{padding:30px 0 20px}.games{grid-template-columns:repeat(2,minmax(0,1fr))}.game-art{min-height:74px}.form-grid{grid-template-columns:1fr}.bar{align-items:flex-start}.brand h1{font-size:17px}}
  </style>
  <div class="wrap">
    <header class="bar"><div class="brand"><div class="logo">KL</div><div><h1>Kazino Lakay</h1><small>Milléclat Corp Groupe · Platfòm jwèt</small></div></div><div class="bar-actions">${state.user?'<span class="muted">'+esc(state.user.email)+'</span>':''}${state.user?button('Dekonekte','logout',state.busy,'ghost'):button('Konekte','login',state.busy,'ghost')}</div></header>
    <section class="hero"><div><span class="badge">V2.0 · BAZ PWODIKSYON</span><h2>Yon platfòm serye.<br><em>Yon kont ki pwoteje.</em></h2><p>Kazino Lakay ap prepare sistèm kliyan, kontwòl, kontablite ak sekirite. Nou pa aktive okenn paryaj, depo oswa retrè pandan preparasyon legal ak teknik la.</p></div><aside class="lock-card"><small>ETA SÈVIS</small><b>${ready?'BAZDONE PARE':'AN PREPARASYON'}</b><p>${state.health?.databaseConfigured?'PostgreSQL konekte.':'PostgreSQL poko konekte.'} Jwèt ak peman rete fèmen.</p><span class="pill">PAYMENTS OFF · GAMES OFF</span></aside></section>
    ${state.error?'<div class="notice error">'+esc(state.error)+'</div>':''}${state.success?'<div class="notice">'+esc(state.success)+'</div>':''}
    ${state.user ? accountPanel() + compliancePanel() : authPanel()}
    <section class="panel"><div class="section-title"><div><small>GAME CENTER</small><h2>22 jwèt yo</h2><p class="muted">Katalòg la disponib pou konsiltasyon sèlman. Okenn jwèt pa ka lanse nan Faz 1–3.</p></div><span class="pill">0 AKTIF</span></div><div class="games">${GAMES.map(game=>'<article class="game" data-tone="'+esc(game.tone||'navy')+'"><div class="game-art"><b>'+esc(game.symbol||'🎮')+'</b><small>'+esc(game.category||'Jwèt')+'</small></div><div class="game-copy"><b>'+esc(game.name)+'</b><span>Dezaktive · Faz 4</span></div></article>').join('')}</div>
      <div class="penalty-roster-preview"><div><small>SELEKSYON PEYI · PENALTY LAKAY</small><h3>Chwazi vedèt peyi a</h3><p class="hint">Chak peyi gen foutbolè reprezantan pa li. Jwèt la rete fèmen pandan faz preparasyon an.</p><label for="penalty-country">Peyi ekip ou a<select id="penalty-country" data-penalty-country>${PENALTY_TEAMS.map(team=>'<option value="'+team.id+'" '+(team.id===state.penaltyCountry?'selected':'')+'>'+team.flag+' '+esc(team.name)+'</option>').join('')}</select></label></div><div class="featured-player"><span class="featured-player-flag">${penaltyTeam.flag}</span><div class="featured-player-info"><small>VEDÈT REPREZANTAN</small><b>${esc(penaltyTeam.player.name)}</b><span>${esc(penaltyTeam.player.role)} · nimewo referans #${penaltyTeam.player.shirtNumber}</span></div></div></div>
    </section>
    <section class="grid"><div class="panel"><small>DEPO</small><h2>Ajoute lajan</h2><p>Espas entegrasyon founisè a prepare. MonCash/NatCash poko konekte.</p><button class="btn" disabled>Depoze — pa aktive</button></div><div class="panel"><small>RETRÈ</small><h2>Retire lajan</h2><p>Workflow apwobasyon ak kontwòl finansye a poko aktive.</p><button class="btn" disabled>Retire — pa aktive</button></div></section>
    <footer>© ${new Date().getFullYear()} Milléclat Corp Groupe · Kazino Lakay V2.0.0-alpha.2 · Tout fonksyon jwèt ak peman rete dezaktive.</footer>
  </div>`;

  if (!state.user) return;
}

async function loadPrivate() {
  if (!state.user) return;
  const profile = await api('/api/me');
  state.profile = profile;
  if (state.user.emailVerified) {
    const [wallet, compliance] = await Promise.all([
      api('/api/wallet').catch(()=>null),
      api('/api/compliance/status').catch(()=>null)
    ]);
    state.wallet = wallet;
    state.compliance = compliance;
  }
  render();
}
async function handleAction(action) {
  try {
    state.busy = true; render();
    if (action === 'logout') await logoutAccount();
    else if (action === 'login') { state.mode='login'; state.error=''; render(); }
    else if (action === 'refresh') { await loadPrivate(); }
    else if (action === 'compliance') { state.compliance = await api('/api/compliance/status'); render(); }
    else if (action === 'verify-email') { await resendVerification(); notice('Nou voye yon imel verifikasyon.','success'); }
    else if (action === 'reset') {
      const email = root.querySelector('[name="email"]')?.value || '';
      if (!email) throw new Error('Mete imel ou anvan ou mande rekiperasyon.');
      const { requestPasswordReset } = await import('./auth.js');
      await requestPasswordReset(email);
      notice('Nou voye yon lyen rekiperasyon sou imel ou.','success');
    }
  } catch(error) { state.error=error.message||'Demann lan echwe.'; }
  finally { state.busy=false; render(); }
}

root.addEventListener('change', (event) => {
  const country = event.target.closest('[data-penalty-country]');
  if (!country) return;
  state.penaltyCountry = country.value;
  render();
});

root.addEventListener('click', async (event) => {
  const mode = event.target.closest('[data-mode]');
  if (mode) { state.mode=mode.dataset.mode; state.error=''; render(); return; }
  const action = event.target.closest('[data-action]');
  if (action) { await handleAction(action.dataset.action); return; }
});
root.addEventListener('submit', async (event) => {
  if (event.target.id === 'auth-form') {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.target));
    try {
      state.busy=true; render();
      if (form.displayName) await registerAccount({ name: form.displayName, email: form.email, password: form.password });
      else await loginAccount({ email: form.email, password: form.password });
      state.success = form.displayName ? 'Kont kreye. Verifye imel ou.' : 'Ou konekte.';
    } catch(error) { state.error=error.message||'Koneksyon echwe.'; }
    finally { state.busy=false; render(); }
  }
  if (event.target.id === 'limits-form') {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.target));
    const body = { currency: 'HTG' };
    for (const [input,key] of [['dailyDepositLimit','dailyDepositLimitMinor'],['weeklyDepositLimit','weeklyDepositLimitMinor'],['dailyWagerLimit','dailyWagerLimitMinor'],['dailyLossLimit','dailyLossLimitMinor']]) {
      const raw=String(form[input]||'').trim();
      if (!raw) continue;
      const amount=Number(raw.replace(',','.'));
      if (!Number.isFinite(amount)||amount<=0) { state.error='Chak limit dwe yon montan pozitif.'; render(); return; }
      body[key]=Math.round(amount*100);
    }
    try { await api('/api/compliance/limits',{method:'POST',body}); state.success='Limit yo anrejistre oswa bese.'; state.compliance=await api('/api/compliance/status'); }
    catch(error){state.error=error.message||'Limit yo pa anrejistre.';}
    render();
  }
  if (event.target.id === 'exclude-form') {
    event.preventDefault();
    const duration=String(new FormData(event.target).get('duration')||'');
    if (!duration) return;
    if (!window.confirm('Oto-eksklizyon an bloke kont ou pandan dire ou chwazi a. Kontinye?')) return;
    try { await api('/api/compliance/self-exclusion',{method:'POST',body:{duration,reasonCode:'user_request'}}); state.success='Oto-eksklizyon aktive.'; state.compliance=await api('/api/compliance/status'); }
    catch(error){state.error=error.message||'Oto-eksklizyon echwe.';}
    render();
  }
});

async function loadHealth() {
  try { state.health = await api('/api/health'); }
  catch { state.health = {status:'maintenance',databaseConfigured:false,databaseReady:false,paymentsEnabled:false,realMoneyGamesEnabled:false}; }
  render();
}
if (firebaseReady) watchAuth(async (user) => {
  state.user=user; state.profile=null; state.wallet=null; state.compliance=null;
  if (user) {
    render();
    try {
      await api('/api/profile/bootstrap',{method:'POST',body:{displayName:user.displayName||''}});
      await loadPrivate();
    } catch(error) { state.error=error.message||'Pwofil la poko disponib.'; render(); }
  } else render();
});
render();
loadHealth();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => registration.update().catch(() => {}))
      .catch((error) => console.error('[Kazino Lakay] Service worker registration failed:', error));
  }, { once: true });
}

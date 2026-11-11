const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
export const EUROPEAN_ROULETTE_NUMBERS = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];

export function rouletteNumberColor(number) {
  if (Number(number) === 0) return 'green';
  return REDS.has(Number(number)) ? 'red' : 'black';
}

function polar(radius, angle) {
  const rad = angle * Math.PI / 180;
  return { x: 260 + radius * Math.cos(rad), y: 260 + radius * Math.sin(rad) };
}

function wheelSectorPath(index) {
  const step = 360 / EUROPEAN_ROULETTE_NUMBERS.length;
  const start = -90 + index * step;
  const end = start + step;
  const a = polar(207, start);
  const b = polar(207, end);
  const c = polar(143, end);
  const d = polar(143, start);
  return `M${a.x.toFixed(2)} ${a.y.toFixed(2)} A207 207 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)} L${c.x.toFixed(2)} ${c.y.toFixed(2)} A143 143 0 0 0 ${d.x.toFixed(2)} ${d.y.toFixed(2)}Z`;
}

export function rouletteWheelSvg() {
  const sectors = EUROPEAN_ROULETTE_NUMBERS.map((number, index) => {
    const color = rouletteNumberColor(number);
    const angle = -90 + (index + 0.5) * (360 / 37);
    const label = polar(174, angle);
    return `<path class="rr-pocket rr-pocket-${color}" d="${wheelSectorPath(index)}"/><text class="rr-pocket-label" x="${label.x.toFixed(2)}" y="${label.y.toFixed(2)}" transform="rotate(${(angle + 90).toFixed(2)} ${label.x.toFixed(2)} ${label.y.toFixed(2)})">${number}</text>`;
  }).join('');
  return `<svg class="rr-wheel-svg" viewBox="0 0 520 520" role="img" aria-label="Wou roulèt Ewopeyen ki gen nimewo 0 rive 36">
    <defs>
      <radialGradient id="rrWood" cx="32%" cy="24%"><stop offset="0" stop-color="#d5a969"/><stop offset=".42" stop-color="#8d552b"/><stop offset="1" stop-color="#321b11"/></radialGradient>
      <radialGradient id="rrGold" cx="30%" cy="22%"><stop offset="0" stop-color="#fff0b4"/><stop offset=".45" stop-color="#d8a84e"/><stop offset="1" stop-color="#78501f"/></radialGradient>
      <radialGradient id="rrHub" cx="30%" cy="25%"><stop offset="0" stop-color="#3a9673"/><stop offset=".7" stop-color="#14503d"/><stop offset="1" stop-color="#08271f"/></radialGradient>
      <filter id="rrGlow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <circle cx="260" cy="260" r="255" fill="#120b08"/>
    <circle cx="260" cy="260" r="249" fill="url(#rrWood)" stroke="#f2d28a" stroke-width="3"/>
    <circle cx="260" cy="260" r="231" fill="url(#rrGold)" stroke="#4d2d13" stroke-width="5"/>
    <circle cx="260" cy="260" r="218" fill="#20170f" stroke="#f8df9d" stroke-width="3"/>
    <g class="rr-wheel-rotor" id="rr-wheel-rotor">
      <circle cx="260" cy="260" r="212" fill="#2c2117" stroke="#f0d18a" stroke-width="2"/>
      ${sectors}
      <circle cx="260" cy="260" r="145" fill="#c39143" stroke="#4e3219" stroke-width="5"/>
      <circle cx="260" cy="260" r="133" fill="url(#rrHub)" stroke="#f3d38b" stroke-width="4"/>
      <circle cx="260" cy="260" r="113" fill="none" stroke="#d2b574" stroke-width="1.5" stroke-dasharray="2 5"/>
      <circle cx="260" cy="260" r="91" fill="none" stroke="#e5cc8d" stroke-width="1" opacity=".55"/>
      <text x="260" y="246" class="rr-hub-kicker" text-anchor="middle">KAZINO</text>
      <text x="260" y="280" class="rr-hub-title" text-anchor="middle">ROYAL</text>
      <text x="260" y="300" class="rr-hub-sub" text-anchor="middle">EUROPEAN • 37</text>
    </g>
    <circle cx="260" cy="260" r="8" fill="url(#rrGold)" stroke="#fff0b6" stroke-width="2"/>
  </svg>`;
}

export function rouletteCardIcon() {
  return `<svg class="game-symbol-svg" viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="rrCardGlow"><stop stop-color="#f7d98f"/><stop offset="1" stop-color="#8a5427"/></radialGradient></defs><circle cx="50" cy="50" r="43" fill="#142c24" stroke="#d9b66d" stroke-width="5"/><circle cx="50" cy="50" r="34" fill="#1f1a14" stroke="#f4d58f" stroke-width="2"/><g transform="translate(50 50)">${Array.from({length:12},(_,i)=>`<path d="M0 -33 L-5 -18 L5 -18 Z" transform="rotate(${i*30})" fill="${i%3===0?'#b52d42':'#111821'}" stroke="#d8b66f" stroke-width=".6"/>`).join('')}</g><circle cx="50" cy="50" r="12" fill="url(#rrCardGlow)" stroke="#fff0bd" stroke-width="2"/><circle cx="50" cy="50" r="4" fill="#432d17"/></svg>`;
}

function betLabel(selection) {
  if (!selection) return 'Chwazi yon nimewo oswa yon parye';
  if (selection.type === 'number') return `Nimewo ${selection.value}`;
  if (selection.type === 'color') return selection.value === 'red' ? 'Wouj' : 'Nwa';
  return selection.value === 'even' ? 'Pè' : 'Enpè';
}

function betButton(type, value, label, extraClass = '', stake = 100) {
  return `<button type="button" class="rr-bet-button ${extraClass}" data-roulette-action="bet" data-bet-type="${type}" data-bet-value="${value}" aria-pressed="false">${label}<span class="rr-chip-marker" aria-hidden="true">${stake}</span></button>`;
}

function betIsSelected(selection, type, value) {
  return selection && selection.type === type && String(selection.value) === String(value);
}

export function renderRouletteScreen(options) {
  const {
    balanceLabel = 'DEMO', stake = 100, selection = null, menuOpen = false,
    soundOn = true, busy = false, canAccountPlay = false, result = null
  } = options;
  const rows = [];
  for (const rowValue of [3, 2, 1]) for (let column = 0; column < 12; column += 1) rows.push(column * 3 + rowValue);
  const numberButtons = rows.map((number) => {
    const color = rouletteNumberColor(number);
    const selected = betIsSelected(selection, 'number', number);
    return `<button type="button" class="rr-number rr-number-${color} ${selected ? 'is-selected' : ''}" data-roulette-action="bet" data-bet-type="number" data-bet-value="${number}" aria-label="Mize sou nimewo ${number}" aria-pressed="${selected}">${number}<span class="rr-chip-marker" aria-hidden="true">${stake}</span></button>`;
  }).join('');
  const colorSelected = (value) => betIsSelected(selection, 'color', value);
  const paritySelected = (value) => betIsSelected(selection, 'parity', value);
  return `<section class="rr-screen" id="roulette-fullscreen" aria-label="Roulèt Royal">
    <header class="rr-topbar">
      <button class="rr-menu-button" type="button" data-roulette-action="menu" aria-label="Ouvri meni jwèt la" aria-expanded="${menuOpen}"><span></span><span></span><span></span></button>
      <div class="rr-heading"><span class="rr-brand-kicker">KAZINO LAKAY</span><h1>Roulèt Royal</h1></div>
      <div class="rr-top-stats"><div><small>Balans</small><strong data-roulette-balance>${balanceLabel}</strong></div><div><small>Miz</small><strong data-roulette-stake>${stake} P</strong></div></div>
    </header>
    <main class="rr-main">
      <section class="rr-wheel-area" aria-label="Wou Ewopeyen an">
        <div class="rr-wheel-frame">
          <div class="rr-wheel-svg-wrap">${rouletteWheelSvg()}</div>
          <div class="rr-pointer" aria-hidden="true"></div>
          <div class="rr-ball-orbit" id="rr-ball-orbit"><i class="rr-ball" id="rr-ball"></i></div>
        </div>
        <div class="rr-wheel-status"><span class="rr-live-dot"></span><span data-roulette-status>${busy ? 'SÈVÈ A AP KONFIME' : result ? 'DÈNYE REZILTA' : 'WOU EWOPEYEN • 0–36'}</span><strong data-roulette-last>${result?.details?.number ?? '—'}</strong></div>
      </section>
      <section class="rr-betting-area" aria-label="Tab parye roulèt">
        <div class="rr-table-brand"><span>ROYAL TABLE</span><small>EUROPEAN SINGLE ZERO</small></div>
        <div class="rr-number-layout"><div class="rr-zero-column">${betButton('number', 0, '0', 'rr-number-green rr-zero-button', stake)}</div><div class="rr-number-grid">${numberButtons}</div></div>
        <div class="rr-outside-bets">
          ${betButton('color', 'red', 'WOUJ', `rr-color-red ${colorSelected('red') ? 'is-selected' : ''}`, stake)}
          ${betButton('color', 'black', 'NWA', `rr-color-black ${colorSelected('black') ? 'is-selected' : ''}`, stake)}
          ${betButton('parity', 'even', 'PÈ', paritySelected('even') ? 'is-selected' : '', stake)}
          ${betButton('parity', 'odd', 'ENPÈ', paritySelected('odd') ? 'is-selected' : '', stake)}
        </div>
        <div class="rr-bet-readout"><span>PARyE CHWAZI</span><strong data-roulette-bet-label>${betLabel(selection)}</strong></div>
      </section>
    </main>
    <footer class="rr-controls">
      <div class="rr-chip-row" aria-label="Chwazi valè jeton an">
        <span class="rr-chip-caption">JETON</span>
        ${[10,50,100,500].map((value)=>`<button type="button" class="rr-chip ${stake===value?'is-active':''} rr-chip-${value}" data-roulette-action="chip" data-chip-value="${value}" aria-pressed="${stake===value}"><i>${value}</i><small>P</small></button>`).join('')}
      </div>
      <div class="rr-play-row">
        <span class="rr-demo-note">DEMO • Pwen san valè lajan</span>
        <button class="rr-play-button rr-play-account" type="button" data-roulette-action="account" ${busy || !canAccountPlay || !selection ? 'disabled' : ''}>Jwe ak balans</button>
        <button class="rr-play-button rr-play-demo" type="button" data-roulette-action="demo" ${busy || !selection ? 'disabled' : ''}>${busy ? 'WOU A AP VIRE…' : 'VIRE WOU A'}</button>
      </div>
    </footer>
    <aside class="rr-menu-layer" data-roulette-menu-layer ${menuOpen ? '' : 'hidden'}>
      <button type="button" class="rr-menu-backdrop" data-roulette-action="menu-close" aria-label="Fèmen meni"></button>
      <section class="rr-menu-panel" role="dialog" aria-modal="true" aria-labelledby="rr-menu-title">
        <div class="rr-menu-head"><div><span class="rr-brand-kicker">ROYAL TABLE</span><h2 id="rr-menu-title">Kijan pou jwe?</h2></div><button type="button" class="rr-menu-close" data-roulette-action="menu-close" aria-label="Fèmen meni">×</button></div>
        <div class="rr-rule-card"><strong>Objektif</strong><p>Chwazi yon nimewo 0–36, yon koulè wouj/nwa, oswa yon rezilta pè/enpè. Boul la dwe kanpe sou rezilta ou chwazi a.</p></div>
        <div class="rr-rule-card"><strong>Etap jwèt la</strong><p>1. Chwazi yon jeton 10, 50, 100 oswa 500 pwen. 2. Tape sou nimewo oswa parye ou vle a. 3. Peze “Vire wou a”. Rezilta a konfime sou sèvè a.</p></div>
        <div class="rr-rule-card"><strong>Retou posib</strong><p>Nimewo egzak: 36× retou total. Wouj/nwa oswa pè/enpè: 2× retou total. Zewo pa genyen sou pè/enpè.</p></div>
        <div class="rr-menu-actions"><button type="button" class="rr-menu-action" data-roulette-action="sound">${soundOn ? '🔊 Son aktive' : '🔇 Son dezaktive'}</button><button type="button" class="rr-menu-action rr-menu-back" data-roulette-action="back">← Retounen nan lis jwèt yo</button></div>
        <p class="rr-menu-disclaimer">Mòd demonstrasyon sèlman. Pwen yo pa gen valè lajan, yo pa kapab achte, vann, transfere oswa retire.</p>
      </section>
    </aside>
    <div class="rr-result-layer" data-roulette-result-layer ${result ? '' : 'hidden'}>${result ? rouletteResultMarkup(result) : ''}</div>
  </section>`;
}

export function rouletteResultMarkup(result) {
  const details = result.details || {};
  const number = Number(details.number ?? 0);
  const color = rouletteNumberColor(number);
  const net = Number(result.payoutPoints || 0) - Number(result.stakePoints || 0);
  const won = net > 0;
  const neutral = Number(result.payoutPoints || 0) === Number(result.stakePoints || 0);
  const change = won ? `+${Number(net).toLocaleString('fr-FR')} P` : neutral ? '0 P' : `−${Number(result.stakePoints || 0).toLocaleString('fr-FR')} P`;
  return `<div class="rr-result-card ${won ? 'rr-result-win' : neutral ? 'rr-result-neutral' : 'rr-result-loss'}" role="dialog" aria-modal="true" aria-labelledby="rr-result-title">
    <div class="rr-result-flare" aria-hidden="true"></div><div class="rr-result-kicker">${result.demoMode ? 'MÒD DEMONSTRASYON' : 'REZILTA KONT KONFIME'}</div>
    <div class="rr-result-number rr-number-${color}">${number}</div>
    <h2 id="rr-result-title">${won ? 'BON KOU!' : neutral ? 'EGALITE' : 'WONN FINI'}</h2>
    <strong class="rr-result-change">${change}</strong>
    <p>${result.message || `Wou a kanpe sou ${number}.`}</p>
    <div class="rr-result-details"><span>Jeton<strong>${Number(result.stakePoints || 0).toLocaleString('fr-FR')} P</strong></span><span>Retou<strong>${Number(result.payoutPoints || 0).toLocaleString('fr-FR')} P</strong></span><span>Rezilta<strong>${number} • ${color === 'red' ? 'Wouj' : color === 'black' ? 'Nwa' : 'Vèt'}</strong></span></div>
    <small>${result.demoMode ? 'Balans kont ou pa chanje.' : 'Balans kont ou mete ajou.'} Pwen yo pa gen valè lajan.</small>
    <button type="button" class="rr-result-continue" data-roulette-action="result-close">Kontinye</button>
  </div>`;
}

export async function animateRouletteSpin(screen, winningNumber) {
  const rotor = screen?.querySelector('#rr-wheel-rotor');
  const orbit = screen?.querySelector('#rr-ball-orbit');
  const ball = screen?.querySelector('#rr-ball');
  if (!rotor || !orbit || !ball) return;
  const index = EUROPEAN_ROULETTE_NUMBERS.indexOf(Number(winningNumber));
  const step = 360 / EUROPEAN_ROULETTE_NUMBERS.length;
  const alignment = ((360 - (((index + 0.5) * step) % 360)) % 360 + 360) % 360;
  const targetRotation = 6 * 360 + alignment;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const duration = reduced ? 450 : 6500;
  const wheelAnimation = rotor.animate(
    [{ transform: 'rotate(0deg)' }, { transform: `rotate(${targetRotation}deg)` }],
    { duration, easing: 'cubic-bezier(.09,.78,.12,1)', fill: 'forwards' }
  );
  const ballAnimation = orbit.animate(
    [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-3240deg)' }],
    { duration: duration * 0.98, easing: 'cubic-bezier(.12,.68,.18,1)', fill: 'forwards' }
  );
  await Promise.all([wheelAnimation.finished.catch(() => undefined), ballAnimation.finished.catch(() => undefined)]);
  ball.animate(
    [{ transform: 'translateX(-50%) translateY(0) scale(1)' }, { transform: 'translateX(-50%) translateY(22px) scale(.78)' }, { transform: 'translateX(-50%) translateY(19px) scale(.84)' }],
    { duration: reduced ? 100 : 520, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }
  );
}

let rouletteAudioContext;
export function playRouletteSound(enabled, type = 'click') {
  if (!enabled) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    rouletteAudioContext ||= new AudioContextClass();
    const context = rouletteAudioContext;
    if (context.state === 'suspended') void context.resume();
    const now = context.currentTime;
    const tones = type === 'win' ? [523.25,659.25,783.99,1046.5] : type === 'loss' ? [330,247,196] : type === 'spin' ? [150,230,310,420] : type === 'chip' ? [880,1174.66] : [620];
    tones.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type === 'spin' ? 'triangle' : 'sine';
      const start = now + index * (type === 'win' ? 0.105 : type === 'spin' ? 0.16 : 0.045);
      oscillator.frequency.setValueAtTime(frequency, start);
      if (type === 'spin') oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.8, start + 0.45);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(type === 'spin' ? 0.035 : 0.075, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + (type === 'spin' ? 0.54 : 0.19));
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + (type === 'spin' ? 0.56 : 0.22));
    });
  } catch {
    // Audio is optional; the game remains playable when the browser blocks sound.
  }
}

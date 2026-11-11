const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
const GAME_IDS = Object.freeze([
  'crash', 'slots', 'roulette', 'blackjack', 'baccarat', 'keno', 'dice', 'mines',
  'plinko', 'penalty', 'coinflip', 'limbo', 'hilo', 'scratch', 'wheel', 'sicbo', 'casinowar'
]);
let jwksCache = { keys: null, expiresAt: 0 };
let accessTokenCache = { token: null, expiresAt: 0 };

const json = (data, status = 200, extraHeaders = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders }
});
const b64url = (input) => btoa(String.fromCharCode(...new Uint8Array(input))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const decodeB64url = (value) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};
const decodeJsonPart = (part) => JSON.parse(new TextDecoder().decode(decodeB64url(part)));
const encoder = new TextEncoder();
const nowSeconds = () => Math.floor(Date.now() / 1000);

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
}
function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const requestOrigin = new URL(request.url).origin;
  const allowed = allowedOrigins(env);
  const ok = origin && (origin === requestOrigin || allowed.includes('*') || allowed.includes(origin));
  return {
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Access-Control-Max-Age': '86400',
    ...(ok ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {})
  };
}

async function getJwks() {
  if (jwksCache.keys && Date.now() < jwksCache.expiresAt) return jwksCache.keys;
  const response = await fetch(FIREBASE_JWKS_URL, { cf: { cacheTtl: 300, cacheEverything: true } });
  if (!response.ok) throw new Error('Firebase token signing keys cannot be fetched.');
  const data = await response.json();
  const cacheControl = response.headers.get('Cache-Control') || '';
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/)?.[1] || 300);
  jwksCache = { keys: data.keys || [], expiresAt: Date.now() + Math.min(maxAge, 3600) * 1000 };
  return jwksCache.keys;
}

async function verifyFirebaseIdToken(request, env, requireVerified = false) {
  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) throw new HttpError(401, 'Ou dwe konekte pou kontinye.');
  const parts = token.split('.');
  if (parts.length !== 3) throw new HttpError(401, 'Jeton koneksyon an pa valab.');
  let header, claims;
  try { header = decodeJsonPart(parts[0]); claims = decodeJsonPart(parts[1]); }
  catch { throw new HttpError(401, 'Jeton koneksyon an pa valab.'); }
  if (header.alg !== 'RS256' || !header.kid) throw new HttpError(401, 'Siyati jeton an pa valab.');
  const keyData = (await getJwks()).find((key) => key.kid === header.kid);
  if (!keyData) throw new HttpError(401, 'Kle siyati a pa jwenn. Rekonekte epi eseye ankò.');
  const publicKey = await crypto.subtle.importKey('jwk', keyData, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const data = encoder.encode(`${parts[0]}.${parts[1]}`);
  const validSignature = await crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, publicKey, decodeB64url(parts[2]), data);
  const projectId = env.FIREBASE_PROJECT_ID;
  const now = nowSeconds();
  if (!validSignature || !projectId || claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}` ||
      !claims.sub || claims.sub.length > 128 || !Number.isFinite(claims.exp) || claims.exp <= now ||
      !Number.isFinite(claims.iat) || claims.iat > now + 300 || !Number.isFinite(claims.auth_time) || claims.auth_time > now + 300) {
    throw new HttpError(401, 'Sesyon ou a pa valab oswa li ekspire. Rekonekte.');
  }
  if (requireVerified && claims.email_verified !== true) throw new HttpError(403, 'Verifye imel ou anvan ou jwe.');
  return { uid: claims.sub, email: String(claims.email || '').toLowerCase(), emailVerified: claims.email_verified === true, name: String(claims.name || '') };
}

function pemToDer(pem) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\\n/g, '\n').replace(/\s+/g, '');
  const raw = atob(body);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function getServiceAccessToken(env) {
  if (accessTokenCache.token && Date.now() < accessTokenCache.expiresAt - 60_000) return accessTokenCache.token;
  if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY || !env.FIREBASE_PROJECT_ID) {
    throw new HttpError(503, 'Backend Firebase la poko konfigire.');
  }
  const issuedAt = nowSeconds();
  const header = b64url(encoder.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const payload = b64url(encoder.encode(JSON.stringify({
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope: FIRESTORE_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + 3600
  })));
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(env.FIREBASE_PRIVATE_KEY), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(unsigned));
  const assertion = `${unsigned}.${b64url(signature)}`;
  const body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion });
  const response = await fetch(GOOGLE_TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.access_token) throw new HttpError(503, 'Backend la pa kapab otantifye ak Firebase. Verifye sekrè Google Cloud yo.');
  accessTokenCache = { token: result.access_token, expiresAt: Date.now() + Number(result.expires_in || 3600) * 1000 };
  return result.access_token;
}

function fsValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === 'number') return { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(fsValue) } };
  if (typeof value === 'object') return { mapValue: { fields: fsFields(value) } };
  return { nullValue: null };
}
function fsFields(object) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, fsValue(value)]));
}
function fromFsValue(value) {
  if (!value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromFsValue);
  if ('mapValue' in value) return fsDocumentFields({ fields: value.mapValue.fields || {} });
  return null;
}
function fsDocumentFields(document) {
  return Object.fromEntries(Object.entries(document?.fields || {}).map(([key, value]) => [key, fromFsValue(value)]));
}

function firestoreBase(env) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents`;
}
async function firestoreRequest(path, env, options = {}) {
  const token = await getServiceAccessToken(env);
  const response = await fetch(`${firestoreBase(env)}${path}`, {
    method: options.method || 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = {}; }
  if (!response.ok) {
    const code = Number(payload.error?.code || response.status);
    if (code === 404) return null;
    if (code === 409 || code === 400 && /FAILED_PRECONDITION|ABORTED|update time/i.test(payload.error?.message || '')) throw new HttpError(409, 'Balans lan chanje nan yon lòt demann. Tanpri rekòmanse jwèt la.');
    throw new HttpError(503, `Firestore pa aksepte operasyon an (${code}).`);
  }
  return payload;
}
async function getUserDocument(uid, env) {
  return firestoreRequest(`/users/${encodeURIComponent(uid)}`, env);
}
async function commitWrites(writes, env) {
  return firestoreRequest(':commit', env, { method: 'POST', body: { writes } });
}

function adminEmails(env) {
  return (env.INITIAL_ADMIN_EMAILS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
}

async function requireAdmin(request, env) {
  const identity = await verifyFirebaseIdToken(request, env, true);
  if (!adminEmails(env).includes(identity.email)) {
    throw new HttpError(403, 'Aksè sa a rezève pou administratè otorize.');
  }
  return identity;
}

async function listCollection(collectionId, env, pageSize = 100) {
  const safeCollections = new Set(['users', 'gameRounds', 'adminActions']);
  if (!safeCollections.has(collectionId)) throw new HttpError(400, 'Koleksyon sa a pa disponib.');
  const payload = await firestoreRequest(`/${collectionId}?pageSize=${Math.min(100, Math.max(1, pageSize))}`, env);
  const documents = payload?.documents || [];
  return documents.map((document) => {
    const fields = fsDocumentFields(document);
    const id = String(document.name || '').split('/').pop();
    return { ...fields, id };
  });
}

function sortNewest(items) {
  return [...items].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

async function adminOverview(env) {
  const [users, rounds, actions] = await Promise.all([
    listCollection('users', env, 100),
    listCollection('gameRounds', env, 100),
    listCollection('adminActions', env, 25)
  ]);
  const activeUsers = users.filter((user) => (user.accountStatus || 'active') === 'active').length;
  const suspendedUsers = users.filter((user) => user.accountStatus === 'suspended').length;
  const totalPoints = users.reduce((sum, user) => sum + Math.max(0, Number(user.pointsBalance) || 0), 0);
  return {
    usersSampled: users.length,
    usersLimit: 100,
    activeUsers,
    suspendedUsers,
    totalPointsInSample: totalPoints,
    roundsSampled: rounds.length,
    roundsLimit: 100,
    recentActions: sortNewest(actions).slice(0, 10)
  };
}

async function updateManagedUser(request, env, actor) {
  const body = await readBody(request);
  const uid = String(body.uid || '').trim();
  const reason = String(body.reason || '').trim().slice(0, 250);
  const accountStatus = body.accountStatus == null ? null : String(body.accountStatus);
  const pointsDelta = body.pointsDelta == null || body.pointsDelta === '' ? 0 : Number(body.pointsDelta);
  if (!uid || uid.length > 128) throw new HttpError(400, 'ID jwè a pa valab.');
  if (uid === actor.uid && accountStatus === 'suspended') throw new HttpError(400, 'Ou pa kapab sispann pwòp kont administratè ou.');
  if (accountStatus !== null && !['active', 'suspended'].includes(accountStatus)) throw new HttpError(400, 'Estati kont lan dwe active oswa suspended.');
  if (!Number.isInteger(pointsDelta) || Math.abs(pointsDelta) > 100000) throw new HttpError(400, 'Ajisteman pwen an dwe ant -100 000 ak +100 000.');
  if (!reason || reason.length < 3) throw new HttpError(400, 'Ekri yon rezon ki gen omwen 3 karaktè.');
  if (accountStatus === null && pointsDelta === 0) throw new HttpError(400, 'Pa gen okenn chanjman pou anrejistre.');

  const document = await getUserDocument(uid, env);
  if (!document) throw new HttpError(404, 'Kont jwè sa a pa jwenn.');
  const current = fsDocumentFields(document);
  const protectedAdmin = adminEmails(env).includes(String(current.email || '').toLowerCase());
  if (protectedAdmin) throw new HttpError(403, 'Pou sekirite, aksyon sa a pa kapab modifye yon lòt kont administratè.');
  const currentBalance = Number(current.pointsBalance || 0);
  const nextBalance = currentBalance + pointsDelta;
  if (nextBalance < 0 || nextBalance > 1000000000) throw new HttpError(400, 'Nouvo balans lan pa valab.');

  const now = new Date().toISOString();
  const updated = {
    ...current,
    ...(accountStatus ? { accountStatus } : {}),
    ...(pointsDelta ? { pointsBalance: nextBalance } : {}),
    updatedAt: now
  };
  const actionId = crypto.randomUUID();
  const action = {
    id: actionId,
    type: 'admin_user_update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    targetUid: uid,
    targetEmail: String(current.email || ''),
    accountStatus: accountStatus || null,
    pointsDelta,
    balanceBefore: currentBalance,
    balanceAfter: nextBalance,
    reason,
    createdAt: now
  };
  const userName = `${firestoreBase(env)}/users/${encodeURIComponent(uid)}`;
  const actionName = `${firestoreBase(env)}/adminActions/${actionId}`;
  await commitWrites([
    { update: { name: userName, fields: fsFields(updated) }, currentDocument: { updateTime: document.updateTime } },
    { update: { name: actionName, fields: fsFields(action) }, currentDocument: { exists: false } }
  ], env);
  return {
    ok: true,
    user: { uid, email: String(updated.email || ''), displayName: String(updated.displayName || ''), accountStatus: updated.accountStatus || 'active', pointsBalance: Number(updated.pointsBalance || 0) },
    actionId
  };
}

function profileFromDocument(doc, identity, env) {
  const fields = fsDocumentFields(doc);
  const admin = identity.emailVerified && adminEmails(env).includes(identity.email);
  return {
    uid: identity.uid,
    email: identity.email,
    displayName: fields.displayName || identity.name || '',
    role: admin ? 'admin' : 'player',
    accountStatus: fields.accountStatus || 'active',
    pointsBalance: Number(fields.pointsBalance || 0),
    createdAt: fields.createdAt || null
  };
}

async function bootstrapProfile(request, env, identity) {
  const body = await request.json().catch(() => ({}));
  const displayName = String(body.displayName || identity.name || '').trim().slice(0, 60);
  const doc = await getUserDocument(identity.uid, env);
  if (doc) {
    const existing = fsDocumentFields(doc);
    if (!existing.displayName && displayName) {
      const updated = { ...existing, displayName, updatedAt: new Date().toISOString() };
      const name = `${firestoreBase(env)}/users/${encodeURIComponent(identity.uid)}`;
      await commitWrites([{ update: { name, fields: fsFields(updated) }, currentDocument: { updateTime: doc.updateTime } }], env);
      return { ...profileFromDocument({ fields: fsFields(updated), updateTime: doc.updateTime }, identity, env), displayName };
    }
    return profileFromDocument(doc, identity, env);
  }
  const now = new Date().toISOString();
  const role = identity.emailVerified && adminEmails(env).includes(identity.email) ? 'admin' : 'player';
  const fields = fsFields({ uid: identity.uid, email: identity.email, displayName, role, accountStatus: 'active', pointsBalance: 10000, createdAt: now, updatedAt: now });
  const name = `${firestoreBase(env)}/users/${encodeURIComponent(identity.uid)}`;
  await commitWrites([{ update: { name, fields }, currentDocument: { exists: false } }], env);
  const created = await getUserDocument(identity.uid, env);
  return profileFromDocument(created, identity, env);
}

function randomInt(max) {
  if (!Number.isInteger(max) || max < 1) throw new Error('Invalid random range');
  const range = 0x100000000;
  const ceiling = range - (range % max);
  const array = new Uint32Array(1);
  let value;
  do { crypto.getRandomValues(array); value = array[0]; } while (value >= ceiling);
  return value % max;
}
const pick = (list) => list[randomInt(list.length)];
const moneyMultiplier = (stake, mult) => Math.floor(stake * mult);
function shuffledDeck() {
  const deck = [];
  for (const suit of ['♠','♥','♦','♣']) {
    for (let rank = 2; rank <= 14; rank += 1) deck.push({ rank, suit });
  }
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
const drawCard = (deck) => {
  const next = deck.pop();
  if (!next) throw new Error('Pa gen kat ki rete nan pil la.');
  return next;
};
const cardName = (rank) => ({11:'J',12:'Q',13:'K',14:'A'}[rank] || String(rank));

export function resolveGame(gameId, stake, choice = {}) {
  let won = false, multiplier = 0, title = 'Wonn fini', message = '', details = {}, animationKey = gameId;
  switch (gameId) {
    case 'crash': {
      const target = Number(choice.target);
      if (![1.2,1.5,2,3,5].includes(target)) throw new HttpError(400, 'Objektif Crash la pa valab.');
      const crashAt = Math.max(1, Number((1 + Math.pow(randomInt(1000000) / 1000000, 2.1) * 8).toFixed(2)));
      won = crashAt >= target; multiplier = won ? target : 0;
      details = { crashAt, target, reached: won };
      message = won ? `Vòl la rive ${crashAt.toFixed(2)}×. Objektif ${target.toFixed(2)}× ou a atenn.` : `Vòl la fini nan ${crashAt.toFixed(2)}×, anvan objektif ${target.toFixed(2)}× ou a.`;
      break;
    }
    case 'slots': {
      const symbols = ['🍒','🍋','🔔','💎','7️⃣','⭐'];
      const result = [pick(symbols), pick(symbols), pick(symbols)];
      if (result.every((s) => s === '7️⃣')) multiplier = 10;
      else if (result.every((s) => s === result[0])) multiplier = 5;
      else if (new Set(result).size === 2) multiplier = 1.5;
      won = multiplier > 0; details = { symbols: result, multiplier };
      message = won ? `Konbinezon ${result.join(' ')} bay ${multiplier}×.` : `Konbinezon ${result.join(' ')} pa bay retou.`;
      break;
    }
    case 'roulette': {
      const n = randomInt(37);
      const red = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
      const color = n === 0 ? 'green' : red.has(n) ? 'red' : 'black';
      const betType = String(choice.betType || (choice.pick ? 'legacy-color' : ''));
      let betValue = choice.betValue;
      if (betType === 'number') {
        betValue = Number(betValue);
        if (!Number.isInteger(betValue) || betValue < 0 || betValue > 36) throw new HttpError(400, 'Chwazi yon nimewo antye ant 0 ak 36.');
        won = n === betValue;
        multiplier = won ? 36 : 0;
      } else if (betType === 'color') {
        betValue = String(betValue || '').toLowerCase();
        if (!['red','black'].includes(betValue)) throw new HttpError(400, 'Chwazi koulè wouj oswa nwa. Pou zewo, chwazi nimewo 0.');
        won = color === betValue;
        multiplier = won ? 2 : 0;
      } else if (betType === 'parity') {
        betValue = String(betValue || '').toLowerCase();
        if (!['even','odd'].includes(betValue)) throw new HttpError(400, 'Chwazi pè oswa enpè.');
        won = n !== 0 && (n % 2 === 0 ? 'even' : 'odd') === betValue;
        multiplier = won ? 2 : 0;
      } else if (betType === 'legacy-color') {
        betValue = String(choice.pick || '');
        if (!['red','black','green'].includes(betValue)) throw new HttpError(400, 'Chwazi wouj, nwa oswa vèt.');
        won = color === betValue;
        multiplier = won ? (color === 'green' ? 36 : 2) : 0;
      } else {
        throw new HttpError(400, 'Chwazi yon nimewo, koulè oswa pè/enpè.');
      }
      const colorLabel = color === 'red' ? 'wouj' : color === 'black' ? 'nwa' : 'vèt';
      const betLabel = betType === 'number' ? `nimewo ${betValue}` : betType === 'color' ? (betValue === 'red' ? 'wouj' : 'nwa') : betType === 'parity' ? (betValue === 'even' ? 'pè' : 'enpè') : (betValue === 'green' ? 'zewo/vèt' : betValue === 'red' ? 'wouj' : 'nwa');
      details = { number: n, color, betType, betValue, selected: betValue, multiplier };
      message = `Wou a kanpe sou ${n} (${colorLabel}). ${won ? `Pari ${betLabel} la genyen.` : `Pari ${betLabel} la pa koresponn.`}`;
      break;
    }
    case 'blackjack': {
      const standAt = Number(choice.standAt);
      if (!Number.isInteger(standAt) || standAt < 12 || standAt > 20) throw new HttpError(400, 'Chwazi yon limit ant 12 ak 20.');
      const shoe = shuffledDeck();
      const draw = () => drawCard(shoe);
      const handValue = (hand) => {
        let total = hand.reduce((sum, c) => sum + (c.rank === 14 ? 11 : c.rank > 10 ? 10 : c.rank), 0);
        let aces = hand.filter((c) => c.rank === 14).length;
        while (total > 21 && aces > 0) { total -= 10; aces--; }
        return total;
      };
      const player = [draw(), draw()], dealer = [draw(), draw()];
      while (handValue(player) < standAt && player.length < 6) player.push(draw());
      while (handValue(dealer) < 17 && dealer.length < 6) dealer.push(draw());
      const p = handValue(player), d = handValue(dealer);
      won = p <= 21 && (d > 21 || p > d); multiplier = p > 21 ? 0 : (d > 21 || p > d) ? 2 : p === d ? 1 : 0;
      details = { player: player.map((c) => `${cardName(c.rank)}${c.suit}`), dealer: dealer.map((c) => `${cardName(c.rank)}${c.suit}`), playerTotal: p, dealerTotal: d, standAt };
      message = p > 21 ? `Men ou fè ${p}: ou depase 21.` : d > 21 ? `Koutye a fè ${d}: koutye a depase 21.` : p === d ? `Egalite: tou de men yo fè ${p}.` : won ? `Ou fè ${p}, koutye a fè ${d}. Ou genyen.` : `Koutye a fè ${d}, men ou fè ${p}.`;
      break;
    }
    case 'baccarat': {
      const shoe = shuffledDeck();
      const playerCards = [drawCard(shoe), drawCard(shoe)], bankerCards = [drawCard(shoe), drawCard(shoe)];
      const value = (hand) => hand.reduce((sum, c) => sum + (c.rank >= 10 && c.rank <= 13 ? 0 : c.rank === 14 ? 1 : c.rank), 0) % 10;
      let pv = value(playerCards), bv = value(bankerCards);
      let playerThird = null;
      const natural = pv >= 8 || bv >= 8;
      if (!natural && pv <= 5) { playerThird = drawCard(shoe); playerCards.push(playerThird); pv = value(playerCards); }
      if (!natural) {
        let bankerDraw = false;
        if (!playerThird) bankerDraw = bv <= 5;
        else {
          const third = playerThird.rank === 14 ? 1 : playerThird.rank >= 10 ? 0 : playerThird.rank;
          bankerDraw = bv <= 2 || (bv === 3 && third !== 8) || (bv === 4 && third >= 2 && third <= 7) || (bv === 5 && third >= 4 && third <= 7) || (bv === 6 && (third === 6 || third === 7));
        }
        if (bankerDraw) { bankerCards.push(drawCard(shoe)); bv = value(bankerCards); }
      }
      const winner = pv > bv ? 'player' : bv > pv ? 'banker' : 'tie';
      const bet = String(choice.pick || '');
      if (!['player','banker','tie'].includes(bet)) throw new HttpError(400, 'Chwazi Jwè, Bankye oswa Egalite.');
      won = bet === winner; multiplier = winner === 'tie' && bet !== 'tie' ? 1 : won ? (bet === 'tie' ? 8 : bet === 'banker' ? 1.95 : 2) : 0;
      details = { playerCards: playerCards.map((c) => `${cardName(c.rank)}${c.suit}`), bankerCards: bankerCards.map((c) => `${cardName(c.rank)}${c.suit}`), playerScore: pv, bankerScore: bv, winner, selection: bet };
      message = `Jwè ${pv} — Bankye ${bv}. ${winner === 'tie' ? 'Egalite' : winner === 'player' ? 'Jwè' : 'Bankye'} genyen.`;
      break;
    }
    case 'keno': {
      const numbers = Array.isArray(choice.numbers) ? choice.numbers.map(Number) : [];
      if (numbers.length !== 5 || new Set(numbers).size !== 5 || numbers.some((n) => !Number.isInteger(n) || n < 1 || n > 25)) throw new HttpError(400, 'Chwazi egzakteman 5 nimewo diferan ant 1 ak 25.');
      const drawn = new Set(); while (drawn.size < 10) drawn.add(1 + randomInt(25));
      const hits = numbers.filter((n) => drawn.has(n));
      multiplier = ({3:1,4:2,5:5})[hits.length] || 0; won = multiplier > 0;
      details = { selected: numbers, drawn: [...drawn].sort((a,b) => a-b), hits: hits.sort((a,b) => a-b), hitCount: hits.length };
      message = `Ou jwenn ${hits.length} sou 5 nimewo. ${won ? `Retou ${multiplier}×.` : 'Pa gen retou nan rezilta sa a.'}`;
      break;
    }
    case 'dice': {
      const a = 1 + randomInt(6), b = 1 + randomInt(6), sum = a + b, bet = String(choice.pick || '');
      if (!['over7','under7','exact8'].includes(bet)) throw new HttpError(400, 'Chwazi yon prediksyon Dice.');
      won = bet === 'over7' ? sum > 7 : bet === 'under7' ? sum < 7 : sum === 8;
      multiplier = won ? (bet === 'exact8' ? 6 : 2.4) : 0;
      details = { dice: [a,b], total: sum, selection: bet };
      message = `Zo yo bay ${a} + ${b} = ${sum}. ${won ? 'Prediksyon ou bon.' : 'Prediksyon ou pa bon.'}`;
      break;
    }
    case 'mines': {
      const cells = Array.isArray(choice.cells) ? choice.cells.map(Number) : [];
      if (cells.length < 1 || cells.length > 5 || new Set(cells).size !== cells.length || cells.some((n) => !Number.isInteger(n) || n < 1 || n > 25)) throw new HttpError(400, 'Chwazi ant 1 ak 5 kare diferan sou tablo a.');
      const mines = new Set(); while (mines.size < 3) mines.add(1 + randomInt(25));
      const hitMines = cells.filter((n) => mines.has(n));
      won = hitMines.length === 0;
      multiplier = won ? Number((Math.pow(25 / (25 - 3), cells.length) * (1 - cells.length * 0.018)).toFixed(2)) : 0;
      details = { selectedCells: cells, mineCount: 3, revealedMines: [...mines].sort((a,b) => a-b), hitMines };
      message = won ? `Tout ${cells.length} kare ou yo te san min.` : `Ou jwenn yon min nan kare ${hitMines.join(', ')}.`;
      break;
    }
    case 'plinko': {
      const multipliers = [0.5,1,2,5,2,1,0.5];
      const path = Array.from({ length: 6 }, () => randomInt(2) ? 'R' : 'L');
      const slot = 1 + path.filter((step) => step === 'R').length;
      multiplier = multipliers[slot - 1]; won = multiplier > 0;
      details = { slot, multiplier, path };
      message = `Boul la tonbe nan pòch ${slot + 1}, ki gen ${multiplier}×.`;
      break;
    }
    case 'penalty': {
      const shot = String(choice.shot || '');
      if (!['left','center','right'].includes(shot)) throw new HttpError(400, 'Chwazi agoch, nan mitan oswa adwat.');
      const keeper = pick(['left','center','right']);
      won = shot !== keeper; multiplier = won ? 2 : 0;
      details = { shot, keeper, goal: won };
      message = won ? `GÒL! Ou tire ${shot === 'left' ? 'agoch' : shot === 'right' ? 'adwat' : 'nan mitan'}, gadyen an plonje ${keeper === 'left' ? 'agoch' : keeper === 'right' ? 'adwat' : 'nan mitan'}.` : `Gadyen an bloke tir ou nan ${keeper === 'left' ? 'agoch' : keeper === 'right' ? 'adwat' : 'nan mitan'}.`;
      break;
    }
    case 'coinflip': {
      const side = String(choice.pick || '');
      if (!['heads','tails'].includes(side)) throw new HttpError(400, 'Chwazi Fas oswa Pil.');
      const result = randomInt(2) === 0 ? 'heads' : 'tails';
      won = side === result; multiplier = won ? 1.9 : 0;
      details = { result, selection: side };
      message = `Pyès la tonbe sou ${result === 'heads' ? 'Fas' : 'Pil'}. ${won ? 'Ou te byen devine.' : 'Chwa a pa koresponn.'}`;
      break;
    }
    case 'limbo': {
      const target = Number(choice.target);
      if (!Number.isFinite(target) || target < 1.1 || target > 20) throw new HttpError(400, 'Mete yon objektif ant 1.1× ak 20×.');
      const r = Math.max(1, Math.min(50, Number((1 / Math.max(0.0001, randomInt(1000000) / 1000000)).toFixed(2))));
      won = r >= target; multiplier = won ? target : 0;
      details = { result: r, target, reached: won };
      message = `Rezilta Limbo a se ${r.toFixed(2)}×. ${won ? 'Objektif ou a atenn.' : 'Rezilta a pi ba pase objektif la.'}`;
      break;
    }
    case 'hilo': {
      const selection = String(choice.pick || '');
      if (!['high','low'].includes(selection)) throw new HttpError(400, 'Chwazi Pi wo oswa Pi ba.');
      const shoe = shuffledDeck();
      const first = drawCard(shoe), next = drawCard(shoe);
      won = selection === 'high' ? next.rank > first.rank : next.rank < first.rank;
      multiplier = won ? 1.9 : 0;
      details = { first: `${cardName(first.rank)}${first.suit}`, next: `${cardName(next.rank)}${next.suit}`, firstValue: first.rank, nextValue: next.rank, selection };
      message = first.rank === next.rank ? 'De kat yo egal. Wonn sa a pa bay retou.' : won ? 'Ou byen devine direksyon dezyèm kat la.' : 'Dezyèm kat la pa soti nan direksyon ou te chwazi a.';
      break;
    }
    case 'scratch': {
      const symbols = ['🍒','🍋','🔔','💎','⭐','7️⃣'];
      const result = [pick(symbols),pick(symbols),pick(symbols)];
      const count = result.filter((x) => x === result[0]).length;
      multiplier = count === 3 ? 4 : new Set(result).size === 2 ? 1.2 : 0;
      won = multiplier > 0;
      details = { symbols: result, matchingCount: count, multiplier };
      message = won ? `Kat la revele ${result.join(' ')}. Konbinezon an bay ${multiplier}×.` : `Kat la revele ${result.join(' ')}. Pa gen pè oswa twa menm.`;
      break;
    }
    case 'wheel': {
      const segments = [0,0.5,1,1.2,1.5,2,3,5];
      multiplier = segments[randomInt(segments.length)]; won = multiplier > 0;
      details = { segment: `${multiplier}×`, multiplier };
      message = `Wou a kanpe sou ${multiplier}×.`;
      break;
    }
    case 'sicbo': {
      const dice = [1 + randomInt(6),1 + randomInt(6),1 + randomInt(6)];
      const sum = dice.reduce((a,b) => a+b,0), triple = dice.every((n) => n === dice[0]), selection = String(choice.pick || '');
      if (!['small','big','triple'].includes(selection)) throw new HttpError(400, 'Chwazi Ti, Gwo oswa Triple.');
      won = selection === 'triple' ? triple : !triple && (selection === 'small' ? sum >= 4 && sum <= 10 : sum >= 11 && sum <= 17);
      multiplier = won ? (selection === 'triple' ? 25 : 1.9) : 0;
      details = { dice, total: sum, triple, selection };
      message = `Twa zo yo bay ${dice.join(' + ')} = ${sum}${triple ? ' (Triple)' : ''}. ${won ? 'Prediksyon ou mache.' : 'Prediksyon ou pa mache.'}`;
      break;
    }
    case 'casinowar': {
      const shoe = shuffledDeck();
      const player = drawCard(shoe), banker = drawCard(shoe);
      won = player.rank > banker.rank; multiplier = player.rank === banker.rank ? 1 : won ? 2 : 0;
      details = { playerCard: `${cardName(player.rank)}${player.suit}`, bankerCard: `${cardName(banker.rank)}${banker.suit}`, playerValue: player.rank, bankerValue: banker.rank };
      message = player.rank === banker.rank ? `Egalite: tou de kat yo se ${cardName(player.rank)}.` : won ? `Kat ou (${cardName(player.rank)}) pi wo pase kat bankye a (${cardName(banker.rank)}).` : `Kat bankye a (${cardName(banker.rank)}) pi wo pase pa w la (${cardName(player.rank)}).`;
      break;
    }
    default: throw new HttpError(404, 'Jwèt sa a pa disponib.');
  }
  const payoutPoints = moneyMultiplier(stake, multiplier);
  return { payoutPoints, result: { title: won ? 'Bon kou!' : multiplier === 1 ? 'Egalite' : 'Wonn fini', message, multiplier, payoutPoints, animationKey, details } };
}

async function readBody(request) {
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 8192) throw new HttpError(413, 'Demann lan twò gwo.');
  return request.json().catch(() => { throw new HttpError(400, 'Done demann lan pa yon JSON valab.'); });
}

async function getHistory(uid, env) {
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'gameRounds' }],
      where: { fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: { stringValue: uid } } },
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
      limit: 30
    }
  };
  const rows = await firestoreRequest(':runQuery', env, { method: 'POST', body: query });
  return (rows || []).filter((row) => row.document).map((row) => fsDocumentFields(row.document));
}

function firebaseRuntimeDiagnostics(env) {
  const entries = [
    ['FIREBASE_PROJECT_ID', env.FIREBASE_PROJECT_ID],
    ['FIREBASE_CLIENT_EMAIL', env.FIREBASE_CLIENT_EMAIL],
    ['FIREBASE_PRIVATE_KEY', env.FIREBASE_PRIVATE_KEY]
  ];
  const missing = entries
    .filter(([, value]) => typeof value !== 'string' || value.trim().length === 0)
    .map(([name]) => name);
  const invalid = [];
  if (env.FIREBASE_CLIENT_EMAIL && !/^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/i.test(String(env.FIREBASE_CLIENT_EMAIL).trim())) {
    invalid.push('FIREBASE_CLIENT_EMAIL');
  }
  if (env.FIREBASE_PRIVATE_KEY && !/-----BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY-----/.test(String(env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, '\n'))) {
    invalid.push('FIREBASE_PRIVATE_KEY');
  }
  return { missing, invalid };
}

function apiStatus(env) {
  const firebase = firebaseRuntimeDiagnostics(env);
  return {
    service: 'kazino-lakay',
    status: 'ok',
    mode: 'points-only',
    cashValue: false,
    firebaseConfigured: firebase.missing.length === 0 && firebase.invalid.length === 0,
    firebaseMissing: firebase.missing,
    firebaseInvalid: firebase.invalid,
    adminConfigured: adminEmails(env).length > 0,
    demoPlayEnabled: true,
    gamesEnabled: true,
    gameCount: GAME_IDS.length,
    gameIds: GAME_IDS,
    endpoints: ['/api/health', '/api/games', '/api/games/demo', '/api/profile/bootstrap', '/api/me', '/api/history', '/api/games/play', '/api/admin/summary', '/api/admin/users', '/api/admin/rounds', '/api/admin/actions', '/api/admin/users/update']
  };
}

async function route(request, env) {
  const url = new URL(request.url);
  // These are API-only fallbacks. In production, / is normally served as dist/index.html
  // by Workers Static Assets before this Worker is invoked.
  if ((url.pathname === '/' || url.pathname === '/api' || url.pathname === '/health' || url.pathname === '/api/health') && request.method === 'GET') {
    return json(apiStatus(env));
  }
  if (url.pathname === '/api/games' && request.method === 'GET') {
    return json({ games: GAME_IDS, count: GAME_IDS.length, enabled: true, mode: 'points-only' });
  }
  if (url.pathname === '/api/games/demo' && request.method === 'POST') {
    const body = await readBody(request);
    const gameId = String(body.gameId || '');
    const stakePoints = Number(body.stakePoints);
    if (!Number.isInteger(stakePoints) || stakePoints < 10 || stakePoints > 1000) throw new HttpError(400, 'Mete ant 10 ak 1 000 pwen demonstrasyon.');
    const game = resolveGame(gameId, stakePoints, body.choice || {});
    return json({ demo: true, mode: 'points-only', result: game.result });
  }
  if (url.pathname === '/api/profile/bootstrap' && request.method === 'POST') {
    const identity = await verifyFirebaseIdToken(request, env, false);
    const profile = await bootstrapProfile(request, env, identity);
    return json(profile);
  }
  if (url.pathname === '/api/me' && request.method === 'GET') {
    const identity = await verifyFirebaseIdToken(request, env, false);
    const doc = await getUserDocument(identity.uid, env);
    if (!doc) throw new HttpError(404, 'Pwofil jwè a poko egziste. Rekonekte.');
    const profile = profileFromDocument(doc, identity, env);
    if (profile.accountStatus !== 'active') throw new HttpError(403, 'Kont sa a pa aktif. Kontakte administrasyon an.');
    return json(profile);
  }
  if (url.pathname === '/api/history' && request.method === 'GET') {
    const identity = await verifyFirebaseIdToken(request, env, false);
    return json({ items: await getHistory(identity.uid, env) });
  }
  if (url.pathname === '/api/games/play' && request.method === 'POST') {
    const identity = await verifyFirebaseIdToken(request, env, true);
    const body = await readBody(request);
    const gameId = String(body.gameId || '');
    const stakePoints = Number(body.stakePoints);
    if (!Number.isInteger(stakePoints) || stakePoints < 10 || stakePoints > 1000) throw new HttpError(400, 'Mete ant 10 ak 1 000 pwen.');
    const userDoc = await getUserDocument(identity.uid, env);
    if (!userDoc) throw new HttpError(404, 'Pwofil jwè a pa egziste.');
    const profile = fsDocumentFields(userDoc);
    if (profile.accountStatus !== 'active') throw new HttpError(403, 'Kont sa a pa aktif.');
    const balance = Number(profile.pointsBalance || 0);
    if (balance < stakePoints) throw new HttpError(400, 'Ou pa gen ase pwen pou jwe wonn sa a.');
    const game = resolveGame(gameId, stakePoints, body.choice || {});
    const newBalance = balance - stakePoints + game.payoutPoints;
    const roundId = crypto.randomUUID();
    const transactionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const userName = `${firestoreBase(env)}/users/${encodeURIComponent(identity.uid)}`;
    const userFields = { ...profile, pointsBalance: newBalance, updatedAt: now };
    const roundFields = { id: roundId, uid: identity.uid, gameId, stakePoints, payoutPoints: game.payoutPoints, netPoints: game.payoutPoints - stakePoints, multiplier: game.result.multiplier, title: game.result.title, message: game.result.message, details: game.result.details, createdAt: now };
    const ledgerFields = { id: transactionId, uid: identity.uid, type: 'game_round', gameId, roundId, deltaPoints: game.payoutPoints - stakePoints, balanceAfter: newBalance, createdAt: now };
    await commitWrites([
      { update: { name: userName, fields: fsFields(userFields) }, currentDocument: { updateTime: userDoc.updateTime } },
      { update: { name: `${firestoreBase(env)}/gameRounds/${roundId}`, fields: fsFields(roundFields) }, currentDocument: { exists: false } },
      { update: { name: `${firestoreBase(env)}/walletTransactions/${transactionId}`, fields: fsFields(ledgerFields) }, currentDocument: { exists: false } }
    ], env);
    return json({ roundId, balancePoints: newBalance, result: game.result });
  }
  if (url.pathname === '/api/admin/summary' && request.method === 'GET') {
    await requireAdmin(request, env);
    return json(await adminOverview(env));
  }
  if (url.pathname === '/api/admin/users' && request.method === 'GET') {
    await requireAdmin(request, env);
    const urlLimit = Number(url.searchParams.get('limit') || 100);
    const users = await listCollection('users', env, Number.isInteger(urlLimit) ? urlLimit : 100);
    return json({ users: users.map((user) => ({
      uid: user.uid || user.id,
      email: String(user.email || ''),
      displayName: String(user.displayName || ''),
      accountStatus: String(user.accountStatus || 'active'),
      pointsBalance: Number(user.pointsBalance || 0),
      createdAt: user.createdAt || null
    })) });
  }
  if (url.pathname === '/api/admin/rounds' && request.method === 'GET') {
    await requireAdmin(request, env);
    const rounds = sortNewest(await listCollection('gameRounds', env, 100)).slice(0, 50);
    return json({ rounds: rounds.map((round) => ({
      id: round.id,
      uid: round.uid,
      gameId: round.gameId,
      stakePoints: Number(round.stakePoints || 0),
      payoutPoints: Number(round.payoutPoints || 0),
      netPoints: Number(round.netPoints || 0),
      createdAt: round.createdAt || null
    })) });
  }
  if (url.pathname === '/api/admin/actions' && request.method === 'GET') {
    await requireAdmin(request, env);
    return json({ actions: sortNewest(await listCollection('adminActions', env, 50)).slice(0, 50) });
  }
  if (url.pathname === '/api/admin/users/update' && request.method === 'POST') {
    const actor = await requireAdmin(request, env);
    return json(await updateManagedUser(request, env, actor));
  }
  throw new HttpError(404, 'Wout API sa a pa egziste. Verifye GET /api/health oswa konsilte lis routes API yo.');
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const origin = request.headers.get('Origin');
    const requestOrigin = new URL(request.url).origin;
    const allow = allowedOrigins(env);
    if (origin && origin !== requestOrigin && !allow.includes('*') && !allow.includes(origin)) {
      return json({ error: 'Orijin sa a pa otorize.' }, 403, cors);
    }
    try {
      const response = await route(request, env);
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(cors)) headers.set(key, value);
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      const message = error instanceof HttpError ? error.message : 'Yon erè entèn rive. Tanpri eseye ankò.';
      return json({ error: message }, status, cors);
    }
  }
};

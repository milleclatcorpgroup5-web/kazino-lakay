const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
const GAME_IDS = Object.freeze([
  'crash', 'slots', 'roulette', 'blackjack', 'baccarat', 'keno', 'dice', 'mines',
  'plinko', 'penalty', 'coinflip', 'limbo', 'hilo', 'scratch', 'wheel', 'sicbo', 'casinowar',
  'dragontiger', 'andarbahar', 'threecard', 'holdem', 'bingo'
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
  const configured = (env.ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
  // The public Pages frontend is an intentional first-party client of this Worker.
  return [...new Set(['https://kazino-lakay.pages.dev', ...configured])];
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
  let key;
  try {
    key = await crypto.subtle.importKey('pkcs8', pemToDer(env.FIREBASE_PRIVATE_KEY), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  } catch (error) {
    console.error('[Kazino Lakay] FIREBASE_PRIVATE_KEY import failed:', error?.name || 'Error');
    throw new HttpError(503, 'FIREBASE_PRIVATE_KEY pa nan fòma PKCS#8 valab. Verifye Secret la soti nan JSON Service Account pwojè kazino-lakay la. Pa voye kle a nan chat.');
  }
  let signature;
  try {
    signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(unsigned));
  } catch (error) {
    console.error('[Kazino Lakay] Service account signing failed:', error?.name || 'Error');
    throw new HttpError(503, 'Worker la pa kapab siyen jeton Service Account lan. Verifye kle prive Firebase la.');
  }
  const assertion = `${unsigned}.${b64url(signature)}`;
  const body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion });
  let response;
  try {
    response = await fetch(GOOGLE_TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  } catch (error) {
    console.error('[Kazino Lakay] Google OAuth fetch failed:', error?.name || 'Error');
    throw new HttpError(503, 'Worker la pa rive kontakte Google OAuth. Verifye sèvis la ak koneksyon rezo Cloudflare la.');
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.access_token) {
    const providerCode = String(result.error || response.status || 'unknown').slice(0, 48);
    console.error('[Kazino Lakay] Google OAuth rejected service account:', providerCode);
    throw new HttpError(503, `Google OAuth pa aksepte Service Account lan (${providerCode}). Verifye FIREBASE_CLIENT_EMAIL ak FIREBASE_PRIVATE_KEY soti nan menm pwojè a.`);
  }
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
  let response;
  try {
    response = await fetch(`${firestoreBase(env)}${path}`, {
      method: options.method || 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  } catch (error) {
    console.error('[Kazino Lakay] Firestore fetch failed:', error?.name || 'Error');
    throw new HttpError(503, 'Worker la pa rive kontakte Firestore Google. Verifye aksè rezo ak sèvis Firebase la.');
  }
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = {}; }
  if (!response.ok) {
    const code = Number(payload.error?.code || response.status);
    if (code === 404 && (options.method || 'GET') === 'GET' && path.startsWith('/')) return null;
    if (code === 409 || code === 400 && /FAILED_PRECONDITION|ABORTED|update time/i.test(payload.error?.message || '')) throw new HttpError(409, 'Balans lan chanje nan yon lòt demann. Tanpri rekòmanse jwèt la.');
    if (code === 403) throw new HttpError(503, 'Firestore refize aksè Service Account lan (403). Bay sèvis la wòl Cloud Datastore User sou pwojè kazino-lakay la.');
    if (code === 401) throw new HttpError(503, 'Firestore pa aksepte jeton Google la (401). Verifye Service Account lan ak pwojè Firebase la.');
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
  const safeCollections = new Set(['users', 'gameRounds', 'adminActions', 'walletAccounts', 'walletTransactions']);
  if (!safeCollections.has(collectionId)) throw new HttpError(400, 'Koleksyon sa a pa disponib.');
  const payload = await firestoreRequest(`/${collectionId}?pageSize=${Math.min(100, Math.max(1, pageSize))}`, env);
  const documents = payload?.documents || [];
  return documents.map((document) => {
    const fields = fsDocumentFields(document);
    const id = String(document.name || '').split('/').pop();
    return { ...fields, id };
  });
}

async function listAllCollection(collectionId, env, maxDocuments = 10000) {
  const safeCollections = new Set(['users', 'gameRounds', 'adminActions', 'walletAccounts', 'walletTransactions']);
  if (!safeCollections.has(collectionId)) throw new HttpError(400, 'Koleksyon sa a pa disponib.');
  const rows = [];
  let pageToken = '';
  for (let page = 0; page < 20 && rows.length < maxDocuments; page += 1) {
    const params = new URLSearchParams({ pageSize: '1000' });
    if (pageToken) params.set('pageToken', pageToken);
    const payload = await firestoreRequest(`/${collectionId}?${params.toString()}`, env);
    for (const document of payload?.documents || []) {
      rows.push({ ...fsDocumentFields(document), id: String(document.name || '').split('/').pop() });
      if (rows.length >= maxDocuments) break;
    }
    pageToken = payload?.nextPageToken || '';
    if (!pageToken) break;
  }
  return rows;
}

async function getPlatformWallet(env) {
  const document = await firestoreRequest('/platformWallet/main', env);
  return { document, wallet: document ? fsDocumentFields(document) : null };
}

async function ensurePlatformWallet(env) {
  const current = await getPlatformWallet(env);
  if (current.wallet) return current;
  const [users, rounds] = await Promise.all([
    listAllCollection('users', env),
    listAllCollection('gameRounds', env)
  ]);
  const totalPlayerPoints = users.reduce((sum, user) => sum + Math.max(0, Number(user.pointsBalance) || 0), 0);
  const totalStakedPoints = rounds.reduce((sum, round) => sum + Math.max(0, Number(round.stakePoints) || 0), 0);
  const totalPayoutPoints = rounds.reduce((sum, round) => sum + Math.max(0, Number(round.payoutPoints) || 0), 0);
  const now = new Date().toISOString();
  const wallet = {
    id: 'main',
    label: 'Kont platfòm Kazino Lakay',
    balancePoints: -totalPlayerPoints,
    openingPlayerPoints: totalPlayerPoints,
    totalStakedPoints,
    totalPayoutPoints,
    netGamePoints: totalStakedPoints - totalPayoutPoints,
    schemaVersion: 2,
    createdAt: now,
    updatedAt: now
  };
  const migrationId = 'platform-opening-v2';
  const migration = {
    id: migrationId,
    type: 'platform_opening_migration',
    uid: 'system',
    playerDeltaPoints: 0,
    platformDeltaPoints: 0,
    openingPlayerPoints: totalPlayerPoints,
    historicalStakedPoints: totalStakedPoints,
    historicalPayoutPoints: totalPayoutPoints,
    note: 'Snapshot inisyal pou ansyen balans yo; tranzaksyon istorik yo rete jan yo te ye.',
    createdAt: now
  };
  try {
    await commitWrites([
      { update: { name: `${firestoreBase(env)}/platformWallet/main`, fields: fsFields(wallet) }, currentDocument: { exists: false } },
      { update: { name: `${firestoreBase(env)}/walletTransactions/${migrationId}`, fields: fsFields(migration) }, currentDocument: { exists: false } }
    ], env);
    const created = await getPlatformWallet(env);
    return created;
  } catch (error) {
    if (error instanceof HttpError && error.status === 409) {
      const raced = await getPlatformWallet(env);
      if (raced.wallet) return raced;
    }
    throw error;
  }
}

async function ensurePlayerWallet(uid, userDocument, env) {
  const path = `/walletAccounts/${encodeURIComponent(uid)}`;
  const current = await firestoreRequest(path, env);
  if (current) return { document: current, wallet: fsDocumentFields(current), created: false };
  const profile = fsDocumentFields(userDocument);
  const now = new Date().toISOString();
  const wallet = {
    uid,
    balancePoints: Math.max(0, Number(profile.pointsBalance) || 0),
    currency: 'POINTS',
    accountStatus: profile.accountStatus || 'active',
    createdAt: profile.createdAt || now,
    updatedAt: now,
    schemaVersion: 2
  };
  try {
    await commitWrites([{ update: { name: `${firestoreBase(env)}${path}`, fields: fsFields(wallet) }, currentDocument: { exists: false } }], env);
    const created = await firestoreRequest(path, env);
    return { document: created, wallet: fsDocumentFields(created), created: true };
  } catch (error) {
    if (error instanceof HttpError && error.status === 409) {
      const raced = await firestoreRequest(path, env);
      if (raced) return { document: raced, wallet: fsDocumentFields(raced), created: false };
    }
    throw error;
  }
}

async function ensureGameControlRecord(env) {
  const current = await getGameControlRecord(env);
  if (current.document) return current;
  const now = new Date().toISOString();
  const settings = { ...defaultGameControl(), updatedAt: now, updatedBy: 'system-setup' };
  try {
    await commitWrites([{ update: { name: `${firestoreBase(env)}/systemSettings/gameControl`, fields: fsFields(settings) }, currentDocument: { exists: false } }], env);
    return await getGameControlRecord(env);
  } catch (error) {
    if (error instanceof HttpError && error.status === 409) return await getGameControlRecord(env);
    throw error;
  }
}

async function ensureAdminCollections(env) {
  const [platform, control, users, wallets] = await Promise.all([
    ensurePlatformWallet(env),
    ensureGameControlRecord(env),
    listAllCollection('users', env),
    listAllCollection('walletAccounts', env)
  ]);
  const existingWalletIds = new Set(wallets.map((wallet) => wallet.uid || wallet.id));
  const missingWallets = users.filter((user) => !existingWalletIds.has(user.uid || user.id));
  let walletAccountsCreated = 0;
  for (let offset = 0; offset < missingWallets.length; offset += 400) {
    const batch = missingWallets.slice(offset, offset + 400);
    const writes = batch.map((user) => {
      const uid = String(user.uid || user.id);
      const createdAt = user.createdAt || new Date().toISOString();
      const account = { uid, balancePoints: Math.max(0, Number(user.pointsBalance) || 0), currency: 'POINTS', accountStatus: user.accountStatus || 'active', createdAt, updatedAt: new Date().toISOString(), schemaVersion: 2 };
      return { update: { name: `${firestoreBase(env)}/walletAccounts/${encodeURIComponent(uid)}`, fields: fsFields(account) }, currentDocument: { exists: false } };
    });
    try {
      if (writes.length) await commitWrites(writes, env);
      walletAccountsCreated += writes.length;
    } catch (error) {
      if (!(error instanceof HttpError && error.status === 409)) throw error;
      // Another bootstrap may have created some of these wallet docs concurrently.
      const refreshed = new Set((await listAllCollection('walletAccounts', env)).map((wallet) => wallet.uid || wallet.id));
      const retry = batch.filter((user) => !refreshed.has(user.uid || user.id));
      for (const user of retry) await ensurePlayerWallet(String(user.uid || user.id), { fields: fsFields(user) }, env);
      walletAccountsCreated += retry.length;
    }
  }
  const schemaPath = `${firestoreBase(env)}/systemSettings/schema`;
  const schemaDocument = await firestoreRequest('/systemSettings/schema', env);
  if (!schemaDocument) {
    const schema = { version: 2, collections: ['users', 'walletAccounts', 'walletTransactions', 'platformWallet', 'gameRounds', 'adminActions', 'systemSettings'], rulesMode: 'server-only', updatedAt: new Date().toISOString() };
    try {
      await commitWrites([{ update: { name: schemaPath, fields: fsFields(schema) }, currentDocument: { exists: false } }], env);
    } catch (error) {
      if (!(error instanceof HttpError && error.status === 409)) throw error;
    }
  }
  return {
    platformWalletReady: Boolean(platform.wallet),
    gameControlReady: Boolean(control.document),
    usersScanned: users.length,
    walletAccountsCreated,
    walletAccountsReady: wallets.length + walletAccountsCreated
  };
}

async function getWalletTransactions(uid, env, limit = 30) {
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'walletTransactions' }],
      where: { fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: { stringValue: uid } } },
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
      limit
    }
  };
  const rows = await firestoreRequest(':runQuery', env, { method: 'POST', body: query });
  return (rows || []).filter((row) => row.document).map((row) => fsDocumentFields(row.document));
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

function defaultGameControl() {
  return {
    globalEnabled: true,
    maintenanceMessage: '',
    games: Object.fromEntries(GAME_IDS.map((id) => [id, true])),
    updatedAt: null,
    updatedBy: null
  };
}

function normalizeGameControl(value = {}) {
  const defaults = defaultGameControl();
  const suppliedGames = value.games && typeof value.games === 'object' && !Array.isArray(value.games) ? value.games : {};
  const games = Object.fromEntries(GAME_IDS.map((id) => [id, typeof suppliedGames[id] === 'boolean' ? suppliedGames[id] : true]));
  return {
    globalEnabled: value.globalEnabled !== false,
    maintenanceMessage: String(value.maintenanceMessage || '').trim().slice(0, 200),
    games,
    updatedAt: value.updatedAt || null,
    updatedBy: value.updatedBy || null
  };
}

async function getGameControlRecord(env) {
  const document = await firestoreRequest('/systemSettings/gameControl', env);
  return { document, settings: normalizeGameControl(document ? fsDocumentFields(document) : {}) };
}

async function getPublicGameControl(env) {
  const diagnostics = firebaseRuntimeDiagnostics(env);
  // Preserve standalone DEMO mode when Firebase account persistence is not configured yet.
  // Once backend credentials are configured, Firestore must answer so stored admin switches cannot be bypassed.
  if (diagnostics.missing.length || diagnostics.invalid.length) {
    return { settings: defaultGameControl(), readOk: false };
  }
  const record = await getGameControlRecord(env);
  return { settings: record.settings, readOk: true };
}

function assertGameCanRun(settings, gameId, stakePoints) {
  if (!GAME_IDS.includes(gameId)) throw new HttpError(404, 'Jwèt sa a pa disponib.');
  if (!settings.globalEnabled) {
    throw new HttpError(423, settings.maintenanceMessage || 'Tout jwèt yo sou poz pou kounye a. Tanpri retounen pita.');
  }
  if (settings.games[gameId] === false) {
    throw new HttpError(423, 'Administrasyon an mete jwèt sa a sou poz pou kounye a.');
  }
  if (!Number.isInteger(stakePoints) || stakePoints < 10 || stakePoints > 1000) {
    throw new HttpError(400, 'Mete ant 10 ak 1 000 pwen demonstrasyon.');
  }
}

async function updateGameControl(request, env, actor) {
  const body = await readBody(request);
  const reason = String(body.reason || '').trim().slice(0, 250);
  if (reason.length < 3) throw new HttpError(400, 'Ekri yon rezon ki gen omwen 3 karaktè.');
  if (typeof body.globalEnabled !== 'boolean') throw new HttpError(400, 'Estati global la pa valab.');
  if (body.games == null || typeof body.games !== 'object' || Array.isArray(body.games)) {
    throw new HttpError(400, 'Lis estati jwèt yo pa valab.');
  }
  const invalidGame = Object.keys(body.games).find((id) => !GAME_IDS.includes(id) || typeof body.games[id] !== 'boolean');
  if (invalidGame) throw new HttpError(400, 'Gen yon estati jwèt ki pa valab.');

  const { document, settings: current } = await getGameControlRecord(env);
  const next = normalizeGameControl({
    ...current,
    globalEnabled: body.globalEnabled,
    maintenanceMessage: String(body.maintenanceMessage || '').trim().slice(0, 200),
    games: { ...current.games, ...body.games },
    updatedAt: new Date().toISOString(),
    updatedBy: actor.email
  });
  const changedGames = GAME_IDS.filter((id) => current.games[id] !== next.games[id]);
  const actionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const action = {
    id: actionId,
    type: 'admin_game_control_update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    globalEnabled: next.globalEnabled,
    gamesChanged: changedGames,
    enabledGames: GAME_IDS.filter((id) => next.games[id]),
    disabledGames: GAME_IDS.filter((id) => !next.games[id]),
    reason,
    createdAt: now
  };
  const settingsName = `${firestoreBase(env)}/systemSettings/gameControl`;
  const actionName = `${firestoreBase(env)}/adminActions/${actionId}`;
  await commitWrites([
    { update: { name: settingsName, fields: fsFields(next) }, currentDocument: document ? { updateTime: document.updateTime } : { exists: false } },
    { update: { name: actionName, fields: fsFields(action) }, currentDocument: { exists: false } }
  ], env);
  return { ok: true, settings: next, actionId };
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
  const platform = await ensurePlatformWallet(env);
  const playerWallet = await ensurePlayerWallet(uid, document, env);
  const platformBefore = Number(platform.wallet.balancePoints || 0);
  const platformDelta = -pointsDelta;
  const platformAfter = platformBefore + platformDelta;
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
  const writes = [
    { update: { name: `${firestoreBase(env)}/users/${encodeURIComponent(uid)}`, fields: fsFields(updated) }, currentDocument: { updateTime: document.updateTime } },
    { update: { name: `${firestoreBase(env)}/adminActions/${actionId}`, fields: fsFields(action) }, currentDocument: { exists: false } }
  ];
  if (pointsDelta !== 0 || accountStatus) {
    const walletUpdated = { ...playerWallet.wallet, balancePoints: nextBalance, updatedAt: now, accountStatus: updated.accountStatus || 'active' };
    writes.push({ update: { name: `${firestoreBase(env)}/walletAccounts/${encodeURIComponent(uid)}`, fields: fsFields(walletUpdated) }, currentDocument: { updateTime: playerWallet.document.updateTime } });
  }
  if (pointsDelta !== 0) {
    const platformUpdated = { ...platform.wallet, balancePoints: platformAfter, updatedAt: now };
    const ledger = { id: actionId, uid, type: 'admin_adjustment', playerDeltaPoints: pointsDelta, platformDeltaPoints: platformDelta, playerBalanceAfter: nextBalance, platformBalanceAfter: platformAfter, actorUid: actor.uid, actorEmail: actor.email, reason, createdAt: now };
    writes.push(
      { update: { name: `${firestoreBase(env)}/platformWallet/main`, fields: fsFields(platformUpdated) }, currentDocument: { updateTime: platform.document.updateTime } },
      { update: { name: `${firestoreBase(env)}/walletTransactions/${actionId}`, fields: fsFields(ledger) }, currentDocument: { exists: false } }
    );
  }
  await commitWrites(writes, env);
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
      const refreshed = { fields: fsFields(updated), updateTime: doc.updateTime };
      await ensurePlayerWallet(identity.uid, refreshed, env);
      await ensurePlatformWallet(env);
      return profileFromDocument(refreshed, identity, env);
    }
    await ensurePlayerWallet(identity.uid, doc, env);
    await ensurePlatformWallet(env);
    return profileFromDocument(doc, identity, env);
  }

  // Initialize the platform account before issuing the first wallet credit.
  const platform = await ensurePlatformWallet(env);
  const now = new Date().toISOString();
  const initialPoints = 10000;
  const role = identity.emailVerified && adminEmails(env).includes(identity.email) ? 'admin' : 'player';
  const profile = { uid: identity.uid, email: identity.email, displayName, role, accountStatus: 'active', pointsBalance: initialPoints, createdAt: now, updatedAt: now };
  const playerWallet = { uid: identity.uid, balancePoints: initialPoints, currency: 'POINTS', accountStatus: 'active', createdAt: now, updatedAt: now, schemaVersion: 2 };
  const platformUpdated = { ...platform.wallet, balancePoints: Number(platform.wallet.balancePoints || 0) - initialPoints, updatedAt: now };
  const issueId = crypto.randomUUID();
  const issuance = { id: issueId, uid: identity.uid, type: 'initial_player_credit', playerDeltaPoints: initialPoints, platformDeltaPoints: -initialPoints, playerBalanceAfter: initialPoints, platformBalanceAfter: platformUpdated.balancePoints, reason: 'Kredi pwen demonstrasyon pou nouvo kont.', createdAt: now };
  await commitWrites([
    { update: { name: `${firestoreBase(env)}/users/${encodeURIComponent(identity.uid)}`, fields: fsFields(profile) }, currentDocument: { exists: false } },
    { update: { name: `${firestoreBase(env)}/walletAccounts/${encodeURIComponent(identity.uid)}`, fields: fsFields(playerWallet) }, currentDocument: { exists: false } },
    { update: { name: `${firestoreBase(env)}/platformWallet/main`, fields: fsFields(platformUpdated) }, currentDocument: { updateTime: platform.document.updateTime } },
    { update: { name: `${firestoreBase(env)}/walletTransactions/${issueId}`, fields: fsFields(issuance) }, currentDocument: { exists: false } }
  ], env);
  return profileFromDocument({ fields: fsFields(profile) }, identity, env);
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

export function rankThreeCardHand(cards) {
  const ranks = cards.map((card) => card.rank).sort((a, b) => b - a);
  const sameSuit = cards.every((card) => card.suit === cards[0].suit);
  const counts = new Map();
  ranks.forEach((rank) => counts.set(rank, (counts.get(rank) || 0) + 1));
  const values = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const unique = [...new Set(ranks)].sort((a, b) => a - b);
  const straight = unique.length === 3 && (unique[2] - unique[0] === 2 || unique.join(',') === '2,3,14');
  const straightHigh = unique.join(',') === '2,3,14' ? 3 : unique[2];
  let category = 0, tie = ranks;
  if (sameSuit && straight) { category = 5; tie = [straightHigh]; }
  else if (values[0][1] === 3) { category = 4; tie = [values[0][0]]; }
  else if (straight) { category = 3; tie = [straightHigh]; }
  else if (sameSuit) { category = 2; tie = ranks; }
  else if (values[0][1] === 2) { category = 1; tie = [values[0][0], ...ranks.filter((rank) => rank !== values[0][0])]; }
  return { category, tie, label: ['Kat wo','Pè','Koulè','Sekans','Twa menm','Sekans koulè'][category] };
}

function compareHandRanks(a, b) {
  if (a.category !== b.category) return a.category > b.category ? 1 : -1;
  const length = Math.max(a.tie.length, b.tie.length);
  for (let index = 0; index < length; index += 1) {
    const av = a.tie[index] || 0, bv = b.tie[index] || 0;
    if (av !== bv) return av > bv ? 1 : -1;
  }
  return 0;
}

function rankFiveCardHand(cards) {
  const ranks = cards.map((card) => card.rank).sort((a, b) => b - a);
  const counts = new Map();
  ranks.forEach((rank) => counts.set(rank, (counts.get(rank) || 0) + 1));
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every((card) => card.suit === cards[0].suit);
  const unique = [...new Set(ranks)].sort((a, b) => b - a);
  const wheel = unique.join(',') === '14,5,4,3,2';
  const straight = unique.length === 5 && (unique[0] - unique[4] === 4 || wheel);
  const straightHigh = wheel ? 5 : unique[0];
  const kickers = (excluded) => ranks.filter((rank) => !excluded.includes(rank));
  let category = 0, tie = ranks;
  if (flush && straight) { category = 8; tie = [straightHigh]; }
  else if (groups[0][1] === 4) { category = 7; tie = [groups[0][0], ...kickers([groups[0][0]])]; }
  else if (groups[0][1] === 3 && groups[1]?.[1] === 2) { category = 6; tie = [groups[0][0], groups[1][0]]; }
  else if (flush) { category = 5; tie = ranks; }
  else if (straight) { category = 4; tie = [straightHigh]; }
  else if (groups[0][1] === 3) { category = 3; tie = [groups[0][0], ...kickers([groups[0][0]])]; }
  else if (groups[0][1] === 2 && groups[1]?.[1] === 2) {
    const pairs = groups.filter((group) => group[1] === 2).map((group) => group[0]).sort((a, b) => b - a);
    tie = [...pairs, ...kickers(pairs)]; category = 2;
  } else if (groups[0][1] === 2) { category = 1; tie = [groups[0][0], ...kickers([groups[0][0]])]; }
  const labels = ['Kat wo','Yon pè','De pè','Twa menm','Sekans','Koulè','Full house','Kat menm','Sekans koulè'];
  return { category, tie, label: labels[category] };
}

function rankSevenCardHand(cards) {
  let best = null;
  for (let a = 0; a < cards.length - 4; a += 1) for (let b = a + 1; b < cards.length - 3; b += 1)
    for (let c = b + 1; c < cards.length - 2; c += 1) for (let d = c + 1; d < cards.length - 1; d += 1)
      for (let e = d + 1; e < cards.length; e += 1) {
        const rank = rankFiveCardHand([cards[a], cards[b], cards[c], cards[d], cards[e]]);
        if (!best || compareHandRanks(rank, best) > 0) best = rank;
      }
  if (!best) throw new Error('Pa gen ase kat pou klase men Poker la.');
  return best;
}

function createBingoCard() {
  const ranges = [[1,15],[16,30],[31,45],[46,60],[61,75]];
  const columns = ranges.map(([min,max]) => {
    const pool = Array.from({length:max-min+1}, (_, index) => min + index);
    for (let index = pool.length - 1; index > 0; index -= 1) {
      const swap = randomInt(index + 1); [pool[index], pool[swap]] = [pool[swap], pool[index]];
    }
    return pool.slice(0, 5);
  });
  const card = Array.from({length:25}, (_, index) => columns[index % 5][Math.floor(index / 5)]);
  card[12] = 0;
  return card;
}

export function resolveGame(gameId, stake, choice = {}) {
  // Server-authoritative challenge profile: clients cannot downgrade difficulty.
  choice = { ...choice, volatility: 'high', risk: 'high', mineCount: 10, difficulty: 'hard', standAt: 20, dealerSoft17: 'hit' };
  let won = false, multiplier = 0, title = 'Wonn fini', message = '', details = {}, animationKey = gameId, exactPayoutPoints = null;
  switch (gameId) {
    case 'crash': {
      const target = Number(choice.target);
      const volatility = String(choice.volatility || 'normal');
      const exponents = { low: 1.6, normal: 2.1, high: 2.7 };
      if (![1.2,1.5,2,3,5].includes(target)) throw new HttpError(400, 'Objektif Crash la pa valab.');
      if (!Object.hasOwn(exponents, volatility)) throw new HttpError(400, 'Chwazi nivo volatilite Crash la.');
      const crashAt = Math.max(1, Number((1 + Math.pow(randomInt(1000000) / 1000000, exponents[volatility]) * 8).toFixed(2)));
      won = crashAt >= target; multiplier = won ? target : 0;
      details = { crashAt, target, volatility, reached: won };
      message = won ? `Vòl la rive ${crashAt.toFixed(2)}×. Objektif ${target.toFixed(2)}× ou a atenn.` : `Vòl la fini nan ${crashAt.toFixed(2)}×, anvan objektif ${target.toFixed(2)}× ou a.`;
      break;
    }
    case 'slots': {
      const risk = String(choice.risk || 'normal');
      const profiles = {
        low: { symbols: ['🍒','🍋','🍊'], triple: 3, pair: 1.3 },
        normal: { symbols: ['🍒','🍋','🔔','💎','7️⃣','⭐'], triple: 5, pair: 1.5 },
        high: { symbols: ['🍒','🍋','🔔','💎','7️⃣','⭐','👑','💠'], triple: 8, pair: 0 }
      };
      if (!profiles[risk]) throw new HttpError(400, 'Chwazi nivo risk Slots la.');
      const profile = profiles[risk];
      const result = [pick(profile.symbols), pick(profile.symbols), pick(profile.symbols)];
      if (result.every((symbol) => symbol === '7️⃣')) multiplier = risk === 'high' ? 20 : 10;
      else if (result.every((symbol) => symbol === result[0])) multiplier = profile.triple;
      else if (new Set(result).size === 2) multiplier = profile.pair;
      won = multiplier > 0; details = { symbols: result, multiplier, risk };
      message = won ? `Konbinezon ${result.join(' ')} bay ${multiplier}× nan nivo ${risk}.` : `Konbinezon ${result.join(' ')} pa bay retou.`;
      break;
    }
    case 'roulette': {
      const n = randomInt(37);
      const red = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
      const color = n === 0 ? 'green' : red.has(n) ? 'red' : 'black';
      const rawBets = Array.isArray(choice.bets) ? choice.bets : null;
      const bets = rawBets || [{
        betType: String(choice.betType || (choice.pick ? 'legacy-color' : '')),
        betValue: choice.betType ? choice.betValue : choice.pick,
        stakePoints: stake
      }];
      if (!bets.length || bets.length > 30) throw new HttpError(400, 'Mete ant 1 ak 30 pari diferan sou tab roulèt la.');

      const seen = new Set();
      const settledBets = [];
      let totalStaked = 0;
      let totalPayout = 0;
      const betDescription = (type, value) => {
        if (type === 'number') return `nimewo ${value}`;
        if (type === 'color') return value === 'red' ? 'wouj' : 'nwa';
        if (type === 'parity') return value === 'even' ? 'pè' : 'enpè';
        if (type === 'dozen') return `douzèn ${value}`;
        if (type === 'column') return `kolòn ${value}`;
        return 'paryaj';
      };

      for (const item of bets) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new HttpError(400, 'Yon pari roulèt pa gen bon fòma.');
        const type = String(item.betType || item.type || '');
        let value = item.betValue ?? item.value;
        const itemStake = Number(item.stakePoints ?? item.stake);
        if (!Number.isInteger(itemStake) || itemStake < 10 || itemStake > 1000 || itemStake % 10 !== 0) {
          throw new HttpError(400, 'Chak pari dwe genyen ant 10 ak 1 000 pwen, an miltip 10.');
        }
        totalStaked += itemStake;
        if (totalStaked > 1000) throw new HttpError(400, 'Total pari yon sèl wonn roulèt pa kapab depase 1 000 pwen.');

        let hit = false;
        let odds = 0;
        if (type === 'number') {
          value = Number(value);
          if (!Number.isInteger(value) || value < 0 || value > 36) throw new HttpError(400, 'Chwazi yon nimewo antye ant 0 ak 36.');
          odds = 36;
          hit = n === value;
        } else if (type === 'color') {
          value = String(value || '').toLowerCase();
          if (!['red','black'].includes(value)) throw new HttpError(400, 'Chwazi koulè wouj oswa nwa. Zewo pa yon koulè paryab.');
          odds = 2;
          hit = color === value;
        } else if (type === 'parity') {
          value = String(value || '').toLowerCase();
          if (!['even','odd'].includes(value)) throw new HttpError(400, 'Chwazi pè oswa enpè.');
          odds = 2;
          hit = n !== 0 && (n % 2 === 0 ? 'even' : 'odd') === value;
        } else if (type === 'dozen') {
          value = Number(value);
          if (![1,2,3].includes(value)) throw new HttpError(400, 'Chwazi premye, dezyèm oswa twazyèm douzèn lan.');
          odds = 3;
          hit = n > 0 && Math.ceil(n / 12) === value;
        } else if (type === 'column') {
          value = Number(value);
          if (![1,2,3].includes(value)) throw new HttpError(400, 'Chwazi kolòn 1, 2 oswa 3.');
          odds = 3;
          hit = n > 0 && ((n - 1) % 3) + 1 === value;
        } else if (type === 'legacy-color') {
          value = String(value || '').toLowerCase();
          if (!['red','black','green'].includes(value)) throw new HttpError(400, 'Chwazi wouj, nwa oswa vèt.');
          odds = value === 'green' ? 36 : 2;
          hit = color === value;
        } else {
          throw new HttpError(400, 'Kalite pari roulèt sa a pa disponib.');
        }

        const key = `${type}:${String(value)}`;
        if (seen.has(key)) throw new HttpError(400, 'Pa voye menm kalite pari a de fwa. Ajoute montan yo sou menm pari a.');
        seen.add(key);
        const betPayout = hit ? moneyMultiplier(itemStake, odds) : 0;
        totalPayout += betPayout;
        settledBets.push({ betType: type, betValue: value, label: betDescription(type, value), stakePoints: itemStake, odds, won: hit, payoutPoints: betPayout });
      }

      if (totalStaked !== stake) throw new HttpError(400, 'Total miz la pa koresponn ak sòm tout pari yo.');
      multiplier = totalPayout / totalStaked;
      exactPayoutPoints = totalPayout;
      won = totalPayout > 0;
      const winningCount = settledBets.filter((bet) => bet.won).length;
      const winningSummary = winningCount ? `${winningCount} sou ${settledBets.length} pari genyen.` : `Okenn nan ${settledBets.length} pari yo pa genyen.`;
      details = {
        number: n, color, bets: settledBets, totalBetPoints: totalStaked,
        winningBets: winningCount, betCount: settledBets.length,
        multiplier, payoutPoints: totalPayout,
        // Legacy fields remain for older UI/history readers when one bet was placed.
        ...(settledBets.length === 1 ? { betType: settledBets[0].betType, betValue: settledBets[0].betValue, selected: settledBets[0].betValue } : {})
      };
      message = `Wou a kanpe sou ${n} (${color === 'red' ? 'wouj' : color === 'black' ? 'nwa' : 'zewo/vèt'}). ${winningSummary} Retou total: ${totalPayout} pwen.`;
      // Preserve exact per-bet gross returns; the weighted multiplier below reproduces this total.
      break;
    }
    case 'blackjack': {
      const standAt = Number(choice.standAt);
      const dealerSoft17 = String(choice.dealerSoft17 || 'stand');
      if (!Number.isInteger(standAt) || standAt < 12 || standAt > 20) throw new HttpError(400, 'Chwazi yon limit ant 12 ak 20.');
      if (!['stand','hit'].includes(dealerSoft17)) throw new HttpError(400, 'Chwazi si koutye a rete oswa pran kat sou soft 17.');
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
      const isSoft17 = (hand) => {
        let total = hand.reduce((sum, card) => sum + (card.rank === 14 ? 11 : card.rank > 10 ? 10 : card.rank), 0);
        let aces = hand.filter((card) => card.rank === 14).length;
        while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
        return total === 17 && aces > 0;
      };
      while ((handValue(dealer) < 17 || (dealerSoft17 === 'hit' && isSoft17(dealer))) && dealer.length < 6) dealer.push(draw());
      const p = handValue(player), d = handValue(dealer);
      const isNatural = (hand) => hand.length === 2 && handValue(hand) === 21;
      const playerNatural = isNatural(player), dealerNatural = isNatural(dealer);
      let outcome = 'loss';
      if (playerNatural && dealerNatural) { multiplier = 1; outcome = 'push'; }
      else if (playerNatural) { multiplier = 2.5; outcome = 'blackjack'; }
      else if (dealerNatural) { multiplier = 0; outcome = 'dealer_blackjack'; }
      else if (p > 21) { multiplier = 0; outcome = 'bust'; }
      else if (d > 21 || p > d) { multiplier = 2; outcome = 'win'; }
      else if (p === d) { multiplier = 1; outcome = 'push'; }
      else { multiplier = 0; outcome = 'loss'; }
      won = multiplier > 1;
      details = { player: player.map((c) => `${cardName(c.rank)}${c.suit}`), dealer: dealer.map((c) => `${cardName(c.rank)}${c.suit}`), playerTotal: p, dealerTotal: d, standAt, dealerSoft17, playerNatural, dealerNatural, outcome };
      message = outcome === 'blackjack' ? 'Blackjack natirèl! Men ou gen 21 ak de premye kat yo; retou a se 3:2 plis miz orijinal la.' : outcome === 'dealer_blackjack' ? 'Koutye a gen blackjack natirèl. Men ou an pèdi.' : outcome === 'push' ? `Egalite: jwè ${p}, koutye ${d}. Miz la retounen.` : outcome === 'bust' ? `Men ou fè ${p}: ou depase 21.` : outcome === 'win' ? (d > 21 ? `Koutye a depase 21 (${d}). Ou genyen.` : `Ou fè ${p}, koutye a fè ${d}. Ou genyen.`) : `Koutye a fè ${d}, men ou fè ${p}. Koutye a genyen.`;
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
      const drawCount = Number(choice.drawCount || 10);
      if (![5,10,15].includes(drawCount)) throw new HttpError(400, 'Chwazi 5, 10 oswa 15 boul nan tiraj Keno a.');
      const drawn = new Set(); while (drawn.size < drawCount) drawn.add(1 + randomInt(25));
      const hits = numbers.filter((n) => drawn.has(n));
      const paytable = drawCount === 5 ? {1:0.5,2:1.5,3:4,4:8,5:15} : drawCount === 15 ? {3:0.5,4:1,5:2} : {3:1,4:2,5:5};
      multiplier = paytable[hits.length] || 0; won = multiplier > 0;
      details = { selected: numbers, drawn: [...drawn].sort((a,b) => a-b), hits: hits.sort((a,b) => a-b), hitCount: hits.length, drawCount };
      message = `Ou jwenn ${hits.length} sou 5 nimewo. ${won ? `Retou ${multiplier}×.` : 'Pa gen retou nan rezilta sa a.'}`;
      break;
    }
    case 'dice': {
      const a = 1 + randomInt(6), b = 1 + randomInt(6), sum = a + b, bet = String(choice.pick || '');
      const paytable = { over7: 2.4, under7: 2.4, exact6: 6.8, exact7: 6, exact8: 6.8, exact9: 9, exact10: 12, exact11: 18 };
      if (!Object.hasOwn(paytable, bet)) throw new HttpError(400, 'Chwazi yon prediksyon Dice.');
      won = bet === 'over7' ? sum > 7 : bet === 'under7' ? sum < 7 : sum === Number(bet.slice(5));
      multiplier = won ? paytable[bet] : 0;
      details = { dice: [a,b], total: sum, selection: bet };
      message = `Zo yo bay ${a} + ${b} = ${sum}. ${won ? 'Prediksyon ou bon.' : 'Prediksyon ou pa bon.'}`;
      break;
    }
    case 'mines': {
      const cells = Array.isArray(choice.cells) ? choice.cells.map(Number) : [];
      if (cells.length < 1 || cells.length > 5 || new Set(cells).size !== cells.length || cells.some((n) => !Number.isInteger(n) || n < 1 || n > 25)) throw new HttpError(400, 'Chwazi ant 1 ak 5 kare diferan sou tablo a.');
      const mineCount = Number(choice.mineCount || 3);
      if (![1,3,5,8,10].includes(mineCount)) throw new HttpError(400, 'Chwazi 1, 3, 5, 8 oswa 10 min.');
      if (cells.length > 25 - mineCount) throw new HttpError(400, 'Gen twòp kare chwazi pou kantite min sa a.');
      const mines = new Set(); while (mines.size < mineCount) mines.add(1 + randomInt(25));
      const hitMines = cells.filter((n) => mines.has(n));
      won = hitMines.length === 0;
      multiplier = won ? Number((Math.pow(25 / (25 - mineCount), cells.length) * (1 - cells.length * 0.018)).toFixed(2)) : 0;
      details = { selectedCells: cells, mineCount, revealedMines: [...mines].sort((a,b) => a-b), hitMines };
      message = won ? `Tout ${cells.length} kare ou yo te san min.` : `Ou jwenn yon min nan kare ${hitMines.join(', ')}.`;
      break;
    }
    case 'plinko': {
      const risk = String(choice.risk || 'normal');
      const rows = Number(choice.rows || 6);
      const tables = {
        6: { low: [0.8,0.9,1,1.1,1,0.9,0.8], normal: [0,0.2,0.8,1.5,0.8,0.2,0], high: [8,2,0.5,0,0.5,2,8] },
        8: { low: [0.7,0.8,0.9,1,1.1,1,0.9,0.8,0.7], normal: [0,0.1,0.3,0.8,1.5,0.8,0.3,0.1,0], high: [12,4,1,0.3,0,0.3,1,4,12] }
      };
      if (![6,8].includes(rows) || !tables[rows][risk]) throw new HttpError(400, 'Chwazi 6 oswa 8 liy ak nivo risk Plinko a.');
      const multipliers = tables[rows][risk];
      const path = Array.from({ length: rows }, () => randomInt(2) ? 'R' : 'L');
      const slot = 1 + path.filter((step) => step === 'R').length;
      multiplier = multipliers[slot - 1]; won = multiplier > 0;
      details = { slot, multiplier, path, risk, rows };
      message = `Boul la tonbe nan pòch ${slot + 1}, ki gen ${multiplier}×.`;
      break;
    }
    case 'penalty': {
      const zones = ['top-left','top-center','top-right','middle-left','middle-center','middle-right','bottom-left','bottom-center','bottom-right'];
      const aliases = { left: 'middle-left', center: 'middle-center', right: 'middle-right' };
      const rawShot = String(choice.shot || '');
      const shot = aliases[rawShot] || rawShot;
      if (!zones.includes(shot)) throw new HttpError(400, 'Vize youn nan 9 zòn gòl la.');
      const difficulty = String(choice.difficulty || 'normal');
      const blockChance = { easy: 1/9, normal: 2/9, hard: 1/3 }[difficulty];
      if (blockChance === undefined) throw new HttpError(400, 'Chwazi nivo difikilte gadyen an.');
      const power = Number(choice.power ?? 0.65);
      if (!Number.isFinite(power) || power < 0.3 || power > 1) throw new HttpError(400, 'Pisans tir la dwe ant 30% ak 100%.');
      const teams = ['haiti','france','argentina','brazil','cameroon','england','germany','ghana','morocco','nigeria','senegal','spain','portugal','tunisia','southafrica','ivorycoast'];
      const team = String(choice.team || 'haiti');
      if (!teams.includes(team)) throw new HttpError(400, 'Chwazi yon ekip ki disponib.');
      const candidates = teams.filter((id) => id !== team);
      const requestedOpponent = String(choice.opponent || '');
      const opponent = candidates.includes(requestedOpponent) ? requestedOpponent : pick(candidates);
      const keeper = randomInt(1000) < blockChance * 1000 ? shot : pick(zones.filter((zone) => zone !== shot));
      const zoneNames = { 'top-left':'anwo agoch', 'top-center':'anwo mitan', 'top-right':'anwo adwat', 'middle-left':'mitan agoch', 'middle-center':'mitan', 'middle-right':'mitan adwat', 'bottom-left':'anba agoch', 'bottom-center':'anba mitan', 'bottom-right':'anba adwat' };
      const teamNames = { haiti:'Ayiti', france:'Lafrans', argentina:'Ajantin', brazil:'Brezil', cameroon:'Kamewoun', england:'Angletè', germany:'Almay', ghana:'Gana', morocco:'Mawòk', nigeria:'Nijerya', senegal:'Senegal', spain:'Espay', portugal:'Pòtigal', tunisia:'Tinizi', southafrica:'Afrik di Sid', ivorycoast:'Kotdivwa' };
      won = shot !== keeper; multiplier = won ? 2 : 0;
      details = { shot, keeper, goal: won, difficulty, power, team, opponent };
      message = won ? `GÒL! ${teamNames[team]} make gòl kont ${teamNames[opponent]}. Ou tire ${zoneNames[shot]}, gadyen an plonje ${zoneNames[keeper]}.` : `Gadyen ${teamNames[opponent]} bloke tir ${teamNames[team]} nan ${zoneNames[keeper]}.`;
      break;
    }
    case 'coinflip': {
      const side = String(choice.pick || '');
      const rounds = Number(choice.rounds || 1);
      if (!['heads','tails'].includes(side)) throw new HttpError(400, 'Chwazi Fas oswa Pil.');
      if (![1,3,5].includes(rounds)) throw new HttpError(400, 'Chwazi 1, 3 oswa 5 lansman.');
      const flips = Array.from({ length: rounds }, () => randomInt(2) === 0 ? 'heads' : 'tails');
      const heads = flips.filter((value) => value === 'heads').length;
      const tails = rounds - heads;
      const winner = heads === tails ? 'tie' : heads > tails ? 'heads' : 'tails';
      won = winner === side; multiplier = won ? 1.9 : 0;
      details = { result: flips.at(-1), flips, winner, selection: side, rounds };
      message = `Lansman yo bay ${heads} Fas ak ${tails} Pil. ${winner === 'tie' ? 'Gen egalite.' : winner === 'heads' ? 'Fas domine.' : 'Pil domine.'} ${won ? 'Ou byen devine.' : 'Chwa a pa koresponn.'}`;
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
      const risk = String(choice.risk || 'normal');
      if (!['high','low','equal'].includes(selection)) throw new HttpError(400, 'Chwazi Pi wo, Pi ba oswa Egalite.');
      if (!['normal','high'].includes(risk)) throw new HttpError(400, 'Chwazi nivo risk Hi-Lo a.');
      const shoe = shuffledDeck();
      const first = drawCard(shoe), next = drawCard(shoe);
      won = selection === 'high' ? next.rank > first.rank : selection === 'low' ? next.rank < first.rank : next.rank === first.rank;
      multiplier = won ? (selection === 'equal' ? 12 : risk === 'high' ? 2.4 : 1.9) : 0;
      details = { first: `${cardName(first.rank)}${first.suit}`, next: `${cardName(next.rank)}${next.suit}`, firstValue: first.rank, nextValue: next.rank, selection, risk };
      message = first.rank === next.rank ? (won ? 'De kat yo egal. Bon prediksyon!' : 'De kat yo egal, men ou pa t chwazi egalite.') : won ? 'Ou byen devine direksyon dezyèm kat la.' : 'Dezyèm kat la pa soti nan direksyon ou te chwazi a.';
      break;
    }
    case 'scratch': {
      const risk = String(choice.risk || 'normal');
      const pools = { low: ['🍒','🍋','🔔'], normal: ['🍒','🍋','🔔','💎','⭐','7️⃣'], high: ['🍒','🍋','🔔','💎','⭐','7️⃣','👑','💠'] };
      if (!pools[risk]) throw new HttpError(400, 'Chwazi nivo risk kat la.');
      const symbols = pools[risk];
      const result = [pick(symbols),pick(symbols),pick(symbols)];
      const count = result.filter((x) => x === result[0]).length;
      multiplier = count === 3 ? (risk === 'high' ? 12 : risk === 'low' ? 3 : 4) : new Set(result).size === 2 ? (risk === 'high' ? 0 : 1.2) : 0;
      won = multiplier > 0;
      details = { symbols: result, matchingCount: count, multiplier, risk };
      message = won ? `Kat la revele ${result.join(' ')}. Konbinezon an bay ${multiplier}×.` : `Kat la revele ${result.join(' ')}. Pa gen pè oswa twa menm.`;
      break;
    }
    case 'wheel': {
      const risk = String(choice.risk || 'normal');
      const tables = { low: [0.4,0.6,0.8,1,1,1.2,1.4,1.6], normal: [0,0.2,0.5,0.8,1,1.5,2,3], high: [0,0,0.1,0.2,0.5,1,2,5] };
      if (!tables[risk]) throw new HttpError(400, 'Chwazi nivo risk wou a.');
      const segments = tables[risk];
      multiplier = segments[randomInt(segments.length)]; won = multiplier > 0;
      details = { segment: `${multiplier}×`, multiplier, risk };
      message = `Wou a kanpe sou ${multiplier}×.`;
      break;
    }
    case 'sicbo': {
      const dice = [1 + randomInt(6),1 + randomInt(6),1 + randomInt(6)];
      const sum = dice.reduce((a,b) => a+b,0), triple = dice.every((n) => n === dice[0]), selection = String(choice.pick || '');
      if (!['small','big','triple','even','odd'].includes(selection)) throw new HttpError(400, 'Chwazi Ti, Gwo, Triple, pè oswa enpè.');
      won = selection === 'triple' ? triple : !triple && (selection === 'even' ? sum % 2 === 0 : selection === 'odd' ? sum % 2 === 1 : selection === 'small' ? sum >= 4 && sum <= 10 : sum >= 11 && sum <= 17);
      multiplier = won ? (selection === 'triple' ? 25 : selection === 'even' || selection === 'odd' ? 1.9 : 1.9) : 0;
      details = { dice, total: sum, triple, selection };
      message = `Twa zo yo bay ${dice.join(' + ')} = ${sum}${triple ? ' (Triple)' : ''}. ${won ? 'Prediksyon ou mache.' : 'Prediksyon ou pa mache.'}`;
      break;
    }
    case 'casinowar': {
      const selection = String(choice.pick || 'player');
      if (!['player','banker','tie'].includes(selection)) throw new HttpError(400, 'Chwazi Jwè, Bankye oswa Egalite.');
      const shoe = shuffledDeck();
      const player = drawCard(shoe), banker = drawCard(shoe);
      const winner = player.rank === banker.rank ? 'tie' : player.rank > banker.rank ? 'player' : 'banker';
      won = selection === winner;
      multiplier = winner === 'tie' && selection !== 'tie' ? 1 : won ? (selection === 'tie' ? 8 : 2) : 0;
      details = { playerCard: `${cardName(player.rank)}${player.suit}`, bankerCard: `${cardName(banker.rank)}${banker.suit}`, playerValue: player.rank, bankerValue: banker.rank, winner, selection };
      message = `Kat ou ${cardName(player.rank)} — Bankye ${cardName(banker.rank)}. ${winner === 'tie' ? 'Egalite.' : winner === 'player' ? 'Jwè genyen.' : 'Bankye genyen.'}`;
      break;
    }
    case 'dragontiger': {
      const selection = String(choice.pick || '');
      if (!['dragon','tiger','tie'].includes(selection)) throw new HttpError(400, 'Chwazi Dragon, Tiger oswa Egalite.');
      const shoe = shuffledDeck();
      const dragon = drawCard(shoe), tiger = drawCard(shoe);
      const winner = dragon.rank === tiger.rank ? 'tie' : dragon.rank > tiger.rank ? 'dragon' : 'tiger';
      won = selection === winner; multiplier = won ? (winner === 'tie' ? 8 : 2) : winner === 'tie' ? 1 : 0;
      details = { dragonCard: `${cardName(dragon.rank)}${dragon.suit}`, tigerCard: `${cardName(tiger.rank)}${tiger.suit}`, dragonValue: dragon.rank, tigerValue: tiger.rank, winner, selection };
      message = `Dragon ${cardName(dragon.rank)} — Tiger ${cardName(tiger.rank)}. ${winner === 'tie' ? 'Egalite.' : winner === 'dragon' ? 'Dragon genyen.' : 'Tiger genyen.'}`;
      break;
    }
    case 'andarbahar': {
      const selection = String(choice.pick || '');
      const firstSide = String(choice.firstSide || 'andar');
      if (!['andar','bahar'].includes(selection)) throw new HttpError(400, 'Chwazi Andar oswa Bahar.');
      if (!['andar','bahar'].includes(firstSide)) throw new HttpError(400, 'Chwazi ki bò ki tire premye.');
      const shoe = shuffledDeck();
      const center = drawCard(shoe);
      const andarCards = [], baharCards = [];
      let winner = '', matchedCard = null;
      for (let turn = 0; turn < 51; turn += 1) {
        const card = drawCard(shoe);
        const side = turn % 2 === 0 ? firstSide : (firstSide === 'andar' ? 'bahar' : 'andar');
        (side === 'andar' ? andarCards : baharCards).push(card);
        if (card.rank === center.rank) { winner = side; matchedCard = card; break; }
      }
      if (!winner) throw new Error('Andar Bahar pa jwenn kat ki matche a.');
      won = selection === winner; multiplier = won ? 1.9 : 0;
      details = { centerCard: `${cardName(center.rank)}${center.suit}`, centerValue: center.rank, andarCards: andarCards.map((card) => `${cardName(card.rank)}${card.suit}`), baharCards: baharCards.map((card) => `${cardName(card.rank)}${card.suit}`), matchedCard: `${cardName(matchedCard.rank)}${matchedCard.suit}`, winner, selection, firstSide, cardsDrawn: andarCards.length + baharCards.length };
      message = `Kat santral la se ${cardName(center.rank)}. ${winner === 'andar' ? 'Andar' : 'Bahar'} jwenn premye kat ki matche a apre ${details.cardsDrawn} kat.`;
      break;
    }
    case 'threecard': {
      const selection = String(choice.pick || '');
      if (!['player','banker','tie'].includes(selection)) throw new HttpError(400, 'Chwazi Jwè, Bankye oswa Egalite.');
      const shoe = shuffledDeck();
      const player = [drawCard(shoe), drawCard(shoe), drawCard(shoe)];
      const banker = [drawCard(shoe), drawCard(shoe), drawCard(shoe)];
      const playerRank = rankThreeCardHand(player), bankerRank = rankThreeCardHand(banker);
      const comparison = compareHandRanks(playerRank, bankerRank);
      const winner = comparison === 0 ? 'tie' : comparison > 0 ? 'player' : 'banker';
      won = selection === winner; multiplier = won ? (winner === 'tie' ? 8 : 2) : winner === 'tie' ? 1 : 0;
      details = { playerCards: player.map((card) => `${cardName(card.rank)}${card.suit}`), bankerCards: banker.map((card) => `${cardName(card.rank)}${card.suit}`), playerHand: playerRank.label, bankerHand: bankerRank.label, playerCategory: playerRank.category, bankerCategory: bankerRank.category, playerTieBreak: playerRank.tie, bankerTieBreak: bankerRank.tie, winner, selection, variant: 'three-card-showdown' };
      message = `Jwè: ${playerRank.label}. Bankye: ${bankerRank.label}. ${winner === 'tie' ? 'Egalite.' : winner === 'player' ? 'Jwè genyen.' : 'Bankye genyen.'}`;
      break;
    }
    case 'holdem': {
      const selection = String(choice.pick || 'player');
      if (!['player','banker','tie'].includes(selection)) throw new HttpError(400, 'Chwazi Jwè, Bankye oswa Egalite.');
      const shoe = shuffledDeck();
      const player = [drawCard(shoe), drawCard(shoe)];
      const banker = [drawCard(shoe), drawCard(shoe)];
      const community = Array.from({length:5}, () => drawCard(shoe));
      const playerRank = rankSevenCardHand([...player, ...community]);
      const bankerRank = rankSevenCardHand([...banker, ...community]);
      const comparison = compareHandRanks(playerRank, bankerRank);
      const winner = comparison === 0 ? 'tie' : comparison > 0 ? 'player' : 'banker';
      won = selection === winner;
      multiplier = winner === 'tie' && selection !== 'tie' ? 1 : won ? (selection === 'tie' ? 8 : 2) : 0;
      details = { playerCards: player.map((card) => `${cardName(card.rank)}${card.suit}`), bankerCards: banker.map((card) => `${cardName(card.rank)}${card.suit}`), communityCards: community.map((card) => `${cardName(card.rank)}${card.suit}`), playerHand: playerRank.label, bankerHand: bankerRank.label, playerCategory: playerRank.category, bankerCategory: bankerRank.category, winner, selection };
      message = `Jwè: ${playerRank.label}. Bankye: ${bankerRank.label}. ${winner === 'tie' ? 'Men yo egal.' : winner === 'player' ? 'Men jwè a pi fò.' : 'Men bankye a pi fò.'}`;
      break;
    }
    case 'bingo': {
      const pattern = String(choice.pattern || 'row');
      const patterns = {
        row: [[0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24]],
        column: [[0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24]],
        diagonal: [[0,6,12,18,24],[4,8,12,16,20]],
        corners: [[0,4,20,24]]
      };
      if (!Object.hasOwn(patterns, pattern)) throw new HttpError(400, 'Chwazi yon modèl Bingo valab.');
      const card = createBingoCard();
      const drawn = new Set();
      while (drawn.size < 35) drawn.add(1 + randomInt(75));
      const marked = new Set(card.map((number, index) => number === 0 || drawn.has(number) ? index : -1).filter((index) => index >= 0));
      const completedPatterns = patterns[pattern].map((line, index) => line.every((cell) => marked.has(cell)) ? index : -1).filter((index) => index >= 0);
      const payouts = { row: 5, column: 5, diagonal: 9, corners: 12 };
      won = completedPatterns.length > 0;
      multiplier = won ? payouts[pattern] : 0;
      details = { card, drawn: [...drawn].sort((a,b) => a-b), markedCells: [...marked].sort((a,b) => a-b), pattern, completedPatterns, multiplier };
      message = won ? `BINGO! Ou konplete ${pattern === 'row' ? 'yon liy orizontal' : pattern === 'column' ? 'yon kolòn' : pattern === 'diagonal' ? 'yon dyagonal' : 'kat kwen yo'}.` : 'Pa gen modèl konplè nan tiraj sa a.';
      break;
    }
    default: throw new HttpError(404, 'Jwèt sa a pa disponib.');
  }
  const payoutPoints = exactPayoutPoints === null ? moneyMultiplier(stake, multiplier) : exactPayoutPoints;
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

function firebaseWebDiagnostics(env) {
  const projectId = String(env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || '').trim();
  const values = [
    ['FIREBASE_WEB_API_KEY', env.FIREBASE_WEB_API_KEY || env.VITE_FIREBASE_API_KEY],
    ['FIREBASE_AUTH_DOMAIN', env.FIREBASE_AUTH_DOMAIN || env.VITE_FIREBASE_AUTH_DOMAIN || (projectId ? `${projectId}.firebaseapp.com` : '')],
    ['FIREBASE_PROJECT_ID', projectId],
    ['FIREBASE_APP_ID', env.FIREBASE_APP_ID || env.VITE_FIREBASE_APP_ID]
  ];
  return { missing: values.filter(([, value]) => !String(value || '').trim()).map(([name]) => name) };
}

async function apiStatus(env) {
  const firebase = firebaseRuntimeDiagnostics(env);
  const webFirebase = firebaseWebDiagnostics(env);
  let control = defaultGameControl();
  let gameControlReadOk = false;
  let gameControlReadError = null;
  if (firebase.missing.length === 0 && firebase.invalid.length === 0) {
    try {
      control = (await getGameControlRecord(env)).settings;
      gameControlReadOk = true;
    } catch (error) {
      // Expose only safe diagnostic text; never return secrets or raw upstream payloads.
      gameControlReadError = error instanceof HttpError
        ? error.message
        : `Erè backend ki pa klase (${String(error?.name || 'Error').slice(0, 40)}). Gade Worker Logs pou kòd teknik la.`;
      console.error('[Kazino Lakay] Health game-control read failed:', error?.name || 'Error');
    }
  } else {
    gameControlReadError = 'Paramèt Firebase backend yo manke oswa gen fòma ki pa valab.';
  }
  return {
    service: 'kazino-lakay',
    status: 'ok',
    mode: 'points-only',
    cashValue: false,
    firebaseConfigured: firebase.missing.length === 0 && firebase.invalid.length === 0,
    firebaseMissing: firebase.missing,
    frontendFirebaseConfigured: webFirebase.missing.length === 0,
    frontendFirebaseMissing: webFirebase.missing,
    firebaseInvalid: firebase.invalid,
    adminConfigured: adminEmails(env).length > 0,
    demoPlayEnabled: control.globalEnabled,
    gamesEnabled: control.globalEnabled,
    enabledGameCount: GAME_IDS.filter((id) => control.games[id]).length,
    gameControlReadOk,
    gameControlReadError,
    gameCount: GAME_IDS.length,
    gameIds: GAME_IDS,
    endpoints: ['/firebase-config', '/api/health', '/api/games', '/api/games/demo', '/api/profile/bootstrap', '/api/me', '/api/history', '/api/wallet', '/api/games/play', '/api/admin/setup', '/api/admin/wallet', '/api/admin/summary', '/api/admin/users', '/api/admin/rounds', '/api/admin/actions', '/api/admin/users/update', '/api/admin/games/control']
  };
}

async function route(request, env) {
  const url = new URL(request.url);
  if ((url.pathname === '/firebase-config' || url.pathname === '/firebase-config.js') && request.method === 'GET') {
    const projectId = String(env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || '').trim();
    const config = {
      apiKey: String(env.FIREBASE_WEB_API_KEY || env.VITE_FIREBASE_API_KEY || '').trim(),
      authDomain: String(env.FIREBASE_AUTH_DOMAIN || env.VITE_FIREBASE_AUTH_DOMAIN || (projectId ? `${projectId}.firebaseapp.com` : '')).trim(),
      projectId,
      appId: String(env.FIREBASE_APP_ID || env.VITE_FIREBASE_APP_ID || '').trim()
    };
    return new Response(`window.__KL_FIREBASE_CONFIG__ = ${JSON.stringify(config)};`, {
      status: 200,
      headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store, max-age=0' }
    });
  }
  // These are API-only fallbacks. In production, / is normally served as dist/index.html
  // by Workers Static Assets before this Worker is invoked.
  if ((url.pathname === '/' || url.pathname === '/api' || url.pathname === '/health' || url.pathname === '/api/health') && request.method === 'GET') {
    return json(await apiStatus(env));
  }
  if (url.pathname === '/api/games' && request.method === 'GET') {
    const { settings } = await getPublicGameControl(env);
    return json({
      games: GAME_IDS,
      count: GAME_IDS.length,
      enabled: settings.globalEnabled,
      gameSettings: settings.games,
      enabledGameCount: GAME_IDS.filter((id) => settings.games[id]).length,
      maintenanceMessage: settings.maintenanceMessage,
      mode: 'points-only'
    });
  }
  if (url.pathname === '/api/games/demo' && request.method === 'POST') {
    const body = await readBody(request);
    const gameId = String(body.gameId || '');
    const stakePoints = Number(body.stakePoints);
    const { settings } = await getPublicGameControl(env);
    assertGameCanRun(settings, gameId, stakePoints);
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
    const requestId = String(body.requestId || '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      throw new HttpError(400, 'Demann jwèt la bezwen yon kle inik. Rafrechi aplikasyon an epi rekòmanse.');
    }
    const existingTransaction = await firestoreRequest(`/walletTransactions/${encodeURIComponent(requestId)}`, env);
    if (existingTransaction) {
      const previous = fsDocumentFields(existingTransaction);
      if (previous.uid !== identity.uid || previous.type !== 'game_round') throw new HttpError(409, 'Kle demann sa a deja itilize.');
      return json({ roundId: previous.roundId, balancePoints: Number(previous.playerBalanceAfter || 0), result: previous.result, idempotentReplay: true });
    }
    const { settings } = await getGameControlRecord(env);
    assertGameCanRun(settings, gameId, stakePoints);
    const userDoc = await getUserDocument(identity.uid, env);
    if (!userDoc) throw new HttpError(404, 'Pwofil jwè a pa egziste.');
    const profile = fsDocumentFields(userDoc);
    if (profile.accountStatus !== 'active') throw new HttpError(403, 'Kont sa a pa aktif.');
    const playerWallet = await ensurePlayerWallet(identity.uid, userDoc, env);
    const platform = await ensurePlatformWallet(env);
    const balance = Number(profile.pointsBalance || 0);
    if (balance < stakePoints) throw new HttpError(400, 'Ou pa gen ase pwen pou jwe wonn sa a.');
    const game = resolveGame(gameId, stakePoints, body.choice || {});
    const playerDelta = game.payoutPoints - stakePoints;
    const platformDelta = -playerDelta;
    const newBalance = balance + playerDelta;
    const newPlatformBalance = Number(platform.wallet.balancePoints || 0) + platformDelta;
    const roundId = crypto.randomUUID();
    const now = new Date().toISOString();
    const userName = `${firestoreBase(env)}/users/${encodeURIComponent(identity.uid)}`;
    const userFields = { ...profile, pointsBalance: newBalance, updatedAt: now };
    const walletFields = { ...playerWallet.wallet, balancePoints: newBalance, updatedAt: now };
    const platformFields = {
      ...platform.wallet,
      balancePoints: newPlatformBalance,
      totalStakedPoints: Number(platform.wallet.totalStakedPoints || 0) + stakePoints,
      totalPayoutPoints: Number(platform.wallet.totalPayoutPoints || 0) + game.payoutPoints,
      netGamePoints: Number(platform.wallet.netGamePoints || 0) + platformDelta,
      updatedAt: now
    };
    const roundFields = { id: roundId, uid: identity.uid, gameId, stakePoints, payoutPoints: game.payoutPoints, netPoints: playerDelta, multiplier: game.result.multiplier, title: game.result.title, message: game.result.message, details: game.result.details, createdAt: now };
    const ledgerFields = { id: requestId, uid: identity.uid, type: 'game_round', gameId, roundId, stakePoints, payoutPoints: game.payoutPoints, playerDeltaPoints: playerDelta, platformDeltaPoints: platformDelta, playerBalanceAfter: newBalance, platformBalanceAfter: newPlatformBalance, result: game.result, createdAt: now };
    await commitWrites([
      { update: { name: userName, fields: fsFields(userFields) }, currentDocument: { updateTime: userDoc.updateTime } },
      { update: { name: `${firestoreBase(env)}/walletAccounts/${encodeURIComponent(identity.uid)}`, fields: fsFields(walletFields) }, currentDocument: { updateTime: playerWallet.document.updateTime } },
      { update: { name: `${firestoreBase(env)}/platformWallet/main`, fields: fsFields(platformFields) }, currentDocument: { updateTime: platform.document.updateTime } },
      { update: { name: `${firestoreBase(env)}/gameRounds/${roundId}`, fields: fsFields(roundFields) }, currentDocument: { exists: false } },
      { update: { name: `${firestoreBase(env)}/walletTransactions/${requestId}`, fields: fsFields(ledgerFields) }, currentDocument: { exists: false } }
    ], env);
    return json({ roundId, balancePoints: newBalance, result: game.result, idempotencyKey: requestId });
  }
  if (url.pathname === '/api/wallet' && request.method === 'GET') {
    const identity = await verifyFirebaseIdToken(request, env, true);
    const [userDoc, transactions] = await Promise.all([
      getUserDocument(identity.uid, env),
      getWalletTransactions(identity.uid, env, 30)
    ]);
    if (!userDoc) throw new HttpError(404, 'Pwofil jwè a poko egziste. Rekonekte.');
    const profile = fsDocumentFields(userDoc);
    const wallet = await ensurePlayerWallet(identity.uid, userDoc, env);
    return json({ wallet: { uid: identity.uid, balancePoints: Number(profile.pointsBalance || wallet.wallet.balancePoints || 0), currency: 'POINTS', accountStatus: profile.accountStatus || 'active' }, transactions: transactions.map((item) => ({ id: item.id, type: item.type || 'transaction', deltaPoints: Number(item.playerDeltaPoints ?? item.deltaPoints ?? 0), gameId: item.gameId || null, reason: item.reason || '', createdAt: item.createdAt || null })) });
  }
  if (url.pathname === '/api/admin/setup' && request.method === 'POST') {
    await requireAdmin(request, env);
    return json({ ok: true, setup: await ensureAdminCollections(env) });
  }
  if (url.pathname === '/api/admin/wallet' && request.method === 'GET') {
    await requireAdmin(request, env);
    const platform = await ensurePlatformWallet(env);
    const transactions = sortNewest(await listAllCollection('walletTransactions', env, 10000)).slice(0, 50);
    return json({
      platform: {
        balancePoints: Number(platform.wallet.balancePoints || 0),
        openingPlayerPoints: Number(platform.wallet.openingPlayerPoints || 0),
        totalStakedPoints: Number(platform.wallet.totalStakedPoints || 0),
        totalPayoutPoints: Number(platform.wallet.totalPayoutPoints || 0),
        netGamePoints: Number(platform.wallet.netGamePoints || 0),
        updatedAt: platform.wallet.updatedAt || null,
        schemaVersion: Number(platform.wallet.schemaVersion || 1)
      },
      transactions: transactions.map((item) => ({ id: item.id, uid: item.uid || '', type: item.type || 'transaction', gameId: item.gameId || '', stakePoints: Number(item.stakePoints || 0), payoutPoints: Number(item.payoutPoints || 0), playerDeltaPoints: Number(item.playerDeltaPoints ?? item.deltaPoints ?? 0), platformDeltaPoints: Number(item.platformDeltaPoints ?? (item.type === 'game_round' ? -Number(item.deltaPoints || 0) : 0)), reason: item.reason || item.note || '', actorEmail: item.actorEmail || '', createdAt: item.createdAt || null }))
    });
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
  if (url.pathname === '/api/admin/games/control' && request.method === 'GET') {
    await requireAdmin(request, env);
    return json({ settings: (await getGameControlRecord(env)).settings });
  }
  if (url.pathname === '/api/admin/games/control' && request.method === 'POST') {
    const actor = await requireAdmin(request, env);
    return json(await updateGameControl(request, env, actor));
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
      const requestUrl = new URL(request.url);
      if ((requestUrl.pathname === '/admin' || requestUrl.pathname === '/admin/') && request.method === 'GET') {
        if (!env.ASSETS || typeof env.ASSETS.fetch !== 'function') {
          return new Response('Admin assets yo poko konekte. Verifye binding ASSETS la.', { status: 503 });
        }
        const adminUrl = new URL('/admin.html', requestUrl);
        return env.ASSETS.fetch(new Request(adminUrl, { method: 'GET', headers: request.headers }));
      }
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

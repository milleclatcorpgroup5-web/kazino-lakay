import { handleProductionRoute } from './production.js';
import { productionHealth } from './production-health.js';

const encoder = new TextEncoder();
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let jwksCache = { keys: null, expiresAt: 0 };

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
});

function decodeB64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}
function decodeJsonPart(value) {
  return JSON.parse(new TextDecoder().decode(decodeB64Url(value)));
}
async function getJwks() {
  if (jwksCache.keys && Date.now() < jwksCache.expiresAt) return jwksCache.keys;
  const response = await fetch(JWKS_URL, { cf: { cacheTtl: 300, cacheEverything: true } });
  if (!response.ok) throw new Error('Firebase signing keys unavailable');
  const payload = await response.json();
  const maxAge = Number((response.headers.get('Cache-Control') || '').match(/max-age=(\d+)/)?.[1] || 300);
  jwksCache = { keys: payload.keys || [], expiresAt: Date.now() + Math.min(maxAge, 3600) * 1000 };
  return jwksCache.keys;
}

async function verifyFirebaseIdentity(request, env, requireVerified = false) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw Object.assign(new Error('Ou dwe konekte pou kontinye.'), { status: 401 });
  const parts = token.split('.');
  if (parts.length !== 3) throw Object.assign(new Error('Jeton koneksyon an pa valab.'), { status: 401 });

  let header, claims;
  try {
    header = decodeJsonPart(parts[0]);
    claims = decodeJsonPart(parts[1]);
  } catch {
    throw Object.assign(new Error('Jeton koneksyon an pa valab.'), { status: 401 });
  }
  const projectId = String(env.FIREBASE_PROJECT_ID || '').trim();
  if (!projectId || header.alg !== 'RS256' || !header.kid) {
    throw Object.assign(new Error('Konfigirasyon Firebase oswa siyati jeton an pa valab.'), { status: 401 });
  }
  const keyData = (await getJwks()).find((key) => key.kid === header.kid);
  if (!keyData) throw Object.assign(new Error('Kle siyati Firebase la pa jwenn.'), { status: 401 });
  const publicKey = await crypto.subtle.importKey(
    'jwk', keyData, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
  );
  const now = Math.floor(Date.now() / 1000);
  const valid = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    publicKey,
    decodeB64Url(parts[2]),
    encoder.encode(parts[0] + '.' + parts[1])
  );
  if (!valid || claims.aud !== projectId ||
      claims.iss !== 'https://securetoken.google.com/' + projectId ||
      !claims.sub || claims.sub.length > 128 ||
      !Number.isFinite(claims.exp) || claims.exp <= now ||
      !Number.isFinite(claims.iat) || claims.iat > now + 300 ||
      !Number.isFinite(claims.auth_time) || claims.auth_time > now + 300) {
    throw Object.assign(new Error('Sesyon ou a pa valab oswa li ekspire. Rekonekte.'), { status: 401 });
  }
  if (requireVerified && claims.email_verified !== true) {
    throw Object.assign(new Error('Verifye imel ou anvan ou kontinye.'), { status: 403 });
  }
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  const tokenHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return {
    uid: claims.sub,
    email: String(claims.email || '').toLowerCase(),
    emailVerified: claims.email_verified === true,
    name: String(claims.name || ''),
    tokenHash
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const ownOrigin = url.origin;
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean);
    if (origin && origin !== ownOrigin && !allowed.includes('*') && !allowed.includes(origin)) {
      return json({ error: 'Orijin sa a pa otorize.' }, 403);
    }
    const cors = {
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization,Content-Type',
      'Access-Control-Max-Age': '86400',
      ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {})
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (url.pathname === '/firebase-config.js' && request.method === 'GET') {
      const projectId = String(env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || '').trim();
      const config = {
        apiKey: String(env.FIREBASE_WEB_API_KEY || env.VITE_FIREBASE_API_KEY || '').trim(),
        authDomain: String(env.FIREBASE_AUTH_DOMAIN || env.VITE_FIREBASE_AUTH_DOMAIN || (projectId ? `${projectId}.firebaseapp.com` : '')).trim(),
        projectId,
        appId: String(env.FIREBASE_APP_ID || env.VITE_FIREBASE_APP_ID || '').trim()
      };
      return new Response(`window.__KL_FIREBASE_CONFIG__ = ${JSON.stringify(config)};`, {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store, max-age=0' }
      });
    }

    if (url.pathname === '/api/health' || url.pathname === '/api/production/health' || url.pathname === '/health') {
      return json(await productionHealth(env), 200, cors);
    }

    if (url.pathname.startsWith('/api/')) {
      try {
        const response = await handleProductionRoute(request, env, verifyFirebaseIdentity);
        if (response) {
          const headers = new Headers(response.headers);
          for (const [key, value] of Object.entries(cors)) headers.set(key, value);
          return new Response(response.body, { status: response.status, headers });
        }
        return json({ error: 'API sa a pa disponib nan Faz 1–3.' }, 404, cors);
      } catch (error) {
        const status = Number(error?.status) || 500;
        const message = status < 500 ? String(error.message || 'Demann lan pa valab.') :
          'Sèvis la pa disponib kounye a. Verifye Worker Logs pou detay teknik.';
        console.error('[Kazino Lakay production entry]', status, error?.code || error?.name || 'Error');
        return json({ error: message }, status, cors);
      }
    }

    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') return env.ASSETS.fetch(request);
    return new Response('Frontend assets yo poko konekte. Verifye binding ASSETS la.', { status: 503 });
  }
};

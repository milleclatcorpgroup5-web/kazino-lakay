import { auth } from './firebase.js';

// Pages Production uses the same-origin UI and the Worker API. Keep the API
// origin explicit so /api/* never falls through to static Pages (404).
const DEFAULT_API_BASE = 'https://kazino-lakay.milleclatcorpgroup5.workers.dev';
const API_BASE = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE).replace(/\/$/, '');

export async function api(path, options = {}) {
  if (typeof path !== 'string' || !path.startsWith('/')) {
    throw new Error('Chemen API a pa valab.');
  }

  const token = await auth?.currentUser?.getIdToken();
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method || 'GET',
      headers: {
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store'
    });
  } catch {
    throw new Error('Worker API a pa reponn. Verifye deplwaman backend Kazino Lakay la.');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Demann lan echwe (${response.status}).`);
  return payload;
}

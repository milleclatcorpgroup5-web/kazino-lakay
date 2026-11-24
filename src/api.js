import { auth } from './firebase.js';

// Cloudflare Pages Functions sèvi API a sou menm domèn ak aplikasyon an.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

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
    throw new Error('API Pages la pa reponn. Verifye deplwaman Cloudflare Pages la.');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Demann lan echwe (${response.status}).`);
  return payload;
}

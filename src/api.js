import { auth } from './firebase.js';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export async function api(path, options = {}) {
  if (!API_BASE) throw new Error('Adrès backend la poko konfigire. Mete VITE_API_BASE_URL nan anviwònman pwojè a.');
  const token = await auth?.currentUser?.getIdToken();
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Demann lan echwe (${response.status}).`);
  return payload;
}

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Production: Cloudflare Pages Function serves /firebase-config from Pages runtime variables.
// Local Vite development: values can still come from .env / .env.local.
const runtime = globalThis.__KL_FIREBASE_CONFIG__ || {};
const env = import.meta.env || {};
const config = {
  apiKey: runtime.apiKey || env.VITE_FIREBASE_API_KEY || '',
  authDomain: runtime.authDomain || env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: runtime.projectId || env.VITE_FIREBASE_PROJECT_ID || '',
  appId: runtime.appId || env.VITE_FIREBASE_APP_ID || ''
};

const required = [
  ['FIREBASE_WEB_API_KEY', config.apiKey],
  ['FIREBASE_AUTH_DOMAIN', config.authDomain],
  ['FIREBASE_PROJECT_ID', config.projectId],
  ['FIREBASE_APP_ID', config.appId]
];
export const firebaseMissing = required.filter(([, value]) => !String(value || '').trim()).map(([name]) => name);
export const firebaseReady = firebaseMissing.length === 0;

let app = null;
let auth = null;

if (firebaseReady) {
  app = initializeApp(config);
  auth = getAuth(app);
}

export { app, auth };

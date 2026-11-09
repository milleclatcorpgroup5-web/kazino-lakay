import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID'
];

const missing = required.filter((key) => !import.meta.env[key]);
export const firebaseReady = missing.length === 0;
export const firebaseMissing = missing;

let app = null;
let auth = null;

if (firebaseReady) {
  app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  });
  auth = getAuth(app);
}

export { app, auth };

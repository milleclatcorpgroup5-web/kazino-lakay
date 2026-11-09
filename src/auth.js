import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { auth, firebaseReady } from './firebase.js';
import { api } from './api.js';

export function watchAuth(callback) {
  if (!firebaseReady || !auth) return () => {};
  return onAuthStateChanged(auth, callback);
}

export async function registerAccount({ name, email, password }) {
  if (!firebaseReady) throw new Error('Firebase poko konfigire.');
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(credential.user, { displayName: name.trim() });
  await sendEmailVerification(credential.user);
  await api('/api/profile/bootstrap', {
    method: 'POST',
    body: { displayName: name.trim() }
  });
  return credential.user;
}

export async function loginAccount({ email, password }) {
  if (!firebaseReady) throw new Error('Firebase poko konfigire.');
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  await api('/api/profile/bootstrap', {
    method: 'POST',
    body: { displayName: credential.user.displayName || '' }
  });
  return credential.user;
}

export async function resendVerification() {
  if (!auth?.currentUser) throw new Error('Pa gen kont ki konekte.');
  await sendEmailVerification(auth.currentUser);
}

export async function logoutAccount() {
  if (auth) await signOut(auth);
}

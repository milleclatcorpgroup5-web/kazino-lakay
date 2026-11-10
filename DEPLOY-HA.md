# Gid deplwaman rapid — Kazino Lakay V1.2.2

## Cloudflare Workers Builds

- Branch: `main`
- Root directory: `/`
- Build command: `npm run build`
- Deploy command: `npm run deploy:worker`
- Preview builds: dezaktive pandan premye deplwaman

## Build Variables (Firebase Web App)

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

Pran kat valè sa yo nan Firebase Project settings > General > Your apps.

## Worker Runtime Variables

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `INITIAL_ADMIN_EMAILS` (opsyonèl)
- `ALLOWED_ORIGINS` (kite vid pou menm domain)

## Worker Runtime Secret

- `FIREBASE_PRIVATE_KEY` = kle prive service account lan; mete l kòm Secret sèlman.

Service account lan bezwen `roles/datastore.user` sou menm pwojè Firebase la.

## Firestore Rules

Nan Firebase Console > Firestore Database > Rules, pibliye kontni `firestore.rules` ki nan rasin pake a. Règ yo refize tout aksè dirèk kliyan; tout done pase nan Worker API a.

## URL tès

- Sit: `https://kazino-lakay.milleclatcorpgroup5.workers.dev/`
- Health: `/api/health`
- Lis jwèt: `/api/games`

Health dwe montre `gameCount: 17`, `gamesEnabled: true`, `firebaseConfigured: true`, epi lis `firebaseMissing` ak `firebaseInvalid` yo dwe vid.

**Mòd pwen sèlman. Pa gen lajan reyèl.**

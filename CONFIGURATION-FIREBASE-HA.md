# Konfigirasyon Firebase + Admin — Kazino Lakay V1.6.3

## Paramèt Web App piblik yo
Nan Cloudflare Worker `kazino-lakay` > Settings > Variables and Secrets, ajoute kòm Text:
- `FIREBASE_WEB_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_APP_ID`

Worker la sèvi yo nan `/firebase-config.js`; frontend la chaje script sa a anvan Firebase Auth. Sa retire depandans sou Cloudflare Build Variables `VITE_FIREBASE_*`. Pou devlopman Vite lokal, `.env` ka sèvi ak `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`.

Valè Web App sa yo pa sekrè service-account. Men, sekirite a dwe toujou fèt ak Firebase Authentication, Firestore Rules, epi Worker validation.

## Firebase Authentication
- Firebase Console > Authentication > Sign-in method > aktive Email/Password.
- Authentication > Settings > Authorized domains: ajoute `kazino-lakay.milleclatcorpgroup5.workers.dev`.
- Kont yo dwe verifye pa imel anvan yo jwe sou balans kont.

## Worker service account
Text variables: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `INITIAL_ADMIN_EMAILS`.
Encrypted Secret: `FIREBASE_PRIVATE_KEY`.
Service account la bezwen `roles/datastore.user` pou Firestore. Pa mete kle prive a nan frontend, ZIP, GitHub oswa chat.

## Admin
1. Kreye yon kont jwè ak imel ou kontwole.
2. Verifye imel la.
3. Mete imel sa a nan `INITIAL_ADMIN_EMAILS`.
4. Redeploy Worker la, epi ouvri `/admin.html`.
Admin pa ka bay tèt li wòl. Worker la verifye ID token, `email_verified`, epi lis imel admin yo.

## Health
`GET /api/health` montre `frontendFirebaseConfigured`, `frontendFirebaseMissing`, `firebaseConfigured`, `firebaseMissing`, `adminConfigured` san li pa ekspoze sekrè.

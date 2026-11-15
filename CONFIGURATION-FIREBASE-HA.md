# Konfigirasyon Firebase + Admin — Kazino Lakay V1.9.0

## Firebase Web App
Nan Cloudflare Worker `kazino-lakay` > Settings > Variables and Secrets, mete kòm Text:
- `FIREBASE_WEB_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_APP_ID`

Worker la sèvi yo nan `/firebase-config.js`. Se paramèt piblik Web App, pa kle service-account.

## Firebase Authentication
- Firebase Console > Authentication > Sign-in method > aktive Email/Password.
- Authentication > Settings > Authorized domains: ajoute `kazino-lakay.milleclatcorpgroup5.workers.dev`.
- Kont admin lan dwe egziste nan Authentication > Users epi imel li dwe verifye.

## Worker Service Account
Nan Worker > Settings > Variables and Secrets:
- Text: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `INITIAL_ADMIN_EMAILS`.
- Encrypted Secret: `FIREBASE_PRIVATE_KEY`.
- Service Account bezwen wòl minimòm `roles/datastore.user` nan Google Cloud IAM pou Firestore.
- Pa mete private key, JSON service-account, modpas oswa token nan frontend, ZIP, GitHub oswa chat.

## Dwa Admin
`INITIAL_ADMIN_EMAILS` dwe gen imel kont Firebase ki egziste a, verifye, an miniskil. Egzanp: `admin@example.com`. Lis la kapab gen plizyè adrès separe ak vigil. Worker la verifye ID token, email_verified, epi lis imel sa a; wòl la pa soti nan done navigatè a.

## Premye enstalasyon Firestore
1. Kreye Firestore Database `(default)` nan pwojè `kazino-lakay`.
2. Pibliye rules ki nan `firestore.rules` nan Firebase Console > Firestore Database > Rules.
3. Indexes: `firebase.json` itilize `firestore-indexes.json`.
4. Konekte sou `https://kazino-lakay.milleclatcorpgroup5.workers.dev/admin` avèk kont admin verifye.
5. Apre koneksyon admin reyisi, `/api/admin/setup` inisyalize `systemSettings`, `platformWallet`, ak `walletAccounts` ki manke yo. Nouvo kont jwè kreye pwòp bous li otomatikman.

Gade `FIRESTORE-SETUP-HA.md` pou tablo koleksyon yo ak eksplikasyon ledger la.

## Règ balans ak ledger
- `users/{uid}.pointsBalance` ak `walletAccounts/{uid}.balancePoints` rete senkronize.
- `walletTransactions` se ledger append-only nan nivo aplikasyon an; pa gen route ki modifye/efase ansyen antre.
- Chak wonn kont gen yon `requestId` inik epi yon sèl commit atomik mete ajou jwè, kont platfòm, wonn ak ledger.
- `platformWallet/main.netGamePoints` = total stake − total payout; tout valè rete pwen Demo.

## Verifikasyon
- `/api/health`: `firebaseConfigured: true`, `gameControlReadOk: true`.
- `/admin`: paj admin separe.
- Login dwe itilize Firebase Auth account ki egziste deja; `INITIAL_ADMIN_EMAILS` sèlman bay otorizasyon, li pa kreye yon kont.

## Pa gen lajan reyèl
Pa gen depo, retrè, peman, MonCash/NatCash, kat bank oswa konvèsyon pwen. Pa itilize sistèm sa a pou parye lajan.

# Kazino Lakay V1.3.0 — gid deplwaman

## Sa ki nouvo
- PWA installable: manifest, service worker, ikon 192/512, mòd offline pou app shell.
- Mòd DEMO piblik: tout 17 jwèt yo ka teste menm lè Firebase poko konfigire. Demo pa kreye kont, pa ekri Firestore, epi li pa chanje balans.
- Mòd kont: jwe avèk balans ki sove sou Firebase sèlman lè Firebase frontend ak Worker service account yo konfigire.
- Sant administrasyon `/admin.html`, ak wout API admin ki verifye ID token + lis imel admin ki verifye.
- Jesyon kont: aktive/sispann, ajiste pwen demonstrasyon; tout aksyon admin antre nan `adminActions`.

## 1. GitHub
1. Fè yon backup repository a.
2. Dekonprese patch V1.3.0 epi mete fichye yo nan chemen yo endike yo, nan rasin repository `kazino-lakay` la.
3. Pa mete ZIP la kòm yon ZIP andedan repository a.

## 2. Cloudflare build
- Root directory: `/`
- Branch: `main`
- Build command: `npm run build`
- Deploy command: `npm run deploy:worker`
- `worker/wrangler.toml` dwe rete: `name = "kazino-lakay"`, asset folder `../dist`.
- Pa aktive Cloudflare Access sou app piblik la.

## 3. Firebase Web App build variables
Nan Cloudflare Build Variables mete valè Web App Firebase la:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

Aktive Email/Password nan Firebase Authentication. Konfigirasyon sa yo nesesè pou kreye/konekte kont jwè.

## 4. Worker runtime variables/secrets
Worker `kazino-lakay` > Settings > Variables and Secrets:

Text variables:
- `FIREBASE_PROJECT_ID` — menm project ID Firebase lan
- `FIREBASE_CLIENT_EMAIL` — `client_email` service account lan
- `INITIAL_ADMIN_EMAILS` — imel admin verifye a; plizyè imel separe ak vigil

Encrypted secret:
- `FIREBASE_PRIVATE_KEY` — private key service account lan

Service account lan bezwen sèlman wòl `roles/datastore.user` pou Firestore. Pa mete JSON service-account, modpas oswa private key nan GitHub, ZIP, frontend, ni chat.

## 5. Firestore
Pibliye `firestore.rules` nan Firebase Console > Firestore Database > Rules. Rules sa yo bloke aksè dirèk navigatè a; Worker la itilize service account IAM. Kenbe Firestore Rules yo jan yo ye a, pa bay navigatè a aksè dirèk.

## 6. Tès
Louvri:
- `/` — app prensipal
- `/manifest.webmanifest` — PWA manifest
- `/sw.js` — service worker
- `/admin.html` — administrasyon
- `/api/health` — dyagnostik
- `/api/games` — 17 jwèt

Health dwe montre `demoPlayEnabled: true`, `gameCount: 17`. Pou kont/istwa/balans/admin, li dwe montre `firebaseConfigured: true`; pou admin, `adminConfigured: true`.

## Sa mòd DEMO vle di
`POST /api/games/demo` kalkile yon rezilta sou Worker la, san login ak san ekriti Firestore. Retou DEMO a pa yon balans, pa yon lajan, epi li pa sove. Pou rezilta ki antre nan kont jwè a, itilize `/api/games/play` apre tout konfigirasyon Firebase yo fin fèt.

## Limit
Pake sa a se yon pwodwi demonstrasyon ak pwen san valè lajan. Pa gen depo, retrè, MonCash, NatCash, kat bank, balans lajan, oswa peman. Pa itilize pou parye/lajan reyèl. Yon tès lokal pa pwouve IAM, Firebase, oswa deplwaman reyèl la.

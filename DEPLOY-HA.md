# Kazino Lakay V1.6.3 — enstalasyon PWA ak Firebase runtime

## 1. Enstalasyon app la
- Louvri sit la sou HTTPS nan Chrome/Edge (Android: meni ⋮ > Install app / Add to Home screen).
- Bouton **Kijan pou enstale?** nan app la montre etap selon aparèy la.
- Sou iPhone/iPad: sèvi ak Safari > Pataje > Add to Home Screen.
- Sa se yon PWA enstale depi navigatè a, se pa yon fichye APK Android.

## 2. Firebase Web App — Cloudflare Worker Variables
V1.6.3 pa bezwen `VITE_FIREBASE_*` nan build Cloudflare la ankò. Worker la sèvi `/firebase-config.js` ak valè piblik sa yo:
- `FIREBASE_WEB_API_KEY` — Firebase Web API key
- `FIREBASE_AUTH_DOMAIN` — anjeneral `<project-id>.firebaseapp.com`
- `FIREBASE_PROJECT_ID` — menm ID pwojè Firebase lan
- `FIREBASE_APP_ID` — App ID Web App Firebase lan

Ou ka mete kat valè sa yo kòm **Text variables** nan `kazino-lakay` Worker > Settings > Variables and Secrets. API key, auth domain, project ID ak app ID se paramèt konfigirasyon kliyan Firebase; yo pa ranplase règ sekirite yo.

Nan Firebase Console:
1. Create/verify yon Web App nan pwojè a, epi pran `apiKey`, `authDomain`, `projectId`, `appId`.
2. Authentication > Sign-in method > aktive **Email/Password**.
3. Authentication > Settings > Authorized domains: ajoute `kazino-lakay.milleclatcorpgroup5.workers.dev`.
4. Kreye Firestore Database, epi pibliye `firestore.rules` nan ZIP pwojè a.

## 3. Firebase Worker backend
Nan Worker > Settings > Variables and Secrets:
- Text: `FIREBASE_PROJECT_ID` (menm pwojè a), `FIREBASE_CLIENT_EMAIL`, `INITIAL_ADMIN_EMAILS`.
- Secret encrypted: `FIREBASE_PRIVATE_KEY`.
- Service account Google Cloud la bezwen wòl minimòm `roles/datastore.user` pou Firestore.

Pa janm mete private key, service-account JSON, modpas oswa token nan frontend, ZIP, GitHub, ni chat. Pa pataje sekrè yo.

## 4. Build / deploy
- Root: `/`
- Build: `npm run build`
- Deploy Worker + assets: `npm run deploy:worker`
- `worker/wrangler.toml` dwe rete ak `run_worker_first` ki gen `/firebase-config.js`.

Apre deplwaman, verifye:
- `/manifest.webmanifest` — manifest la dwe retounen JSON.
- `/sw.js` — service worker JavaScript.
- `/firebase-config.js` — script la dwe montre sèlman konfigirasyon piblik Web App la, pa okenn sekrè.
- `/api/health` — `frontendFirebaseConfigured: true`, `firebaseConfigured: true`.
- `/admin.html` — admin; aksè mande yon imel verifye ki nan `INITIAL_ADMIN_EMAILS`.

## 5. Aktivasyon kont jwè
1. Apre Firebase + Worker konfigire, kreye kont ak imel/modpas.
2. Louvri imel la, klike lyen verifikasyon an.
3. Dekonekte/rekonekte si paj la te louvri anvan verifikasyon.
4. Kont jwè kreye ak estati `active` pa default; administratè ka sispann/aktive li. Admin dwe verifye epi imel li nan `INITIAL_ADMIN_EMAILS`.

## Limit mòd la
Vèsyon sa a sipòte kont reyèl Firebase ak balans **pwen jwèt** ki sove sou Firestore. Pwen yo pa lajan, pa ka depoze/retire/chanje, epi pa gen MonCash/NatCash, kat bank, peman oswa retrè. Pa aktive parye lajan reyèl sou baz pake DEMO sa a.

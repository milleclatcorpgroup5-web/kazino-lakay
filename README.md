# Kazino Lakay — enfrastrikti V1.1

Nouvo baz aplikasyon an itilize:

- Cloudflare Pages pou frontend Vite la.
- Cloudflare Workers pou API ak motè rezilta jwèt la.
- Firebase Authentication pou kont jwè yo (imel/modpas).
- Cloud Firestore pou pwofil, balans pwen, wonn ak jounal tranzaksyon.
- GitHub pou konsève kòd la epi konekte li ak deplwaman otomatik.

## Enpòtan sou pwen jwèt yo

Pwojè sa a se yon platfòm jwèt ak pwen ki pa gen valè lajan. Pwen yo pa ka achte, vann, transfere, retire oswa konvèti an lajan. Pa gen depo oswa retrè lajan ki aplike. Pa konekte yon processeur peman oswa fonksyon cash-out.

## 1. Enstalasyon lokal

```bash
npm install
cp .env.example .env.local
```

Ranpli valè Firebase Web App yo nan `.env.local`, ansanm ak URL Worker API a. Apre sa:

```bash
npm run dev
npm run build
```

## 2. Firebase

1. Kreye yon pwojè Firebase apa pou Kazino Lakay.
2. Ajoute yon Web App epi pran valè `apiKey`, `authDomain`, `projectId`, ak `appId`.
3. Nan Authentication, aktive founisè Email/Password.
4. Kreye Cloud Firestore nan Native mode.
5. Aplike `firestore.rules` yo. Règ yo bloke tout ekriti dirèk kliyan; Worker la se sèl kanal ekriti pou balans ak rezilta.
6. Kreye yon service account Google Cloud ki gen sèlman wòl ki nesesè pou li/ekri Firestore (pa bay Owner oswa Editor san nesesite).

## 3. Cloudflare Worker API

Konfigire `worker/wrangler.toml` ak pwojè Firebase la. Mete sekrè sa yo nan Worker Settings > Variables and Secrets:

- `FIREBASE_PRIVATE_KEY` kòm **Secret**.

`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `INITIAL_ADMIN_EMAILS`, ak `ALLOWED_ORIGINS` se varyab nòmal. Pa janm mete kle prive a nan Git oswa nan `wrangler.toml`.

Pou devlopman lokal, kopye `worker/.dev.vars.example` kòm `worker/.dev.vars`, ranpli valè yo, epi pa janm ajoute fichye sa a nan Git.

Worker la verifye Firebase ID token, verifye imel pou jwe, jenere rezilta ak `crypto.getRandomValues`, epi fè mizajou balans + jwèt + ledger nan yon sèl Firestore commit ki gen precondition `updateTime`.

## 4. Cloudflare Pages

- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`
- Mete `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, ak `VITE_API_BASE_URL` kòm build variables.

Konekte Pages ak repo GitHub la pou preview ak deplwaman otomatik sou chak push.

## 5. Tès ak kondisyon anvan piblikasyon

- Teste enskripsyon, koneksyon, verifikasyon imel ak dekoneksyon.
- Verifye yon jwè pa kapab modifye `pointsBalance` dirèkteman nan Firebase.
- Teste demann paralèl pou asire balans pa depanse de fwa.
- Teste tout 17 rezolisyon jwèt yo ak limit stake yo.
- Ajoute tès otomatik pou Firestore Rules, token expiry, CORS, validasyon ak balans.
- Ajoute rate limiting, App Check, siveyans ak backup anvan piblikasyon piblik.
- Konfigire wòl administratè yo sèlman atravè sekrè `INITIAL_ADMIN_EMAILS`; pa janm kite premye enskripsyon vin admin otomatikman.

## Dosye

- `src/`: frontend, Firebase client, API client ak katalòg jwèt.
- `worker/src/index.js`: Worker API, verifikasyon token, koneksyon Firestore ak motè jwèt server-side.
- `firestore.rules`: règ sekirite Firestore.
- `worker/wrangler.toml`: konfigirasyon deplwaman Worker.

## Limit aktyèl baz la

Koneksyon Firebase, sekrè Cloudflare, repo GitHub ak domèn Pages poko mare ak kont itilizatè a. Se poutèt sa aplikasyon an poko kapab konekte ak yon pwojè reyèl jiskaske valè ak otorizasyon sa yo mete. Pa gen modil peman oswa retrè lajan reyèl.

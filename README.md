# KAZINO LAKAY — V1.2.2 (Worker + frontend ansanm)

Pwojè sa a prepare pou deplwaye **yon sèl Cloudflare Worker** ki sèvi toude:

- sit entènèt jwèt la (Vite, dosye ki soti nan `dist/`);
- API backend la (`/api/*`);
- Firebase Authentication pou kont jwè yo;
- Cloud Firestore pou pwofil, pwen jwèt, wonn ak tranzaksyon.

Ou pa bezwen kreye yon lòt Cloudflare Pages project. Worker `kazino-lakay` la sèvi sit entènèt la ak API a sou menm adrès `workers.dev` la. Sa retire bezwen pou mete yon adrès API apa nan frontend lan.

## Limit pwodwi a

Sa se yon jwèt demonstrasyon ak pwen ki **pa gen valè lajan**. Pa gen depo, retrè, transfè, acha, vann oswa konvèsyon pwen an lajan. Pa gen koneksyon MonCash, NatCash, kat labank oswa lòt processeur peman. Pa sèvi ak pwojè sa a pou lajan reyèl.

## Fichye enpòtan yo

- `src/`: frontend Vite, Firebase client, API client ak katalòg 17 jwèt yo.
- `worker/src/index.js`: Cloudflare Worker API ak kalkil jwèt sou sèvè.
- `worker/wrangler.toml`: non Worker la, dosye `dist/` la ak règ routaj API/assets yo.
- `firestore.rules`: bloke ekriti dirèk kliyan nan done sansib yo.
- `worker/.dev.vars.example`: egzanp varyab lokal Worker la.
- `.env.example`: egzanp konfigirasyon Firebase pou build Vite lokal.

## 1. Firebase

1. Louvri pwojè Firebase Kazino Lakay ou deja kreye a.
2. Nan **Project settings > General > Your apps**, pran valè Web App sa yo: `apiKey`, `authDomain`, `projectId`, `appId`.
3. Nan **Authentication > Sign-in method**, aktive **Email/Password**.
4. Asire Cloud Firestore deja kreye nan Native mode.
5. Nan **Firestore Database > Rules**, pibliye règ ki nan `firestore.rules`. Règ yo bloke aksè dirèk navigatè a; Worker la sèvi ak service account IAM pou operasyon Firestore.

Règ Firestore yo pa bay mesaj “Wout API sa a pa egziste”. Yo kontwole aksè kliyan dirèk. Worker la sèvi ak yon service account Google Cloud pou ekri nan Firestore atravè API Google la; IAM service account lan kontwole aksè sa a. `firestore.indexes.json` gen endèks konpoze istwa jwèt la; ou ka aplike li ak Firebase CLI (`firebase deploy --only firestore:indexes`) oswa kreye menm endèks la nan Firestore Console si Firebase mande sa.

## 2. Google service account pou Worker la

Backend la bezwen yon service account pou ekri pwofil, pwen ak istwa nan Firestore.

1. Nan Google Cloud Console, chwazi menm pwojè Firebase la.
2. Louvri **IAM & Admin > Service Accounts** epi kreye yon service account pou `kazino-lakay`.
3. Bay li wòl **Cloud Datastore User** (`roles/datastore.user`) sou pwojè a. Pa bay li Owner oswa Editor.
4. Kreye yon kle JSON pou service account lan. Kenbe fichye JSON sa a prive.
5. Pran sèlman `client_email` ak `private_key` ladan l pou mete yo nan Cloudflare selon seksyon 4 la.

**Pa janm** mete fichye JSON service account lan nan GitHub, nan ZIP piblik, nan frontend, oswa nan mesaj ChatGPT. Pa mete `private_key` nan `wrangler.toml`.

## 3. GitHub Workers Builds

Repo a dwe genyen `package.json` nan rasin li. Nan Cloudflare Worker `kazino-lakay` la, konekte repo GitHub `milleclatcorpgroup5-web/kazino-lakay` epi itilize:

| Chan Cloudflare | Valè |
|---|---|
| Branch | `main` |
| Root directory | `/` oswa rasin repo a |
| Build command | `npm run build` |
| Deploy command | `npm run deploy:worker` |
| Preview builds | Kite yo dezaktive pou premye deplwaman an |

`npm run build` verifye sentaks, lanse tès motè jwèt yo, epi konstwi sit entènèt la nan `dist/`.
`npm run deploy:worker` deplwaye Worker la ak `worker/wrangler.toml`.

Pa mete `npx wrangler deploy` san `--config` kòm deploy command pou pwojè sa a. Script `deploy:worker` la deja chwazi bon fichye konfigirasyon an.

## 4. Cloudflare: Build Variables ak Worker Variables/Secrets

Gen de kalite paramèt diferan. Pa melanje yo.

### A. Build Variables (pou frontend Firebase)

Nan paramèt **Builds** Worker la, mete 4 valè Web App Firebase yo:

- `VITE_FIREBASE_API_KEY` = Firebase Web App `apiKey`
- `VITE_FIREBASE_AUTH_DOMAIN` = Firebase Web App `authDomain`
- `VITE_FIREBASE_PROJECT_ID` = Firebase `projectId`
- `VITE_FIREBASE_APP_ID` = Firebase Web App `appId`

Sa yo se konfigirasyon Web App ki piblik nan frontend. Pa mete service-account private key la isit la.

### B. Runtime Variables & Secrets (pou backend Worker la)

Nan **Worker > Settings > Variables and Secrets**, ajoute:

**Variables (text):**

- `FIREBASE_PROJECT_ID` = menm Firebase project ID a
- `FIREBASE_CLIENT_EMAIL` = `client_email` service account lan
- `INITIAL_ADMIN_EMAILS` = adrès imel administratè a (si sa nesesè; verifye imel la anvan)
- `ALLOWED_ORIGINS` = kite vid pou menm-orijin Worker la; sèlman ajoute lòt domain si ou sèvi ak yon frontend sou yon lòt adrès

**Secret (encrypted):**

- `FIREBASE_PRIVATE_KEY` = tout valè `private_key` service account lan, ak liy `BEGIN PRIVATE KEY` ak `END PRIVATE KEY` yo.

Nan `worker/wrangler.toml`, `keep_vars = true` pèmèt varyab Dashboard yo rete la lè Wrangler deplwaye nouvo kòd la. Secret yo pa ekri nan Git.

## 5. Adrès aplikasyon an ak API a

Lè deplwaman an reyisi, louvri adrès Worker la:

- Sit aplikasyon an: `https://kazino-lakay.milleclatcorpgroup5.workers.dev/`
- Tès API: `https://kazino-lakay.milleclatcorpgroup5.workers.dev/api/health`

Rasin `/` la dwe sèvi `index.html` frontend lan. `GET /api/health` dwe retounen JSON ki gen `status: "ok"`, `gamesEnabled: true` ak `gameCount: 17`. `GET /api/games` bay lis 17 jwèt Worker la konnen.

`firebaseConfigured: false` nan repons health la vle di youn oswa plizyè runtime Variable/Secret Firebase poko mete. `true` vle di non valè yo prezan; sa pa verifye IAM oswa kle a. Health endpoint la ka mache menm anvan Firebase konekte nèt.

Frontend lan rele API a sou menm domain lan avèk chemen tankou `/api/me` ak `/api/games/play`. Se poutèt sa `VITE_API_BASE_URL` pa obligatwa.

## 6. Devlopman lokal

```bash
npm install
cp .env.example .env.local
cp worker/.dev.vars.example worker/.dev.vars
```

Ranpli `.env.local` avèk kat valè Firebase Web App yo. Ranpli `worker/.dev.vars` avèk runtime Firebase yo. Pa janm commit `.env.local` oswa `worker/.dev.vars`.

Apre sa:

```bash
npm run dev
```

Pou teste API Worker la lokalman, itilize yon dezyèm tèminal:

```bash
npx wrangler dev --config worker/wrangler.toml
```

Pou tès ak build:

```bash
npm run check
npm test
npm run build
```

## 7. Sa ki verifye ak sa ki poko verifye

Tès lokal yo verifye sentaks JavaScript, 17 rezolisyon jwèt yo (100 wonn pa jwèt nan tès la), validasyon kèk chwa, endpoint health, root fallback ak CORS debaz.

Tès sa yo **pa** pwouve koneksyon reyèl ak Firebase, otorizasyon service account IAM, imèl verifikasyon sou kont reyèl, ni deplwaman Cloudflare. Apre mete tout varyab ak sekrè yo, fè yon tès kont jwè reyèl ak yon kantite pwen demonstrasyon.

Pa pibliye kòm sèvis lajan reyèl. Nenpòt pwojè ki ta pèmèt jwe pou lajan ta bezwen revizyon legal/regilasyon, lisans ki aplikab, jwèt/RNG endepandamman verifye, kontwòl KYC/AML, pwoteksyon jwè ak entegrasyon peman ki sekirize. Tout eleman sa yo pa nan pake sa a.

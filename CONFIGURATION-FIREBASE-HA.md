# Kazino Lakay V1.2.2 — konfigirasyon Firebase ak sekirite

## Sa nouvo vèsyon an aktive

Tout 17 jwèt ki nan `src/games/catalog.js` gen yon motè rezilta sou Worker la:

`crash`, `slots`, `roulette`, `blackjack`, `baccarat`, `keno`, `dice`, `mines`, `plinko`, `penalty`, `coinflip`, `limbo`, `hilo`, `scratch`, `wheel`, `sicbo`, `casinowar`.

`GET /api/games` retounen lis jwèt backend la konnen. `GET /api/health` montre kantite jwèt ak non paramèt Firebase runtime ki manke oswa ki mal fòmate. Health la pa janm retounen valè sekrè yo.

**Tout jwèt yo rete an mòd pwen demonstrasyon. Pwen yo pa lajan, pa ka achte, vann, transfere oswa retire.**

## 1. Aplike Firestore Rules yo

Nan Firebase Console:

1. Chwazi pwojè Firebase Kazino Lakay la.
2. Louvri **Firestore Database**.
3. Louvri onglet **Rules**.
4. Ranplase ansyen règ yo ak kontni fichye `firestore.rules` ki nan rasin ZIP sa a.
5. Peze **Publish**.

Règ sa yo bloke tout lekti/ekriti dirèk depi navigatè a. Frontend lan itilize Firebase Authentication sèlman; li pase tout lekti/ekriti done yo nan Worker API a. Worker la verifye Firebase ID token epi li itilize service account IAM pou pale ak Firestore. Service account la se yon kont sèvè privilejye; Firestore Security Rules pa ranplase IAM oswa verifikasyon nan Worker la.

## 2. Konfigire Firebase Authentication

Nan Firebase Console > **Authentication** > **Sign-in method**, aktive **Email/Password**. Itilizatè yo dwe verifye imel yo anvan yo ka jwe.

Nan **Project settings > General > Your apps**, pran kat valè Web App yo. Sèvi ak valè ki soti nan pwojè Kazino Lakay la, pa yon lòt pwojè.

## 3. Mete Build Variables nan Cloudflare

Worker `kazino-lakay` > Settings/Builds > Build variables (non meni an ka varye selon ekran Cloudflare la):

- `VITE_FIREBASE_API_KEY` — Web App `apiKey`
- `VITE_FIREBASE_AUTH_DOMAIN` — Web App `authDomain`
- `VITE_FIREBASE_PROJECT_ID` — Firebase `projectId`
- `VITE_FIREBASE_APP_ID` — Web App `appId`

Sa yo se valè piblik Web App ki antre nan frontend pandan build la. Pa mete service-account private key la nan Build Variables.

## 4. Kreye service account pou Worker la

Nan Google Cloud Console, chwazi menm pwojè Firebase la:

1. Louvri **IAM & Admin > Service Accounts**.
2. Kreye service account pou Kazino Lakay.
3. Bay li wòl minimòm **Cloud Datastore User** (`roles/datastore.user`). Pa bay li Owner oswa Editor.
4. Kreye kle JSON lan. Kenbe fichye sa a prive.
5. Sèlman pran `client_email` ak `private_key` nan fichye a.

## 5. Mete Runtime Variables/Secrets nan Worker la

Nan Cloudflare > Worker `kazino-lakay` > Settings > Variables and Secrets:

**Variables (Text):**

- `FIREBASE_PROJECT_ID` — valè egzak Firebase `projectId`
- `FIREBASE_CLIENT_EMAIL` — `client_email` service account lan
- `INITIAL_ADMIN_EMAILS` — opsyonèl; imel admin an, separe ak vigil si gen plis pase youn
- `ALLOWED_ORIGINS` — kite vid si sit la ak API a sou menm adrès Worker la

**Secret (Encrypted):**

- `FIREBASE_PRIVATE_KEY` — tout valè `private_key` service account lan, depi `-----BEGIN PRIVATE KEY-----` rive `-----END PRIVATE KEY-----`.

Pa janm mete private key la nan GitHub, nan ZIP, nan `wrangler.toml`, nan frontend oswa nan chat. Pa voye fichye service-account JSON lan bay pèsonn.

## 6. Endèks Firestore

Pake a gen `firestore.indexes.json` pou query istwa jwèt la. Si Firestore mande yon endèks konpoze, kreye li nan Firestore Console pou:

- Collection: `gameRounds`
- `uid`: Ascending
- `createdAt`: Descending

## 7. Deplwaman GitHub / Cloudflare

Repo a dwe gen `package.json` nan rasin repository a (pa anndan yon lòt folder ekstra).

- Branch: `main`
- Root directory: `/`
- Build command: `npm run build`
- Deploy command: `npm run deploy:worker`
- Preview builds: dezaktive pandan premye deplwaman sa a

`worker/wrangler.toml` deja nonmen Worker `kazino-lakay`, sèvi `../dist` kòm static assets, epi dirije `/api/*` sou Worker la.

## 8. Tès apre deplwaman

Louvri:

- Sit la: `https://kazino-lakay.milleclatcorpgroup5.workers.dev/`
- Health: `https://kazino-lakay.milleclatcorpgroup5.workers.dev/api/health`
- Lis jwèt: `https://kazino-lakay.milleclatcorpgroup5.workers.dev/api/games`

Health dwe montre:

- `status: "ok"`
- `gameCount: 17`
- `gamesEnabled: true`
- `firebaseConfigured: true`
- `firebaseMissing: []`
- `firebaseInvalid: []`

Si `firebaseMissing` montre non paramèt, mete paramèt sa yo nan Worker Runtime Variables/Secrets. Si gen `firebaseInvalid`, korije fòma valè a. `firebaseConfigured: true` se yon verifikasyon prezans/fòma senp; li poko pwouve kle a valab ni IAM lan gen bon dwa. Tès reyèl kont ak wonn dwe toujou fèt.

## Limit sekirite ak pwodwi

- Pa gen depo, retrè, peman, balans lajan oswa valè lajan.
- Tout rezilta yo se pwen demonstrasyon; tout kalkil yo fèt sou Worker la avèk Web Crypto.
- Pa konsidere pake sa a pare pou jwèt ak lajan reyèl, oswa pou operasyon komèsyal reglemante.

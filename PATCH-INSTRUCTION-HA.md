# Kazino Lakay V1.2.2 — enstriksyon pou aplike PATCH sou V1.2.0

ZIP sa a **pa yon pwojè konplè**. Li gen sèlman fichye ki nouvo oswa ki dwe ranplase nan baz `KAZINO-LAKAY-V1.2.0-FULL-CORRECTED.zip` la.

## Kijan pou aplike l

1. Kenbe yon kopi sekou ZIP V1.2.0 ou a.
2. Dekonprese ZIP patch V1.2.2 sa a.
3. Louvri folder `kazino-lakay-v1` ki soti nan patch la.
4. Kopi sa ki anndan folder sa a nan rasin pwojè/repository `kazino-lakay` ki deja genyen V1.2.0 la.
5. Lè Android/GitHub mande si pou ranplase fichye ki egziste deja yo, chwazi **Replace / Remplacer** pou fichye patch yo.
6. Pa efase okenn lòt fichye V1.2.0 ki pa parèt nan patch sa a.
7. Anrejistre/commit chanjman yo sou branch `main`; Cloudflare Workers Builds ap pran nouvo commit la.

## Fichye ki nan patch la

### Nouvo fichye
- `CONFIGURATION-FIREBASE-HA.md`

### Fichye pou ranplase
- `DEPLOY-HA.md`
- `README.md`
- `VERIFICATION-HA.md`
- `firestore.rules`
- `package.json`
- `src/main.js`
- `src/style.css`
- `worker/src/index.js`
- `worker/test-engine.mjs`

Tout lòt fichye V1.2.0 yo rete menm jan; yo pa enkli nan ZIP patch la.

## Sa chak pati pote

- Backend V1.2.1: 17 jwèt sou Worker la, `GET /api/games`, dyagnostik Firebase, epi tès motè jwèt.
- UI V1.2.2: nouvo ekran jwèt, tab/espas jwèt, eleman 3D ak animasyon vizyèl.
- Firestore Rules: refize lekti/ekriti dirèk navigatè a; done pase nan Worker la.
- `package.json`: nimewo vèsyon an vin `1.2.2`, epi build la kouri verifikasyon ak tès anvan Vite.

## Aplike Firestore Rules yo se yon aksyon apa

Mete `firestore.rules` nan GitHub pa pibliye règ yo otomatikman nan Firebase. Nan Firebase Console, ale nan **Firestore Database → Rules**, ranplase règ aktyèl yo ak kontni nouvo fichye `firestore.rules`, epi peze **Publish**.

**Atansyon:** Règ sa yo bloke tout aksè dirèk nan navigatè a. Anvan ou pibliye yo, verifye Worker Cloudflare la gen `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` ak sekrè `FIREBASE_PRIVATE_KEY`, epi service account lan gen wòl `roles/datastore.user` sou menm pwojè Firebase la. Pa mete kle prive a nan GitHub, ZIP, frontend oswa chat.

## Deplwaman

Pou Worker ki deja konekte ak GitHub:

- Root directory: `/`
- Build command: `npm run build`
- Deploy command: `npm run deploy:worker`
- Branch: `main`

`worker/wrangler.toml` pa enkli paske li deja gen bon non Worker `kazino-lakay` ak chemen `../dist` nan V1.2.0.

## Tès ki fèt sou pake konbine a

- `npm run check`: PASS.
- `npm test`: PASS — 17 jwèt × 100 wonn = 1 700 tès rezolisyon.
- `npm run build`: pa konfime nan anviwònman sa a paske `vite` pa t enstale (`vite: not found`). Cloudflare dwe enstale depandans yo nan build pa li.
- Pa gen Rules ki pibliye nan pwojè Firebase ou ni deplwaman Cloudflare ki fèt pa ZIP sa a.

Tout jwèt yo rete nan mòd **pwen demonstrasyon sèlman**, san depo, retrè oswa lajan reyèl.

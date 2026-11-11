# Kazino Lakay V1.3.0 — enstriksyon patch

Patch sa a fèt pou repository ki deja gen tout patch V1.2.1 ak V1.2.2 yo. Li gen sèlman fichye ki nouvo oswa ki chanje pou ajoute PWA, mòd jwèt DEMO ki mache san Firebase, epi panèl administratè.

## Aplike patch la

1. Fè yon backup repository GitHub `milleclatcorpgroup5-web/kazino-lakay` la.
2. Louvri ZIP la epi antre nan folder `kazino-lakay-v1`.
3. Kopi tout sa ki anndan folder sa a nan rasin repository GitHub la. Kenbe menm chemen folder yo (`src/`, `worker/src/`, `public/`).
4. Lè GitHub mande si pou ranplase fichye ki egziste, aksepte pou fichye patch la. Fichye ki nouvo yo dwe ajoute.
5. Fè commit sou branch `main` pou Cloudflare ka konstwi ak deplwaye vèsyon an.

Pa mete ZIP la kòm yon fichye ZIP andedan repository a. Pa efase lòt fichye ki pa nan patch la.

## Fichye ki nouvo

- `admin.html`
- `vite.config.js`
- `src/admin.js`
- `src/admin.css`
- `public/manifest.webmanifest`
- `public/sw.js`
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`

## Fichye ki ranplase

- `index.html`
- `package.json`
- `src/main.js`
- `src/style.css`
- `worker/src/index.js`
- `worker/test-engine.mjs`
- `DEPLOY-HA.md`
- `CONFIGURATION-FIREBASE-HA.md`
- `README.md`
- `VERIFICATION-HA.md`

## Fichye pou konsève jan yo ye

Pa ranplase `worker/wrangler.toml`, `firestore.rules`, `firestore.indexes.json`, `src/firebase.js`, `src/auth.js`, `src/api.js`, `src/games/catalog.js`, `.env.example`, `worker/.dev.vars.example` oswa `firebase.json`. Yo pa chanje nan patch sa a.

## Cloudflare

Kenbe pwojè Worker la sou menm non `kazino-lakay`.

- Root directory: `/`
- Branch: `main`
- Build command: `npm run build`
- Deploy command: `npm run deploy:worker`

Konfigirasyon Worker la itilize `worker/wrangler.toml` ki deja nan repository a epi li sèvi ak `dist/` kòm static assets.

## PWA

Apre deplwaman, ouvri adrès sit la nan Chrome Android. Lè opsyon enstalasyon an parèt, chwazi **Enstale app** oswa meni Chrome `⋮` > **Enstale aplikasyon** / **Add to Home screen**. Sou iPhone/iPad, sèvi ak meni Share nan Safari > **Add to Home Screen**.

## Firebase ak administrasyon

Pake a gen mòd DEMO ki sèvi ak Worker la san kont ni Firestore; pa gen balans kont ki modifye nan DEMO. Pou kont, balans ki sove, istwa ak Admin, mete kat Firebase Web App build variables yo, sekrè service account Worker yo, epi `INITIAL_ADMIN_EMAILS` jan gid `CONFIGURATION-FIREBASE-HA.md` la eksplike.

Mete adrès imel Firebase ki verifye pou administratè a nan `INITIAL_ADMIN_EMAILS`. Pa mete kle prive oswa modpas nan GitHub, ZIP, oswa chat. Pa kreye okenn modpas admin default.

Tout pwen rete demonstrasyon san valè lajan. Pa gen depo, retrè, MonCash, NatCash oswa peman reyèl.

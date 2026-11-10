# Gid rapid deplwaman — Kazino Lakay

## Sa pou mete nan Cloudflare Workers Builds

- Build command: `npm run build`
- Deploy command: `npm run deploy:worker`
- Root directory: `/`
- Branch: `main`
- Preview builds: dezaktive pou premye deplwaman.

## Build Variables

Mete 4 valè ki soti nan Firebase Web App:

`VITE_FIREBASE_API_KEY`
`VITE_FIREBASE_AUTH_DOMAIN`
`VITE_FIREBASE_PROJECT_ID`
`VITE_FIREBASE_APP_ID`

## Runtime Variables

Nan Worker `kazino-lakay` > Settings > Variables and Secrets:

`FIREBASE_PROJECT_ID`
`FIREBASE_CLIENT_EMAIL`
`INITIAL_ADMIN_EMAILS` (opsyonèl)
`ALLOWED_ORIGINS` (kite vid lè sit la ak API a sou menm Worker la)

## Runtime Secret

`FIREBASE_PRIVATE_KEY` = private key service account Google Cloud la.

Pa janm mete private key la nan GitHub oswa nan frontend.

## Tès apre deplwaman

1. Louvri `https://kazino-lakay.milleclatcorpgroup5.workers.dev/` — ou dwe wè sit la.
2. Louvri `https://kazino-lakay.milleclatcorpgroup5.workers.dev/api/health` — ou dwe wè JSON ak `status: "ok"`.
3. Si `firebaseConfigured` se `false`, verifye 3 runtime variables yo ak `FIREBASE_PRIVATE_KEY`.

## Règ enpòtan

Pa kreye yon lòt Pages project pou pake sa a. Worker `kazino-lakay` la sèvi frontend ak API ansanm. Pa sèvi ak lajan reyèl; pwen yo se demonstrasyon sèlman.

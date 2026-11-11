# Konfigirasyon Firebase + Admin — Kazino Lakay V1.3.0

## Firebase Web App
Nan Cloudflare Build Variables mete kat valè Web App Firebase yo: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`. Yo se paramèt piblik kliyan Firebase; pa konfonn yo ak sekrè service account lan.

Aktive Authentication > Sign-in method > Email/Password. Jwè dwe verifye imel yo anvan jwèt ki ekri balans/istwa nan kont yo.

## Worker service account
Nan menm pwojè Firebase/Google Cloud la, kreye yon service account epi bay li wòl minimòm `roles/datastore.user`. Mete:
- Text `FIREBASE_PROJECT_ID`
- Text `FIREBASE_CLIENT_EMAIL`
- Secret `FIREBASE_PRIVATE_KEY`

Private key la dwe rete kòm Cloudflare encrypted secret. Pa mete li nan GitHub, frontend, `wrangler.toml`, ZIP oswa chat. Pa janm pataje JSON service account lan.

## Kreye admin
1. Chwazi yon kont Firebase Email/Password ou kontwole.
2. Verifye imel kont sa a.
3. Nan Cloudflare Worker Settings > Variables mete `INITIAL_ADMIN_EMAILS` ak imel la egzakteman (ti/lèt majiskil pa konte). Pou plizyè admin: `admin1@example.com,admin2@example.com`.
4. Redéploye Worker la.
5. Konekte ak menm kont sa a nan `/admin.html`.

Admin pa chwazi wòl li nan navigatè a. Worker la verifye siyati Firebase ID token, `email_verified`, epi imel la dwe sou lis `INITIAL_ADMIN_EMAILS`. Pa sèvi ak yon admin email ki pa verifye.

## Règ ak aksyon admin
`firestore.rules` fèmen aksè dirèk kliyan. Admin API la itilize Worker service account ak lis imel la; li kapab lis kont, lis wonn, aktive/sispann kont ki pa admin, epi ajiste pwen DEMO. Chak modifye ekri nan `adminActions`. Pa gen efasman itilizatè nan panèl sa a.

## Dyagnostik
`GET /api/health` pa retounen okenn sekrè. Li montre sèlman non paramèt ki manke/mal fòmate:
- `firebaseConfigured: true` — twa paramèt runtime yo prezan nan bon fòm; sa poko pwouve kle a otantik oswa IAM gen aksè.
- `adminConfigured: true` — omwen yon imel nan lis admin lan.
- `demoPlayEnabled: true` — jwèt DEMO yo disponib san Firebase.

Si `firebaseConfigured` rete false, jwèt kont yo ak Admin pa pral mache. Mòd DEMO a dwe mache san Firebase, men li pa sove balans.

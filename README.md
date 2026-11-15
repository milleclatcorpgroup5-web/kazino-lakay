# Kazino Lakay V1.9.0

Kazino Lakay se yon aplikasyon jwèt mobile-first an kreyòl, ak 22 jwèt, kont itilizatè Firebase, yon Worker Cloudflare ak Firestore. Li rete nan mòd pwen demonstrasyon sèlman.

## Fonksyon prensipal

- 22 jwèt ak rezilta yo kalkile sou Worker la.
- Firebase Authentication pou enskripsyon/koneksyon jwè.
- Bous pèsonèl pou chak jwè ak istwa mouvman pwen.
- Sant Admin apa sou `/admin` (fichye paj la se `admin.html`).
- Kontwòl jwèt global ak endividyèl, jesyon jwè, koreksyon pwen, estati kont ak jounal admin.
- Kont platfòm, rezilta pwen nèt, total pwen parye/retounen ak ledger tranzaksyon.
- Firestore ekri an tranzaksyon atomik; `requestId` anpeche menm demann jwèt la kredite/debite de fwa.
- Rules Firestore bloke aksè dirèk navigatè a. Se Worker la ki sèvi ak Service Account + IAM.
- PWA ak layout adapte ak telefòn/tablet.

## Firestore

Koleksyon yo kreye otomatikman: `users`, `walletAccounts`, `walletTransactions`, `platformWallet`, `gameRounds`, `adminActions`, `systemSettings`. Apre premye koneksyon Admin lan, `POST /api/admin/setup` inisyalize dokiman sistèm ak kont platfòm, epi li ajoute dokiman bous ki manke pou jwè ki deja egziste yo.

Gade `FIRESTORE-SETUP-HA.md` pou etap Firebase Console ak Rules yo. Pa mete Firestore Rules `allow read, write: if true`.

## Adrès

- Jwè: `/`
- Administrasyon: `/admin`
- API sante: `/api/health`

## Kòmand build ak tès

```bash
npm install
npm run check
npm test
npm run build
```

`worker/wrangler.toml` sèvi ak `dist` kòm dosye assets. Build command la se `npm run build`; deploy Worker la ak `npm run deploy:worker` oswa workflow GitHub/Cloudflare ki deja konekte a.

## Pa gen lajan reyèl

Tout balans, parye, retou ak kont platfòm lan se pwen Demo san valè lajan. Pa gen depo, retrè, peman, MonCash/NatCash, kat bank, konvèsyon pwen oswa lajan reyèl. Pa sèvi ak app sa a pou aksepte parye lajan.

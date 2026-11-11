# Kazino Lakay V1.3.0

PWA mobile-first pou jwèt demonstrasyon ak pwen san valè lajan. Stack: Vite + Firebase Authentication + Cloudflare Worker + Firestore REST via service-account IAM.

## Jwèt
Crash, Slots, Roulette, Blackjack, Baccarat, Keno, Dice, Mines, Plinko, Penalty, Coin Flip, Limbo, Hi-Lo, Scratch Cards, Wheel, Sic Bo ak Casino War.

## Modes
- DEMO (`POST /api/games/demo`): piblik, rezilta sou Worker, pa gen login, pa gen Firestore write, pa gen balans sove.
- Account (`POST /api/games/play`): Firebase auth verified, balans ak istwa anrejistre pa Worker sèlman.

## Admin
`/admin.html`. Aksè sèlman pou imel verified ki nan `INITIAL_ADMIN_EMAILS`. API admin pèmèt summary, lis users/rounds/audit, suspend/activate ak ajisteman pwen demo; chanjman yo antre nan audit.

## PWA
Manifest `/manifest.webmanifest`, service worker `/sw.js`, ikon `/icons/icon-192.png` ak `/icons/icon-512.png`. API pa janm mete nan cache offline.

## Dev
```bash
npm install
npm run check
npm test
npm run build
npm run deploy:worker
```

Gade `DEPLOY-HA.md` ak `CONFIGURATION-FIREBASE-HA.md` anvan deplwaman.

## Pa gen lajan reyèl
Pa gen depo, retrè, peman, MonCash/NatCash, lajan reyèl oswa konvèsyon pwen. Sa a se yon demo; pa itilize pou parye lajan.

# Rapò verifikasyon — Kazino Lakay V1.9.0

## Tès ki reyisi nan anviwònman preparasyon an

- `npm run check`: tout fichye JavaScript yo pase verifikasyon sentaks Node.
- `npm test`: 22 jwèt × 100 simulations; endpoint DEMO; sante API; pwoteksyon endpoint Admin, bous platfòm, setup ak bous jwè.
- Tès estrikti: alias `/admin`, paj admin apa, rules Firestore server-only, chemen index Firebase, route bous/ledger ak PWA shell.
- `firestore.rules` ak `firebase.json` revize; firebase.json kounye a lonje sou `firestore-indexes.json` ki nan pwojè a.

## Sa tès sa yo pa pwouve

- Pa gen tès dirèk sou pwojè Firebase/Firestore reyèl itilizatè a.
- Pa gen verifikasyon kont Cloudflare/GitHub apre deploy; ZIP sa a poko pibliye sou sit la.
- `vite build` pa t kouri nan anviwònman preparasyon sa a paske `node_modules`/depandans Vite yo pa t disponib. Cloudflare Build dwe kouri `npm run build` apre li enstale depandans yo.

## Pwen sekirite

- Firestore Rules yo fèmen aksè dirèk kliyan an; Worker la itilize Service Account ak IAM.
- Endpoint Admin yo mande Firebase ID token verifye epi imel la dwe nan `INITIAL_ADMIN_EMAILS`.
- Chak nouvo wonn pwen an ekri an atomik nan pwofil/bous jwè, kont platfòm, gameRounds ak walletTransactions.
- `walletTransactions` pa gen endpoint modifye/efase nan aplikasyon an.
- Tout fonksyon finansye yo se pwen Demo sèlman; pa gen depo/retrè oswa lajan reyèl.

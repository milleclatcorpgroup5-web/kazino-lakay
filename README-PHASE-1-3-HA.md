# Kazino Lakay V2.0.0-alpha.2 — Sitiyasyon Faz 1–3

Sa a se yon fondasyon pwodiksyon ki poko pare pou lansman. Pa merge oswa deplwaye sou Worker aktyèl la jiskaske PostgreSQL/Hyperdrive, migrasyon, sekrè, entegrasyon ak tès staging valide.

## Sa kòd la fè kounye a

- Mòd production se chemen default; demo mande de paramèt eksplisit.
- Nouvo kont legacy/demo pa resevwa 10 000 pwen ankò; nouvo kont PostgreSQL resevwa wòl `player` ak yon bous HTG zewo atravè trigger DB.
- Pwen istorik Firestore pa enpòte nan PostgreSQL epi yo pa konvèti an lajan.
- Mòd production pa sèvi ak API Firestore pwen yo; ansyen endpoints admin pwen yo fèmen.
- Jwèt, paryaj, depo, retrè ak peman rete fèmen. `/api/games` pa anonse okenn jwèt aktif; esè jwe retounen HTTP 423.
- De migrasyon PostgreSQL yo kreye kont itilizatè, wòl, wallets, ledger doub-antre, idempotency, compliance records, MFA, payment placeholders, audit/fraud events, ak rejis 22 jwèt yo ki rete dezaktive.
- Ledger posting la se yon fonksyon DB revize pou fondasyon an; pa gen endpoint aplikasyon ki poste tranzaksyon nan alpha sa a.
- Admin pwodiksyon an sèvi ak wòl ki nan PostgreSQL ak MFA TOTP ki mare ak hash token Firebase.
- Kliyan ka wè status KYC/laj, mete limit pèsonèl HTG epi aktive oto-eksklizyon.
- Siveyans debaz la anrejistre evènman sekirite ak kèk siyal revizyon hashed; li pa yon sistèm AML/anti-fraud konplè.

## Sa ki poko fini

- PostgreSQL pa kreye ni konekte. `HYPERDRIVE` binding la rete kòm placeholder.
- Migrasyon SQL la poko egzekite oswa teste nan yon motè PostgreSQL.
- Wòl runtime DB a ak dwa li yo poko valide sou staging.
- OTP kliyan pa gen founisè SMS/imel ni pwosesis verification; MFA TOTP ki la a se pou admin sèlman.
- KYC ak verifikasyon laj pa gen founisè ekstèn ni callback siyen; endpoint la rete bloke.
- Pa gen workflow revizyon/rezolisyon alèt anti-fwod.
- Pa gen ledger posting API, kontablite depo/retrè, oswa entegrasyon MonCash/NatCash.
- Pa gen nouvo tès estatistik/paytable pou 22 jwèt yo; sa se Faz 4.
- Build Vite final la ak tès CI GitHub Actions dwe pase anvan merge. Migrasyon SQL yo toujou bezwen teste sou PostgreSQL staging reyèl.

## Tès ki pase

- `npm run check`
- `npm test`: tès motè legacy 22 jwèt yo ak tès fail-closed, zero-credit, production API-lock, SQL structural assertions ak UI compliance hooks.

Sa yo pa ranplase tès SQL sou PostgreSQL reyèl, build Vite, deploy Worker, oswa tès entegrasyon staging.

## Konfigirasyon bloke

Nan Worker production:

- `APP_MODE=production`
- `DEMO_ENABLED=false`
- `PAYMENTS_ENABLED=false`
- `REAL_MONEY_GAMES_ENABLED=false`

Sekrè `MFA_ENCRYPTION_KEY` ak `SECURITY_HASH_SALT` dwe sekrè diferan. Apre sa, mete HYPERDRIVE sèlman lè DB ak wòl runtime a pare. Pa sèvi ak kont DB owner kòm runtime.

## Sekirite/legal

Pa aktive jwèt, paryaj, depo oswa retrè lajan reyèl anvan lisans akò ak patnè yo valide, KYC/laj, AML, kontwòl finansye, ak tès sekirite yo fin pase.


## Preparasyon vizyèl Penalty Lakay

- Seleksyon 16 peyi yo sèvi ak yon vedèt reprezantan pa peyi; non jwè, wòl ak nimewo referans yo soti nan `src/games/penalty-roster.js`.
- Ekran kliyan an montre yon aperçu pou chwazi peyi a pandan jwèt yo rete dezaktive.
- Ansanm SVG Penalty Lakay la montre non/nimewo jwè a epi li gen mouvman elan, kò, janm frapan, bra ak plonje gadyen ki amelyore.
- Direksyon atistik 22 jwèt yo dokimante nan `VISUAL-ART-DIRECTION-HA.md`.
- Sa a poko vle di nou gen modèl fotoreyalis 3D oswa resous mocap. Modèl imen 3D, mouvman mocap, imaj final 22 jwèt yo ak dwa pou itilize resous jwè yo rete travay ki poko fèt.

# Kazino Lakay V2.0.0-alpha.2 — Faz 1–3

## Chanjman nan branch sa a

### Faz 1 — netwayaj
- Mòd pwodiksyon an se default Worker la; mòd demonstrasyon egzije de valè eksplisit (`APP_MODE=demo` ak `DEMO_ENABLED=true`). Deplwaman pwodiksyon an fikse `APP_MODE=production`.
- Mòd pwodiksyon an pa li ni pa modifye balans Firestore demonstrasyon yo.
- Pa gen kredi 10 000 pwen otomatik ankò nan chemen ansyen bootstrap la; nouvo kont Firestore legacy yo kòmanse a zewo.
- Nouvo pwofil PostgreSQL yo kòmanse ak kont HTG zewo; pa gen okenn pwen ansyen ki konvèti an lajan.
- `/api/games/demo` ak `/api/games/play` bloke ak HTTP 423 nan mòd pwodiksyon.
- Ansyen API admin ki te baze sou pwen bloke ak HTTP 410.
- Dashboard admin pwodiksyon an separe ak ansyen dashboard Firestore la, ak wòl DB ak MFA TOTP.

### Faz 2 — PostgreSQL
- Migrasyon `0001_production_foundation.sql` kreye pwofil, wòl, kont bous, ledger, compliance, OTP/MFA, demann depo/retrè dezaktive, audit ak fraud alerts.
- Ledger la sèvi ak antre double-entry, `wallet_balances` derive, idempotency key + SHA-256 payload hash, advisory lock, verrouillage kont bous, kontwòl balans negatif, epi li bloke modifye/efase antre istorik.
- Fonksyon posting SQL la pa bay `PUBLIC` dwa egzekisyon. Pa gen API posting nan Faz 1–3.

### Faz 3 — sekirite ak pwoteksyon jwè
- Firebase ID token la verifye sou sèvè a; imel verifye obligatwa pou bous ak endpoints sansib.
- MFA administratè TOTP: sekrè AES-GCM chifre, kòd 6 chif, pwoteksyon re-itilizasyon kòd, sesyon MFA 10 minit mare ak hash token Firebase, rate-limit apre 5 echèk/15 minit.
- KYC/verifikasyon laj rete fail-closed; pa gen self-assertion ki ka aktive laj/KYC.
- Limit depo/paryaj/pèt ka sèlman bese atravè API a; okenn ogmantasyon/deklarasyon efasman dirèk pa disponib.
- Oto-eksklizyon (1/7/30/90/365 jou oswa pèmanan) pa kapab anile pandan li aktif.
- Siveyans debaz la hash IP/User-Agent ak HMAC si `SECURITY_HASH_SALT` egziste; li ka louvri alèt revizyon pou plizyè kont sou menm rezo oswa tantativ MFA repete. Sa pa yon sistèm AML konplè.

## Blokaj pwodiksyon ki dwe rete

- `APP_MODE=production`
- `DEMO_ENABLED=false`
- `PAYMENTS_ENABLED=false`
- `REAL_MONEY_GAMES_ENABLED=false`
- Pa aktive jwèt, paryaj, depo oswa retrè.
- Pa bay kredi demonstrasyon oswa konvèti ansyen pwen an lajan.

## Konfigirasyon ki poko fèt

- Pa gen Hyperdrive binding `HYPERDRIVE` ki konekte nan Worker la nan branch sa a. Se pou sa API pwodiksyon an ap retounen `status=maintenance` jiskaske bazdone a pare.
- Migrasyon SQL la poko egzekite sou okenn bazdone.
- `MFA_ENCRYPTION_KEY` ak `SECURITY_HASH_SALT` dwe mete kòm Worker Secrets separe.
- Premye administratè dwe kreye nan Firebase, fè bootstrap sou PostgreSQL, epi resevwa wòl `admin` ak `account_status='active'` atravè yon koneksyon administratè DB ki sekirize.
- Founisè KYC/age-check, founisè OTP ak peman poko entegre.
- OTP kliyan pa gen founisè livrezon SMS/imel ni endpoint verifikasyon; MFA TOTP ki konstwi a se pou administratè sèlman.
- Tès entegrasyon ak PostgreSQL reyèl, Hyperdrive, Firebase Auth ak navigatè sou staging poko fèt; build Vite pa t kapab lanse nan anviwònman lokal la paske depandans Vite pa t enstale.

## Pa deplwaye sou production aktyèl la

Branch sa a se alpha fondasyon teknik. Li pa dwe merge oswa deplwaye sou production jiskaske SQL la revize sou PostgreSQL staging, IAM/dwa wòl yo verifye, Worker Secrets/Hyperdrive yo pare, ak tès sekirite yo pase.

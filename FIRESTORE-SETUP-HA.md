# Kazino Lakay — Firestore ak Rules (V1.9.0)

## Enpòtan: kreye Firestore Database

Nan pwojè Firebase `kazino-lakay`, ouvri **Firestore Database** epi asire baz done `(default)` la deja kreye. Worker la sèvi ak menm pwojè a nan `FIREBASE_PROJECT_ID`.

## Koleksyon ak dokiman aplikasyon an kreye otomatikman

Pa bezwen kreye koleksyon sa yo alamen. Lè yon administratè verifye antre nan `/admin`, aplikasyon an rele `POST /api/admin/setup` epi li asire estrikti sa a:

| Koleksyon | Dokiman | Itilizasyon |
|---|---|---|
| `users` | `{uid}` | Pwofil jwè ak balans aktyèl |
| `walletAccounts` | `{uid}` | Bous chak jwè; balans an pwen |
| `walletTransactions` | `{transactionId}` | Ledger tranzaksyon ki ajoute sèlman |
| `platformWallet` | `main` | Kont platfòm ak rezilta jwèt |
| `gameRounds` | `{roundId}` | Rezilta chak wonn |
| `adminActions` | `{actionId}` | Jounal aksyon administratè |
| `systemSettings` | `gameControl`, `schema` | Kontwòl jwèt ak vèsyon estrikti done |

Lè nouvo jwè kreye pwofil li, Worker la kreye `users/{uid}`, `walletAccounts/{uid}` epi li ekri premye kredi pwen an nan `walletTransactions`. Lè jwè jwe, yon sèl Firestore commit mete ajou bous jwè a, kont platfòm nan, wonn jwèt la ak ledger la. Demann jwe a dwe gen `requestId` inik.

Pou ansyen done, premye `POST /api/admin/setup` kreye yon snapshot inisyal `platformWallet/main` apati balans jwè ki deja egziste ak estatistik wonn istorik yo; li kreye dokiman bous pou kont li jwenn yo. Li pa efase ni modifye ansyen wonn yo.

## Mete Firestore Rules yo

Fichye `firestore.rules` la deja nan rasin ZIP la. Li entansyonèlman fèmen tout lekti/ekriti dirèk nan navigatè a. Pa ranplase li ak règ `allow read, write: if true`.

Etap nan Firebase Console:

1. Ouvri **Firestore Database → Rules**.
2. Ranplase kontni editè a ak tout kontni fichye `firestore.rules` la.
3. Peze **Publish**.

Worker la sèvi ak Service Account Google la avèk IAM (`roles/datastore.user`) pou li/ekri Firestore. Rules sa yo bloke aksè dirèk nan Firebase Web SDK; pa mete private key nan frontend, ZIP oswa GitHub.

## Index

`firebase.json` kounye a rele fichye `firestore-indexes.json` ki prezan nan pwojè a. Index `walletTransactions` la sipòte lis mouvman bous jwè a selon `uid` ak dat.

## Kont administratè

- Firebase Console → **Authentication → Users**: kont admin lan dwe egziste.
- Authentication → **Sign-in method**: aktive **Email/Password**.
- Verifye imel admin lan.
- Cloudflare Worker → **Settings → Variables and Secrets**: `INITIAL_ADMIN_EMAILS` dwe gen menm imel sa a (lowercase; plizyè imel separe ak vigil).
- `INITIAL_ADMIN_EMAILS` pa kreye kont Firebase. Li sèlman bay privilèj admin pou yon kont Firebase ki deja konekte ak imel verifye.
- Si login bay `auth/invalid-credential`, verifye si kont lan egziste nan Users epi teste modpas la; bouton “Mwen bliye modpas mwen” sou paj admin lan voye reset imel pou kont ki egziste.

## Pwen ak kont platfòm

Tout montan yo se pwen Demo. Lè yon jwè mete pwen, platformDelta se `stake - payout`; lè li genyen plis pase li mete, platformDelta ka negatif. Ajisteman admin sou balans jwè a gen yon mouvman opoze nan kont platfòm nan pou kenbe ledger la ekilibre.

`platformWallet/main.balancePoints` reprezante kontrepati total pwen ki nan bous jwè yo; li kapab negatif. `netGamePoints` se rezilta jwèt nèt: total pwen parye mwens total pwen retounen. Se pa lajan ni revni ki ka retire.

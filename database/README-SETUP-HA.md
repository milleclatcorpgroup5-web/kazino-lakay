# Kazino Lakay — PostgreSQL production foundation (HA)

## Enpòtan anvan deplwaman

Pake sa a se yon fondasyon Faz 1–3. Li pa yon lisans jwèt aza, li pa yon entegrasyon KYC/SMS, li pa yon sistèm depo/retrè, epi li pa pèmèt paryaj. `PAYMENTS_ENABLED`, `REAL_MONEY_GAMES_ENABLED` ak mòd jwèt pwodiksyon an rete fèmen.

Pa janm konekte Worker pwodiksyon an ak yon bazdone ki gen lajan reyèl oswa done finansye aktif anvan migrasyon an, dwa aksè, sovgad, ak verifikasyon sekirite yo fin teste.

## 1. Kreye bazdone PostgreSQL la

Chwazi yon founisè PostgreSQL ki sipòte koneksyon TLS ak Cloudflare Hyperdrive. Kreye yon bazdone apa pou Kazino Lakay (pa sèvi ak bazdone yon lòt aplikasyon Milléclat). Kenbe modpas administratè bazdone a andeyò GitHub ak chat la.

Migrasyon an mande PostgreSQL 14+ ak ekstansyon `pgcrypto`. Li kreye kont kliyan, wòl, kont bous, ledger doub-antre, KYC placeholders, limit jwèt responsab, oto-eksklizyon, MFA, depo/retrè dezaktive, audit ak alèt sekirite.

## 2. Aplike migrasyon an

Sèvi ak yon koneksyon administratè bazdone a nan zouti founisè PostgreSQL la epi egzekite de fichye sa yo nan lòd sa a, chak youn yon sèl fwa:

1. `database/migrations/0001_production_foundation.sql` — kont kliyan, bous, ledger, kontwòl sekirite ak konfòmite.
2. `database/migrations/0002_locked_game_registry.sql` — katalòg 22 jwèt yo ak depo wonn yo; tout jwèt rete dezaktive.
3. `database/migrations/0003_admin_account_controls.sql` — rejis imitab aksyon administratè sou kont jwè yo (sispann/reyaktive), avèk kle idempotans.

Pa egzekite migrasyon 0002 anvan 0001 paske li itilize fonksyon sekirite migrasyon 0001 kreye a.

Apre sa, verifye:

```sql
SELECT version, applied_at FROM schema_migrations ORDER BY version;
SELECT to_regclass('public.app_users'), to_regclass('public.wallet_accounts'),
       to_regclass('public.ledger_transactions'), to_regclass('public.ledger_entries'),
       to_regclass('public.game_catalog'), to_regclass('public.game_rounds');
SELECT version FROM schema_migrations
WHERE version IN ('0001_production_foundation','0002_locked_game_registry','0003_admin_account_controls')
ORDER BY version;
SELECT provider_code, enabled, environment FROM payment_provider_configs ORDER BY provider_code;
```

De founisè peman yo dwe parèt ak `enabled = false`. Pa chanje sa.

Migrasyon 0001 la kreye 12 kont ledger sistèm vid pou HTG, USD ak EUR: kont lajan platfòm, kont clearing founisè, kont revni platfòm ak kont suspense. Kont yo pa gen okenn balans inisyal. Bous kliyan yo se kont credit-normal; kont lajan platfòm/clearing yo se debit-normal, konsa balans sòti nan antre ledger yo dapre nati kont lan.

Migrasyon 0002 la anrejistre 22 jwèt yo, men tout rete `is_enabled=false` ak `release_phase='phase_4_pending'`. Pa chanje paramèt sa yo pandan Faz 1–3.

## 3. Kreye yon wòl aplikasyon ki gen dwa limite

Pa sèvi ak kont `postgres`, `owner` oswa kont administratè bazdone a kòm `HYPERDRIVE` runtime. Kreye yon wòl aplikasyon separe ak yon modpas solid. Egzanp (ranplase modpas la ak yon sekrè inik):

```sql
CREATE ROLE kazino_lakay_app LOGIN PASSWORD 'REPLACE_WITH_LONG_RANDOM_SECRET';
GRANT CONNECT ON DATABASE kazino_lakay TO kazino_lakay_app;
GRANT USAGE ON SCHEMA public TO kazino_lakay_app;
GRANT SELECT ON schema_migrations, app_users, user_roles, wallet_accounts,
  wallet_balances, ledger_transactions, ledger_entries, responsible_gaming_limits,
  self_exclusions, kyc_cases, admin_mfa_credentials, admin_mfa_sessions,
  security_events, audit_logs, fraud_alerts TO kazino_lakay_app;
GRANT INSERT (auth_provider, auth_subject, email, display_name, email_verified)
  ON app_users TO kazino_lakay_app;
GRANT UPDATE (email, display_name, email_verified, updated_at)
  ON app_users TO kazino_lakay_app;
GRANT EXECUTE ON FUNCTION manage_player_account_status(UUID, UUID, TEXT, TEXT, TEXT, TEXT)
  TO kazino_lakay_app;
GRANT INSERT ON self_exclusions, security_events, audit_logs, fraud_alerts
  TO kazino_lakay_app;
GRANT INSERT (user_id, currency, daily_deposit_limit_minor, weekly_deposit_limit_minor, daily_wager_limit_minor, daily_loss_limit_minor)
  ON responsible_gaming_limits TO kazino_lakay_app;
GRANT UPDATE (daily_deposit_limit_minor, weekly_deposit_limit_minor, daily_wager_limit_minor, daily_loss_limit_minor, updated_at)
  ON responsible_gaming_limits TO kazino_lakay_app;
GRANT INSERT (user_id, secret_ciphertext, secret_iv, verified_at, last_accepted_counter)
  ON admin_mfa_credentials TO kazino_lakay_app;
GRANT UPDATE (verified_at, last_accepted_counter)
  ON admin_mfa_credentials TO kazino_lakay_app;
GRANT INSERT (user_id, token_hash, expires_at) ON admin_mfa_sessions TO kazino_lakay_app;
GRANT UPDATE (verified_at, expires_at) ON admin_mfa_sessions TO kazino_lakay_app;
```

Wòl runtime la pa gen dwa ekri nan `user_roles` oswa `wallet_accounts`: trigger PostgreSQL la bay nouvo kliyan wòl `player` ak yon bous HTG a zewo. Se administratè bazdone a sèlman ki kapab bay wòl privilèj. Li pa gen dwa modifye `app_users.account_status` dirèkteman ni ekri nan `admin_account_actions`; li resevwa sèlman dwa `EXECUTE` sou fonksyon SQL `manage_player_account_status`, ki reverifye wòl admin, sesyon MFA, rezon, tranzisyon estati ak idempotency anndan PostgreSQL. Wòl runtime la pa dwe gen `INSERT`, `UPDATE` oswa `DELETE` sou `ledger_transactions`/`ledger_entries`; li pa dwe gen dwa pou modifye oswa efase audit/security logs. Ledger posting la pa ekspoze nan API Faz 1–3. Anvan Faz 4, revize epi teste kontwòl privilèj ledger la apa.

Si founisè a pa pèmèt egzekite `CREATE ROLE` oswa `GRANT`, mande sipò founisè a pou kreye wòl minimòm sa a. Pa bay app la dwa administratè kòm solisyon rapid.

## 4. Konfigire Cloudflare Hyperdrive

Worker la sèvi ak `pg@8.16.3` ak `nodejs_compat`, selon egzanp ofisyèl Cloudflare Hyperdrive pou node-postgres. Konfigirasyon compatibility la deja nan `worker/wrangler.toml`; binding ID Hyperdrive la rete pou ranpli apre bazdone a kreye.

Nan Cloudflare:

1. Ale nan Workers & Pages → Hyperdrive → Create configuration.
2. Chwazi PostgreSQL la epi antre koneksyon TLS la ak wòl `kazino_lakay_app` la.
3. Nan Worker `kazino-lakay`, ajoute binding Hyperdrive la ak non egzak `HYPERDRIVE`.
4. Pa mete connection string la nan fichye Git, nan `wrangler.toml`, ni nan chat.

## 5. Ajoute Worker Secrets

Jenere de sekrè diferan, omwen 32 bytes chak. Pa re-itilize modpas PostgreSQL la.

```bash
openssl rand -hex 32
```

Nan Cloudflare Worker → Settings → Variables and Secrets, mete:

- `MFA_ENCRYPTION_KEY` kòm Secret.
- `SECURITY_HASH_SALT` kòm yon lòt Secret.

Pa mete `KYC_PROVIDER_ADAPTER_READY=true`. Entegrasyon founisè KYC/verifye laj la poko devlope epi teste.

## 6. Bay premye administratè a wòl la

1. Kreye kont la nan Firebase Authentication avèk yon imel ou kontwole.
2. Verifye imel la.
3. Konekte yon fwa sou sit la pou `/api/profile/bootstrap` kreye pwofil PostgreSQL la. Li rete `pending_review` epi li pa kapab jwe.
4. Nan koneksyon administratè PostgreSQL la, jwenn pwofil la:

```sql
SELECT id, auth_subject, email, account_status
FROM app_users
WHERE email = lower('YOUR_ADMIN_EMAIL');
```

5. Verifye UID `auth_subject` la matche egzakteman ak UID Firebase la. Apre sa, aktive kont sa a epi bay wòl admin:

```sql
UPDATE app_users
SET account_status = 'active', email_verified = true, updated_at = now()
WHERE auth_provider = 'firebase'
  AND auth_subject = 'YOUR_FIREBASE_UID'
  AND email = lower('YOUR_ADMIN_EMAIL');

INSERT INTO user_roles (user_id, role)
SELECT id, 'admin' FROM app_users
WHERE auth_provider = 'firebase'
  AND auth_subject = 'YOUR_FIREBASE_UID'
  AND email = lower('YOUR_ADMIN_EMAIL')
  AND NOT EXISTS (
    SELECT 1 FROM user_roles r WHERE r.user_id = app_users.id
      AND r.role = 'admin' AND r.revoked_at IS NULL
  );
```

Pa bay lòt moun wòl `admin`. Itilizatè a dwe aktive MFA TOTP nan `/admin.html` anvan dashboard pwodiksyon an louvri. Apre yon MFA fin aktive oswa dezaktive, pa efase/modifye credential la atravè aplikasyon an; pwosedi rekiperasyon an dwe fèt pa administratè bazdone a apre verifikasyon idantite.

## 7. Tcheke eta a

Apre deplwaman sou yon anviwònman staging izole (pa sou production aktyèl la), verifye:

- `GET /api/health` retounen `mode=production`.
- San Hyperdrive, li dwe retounen `status=maintenance` ak `databaseConfigured=false`.
- Apre twa migrasyon yo, `databaseReady=true` epi schema a rapòte `0001+0002+0003`.
- `paymentsEnabled=false` ak `realMoneyGamesEnabled=false` toujou.
- `GET /api/games` retounen 22 jwèt nan katalòg la, tout ak `enabled=false` ak `releasePhase=phase_4_pending`.
- `POST /api/games/demo` ak `POST /api/games/play` retounen HTTP 423.
- Ansyen API administrasyon ki te manipile pwen yo retounen HTTP 410.

Pa fè okenn tranzaksyon tès ak lajan reyèl. Pa enpòte pwen Firestore V1.9.0 nan bous HTG yo. Migrasyon sa a pa fè okenn enpòtasyon.

## 8. Sa ki poko pare

- KYC ak sèvis verifikasyon laj: tab ak pòt API fèmen; adapter founisè, callback siyati ak pwosedi revizyon poko konstwi.
- OTP SMS/imel: tab defi egziste; founisè livrezon, rate limit ak pwosesis verifikasyon pou kliyan poko konekte.
- MFA TOTP pou administratè: backend ak ekran anrejistreman/verifikasyon konstwi; li bezwen `MFA_ENCRYPTION_KEY` ak tès entegre sou staging.
- Siveyans fwod: evènman MFA ki echwe ak plizyè kont sou menm rezo hashed ka kreye alèt revizyon; sa se yon siyal, pa prèv fwod ni yon sistèm AML konplè.
- Limit ak oto-eksklizyon: API ak depo done yo konstwi; yo poko aplike sou yon motè paryaj paske motè sa a rete fèmen epi Faz 4 poko fèt.
- Ledger: estrikti doub-antre, balans derive, verifikasyon ekilib, balans pa negatif, idempotency ak imutabilite nan SQL. Pa gen endpoint ki kapab poste tranzaksyon nan Faz 1–3.
- Depo/retrè: tab ak founisè placeholder sèlman; pa gen okenn koneksyon MonCash/NatCash e pa gen okenn API peman aktif.

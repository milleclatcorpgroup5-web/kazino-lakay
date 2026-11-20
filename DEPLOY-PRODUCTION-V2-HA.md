# Kazino Lakay V2 — Guide de déploiement Production (HA)

> Ce guide concerne la branche Production V2 uniquement. Il ne remplace pas la mise en place d'un environnement staging. Ne pas déployer sur le Worker public tant que les migrations, les rôles, Hyperdrive, les secrets, Firebase et la QA ne sont pas validés.

## 1. Branche et modèle de déploiement

Branche de travail : `codex/kazino-v2.0.0-production-phase-4-6`.

Le projet utilise **Cloudflare Worker + Static Assets + Hyperdrive**. Il ne faut pas créer un projet Cloudflare Pages statique séparé en supposant que cela fournira les API Production.

Configuration : `worker/wrangler.toml`
- Entrée Worker : `src/production-entry.js`
- Assets : `../dist`
- Binding assets : `ASSETS`
- Routes Worker-first : `/api/*`, `/health`, `/firebase-config.js`
- Mode : `APP_MODE=production`
- Verrous : `DEMO_ENABLED=false`, `PAYMENTS_ENABLED=false`, `REAL_MONEY_GAMES_ENABLED=false`

Commande de build : `npm run build`
Commande de déploiement Worker : `npm run deploy:worker`

Exécuter les commandes depuis la racine du dépôt, avec Node.js 24.12.0 ou plus récent.

## 2. Créer PostgreSQL dédié

1. Créer un nouveau projet PostgreSQL/Supabase réservé à Kazino Lakay.
2. Ne pas utiliser la base LakayGoPay ni aucune autre base de Milléclat.
3. Utiliser PostgreSQL 14+ avec TLS et `pgcrypto`.
4. Garder le mot de passe owner/migrator hors GitHub, navigateur et chat.
5. Faire une sauvegarde avant chaque migration sur staging.

Exécuter les migrations dans cet ordre depuis une connexion migrator/owner, uniquement sur la base staging :

1. `database/migrations/0001_production_foundation.sql`
2. `database/migrations/0002_locked_game_registry.sql`
3. `database/migrations/0003_admin_account_controls.sql`

Après exécution, contrôler :

```sql
SELECT version, applied_at
FROM schema_migrations
ORDER BY version;

SELECT COUNT(*) AS total_games,
       BOOL_AND(is_enabled = FALSE) AS all_disabled,
       BOOL_AND(release_phase = 'phase_4_pending') AS still_locked
FROM game_catalog;

SELECT provider_code, enabled
FROM payment_provider_configs
ORDER BY provider_code;
```

Attendu :
- 3 versions : `0001_production_foundation`, `0002_locked_game_registry`, `0003_admin_account_controls`.
- 22 jeux, tous `is_enabled=false`, tous `phase_4_pending`.
- MonCash et NatCash désactivés.

## 3. Rôle runtime PostgreSQL

Suivre exactement la section 3 de `database/README-SETUP-HA.md`. Le Worker ne doit pas utiliser le compte `postgres`, owner ou migrator.

Le rôle `kazino_lakay_app` doit avoir uniquement les droits runtime documentés. Notamment :
- aucune écriture directe dans `user_roles` ou `wallet_accounts`;
- aucun INSERT/UPDATE/DELETE direct dans le ledger;
- aucun UPDATE direct de `app_users.account_status`;
- seuls les changements de statut joueur passent par `manage_player_account_status(...)`, qui revalide le rôle admin, la session MFA, le motif et l'idempotency key dans PostgreSQL.

Ne pas donner `SUPERUSER`, `CREATEDB`, `CREATEROLE` ni un rôle owner au Worker.

## 4. Hyperdrive Cloudflare

Dans Cloudflare Dashboard :
1. Ouvrir Workers & Pages → Hyperdrive → Create configuration.
2. Créer la configuration qui pointe vers le PostgreSQL staging, avec TLS et l'identité `kazino_lakay_app`.
3. Dans le Worker `kazino-lakay-staging` (séparé du Worker public), ajouter un binding Hyperdrive dont le nom exact est `HYPERDRIVE`.
4. Ne jamais coller le connection string dans un fichier Git, un build frontend ou le chat.
5. Garder une séparation stricte entre staging et production : base, Hyperdrive, variables, secrets et Worker distincts.

Le bloc `[[hyperdrive]]` du fichier Wrangler reste un placeholder jusqu'à l'obtention de l'ID réel. Ne pas inventer ou réutiliser un ID.

## 5. Firebase Authentication

Créer/valider un Firebase Web App et activer Email/Password dans Authentication. Ajouter le domaine du Worker staging aux domaines autorisés.

Variables publiques du Worker :
- `FIREBASE_PROJECT_ID`
- `FIREBASE_WEB_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_APP_ID`

Le Worker expose ces valeurs via `/firebase-config.js`. Ces valeurs Web App ne sont pas des mots de passe, mais ne remplacent pas la sécurité serveur. Firebase doit être le même projet utilisé par l'authentification de l'application.

## 6. Secrets du Worker

Créer des valeurs aléatoires indépendantes d'au moins 32 octets. Dans Worker → Settings → Variables and Secrets, définir comme **Secrets** :
- `MFA_ENCRYPTION_KEY`
- `SECURITY_HASH_SALT`

Ne pas utiliser la chaîne de connexion PostgreSQL comme clé de chiffrement ou salt. Ne pas mettre ces valeurs dans `wrangler.toml`, GitHub, le navigateur ou les fichiers `dist`.

Variables non secrètes :
- `APP_MODE=production`
- `DEMO_ENABLED=false`
- `PAYMENTS_ENABLED=false`
- `REAL_MONEY_GAMES_ENABLED=false`
- `FIREBASE_PROJECT_ID`, `FIREBASE_WEB_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_APP_ID`

## 7. Premier administrateur

1. Créer le compte dans Firebase Authentication et vérifier son e-mail.
2. Se connecter une fois à l'environnement staging pour que `POST /api/profile/bootstrap` crée le profil PostgreSQL en `pending_review`.
3. Avec une connexion owner/migrator contrôlée, vérifier que l'UID Firebase correspond au champ `app_users.auth_subject`.
4. Activer le compte et insérer le rôle `admin` selon l'exemple de la section 6 de `database/README-SETUP-HA.md`.
5. Se connecter à `/admin`, enrôler MFA TOTP, puis vérifier le code à 6 chiffres.

Ne pas accorder le rôle admin à travers un endpoint client. Ne pas partager le secret TOTP ou les codes de secours.

## 8. Vérifications staging obligatoires

Sur l'URL staging, vérifier :
- `GET /api/health` : mode production, PostgreSQL configuré et toutes les migrations présentes.
- `GET /api/games` : exactement 22 jeux, `enabled=false`, `enabledGameCount=0`, `releasePhase=phase_4_pending`.
- `POST /api/games/play` et `POST /api/games/demo` : HTTP 423.
- Inscription, confirmation d'e-mail, connexion, bootstrap de profil et affichage d'un solde HTG nul.
- MFA admin, lecture de la liste des comptes, suspension et réactivation d'un compte de test avec motif et audit.
- Un utilisateur non-admin ne peut pas appeler les fonctions d'administration.
- Une session MFA expirée n'autorise plus les actions sensibles.
- Toutes les erreurs renvoient des messages sûrs, sans SQL interne ni secrets.

Exécuter le CI avec `npm run check`, `npm test`, `npm run test:postgres` sur une base jetable, puis `npm run build`.

## 9. Conditions avant déploiement sur le Worker public

- CI vert sur le commit exact à déployer.
- Migrations 0001–0003 testées sur un PostgreSQL staging isolé.
- Rôle runtime et droits vérifiés ; sauvegarde/restauration démontrée.
- Hyperdrive, Firebase, secrets et domaine configurés dans l'environnement cible.
- QA navigateur Android/tablette/desktop et revue de sécurité terminées.
- Procédure de rollback validée.

**Au moment de ce document, ces conditions ne sont pas toutes remplies.** La base dédiée n'est pas provisionnée, Hyperdrive et les secrets ne sont pas configurés, et les tests intégrés avec de vrais comptes Firebase/Cloudflare restent à faire. Ne pas déployer la branche directement sur le Worker public.

## 10. Garde-fous produit et conformité

Les verrous doivent rester actifs :
- aucun jeu ou pari Production;
- aucun dépôt ou retrait;
- aucun paiement MonCash/NatCash;
- aucun solde converti depuis les anciens points Firestore.

Les fiches mathématiques/RTP des 22 jeux, les validations légales, la conformité âge/KYC/AML et les contrats fournisseurs doivent être approuvés séparément avant toute activation. Le code ne constitue pas une licence ni une autorisation réglementaire.

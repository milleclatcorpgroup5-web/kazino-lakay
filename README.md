# Kazino Lakay V2.0.0 — Production en préparation

Cette branche contient le code **Production V2** de Kazino Lakay. Elle n'est pas encore déployée sur le Worker public. Elle utilise Firebase Authentication pour l'identité, PostgreSQL pour les données Production et Cloudflare Worker + Static Assets + Hyperdrive pour l'exécution.

> **Important :** l'ancien moteur V1.9 points-only/Firestore existe encore dans le dépôt comme code historique et tests de régression. Il ne doit pas être utilisé comme moteur de jeu ou système de portefeuille pour Production V2.

## Architecture Production

- **Cloudflare Worker + Static Assets :** interface web, routes API et contrôles d'accès.
- **Firebase Authentication :** inscription, connexion et vérification de l'adresse e-mail.
- **PostgreSQL dédié à Kazino Lakay :** comptes, rôles, ledger, audit, MFA et registre des 22 jeux.
- **Cloudflare Hyperdrive :** liaison privée entre le Worker et PostgreSQL.

La base PostgreSQL n'est pas encore provisionnée. Les migrations, le rôle runtime, Hyperdrive et les secrets doivent être testés sur un environnement staging dédié avant tout déploiement.

## Accès de l'application

- Joueurs : `/`
- Administration : `/admin`
- État du service : `/api/health`
- Catalogue : `/api/games`

En Production V2, les 22 jeux apparaissent uniquement comme catalogue : ils restent tous désactivés (`phase_4_pending`). Les demandes de jeu sont refusées avec HTTP 423.

## Build et tests

Node.js `>=24.12.0` est requis.

```bash
npm install
npm run check
npm test
npm run test:postgres
npm run build
```

`npm run test:postgres` exige une base PostgreSQL jetable de CI ou de test via `TEST_DATABASE_URL`. Ne pas utiliser une base Production pour les tests.

## Déploiement

Le projet Production n'est pas un déploiement Pages statique autonome. Il utilise le Worker configuré dans `worker/wrangler.toml`, avec les assets Vite dans `dist`.

Consulter [DEPLOY-PRODUCTION-V2-HA.md](./DEPLOY-PRODUCTION-V2-HA.md) et [database/README-SETUP-HA.md](./database/README-SETUP-HA.md). Ne pas suivre l'ancien guide `DEPLOY-HA.md` pour installer V2 : ce guide décrit la branche V1.9 Firestore.

## Sécurité — les verrouillages doivent rester actifs

- `APP_MODE=production`
- `DEMO_ENABLED=false`
- `PAYMENTS_ENABLED=false`
- `REAL_MONEY_GAMES_ENABLED=false`
- Aucun crédit de points de démonstration dans les comptes PostgreSQL.
- Aucune conversion des anciens points Firestore.
- Aucun dépôt, retrait ou paiement MonCash/NatCash.
- Aucun jeu ou pari activé avant validation mathématique, sécurité, conformité et autorisation distincte.

## Faz 4–6

- Plan de travail : [PHASE-4-6-ROADMAP-HA.md](./PHASE-4-6-ROADMAP-HA.md).
- Odit matematik : [PRODUCTION-PHASE-4-MATH-AUDIT-HA.md](./PRODUCTION-PHASE-4-MATH-AUDIT-HA.md).

Le rapport mathématique analyse l'ancien moteur V1.9 à titre de diagnostic uniquement. Il ne définit pas et n'approuve aucun paytable Production. Les RTP Production restent à calculer et à approuver.

## État actuel

- Production V2 est en préparation sur la branche `codex/kazino-v2.0.0-production-phase-4-6`.
- Le workflow CI couvre les tests JavaScript, les trois migrations PostgreSQL et le build Vite.
- PostgreSQL, Hyperdrive, les secrets Cloudflare et les tests staging Firebase/Worker ne sont pas encore configurés.
- Aucun changement de cette branche n'a été déployé sur le Worker public.

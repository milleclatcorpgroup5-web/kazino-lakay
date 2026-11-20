# Kazino Lakay V2 — Plan d'exécution des phases 4 à 6

> Document de cadrage. La phase 4 est explicitement annoncée dans les documents de la phase 1–3. Les phases 5 et 6 n'étaient pas encore définies dans le dépôt ; leur périmètre ci-dessous est une proposition structurée pour terminer le produit sans ouvrir prématurément les jeux ni les paiements.

## Règles non négociables pendant les trois phases

- `APP_MODE=production`, `DEMO_ENABLED=false`, `PAYMENTS_ENABLED=false` et `REAL_MONEY_GAMES_ENABLED=false`.
- Les 22 jeux restent `is_enabled=false`. Aucun pari, crédit de démonstration, dépôt, retrait ou mouvement de valeur monétaire n'est activé.
- Ne jamais importer ou convertir les anciens points Firestore en solde PostgreSQL.
- Le Worker ne reçoit jamais le mot de passe propriétaire de la base. L'accès runtime doit rester limité par rôle.
- Les tests de base de données utilisent une base jetable de CI ou une base de staging isolée, jamais une base de production.
- Les visuels 3D, portraits, logos, voix et animations externes ne sont utilisés que si les droits sont documentés. Les SVG actuels ne sont pas présentés comme de la 3D photoréaliste.

## Phase 4 — Moteurs de jeu, mathématiques et équité

### Objectif
Préparer et vérifier les règles des 22 jeux avant toute activation. Cette phase ne doit pas rendre les jeux jouables en production.

### Travaux
1. Établir un registre unique des 22 identifiants, noms, catégories, versions de règles et schémas d'entrée/sortie. Éviter que le catalogue frontend, le Worker et PostgreSQL divergent.
2. Écrire une fiche de règles par jeu : choix acceptés, validation des limites, déroulement, conditions de victoire/perte/égalité, calcul du retour brut, arrondis, mise minimale/maximale proposée et hypothèses de volatilité.
3. Calculer le RTP théorique et la distribution des gains pour chaque jeu. Utiliser des calculs exacts lorsque c'est possible ; documenter les hypothèses et les marges d'erreur des simulations Monte-Carlo lorsqu'elles sont nécessaires. Aucun RTP ne doit être inventé ou affiché avant validation.
4. Séparer l'ancien moteur points-only du futur moteur de production. Le moteur de production doit utiliser une source d'aléa cryptographiquement sûre côté serveur, valider les paramètres côté serveur et versionner chaque résultat.
5. Concevoir un protocole d'équité vérifiable (engagement cryptographique avant le résultat, preuve/révélation après le tour et rotation sûre des graines). Ne pas prétendre qu'un jeu est « provably fair » avant que les tests et la vérification indépendante le démontrent.
6. Préparer le règlement atomique : création du tour, réservation/contrôle des fonds, écritures double-entry, résultat et idempotency dans une transaction cohérente. Le rôle moteur doit être distinct du rôle Worker général et ne doit pas pouvoir modifier l'historique du ledger.
7. Ajouter des tests de propriétés, limites, répétitions, collisions, entrées malformées, idempotence, équilibrage du ledger, solde négatif interdit et reprise après erreur. Les tests statistiques doivent avoir des seuils tolérants et reproductibles, pas des assertions aléatoires fragiles.

### Critères de sortie
- Les 22 jeux ont une fiche de règles/version et des calculs RTP documentés.
- Les identifiants et schémas sont cohérents entre UI, API et base de données.
- Les tests unitaires, propriétés et simulations sont passés dans CI.
- Les tests de règlement PostgreSQL passent sur une base jetable.
- Aucun endpoint public ne permet de jouer ou de régler des tours ; tous les jeux restent désactivés.

## Phase 5 — Opérations joueurs et administration

### Objectif
Faire de l'espace joueur et du centre d'administration des outils réellement exploitables, traçables et contrôlés, sans donner à l'application des privilèges excessifs.

### Travaux
1. Compléter la fiche joueur : recherche, pagination, détails du compte, dates, statut de vérification, statut du compte, rôles et événements de sécurité pertinents.
2. Ajouter les actions de gestion de compte strictement autorisées : suspendre/réactiver, motif obligatoire, confirmation explicite, journal d'audit et prévention de l'auto-attribution de privilèges.
3. Garder l'attribution/révocation des rôles privilégiés hors du Worker runtime. Documenter une procédure sécurisée et testable pour le premier administrateur et la récupération d'accès.
4. Ajouter une file de revue pour KYC/âge et les alertes anti-fraude : filtres, états, responsable, motif de décision et historique. Tant qu'aucun fournisseur vérifié n'est connecté, les statuts restent bloquants.
5. Renforcer MFA et les sessions administrateur : expiration, limitation des tentatives, révocation, journalisation et tests d'accès par rôle. La MFA TOTP actuelle ne remplace pas le futur OTP de vérification client.
6. Donner à chaque rôle uniquement les écrans et endpoints nécessaires. Tester les refus 401/403/423, notamment pour finance, support, compliance, auditor et admin.
7. Améliorer l'espace joueur : état du compte, statut de vérification, préférences de sécurité, limites responsables et auto-exclusion avec confirmation et erreurs compréhensibles.

### Critères de sortie
- Les actions d'administration sont protégées par rôle et MFA, auditées et testées.
- Aucun endpoint runtime ne peut s'accorder lui-même un rôle privilégié.
- Les comptes suspendus, non vérifiés ou exclus ne peuvent pas contourner les contrôles.
- Les workflows KYC/âge restent bloqués si le fournisseur ou sa signature n'est pas vérifié.
- Aucun outil d'administration ne peut activer les paiements ou les jeux par inadvertance.

## Phase 6 — Expérience, intégrations et préparation au lancement contrôlé

### Objectif
Stabiliser l'expérience mobile/tablette, les intégrations et l'exploitation. Cette phase prépare un environnement de staging et un dossier de lancement ; elle n'autorise pas un lancement en argent réel.

### Travaux
1. Uniformiser les parcours mobiles et tablette : accueil, inscription, connexion, profil, bous/solde, historique, paramètres, messages d'erreur, chargement, mode maintenance et accessibilité clavier/lecteur d'écran.
2. Décliner la direction artistique de chaque jeu avec des ressources optimisées pour mobile (formats compressés, chargement différé, fallback léger). Produire les modèles 3D/mocap uniquement avec des ressources originales ou correctement licenciées.
3. Compléter les intégrations externes nécessaires : vérification d'âge/KYC, livraison OTP SMS/e-mail, notifications et support. Chaque callback doit être signé, idempotent, journalisé et protégé contre le rejeu.
4. Préparer le déploiement Worker + Static Assets + Hyperdrive, la configuration Firebase Authentication, les secrets séparés, les environnements staging/production et la stratégie de retour arrière.
5. Ajouter observabilité et exploitation : journaux structurés sans données sensibles, métriques de latence/erreur, alertes, sauvegardes PostgreSQL, test de restauration, rotation des secrets et procédure d'incident.
6. Réaliser une QA complète sur Android, tablette et desktop : tests de navigation, réseau lent, sessions expirées, refresh, PWA, cache, erreurs API, permissions et régression.
7. Faire une revue sécurité indépendante et une revue juridique/conformité correspondant aux pays desservis. Les licences, l'âge minimum, le KYC/AML et les contrats de paiement sont des prérequis externes, pas des cases que le code peut déclarer comme acquises.

### Critères de sortie
- Build, tests automatisés, migrations et déploiement staging sont verts.
- Sauvegarde et restauration sont démontrées ; rollback documenté et essayé.
- Les parcours clés sont vérifiés sur les appareils ciblés et réseau lent.
- Les intégrations externes ont passé leurs tests de signature, rejeu, erreurs et indisponibilité.
- Revue sécurité et conformité documentées.
- Les flags de paiement et de jeux d'argent restent à `false` jusqu'à approbations formelles distinctes.

## Dépendances et ordre recommandé

1. **Avant la base Supabase :** terminer le cadrage des règles, les tests sans base réelle, les contrats API, les rôles et la revue des migrations.
2. **Avec une base Supabase de staging dédiée :** appliquer les migrations dans l'ordre, tester les privilèges runtime, les transactions et les contrôles du registre.
3. **Après Hyperdrive et secrets :** exécuter les tests intégrés Worker/Firebase/PostgreSQL, puis les parcours admin et joueurs.
4. **Avant toute mise en production :** terminer la QA, les audits, les preuves de restauration et les validations légales/fournisseurs.

## État vérifié au cadrage

- Les documents du dépôt décrivent les phases 1–3 et indiquent que la phase 4 doit couvrir les tests statistiques/paytables des 22 jeux.
- La migration 0002 prépare le registre des 22 jeux, mais les marque tous désactivés avec `release_phase='phase_4_pending'`.
- La base PostgreSQL, les migrations en environnement staging et le binding Hyperdrive ne sont pas encore configurés.
- Les écrans actuels de production sont une base d'interface ; les opérations complètes de gestion des joueurs et les intégrations KYC/OTP ne sont pas achevées.
- Ce document planifie les phases 4–6 ; il ne signifie pas que ces critères sont déjà satisfaits.


## Suivi du travail sur la branche Production

Les changements ci-dessous sont une première tranche de réalisation et non une validation complète des phases :

- **Phase 4 — démarrage réalisé :** l'API Production expose les 22 jeux du catalogue avec `enabled=false` et `releasePhase=phase_4_pending`. Les tests vérifient les 22 identifiants uniques et l'impossibilité de lancer les endpoints de jeu. Les fiches mathématiques, calculs RTP, simulations statistiques, protocole d'équité et moteur de règlement restent à réaliser.
- **Phase 5 — première fonction livrée sur la branche :** migration `0003_admin_account_controls.sql`, endpoint réservé au rôle `admin` et à une session MFA valide pour suspendre/réactiver un compte joueur, motif obligatoire, blocage des comptes privilégiés, idempotence et journal d'audit. L'interface Admin affiche les contrôles correspondants. La liste reste limitée aux 100 comptes les plus récents.
- **Phase 6 — démarrage QA :** le workflow CI couvre la branche Production, les contrôles de syntaxe, les tests applicatifs, les trois migrations PostgreSQL et le build frontend. La QA mobile/tablette, les tests Cloudflare Worker/Hyperdrive/Firebase en staging, les fournisseurs KYC/OTP, la supervision et la restauration restent à faire.

La migration 0003 doit être appliquée après 0001 et 0002 dans une base PostgreSQL de test/staging. Les droits supplémentaires du rôle runtime sont documentés dans `database/README-SETUP-HA.md`. Ne pas appliquer cette migration à une base réelle avant validation du pipeline et sauvegarde.

### Audit matematik Production — 20 novanm 2026

- Rapò kalkil yo: [PRODUCTION-PHASE-4-MATH-AUDIT-HA.md](./PRODUCTION-PHASE-4-MATH-AUDIT-HA.md).
- Li montre ansyen tablo pwen V1.9 yo gen RTP ki depase 100% pou plizyè chwa, ansanm ak lòt ki twò ba. Yo rete dyagnostik; yo pa antre nan Production.
- Tès repwodiktib `worker/test-production-math-audit.mjs` verifye fòmil kle yo nan CI.
- Pa gen RTP Production ki apwouve. Tout jwèt rete bloke.

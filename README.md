# Kazino Lakay V1.4.0 — 17 jwèt nan ekran plen

Game Center mobile-first pou 17 jwèt demonstrasyon ak pwen ki pa gen valè lajan. Stack la rete Vite + Firebase Authentication + Cloudflare Worker + Firestore REST via service-account IAM.

## 17 jwèt yo

Vòl Eksprès, Slots — Fwi an Lò, Roulèt Royal, Blackjack 21, Baccarat Lakay, Keno 20, Dice — De Chans, Mines — Min Lakay, Plinko Drop, Penalty Lakay, Coin Flip, Limbo, Hi-Lo, Scratch Cards, Wheel of Fortune, Sic Bo ak Casino War. Chak jwèt gen yon tab vizyèl espesyal ak rezilta ki mache ak done backend jwèt la.

## Nouvo eksperyans jwèt V1.4.0

- Tout 17 jwèt yo louvri dirèkteman nan yon ekran plen, san yon fich entèmedyè.
- Chak jwèt gen kontwòl ki koresponn ak règ li: chwa direksyon, kat, zo, nimewo, objektif miltiplikatè oswa tablo seleksyon.
- Jeton yo se 10, 50, 100 oswa 500 pwen; pa gen chan tèks pou antre miz.
- Objektif, etap jwèt ak retou posib yo parèt sèlman nan meni ☰ la.
- Rezilta a parèt nan yon overlay apre animasyon tab jwèt la; son kapab aktive/dezaktive.
- Ikon jwèt yo se ilistrasyon SVG olye emoji sou kat koleksyon an.
- Roulèt Royal kenbe pwòp tab Ewopeyen 37 pòch li, ak parye nimewo, koulè ak pè/enpè.
- Layout la adapte ak telefòn/tablet, portrait ak landscape, epi respekte safe areas.

## Modes

- DEMO (`POST /api/games/demo`): piblik, rezilta kalkile sou Worker, pa gen login, pa gen Firestore write, pa gen balans sove.
- Account (`POST /api/games/play`): Firebase auth verified, balans ak istwa anrejistre pa Worker sèlman.

## Admin

`/admin.html`. Aksè sèlman pou imel verified ki nan `INITIAL_ADMIN_EMAILS`. API admin pèmèt summary, lis users/rounds/audit, suspend/activate ak ajisteman pwen demo; chanjman yo antre nan audit.

## PWA

Manifest `/manifest.webmanifest`, service worker `/sw.js`, ikon `/icons/icon-192.png` ak `/icons/icon-512.png`. API pa janm mete nan cache offline.

## Dev ak verifikasyon

```bash
npm install
npm run check
npm test
npm run build
```

Tès motè Worker yo kouvri 17 jwèt yo (100 rezilta pa jwèt), endpoint DEMO yo ak validasyon yo. `npm run build` mande enstalasyon depandans Vite yo anvan. Gade `DEPLOY-HA.md` ak `CONFIGURATION-FIREBASE-HA.md` anvan deplwaman.

## Pa gen lajan reyèl

Pa gen depo, retrè, peman, MonCash/NatCash, lajan reyèl oswa konvèsyon pwen. Sa a se yon demo; pa itilize pou parye lajan.


## Version 1.8.0 — 3D + mode défi difficile + centre de contrôle

- Correction du fichier `worker/test-engine.mjs` qui était tronqué et empêchait la compilation.
- Correction et validation des chemins d'icônes `public/icones/`.
- Ajout d'une présentation 3D CSS commune aux scènes de jeu (perspective, profondeur, cartes, dés, plateaux et éléments interactifs).
- Préréglages plus difficiles pour les jeux qui proposent des paramètres de risque/difficulté.
- Le tableau de bord administrateur regroupe les derniers tours et les dernières actions d'administration dans un flux d'activité.
- Les indicateurs de l'administration distinguent les données échantillonnées des archives complètes.
- Mode points de démonstration uniquement : aucune valeur monétaire, aucun dépôt/retrait réel.

### Vérifications réalisées
- Vérification syntaxique Node.js des fichiers JavaScript.
- 22 jeux × 100 simulations côté moteur.
- Vérification des routes API de démonstration, de santé, de catalogue et de protection de l'administration.
- Vérification du manifeste PWA et des deux icônes.

# Kazino Lakay V1.4.0 — eksperyans plen ekran pou 17 jwèt yo

Patch sa a aplike sou vèsyon V1.3.1 ki te deja gen jwèt yo, Worker la, Firebase, admin ak Roulèt Royal. Li mete menm nivo prezantasyon ak estrikti ekran plen sou 16 lòt jwèt yo, epi li konsève tab espesyal Roulèt Royal la.

## Aplike patch la

1. Fè yon backup repository aktyèl la.
2. Ouvri ZIP patch la epi antre nan `kazino-lakay-v1/`.
3. Kopi fichye ki nan `PATCH-FILES-V1.4.0.txt` yo nan menm chemen yo nan repository la.
4. Ranplase sèlman fichye ki nan seksyon REPLACE la. Pa efase ni ranplase lòt fichye yo.
5. Kouri `npm install`, `npm run check`, `npm test`, epi `npm run build`.
6. Apre verifikasyon yo, pibliye frontend la. Worker/Firebase pa bezwen chanje pou entèfas V1.4.0 la.

## Sa ki chanje

- Tout 17 jwèt yo louvri dirèkteman nan ekran plen.
- Chak jwèt gen kontwòl espesyal selon kalite jwèt la. Keno mande 5 nimewo; Mines pèmèt 1–5 kare; jwèt kat/zo yo gen ekspozisyon espesifik.
- Jeton 10/50/100/500, meni règ, son, bouton retounen ak overlay rezilta.
- Ilistrasyon SVG pou 16 kat jwèt yo; Roulèt Royal kontinye sèvi ak SVG wou pa li.
- Animasyon rezilta yo rete vizyèl; backend la toujou sèl sous ki detèmine rezilta.

## Fichye ki dwe ranplase

Gade lis konplè nan `PATCH-FILES-V1.4.0.txt`. Patch sa a pa mande chanjman nan `worker/src/index.js`, Firebase rules, sekrè, admin, ni `worker/wrangler.toml`.

## Limit verifikasyon

Nan anviwònman preparasyon an, `node --check` sou fichye JavaScript yo ak `npm test` pase. `npm run build` pa t ka kouri san enstalasyon depandans NPM/Vite yo; verifye li nan anviwònman pwojè a anvan deplwaman. Nou pa t pibliye anyen sou Cloudflare.

## Pwen demonstrasyon sèlman

Pa gen lajan reyèl, depo, retrè, peman, transfè, MonCash oswa NatCash. DEMO pa modifye balans kont.

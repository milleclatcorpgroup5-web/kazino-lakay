# Kazino Lakay — Odit matematik Faz 4 pou 22 jwèt yo

**Dimansyon enpòtan:** rapò sa a analize ansyen fonksyon motè pwen V1.9 ki nan `worker/src/index.js` kòm materyèl dyagnostik sèlman. Li pa reprezante paytable Production, li pa otorize jwèt, li pa sèvi kòm sous rezilta Production. Nan V2 Production, `GET /api/games` se katalòg sèlman; tout 22 jwèt rete dezaktive epi `POST /api/games/demo` / `POST /api/games/play` rete bloke ak HTTP 423.

## Rezime

Odit la montre ansyen tablo retou yo pa konsistan: gen kèk ki depase 100% RTP (sa ka fè platfòm la pèdi matematikman), lòt yo desann anpil anba 95% (sa fè avantaj platfòm la twò gwo). Gen kèk jwèt ki pa gen ase enfòmasyon pou bay yon RTP serye san yon kalkil egzak oswa yon simulation repwodiktib.

**RTP = valè retou brit espere / total miz.** Pa egzanp, 95% RTP vle di yon retou brit mwayèn 0.95 pou chak 1.00 miz sou yon kantite wonn trè gwo; sa pa garanti rezilta yon jwè endividyèl.

## Rezilta pwovizwa ki ka kalkile dirèkteman

Tout pousantaj ki anba yo soti nan règ ak valè ansyen motè V1.9 la. Kalkil yo itilize pwobabilite matematik tablo a, pa yon echantiyon simulation. Pou Crash ak Limbo, gen wonn/redondè ki fè kèk valè apwoksimatif.

| Jwèt / paramèt ansyen motè a | RTP estime | Konklizyon |
|---|---:|---|
| Crash — risk low, objektif 1.2× | 108.22% | Depase 100% |
| Crash — risk low, objektif 1.5× / 2× / 3× / 5× | 123.65% / 145.65% / 174.06% / 176.04% | Depase 100% anpil |
| Crash — risk normal, objektif 1.2× / 1.5× / 2× / 3× / 5× | 99.53% / 110.13% / 125.88% / 145.15% / 140.78% | Pifò depase 100% |
| Crash — risk high, objektif 1.2× / 1.5× / 2× / 3× / 5× | 89.68% / 96.48% / 107.58% / 120.64% / 113.39% | Melanje; pa akseptab san revizyon |
| Slots — low | 120.00% | Platfòm nan ta gen RTP pozitif pou jwè |
| Slots — normal | 78.70% | Retou twò ba |
| Slots — high | 14.84% | Retou ekstrèmman ba |
| Roulèt Ewopeyen (37 pòch, miz wouj/nwa oswa nimewo) | 97.30% | 2.70% avantaj teorik platfòm |
| Keno — 5 boul tire | 70.82% | Retou ba |
| Keno — 10 boul tire | 37.94% | Retou ekstrèmman ba |
| Keno — 15 boul tire | 56.26% | Retou ba |
| Dice — over7 / under7 | 100.00% | Pa gen avantaj matematik |
| Dice — egzak 6 oswa 8 | 94.44% | 5.56% avantaj platfòm |
| Dice — egzak 7 / 9 / 10 / 11 | 100.00% | Pa gen avantaj matematik |
| Mines — 1 min, 1 kare chwazi | 98.20% | Menm fòmil la bese RTP lè kantite kare/min monte |
| Plinko — 6 liy, low / normal / high | 100.63% / 88.13% / 85.94% | Low depase 100%; lòt yo pi ba |
| Plinko — 8 liy, low / normal / high | 99.06% / 83.20% / 69.38% | Diferans twò laj ant risk yo |
| Penalty — gadyen easy / normal / hard | 88.89% / 77.78% / 66.67% | Chans ak retou pa balanse |
| Coin Flip — 1, 3 oswa 5 lansman, majorite genyen | 95.00% | 5% avantaj teyorik si règ yo rete menm |
| Limbo — objektif 1.1× / 1.5× / 2× / 5× / 10× / 20× | anviwon 100.46% / 100.33% / 100.25% / 100.10% / 100.05% / 100.03% | Redondans ak limit rezilta yo bay twòp retou |
| Scratch — low / normal / high | 113.33% / 61.11% / 18.75% | Tablo retou pa ekilibre |
| Wheel — low / normal / high | 100.00% / 112.50% / 110.00% | Nivo normal/high depase 100% |
| Sic Bo — small / big / even / odd | 92.36% | 7.64% avantaj teyorik platfòm |
| Sic Bo — triple | 69.44% | Retou triple twò ba |
| Casino War — chwa player/banker, egalite remèt miz la | 100.00% | Pa gen avantaj matematik sou paryaj direksyonèl |
| Casino War — paryaj tie 8× brit | 47.06% | Retou ekstrèmman ba |
| Dragon Tiger — chwa dragon/tiger | 94.12% | 5.88% avantaj sou paryaj direksyonèl |
| Dragon Tiger — paryaj tie 8× brit | 47.06% | Retou ekstrèmman ba |

### Metòd kalkil prensipal yo

- **Keno:** distribisyon ipèjeyometrik egzak `P(k hits) = C(5,k) × C(20,draws-k) / C(25,draws)`; RTP a se sòm pwobabilite chak kantite hits miltipliye pa retou brit li.
- **Plinko:** chemen L/R endepandan bay distribisyon binomyal `C(rows,k)/2^rows`; RTP se mwayèn pondéré miltiplikatè pòch yo.
- **Mines:** chans pou siviv se `Π[(25-mines-i)/(25-i)]` pou chak kare chwazi; ansyen miltiplikatè a sèvi ak `(25/(25-mines))^n × (1 - 0.018n)`, ki pa konpanse chans egzak la epi li fè RTP la chanje anpil selon risk.
- **Roulette:** pou yon pari 1 nimewo oswa wouj/nwa sou 37 pòch, retou brit 36× oswa 2× bay `36/37 = 97.2973%`.
- **Dice/Sic Bo:** kantite konbinezon zo yo konte sou 36 oswa 216 rezilta egalman posib.
- **Slots/Scratch:** tout triplet senbòl òdone yo gen menm chans; retou brit yo konte pou triplet, pè, ak tout lòt konbinezon.

## Jwèt ki bezwen kalkil adisyonèl anvan nenpòt paytable Production

| Jwèt | Sa ki bezwen verifye |
|---|---|
| Blackjack | Kalkile tout estrateji `standAt`, dealer soft-17, blackjack natirèl 3:2, pouse, ak limit 6 kat; pwodui RTP pa estrateji. |
| Baccarat | Motè aktyèl la sèvi ak yon pil 52 kat; valide règ twazyèm kat, kantite pil ki dwe itilize, komisyon bankye ak tretman egalite. |
| Hi-Lo | Nan ansyen pil 52 kat la, pwobabilite kat kap vini an pi wo/pi ba se 47.0588%; 1.9× bay 89.41% RTP, men 2.4× bay 112.94%. Egalite 12× bay 70.59%. |
| Andar Bahar | Kalkile pwobabilite premye matche a selon bò ki kòmanse, konpozisyon pil la ak kantite kat ki rete. |
| Poker 3 Kat | Valide klasman men yo, règ egalite, frekans tie ak retou brit; yon paryaj direksyonèl ak push sou tie ka rete 100% san yon frè. |
| Texas Hold’em | Verifye klasman 7 kat yo, konparezon men, frekans egalite, epi paytable separe pou chwa player/banker/tie. |
| Bingo | Kalkile pwobabilite yon liy/kolòn/dyagonal/kat kwen konplete sou 35 boul, enkli kare gratis ak sipèpozisyon modèl yo. |

## Desizyon pou Production

1. **Pa kopye paytable V1.9 la nan Production.** Li gen RTP ki depase 100% ansanm ak lòt RTP ki pa rezonab.
2. Fikse yon objektif RTP pou chak jwèt sèlman apre revizyon komèsyal, legal ak risk. Pa sipoze tout jwèt dwe gen menm RTP.
3. Pou chak jwèt, konsève fich matematik vèsyone: règ, espas rezilta, pwobabilite, retou brit, RTP, house edge, volatilite, limit/arrondisman ak tès.
4. Egzekite kalkil egzak lè sa posib; pou jwèt konplèks, mete simulation Monte-Carlo ak grenn (seed) repwodiktib, entèval konfyans ak konparezon ak kalkil referans.
5. Ekri tès otomatik pou tout paytable, limit ak tranzisyon. Yon jwèt pa pase revizyon matematik si RTP li depase limit apwouve oswa si retou li pa koresponn ak paytable.
6. Fè rezilta Production yo sòti sèlman nan Worker sèvè a, ak CSPRNG, idempotency ak ledger atomik; kliyan an pa dwe kapab bay rezilta a.
7. Tout jwèt rete `enabled=false` jouk fich matematik, sekirite, QA ak apwobasyon legal chak jwèt fin aksepte.

## Eta aktyèl

- Production V2 ekspoze 22 jwèt kòm katalòg sèlman.
- Tout 22 jwèt yo rete `phase_4_pending`, san endpoint jwèt aktif.
- Rapò sa a pa chanje motè V1.9, pa pibliye jwèt, pa kreye pari, epi pa manyen okenn balans.
- Pa gen jwèt Production ki gen RTP apwouve nan moman sa a.

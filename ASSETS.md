# ASSETS.md — "Il Mondo di 5"

Manifest condiviso tra Claude Code e Gemini. Segue la convenzione in `asset-naming-convention.md` (categoria-nome-variante@dimensione.ext).

Cartelle:
- `public/assets/source/` — immagini appena generate, grezze
- `public/assets/` — versione finale ottimizzata usata dal gioco

Lista completa di quello che serve all'app, ricavata guardando `app.js`/`style.css`/`index.html` (cosa c'è già, cosa manca, cosa è ancora emoji/placeholder) e il design brief. Organizzata per fase: **Fase 1** ha l'impatto visivo maggiore ed è la più semplice da integrare via CSS, **Fase 2** sono rifiniture/nice-to-have, **Fase 3** è un lavoro grosso (redesign carte) da valutare a parte.

## Icone app

| Nome file | Categoria | Stato | Note prompt/stile |
|---|---|---|---|
| icon-app@192.png | icon | fatto | integrata in `index.html` (favicon/home icon), medaglione con i 4 semi napoletani attorno al 5 in oro |
| icon-app@512.png | icon | pronto | alta risoluzione, non ancora referenziata (nessun manifest.json nel progetto); disponibile per icone native Capacitor (`npx capacitor-assets`) |
| icon-app-maskable@512.png | icon | pronto | variante maskable (safe-zone per Android adaptive icon), non referenziata — serve un manifest.json o la pipeline Capacitor per usarla |
| icon-app-apple@180.png | icon | fatto | integrata in `index.html` come `apple-touch-icon` |
| icon-app-favicon@32.png | icon | fatto | integrata in `index.html` come favicon 32×32 |

## Fase 1 — impatto immediato

| Nome file | Categoria | Stato | Note prompt/stile |
|---|---|---|---|
| bg-tavolo-legno@1024.jpg | bg | fatto | integrata come `background` di `html, body` in `style.css` (sostituisce la tinta piatta `#0f5132`, tenuta come colore di fallback). Ricevuta @1376×768 (non @1024 esatto), convertita da PNG (2,3 MB) a JPEG q82 (171 KB) per il peso |
| bg-splash@2732.png | bg | fatto | splash screen Capacitor sostituita. Ricevuta @1024×1024 (non @2732 esatto): raw in `public/assets/source/`, poi generate via cover-crop (ritaglio centrato, no distorsione) tutte le varianti native — 11 file `android/app/src/main/res/drawable*/splash.png` (da 320×480 a 1920×1280) e i 3 `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732*.png` a 2732×2732. Non serve una copia in `public/assets/` — lo splash non è usato dalla pagina web, solo dalle app native |
| badge-pistacchio-4posto.png | badge | fatto | medaglione ovale bordo dorato per il 4° posto in classifica. Ricevuta @1024×1024 con largo margine scuro attorno alla cornice: raw in `public/assets/source/`, ritagliata (crop rilevato automaticamente sui bordi della cornice) e ridotta a 220×267 per l'uso in `.podiumIcon` (28px). Integrata in `app.js` (`podiumIcon()`), sostituisce e rimpiazza `pistacchio-4.png` (eliminato, non conforme alla convenzione) |
| badge-giocatore-attivo.png | badge | fatto | medaglione doppio anello dorato vuoto. Ricevuta @1024×1024: raw in `public/assets/source/`, ritagliata sull'anello e ridotta a 96×97 in `public/assets/`. Il box `.player` è una barra orizzontale stretta (non quadrata), quindi il medaglione intero non ci stava come sfondo — integrato invece come piccola icona rotonda (13px, 10px su mobile) prima del nome, via `.player.active::before` in `style.css` |
| badge-vittoria.png | badge | fatto | medaglia "CAMPIONE" con nastro verde. Ricevuta @1024×1024 su sfondo scuro pieno: raw in `public/assets/source/`, ritagliata e resa trasparente (rimozione sfondo via soglia colore/alpha, non aveva canale alpha) e ridotta a 150×190 in `public/assets/`. Sostituisce solo l'emoji 🎉 del momento GAME_OVER in `app.js` (`.trophy`/`.trophyImg` in `style.css`) — l'emoji 🏆 di fine-mano (HAND_OVER) resta invariata, nessun asset ricevuto per quella |

## Fase 2 — rifinitura icone UI e decorazioni

| Nome file | Categoria | Stato | Note prompt/stile |
|---|---|---|---|
| icon-copia.svg | icon | da generare | icona lineare stile fronde dorate, sostituisce il testo "Copia" sul bottone codice partita |
| icon-condividi.svg | icon | da generare | icona lineare condivisione, sostituisce il testo "Condividi" |
| icon-esci.svg | icon | da generare | icona lineare uscita, per i bottoni "Esci" (top bar e modali) |
| icon-regole.svg | icon | da generare | icona lineare "punto interrogativo"/libro, sostituisce l'emoji ❓ sul bottone "Come si gioca?" |
| icon-pronto.svg | icon | da generare | icona lineare spunta, sostituisce l'emoji ✅ nella lista "pronto per la prossima mano" |
| icon-in-attesa.svg | icon | da generare | icona lineare clessidra, sostituisce l'emoji ⏳ nella stessa lista |
| icon-seme-coppe.svg | icon | da generare | versione icona lineare (non piena) del seme Coppe, per il modale di scelta seme — distinta dalla grafica carta completa |
| icon-seme-denari.svg | icon | da generare | come sopra, seme Denari |
| icon-seme-spade.svg | icon | da generare | come sopra, seme Spade |
| icon-seme-bastoni.svg | icon | da generare | come sopra, seme Bastoni |
| illo-cornice-fronde.svg | illo | da generare | cornice/fregio decorativo per i modali (regole, fine partita), coerente con gli ornamenti a foglia d'oro del logo |
| illo-divisore.svg | illo | da generare | piccolo separatore decorativo tra sezioni di testo (es. nel modale regole) |
| bg-social-share@1200x630.png | bg | da generare | immagine anteprima link (og:image), utile quando si condivide il codice partita via `shareCodeBtn` — oggi non esiste nessun meta tag og:image |

## Fase 3 — carte da gioco (grosso lavoro, da valutare a parte)

| Nome file | Categoria | Stato | Note prompt/stile |
|---|---|---|---|
| card-dorso-standard.png | card | fatto | dorso carta verde/oro con simbolo 5. Ricevuta @1024×1024: raw in `public/assets/source/`, ritagliata sul bordo carta e ridotta a 180×250 in `public/assets/`. Il gioco non ha un concetto di "mazzo"/carta coperta in mano (si vede solo il conteggio carte avversari), quindi l'ho usata come filigrana (opacity 0.22) negli slot della griglia tavolo non ancora giocati (`.cardSlot::before` in `style.css`) — riempie il tavolo altrimenti vuoto a inizio mano senza sostituire nulla di funzionale. Nota tecnica: `.cardSlot` è a dimensione zero quando vuoto (`align-items:center` sul grid non stretch-a i figli), risolto centrando la filigrana su `top/left:50%` + `transform` invece di `inset%` |
| card-*.png (40 carte) | card | esistenti, stile da rivedere | le 40 carte in `public/cards/` (CP/DN/SP/BA × 2-7,A,C,F,R) sono grafica flat/clipart generica, NON nello stile "carta antica elegante" del brief — redesign completo è un lavoro grande, valutare se farlo o tenere lo stile attuale |

**Bonus ricevuto insieme alle icone (2026-08-10):** `palette-reale.css` in `public/assets/source/` — colori campionati realmente sui pixel del logo (più precisi delle stime a occhio nel design brief). Non ancora applicata a `style.css` — valutare in una sessione dedicata al refresh palette.

# 5

Base progetto riorganizzata per il gioco online **5**.

## Avvio

1. Copia `node_modules` nella cartella principale oppure esegui:

```bash
npm install
```

2. Avvia il server:

```bash
npm start
```

3. Apri il browser sull'indirizzo mostrato dal server.

## Struttura

- `server.js` – server Express + WebSocket
- `public/` – frontend del gioco
- `public/cards/` – immagini delle carte
- `public/icons/` – icone PWA
- `docs/` – documentazione progetto
- `brand/` – materiali brand
- `releases/` – pacchetti release
- `mobile/` – futura app mobile

## Nota importante

Le immagini reali delle carte non sono incluse se non erano presenti nei file caricati.
Se nel tuo progetto originale hai `public/cards`, copia il contenuto in `public/cards`.

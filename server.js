const http = require("http");
const express = require("express");
const WebSocket = require("ws");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static("public"));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

/* =========================
   STATO BASE
========================= */

let players = [];
let gameState = "WAITING"; // WAITING | PICK_SUIT | IN_GAME

let deck = [];
let table = { C: [], D: [], S: [], B: [] };

let turn = null;
let dealerIndex = null;
let chosenSuit = null;

const RECONNECT_TIME = 60000;

/* =========================
   DECK
========================= */

function createDeck() {
  const suits = ["C", "D", "S", "B"];
  const values = ["A","2","3","4","5","6","7","F","H","R"];

  let d = [];
  for (let s of suits) {
    for (let v of values) {
      d.push({ suit: s, value: v });
    }
  }

  return d.sort(() => Math.random() - 0.5);
}

function findPlayer(ws) {
  return players.find(p => p.ws === ws);
}

/* =========================
   START GAME
========================= */

function startGameSetup() {
  deck = createDeck();
  table = { C: [], D: [], S: [], B: [] };

  players.forEach(p => (p.hand = []));

  dealerIndex = Math.floor(Math.random() * 4);
  chosenSuit = null;
  turn = null;

  gameState = "PICK_SUIT";

  console.log("➡️ PICK_SUIT");
}

/* =========================
   START CHECK
========================= */

function tryStart() {
  if (gameState !== "WAITING") return;
  if (players.length !== 4) return;

  startGameSetup();
}

/* =========================
   VALID MOVE
========================= */

function isValidMove(card, suit) {
  if (table[suit].length === 0) {
    return card.value === "5";
  }

  const top = table[suit][table[suit].length - 1];

  const order = ["A","2","3","4","5","6","7","F","H","R"];

  return Math.abs(order.indexOf(card.value) - order.indexOf(top.value)) === 1;
}

/* =========================
   START PLAYER
========================= */

function findStartingPlayer() {
  for (let i = 0; i < players.length; i++) {
    if (players[i].hand?.some(c => c.value === "5" && c.suit === chosenSuit)) {
      return i;
    }
  }
  return 0;
}

/* =========================
   BROADCAST
========================= */

function broadcast() {
  players.forEach((p, i) => {
    if (p.ws.readyState !== 1) return;

    p.ws.send(JSON.stringify({
      type: "state",
      gameState,
      playersCount: players.length,
      hand: p.hand || [],
      table,
      turn,
      yourTurn: gameState === "IN_GAME" && turn === i,
      dealer: dealerIndex,
      chosenSuit
    }));
  });
}

/* =========================
   WS
========================= */

wss.on("connection", (ws) => {

  let player = findPlayer(ws);

  if (!player) {
    player = {
      ws,
      hand: [],
      status: "CONNECTED",
      disconnectTimer: null
    };
    players.push(player);
  } else {
    player.ws = ws;
    player.status = "CONNECTED";
    if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
  }

  tryStart();
  broadcast();

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    const pIndex = players.findIndex(p => p.ws === ws);
    if (pIndex === -1) return;

    const p = players[pIndex];

    /* =========================
       SCELTA SEME
    ========================= */

    if (data.type === "chooseSuit") {
      if (gameState !== "PICK_SUIT") return;
      if (pIndex !== dealerIndex) return;

      chosenSuit = data.suit;

      deck = createDeck();

      players.forEach(pl => {
        pl.hand = deck.splice(0, 10);
      });

      gameState = "IN_GAME";
      turn = findStartingPlayer();

      broadcast();
    }

    /* =========================
       GIOCA
    ========================= */

    if (data.type === "play") {
      if (gameState !== "IN_GAME") return;
      if (turn !== pIndex) return;

      const card = p.hand[data.index];
      if (!card) return;

      if (isValidMove(card, card.suit)) {
        table[card.suit].push(card);
        p.hand.splice(data.index, 1);

        turn = (turn + 1) % players.length;
      }

      broadcast();
    }

    /* =========================
       PASSO
    ========================= */

    if (data.type === "pass") {
      if (gameState !== "IN_GAME") return;
      if (turn !== pIndex) return;

      turn = (turn + 1) % players.length;

      broadcast();
    }
  });

  /* =========================
     DISCONNESSIONE
  ========================= */

  ws.on("close", () => {
    const p = findPlayer(ws);
    if (!p) return;

    p.status = "DISCONNECTED";

    p.disconnectTimer = setTimeout(() => {
      const idx = players.indexOf(p);

      if (idx !== -1 && p.status === "DISCONNECTED") {
        players.splice(idx, 1);

        if (players.length < 4) {
          gameState = "WAITING";
          turn = null;
        }
      }
    }, RECONNECT_TIME);
  });
});

server.listen(PORT, () => {
  console.log("Gioco 5 online");
});
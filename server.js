const http = require("http");
const express = require("express");
const WebSocket = require("ws");

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

/* =========================
   STATO
========================= */

let players = [];
let gameState = "WAITING";

let deck = [];
let table = { C: [], D: [], S: [], B: [] };

let dealerIndex = null;
let chosenSuit = null;
let turn = null;

/* =========================
   UTILS
========================= */

function findPlayer(ws) {
  return players.find(p => p.ws === ws);
}

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

function order(v) {
  return ["A","2","3","4","5","6","7","F","H","R"].indexOf(v);
}

/* =========================
   START GAME
========================= */

function startGame() {
  deck = createDeck();
  table = { C: [], D: [], S: [], B: [] };

  players.forEach(p => (p.hand = []));

  dealerIndex = Math.floor(Math.random() * players.length);
  chosenSuit = null;
  turn = null;

  gameState = "PICK_SUIT";
}

/* =========================
   START CHECK
========================= */

function tryStart() {
  if (players.length === 4 && gameState === "WAITING") {
    startGame();
  }
}

/* =========================
   START PLAYER
========================= */

function findStartingPlayer() {
  for (let i = 0; i < players.length; i++) {
    if (players[i].hand.some(c => c.value === "5" && c.suit === chosenSuit)) {
      return i;
    }
  }
  return 0;
}

/* =========================
   MOVE VALID
========================= */

function isValid(card, suit) {
  if (table[suit].length === 0) return card.value === "5";

  const top = table[suit][table[suit].length - 1];
  return Math.abs(order(card.value) - order(top.value)) === 1;
}

/* =========================
   BROADCAST
========================= */

function broadcast() {
  players.forEach((p, i) => {
    if (p.ws.readyState !== 1) return;

    p.ws.send(JSON.stringify({
      players: players.map(x => x.name),
      count: players.length,
      gameState,
      dealerIndex,
      chosenSuit,
      table,
      hand: p.hand,
      turn,
      yourTurn: gameState === "IN_GAME" && turn === i,
      yourIndex: i
    }));
  });
}

/* =========================
   WS
========================= */

wss.on("connection", (ws) => {

  let player = findPlayer(ws);

  if (!player) {
    player = { ws, name: null, hand: [] };
    players.push(player);
  } else {
    player.ws = ws;
  }

  tryStart();
  broadcast();

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);
    const pIndex = players.findIndex(p => p.ws === ws);

    if (data.type === "setName") {
      players[pIndex].name = data.name;
    }

    /* =========================
       CHOOSE SUIT
    ========================= */

    if (data.type === "chooseSuit") {
      if (gameState !== "PICK_SUIT") return;
      if (pIndex !== dealerIndex) return;

      chosenSuit = data.suit;

      deck = createDeck();

      players.forEach(p => {
        p.hand = deck.splice(0, 10);
      });

      gameState = "IN_GAME";
      turn = findStartingPlayer();
    }

    /* =========================
       PLAY
    ========================= */

    if (data.type === "play") {
      if (gameState !== "IN_GAME") return;
      if (turn !== pIndex) return;

      const card = players[pIndex].hand[data.index];
      if (!card) return;

      if (isValid(card, card.suit)) {
        table[card.suit].push(card);
        players[pIndex].hand.splice(data.index, 1);

        turn = (turn + 1) % players.length;
      }
    }

    /* =========================
       PASS
    ========================= */

    if (data.type === "pass") {
      if (turn === pIndex) {
        turn = (turn + 1) % players.length;
      }
    }

    broadcast();
  });

  ws.on("close", () => {
    players = players.filter(p => p.ws !== ws);

    if (players.length < 4) {
      gameState = "WAITING";
      turn = null;
    }
  });
});

server.listen(process.env.PORT || 10000, () => {
  console.log("Gioco 5 online");
});
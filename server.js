const http = require("http");
const express = require("express");
const WebSocket = require("ws");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static("public"));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let players = [];
let deck = [];
let table = {};
let turn = 0;
let gameStarted = false;
let winner = null;

// ----------------- DECK -----------------
function createDeck() {
  const suits = ["C","D","S","B"];
  const values = ["A","2","3","4","5","6","7","F","H","R"];

  let d = [];
  for (let s of suits) {
    for (let v of values) {
      d.push({ suit: s, value: v });
    }
  }
  return d.sort(() => Math.random() - 0.5);
}

// ----------------- INIT GAME -----------------
function initGame() {
  deck = createDeck();

  table = { C: [], D: [], S: [], B: [] };

  players.forEach(p => {
    p.hand = deck.splice(0, 10);
  });

  turn = 0;
  gameStarted = true;
  winner = null;
}

// ----------------- RULE CHECK -----------------
function order(v) {
  return ["A","2","3","4","5","6","7","F","H","R"].indexOf(v);
}

function isValid(card, suit) {
  if (table[suit].length === 0) {
    return card.value === "5";
  }

  const top = table[suit][table[suit].length - 1];
  return Math.abs(order(card.value) - order(top.value)) === 1;
}

// ----------------- BROADCAST -----------------
function broadcast() {
  players.forEach((p, i) => {
    if (p.ws.readyState === 1) {
      p.ws.send(JSON.stringify({
        type: "state",
        players: players.length,
        hand: p.hand,
        table,
        turn,
        yourTurn: players[turn] === p,
        winner
      }));
    }
  });
}

// ----------------- WS -----------------
wss.on("connection", (ws) => {

  const player = { ws, hand: [] };
  players.push(player);

  if (!gameStarted) initGame();

  broadcast();

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    if (winner) return;

    const p = players.find(x => x.ws === ws);

    if (data.type === "play") {
      if (players[turn] !== p) return;

      const card = p.hand[data.index];

      if (isValid(card, card.suit)) {
        table[card.suit].push(card);
        p.hand.splice(data.index, 1);

        if (p.hand.length === 0) {
          winner = players.indexOf(p) + 1;
        }

        turn = (turn + 1) % players.length;
      }

      broadcast();
    }

    if (data.type === "pass") {
      if (players[turn] === p) {
        turn = (turn + 1) % players.length;
        broadcast();
      }
    }
  });

  ws.on("close", () => {
    players = players.filter(p => p.ws !== ws);
  });
});

server.listen(PORT, () => {
  console.log("Gioco 5 online");
});
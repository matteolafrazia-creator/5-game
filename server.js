const http = require("http");
const express = require("express");
const WebSocket = require("ws");

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let players = [];
let gameState = "WAITING";

let dealerIndex = 0;
let turn = null;

function findPlayer(ws) {
  return players.find(p => p.ws === ws);
}

function broadcast() {
  players.forEach((p, i) => {
    if (p.ws.readyState !== 1) return;

    p.ws.send(JSON.stringify({
      players: players.map(x => x.name || "Anon"),
      count: players.length,
      gameState,
      dealerIndex,
      turn,
      yourIndex: i,
      yourTurn: turn === i
    }));
  });
}

function tryStart() {
  if (players.length === 4 && gameState === "WAITING") {
    gameState = "IN_GAME";
    turn = 0;
  }
}

wss.on("connection", (ws) => {

  let player = findPlayer(ws);

  if (!player) {
    player = { ws, name: null };
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
    broadcast();
  });
});

server.listen(process.env.PORT || 10000, () => {
  console.log("server online");
});
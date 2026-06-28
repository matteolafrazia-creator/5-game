const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Gioco 5 ONLINE");
});

const wss = new WebSocket.Server({ server });

let players = [];
let gameStarted = false;
let deck = [];

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

function broadcast(msg) {
  players.forEach(p => {
    if (p.ws.readyState === 1) {
      p.ws.send(JSON.stringify(msg));
    }
  });
}

function startGame() {
  gameStarted = true;
  deck = createDeck();

  players.forEach(p => {
    p.hand = deck.splice(0, 10);
    p.ws.send(JSON.stringify({
      type: "hand",
      hand: p.hand
    }));
  });

  broadcast({
    type: "game_started",
    players: players.length
  });
}

wss.on("connection", (ws) => {
  const player = {
    id: Date.now(),
    ws,
    hand: []
  };

  players.push(player);

  ws.send(JSON.stringify({
    type: "welcome",
    id: player.id,
    players: players.length
  }));

  broadcast({
    type: "players",
    count: players.length
  });

  // avvio automatico quando siete almeno 2 (per test)
  if (players.length >= 2 && !gameStarted) {
    startGame();
  }

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    if (data.type === "test") {
      broadcast({ type: "log", msg: "test ricevuto" });
    }
  });

  ws.on("close", () => {
    players = players.filter(p => p.ws !== ws);

    broadcast({
      type: "players",
      count: players.length
    });
  });
});

server.listen(PORT, () => {
  console.log("Gioco 5 online su " + PORT);
});
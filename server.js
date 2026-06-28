const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;

// ---------------- HTTP + CLIENT ----------------
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>Gioco 5</title>
  <style>
    body { font-family: Arial; padding: 20px; }
    .card { display:inline-block; padding:10px; margin:5px; border:1px solid #000; }
    .table { margin-top:20px; }
  </style>
</head>
<body>

<h2>Gioco 5</h2>
<div id="status">Connessione...</div>

<h3>Carte in mano</h3>
<div id="hand"></div>

<h3>Tavolo</h3>
<pre id="table"></pre>

<script>
const ws = new WebSocket(location.origin.replace("http", "ws"));

ws.onopen = () => {
  document.getElementById("status").innerText = "Connesso";
};

ws.onmessage = (msg) => {
  const data = JSON.parse(msg.data);

  if (data.type === "welcome") {
    document.getElementById("status").innerText =
      "Giocatori online: " + data.players;
  }

  if (data.type === "hand") {
    const handDiv = document.getElementById("hand");
    handDiv.innerHTML = "";

    data.hand.forEach(c => {
      const div = document.createElement("div");
      div.className = "card";
      div.innerText = c.value + " " + c.suit;
      handDiv.appendChild(div);
    });
  }

  if (data.type === "table") {
    document.getElementById("table").innerText =
      JSON.stringify(data.table, null, 2);
  }
};
</script>

</body>
</html>
  `);
});

// ---------------- GAME ----------------
const wss = new WebSocket.Server({ server });

let players = [];
let deck = [];
let gameStarted = false;

let table = {
  C: [],
  D: [],
  S: [],
  B: []
};

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

function broadcast(data) {
  players.forEach(p => {
    if (p.ws.readyState === 1) {
      p.ws.send(JSON.stringify(data));
    }
  });
}

function startGame() {
  gameStarted = true;
  deck = createDeck();

  // assegna mani
  players.forEach(p => {
    p.hand = deck.splice(0, 10);

    p.ws.send(JSON.stringify({
      type: "hand",
      hand: p.hand
    }));
  });

  // tavolo iniziale: tutti i 5
  table = {
    C: [{ value: "5", suit: "C" }],
    D: [{ value: "5", suit: "D" }],
    S: [{ value: "5", suit: "S" }],
    B: [{ value: "5", suit: "B" }]
  };

  broadcast({
    type: "table",
    table
  });

  console.log("Partita avviata");
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
    players: players.length
  }));

  ws.send(JSON.stringify({
    type: "table",
    table
  }));

  // start automatico per test (1 giocatore basta)
  setTimeout(() => {
    if (!gameStarted && players.length > 0) {
      startGame();
    }
  }, 1000);

  ws.on("close", () => {
    players = players.filter(p => p.ws !== ws);
  });
});

// ---------------- START ----------------
server.listen(PORT, () => {
  console.log("Gioco 5 online su " + PORT);
});
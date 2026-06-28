const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;

// ---------------- HTTP CLIENT ----------------
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

  if (data.type === "state") {
    document.getElementById("status").innerText =
      "Giocatori: " + data.players;

    document.getElementById("table").innerText =
      JSON.stringify(data.table, null, 2);

    const handDiv = document.getElementById("hand");
    handDiv.innerHTML = "";

    data.hand.forEach(c => {
      const div = document.createElement("div");
      div.className = "card";
      div.innerText = c.value + " " + c.suit;
      handDiv.appendChild(div);
    });
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

let table = {
  C: [{ value: "5", suit: "C" }],
  D: [{ value: "5", suit: "D" }],
  S: [{ value: "5", suit: "S" }],
  B: [{ value: "5", suit: "B" }]
};

function sendState(ws, player) {
  ws.send(JSON.stringify({
    type: "state",
    hand: player.hand,
    table,
    players: players.length
  }));
}

function startGame() {
  gameStarted = true;
  deck = createDeck();

  players.forEach(p => {
    p.hand = deck.splice(0, 10);
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

  // se prima connessione → avvia gioco
  if (!gameStarted) {
    startGame();
  }

  // manda stato completo SEMPRE
  sendState(ws, player);

  ws.on("message", (msg) => {
    // pronto per regole future
  });

  ws.on("close", () => {
    players = players.filter(p => p.ws !== ws);
  });
});

server.listen(PORT, () => {
  console.log("Gioco 5 online su " + PORT);
});
const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;

// -------------------- CLIENT HTML --------------------
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });

  res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>Gioco 5</title>
  <style>
    body { font-family: Arial; padding: 20px; }

    #table {
      display: flex;
      gap: 20px;
      margin-top: 10px;
    }

    .col {
      border: 1px solid #ccc;
      padding: 10px;
      min-width: 80px;
    }

    .card {
      border: 1px solid black;
      padding: 5px;
      margin: 3px 0;
      text-align: center;
    }
  </style>
</head>
<body>

<h2>Gioco 5</h2>

<div id="status">Connessione...</div>

<h3>Carte in mano</h3>
<div id="hand"></div>

<h3>Tavolo</h3>
<div id="table"></div>

<script>
const ws = new WebSocket(location.origin.replace("http", "ws"));

ws.onmessage = (msg) => {
  const data = JSON.parse(msg.data);

  if (data.type === "state") {

    document.getElementById("status").innerText =
      "Giocatori: " + data.players;

    // ---- MANO ----
    const handDiv = document.getElementById("hand");
    handDiv.innerHTML = "";

    data.hand.forEach(c => {
      const d = document.createElement("div");
      d.className = "card";
      d.innerText = c.value + " " + c.suit;
      handDiv.appendChild(d);
    });

    // ---- TAVOLO (FIX VERO) ----
    const tableDiv = document.getElementById("table");
    tableDiv.innerHTML = "";

    Object.keys(data.table).forEach(suit => {
      const col = document.createElement("div");
      col.className = "col";

      const title = document.createElement("strong");
      title.innerText = suit;
      col.appendChild(title);

      data.table[suit].forEach(card => {
        const c = document.createElement("div");
        c.className = "card";
        c.innerText = card.value + " " + card.suit;
        col.appendChild(c);
      });

      tableDiv.appendChild(col);
    });
  }
};
</script>

</body>
</html>
  `);
});

// -------------------- GAME SERVER --------------------
const wss = new WebSocket.Server({ server });

let players = [];
let deck = [];
let gameStarted = false;

let table = null;

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

function initGame() {
  deck = createDeck();

  table = {
    C: [{ value: "5", suit: "C" }],
    D: [{ value: "5", suit: "D" }],
    S: [{ value: "5", suit: "S" }],
    B: [{ value: "5", suit: "B" }]
  };

  players.forEach(p => {
    p.hand = deck.splice(0, 10);
  });

  gameStarted = true;

  broadcastState();
}

function broadcastState() {
  players.forEach(p => {
    if (p.ws.readyState === 1) {
      p.ws.send(JSON.stringify({
        type: "state",
        players: players.length,
        hand: p.hand,
        table
      }));
    }
  });
}

wss.on("connection", (ws) => {

  const player = {
    id: Date.now(),
    ws,
    hand: []
  };

  players.push(player);

  if (!gameStarted) {
    initGame();
  }

  broadcastState();

  ws.on("close", () => {
    players = players.filter(p => p.ws !== ws);

    if (players.length === 0) {
      gameStarted = false;
    } else {
      broadcastState();
    }
  });
});

// -------------------- START --------------------
server.listen(PORT, () => {
  console.log("Gioco 5 online su porta " + PORT);
});
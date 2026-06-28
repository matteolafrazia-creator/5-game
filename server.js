const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;

// -------------------- HTTP SERVER --------------------
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
  <div id="hand"></div>

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
    handDiv.innerHTML = "<h3>La tua mano:</h3>";

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

// -------------------- WEBSOCKET --------------------
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

  console.log("Partita avviata con", players.length, "giocatori");
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

  // avvio automatico quando siamo almeno 2
  if (players.length >= 2 && !gameStarted) {
    startGame();
  }

  ws.on("close", () => {
    players = players.filter(p => p.ws !== ws);
  });
});

// -------------------- START SERVER --------------------
server.listen(PORT, () => {
  console.log("Gioco 5 online su porta " + PORT);
});
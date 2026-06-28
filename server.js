const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;

// ---------------- CLIENT ----------------
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });

  res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>Gioco 5</title>
  <style>
    body { font-family: Arial; padding: 20px; }
    .card { border:1px solid #000; padding:8px; margin:4px; cursor:pointer; display:inline-block; }
    .card:hover { background:#eee; }
    #table { display:flex; gap:20px; margin-top:10px; }
    .col { border:1px solid #ccc; padding:10px; min-width:80px; }
  </style>
</head>
<body>

<h2>Gioco 5</h2>

<div id="status"></div>
<div id="winner"></div>

<h3>Carte</h3>
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

    document.getElementById("winner").innerText =
      data.winner ? "🏆 Vincitore: Giocatore " + data.winner : "";

    const handDiv = document.getElementById("hand");
    handDiv.innerHTML = "";

    data.hand.forEach((c, i) => {
      const d = document.createElement("div");
      d.className = "card";
      d.innerText = c.value + " " + c.suit;

      d.onclick = () => {
        ws.send(JSON.stringify({
          type: "play",
          index: i
        }));
      };

      handDiv.appendChild(d);
    });

    const tableDiv = document.getElementById("table");
    tableDiv.innerHTML = "";

    Object.keys(data.table).forEach(suit => {
      const col = document.createElement("div");
      col.className = "col";

      col.innerHTML = "<b>" + suit + "</b>";

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

// ---------------- GAME ----------------
const wss = new WebSocket.Server({ server });

let players = [];
let deck = [];
let table = null;
let turn = 0;
let gameStarted = false;
let winner = null;

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

function initGame() {
  deck = createDeck();

  table = {
    C: [{ value:"5", suit:"C" }],
    D: [{ value:"5", suit:"D" }],
    S: [{ value:"5", suit:"S" }],
    B: [{ value:"5", suit:"B" }]
  };

  players.forEach(p => {
    p.hand = deck.splice(0,10);
  });

  turn = 0;
  gameStarted = true;
  winner = null;
}

function order(value) {
  return ["A","2","3","4","5","6","7","F","H","R"].indexOf(value);
}

function isValid(card, suit) {
  if (card.value === "5") return true;

  const top = table[suit][table[suit].length - 1];
  const diff = Math.abs(order(card.value) - order(top.value));

  return diff === 1;
}

function broadcast() {
  players.forEach((p, i) => {
    if (p.ws.readyState === 1) {
      p.ws.send(JSON.stringify({
        type: "state",
        players: players.length,
        hand: p.hand,
        table,
        winner,
        turn
      }));
    }
  });
}

wss.on("connection", (ws) => {

  const player = { ws, hand: [] };
  players.push(player);

  if (!gameStarted) initGame();

  broadcast();

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);
    if (winner) return;

    if (data.type === "play") {

      const p = players.find(pl => pl.ws === ws);
      const card = p.hand[data.index];

      const suit = card.suit;

      if (isValid(card, suit) && players[turn].ws === ws) {

        table[suit].push(card);
        p.hand.splice(data.index, 1);

        if (p.hand.length === 0) {
          winner = players.indexOf(p) + 1;
        }

        turn = (turn + 1) % players.length;
      }

      broadcast();
    }
  });

  ws.on("close", () => {
    players = players.filter(p => p.ws !== ws);
  });
});

server.listen(PORT, () => {
  console.log("Gioco 5 online");
});
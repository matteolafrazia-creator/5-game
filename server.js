const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Gioco 5 online");
});

const wss = new WebSocket.Server({ server });

let players = [];

function broadcast(msg) {
  players.forEach(p => {
    if (p.ws.readyState === 1) {
      p.ws.send(JSON.stringify(msg));
    }
  });
}

wss.on("connection", (ws) => {
  const player = { id: Date.now(), ws };
  players.push(player);

  console.log("Giocatore connesso:", players.length);

  ws.send(JSON.stringify({
    type: "welcome",
    message: "Sei connesso al gioco 5"
  }));

  broadcast({
    type: "players",
    count: players.length
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
  console.log("Server 5 online su porta " + PORT);
});

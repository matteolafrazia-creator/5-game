const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Gioco 5 online");
});

const wss = new WebSocket.Server({ server });

let players = [];

function broadcast(data) {
  players.forEach(p => {
    if (p.ws.readyState === 1) {
      p.ws.send(JSON.stringify(data));
    }
  });
}

wss.on("connection", (ws) => {
  const player = {
    id: Date.now(),
    ws
  };

  players.push(player);

  console.log("Giocatore connesso:", players.length);

  ws.send(JSON.stringify({
    type: "welcome",
    id: player.id,
    players: players.length
  }));

  broadcast({
    type: "players_update",
    players: players.length
  });

  ws.on("close", () => {
    players = players.filter(p => p.ws !== ws);

    broadcast({
      type: "players_update",
      players: players.length
    });
  });
});

server.listen(PORT, () => {
  console.log("Server 5 online su porta " + PORT);
});
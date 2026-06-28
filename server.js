const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Server 5 online");
});

const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("Player connesso");
  ws.send("OK - Server 5 attivo");
});

server.listen(PORT, () => {
  console.log("Server 5 avviato su porta " + PORT);
});

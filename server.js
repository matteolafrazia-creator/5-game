const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;

const wss = new WebSocket.Server({ port: PORT });

wss.on("connection", (ws) => {
  ws.send("Server 5 attivo");
});

console.log("Server 5 avviato su porta " + PORT);

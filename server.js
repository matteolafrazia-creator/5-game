const http = require("http");
const fs = require("fs");
const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;

// HTML semplice del client
const clientHtml = `
<!DOCTYPE html>
<html>
<body>
<h2>Gioco 5</h2>
<div id="log">Connessione...</div>

<script>
const ws = new WebSocket(location.origin.replace("http", "ws"));

ws.onopen = () => {
  document.getElementById("log").innerText = "Connesso al server";
};

ws.onmessage = (msg) => {
  const data = JSON.parse(msg.data);
  document.getElementById("log").innerText = JSON.stringify(data);
};
</script>

</body>
</html>
`;

const server = http.createServer((req, res) => {
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(clientHtml);
    return;
  }

  res.writeHead(200);
  res.end("OK");
});

const wss = new WebSocket.Server({ server });

let players = [];

wss.on("connection", (ws) => {
  players.push(ws);

  ws.send(JSON.stringify({
    type: "welcome",
    players: players.length
  }));

  ws.on("close", () => {
    players = players.filter(p => p !== ws);
  });
});

server.listen(PORT, () => {
  console.log("Gioco 5 online");
});
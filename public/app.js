const ws = new WebSocket(location.origin.replace("http", "ws"));

let state = {};

ws.onopen = () => {
  const name = prompt("Nome:");
  ws.send(JSON.stringify({ type: "setName", name }));
};

ws.onmessage = (msg) => {
  state = JSON.parse(msg.data);
  render();
};

function render() {
  document.body.innerHTML = "";

  const info = document.createElement("h2");
  info.innerText = `Giocatori: ${state.count}/4`;
  document.body.appendChild(info);

  const status = document.createElement("h3");

  if (state.gameState === "WAITING") {
    status.innerText = "In attesa...";
  } else {
    status.innerText = state.yourTurn ? "👉 TUO TURNO" : "Attendi...";
  }

  document.body.appendChild(status);

  const list = document.createElement("div");
  list.innerHTML = "<h3>Lobby</h3>";

  state.players?.forEach(p => {
    const div = document.createElement("div");
    div.innerText = p;
    list.appendChild(div);
  });

  document.body.appendChild(list);

  const btn = document.createElement("button");
  btn.innerText = "PASSA";

  btn.onclick = () => {
    ws.send(JSON.stringify({ type: "pass" }));
  };

  document.body.appendChild(btn);
}
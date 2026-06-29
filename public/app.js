const ws = new WebSocket(location.origin.replace("http", "ws"));

let state = {};

ws.onmessage = (msg) => {
  state = JSON.parse(msg.data);

  document.getElementById("info").innerText =
    "Giocatori: " + state.players;

  document.getElementById("turnInfo").innerText =
    state.yourTurn ? "👉 IL TUO TURNO" : "Attendi...";

  renderTable();
  renderHand();
  renderPass();
};

function renderTable() {
  const table = document.getElementById("table");
  table.innerHTML = "";

  Object.keys(state.table).forEach(suit => {
    const div = document.createElement("div");
    div.className = "suit";

    div.innerHTML = "<b>" + suit + "</b>";

    state.table[suit].forEach(c => {
      const el = document.createElement("div");
      el.className = "card";
      el.innerText = c.value + " " + c.suit;
      div.appendChild(el);
    });

    table.appendChild(div);
  });
}

function renderHand() {
  const hand = document.getElementById("hand");
  hand.innerHTML = "";

  state.hand.forEach((c, i) => {
    const el = document.createElement("div");
    el.className = "card";
    el.innerText = c.value + " " + c.suit;

    el.onclick = () => {
      ws.send(JSON.stringify({
        type: "play",
        index: i
      }));
    };

    hand.appendChild(el);
  });
}

function renderPass() {
  const btn = document.getElementById("passBtn");

  btn.onclick = () => {
    ws.send(JSON.stringify({ type: "pass" }));
  };
}
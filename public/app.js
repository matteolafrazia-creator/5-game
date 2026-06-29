const ws = new WebSocket(location.origin.replace("http", "ws"));

let state = {};

ws.onopen = () => {
  const name = prompt("Nome giocatore:");
  ws.send(JSON.stringify({ type: "setName", name }));
};

ws.onmessage = (msg) => {
  state = JSON.parse(msg.data);
  render();
};

function render() {
  document.body.innerHTML = "";

  /* TOP */
  const top = document.createElement("h2");
  top.innerText = `Giocatori: ${state.playersCount}/4`;
  document.body.appendChild(top);

  const status = document.createElement("h3");

  if (state.gameState === "WAITING") {
    status.innerText = "In attesa giocatori...";
  }

  if (state.gameState === "PICK_SUIT") {
    status.innerText = state.yourIndex === state.dealerIndex
      ? "Scegli il seme"
      : "Attesa mazziere...";
  }

  if (state.gameState === "IN_GAME") {
    status.innerText = state.yourTurn ? "👉 TUO TURNO" : "Attendi...";
  }

  document.body.appendChild(status);

  /* LOBBY */
  const lobby = document.createElement("div");
  lobby.innerHTML = "<h3>Lobby</h3>";

  state.players?.forEach(p => {
    const d = document.createElement("div");
    d.innerText = p;
    lobby.appendChild(d);
  });

  document.body.appendChild(lobby);

  /* TAVOLO */
  const table = document.createElement("div");
  table.innerHTML = "<h3>Tavolo</h3>";

  Object.keys(state.table || {}).forEach(s => {
    const box = document.createElement("div");
    box.innerHTML = `<b>${s}</b>`;

    state.table[s].forEach(c => {
      const card = document.createElement("div");
      card.innerText = `${c.value} ${c.suit}`;
      box.appendChild(card);
    });

    table.appendChild(box);
  });

  document.body.appendChild(table);

  /* MANO */
  const hand = document.createElement("div");
  hand.innerHTML = "<h3>Carte</h3>";

  state.hand?.forEach((c, i) => {
    const card = document.createElement("button");
    card.innerText = `${c.value} ${c.suit}`;

    card.onclick = () => {
      if (!state.yourTurn) return;

      ws.send(JSON.stringify({ type: "play", index: i }));
    };

    hand.appendChild(card);
  });

  document.body.appendChild(hand);

  /* AZIONI */
  const actions = document.createElement("div");

  if (state.gameState === "PICK_SUIT" && state.yourIndex === state.dealerIndex) {
    ["C","D","S","B"].forEach(s => {
      const b = document.createElement("button");
      b.innerText = "Scegli " + s;

      b.onclick = () => {
        ws.send(JSON.stringify({ type: "chooseSuit", suit: s }));
      };

      actions.appendChild(b);
    });
  }

  if (state.gameState === "IN_GAME") {
    const pass = document.createElement("button");
    pass.innerText = "PASSA";

    pass.onclick = () => {
      ws.send(JSON.stringify({ type: "pass" }));
    };

    actions.appendChild(pass);
  }

  document.body.appendChild(actions);
}
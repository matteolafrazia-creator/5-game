const ws = new WebSocket(location.origin.replace("http", "ws"));

let state = {};

const suitSymbols = {
  C: "♣",
  D: "♦",
  S: "♠",
  B: "♥"
};

ws.onopen = () => {
  const name = prompt("Nome giocatore:");
  ws.send(JSON.stringify({ type: "setName", name }));
};

ws.onmessage = (msg) => {
  state = JSON.parse(msg.data);
  render();
};

/* ========================= */

function render() {
  document.body.innerHTML = "";

  renderTop();
  renderTable();
  renderHand();
  renderActions();
}

/* ========================= */

function renderTop() {
  const top = document.createElement("div");

  const title = document.createElement("h2");
  title.innerText = `Giocatori: ${state.playersCount}/4`;
  top.appendChild(title);

  const status = document.createElement("h3");

  if (state.gameState === "WAITING") status.innerText = "In attesa...";
  if (state.gameState === "PICK_SUIT") {
    status.innerText =
      state.yourIndex === state.dealerIndex
        ? "👉 Scegli il seme"
        : "Attesa mazziere...";
  }
  if (state.gameState === "IN_GAME") {
    status.innerText = state.yourTurn ? "👉 TUO TURNO" : "Attendi...";
  }

  top.appendChild(status);

  if (state.chosenSuit) {
    const s = document.createElement("div");
    s.innerText = "Seme: " + suitSymbols[state.chosenSuit] + " " + state.chosenSuit;
    top.appendChild(s);
  }

  document.body.appendChild(top);
}

/* ========================= */

function renderTable() {
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.gap = "20px";

  ["C","D","S","B"].forEach(s => {
    const col = document.createElement("div");
    col.style.border = "1px solid #ccc";
    col.style.padding = "10px";
    col.style.width = "120px";

    const t = document.createElement("b");
    t.innerText = suitSymbols[s] + " " + s;
    col.appendChild(t);

    (state.table?.[s] || []).forEach(c => {
      const d = document.createElement("div");
      d.innerText = c.value;
      col.appendChild(d);
    });

    wrap.appendChild(col);
  });

  document.body.appendChild(wrap);
}

/* ========================= */

function renderHand() {
  const hand = document.createElement("div");

  (state.hand || []).forEach((c, i) => {
    const btn = document.createElement("button");
    btn.innerText = `${c.value} ${suitSymbols[c.suit]}`;

    btn.onclick = () => {
      if (!state.yourTurn) return;
      ws.send(JSON.stringify({ type: "play", index: i }));
    };

    hand.appendChild(btn);
  });

  document.body.appendChild(hand);
}

/* ========================= */

function renderActions() {
  const div = document.createElement("div");

  if (
    state.gameState === "PICK_SUIT" &&
    state.yourIndex === state.dealerIndex
  ) {
    ["C","D","S","B"].forEach(s => {
      const b = document.createElement("button");
      b.innerText = "Scegli " + suitSymbols[s];

      b.onclick = () => {
        ws.send(JSON.stringify({ type: "chooseSuit", suit: s }));
      };

      div.appendChild(b);
    });
  }

  if (state.gameState === "IN_GAME") {
    const pass = document.createElement("button");
    pass.innerText = "PASSA";

    pass.onclick = () => {
      ws.send(JSON.stringify({ type: "pass" }));
    };

    div.appendChild(pass);
  }

  document.body.appendChild(div);
}
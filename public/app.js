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

/* =========================
   MAIN RENDER
========================= */

function render() {
  document.body.innerHTML = "";

  renderTop();
  renderTable();
  renderHand();
  renderActions();
}

/* =========================
   TOP
========================= */

function renderTop() {
  const top = document.createElement("div");
  top.style.padding = "10px";
  top.style.borderBottom = "2px solid #ddd";

  const title = document.createElement("h2");
  title.innerText = `Giocatori: ${state.playersCount}/4`;
  top.appendChild(title);

  const status = document.createElement("h3");

  if (state.gameState === "WAITING") {
    status.innerText = "In attesa giocatori...";
  }

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
    s.innerText = "Seme scelto: " + suitSymbols[state.chosenSuit] + " " + state.chosenSuit;
    s.style.fontSize = "18px";
    s.style.marginTop = "5px";
    top.appendChild(s);
  }

  document.body.appendChild(top);
}

/* =========================
   TAVOLO
========================= */

function renderTable() {
  const game = document.createElement("div");

  game.style.display = "flex";
  game.style.justifyContent = "center";
  game.style.gap = "20px";
  game.style.marginTop = "20px";

  const suits = ["C", "D", "S", "B"];

  suits.forEach(suit => {
    const col = document.createElement("div");

    col.style.width = "120px";
    col.style.minHeight = "250px";
    col.style.border = "2px solid #ccc";
    col.style.borderRadius = "10px";
    col.style.padding = "10px";
    col.style.background = "#fafafa";
    col.style.display = "flex";
    col.style.flexDirection = "column";
    col.style.alignItems = "center";

    const title = document.createElement("div");
    title.innerText = suitSymbols[suit] + " " + suit;
    title.style.fontSize = "20px";
    title.style.marginBottom = "10px";

    col.appendChild(title);

    const cards = state.table?.[suit] || [];

    cards.forEach((c, idx) => {
      const card = document.createElement("div");

      const isLast = idx === cards.length - 1;

      card.innerText = c.value;

      card.style.width = "45px";
      card.style.height = "60px";
      card.style.display = "flex";
      card.style.alignItems = "center";
      card.style.justifyContent = "center";
      card.style.border = "1px solid black";
      card.style.borderRadius = "6px";
      card.style.marginTop = "5px";
      card.style.background = isLast ? "#ffeaa7" : "white";

      if (c.suit === "D" || c.suit === "B") {
        card.style.color = "red";
      }

      col.appendChild(card);
    });

    game.appendChild(col);
  });

  document.body.appendChild(game);
}

/* =========================
   MANO
========================= */

function renderHand() {
  const wrap = document.createElement("div");
  wrap.style.marginTop = "30px";
  wrap.style.textAlign = "center";

  const title = document.createElement("h3");
  title.innerText = "La tua mano";
  wrap.appendChild(title);

  const hand = document.createElement("div");
  hand.style.display = "flex";
  hand.style.justifyContent = "center";
  hand.style.flexWrap = "wrap";
  hand.style.gap = "10px";

  (state.hand || []).forEach((c, i) => {
    const card = document.createElement("button");

    card.innerText = `${c.value} ${suitSymbols[c.suit]}`;

    card.style.width = "60px";
    card.style.height = "80px";
    card.style.border = "1px solid #333";
    card.style.borderRadius = "8px";
    card.style.cursor = "pointer";
    card.style.background = "white";

    card.onmouseenter = () => {
      card.style.transform = "scale(1.1)";
    };

    card.onmouseleave = () => {
      card.style.transform = "scale(1)";
    };

    card.onclick = () => {
      if (!state.yourTurn) return;

      ws.send(JSON.stringify({ type: "play", index: i }));
    };

    hand.appendChild(card);
  });

  wrap.appendChild(hand);
  document.body.appendChild(wrap);
}

/* =========================
   AZIONI
========================= */

function renderActions() {
  const actions = document.createElement("div");
  actions.style.marginTop = "20px";
  actions.style.textAlign = "center";

  if (state.gameState === "PICK_SUIT" && state.yourIndex === state.dealerIndex) {
    ["C", "D", "S", "B"].forEach(s => {
      const btn = document.createElement("button");

      btn.innerText = "Scegli " + suitSymbols[s] + " " + s;

      btn.style.margin = "5px";
      btn.style.padding = "10px";

      btn.onclick = () => {
        ws.send(JSON.stringify({ type: "chooseSuit", suit: s }));
      };

      actions.appendChild(btn);
    });
  }

  if (state.gameState === "IN_GAME") {
    const pass = document.createElement("button");

    pass.innerText = "PASSA";
    pass.style.padding = "10px";
    pass.style.marginTop = "10px";

    pass.onclick = () => {
      ws.send(JSON.stringify({ type: "pass" }));
    };

    actions.appendChild(pass);
  }

  document.body.appendChild(actions);
}
const ws = new WebSocket(location.origin.replace("http", "ws"));

let state = {};

ws.onmessage = (msg) => {
  state = JSON.parse(msg.data);

  renderTop();
  renderTable();
  renderHand();
  renderActions();
};

function renderTop() {
  document.getElementById("info").innerText =
    `Giocatori: ${state.playersCount}/4`;

  let text = "";

  if (state.gameState === "WAITING") {
    text = "In attesa giocatori...";
  }

  if (state.gameState === "PICK_SUIT") {
    text = "Il mazziere sta scegliendo il seme...";
  }

  if (state.gameState === "IN_GAME") {
    text = state.yourTurn ? "👉 IL TUO TURNO" : "Attendi...";
  }

  document.getElementById("turnInfo").innerText = text;
}

/* =========================
   TAVOLO
========================= */

function renderTable() {
  const el = document.getElementById("table");
  el.innerHTML = "";

  if (!state.table) return;

  Object.keys(state.table).forEach(suit => {
    const box = document.createElement("div");
    box.className = "suit";

    box.innerHTML = `<b>${suit}</b>`;

    state.table[suit].forEach(c => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerText = `${c.value} ${c.suit}`;
      box.appendChild(card);
    });

    el.appendChild(box);
  });
}

/* =========================
   MANO
========================= */

function renderHand() {
  const el = document.getElementById("hand");
  el.innerHTML = "";

  if (!state.hand) return;

  state.hand.forEach((c, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerText = `${c.value} ${c.suit}`;

    card.onclick = () => {
      if (!state.yourTurn) return;

      ws.send(JSON.stringify({
        type: "play",
        index: i
      }));
    };

    el.appendChild(card);
  });
}

/* =========================
   AZIONI
========================= */

function renderActions() {
  const el = document.getElementById("actions");
  el.innerHTML = "";

  /* =========================
     PICK SUIT FIX (MAZZIERE)
  ========================= */

  if (state.gameState === "PICK_SUIT") {

    // ❗ FIX VERO: confronta INDEX, non "0"
    if (state.dealer === state.yourIndex) {
      ["C", "D", "S", "B"].forEach(s => {
        const btn = document.createElement("button");
        btn.innerText = `Scegli ${s}`;

        btn.onclick = () => {
          ws.send(JSON.stringify({
            type: "chooseSuit",
            suit: s
          }));
        };

        el.appendChild(btn);
      });
    } else {
      el.innerText = "Attesa scelta mazziere...";
    }
  }

  /* =========================
     IN GAME
  ========================= */

  if (state.gameState === "IN_GAME") {
    const btn = document.createElement("button");
    btn.innerText = "PASSO";

    btn.onclick = () => {
      if (!state.yourTurn) return;

      ws.send(JSON.stringify({ type: "pass" }));
    };

    el.appendChild(btn);
  }
}
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
    "Giocatori: " + state.playersCount;

  if (state.gameState === "WAITING") {
    document.getElementById("turnInfo").innerText = "In attesa...";
  }

  if (state.gameState === "PICK_SUIT") {
    document.getElementById("turnInfo").innerText = "Mazziere sceglie seme...";
  }

  if (state.gameState === "IN_GAME") {
    document.getElementById("turnInfo").innerText =
      state.yourTurn ? "👉 IL TUO TURNO" : "Attendi...";
  }
}

/* =========================
   TAVOLO
========================= */

function renderTable() {
  const el = document.getElementById("table");
  el.innerHTML = "";

  if (!state.table) return;

  Object.keys(state.table).forEach(s => {
    const box = document.createElement("div");
    box.className = "suit";
    box.innerHTML = "<b>" + s + "</b>";

    state.table[s].forEach(c => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerText = c.value + " " + c.suit;
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
    card.innerText = c.value + " " + c.suit;

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

  /* PICK SUIT */
  if (state.gameState === "PICK_SUIT") {

    if (state.dealer === 0) {
      ["C","D","S","B"].forEach(s => {
        const btn = document.createElement("button");
        btn.innerText = "Scegli " + s;

        btn.onclick = () => {
          ws.send(JSON.stringify({
            type: "chooseSuit",
            suit: s
          }));
        };

        el.appendChild(btn);
      });
    } else {
      el.innerText = "Attesa mazziere...";
    }
  }

  /* IN GAME */
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
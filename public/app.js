const app = document.getElementById("app");
const ws = new WebSocket(location.origin.replace("http", "ws"));

let state = null;
let joined = false;

const SUITS = ["CP", "DN", "SP", "BA"];
const SUIT_LABELS = { CP: "Coppe", DN: "Denari", SP: "Spade", BA: "Bastoni" };

const VERTICAL_SLOTS = ["R", "C", "F", "7", "6", "5", "4", "3", "2", "A"];

ws.onopen = () => {
  const savedId = localStorage.getItem("five_player_id");
  const savedName = localStorage.getItem("five_player_name");

  if (savedId && savedName) {
    joined = true;
    ws.send(JSON.stringify({ type: "join", playerId: savedId, name: savedName }));
  } else {
    renderJoin();
  }
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "joined") {
    localStorage.setItem("five_player_id", data.playerId);
    return;
  }

  const wasMyTurn = state?.yourTurn;
  state = data;
  render();

  if (!wasMyTurn && state.yourTurn) showTurnToast();
};

function cardImg(card) {
  return `cards/${card.suit}_${card.rank}.png`;
}

function renderJoin() {
  app.innerHTML = `
    <div class="screen">
      <h1>5</h1>
      <input id="nameInput" placeholder="Nome giocatore" />
      <button id="joinBtn">Entra</button>
    </div>
  `;

  document.getElementById("joinBtn").onclick = () => {
    const name = document.getElementById("nameInput").value.trim() || "Giocatore";
    localStorage.setItem("five_player_name", name);
    joined = true;
    ws.send(JSON.stringify({ type: "join", playerId: localStorage.getItem("five_player_id"), name }));
  };
}

function render() {
  if (!joined) return renderJoin();
  if (!state) return;

  app.innerHTML = "";
  renderHeader();
  renderPlayers();
  renderLastCard();
  renderTable();
  renderHand();
  renderActions();
  renderSuitOverlay();
  renderEndOverlay();
}

function renderHeader() {
  const div = document.createElement("div");
  div.className = "header";

  let status = "";
  if (state.gameState === "WAITING") status = `In attesa giocatori (${state.playersCount}/4)`;
  if (state.gameState === "PICK_SUIT") status = state.yourIndex === state.dealerIndex ? "Devi scegliere il seme" : `Attesa scelta seme da ${state.players[state.dealerIndex]?.name}`;
  if (state.gameState === "IN_GAME") status = state.yourTurn ? "È il tuo turno" : `Turno di ${state.players[state.turn]?.name}`;
  if (state.gameState === "HAND_OVER") status = "Mano conclusa";
  if (state.gameState === "GAME_OVER") status = "Partita conclusa";

  div.innerHTML = `
    <h2>5 · Mano ${state.handNumber || 1}/10</h2>
    <div>${status}</div>
    <div class="message">${state.message || ""}</div>
    <div>${state.chosenSuit ? "Seme scelto: " + SUIT_LABELS[state.chosenSuit] : ""}</div>
  `;

  app.appendChild(div);
}

function renderPlayers() {
  const div = document.createElement("div");
  div.className = "players";

  state.players?.forEach((p, i) => {
    const el = document.createElement("div");
    el.className = "player";
    if (i === state.turn && state.gameState === "IN_GAME") el.classList.add("active");
    el.innerText = `${p.name} · ${p.cards} carte · ${p.totalScore || 0} pt ${p.connected ? "" : "(offline)"}`;
    div.appendChild(el);
  });

  app.appendChild(div);
}

function renderLastCard() {
  if (!state.lastCard) return;

  const div = document.createElement("div");
  div.className = "lastCardBox";
  div.innerHTML = `<span>Ultima carta:</span> <img src="${cardImg(state.lastCard)}" /> <span>${state.lastCard.playerName}</span>`;
  app.appendChild(div);
}

function renderTable() {
  const table = document.createElement("div");
  table.className = "table";

  SUITS.forEach(suit => {
    const col = document.createElement("div");
    col.className = "suitColumn";

    const title = document.createElement("div");
    title.className = "suitTitle";
    title.innerText = SUIT_LABELS[suit];
    col.appendChild(title);

    const cardsByRank = getCardsByRank(suit);
    const isComplete = Object.keys(cardsByRank).length === 10;

    if (isComplete) {
      col.classList.add("completedSuit");

      const stack = document.createElement("div");
      stack.className = "completedStack";

      VERTICAL_SLOTS.slice(0, 5).forEach((rank, idx) => {
        const card = cardsByRank[rank];
        if (!card) return;

        const img = document.createElement("img");
        img.className = "stackCard";
        img.src = cardImg(card);
        img.style.setProperty("--i", idx);
        stack.appendChild(img);
      });

      const label = document.createElement("div");
      label.className = "completedLabel";
      label.innerText = "Completo";

      col.appendChild(stack);
      col.appendChild(label);
    } else {
      const grid = document.createElement("div");
      grid.className = "fixedColumnGrid";

      VERTICAL_SLOTS.forEach(rank => {
        const slot = document.createElement("div");
        slot.className = rank === "5" ? "cardSlot fiveSlot" : "cardSlot";

        const card = cardsByRank[rank];
        if (card) {
          const img = document.createElement("img");
          img.className = "tableCard";
          img.src = cardImg(card);
          slot.appendChild(img);
        }

        grid.appendChild(slot);
      });

      col.appendChild(grid);
    }

    table.appendChild(col);
  });

  app.appendChild(table);
}

function getCardsByRank(suit) {
  const col = state.table?.[suit];
  const map = {};
  if (!col) return map;

  col.up?.forEach(card => map[card.rank] = card);
  if (col.five) map["5"] = col.five;
  col.down?.forEach(card => map[card.rank] = card);

  return map;
}

function renderHand() {
  const wrap = document.createElement("div");
  wrap.className = state.yourTurn ? "hand handActive" : "hand";

  state.hand?.forEach((card, index) => {
    const img = document.createElement("img");
    img.className = "handCard";
    img.src = cardImg(card);

    img.onclick = () => {
      if (!state.yourTurn) return;
      ws.send(JSON.stringify({ type: "play", index }));
    };

    wrap.appendChild(img);
  });

  app.appendChild(wrap);
}

function renderActions() {
  const div = document.createElement("div");
  div.className = "actions";

  if (state.gameState === "IN_GAME") {
    const pass = document.createElement("button");
    pass.innerText = "Passo";
    pass.onclick = () => ws.send(JSON.stringify({ type: "pass" }));
    div.appendChild(pass);
  }

  app.appendChild(div);
}

function renderSuitOverlay() {
  if (state.gameState !== "PICK_SUIT") return;

  const overlay = document.createElement("div");
  overlay.className = "suitOverlay";

  if (state.yourIndex === state.dealerIndex) {
    overlay.innerHTML = `
      <div class="suitModal">
        <h2>Scegli il seme</h2>
        <p>La scelta avviene prima della distribuzione.</p>
        <div id="suitButtons" class="suitButtons"></div>
      </div>
    `;

    app.appendChild(overlay);

    const box = document.getElementById("suitButtons");
    SUITS.forEach(suit => {
      const btn = document.createElement("button");
      btn.innerText = SUIT_LABELS[suit];
      btn.onclick = () => ws.send(JSON.stringify({ type: "chooseSuit", suit }));
      box.appendChild(btn);
    });
  } else {
    overlay.innerHTML = `
      <div class="suitModal">
        <h2>Attesa mazziere</h2>
        <p>${state.players[state.dealerIndex]?.name} sta scegliendo il seme.</p>
      </div>
    `;
    app.appendChild(overlay);
  }
}

function renderEndOverlay() {
  if (!["HAND_OVER", "GAME_OVER"].includes(state.gameState) || !state.handResult) return;

  const overlay = document.createElement("div");
  overlay.className = "overlay";

  const scores = state.handResult.scores.map(s => `<li>${s.name}: ${s.points} punti</li>`).join("");

  const standings = state.handResult.showStandings
    ? `<h3>${state.handResult.final ? "Classifica finale" : "Classifica a metà partita"}</h3>
       <ol>${state.standings.map(s => `<li>${s.name}: ${s.total} punti</li>`).join("")}</ol>`
    : "";

  overlay.innerHTML = `
    <div class="modal">
      <h1>Ha vinto ${state.handResult.winnerName}</h1>
      <h3>Punteggi mano</h3>
      <ul>${scores}</ul>
      ${standings}
      ${state.gameState === "HAND_OVER" ? '<button id="nextHandBtn">Prossima mano</button>' : '<button id="resetMatchBtn">Nuova partita</button>'}
    </div>
  `;

  app.appendChild(overlay);

  const next = document.getElementById("nextHandBtn");
  if (next) next.onclick = () => ws.send(JSON.stringify({ type: "nextHand" }));

  const reset = document.getElementById("resetMatchBtn");
  if (reset) reset.onclick = () => ws.send(JSON.stringify({ type: "resetMatch" }));
}

function showTurnToast() {
  const toast = document.createElement("div");
  toast.className = "turnToast";
  toast.innerText = "È il tuo turno";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1600);
}
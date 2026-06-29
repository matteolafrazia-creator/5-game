const app = document.getElementById("app");
const ws = new WebSocket(location.origin.replace("http", "ws"));

let state = null;
let joined = false;

const SUITS = ["CP", "DN", "SP", "BA"];
const SUIT_LABELS = {
  CP: "Coppe",
  DN: "Denari",
  SP: "Spade",
  BA: "Bastoni"
};

const RANK_ORDER = ["R", "C", "F", "7", "6", "5", "4", "3", "2", "A"];

ws.onopen = () => {
  const savedId = localStorage.getItem("five_player_id");
  const savedName = localStorage.getItem("five_player_name");

  if (savedId && savedName) {
    joined = true;
    ws.send(JSON.stringify({
      type: "join",
      playerId: savedId,
      name: savedName
    }));
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

  state = data;
  render();
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
    ws.send(JSON.stringify({
      type: "join",
      playerId: localStorage.getItem("five_player_id"),
      name
    }));
  };
}

function render() {
  if (!joined) return renderJoin();
  if (!state) return;

  app.innerHTML = "";
  renderHeader();
  renderPlayers();
  renderTable();
  renderHand();
  renderActions();
}

function renderHeader() {
  const div = document.createElement("div");
  div.className = "header";

  let status = "";
  if (state.gameState === "WAITING") status = `In attesa giocatori (${state.playersCount}/4)`;
  if (state.gameState === "PICK_SUIT") {
    status = state.yourIndex === state.dealerIndex
      ? "Scegli il seme"
      : `Attesa scelta seme da ${state.players[state.dealerIndex]?.name}`;
  }
  if (state.gameState === "IN_GAME") {
    status = state.yourTurn ? "È il tuo turno" : `Turno di ${state.players[state.turn]?.name}`;
  }
  if (state.gameState === "HAND_OVER") status = "Mano conclusa";

  div.innerHTML = `
    <h2>5</h2>
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
    el.innerText = `${p.name} - ${p.cards} carte ${p.connected ? "" : "(offline)"}`;
    div.appendChild(el);
  });

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

    getColumnCards(suit).forEach(card => {
      const img = document.createElement("img");
      img.className = "tableCard";
      img.src = cardImg(card);
      col.appendChild(img);
    });

    table.appendChild(col);
  });

  app.appendChild(table);
}

function getColumnCards(suit) {
  const col = state.table?.[suit];
  if (!col) return [];

  const up = [...col.up].sort((a, b) => rankSortDesc(a.rank, b.rank));
  const down = [...col.down].sort((a, b) => rankSortDesc(a.rank, b.rank));

  return [...up, ...(col.five ? [col.five] : []), ...down];
}

function rankSortDesc(a, b) {
  return RANK_ORDER.indexOf(a) - RANK_ORDER.indexOf(b);
}

function renderHand() {
  const wrap = document.createElement("div");
  wrap.className = "hand";

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

  if (state.gameState === "PICK_SUIT" && state.yourIndex === state.dealerIndex) {
    SUITS.forEach(suit => {
      const btn = document.createElement("button");
      btn.innerText = SUIT_LABELS[suit];
      btn.onclick = () => ws.send(JSON.stringify({ type: "chooseSuit", suit }));
      div.appendChild(btn);
    });
  }

  if (state.gameState === "IN_GAME") {
    const pass = document.createElement("button");
    pass.innerText = "Passo";
    pass.onclick = () => ws.send(JSON.stringify({ type: "pass" }));
    div.appendChild(pass);
  }

  const reset = document.createElement("button");
  reset.innerText = "Esci / reset giocatore";
  reset.onclick = () => {
    localStorage.removeItem("five_player_id");
    localStorage.removeItem("five_player_name");
    location.reload();
  };
  div.appendChild(reset);

  app.appendChild(div);
}
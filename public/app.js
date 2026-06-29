const app = document.getElementById("app");
const ws = new WebSocket(location.origin.replace("http", "ws"));

let state = null;
let joined = false;
let errorMessage = "";
let dismissedPassWarningKey = null;

const SUITS = ["CP", "DN", "SP", "BA"];
const SUIT_LABELS = { CP: "Coppe", DN: "Denari", SP: "Spade", BA: "Bastoni" };
const VERTICAL_SLOTS = ["R", "C", "F", "7", "6", "5", "4", "3", "2", "A"];

ws.onopen = () => {
  const savedId = localStorage.getItem("five_player_id");
  const savedName = localStorage.getItem("five_player_name");
  const savedRoom = localStorage.getItem("five_room_code");

  if (savedId && savedName && savedRoom) {
    joined = true;
    ws.send(JSON.stringify({
      type: "joinRoom",
      playerId: savedId,
      name: savedName,
      roomCode: savedRoom
    }));
  } else {
    renderStart();
  }
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "joined") {
    localStorage.setItem("five_player_id", data.playerId);
    localStorage.setItem("five_room_code", data.roomCode);
    joined = true;
    return;
  }

  if (data.type === "left") {
    clearSession();
    state = null;
    joined = false;
    renderStart();
    return;
  }

  if (data.type === "error") {
    errorMessage = data.message;
    joined = false;
    renderStart();
    return;
  }

  const wasMyTurn = state?.yourTurn;
  state = data;
  joined = true;
  render();

  if (!wasMyTurn && state.yourTurn) showTurnToast();
};

function clearSession() {
  localStorage.removeItem("five_player_id");
  localStorage.removeItem("five_room_code");
}

function leaveGame() {
  if (!confirm("Vuoi davvero uscire dalla partita?")) return;

  try {
    ws.send(JSON.stringify({ type: "leaveRoom" }));
  } catch {}

  clearSession();
  state = null;
  joined = false;
  errorMessage = "";
  renderStart();
}

function cardImg(card) {
  return `cards/${card.suit}_${card.rank}.png`;
}

function isLastPlayed(card) {
  return (
    state.lastCard &&
    card.suit === state.lastCard.suit &&
    card.rank === state.lastCard.rank
  );
}

function renderStart() {
  const savedName = localStorage.getItem("five_player_name") || "";

  app.innerHTML = `
    <div class="screen startScreen">
      <h1>5</h1>
      <p>Gioca online con i tuoi amici</p>

      ${errorMessage ? `<div class="errorBox">${errorMessage}</div>` : ""}

      <input id="nameInput" placeholder="Nome giocatore" value="${savedName}" />

      <button id="createBtn">Crea partita</button>

      <div class="joinBox">
        <input id="roomInput" placeholder="Codice partita" maxlength="6" />
        <button id="joinBtn">Entra in partita</button>
      </div>

      <div class="betaLabel">Beta 0.9.0</div>
    </div>
  `;

  document.getElementById("createBtn").onclick = () => {
    const name = getName();
    localStorage.setItem("five_player_name", name);
    errorMessage = "";
    joined = true;

    ws.send(JSON.stringify({
      type: "createRoom",
      playerId: localStorage.getItem("five_player_id"),
      name
    }));
  };

  document.getElementById("joinBtn").onclick = () => {
    const name = getName();
    const roomCode = document.getElementById("roomInput").value.trim().toUpperCase();

    if (!roomCode) {
      errorMessage = "Inserisci un codice partita.";
      renderStart();
      return;
    }

    localStorage.setItem("five_player_name", name);
    errorMessage = "";
    joined = true;

    ws.send(JSON.stringify({
      type: "joinRoom",
      playerId: localStorage.getItem("five_player_id"),
      name,
      roomCode
    }));
  };
}

function getName() {
  return document.getElementById("nameInput").value.trim() || "Giocatore";
}

function render() {
  if (!joined) return renderStart();
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
  renderAbortedOverlay();
  renderPassWarningOverlay();
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
  if (state.gameState === "ABORTED") status = "Partita terminata";

  div.innerHTML = `
    <button id="topExitBtn" class="topExitBtn">Esci</button>
    <h2>5 · Mano ${state.handNumber || 1}/10</h2>
    <div class="roomCode">
      Codice: <strong>${state.roomCode}</strong>
      <button id="copyCodeBtn" class="miniBtn">Copia</button>
      <button id="shareCodeBtn" class="miniBtn">Condividi</button>
    </div>
    <div>${status}</div>
    <div class="message">${state.message || ""}</div>
    <div>${state.chosenSuit ? "Seme scelto: " + SUIT_LABELS[state.chosenSuit] : ""}</div>
  `;

  app.appendChild(div);

  document.getElementById("topExitBtn").onclick = leaveGame;
  document.getElementById("copyCodeBtn").onclick = async () => await copyRoomCode();
  document.getElementById("shareCodeBtn").onclick = async () => await shareRoomCode();
}

async function copyRoomCode() {
  const text = state.roomCode;

  try {
    await navigator.clipboard.writeText(text);
    showSmallToast("Codice copiato");
  } catch {
    showSmallToast("Codice: " + text);
  }
}

async function shareRoomCode() {
  const url = location.origin;
  const text = `Vieni a giocare a 5!\nLink: ${url}\nCodice partita: ${state.roomCode}`;

  try {
    if (navigator.share) {
      await navigator.share({ title: "5", text, url });
    } else {
      await navigator.clipboard.writeText(text);
      showSmallToast("Invito copiato");
    }
  } catch {
    showSmallToast("Invito non condiviso");
  }
}

function renderPlayers() {
  const div = document.createElement("div");
  div.className = "players";

  state.players?.forEach((p, i) => {
    const el = document.createElement("div");
    el.className = "player";

    if (i === state.turn && state.gameState === "IN_GAME") {
      el.classList.add("active");
    }

    const ready = state.gameState === "HAND_OVER"
      ? (p.readyNext ? " · pronto" : " · attesa")
      : "";

    el.innerText = `${p.name} · ${p.cards} carte · ${p.totalScore || 0} pt${ready} ${p.connected ? "" : "(offline)"}`;

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
          img.className = isLastPlayed(card) ? "tableCard tableCardPlayed" : "tableCard";
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
        <p>Clicca il 5 del seme scelto.</p>
        <div id="suitButtons" class="suitCardButtons"></div>
      </div>
    `;

    app.appendChild(overlay);

    const box = document.getElementById("suitButtons");

    SUITS.forEach(suit => {
      const img = document.createElement("img");
      img.className = "chooseSuitCard";
      img.src = cardImg({ suit, rank: "5" });

      img.onclick = () => {
        ws.send(JSON.stringify({ type: "chooseSuit", suit }));
      };

      box.appendChild(img);
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

  const scores = state.handResult.scores
    .map(s => `<li>${s.name}: ${s.points} punti</li>`)
    .join("");

  const standings = state.handResult.showStandings
    ? `<h3>${state.handResult.final ? "Classifica finale" : "Classifica a metà partita"}</h3>
       <ol>${state.standings.map(s => `<li>${s.name}: ${s.total} punti</li>`).join("")}</ol>`
    : "";

  const readyCount = state.players.filter(p => p.readyNext).length;
  const meReady = state.players[state.yourIndex]?.readyNext;

  overlay.innerHTML = `
    <div class="modal victoryModal">
      <div class="trophy">🏆</div>
      <h1>Ha vinto ${state.handResult.winnerName}</h1>
      <h3>Punteggi mano</h3>
      <ul>${scores}</ul>
      ${standings}
      ${
        state.gameState === "HAND_OVER"
          ? `<p>${readyCount}/4 giocatori pronti</p><button id="readyNextBtn">${meReady ? "In attesa degli altri..." : "Pronto"}</button>`
          : '<button id="resetMatchBtn">Nuova partita</button>'
      }
    </div>
  `;

  app.appendChild(overlay);

  const ready = document.getElementById("readyNextBtn");

  if (ready) {
    ready.disabled = !!meReady;
    ready.onclick = () => {
      ws.send(JSON.stringify({ type: "readyNext" }));
    };
  }

  const reset = document.getElementById("resetMatchBtn");

  if (reset) {
    reset.onclick = () => {
      ws.send(JSON.stringify({ type: "resetMatch" }));
    };
  }
}

function renderAbortedOverlay() {
  if (state.gameState !== "ABORTED") return;

  const overlay = document.createElement("div");
  overlay.className = "overlay";

  overlay.innerHTML = `
    <div class="modal">
      <h1>Partita terminata</h1>
      <p>${state.message || ""}</p>
      <button id="backHomeBtn">Torna alla home</button>
    </div>
  `;

  app.appendChild(overlay);

  document.getElementById("backHomeBtn").onclick = () => {
    clearSession();
    joined = false;
    state = null;
    renderStart();
  };
}

function renderPassWarningOverlay() {
  if (!state) return;
  if (!state.yourTurn) return;
  if (!state.message) return;

  const isPassWarning =
    state.message.includes("Non puoi passare") ||
    state.message.includes("devi giocare il 5");

  if (!isPassWarning) return;

  const warningKey = `${state.handNumber}-${state.turn}-${state.message}`;
  if (dismissedPassWarningKey === warningKey) return;

  const overlay = document.createElement("div");
  overlay.className = "passWarningOverlay";

  overlay.innerHTML = `
    <div class="passWarningModal">
      <h2>Attenzione</h2>
      <p>${state.message}</p>
      <button id="closePassWarningBtn">Ho capito</button>
    </div>
  `;

  app.appendChild(overlay);

  document.getElementById("closePassWarningBtn").onclick = () => {
    dismissedPassWarningKey = warningKey;
    overlay.remove();
  };
}

function showTurnToast() {
  const toast = document.createElement("div");
  toast.className = "turnToast";
  toast.innerText = "È il tuo turno";

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 1600);
}

function showSmallToast(text) {
  const toast = document.createElement("div");
  toast.className = "smallToast";
  toast.innerText = text;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 1400);
}

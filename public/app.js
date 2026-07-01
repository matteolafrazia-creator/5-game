/* BUILD_CHECK: V098_SAFARI_LIVE_GAMEPLAY_FIX_APP */
console.log("BUILD_CHECK V098_SAFARI_LIVE_GAMEPLAY_FIX_APP loaded");
const app = document.getElementById("app");
let renderTarget = app;

function byId(id) {
  if (renderTarget && typeof renderTarget.getElementById === "function") {
    const scoped = renderTarget.getElementById(id);
    if (scoped) return scoped;
  }
  return document.getElementById(id);
}

const ws = new WebSocket(location.origin.replace("http", "ws"));

let state = null;
let joined = false;
let errorMessage = "";
let thinkingTimer = null;
let activeThinkerName = null;
let replayRunning = false;
let endOverlayVisibleAt = 0;
let endOverlayTimer = null;

const SUITS = ["CP", "DN", "SP", "BA"];
const SUIT_LABELS = { CP: "Coppe", DN: "Denari", SP: "Spade", BA: "Bastoni" };
const VERTICAL_SLOTS = ["R", "C", "F", "7", "6", "5", "4", "3", "2", "A"];

ws.onopen = () => {
  preloadCardImages();

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

  const previousState = state;
  const wasMyTurn = state?.yourTurn;
  const previousGameState = state?.gameState;
  state = data;
  joined = true;

  if (state.gameState === "ABORTED") {
    clearSession();
  }

  if (
    ["HAND_OVER", "GAME_OVER"].includes(state.gameState) &&
    !["HAND_OVER", "GAME_OVER"].includes(previousGameState)
  ) {
    delayEndOverlayForLastCard();
  }

  if (canUseLiveGameplayUpdate(previousState, state)) {
    updateGameplayInPlace(previousState);
  } else {
    render();
  }

  if (!wasMyTurn && state.yourTurn) {
    const turnText = state.passNotice?.fromName
      ? `${state.passNotice.fromName} ha passato, è il tuo turno`
      : "È il tuo turno";

    showTurnToast(turnText);
  }
};


document.addEventListener("visibilitychange", () => {
  if (!document.hidden) handleAppResume();
});

window.addEventListener("focus", () => {
  handleAppResume();
});

function handleAppResume() {
  if (state?.gameState === "ABORTED") return;

  const savedId = localStorage.getItem("five_player_id");
  const savedName = localStorage.getItem("five_player_name");
  const savedRoom = localStorage.getItem("five_room_code");

  if (!savedId || !savedName || !savedRoom) return;

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: "joinRoom",
      playerId: savedId,
      name: savedName,
      roomCode: savedRoom
    }));
    return;
  }

  showSmallToast("Riconnessione...");
  setTimeout(() => {
    location.reload();
  }, 450);
}


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

function cardValue(rank) {
  const values = { A: 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, F: 8, C: 9, R: 10 };
  return values[rank];
}

function canPlayClient(card) {
  if (!state || state.gameState !== "IN_GAME") return false;

  if (state.openingFiveRequired) {
    return card.suit === state.chosenSuit && card.rank === "5";
  }

  const col = state.table?.[card.suit];
  const value = cardValue(card.rank);

  if (!col || !col.five) return card.rank === "5";

  if (value > 5) {
    const highest = col.up?.length ? Math.max(...col.up.map(c => cardValue(c.rank))) : 5;
    return value === highest + 1;
  }

  if (value < 5) {
    const lowest = col.down?.length ? Math.min(...col.down.map(c => cardValue(c.rank))) : 5;
    return value === lowest - 1;
  }

  return false;
}

function shouldHighlightOpeningFive(card) {
  return (
    state?.yourTurn &&
    state?.openingFiveRequired &&
    card.suit === state.chosenSuit &&
    card.rank === "5"
  );
}

function shakeCardElement(el) {
  el.classList.remove("cardShake");
  void el.offsetWidth;
  el.classList.add("cardShake");
  setTimeout(() => el.classList.remove("cardShake"), 430);
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

      <button id="rulesBtn" class="rulesBtn">❓ Come si gioca?</button>

      <div class="betaLabel">Beta 0.9.0</div>
    </div>
  `;

  byId("createBtn").onclick = () => {
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

  byId("joinBtn").onclick = () => {
    const name = getName();
    const roomCode = byId("roomInput").value.trim().toUpperCase();

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

  byId("rulesBtn").onclick = () => {
    renderRulesOverlay();
  };
}

function getName() {
  return byId("nameInput").value.trim() || "Giocatore";
}

function render() {
  if (!joined) return renderStart();
  if (!state) return;

  const fragment = document.createDocumentFragment();
  renderTarget = fragment;

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

  renderTarget = app;
  app.replaceChildren(fragment);

  scheduleThinkingNotice();
}


function canUseLiveGameplayUpdate(previousState, nextState) {
  if (!previousState || !nextState) return false;
  if (previousState.gameState !== "IN_GAME") return false;
  if (nextState.gameState !== "IN_GAME") return false;
  if (previousState.roomCode !== nextState.roomCode) return false;
  if (!document.querySelector(".table")) return false;
  if (!document.querySelector(".hand")) return false;
  return true;
}

function handSignature(hand) {
  return (hand || []).map(card => `${card.suit}_${card.rank}`).join("|");
}

function updateGameplayInPlace(previousState) {
  updateHeaderInPlace();
  updatePlayersInPlace();
  updateLastCardInPlace();
  updateTableInPlace();
  updateHandInPlace(previousState);
  updateActionsInPlace();
  renderPassWarningOverlay();
  scheduleThinkingNotice();
}

function replaceSectionInPlace(selector, renderFn) {
  const current = document.querySelector(selector);
  if (!current) {
    render();
    return;
  }

  const oldTarget = renderTarget;
  const fragment = document.createDocumentFragment();
  renderTarget = fragment;
  renderFn();
  renderTarget = oldTarget;

  const next = fragment.firstElementChild;
  if (next) current.replaceWith(next);
}

function updateHeaderInPlace() {
  replaceSectionInPlace(".header", renderHeader);
}

function updatePlayersInPlace() {
  replaceSectionInPlace(".players", renderPlayers);
}

function updateLastCardInPlace() {
  const current = document.querySelector(".lastCardBox");

  const oldTarget = renderTarget;
  const fragment = document.createDocumentFragment();
  renderTarget = fragment;
  renderLastCard();
  renderTarget = oldTarget;

  const next = fragment.firstElementChild;

  if (current && next) {
    const currentKey = current.dataset.cardKey || "";
    const nextKey = state.lastCard ? `${state.lastCard.suit}_${state.lastCard.rank}_${state.lastCard.playerName}` : "";
    if (currentKey !== nextKey) current.replaceWith(next);
    return;
  }

  if (!current && next) {
    const table = document.querySelector(".table");
    if (table) table.insertAdjacentElement("beforebegin", next);
  }

  if (current && !next) current.remove();
}

function updateActionsInPlace() {
  replaceSectionInPlace(".actions", renderActions);
}

function updateTableInPlace() {
  SUITS.forEach(suit => {
    const cardsByRank = getCardsByRank(suit);

    VERTICAL_SLOTS.forEach(rank => {
      const slot = document.querySelector(`.cardSlot[data-suit="${suit}"][data-rank="${rank}"]`);
      if (!slot) return;

      const card = cardsByRank[rank];
      const nextKey = card ? `${card.suit}_${card.rank}` : "";
      const currentKey = slot.dataset.cardKey || "";

      if (currentKey === nextKey) {
        const existing = slot.querySelector("img");
        if (existing) {
          if (card && isLastPlayed(card)) existing.classList.add("tableCardPlayed");
          else existing.classList.remove("tableCardPlayed");
        }
        return;
      }

      slot.dataset.cardKey = nextKey;
      slot.innerHTML = "";

      if (card) {
        const img = document.createElement("img");
        img.className = isLastPlayed(card) ? "tableCard tableCardPlayed" : "tableCard";
        img.src = cardImg(card);
        img.dataset.cardKey = nextKey;
        slot.appendChild(img);
      }
    });
  });
}

function updateHandInPlace(previousState) {
  const hand = document.querySelector(".hand");
  if (!hand) return;

  hand.className = state.yourTurn ? "hand handActive" : "hand";

  if (handSignature(previousState.hand) === handSignature(state.hand)) return;

  hand.innerHTML = "";

  state.hand?.forEach((card, index) => {
    const img = document.createElement("img");
    img.className = shouldHighlightOpeningFive(card) ? "handCard openingFiveCard" : "handCard";
    img.src = cardImg(card);

    img.onclick = () => {
      if (!state.yourTurn) return;

      if (!canPlayClient(card)) {
        shakeCardElement(img);
        return;
      }

      ws.send(JSON.stringify({ type: "play", index }));
    };

    hand.appendChild(img);
  });
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

  renderTarget.appendChild(div);

  byId("topExitBtn").onclick = leaveGame;
  byId("copyCodeBtn").onclick = async () => await copyRoomCode();
  byId("shareCodeBtn").onclick = async () => await shareRoomCode();
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
  const text = `Vieni a giocare a 5!
Link: ${url}
Codice partita: ${state.roomCode}`;

  try {
    if (navigator.share) {
      await navigator.share({
        title: "5",
        text
      });
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

    if (state.gameState === "IN_GAME" && p.cards === 1) {
      el.classList.add("oneCard");
    }

    const ready = state.gameState === "HAND_OVER"
      ? (p.readyNext ? " · pronto" : " · attesa")
      : "";

    const cardText = p.cards === 1 ? "1 carta" : `${p.cards} carte`;
    el.innerText = `${p.name} · ${cardText}${ready} ${p.connected ? "" : "(offline)"}`;

    div.appendChild(el);
  });

  renderTarget.appendChild(div);
}

function renderLastCard() {
  if (!state.lastCard) return;

  const div = document.createElement("div");
  div.className = "lastCardBox";
  div.dataset.cardKey = `${state.lastCard.suit}_${state.lastCard.rank}_${state.lastCard.playerName}`;
  div.innerHTML = `<span>Ultima carta:</span> <img src="${cardImg(state.lastCard)}" /> <span>${state.lastCard.playerName}</span>`;
  renderTarget.appendChild(div);
}

function renderTable() {
  const table = document.createElement("div");
  table.className = "table";

  SUITS.forEach(suit => {
    const col = document.createElement("div");
    col.className = "suitColumn";
    col.dataset.suit = suit;

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
        slot.dataset.suit = suit;
        slot.dataset.rank = rank;

        const card = cardsByRank[rank];

        if (card) {
          const key = `${card.suit}_${card.rank}`;
          const img = document.createElement("img");
          img.className = isLastPlayed(card) ? "tableCard tableCardPlayed" : "tableCard";
          img.src = cardImg(card);
          img.dataset.cardKey = key;
          slot.dataset.cardKey = key;
          slot.appendChild(img);
        }

        grid.appendChild(slot);
      });

      col.appendChild(grid);
    }

    table.appendChild(col);
  });

  renderTarget.appendChild(table);
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
    img.className = shouldHighlightOpeningFive(card) ? "handCard openingFiveCard" : "handCard";
    img.src = cardImg(card);

    img.onclick = () => {
      if (!state.yourTurn) return;

      if (!canPlayClient(card)) {
        shakeCardElement(img);
        return;
      }

      ws.send(JSON.stringify({ type: "play", index }));
    };

    wrap.appendChild(img);
  });

  renderTarget.appendChild(wrap);
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

  renderTarget.appendChild(div);
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

    renderTarget.appendChild(overlay);

    const box = byId("suitButtons");

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

    renderTarget.appendChild(overlay);
  }
}

function renderEndOverlay() {
  if (!["HAND_OVER", "GAME_OVER"].includes(state.gameState) || !state.handResult) return;
  if (replayRunning) return;

  if (Date.now() < endOverlayVisibleAt) {
    renderFinalCardNotice();
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "overlay";

  const scores = state.handResult.scores
    .map(s => `<li>${s.name}: ${s.points} punti</li>`)
    .join("");

  const standings = state.handResult.showStandings
    ? `<h3>${state.handResult.final ? "🏁 Classifica finale" : "⏱️ Classifica parziale dopo 5 mani"}</h3>
       <ol class="standingsList">${state.standings.map((s, index) => `<li><span>${podiumIcon(index)} ${s.name}</span><strong>${s.total} pt</strong></li>`).join("")}</ol>`
    : "";

  const durationBox = state.gameState === "GAME_OVER" && state.handResult.matchDurationMinutes
    ? `<div class="durationBox">Durata totale: <strong>${state.handResult.matchDurationMinutes} min</strong></div>`
    : "";

  const readyCount = state.players.filter(p => p.readyNext).length;
  const meReady = state.players[state.yourIndex]?.readyNext;
  const replayAvailable = state.handResult.replay && state.handResult.replay.length > 0;

  const readyList = state.gameState === "HAND_OVER"
    ? `<div class="readyList">${state.players.map(p => `<div>${p.readyNext ? "✅" : "⏳"} ${p.name}</div>`).join("")}</div>`
    : "";

  overlay.innerHTML = `
    <div class="modal victoryModal ${state.gameState === "GAME_OVER" ? "finalVictoryModal" : ""}">
      <button id="endExitBtn" class="modalExitBtn">Esci</button>
      <div class="trophy">${state.gameState === "GAME_OVER" ? "🎉" : "🏆"}</div>
      <h1>${state.gameState === "GAME_OVER" ? "Partita conclusa" : "Ha vinto " + state.handResult.winnerName}</h1>
      ${state.gameState === "GAME_OVER" ? `<h2 class="championTitle">Campione: ${state.standings[0]?.name || ""}</h2>` : ""}
      <h3>Punteggi mano</h3>
      <ul>${scores}</ul>
      ${standings}
      ${durationBox}
      <div class="endButtons">
        ${replayAvailable ? '<button id="watchReplayBtn" class="secondaryBtn">Rivedi la mano</button>' : ""}
        ${
          state.gameState === "HAND_OVER"
            ? `<p>${readyCount}/4 giocatori pronti</p>${readyList}<button id="readyNextBtn">${meReady ? "In attesa degli altri..." : "Pronto"}</button>`
            : '<button id="resetMatchBtn">Nuova partita</button>'
        }
      </div>
    </div>
  `;

  renderTarget.appendChild(overlay);

  byId("endExitBtn").onclick = leaveGame;

  const replay = byId("watchReplayBtn");
  if (replay) {
    replay.onclick = () => renderReplayOverlay(state.handResult.replay);
  }

  const ready = byId("readyNextBtn");

  if (ready) {
    ready.onclick = () => {
      ws.send(JSON.stringify({ type: "readyNext" }));
    };
  }

  const notReady = byId("notReadyNextBtn");

  if (notReady) {
    notReady.onclick = () => {
      ws.send(JSON.stringify({ type: "notReadyNext" }));
    };
  }

  const reset = byId("resetMatchBtn");

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

  renderTarget.appendChild(overlay);

  byId("backHomeBtn").onclick = () => {
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

  const overlay = document.createElement("div");
  overlay.className = "passWarningOverlay";

  overlay.innerHTML = `
    <div class="passWarningModal">
      <h2>Attenzione</h2>
      <p>${state.message}</p>
      <button id="closePassWarningBtn">Ho capito</button>
    </div>
  `;

  renderTarget.appendChild(overlay);

  byId("closePassWarningBtn").onclick = () => {
    overlay.remove();
  };
}




function preloadCardImages() {
  SUITS.forEach(suit => {
    VERTICAL_SLOTS.forEach(rank => {
      const img = new Image();
      img.src = cardImg({ suit, rank });
    });
  });
}

function delayEndOverlayForLastCard() {
  endOverlayVisibleAt = Date.now() + 1500;

  if (endOverlayTimer) {
    clearTimeout(endOverlayTimer);
    endOverlayTimer = null;
  }

  endOverlayTimer = setTimeout(() => {
    endOverlayTimer = null;
    render();
  }, 1550);
}

function renderFinalCardNotice() {
  if (!state.lastCard) return;

  const existing = document.querySelector(".finalCardNotice");
  if (existing) return;

  const notice = document.createElement("div");
  notice.className = "finalCardNotice finalCardNoticeOnly";
  notice.innerHTML = `
    <img src="${cardImg(state.lastCard)}" />
  `;

  document.body.appendChild(notice);

  setTimeout(() => {
    notice.remove();
  }, 1350);
}


function podiumIcon(index) {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return "4°";
}

function renderReplayOverlay(actions) {
  replayRunning = true;

  let lastReplayCard = null;

  const overlay = document.createElement("div");
  overlay.className = "replayOverlay";

  overlay.innerHTML = `
    <div class="replayNativeModal">
      <div class="replayNativeHeader">
        <h2>Replay della mano</h2>
        <button id="closeReplayBtn" class="replayCloseBtn">Chiudi</button>
      </div>

      <div id="replayStep" class="replayNativeStep">Avvio replay...</div>

      <div id="replayTableBox" class="replayNativeTableBox"></div>
    </div>
  `;

  document.body.appendChild(overlay);

  const step = byId("replayStep");
  const replayTableBox = byId("replayTableBox");
  const close = byId("closeReplayBtn");

  let index = 0;
  let stopped = false;
  let replayTimer = null;

  function closeReplay() {
    stopped = true;
    replayRunning = false;
    if (replayTimer) clearTimeout(replayTimer);
    overlay.remove();
    render();
  }

  close.onclick = closeReplay;

  function buildReplayTableOnce() {
    replayTableBox.innerHTML = "";

    const table = document.createElement("div");
    table.className = "replayGameTable replayGameTableNative";

    SUITS.forEach(suit => {
      const col = document.createElement("div");
      col.className = "replaySuitColumn";

      const title = document.createElement("div");
      title.className = "replaySuitTitle";
      title.innerText = SUIT_LABELS[suit];
      col.appendChild(title);

      const grid = document.createElement("div");
      grid.className = "replayFixedColumnGrid";

      VERTICAL_SLOTS.forEach(rank => {
        const slot = document.createElement("div");
        slot.className = rank === "5" ? "replayCardSlot replayFiveSlot" : "replayCardSlot";
        slot.dataset.suit = suit;
        slot.dataset.rank = rank;
        grid.appendChild(slot);
      });

      col.appendChild(grid);
      table.appendChild(col);
    });

    replayTableBox.appendChild(table);
  }

  function setActionText(text) {
    step.innerText = text;
  }

  function clearLastHighlight() {
    if (!lastReplayCard) return;
    const slot = replayTableBox.querySelector(`.replayCardSlot[data-suit="${lastReplayCard.suit}"][data-rank="${lastReplayCard.rank}"]`);
    const existing = slot?.querySelector("img");
    if (existing) existing.classList.remove("replayTableCardLast");
  }

  function placeReplayCard(card) {
    if (!card || !card.suit || !card.rank) return;
    const slot = replayTableBox.querySelector(`.replayCardSlot[data-suit="${card.suit}"][data-rank="${card.rank}"]`);
    if (!slot) return;

    const key = `${card.suit}_${card.rank}`;

    if (slot.dataset.cardKey !== key) {
      slot.dataset.cardKey = key;
      slot.innerHTML = "";

      const img = document.createElement("img");
      img.className = "replayTableCard";
      img.src = cardImg(card);
      slot.appendChild(img);
    }

    const img = slot.querySelector("img");
    if (img) {
      img.classList.remove("replayTableCardLast");
      void img.offsetWidth;
      img.classList.add("replayTableCardLast");
    }
  }

  function showNext() {
    if (stopped) return;

    if (!actions || actions.length === 0) {
      setActionText("Replay non disponibile");
      return;
    }

    if (index >= actions.length) {
      setActionText("Replay concluso");
      return;
    }

    const action = actions[index];
    clearLastHighlight();

    if (action.type === "chooseSuit") {
      setActionText(`${action.playerName} sceglie ${SUIT_LABELS[action.suit]}`);
      lastReplayCard = null;
    } else if (action.type === "play") {
      setActionText(`${action.playerName} gioca`);
      placeReplayCard(action.card);
      lastReplayCard = action.card;
    } else if (action.type === "pass") {
      setActionText(`${action.playerName} passa`);
      lastReplayCard = null;
    } else {
      setActionText("Azione replay");
      lastReplayCard = null;
    }

    index += 1;
    replayTimer = setTimeout(showNext, 850);
  }

  buildReplayTableOnce();
  replayTimer = setTimeout(showNext, 350);
}



function createEmptyReplayTable() {
  return {
    CP: {},
    DN: {},
    SP: {},
    BA: {}
  };
}

function renderReplayTableHtml(replayTable, lastReplayCard) {
  return `
    <div class="replayGameTable">
      ${SUITS.map(suit => `
        <div class="replaySuitColumn">
          <div class="replaySuitTitle">${SUIT_LABELS[suit]}</div>
          <div class="replayFixedColumnGrid">
            ${VERTICAL_SLOTS.map(rank => {
              const card = replayTable[suit][rank];
              const isLast = card && lastReplayCard && card.suit === lastReplayCard.suit && card.rank === lastReplayCard.rank;
              return `
                <div class="replayCardSlot ${rank === "5" ? "replayFiveSlot" : ""}">
                  ${card ? `<img class="replayTableCard ${isLast ? "replayTableCardLast" : ""}" src="${cardImg(card)}" />` : ""}
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function scheduleThinkingNotice() {
  if (!state || state.gameState !== "IN_GAME") {
    clearThinkingNotice();
    return;
  }

  const thinker = state.players[state.turn]?.name;
  if (!thinker) {
    clearThinkingNotice();
    return;
  }

  if (activeThinkerName === thinker && thinkingTimer) return;

  clearThinkingNotice();
  activeThinkerName = thinker;

  thinkingTimer = setTimeout(() => {
    if (!state || state.gameState !== "IN_GAME") return;
    if (state.players[state.turn]?.name !== thinker) return;
    showThinkingToast(`${thinker} sta pensando...`);
  }, 15000);
}

function clearThinkingNotice() {
  if (thinkingTimer) {
    clearTimeout(thinkingTimer);
    thinkingTimer = null;
  }
  activeThinkerName = null;
}

function showThinkingToast(text) {
  const existing = document.querySelector(".thinkingToast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "thinkingToast";
  toast.innerText = text;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2200);
}


function renderRulesOverlay() {
  const overlay = document.createElement("div");
  overlay.className = "rulesOverlay";

  overlay.innerHTML = `
    <div class="rulesModal">
      <h2>Come si gioca?</h2>

      <section>
        <h3>🎯 Scopo del gioco</h3>
        <p>Lo scopo del gioco è rimanere con meno punti possibile al termine delle 10 mani. Per vincere una mano bisogna essere il primo giocatore a rimanere senza carte; tutti gli altri ricevono un punto per ogni carta rimasta in mano.</p>
      </section>

      <section>
        <h3>Come si gioca</h3>
        <ul>
          <li>Si gioca in <strong>4 giocatori</strong>.</li>
          <li>Il mazziere sceglie un seme <strong>prima</strong> della distribuzione.</li>
          <li>Ogni giocatore riceve <strong>10 carte</strong>.</li>
          <li>Chi possiede il <strong>5 del seme scelto</strong> apre la mano giocandolo.</li>
        </ul>
      </section>

      <section>
        <h3>Durante la mano</h3>
        <ul>
          <li>Ad ogni turno si gioca <strong>una sola carta</strong>.</li>
          <li>Su un seme già aperto si possono aggiungere solo le carte consecutive.</li>
          <li>Se possiedi un <strong>5</strong> di un altro seme puoi aprire una nuova colonna.</li>
          <li>Se non hai nessuna carta giocabile devi premere <strong>Passo</strong>.</li>
          <li>Se hai almeno una carta giocabile <strong>non puoi passare</strong>.</li>
        </ul>
      </section>

      <section>
        <h3>Fine della mano</h3>
        <ul>
          <li>Vince la mano chi termina per primo tutte le proprie carte.</li>
          <li>Ogni altro giocatore riceve <strong>1 punto per ogni carta rimasta in mano</strong>.</li>
        </ul>
      </section>

      <section>
        <h3>Fine della partita</h3>
        <ul>
          <li>La partita è composta da <strong>10 mani</strong>.</li>
          <li>Dopo la <strong>5ª mano</strong> viene mostrata la classifica provvisoria.</li>
          <li>Dopo la <strong>10ª mano</strong> viene mostrata la classifica finale.</li>
          <li>Vince il giocatore con il <strong>minor numero di punti</strong>.</li>
        </ul>
      </section>

      <button id="closeRulesBtn">Ho capito</button>
    </div>
  `;

  document.body.appendChild(overlay);

  byId("closeRulesBtn").onclick = () => {
    overlay.remove();
  };
}

function showTurnToast(text = "È il tuo turno") {
  const toast = document.createElement("div");
  toast.className = "turnToast";
  toast.innerText = text;

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

/* BUILD_CHECK: V1008_MATCH_LENGTH_SERVER */
/* BUILD_CHECK: V1007_TIEBREAK_WINS_PLACEMENTS_SERVER */
/* BUILD_CHECK: V1005_REAL_DISCONNECT_REJOIN_FEED_SERVER */
/* BUILD_CHECK: V1004_REJOIN_MESSAGE_ONLY_AFTER_DISCONNECT_SERVER */
/* BUILD_CHECK: V1003_SYNC_STATE_ON_RESUME_SERVER */
/* BUILD_CHECK: V0985_SERVER_ROOM_CLOSE_TIMER_FIX */
const http = require("http");
const express = require("express");
const WebSocket = require("ws");

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const SUITS = ["CP", "DN", "SP", "BA"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "F", "C", "R"];
const RANK_VALUE = { A: 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, F: 8, C: 9, R: 10 };
const RECONNECT_MS = 60000;

const rooms = new Map();

function createEmptyTable() {
  return {
    CP: { up: [], five: null, down: [] },
    DN: { up: [], five: null, down: [] },
    SP: { up: [], five: null, down: [] },
    BA: { up: [], five: null, down: [] }
  };
}

function createRoom(code, options = {}) {
  const matchLength = [5, 10, 20].includes(Number(options.matchLength))
    ? Number(options.matchLength)
    : 10;

  const matchMode =
    matchLength === 5 ? "quick" :
    matchLength === 20 ? "marathon" :
    "classic";

  return {
    code,
    matchMode,
    matchLength,
    players: [],
    gameState: "WAITING",
    dealerIndex: null,
    chosenSuit: null,
    starterIndex: null,
    turn: null,
    deck: [],
    table: createEmptyTable(),
    message: "In attesa giocatori...",
    lastCard: null,
    handNumber: 1,
    handResult: null,
    openingFiveRequired: false,
    currentHandActions: [],
    matchStartedAt: null,
    lastPassNotice: null
  };
}

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = "";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms.has(code));
  return code;
}

function createId() {
  return "p_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function createDeck() {
  const d = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) d.push({ suit, rank });
  }
  return d.sort(() => Math.random() - 0.5);
}

function sortHand(hand) {
  return hand.sort((a, b) => {
    const suitDiff = SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
    if (suitDiff !== 0) return suitDiff;
    return RANK_VALUE[a.rank] - RANK_VALUE[b.rank];
  });
}

function standings(room) {
  return [...room.players]
    .map(p => ({
      name: p.name,
      total: p.totalScore || 0,
      wins: p.handWins || 0,
      placementScore: p.placementScore || 0
    }))
    .sort((a, b) =>
      (a.total - b.total) ||
      (b.wins - a.wins) ||
      (a.placementScore - b.placementScore) ||
      a.name.localeCompare(b.name)
    );
}


function sendStateToPlayer(room, playerIndex) {
  const p = room.players[playerIndex];
  if (!p || !p.ws || p.ws.readyState !== WebSocket.OPEN) return;

  const passNotice =
    room.lastPassNotice &&
    room.gameState === "IN_GAME" &&
    room.lastPassNotice.toIndex === playerIndex
      ? { fromName: room.lastPassNotice.fromName }
      : null;

  p.ws.send(JSON.stringify({
    type: "state",
    roomCode: room.code,
    gameState: room.gameState,
    playersCount: room.players.length,
    handNumber: room.handNumber,
    players: room.players.map(x => ({
      id: x.id,
      name: x.name,
      cards: x.hand.length,
      connected: x.connected,
      totalScore: x.totalScore || 0,
      readyNext: !!x.readyNext
    })),
    yourIndex: playerIndex,
    yourId: p.id,
    dealerIndex: room.dealerIndex,
    chosenSuit: room.chosenSuit,
    starterIndex: room.starterIndex,
    turn: room.turn,
    yourTurn: room.gameState === "IN_GAME" && room.turn === playerIndex,
    openingFiveRequired: room.openingFiveRequired,
    passNotice,
    hand: p.hand,
    table: room.table,
    message: room.message,
    lastCard: room.lastCard,
    handResult: room.handResult,
    standings: standings(room)
  }));
}

function broadcast(room) {
  room.players.forEach((p, i) => {
    if (!p.ws || p.ws.readyState !== WebSocket.OPEN) return;

    const passNotice =
      room.lastPassNotice &&
      room.gameState === "IN_GAME" &&
      room.lastPassNotice.toIndex === i
        ? { fromName: room.lastPassNotice.fromName }
        : null;

    p.ws.send(JSON.stringify({
      type: "state",
      roomCode: room.code,
      gameState: room.gameState,
      playersCount: room.players.length,
      handNumber: room.handNumber,
      matchLength: room.matchLength || 10,
      matchMode: room.matchMode || "classic",
      players: room.players.map(x => ({
        id: x.id,
        name: x.name,
        cards: x.hand.length,
        connected: x.connected,
        totalScore: x.totalScore || 0,
        wins: x.handWins || 0,
        placementScore: x.placementScore || 0,
        readyNext: !!x.readyNext
      })),
      yourIndex: i,
      yourId: p.id,
      dealerIndex: room.dealerIndex,
      chosenSuit: room.chosenSuit,
      starterIndex: room.starterIndex,
      turn: room.turn,
      yourTurn: room.gameState === "IN_GAME" && room.turn === i,
      openingFiveRequired: room.openingFiveRequired,
      passNotice,
      hand: p.hand,
      table: room.table,
      message: room.message,
      lastCard: room.lastCard,
      handResult: room.handResult,
      standings: standings(room)
    }));
  });
}

function startSetup(room) {
  if (room.handNumber === 1 && !room.matchStartedAt) {
    room.matchStartedAt = Date.now();
  }

  room.gameState = "PICK_SUIT";
  room.dealerIndex = room.dealerIndex === null
    ? Math.floor(Math.random() * room.players.length)
    : (room.dealerIndex + 1) % room.players.length;

  room.chosenSuit = null;
  room.starterIndex = null;
  room.turn = null;
  room.table = createEmptyTable();
  room.handResult = null;
  room.lastCard = null;
  room.openingFiveRequired = false;
  room.currentHandActions = [];
  room.lastPassNotice = null;
  room.lastPassNotice = null;

  room.players.forEach(p => {
    p.hand = [];
    p.readyNext = false;
  });

  room.message = `Mano ${room.handNumber}/${room.matchLength || 10}. ${room.players[room.dealerIndex].name} deve scegliere il seme.`;
  broadcast(room);
}

function tryStart(room) {
  if (room.gameState === "WAITING" && room.players.length === 4) startSetup(room);
}

function dealAfterSuit(room, suit) {
  room.chosenSuit = suit;
  room.deck = createDeck();
  room.table = createEmptyTable();
  room.currentHandActions = [];

  room.players.forEach(p => {
    p.hand = sortHand(room.deck.splice(0, 10));
    p.readyNext = false;
  });

  room.starterIndex = room.players.findIndex(p =>
    p.hand.some(c => c.suit === room.chosenSuit && c.rank === "5")
  );

  room.turn = room.starterIndex;
  room.gameState = "IN_GAME";
  room.openingFiveRequired = true;

  room.message = `${room.players[room.dealerIndex].name} ha scelto ${room.chosenSuit}. ${room.players[room.starterIndex].name} deve aprire giocando il 5.`;
  broadcast(room);
}

function canPlay(room, card) {
  if (room.openingFiveRequired) return card.suit === room.chosenSuit && card.rank === "5";

  room.lastPassNotice = null;

  const col = room.table[card.suit];
  const value = RANK_VALUE[card.rank];

  if (!col.five) return card.rank === "5";

  if (value > 5) {
    const highest = col.up.length ? Math.max(...col.up.map(c => RANK_VALUE[c.rank])) : 5;
    return value === highest + 1;
  }

  if (value < 5) {
    const lowest = col.down.length ? Math.min(...col.down.map(c => RANK_VALUE[c.rank])) : 5;
    return value === lowest - 1;
  }

  return false;
}

function hasAnyMove(room, player) {
  return player.hand.some(card => canPlay(room, card));
}

function finishHand(room, winner) {
  const matchDurationMinutes = room.matchStartedAt
    ? Math.max(1, Math.round((Date.now() - room.matchStartedAt) / 60000))
    : 0;

  const handScores = room.players.map(p => ({
    player: p,
    name: p.name,
    points: p === winner ? 0 : p.hand.length
  }));

  handScores
    .sort((a, b) => a.points - b.points)
    .forEach((entry, index, sorted) => {
      const placement = index > 0 && entry.points === sorted[index - 1].points
        ? sorted[index - 1].placement
        : index + 1;

      entry.placement = placement;
      entry.player.placementScore = (entry.player.placementScore || 0) + placement;

      if (entry.player === winner) {
        entry.player.handWins = (entry.player.handWins || 0) + 1;
      }
    });

  const scores = room.players.map(p => {
    const entry = handScores.find(s => s.player === p);
    p.totalScore = (p.totalScore || 0) + entry.points;
    p.readyNext = false;

    return {
      name: p.name,
      points: entry.points,
      placement: entry.placement,
      wins: p.handWins || 0
    };
  });

  room.handResult = {
    winnerName: winner.name,
    scores,
    showStandings: room.handNumber === Math.ceil((room.matchLength || 10) / 2) || room.handNumber === (room.matchLength || 10),
    final: room.handNumber === (room.matchLength || 10),
    replay: [...room.currentHandActions],
    matchDurationMinutes: room.handNumber === (room.matchLength || 10) ? matchDurationMinutes : null
  };

  room.gameState = room.handNumber === (room.matchLength || 10) ? "GAME_OVER" : "HAND_OVER";
  room.message = `${winner.name} ha vinto la mano ${room.handNumber}.`;
}

function playCard(room, playerIndex, cardIndex) {
  const player = room.players[playerIndex];
  const card = player.hand[cardIndex];

  if (!card || !canPlay(room, card)) return;

  room.lastPassNotice = null;

  const col = room.table[card.suit];
  const value = RANK_VALUE[card.rank];

  if (card.rank === "5") col.five = card;
  else if (value > 5) col.up.push(card);
  else col.down.push(card);

  player.hand.splice(cardIndex, 1);
  player.hand = sortHand(player.hand);
  room.lastCard = { ...card, playerName: player.name };

  room.currentHandActions.push({
    type: "play",
    playerName: player.name,
    card: { ...card }
  });

  if (room.openingFiveRequired) {
    room.openingFiveRequired = false;
    room.turn = (playerIndex + 1) % room.players.length;
    room.message = `${player.name} apre con il 5. Turno di ${room.players[room.turn].name}.`;
    return;
  }

  if (player.hand.length === 0) {
    finishHand(room, player);
    return;
  }

  room.turn = (room.turn + 1) % room.players.length;
  room.message = `${player.name} ha giocato. Turno di ${room.players[room.turn].name}.`;
}

function markReady(room, playerIndex) {
  if (room.gameState !== "HAND_OVER") return;

  room.players[playerIndex].readyNext = true;

  const readyCount = room.players.filter(p => p.readyNext).length;
  room.message = `${readyCount}/4 giocatori pronti per la prossima mano.`;

  if (readyCount === 4) {
    room.handNumber += 1;
    startSetup(room);
  } else {
    broadcast(room);
  }
}

function markNotReady(room, playerIndex) {
  if (room.gameState !== "HAND_OVER") return;

  room.players[playerIndex].readyNext = false;

  const readyCount = room.players.filter(p => p.readyNext).length;
  room.message = `${readyCount}/4 giocatori pronti per la prossima mano.`;

  broadcast(room);
}

function resetMatch(room) {
  room.players.forEach(p => {
    p.hand = [];
    p.totalScore = 0;
    p.handWins = 0;
    p.placementScore = 0;
    p.readyNext = false;
  });

  room.handNumber = 1;
  room.dealerIndex = null;
  room.chosenSuit = null;
  room.starterIndex = null;
  room.turn = null;
  room.openingFiveRequired = false;
  room.currentHandActions = [];
  room.lastPassNotice = null;
  room.matchStartedAt = null;
  room.gameState = "WAITING";
  room.table = createEmptyTable();
  room.message = "Nuova partita. In attesa giocatori...";

  tryStart(room);
  broadcast(room);
}

function abortRoom(room, reason) {
  closeRoomPermanently(room, reason || "Partita terminata.");
}


function clearPlayerReconnectTimer(player) {
  if (!player) return;

  if (player.reconnectTimer) {
    clearTimeout(player.reconnectTimer);
    player.reconnectTimer = null;
  }
}

function clearRoomReconnectTimers(room) {
  if (!room || !room.players) return;
  room.players.forEach(player => clearPlayerReconnectTimer(player));
}

function closeRoomPermanently(room, reason) {
  if (!room) return;
  if (room.closed) return;

  room.closed = true;
  room.gameState = "ABORTED";
  room.message = reason || "Partita terminata.";

  clearRoomReconnectTimers(room);
  broadcast(room);

  setTimeout(() => {
    rooms.delete(room.code);
  }, 1000);
}


function getRoomAndPlayer(ws) {
  const roomCode = ws.roomCode;
  if (!roomCode || !rooms.has(roomCode)) return { room: null, playerIndex: -1 };
  const room = rooms.get(roomCode);
  return { room, playerIndex: room.players.findIndex(p => p.ws === ws) };
}

function joinRoom(ws, room, data) {
  let player = room.players.find(p => p.id === data.playerId);

  if (room.closed) {
    ws.send(JSON.stringify({ type: "error", message: "Questa partita è terminata. Crea una nuova stanza." }));
    return;
  }

  if (player) {
    const oldWs = player.ws;
    const hadReconnectTimer = !!player.reconnectTimer;
    const oldSocketNotOpen = !oldWs || oldWs.readyState !== WebSocket.OPEN;
    const wasDisconnected = !player.connected || hadReconnectTimer || oldSocketNotOpen;

    if (player.reconnectTimer) {
      clearTimeout(player.reconnectTimer);
      player.reconnectTimer = null;
    }

    player.ws = ws;
    player.connected = true;

    if (data.name) player.name = data.name;

    ws.roomCode = room.code;
    ws.playerId = player.id;

    ws.send(JSON.stringify({ type: "joined", playerId: player.id, roomCode: room.code }));

    if (room.gameState === "ABORTED") {
      broadcast(room);
      return;
    }

    // Show "è rientrato" only after a real disconnection:
    // - player was marked offline
    // - reconnect timer was active
    // - previous socket was missing/closed
    // Normal mobile resume with the same open socket must stay silent.
    if (wasDisconnected) {
      room.message = `${player.name} è rientrato.`;
    }

    broadcast(room);
    return;
  }

  if (room.gameState === "ABORTED") {
    ws.send(JSON.stringify({ type: "error", message: "Questa partita è terminata. Crea una nuova stanza." }));
    return;
  }

  if (room.players.length >= 4) {
    ws.send(JSON.stringify({ type: "error", message: "Partita piena." }));
    return;
  }

  player = {
    id: data.playerId || createId(),
    ws,
    name: data.name || `Giocatore ${room.players.length + 1}`,
    hand: [],
    connected: true,
    totalScore: 0,
    handWins: 0,
    placementScore: 0,
    readyNext: false,
    reconnectTimer: null
  };

  room.players.push(player);

  ws.roomCode = room.code;
  ws.playerId = player.id;

  ws.send(JSON.stringify({ type: "joined", playerId: player.id, roomCode: room.code }));

  tryStart(room);
  broadcast(room);
}

function removePlayerExplicitly(ws) {
  const roomCode = ws.roomCode;
  if (!roomCode || !rooms.has(roomCode)) return;

  const room = rooms.get(roomCode);
  if (room.closed) return;

  const index = room.players.findIndex(p => p.ws === ws || p.id === ws.playerId);
  if (index === -1) return;

  const player = room.players[index];

  clearPlayerReconnectTimer(player);

  ws.roomCode = null;
  ws.playerId = null;

  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "left" }));
    }
  } catch {}

  // If a player manually exits once the game has started, close the room permanently.
  // This prevents any pending reconnect timeout from firing later and broadcasting
  // "non è rientrato entro 60 secondi" after everyone has returned home.
  if (["PICK_SUIT", "IN_GAME", "HAND_OVER", "GAME_OVER"].includes(room.gameState)) {
    closeRoomPermanently(room, `${player.name} è uscito. Partita terminata.`);
    return;
  }

  room.players.splice(index, 1);

  if (room.players.length === 0) {
    clearRoomReconnectTimers(room);
    rooms.delete(roomCode);
    return;
  }

  room.message = `${player.name} è uscito dalla stanza.`;
  broadcast(room);
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    const data = JSON.parse(raw);

    if (data.type === "createRoom") {
      const code = generateRoomCode();
      const room = createRoom(code, { matchLength: data.matchLength });
      rooms.set(code, room);
      joinRoom(ws, room, data);
      return;
    }

    if (data.type === "joinRoom") {
      const code = String(data.roomCode || "").trim().toUpperCase();

      if (!rooms.has(code)) {
        ws.send(JSON.stringify({ type: "error", message: "Codice partita non trovato." }));
        return;
      }

      joinRoom(ws, rooms.get(code), data);
      return;
    }

    if (data.type === "leaveRoom") {
      removePlayerExplicitly(ws);
      return;
    }

    const { room, playerIndex } = getRoomAndPlayer(ws);
    if (!room || playerIndex === -1) return;

    if (data.type === "syncState") {
      sendStateToPlayer(room, playerIndex);
      return;
    }

    if (data.type === "chooseSuit") {
      if (room.gameState !== "PICK_SUIT") return;
      if (playerIndex !== room.dealerIndex) return;
      if (!SUITS.includes(data.suit)) return;

      dealAfterSuit(room, data.suit);
    }

    if (data.type === "play") {
      if (room.gameState !== "IN_GAME") return;
      if (playerIndex !== room.turn) return;

      playCard(room, playerIndex, data.index);
      broadcast(room);
    }

    if (data.type === "pass") {
      if (room.gameState !== "IN_GAME") return;
      if (playerIndex !== room.turn) return;

      if (room.openingFiveRequired) {
        room.lastPassNotice = null;
        room.message = "Non puoi passare: devi giocare il 5 del seme scelto.";
      } else if (hasAnyMove(room, room.players[playerIndex])) {
        room.lastPassNotice = null;
        room.message = "Non puoi passare: hai almeno una mossa disponibile.";
      } else {
        room.currentHandActions.push({
          type: "pass",
          playerName: room.players[playerIndex].name
        });

        const fromName = room.players[playerIndex].name;
        room.turn = (room.turn + 1) % room.players.length;
        room.lastPassNotice = { fromName, toIndex: room.turn };
        room.message = `${fromName} passa. Turno di ${room.players[room.turn].name}.`;
      }

      broadcast(room);
    }

    if (data.type === "readyNext") markReady(room, playerIndex);
    if (data.type === "notReadyNext") markNotReady(room, playerIndex);
    if (data.type === "resetMatch") resetMatch(room);
  });

  ws.on("close", () => {
    const roomCode = ws.roomCode;
    if (!roomCode || !rooms.has(roomCode)) return;

    const room = rooms.get(roomCode);
    if (room.closed) return;
    const player = room.players.find(p => p.id === ws.playerId);
    if (!player) return;

    // FIX IMPORTANTE:
    // Se il giocatore si è già ricollegato, player.ws punta al nuovo WebSocket.
    // In quel caso questo close appartiene al vecchio socket e va ignorato.
    if (player.ws !== ws) return;

    player.connected = false;
    room.message = `${player.name} si è disconnesso. Attendo il rientro entro 60 secondi.`;
    broadcast(room);

    if (player.reconnectTimer) {
      clearTimeout(player.reconnectTimer);
      player.reconnectTimer = null;
    }

    player.reconnectTimer = setTimeout(() => {
      if (!rooms.has(roomCode)) return;

      const currentRoom = rooms.get(roomCode);
      const currentPlayer = currentRoom.players.find(p => p.id === player.id);

      if (!currentPlayer) return;

      // Ulteriore protezione: se è rientrato o ha un socket aperto, non terminare.
      if (currentPlayer.connected) return;
      if (currentPlayer.ws && currentPlayer.ws.readyState === WebSocket.OPEN) return;

      if (!currentRoom.closed) {
        abortRoom(currentRoom, `${currentPlayer.name} non è rientrato entro 60 secondi. Partita terminata.`);
      }
    }, RECONNECT_MS);
  });
});

server.listen(process.env.PORT || 10000, () => {
  console.log("Gioco 5 v1.0.8 match length options online");
});
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

function createRoom(code) {
  return {
    code,
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
    openingFiveRequired: false
  };
}

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
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
    .map(p => ({ name: p.name, total: p.totalScore || 0 }))
    .sort((a, b) => a.total - b.total);
}

function broadcast(room) {
  room.players.forEach((p, i) => {
    if (!p.ws || p.ws.readyState !== 1) return;

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
        totalScore: x.totalScore || 0
      })),
      yourIndex: i,
      yourId: p.id,
      dealerIndex: room.dealerIndex,
      chosenSuit: room.chosenSuit,
      starterIndex: room.starterIndex,
      turn: room.turn,
      yourTurn: room.gameState === "IN_GAME" && room.turn === i,
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
  room.players.forEach(p => p.hand = []);

  room.message = `Mano ${room.handNumber}/10. ${room.players[room.dealerIndex].name} deve scegliere il seme.`;
  broadcast(room);
}

function tryStart(room) {
  if (room.gameState === "WAITING" && room.players.length === 4) {
    startSetup(room);
  }
}

function dealAfterSuit(room, suit) {
  room.chosenSuit = suit;
  room.deck = createDeck();
  room.table = createEmptyTable();

  room.players.forEach(p => {
    p.hand = sortHand(room.deck.splice(0, 10));
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
  if (room.openingFiveRequired) {
    return card.suit === room.chosenSuit && card.rank === "5";
  }

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
  const scores = room.players.map(p => {
    const points = p === winner ? 0 : p.hand.length;
    p.totalScore = (p.totalScore || 0) + points;
    return { name: p.name, points };
  });

  room.handResult = {
    winnerName: winner.name,
    scores,
    showStandings: room.handNumber === 5 || room.handNumber === 10,
    final: room.handNumber === 10
  };

  room.gameState = room.handNumber === 10 ? "GAME_OVER" : "HAND_OVER";
  room.message = `${winner.name} ha vinto la mano ${room.handNumber}.`;
}

function playCard(room, playerIndex, cardIndex) {
  const player = room.players[playerIndex];
  const card = player.hand[cardIndex];

  if (!card || !canPlay(room, card)) return;

  const col = room.table[card.suit];
  const value = RANK_VALUE[card.rank];

  if (card.rank === "5") col.five = card;
  else if (value > 5) col.up.push(card);
  else col.down.push(card);

  player.hand.splice(cardIndex, 1);
  player.hand = sortHand(player.hand);
  room.lastCard = { ...card, playerName: player.name };

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

function nextHand(room) {
  if (room.gameState !== "HAND_OVER") return;
  room.handNumber += 1;
  startSetup(room);
}

function resetMatch(room) {
  room.players.forEach(p => {
    p.hand = [];
    p.totalScore = 0;
  });

  room.handNumber = 1;
  room.dealerIndex = null;
  room.chosenSuit = null;
  room.starterIndex = null;
  room.turn = null;
  room.openingFiveRequired = false;
  room.gameState = "WAITING";
  room.table = createEmptyTable();
  room.message = "Nuova partita. In attesa giocatori...";

  tryStart(room);
  broadcast(room);
}

function abortRoom(room, reason) {
  room.gameState = "ABORTED";
  room.message = reason || "Partita terminata.";
  broadcast(room);
}

function getRoomAndPlayer(ws) {
  const roomCode = ws.roomCode;
  if (!roomCode || !rooms.has(roomCode)) return { room: null, playerIndex: -1 };
  const room = rooms.get(roomCode);
  return { room, playerIndex: room.players.findIndex(p => p.ws === ws) };
}

function joinRoom(ws, room, data) {
  let player = room.players.find(p => p.id === data.playerId);

  if (player) {
    player.ws = ws;
    player.connected = true;
    if (player.reconnectTimer) clearTimeout(player.reconnectTimer);
    if (data.name) player.name = data.name;

    ws.roomCode = room.code;
    ws.playerId = player.id;

    ws.send(JSON.stringify({ type: "joined", playerId: player.id, roomCode: room.code }));
    room.message = `${player.name} è rientrato.`;
    broadcast(room);
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
  const index = room.players.findIndex(p => p.ws === ws || p.id === ws.playerId);
  if (index === -1) return;

  const player = room.players[index];

  if (player.reconnectTimer) clearTimeout(player.reconnectTimer);

  room.players.splice(index, 1);

  ws.roomCode = null;
  ws.playerId = null;

  ws.send(JSON.stringify({ type: "left" }));

  if (room.players.length === 0) {
    rooms.delete(roomCode);
    return;
  }

  if (["PICK_SUIT", "IN_GAME", "HAND_OVER", "GAME_OVER"].includes(room.gameState)) {
    abortRoom(room, `${player.name} è uscito. Partita terminata.`);
  } else {
    room.message = `${player.name} è uscito dalla stanza.`;
    broadcast(room);
  }
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    const data = JSON.parse(raw);

    if (data.type === "createRoom") {
      const code = generateRoomCode();
      const room = createRoom(code);
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
        room.message = "Non puoi passare: devi giocare il 5 del seme scelto.";
      } else if (hasAnyMove(room, room.players[playerIndex])) {
        room.message = "Non puoi passare: hai almeno una mossa disponibile.";
      } else {
        room.turn = (room.turn + 1) % room.players.length;
        room.message = `${room.players[playerIndex].name} passa. Turno di ${room.players[room.turn].name}.`;
      }

      broadcast(room);
    }

    if (data.type === "nextHand") nextHand(room);
    if (data.type === "resetMatch") resetMatch(room);
  });

  ws.on("close", () => {
    const roomCode = ws.roomCode;
    if (!roomCode || !rooms.has(roomCode)) return;

    const room = rooms.get(roomCode);
    const player = room.players.find(p => p.id === ws.playerId);
    if (!player) return;

    player.connected = false;
    room.message = `${player.name} si è disconnesso. Attendo il rientro entro 60 secondi.`;
    broadcast(room);

    player.reconnectTimer = setTimeout(() => {
      if (!player.connected && rooms.has(roomCode)) {
        abortRoom(room, `${player.name} non è rientrato entro 60 secondi. Partita terminata.`);
      }
    }, RECONNECT_MS);
  });
});

server.listen(process.env.PORT || 10000, () => {
  console.log("Gioco 5 v0.9.0-beta.1 online");
});
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

let players = [];
let gameState = "WAITING";
let dealerIndex = null;
let chosenSuit = null;
let starterIndex = null;
let turn = null;
let deck = [];
let table = createEmptyTable();
let message = "In attesa giocatori...";
let lastCard = null;
let handNumber = 1;
let handResult = null;
let openingFiveRequired = false;

function createEmptyTable() {
  return {
    CP: { up: [], five: null, down: [] },
    DN: { up: [], five: null, down: [] },
    SP: { up: [], five: null, down: [] },
    BA: { up: [], five: null, down: [] }
  };
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

function standings() {
  return [...players]
    .map(p => ({ name: p.name, total: p.totalScore || 0 }))
    .sort((a, b) => a.total - b.total);
}

function broadcast() {
  players.forEach((p, i) => {
    if (!p.ws || p.ws.readyState !== 1) return;

    p.ws.send(JSON.stringify({
      gameState,
      playersCount: players.length,
      handNumber,
      players: players.map(x => ({
        id: x.id,
        name: x.name,
        cards: x.hand.length,
        connected: x.connected,
        totalScore: x.totalScore || 0
      })),
      yourIndex: i,
      yourId: p.id,
      dealerIndex,
      chosenSuit,
      starterIndex,
      turn,
      yourTurn: gameState === "IN_GAME" && turn === i,
      hand: p.hand,
      table,
      message,
      lastCard,
      handResult,
      standings
    }));
  });
}

function startSetup() {
  gameState = "PICK_SUIT";
  dealerIndex = dealerIndex === null ? Math.floor(Math.random() * players.length) : (dealerIndex + 1) % players.length;
  chosenSuit = null;
  starterIndex = null;
  turn = null;
  table = createEmptyTable();
  handResult = null;
  lastCard = null;
  openingFiveRequired = false;
  players.forEach(p => p.hand = []);
  message = `Mano ${handNumber}/10. ${players[dealerIndex].name} deve scegliere il seme.`;
  broadcast();
}

function tryStart() {
  if (gameState === "WAITING" && players.length === 4) startSetup();
}

function dealAfterSuit(suit) {
  chosenSuit = suit;
  deck = createDeck();
  table = createEmptyTable();

  players.forEach(p => {
    p.hand = sortHand(deck.splice(0, 10));
  });

  starterIndex = players.findIndex(p =>
    p.hand.some(c => c.suit === chosenSuit && c.rank === "5")
  );

  turn = starterIndex;
  gameState = "IN_GAME";
  openingFiveRequired = true;

  message = `${players[dealerIndex].name} ha scelto ${chosenSuit}. ${players[starterIndex].name} deve aprire giocando il 5.`;

  broadcast();
}

function canPlay(card) {
  if (openingFiveRequired) {
    return card.suit === chosenSuit && card.rank === "5";
  }

  const col = table[card.suit];
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

function hasAnyMove(player) {
  return player.hand.some(canPlay);
}

function finishHand(winner) {
  const scores = players.map(p => {
    const points = p === winner ? 0 : p.hand.length;
    p.totalScore = (p.totalScore || 0) + points;
    return { name: p.name, points };
  });

  handResult = {
    winnerName: winner.name,
    scores,
    showStandings: handNumber === 5 || handNumber === 10,
    final: handNumber === 10
  };

  gameState = handNumber === 10 ? "GAME_OVER" : "HAND_OVER";
  message = `${winner.name} ha vinto la mano ${handNumber}.`;
}

function playCard(playerIndex, cardIndex) {
  const player = players[playerIndex];
  const card = player.hand[cardIndex];
  if (!card || !canPlay(card)) return;

  const col = table[card.suit];
  const value = RANK_VALUE[card.rank];

  if (card.rank === "5") col.five = card;
  else if (value > 5) col.up.push(card);
  else col.down.push(card);

  player.hand.splice(cardIndex, 1);
  player.hand = sortHand(player.hand);
  lastCard = { ...card, playerName: player.name };

  if (openingFiveRequired) {
    openingFiveRequired = false;
    turn = (playerIndex + 1) % players.length;
    message = `${player.name} apre con il 5. Turno di ${players[turn].name}.`;
    return;
  }

  if (player.hand.length === 0) {
    finishHand(player);
    return;
  }

  turn = (turn + 1) % players.length;
  message = `${player.name} ha giocato. Turno di ${players[turn].name}.`;
}

function nextHand() {
  if (gameState !== "HAND_OVER") return;
  handNumber += 1;
  startSetup();
}

function resetMatch() {
  players.forEach(p => {
    p.hand = [];
    p.totalScore = 0;
  });
  handNumber = 1;
  dealerIndex = null;
  chosenSuit = null;
  starterIndex = null;
  turn = null;
  openingFiveRequired = false;
  gameState = "WAITING";
  table = createEmptyTable();
  message = "Nuova partita. In attesa giocatori...";
  tryStart();
  broadcast();
}

function createId() {
  return "p_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    const data = JSON.parse(raw);

    if (data.type === "join") {
      let player = players.find(p => p.id === data.playerId);

      if (player) {
        player.ws = ws;
        player.connected = true;
        if (data.name) player.name = data.name;
        ws.send(JSON.stringify({ type: "joined", playerId: player.id }));
        broadcast();
        return;
      }

      if (players.length >= 4) {
        ws.send(JSON.stringify({ gameState: "FULL", message: "Partita piena." }));
        return;
      }

      player = {
        id: data.playerId || createId(),
        ws,
        name: data.name || `Giocatore ${players.length + 1}`,
        hand: [],
        connected: true,
        totalScore: 0
      };

      players.push(player);
      ws.send(JSON.stringify({ type: "joined", playerId: player.id }));

      tryStart();
      broadcast();
      return;
    }

    const i = players.findIndex(p => p.ws === ws);
    if (i === -1) return;

    if (data.type === "chooseSuit") {
      if (gameState !== "PICK_SUIT") return;
      if (i !== dealerIndex) return;
      if (!SUITS.includes(data.suit)) return;
      dealAfterSuit(data.suit);
    }

    if (data.type === "play") {
      if (gameState !== "IN_GAME") return;
      if (i !== turn) return;
      playCard(i, data.index);
      broadcast();
    }

    if (data.type === "pass") {
      if (gameState !== "IN_GAME") return;
      if (i !== turn) return;

      if (openingFiveRequired) {
        message = "Non puoi passare: devi giocare il 5 del seme scelto.";
      } else if (hasAnyMove(players[i])) {
        message = "Non puoi passare: hai almeno una mossa disponibile.";
      } else {
        turn = (turn + 1) % players.length;
        message = `${players[i].name} passa. Turno di ${players[turn].name}.`;
      }

      broadcast();
    }

    if (data.type === "nextHand") nextHand();
    if (data.type === "resetMatch") resetMatch();
  });

  ws.on("close", () => {
    const p = players.find(x => x.ws === ws);
    if (p) p.connected = false;
    broadcast();
  });
});

server.listen(process.env.PORT || 10000, () => {
  console.log("Gioco 5 V2 online");
});
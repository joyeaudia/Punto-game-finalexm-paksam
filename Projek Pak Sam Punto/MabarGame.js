// -------- Game state --------
const gameState = {
  players: [
    { id:1, name:'Player 1', color:'red', cards:[], deck:[], isCurrent:true }
  ],

  board: Array(9).fill().map(()=>Array(9).fill(null)),
  currentPlayerIndex:0,
  selectedCard:null,
  gameStarted:false,
  gameOver:false,
  firstMove:true,
  moveHistory:[],
  futureMoves:[],
  maxHistorySize:200,
  rulesVisible:false
};

// Multiplayer setup
// Multiplayer setup
let socket = null;
let roomCode = null;
let isHost = false;
let myPlayerIndex = 1; // default (host starts as Player 1)
let lastId = null;

// === Read room code from URL (e.g., ?room=123456) ===
const urlParams = new URLSearchParams(window.location.search);
const providedRoomCode = urlParams.get("room");
const isHostFlag = urlParams.get("host") === "1";

console.log("🧭 URL Params:", Object.fromEntries(urlParams.entries()));

if (providedRoomCode) {
  roomCode = providedRoomCode;
  isHost = isHostFlag;
  console.log(isHost ? "🏠 Hosting room:" : "🎮 Joining existing room:", roomCode);
} else {
  console.log("🆕 No room provided — will create one manually");
  gameState.players = [];
}

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function broadcastGameState() {
  if (socket && roomCode) {
    console.log("🔄 Broadcasting updated gameState to room:", roomCode);
    socket.emit("stateUpdate", { room: roomCode, state: gameState });
  }
}

function connectSocket() {
  socket = io("https://5bf1e889-0f49-4505-abe7-df4e1d9da94d-00-111lj6mjzmah5.kirk.replit.dev/");
  const params = new URLSearchParams(window.location.search);
  const urlRoomCode = params.get("room");

  socket.on("connect", () => {
    console.log("✅ Connected to server");
    if (roomCode) {
      if (isHost) socket.emit("createRoom", roomCode);
      else socket.emit("joinRoom", roomCode);
    } else {
      console.warn("⚠️ No room code found in URL!");
    }
  });
    
  socket.on("roomJoined", ({ code, playerId, playerIndex }) => {
    roomCode = code;

    myPlayerIndex = playerIndex; // directly use the server-assigned index

    localStorage.setItem("lastRoomCode", code);
    updateRoomInfoButton(code);
    const infoDiv = document.getElementById("room-info");
    if (infoDiv) infoDiv.textContent = `You are Player ${myPlayerIndex}`;
  });

  socket.on("playerJoined", ({ playerIndex }) => {
    if (!isHost) return; // only host adds new player

    // find next available slot
    const usedIds = gameState.players.map(p => p.id);
    const nextId = getNextAvailablePlayerId();
    if (!nextId) return alert("Max 4 players reached");


    const colors = ["red", "blue", "yellow", "green"];
    const newPlayer = {
      id: nextId,
      name: `Player ${nextId}`,
      color: colors[nextId-1],
      cards: [],
      deck: [],
      isCurrent: false
    };

    gameState.players.push(newPlayer);
    initializePlayerCards();
    updatePlayerCardsDisplay(newPlayer);
    updateCurrentPlayerDisplay();

    broadcastGameState();
  });

  socket.on("stateUpdate", (remoteState) => {
    console.log("🛰️ Received updated state from server:", remoteState);
    const newState = JSON.parse(JSON.stringify(remoteState));
    for (const key in gameState) delete gameState[key];
    Object.assign(gameState, newState);

    updateBoardDisplay();
    gameState.players.forEach(p => updatePlayerCardsDisplay(p));
    updatePlayerHighlights();
    updateCurrentPlayerDisplay();
    showSelectedCardFromState();

    triggerAITurn();

    const current = gameState.players[gameState.currentPlayerIndex];
    if (myPlayerIndex === current.id)
      gameMessage.textContent = `Your turn (${current.name})`;
    else
      gameMessage.textContent = `${current.name}'s turn`;
  });
}


// Example: room object
const room = {
  players: []  // array of player objects { id: 'player1', type: 'human' | 'ai', name: '...' }
};

// When host creates room
function createRoom(hostName) {
  const hostPlayer = { id: 'player1', type: 'human', name: hostName };
  room.players.push(hostPlayer);
  console.log('Host set as player1', room.players);
}

// When someone joins
function joinRoom(playerName, playerType = 'human') {
  // Find the next available player number
  let nextNumber = 2; // start from 2 because host is player1
  const existingIds = room.players.map(p => p.id); // ['player1', 'player2', ...]

  while (existingIds.includes('player' + nextNumber)) {
    nextNumber++;
  }

  const newPlayer = {
    id: 'player' + nextNumber,
    type: playerType,
    name: playerName
  };

  room.players.push(newPlayer);
  console.log(`${playerName} joined as ${newPlayer.id}`, room.players);
}

function getNextAvailablePlayerId() {
  const usedIds = gameState.players.map(p => p.id) // human & AI players
    .concat(Object.keys(aiPlayers).filter(id => aiPlayers[id]).map(Number));
  
  for (let i = 1; i <= 4; i++) {
    if (!usedIds.includes(i)) return i;
  }
  return null; // max players reached
}


const createRoomBtn = document.getElementById("create-room-btn");
const joinRoomBtn = document.getElementById("join-room-btn");
const roomCodeInput = document.getElementById("room-code-input");
const roomInfoBtn = document.getElementById("room-info-btn");

function updateRoomInfoButton(code) {
  if (!roomInfoBtn) return;
  roomInfoBtn.textContent = `Room: ${code}`;
}

if (roomInfoBtn) {
  roomInfoBtn.addEventListener("click", () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode)
      .then(() => {
        console.log("📋 Room code copied:", roomCode);
        roomInfoBtn.textContent = `✅ Copied! (${roomCode})`;
        setTimeout(() => updateRoomInfoButton(roomCode), 1200);
      })
      .catch(() => {
        window.prompt("Copy this room code manually:", roomCode);
      });
  });
}

if (createRoomBtn) {
  createRoomBtn.addEventListener("click", () => {
    if (!socket) connectSocket();
    const code = generateRoomCode();
    isHost = true;

    // reset players for new room
    gameState.players = [{
      id: 1,
      name: 'Player 1',
      color: 'red',
      cards: [],
      deck: [],
      isCurrent: true
    }];
    myPlayerIndex = 1;

    socket.emit("createRoom", code);
    document.getElementById("room-info").textContent = "Creating room...";
    startRestartGame();
  });
}

if (joinRoomBtn) {
  joinRoomBtn.addEventListener("click", () => {
    const code = roomCodeInput.value.trim().toUpperCase();
    if (!code) return alert("Enter a valid room code");
    if (!socket) connectSocket();
    socket.emit("joinRoom", code);
    document.getElementById("room-info").textContent = "Joining room...";
  });
}

// === AI Player Management (Add / Remove buttons) ===
const aiPlayers = {1:false,2:false,3:false,4:false};
const addAiBtn = document.getElementById("add-ai-btn");
const removeAiBtn = document.getElementById("remove-ai-btn");
const aiStatus = document.getElementById("ai-status");

function updateAiStatus() {
  const active = Object.entries(aiPlayers)
    .filter(([_, v]) => v)
    .map(([id]) => `Player ${id} (AI)`);
  aiStatus.textContent = active.length
    ? `AI active: ${active.join(", ")}`
    : "No AI players added.";
}

function removeAI(id){
  // clear AI map
  aiPlayers[id] = false;

  // remove from players array
  const idx = gameState.players.findIndex(p => p.id === id);
  if (idx !== -1) gameState.players.splice(idx, 1);

  // remove cards UI
  const cardsEl = document.getElementById(`player${id}-cards`);
  if (cardsEl) cardsEl.innerHTML = '';

  // remove player highlight/display
  const playerEl = document.getElementById(`player${id}`);
  if (playerEl) playerEl.classList.remove('current-player');

  updatePlayerHighlights();
  updateAiStatus();
  updateAiButtons();

  broadcastGameState();
}


// Add AI player (up to 4)
addAiBtn.addEventListener("click", () => {
  if (!isHost) {
    alert("Only the host can add AI players.");
    return;
  }

  const humanCount = gameState.players.filter(p => !aiPlayers[p.id]).length;
  let nextId = null;
  for (let i = 1; i <= 4; i++) {
    if (!gameState.players.some(p => p.id === i)) {
      nextId = i;
      break;
    }
  }
  if (!nextId) { alert("Max 4 players"); return; }


  const colors = ["red", "blue", "yellow", "green"];
  const newPlayer = {
    id: nextId,
    name: `Player ${nextId} (AI)`,
    color: colors[nextId - 1],
    cards: [],
    deck: [],
    isCurrent: false,
  };

  // After adding AI
  aiPlayers[nextId] = true;
  gameState.players.push(newPlayer);
  initializePlayerCards();
  updatePlayerCardsDisplay(newPlayer);
  updateCurrentPlayerDisplay();
  updateAiStatus();
  updateAiButtons();
  gameMessage.textContent = `${newPlayer.name} added.`;

  // After removing AI
  aiPlayers[lastId] = false;
  const index = gameState.players.findIndex(p => p.id === lastId);
  if (index !== -1) gameState.players.splice(index, 1);
  updatePlayerHighlights();
  updateAiStatus();
  updateAiButtons();
  gameMessage.textContent = `AI Player ${lastId} removed.`;

  // Broadcast the new player state to all clients
  broadcastGameState();
});

// Remove last AI player
removeAiBtn.addEventListener("click", () => {
  if (!isHost) return alert("Only host can remove AI");
  const aiIds = Object.keys(aiPlayers).filter(id => aiPlayers[id]).map(Number);
  if (aiIds.length === 0) return alert("No AI players to remove");
  const lastId = aiIds[aiIds.length-1];
  removeAI(lastId);
  gameMessage.textContent = `AI Player ${lastId} removed.`;
});

// Initialize display
updateAiStatus();

// DOM refs
const gameBoard = document.getElementById('game-board');
const gameMessage = document.getElementById('game-message');
const currentPlayerDisplay = document.getElementById('current-player');
const selectedCardDisplay = document.getElementById('selected-card-display');
const startRestartGameBtn = document.getElementById('start-restart-game');
const rulesBtn = document.getElementById('rules-btn');
const rulesPanel = document.getElementById('rules-panel');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');

// Buttons for quick P v C mode
const startPvcBtn = document.getElementById('start-pvc');
const stopPvcBtn = document.getElementById('stop-pvc');

// Move history snapshot
class GameMove {
  constructor(board, players, currentPlayerIndex, firstMove, selectedCard){
    this.board = JSON.parse(JSON.stringify(board));
    this.players = JSON.parse(JSON.stringify(players));
    this.currentPlayerIndex = currentPlayerIndex;
    this.firstMove = firstMove;
    this.selectedCard = selectedCard ? {...selectedCard} : null;
    this.timestamp = Date.now();
  }
}

// -------- Utilities --------
function shuffle(arr){
  for (let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

// ----------------- Player1 image helpers & preview -----------------

/**
 * Menghasilkan daftar path kandidat untuk gambar kartu.
 * Prioritas (saat ini): jika ownerId===1 -> images/player1/<value>.*,
 * lalu images/<color>/<value>.*, lalu images/generic/<value>.*, lalu placeholder.
 */
function getCandidateImagePaths(card, ownerId = null){
  const paths = [];

  // Kalau ada ownerId (1–4), coba cari folder khusus "krt", "krt2", "krt3", "krt4"
  if (ownerId !== null) {
    // player 1 = "krt", player 2 = "krt2", dst
    const folder = ownerId === 1 ? "krt" : `krt${ownerId}`;
    paths.push(`${folder}/py${card.value}.png`);
  }

  // fallback per-color (misal images/red/5.png)
  if (card.color){
    paths.push(`images/${card.color}/${card.value}.png`);
  }

  // generic fallback
  paths.push(`images/generic/${card.value}.png`);
  // placeholder terakhir
  paths.push(`images/placeholder.png`);

  return paths;
}



/**
 * Buat <img> yang mencoba srcList berurutan. Jika semua gagal, img disembunyikan.
 */
function createImgWithFallback(srcList, altText = ''){
  const img = document.createElement('img');
  img.alt = altText;
  img.dataset._tryIndex = 0;
  img.style.display = 'block';
  img.src = srcList[0];
  img.onerror = function(){
    let i = parseInt(this.dataset._tryIndex || '0', 10) + 1;
    if (i < srcList.length){
      this.dataset._tryIndex = i;
      this.src = srcList[i];
    } else {
      this.style.display = 'none';
    }
  };
  return img;
}

/**
 * Tampilkan preview selected card (dipakai di control panel).
 * ownerId opsional untuk prioritas gambar player1.
 */
function showSelectedCardPreview(card, ownerId = null){
  selectedCardDisplay.innerHTML = '';

  // If card is null, show placeholder and return
  if (!card) {
    const placeholder = document.createElement('div');
    placeholder.textContent = 'No card selected';
    placeholder.className = 'no-card';
    selectedCardDisplay.appendChild(placeholder);
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = `player-card ${card.color}`;
  const candidatePaths = getCandidateImagePaths(card, ownerId);
  const img = createImgWithFallback(candidatePaths, `${card.color} ${card.value}`);
  wrapper.appendChild(img);

  const badge = document.createElement('span');
  badge.className = 'card-number';
  badge.textContent = card.value;
  wrapper.appendChild(badge);

  selectedCardDisplay.appendChild(wrapper);
}


/**
 * Setelah undo/redo/restore, state.gameState.selectedCard mungkin berisi
 * {playerId, cardIndex} atau null. Fungsi ini menampilkan preview sesuai state.
 */
function showSelectedCardFromState(){
  const sc = gameState.selectedCard;
  if (!sc) return showSelectedCardPreview(null);
  const p = gameState.players.find(pp=>pp.id === sc.playerId);
  if (!p) return showSelectedCardPreview(null);
  const card = p.cards[sc.cardIndex];
  if (!card) return showSelectedCardPreview(null);
  showSelectedCardPreview(card, p.id);
}


function initializeBoard(){
  gameBoard.innerHTML = '';
  for (let r=0;r<9;r++){
    for (let c=0;c<9;c++){
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      if (r===4 && c===4) cell.classList.add('center-cell');
      cell.addEventListener('click', ()=> handleCellClick(r,c));
      gameBoard.appendChild(cell);
    }
  }
}

// create deck: two sets of 1..9 per color => 18 cards
function createFullDecks(){
  const decks = { red: [], blue: [], yellow: [], green: [] };
  for (let set=0; set<2; set++){
    for (let i=1;i<=9;i++){
      decks.red.push({value:i,color:'red'});
      decks.blue.push({value:i,color:'blue'});
      decks.yellow.push({value:i,color:'yellow'});
      decks.green.push({value:i,color:'green'});
    }
  }
  return decks;
}

function initializePlayerCards(){
  const decks = createFullDecks();
  gameState.players.forEach(player=>{
    const playerDeck = shuffle([...decks[player.color]]);
    player.deck = playerDeck.slice();
    player.cards = player.deck.slice(0,3);
    player.deck = player.deck.slice(3);
    updatePlayerCardsDisplay(player);
  });
}

function drawCard(player){
  if (player.deck.length>0){
    const card = player.deck.shift();
    player.cards.push(card);
    updatePlayerCardsDisplay(player);
    return true;
  }
  return false;
}

function updatePlayerCardsDisplay(player){
  const container = document.getElementById(`player${player.id}-cards`);
  container.innerHTML = '';
player.cards.forEach((card, idx)=>{
  const el = document.createElement('div');
  el.className = `player-card ${card.color}`;
  const candidatePaths = getCandidateImagePaths(card, player.id);
  const img = createImgWithFallback(candidatePaths, `${card.color} ${card.value}`);
  el.appendChild(img);
  const badge = document.createElement('span');
  badge.className = 'card-number';
  badge.textContent = card.value;
  el.appendChild(badge);
  el.addEventListener('click', ()=> handleCardSelect(player.id, idx));

  // 💡 Tambahkan ini
  if (player.id === 4 && card.value === 9) {
    el.classList.add('special-card');
  }

  container.appendChild(el);
});
  updatePlayerHighlights();
}


function updatePlayerHighlights(){
  gameState.players.forEach(p=>{
    const el = document.getElementById(`player${p.id}`);
    if (p.isCurrent) el.classList.add('current-player'); else el.classList.remove('current-player');
  });
}

function updateCurrentPlayerDisplay(){
  currentPlayerDisplay.textContent = `${gameState.players[gameState.currentPlayerIndex].name}'s Turn`;
  // broadcastGameState();

}

function updateBoardDisplay(){
  for (let r=0;r<9;r++){
    for (let c=0;c<9;c++){
      const cell = gameState.board[r][c];
      const el = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
      if (cell){
        el.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.className = `card ${cell.color}`; // fallback warna class
        const candidatePaths = getCandidateImagePaths(cell, cell.playerId);
        const img = createImgWithFallback(candidatePaths, `${cell.color} ${cell.value}`);
        wrapper.appendChild(img);
        const badge = document.createElement('span');
        badge.className = 'card-number';
        badge.textContent = cell.value;
        wrapper.appendChild(badge);
        el.appendChild(wrapper);
        el.classList.add('occupied');
      } else {
        el.innerHTML = '';
        el.classList.remove('occupied');
      }
    }
  }
}


// -------- History (undo/redo) --------
function saveMoveToHistory(){
  const mv = new GameMove(gameState.board, gameState.players, gameState.currentPlayerIndex, gameState.firstMove, gameState.selectedCard);
  gameState.moveHistory.push(mv);
  gameState.futureMoves = [];
  if (gameState.moveHistory.length > gameState.maxHistorySize) gameState.moveHistory.shift();
  updateUndoRedoButtons();
}

function undoMove(){
  if (gameState.moveHistory.length===0 || gameState.gameOver) return;
  const last = gameState.moveHistory.pop();
  gameState.futureMoves.push(last);
  gameState.board = last.board;
  gameState.players = last.players;
  gameState.currentPlayerIndex = last.currentPlayerIndex;
  gameState.firstMove = last.firstMove;
  gameState.selectedCard = last.selectedCard;
  gameState.gameOver = false;

  updateBoardDisplay();
  gameState.players.forEach(p=>updatePlayerCardsDisplay(p));
  updatePlayerHighlights();
  updateCurrentPlayerDisplay();
  showSelectedCardFromState();

  gameMessage.textContent = "Move undone";
  updateUndoRedoButtons();
}


function redoMove(){
  if (gameState.futureMoves.length===0 || gameState.gameOver) return;
  const next = gameState.futureMoves.pop();
  gameState.moveHistory.push(next);
  gameState.board = next.board;
  gameState.players = next.players;
  gameState.currentPlayerIndex = next.currentPlayerIndex;
  gameState.firstMove = next.firstMove;
  gameState.selectedCard = next.selectedCard;
  updateBoardDisplay();
  gameState.players.forEach(p=>updatePlayerCardsDisplay(p));
  // after restoring board & players...
  updatePlayerHighlights();
  updateCurrentPlayerDisplay();
  showSelectedCardFromState();

  gameMessage.textContent = "Move redone";
  updateUndoRedoButtons();
}

function updateUndoRedoButtons(){
  undoBtn.disabled = gameState.moveHistory.length===0 || gameState.gameOver;
  redoBtn.disabled = gameState.futureMoves.length===0 || gameState.gameOver;
}

function updateAiButtons() {
  const addAIButton = document.getElementById('add-ai-btn');
  const removeAIButton = document.getElementById('remove-ai-btn');

  // Enable Remove AI only if at least 1 AI exists
  const hasAI = Object.values(aiPlayers).some(v => v);
  removeAIButton.disabled = !hasAI;

  // Enable Add AI only if total players < 4
  addAIButton.disabled = gameState.players.length >= 4;
}


// -------- Selection & placement --------
function handleCardSelect(playerId, cardIndex) {
  const current = gameState.players[gameState.currentPlayerIndex];

  // human restriction: only block clicks from humans who are not current
  if (!aiPlayers[current.id] && myPlayerIndex !== current.id) return;

  const player = gameState.players.find(p => p.id === playerId);
  if (!player.isCurrent) return;

  gameState.selectedCard = { playerId, cardIndex };
  const curCards = document.querySelectorAll(`#player${playerId}-cards .player-card`);
  if (curCards[cardIndex]) curCards[cardIndex].classList.add('selected');
  const card = player.cards[cardIndex];
  showSelectedCardPreview(card, playerId);

  if (gameState.firstMove) 
      gameMessage.textContent = `Selected: ${card.color} ${card.value}. Place at center (4,4).`;
  else 
      gameMessage.textContent = `Selected: ${card.color} ${card.value}. Choose a valid board position.`;
}



function isValidMove(row,col,card){
  if (gameState.firstMove){
    return row===4 && col===4;
  } else {
    const existing = gameState.board[row][col];
    if (existing !== null){
      if (card.value > existing.value) return true;
      return false;
    }
    for (let i=-1;i<=1;i++){
      for (let j=-1;j<=1;j++){
        if (i===0 && j===0) continue;
        const nr=row+i, nc=col+j;
        if (nr>=0 && nr<9 && nc>=0 && nc<9){
          if (gameState.board[nr][nc] !== null) return true;
        }
      }
    }
    return false;
  }
}

function performPlacement(player, cardIndex, row, col) {
  console.log(`🔍 performPlacement(${player.name}, row=${row}, col=${col})`);
  const card = player.cards[cardIndex];
  // if (!isValidMove(row, col, card)) return false;
  const valid = isValidMove(row, col, card);
  console.log("✅ isValidMove?", valid, "firstMove:", gameState.firstMove);
  if (!valid) return false;

  // Save history before any change
  saveMoveToHistory();

  // --- Perform placement ---
  gameState.board[row][col] = { value: card.value, color: card.color, playerId: player.id };
  player.cards.splice(cardIndex, 1);
  drawCard(player);

  updateBoardDisplay();
  updatePlayerCardsDisplay(player);

  if (gameState.firstMove) {
    gameState.firstMove = false;
    const center = document.querySelector('.cell.center-cell');
    if (center) center.classList.remove('center-cell');
  }

  // --- Win check ---
  let moveCompleted = false;
  if (checkWinCondition(player.id, row, col)) {
    gameState.gameOver = true;
    gameMessage.textContent = `${player.name} wins! Four ${player.color} in a row!`;
    highlightWinningCells(player.id);
    gameState.selectedCard = null;
    showSelectedCardPreview(null);
    startRestartGameBtn.textContent = 'Restart Game';
    updateUndoRedoButtons();
    moveCompleted = true;
  } else {
    nextPlayer();
    gameState.selectedCard = null;
    showSelectedCardPreview(null);
    document.querySelectorAll('.player-card.selected').forEach(el => el.classList.remove('selected'));

    if (!hasValidMoves()) {
      gameState.gameOver = true;
      gameMessage.textContent = "Game over! No valid moves remaining.";
      startRestartGameBtn.textContent = 'Restart Game';
    }

    updateUndoRedoButtons();
    moveCompleted = true;
  }

  if (moveCompleted) { //DEBUGGING
    console.log("✅ moveCompleted fired. isHost:", isHost, "roomCode:", roomCode);

    if (socket && roomCode) {
      const snapshot = JSON.parse(JSON.stringify(gameState));
      console.log("🔄 Host broadcasting updated gameState to room:", roomCode);
      socket.emit("stateUpdate", { room: roomCode, state: snapshot });
    } else {
      console.warn("⚠️ Not broadcasting — reason:", {
        isHost,
        socketExists: !!socket,
        roomCode
      });
    }
  }

  return true;
}


function handleCellClick(row, col) {
  console.log(`🖱️ Cell clicked at (${row}, ${col})`);

  // Block invalid states early
  if (!gameState.gameStarted) {
    console.warn("⚠️ Game not started yet.");
    return;
  }
  if (gameState.gameOver) {
    console.warn("⚠️ Game is over, clicks disabled.");
    return;
  }
  if (!gameState.selectedCard) {
    console.warn("⚠️ No card selected, cannot place.");
    return;
  }

  // Only allow the current player's turn
  const current = gameState.players[gameState.currentPlayerIndex];
  if (myPlayerIndex !== current.id) {
    console.warn("⚠️ Not your turn. Current player:", current.name);
    return;
  }

  const player = gameState.players.find(p => p.id === gameState.selectedCard.playerId);
  if (!player) {
    console.error("❌ Could not find player for selectedCard.");
    return;
  }
  if (!player.isCurrent) {
    console.warn("⚠️ Selected player is not current:", player.name);
    return;
  }

  const cardIndex = gameState.selectedCard.cardIndex;
  console.log(`🎴 Attempting placement for ${player.name}, cardIndex=${cardIndex}`);

  const placed = performPlacement(player, cardIndex, row, col);
  console.log("🧩 performPlacement() returned:", placed);

  if (!placed) {
    if (gameState.firstMove) gameMessage.textContent = "First move must be center (4,4).";
    else gameMessage.textContent = "Invalid move! Choose an adjacent empty square or valid stack.";
  }
}


// -------- Win detection & highlight --------
function checkWinCondition(playerId,row,col){
  const color = gameState.players.find(p=>p.id===playerId).color;
  // horizontal
  for (let c=0;c<=5;c++){
    let cnt=0;
    for (let i=0;i<4;i++){
      const cell = gameState.board[row][c+i];
      if (cell && cell.color===color) cnt++; else break;
    }
    if (cnt===4) return true;
  }
  // vertical
  for (let r=0;r<=5;r++){
    let cnt=0;
    for (let i=0;i<4;i++){
      const cell = gameState.board[r+i][col];
      if (cell && cell.color===color) cnt++; else break;
    }
    if (cnt===4) return true;
  }
  // diag down-right
  for (let r=0;r<=5;r++){
    for (let c=0;c<=5;c++){
      let cnt=0;
      for (let i=0;i<4;i++){
        const cell = gameState.board[r+i][c+i];
        if (cell && cell.color===color) cnt++; else break;
      }
      if (cnt===4) return true;
    }
  }
  // diag down-left
  for (let r=0;r<=5;r++){
    for (let c=3;c<9;c++){
      let cnt=0;
      for (let i=0;i<4;i++){
        const cell = gameState.board[r+i][c-i];
        if (cell && cell.color===color) cnt++; else break;
      }
      if (cnt===4) return true;
    }
  }
  return false;
}

function highlightWinningCells(playerId){
  const color = gameState.players.find(p=>p.id===playerId).color;
  for (let r=0;r<9;r++){
    for (let c=0;c<9;c++){
      const cell = gameState.board[r][c];
      if (cell && cell.color===color){
        const el = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
        if (el) el.classList.add('winning-cells');
      }
    }
  }
}

function hasValidMoves(){
  for (const p of gameState.players){
    if (p.cards.length===0) continue;
    for (let r=0;r<9;r++){
      for (let c=0;c<9;c++){
        for (const card of p.cards){
          if (isValidMove(r,c,card)) return true;
        }
      }
    }
  }
  return false;
}

// -------- Next player & AI trigger --------
function nextPlayer() {
    const prev = gameState.players[gameState.currentPlayerIndex];
    prev.isCurrent = false;

    // Move to next player
    gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    const cur = gameState.players[gameState.currentPlayerIndex];
    cur.isCurrent = true;

    updatePlayerHighlights();
    updateCurrentPlayerDisplay();

    console.log("➡️ Next player:", cur.name, "ID:", cur.id);

    // If player has no cards, skip turn
    if (cur.cards.length === 0) {
        gameMessage.textContent = `${cur.name} has no cards. Turn skipped.`;
        setTimeout(nextPlayer, 250); // short delay for UX
        return;
    }

    gameMessage.textContent = `${cur.name}'s turn. Select a card.`;

    // ✅ Only host runs AI moves
    if (isHost && aiPlayers[cur.id] && !gameState.gameOver) {
        console.log("🤖 AI is taking turn for:", cur.name);
        setTimeout(() => computerMove(cur), 300);
    }
}

// -------- AI (heuristic) --------
function simulatePlaceAndCheck(board,row,col,color,value){
  const tmp = board.map(r=> r.map(cell => cell ? {...cell} : null));
  tmp[row][col] = { color, value };
  // horizontal
  for (let r=0;r<9;r++){
    for (let c=0;c<=5;c++){
      let cnt=0;
      for (let i=0;i<4;i++){
        const cell = tmp[r][c+i];
        if (cell && cell.color===color) cnt++; else break;
      }
      if (cnt===4) return true;
    }
  }
  // vertical
  for (let c=0;c<9;c++){
    for (let r=0;r<=5;r++){
      let cnt=0;
      for (let i=0;i<4;i++){
        const cell = tmp[r+i][c];
        if (cell && cell.color===color) cnt++; else break;
      }
      if (cnt===4) return true;
    }
  }
  // diag down-right
  for (let r=0;r<=5;r++){
    for (let c=0;c<=5;c++){
      let cnt=0;
      for (let i=0;i<4;i++){
        const cell = tmp[r+i][c+i];
        if (cell && cell.color===color) cnt++; else break;
      }
      if (cnt===4) return true;
    }
  }
  // diag down-left
  for (let r=0;r<=5;r++){
    for (let c=3;c<9;c++){
      let cnt=0;
      for (let i=0;i<4;i++){
        const cell = tmp[r+i][c-i];
        if (cell && cell.color===color) cnt++; else break;
      }
      if (cnt===4) return true;
    }
  }
  return false;
}

function evaluateMove(row,col,card,player){
  let score = 0;
  const color = player.color;
  // immediate win
  if (simulatePlaceAndCheck(gameState.board,row,col,color,card.value)){
    score += 100000;
    return score;
  }
  // stacking advantage
  const existing = gameState.board[row][col];
  if (existing && card.value > existing.value) score += 250;
  // extend own adjacent
  let extend=0;
  for (let i=-1;i<=1;i++){
    for (let j=-1;j<=1;j++){
      if (i===0 && j===0) continue;
      const nr=row+i, nc=col+j;
      if (nr>=0 && nr<9 && nc>=0 && nc<9){
        const cell = gameState.board[nr][nc];
        if (cell && cell.color===color) extend++;
      }
    }
  }
  score += extend * 80;
  // block opponent immediate win
  for (const opp of gameState.players){
    if (opp.id === player.id) continue;
    for (const oppCard of opp.cards){
      if (isValidMove(row,col,oppCard)){
        if (simulatePlaceAndCheck(gameState.board,row,col,opp.color,oppCard.value)){
          score += 450;
        }
      }
    }
  }
  // prefer center-ish
  const centerDist = Math.abs(row-4)+Math.abs(col-4);
  score -= centerDist * 4;
  score += Math.random() * 8;
  return score;
}

function triggerAITurn() {
    const current = gameState.players[gameState.currentPlayerIndex];
    if (isHost && aiPlayers[current.id] && !gameState.gameOver) {
        console.log("🤖 AI turn triggered:", current.name);
        setTimeout(() => computerMove(current), 300);
    }
}


function computerMove(player){
  if (!player || player.cards.length===0 || gameState.gameOver) return;
  let best = {score:-Infinity, row:null, col:null, cardIndex:null};
  for (let ci=0; ci<player.cards.length; ci++){
    const card = player.cards[ci];
    for (let r=0;r<9;r++){
      for (let c=0;c<9;c++){
        if (!isValidMove(r,c,card)) continue;
        const sc = evaluateMove(r,c,card,player);
        if (sc > best.score){
          best.score = sc; best.row = r; best.col = c; best.cardIndex = ci;
        }
      }
    }
  }
  if (best.cardIndex !== null){
    performPlacement(player, best.cardIndex, best.row, best.col);
    gameMessage.textContent = `${player.name} (AI) placed a card.`;
  } else {
    gameMessage.textContent = `${player.name} (AI) has no valid move and is skipped.`;
    nextPlayer();
  }

  if (socket && roomCode && isHost){
    broadcastGameState();
  }
}

// -------- Start / restart --------
function startRestartGame(){
  gameState.gameStarted = true;
  gameState.gameOver = false;
  gameState.firstMove = true;
  gameState.currentPlayerIndex = 0;
  gameState.selectedCard = null;
  gameState.moveHistory = [];
  gameState.futureMoves = [];

  gameState.board = Array(9).fill().map(()=>Array(9).fill(null));
  gameState.players.forEach((p,i)=>{ p.isCurrent = i===0; p.cards=[]; p.deck=[]; });

  initializeBoard();
  initializePlayerCards();
  updateBoardDisplay();
  showSelectedCardPreview(null);
  currentPlayerDisplay.textContent = `${gameState.players[0].name}'s Turn`;
  gameMessage.textContent = "Game started! Player 1, place a card in center.";
  startRestartGameBtn.textContent = 'Reset Game';
  updateUndoRedoButtons();

  const cur = gameState.players[gameState.currentPlayerIndex];
  if (aiPlayers[cur.id]) setTimeout(()=> computerMove(cur), 280);

  // if (socket && roomCode) { 
  //   socket.emit("stateUpdate", { room: roomCode, state: gameState });
  // }
  broadcastGameState();

}

// -------- Event listeners & init --------
startRestartGameBtn.addEventListener('click', startRestartGame);
rulesBtn.addEventListener('click', ()=>{
  gameState.rulesVisible = !gameState.rulesVisible;
  rulesPanel.style.display = gameState.rulesVisible ? 'block' : 'none';
  rulesBtn.textContent = gameState.rulesVisible ? 'Hide Rules' : 'Show Rules';
});
undoBtn.addEventListener('click', undoMove);
redoBtn.addEventListener('click', redoMove);

window.addEventListener('load', ()=>{
  initializeBoard();
  connectSocket();
  if (isHost) startRestartGame(); // only host initializes deck & cards
});


/* ===== Custom Cursor + BGM for Game page ===== */
function setupCustomCursor(){
  const cursor = document.getElementById('customCursor');
  if (!cursor) return;
  const img = cursor.querySelector('img');

  // nonaktif di touch device
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouch) {
    cursor.style.display = 'none';
    document.documentElement.classList.remove('custom-cursor-active');
    document.body.classList.remove('custom-cursor-active');
    return;
  }

  document.documentElement.classList.add('custom-cursor-active');
  document.body.classList.add('custom-cursor-active');

  let shown = false;
  function move(e){
    cursor.style.left = e.clientX + 'px';
    cursor.style.top  = e.clientY + 'px';
  }
  function showOnce(e){
    if (!shown){ cursor.style.opacity = '1'; shown = true; window.removeEventListener('mousemove', showOnce); }
    move(e);
  }

  window.addEventListener('mousemove', showOnce, {passive:true});
  window.addEventListener('mousemove', move, {passive:true});
  window.addEventListener('mousedown', () => cursor.classList.add('click'));
  window.addEventListener('mouseup',   () => cursor.classList.remove('click'));

  // optional: ganti gambar saat double click
  const normal = 'krusor1.png';
  const dbl    = 'krusor2.png';
  let backTimer;
  window.addEventListener('dblclick', () => {
    if (!img) return;
    img.src = dbl;
    clearTimeout(backTimer);
    backTimer = setTimeout(() => { img.src = normal; }, 800);
  });

  // hide saat mouse keluar window
  window.addEventListener('mouseout', ev => { if (!ev.relatedTarget) cursor.style.opacity = '0'; });
  window.addEventListener('mouseover', () => { if (shown) cursor.style.opacity = '1'; });
}

function setupBGM(){
  const bgm = document.getElementById('bgm');
  if (!bgm) return;
  bgm.volume = 0.0;
  bgm.loop = true;
  bgm.preload = 'auto';

  let started = false, rampTimer = null;

  function ramp(to = 0.5, dur = 700){
    if (rampTimer) clearInterval(rampTimer);
    const steps = 20, stepMs = Math.max(20, Math.floor(dur/steps));
    const start = bgm.volume, delta = to - start;
    let i = 0;
    rampTimer = setInterval(() => {
      i++;
      bgm.volume = Math.min(1, Math.max(0, start + delta * (i/steps)));
      if (i >= steps){ clearInterval(rampTimer); rampTimer = null; }
    }, stepMs);
  }

  function tryPlay(){
    if (started) return;
    const p = bgm.play();
    if (p && typeof p.then === 'function'){
      p.then(() => { started = true; ramp(0.5, 700); }).catch(()=>{});
    } else { started = true; ramp(0.5, 700); }

    // lepaskan listener setelah mulai
    ['click','dblclick','mousemove','keydown'].forEach(ev => window.removeEventListener(ev, tryPlay));
  }

  // mulai setelah gesture pertama (aturan browser)
  ['click','dblclick','mousemove','keydown'].forEach(ev => window.addEventListener(ev, tryPlay, {passive:true}));
}

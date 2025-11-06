// -------- Game state --------
const gameState = {
  players: [
    { id:1, name:'Player 1', color:'red', cards:[], deck:[], isCurrent:true },
    { id:2, name:'Player 2', color:'blue', cards:[], deck:[], isCurrent:false },
    { id:3, name:'Player 3', color:'yellow', cards:[], deck:[], isCurrent:false },
    { id:4, name:'Player 4', color:'green', cards:[], deck:[], isCurrent:false }
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

// AI toggles
const aiPlayers = {1:false,2:false,3:false,4:false};

// ---- AI timers (so we can cancel thinking delays) ----
let aiTimers = {};

/** Cancel all pending AI timers */
function cancelAllAiTimers(){
  Object.keys(aiTimers).forEach(pid => {
    clearTimeout(aiTimers[pid]);
    delete aiTimers[pid];
  });
}

/** Cancel timer for a single player */
function cancelAiTimerFor(playerId){
  if (aiTimers[playerId]){
    clearTimeout(aiTimers[playerId]);
    delete aiTimers[playerId];
  }
}

// DOM refs (assume script deferred so DOM exists)
const gameBoard = document.getElementById('game-board');
let gameMessage = document.getElementById('game-message');
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

if (!gameMessage) {
  console.warn('Missing #game-message. Creating fallback.');
  const fallback = document.createElement('div');
  fallback.id = 'game-message';
  fallback.className = 'message';
  fallback.textContent = 'Welcome to Punto!';
  document.body.appendChild(fallback);
  gameMessage = document.getElementById('game-message');
}

// ----------------- Player1 image helpers & preview -----------------

/**
 * Menghasilkan daftar path kandidat untuk gambar kartu.
 * Prioritas (saat ini): jika ownerId===1 -> images/player1/<value>.*,
 * lalu images/<color>/<value>.*, lalu images/generic/<value>.*, lalu placeholder.
 */
function getCandidateImagePaths(card, ownerId = null){
  const paths = [];

  if (!card) return paths;

  // Kalau ada ownerId (1–4), coba cari folder khusus "krt", "krt2", "krt3", "krt4"
  if (ownerId !== null) {
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
  if (srcList && srcList.length>0) img.src = srcList[0];
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
  // safe null handling (fix for previous recursion bug)
  if (!selectedCardDisplay) return;
  if (!card) {
    selectedCardDisplay.innerHTML = '';
    return;
  }
  selectedCardDisplay.innerHTML = '';
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
  if (!container) return;
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
    // 💡 Efek ukuran khusus untuk Player 4
    // 💡 Efek ukuran khusus untuk Player 4
    if (player.id === 4) {
      // 🔹 Kartu 3, 4, 5 → lebih kecil
      if ([3, 4, 5, 7].includes(card.value)) {
        img.style.transform = 'scale(0.80)';
        img.style.opacity = '0.95';
      }

      // 🔸 Kartu 1 & 9 → lebih besar
      if ([1, 9].includes(card.value)) {
        img.style.transform = 'scale(1.10)';
        img.style.zIndex = '3'; // tampil di atas sedikit
        img.style.filter = 'drop-shadow(0 0 6px rgba(255,255,255,0.4))';
      }
    }



    container.appendChild(el);
  });
  updatePlayerHighlights();
}


function updatePlayerHighlights(){
  gameState.players.forEach(p=>{
    const el = document.getElementById(`player${p.id}`);
    if (!el) return;
    if (p.isCurrent) el.classList.add('current-player'); else el.classList.remove('current-player');
  });
}

function updateCurrentPlayerDisplay(){
  const cur = gameState.players[gameState.currentPlayerIndex];
  if (!cur) return;
  currentPlayerDisplay.textContent = `${cur.name}'s Turn`;
}

function updateBoardDisplay(){
  for (let r=0;r<9;r++){
    for (let c=0;c<9;c++){
      const cell = gameState.board[r][c];
      const el = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
      if (!el) continue;
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
  // cancel any pending AI timers (undo may make timers invalid)
  cancelAllAiTimers();

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
  cancelAllAiTimers();
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

// -------- Selection & placement --------
function handleCardSelect(playerId, cardIndex){
  if (!gameState.gameStarted || gameState.gameOver) return;
  const player = gameState.players.find(p=>p.id===playerId);
  if (!player || !player.isCurrent) return;
  if (gameState.selectedCard){
    const prev = document.querySelectorAll(`#player${gameState.selectedCard.playerId}-cards .player-card`);
    if (prev[gameState.selectedCard.cardIndex]) prev[gameState.selectedCard.cardIndex].classList.remove('selected');
  }
  gameState.selectedCard = { playerId, cardIndex };
  const curCards = document.querySelectorAll(`#player${playerId}-cards .player-card`);
  if (curCards[cardIndex]) curCards[cardIndex].classList.add('selected');
  const card = player.cards[cardIndex];
  // tampilkan preview, pass ownerId supaya player1 pakai gambar khusus
  showSelectedCardPreview(card, playerId);
  if (gameState.firstMove) gameMessage.textContent = `Selected: ${card.color} ${card.value}. Place at center (4,4).`;
  else gameMessage.textContent = `Selected: ${card.color} ${card.value}. Choose a valid board position.`;
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

function performPlacement(player, cardIndex, row, col){
  const card = player.cards[cardIndex];
  if (!isValidMove(row,col,card)) return false;
  saveMoveToHistory();
  gameState.board[row][col] = { value:card.value, color:card.color, playerId:player.id };
  player.cards.splice(cardIndex,1);
  drawCard(player);
  updateBoardDisplay();
  updatePlayerCardsDisplay(player);

  if (gameState.firstMove){
    gameState.firstMove = false;
    const center = document.querySelector('.cell.center-cell');
    if (center) center.classList.remove('center-cell');
  }

  if (checkWinCondition(player.id,row,col)){
    gameState.gameOver = true;
    gameMessage.textContent = `${player.name} wins! Four ${player.color} in a row!`;
    highlightWinningCells(player.id);
    gameState.selectedCard = null;
    showSelectedCardPreview(null);
    startRestartGameBtn.textContent = 'Restart Game';
    updateUndoRedoButtons();
    return true;
  }

  nextPlayer();
  gameState.selectedCard = null;
  showSelectedCardPreview(null);
  document.querySelectorAll('.player-card.selected').forEach(el=>el.classList.remove('selected'));

  if (!hasValidMoves()){
    gameState.gameOver = true;
    gameMessage.textContent = "Game over! No valid moves remaining.";
    startRestartGameBtn.textContent = 'Restart Game';
  }

  updateUndoRedoButtons();
  return true;
}

function handleCellClick(row,col){
  if (!gameState.gameStarted || gameState.gameOver) return;
  if (!gameState.selectedCard) return;
  const player = gameState.players.find(p=>p.id===gameState.selectedCard.playerId);
  if (!player.isCurrent) return;
  const cardIndex = gameState.selectedCard.cardIndex;
  if (!performPlacement(player, cardIndex, row, col)){
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
function nextPlayer(){
  gameState.players[gameState.currentPlayerIndex].isCurrent = false;
  gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
  gameState.players[gameState.currentPlayerIndex].isCurrent = true;
  updatePlayerHighlights();
  updateCurrentPlayerDisplay();
  gameMessage.textContent = `${gameState.players[gameState.currentPlayerIndex].name}'s turn. Select a card.`;
  if (gameState.players[gameState.currentPlayerIndex].cards.length===0){
    nextPlayer();
    return;
  }
  const cur = gameState.players[gameState.currentPlayerIndex];
  if (aiPlayers[cur.id] && !gameState.gameOver){
    // let computerMove decide its own timer (it cancels previous timers)
    computerMove(cur);
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

/**
 * Modified computerMove:
 * - choose best move immediately (no heavy search)
 * - preview the chosen card in the UI
 * - wait a randomized think delay (700-1700ms)
 * - before placing, re-check turn/AI status/validity and fallback if needed
 */
function computerMove(player){
  if (!player || player.cards.length===0 || gameState.gameOver) return;

  // Cancel any previous timer for this player (defensive)
  cancelAiTimerFor(player.id);

  // pilih best move seperti sebelumnya
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

  if (best.cardIndex === null){
    gameMessage.textContent = `${player.name} (AI) has no valid move and is skipped.`;
    // beri sedikit jeda supaya terasa natural
    setTimeout(()=> nextPlayer(), 350);
    return;
  }

  // tampilkan status thinking & preview selected card
  gameMessage.textContent = `${player.name} (AI) is thinking...`;
  showSelectedCardPreview(player.cards[best.cardIndex], player.id);

  // tambahkan kelas highlight kecil di UI hand (jika ingin)
  document.querySelectorAll(`#player${player.id}-cards .player-card`).forEach(el=>el.classList.remove('ai-selected'));
  const cardEls = document.querySelectorAll(`#player${player.id}-cards .player-card`);
  if (cardEls[best.cardIndex]) cardEls[best.cardIndex].classList.add('ai-selected');

  // jeda berpikir acak: antara 700ms hingga 1700ms (bisa diubah)
  const thinkMs = 700 + Math.floor(Math.random()*1000);

  aiTimers[player.id] = setTimeout(()=>{
    // sebelum menaruh kartu, re-cek kondisi: masih giliran player ini? masih AI? masih game jalan?
    const cur = gameState.players[gameState.currentPlayerIndex];
    if (!cur || !cur.isCurrent || cur.id !== player.id || gameState.gameOver || !aiPlayers[player.id]){
      // batal: mungkin undo/reset/AI dimatikan, bersihkan preview & kelas
      showSelectedCardPreview(null);
      document.querySelectorAll(`#player${player.id}-cards .player-card`).forEach(el=>el.classList.remove('ai-selected'));
      delete aiTimers[player.id];
      return;
    }

    // juga re-cek bahwa card index masih valid (mis. undo atau draw mengubahnya)
    if (!player.cards[best.cardIndex]){
      // coba cari kartu yang paling mirip (fallback) — cari kartu dgn nilai sama/warna sama
      let foundIndex = -1;
      for (let k=0;k<player.cards.length;k++){
        if (player.cards[k].value === (player.cards[best.cardIndex]?.value) && player.cards[k].color === (player.cards[best.cardIndex]?.color)){
          foundIndex = k; break;
        }
      }
      if (foundIndex === -1){
        // tidak menemukan, abort & nextPlayer
        showSelectedCardPreview(null);
        document.querySelectorAll(`#player${player.id}-cards .player-card`).forEach(el=>el.classList.remove('ai-selected'));
        delete aiTimers[player.id];
        nextPlayer();
        return;
      } else {
        best.cardIndex = foundIndex;
      }
    }

    // pastikan posisi masih valid (stacking / adjacency mungkin berubah)
    const chosenCard = player.cards[best.cardIndex];
    if (!isValidMove(best.row, best.col, chosenCard)){
      // jika posisi sekarang invalid, coba cari best valid lagi cepat
      let newBest = {score:-Infinity, row:null, col:null, cardIndex:null};
      for (let ci=0; ci<player.cards.length; ci++){
        const card = player.cards[ci];
        for (let r=0;r<9;r++){
          for (let c=0;c<9;c++){
            if (!isValidMove(r,c,card)) continue;
            const sc = evaluateMove(r,c,card,player);
            if (sc > newBest.score){
              newBest.score = sc; newBest.row = r; newBest.col = c; newBest.cardIndex = ci;
            }
          }
        }
      }
      if (newBest.cardIndex === null){
        showSelectedCardPreview(null);
        document.querySelectorAll(`#player${player.id}-cards .player-card`).forEach(el=>el.classList.remove('ai-selected'));
        delete aiTimers[player.id];
        nextPlayer();
        return;
      }
      best = newBest;
    }

    // lakukan placement (final)
    const placed = performPlacement(player, best.cardIndex, best.row, best.col);
    if (placed){
      gameMessage.textContent = `${player.name} (AI) placed a card.`;
    } else {
      gameMessage.textContent = `${player.name} (AI) attempted a move but it failed.`;
    }

    // bersihkan preview & highlight
    showSelectedCardPreview(null);
    document.querySelectorAll(`#player${player.id}-cards .player-card`).forEach(el=>el.classList.remove('ai-selected'));

    delete aiTimers[player.id];

  }, thinkMs);
}

// -------- Start / restart --------
function startRestartGame(){
  // cancel pending AI timers whenever we restart
  cancelAllAiTimers();

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
  if (aiPlayers[cur.id]) computerMove(cur);
}

// -------- Quick Play vs Computer logic (button handlers) --------
startPvcBtn.addEventListener('click', ()=>{
  cancelAllAiTimers();
  // Quick mode: Player 1 = human, Player 2 = AI; others remain human (unless checkboxes used)
  aiPlayers[1] = false;
  aiPlayers[2] = true;
  aiPlayers[3] = false;
  aiPlayers[4] = false;
  // sync the checkboxes UI
  const cb1 = document.getElementById('ai-p1');
  const cb2 = document.getElementById('ai-p2');
  const cb3 = document.getElementById('ai-p3');
  const cb4 = document.getElementById('ai-p4');
  if (cb1) cb1.checked = false;
  if (cb2) cb2.checked = true;
  if (cb3) cb3.checked = false;
  if (cb4) cb4.checked = false;

  gameMessage.textContent = "Mode: Player 1 vs Computer (Player 2). Starting game...";
  startRestartGame();
});

stopPvcBtn.addEventListener('click', ()=>{
  cancelAllAiTimers();
  // Turn off all quick AI flags
  aiPlayers[1] = false; aiPlayers[2] = false; aiPlayers[3] = false; aiPlayers[4] = false;
  const cb1 = document.getElementById('ai-p1');
  const cb2 = document.getElementById('ai-p2');
  const cb3 = document.getElementById('ai-p3');
  const cb4 = document.getElementById('ai-p4');
  if (cb1) cb1.checked = false;
  if (cb2) cb2.checked = false;
  if (cb3) cb3.checked = false;
  if (cb4) cb4.checked = false;

  gameMessage.textContent = "AI mode stopped. All players set to human. Resetting game...";
  startRestartGame();
});

// -------- Event listeners & init --------
// replace original simple listeners so we can cancel timers on uncheck
const cbp1 = document.getElementById('ai-p1');
const cbp2 = document.getElementById('ai-p2');
const cbp3 = document.getElementById('ai-p3');
const cbp4 = document.getElementById('ai-p4');

if (cbp1) cbp1.addEventListener('change', e => { aiPlayers[1] = e.target.checked; if (!e.target.checked) cancelAiTimerFor(1); });
if (cbp2) cbp2.addEventListener('change', e => { aiPlayers[2] = e.target.checked; if (!e.target.checked) cancelAiTimerFor(2); });
if (cbp3) cbp3.addEventListener('change', e => { aiPlayers[3] = e.target.checked; if (!e.target.checked) cancelAiTimerFor(3); });
if (cbp4) cbp4.addEventListener('change', e => { aiPlayers[4] = e.target.checked; if (!e.target.checked) cancelAiTimerFor(4); });

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
  startRestartGame();
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

    ['click','dblclick','mousemove','keydown'].forEach(ev => window.removeEventListener(ev, tryPlay));
  }

  ['click','dblclick','mousemove','keydown'].forEach(ev => window.addEventListener(ev, tryPlay, {passive:true}));
}

// If needed, expose helpers for debugging
window.__PUNTO = {
  gameState,
  aiPlayers,
  cancelAllAiTimers,
  cancelAiTimerFor
};

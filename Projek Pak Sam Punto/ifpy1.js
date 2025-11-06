/* ifpy1.js — final implemented version
   - auto-start running clock (starts at 00:01)
   - top cooldown display (6s) that blocks card selection while active
   - player hand (3 visible), each card selectable and placeable by clicking board cell
   - after placement draw from deck (if available)
   - reset button resets game + clock
*/

const boardEl = document.getElementById('game-board');
const controlCardsContainer = document.getElementById('control-player-cards');
const btnReset = document.getElementById('btn-reset');
const btnSample = document.getElementById('btn-sample');
const bgm = document.getElementById('bgm');

// --- utilities ---
function logMsg(msg){
  // kept simple; expand later to show in UI if needed
  console.log(msg);
}
function shuffle(arr){
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// --- image fallback helpers ---
function getCandidateImagePaths(card, ownerId = null){
  const paths = [];
  if (ownerId !== null){
    const folder = ownerId === 1 ? "krt" : `krt${ownerId}`;
    paths.push(`${folder}/py${card.value}.png`);
    paths.push(`${folder}/${card.value}.png`);
  }
  if (card.color) paths.push(`images/${card.color}/${card.value}.png`);
  paths.push(`images/generic/${card.value}.png`);
  paths.push(`images/placeholder.png`);
  return paths;
}
function createImgWithFallback(srcList, altText=''){
  const img = document.createElement('img');
  img.alt = altText;
  img.dataset._tryIndex = 0;
  img.src = srcList[0] || '';
  img.style.display = 'block';
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

// --- game state ---
const gameState = {
  size: 9,
  board: [],
  players: [],
  currentPlayerIndex: 0,
  selectedCard: null
};

// --- clock & cooldown state ---
let lockUntil = 0;           // timestamp ms until which selection blocked
let gameClockSeconds = 1;    // start from 1 second -> shows 00:01
let clockInterval = null;
let uiClockEl = null;        // bottom running clock element
let uiCooldownEl = null;     // top cooldown element

// inject small UI for two clocks (top = cooldown, bottom = running)
function injectClockUI(){
  const panel = document.querySelector('.controls-panel');
  if (!panel) return;

  // wrapper: keep small layout consistent with panel
  const wrap = document.createElement('div');
  wrap.style.width = '100%';
  wrap.style.display = 'flex';
  wrap.style.justifyContent = 'space-between';
  wrap.style.alignItems = 'center';
  wrap.style.gap = '8px';
  wrap.style.marginBottom = '6px';

  const clock = document.createElement('div');
  clock.id = 'game-clock';
  clock.style.fontWeight = '800';
  clock.style.color = '#6b2b57';
  clock.style.fontSize = '1rem';
  clock.textContent = formatTime(gameClockSeconds);
  uiClockEl = clock;

  const cd = document.createElement('div');
  cd.id = 'game-cooldown';
  cd.style.fontSize = '0.86rem';
  cd.style.color = 'rgba(0,0,0,0.6)';
  cd.textContent = 'Ready';
  uiCooldownEl = cd;

  wrap.appendChild(clock);
  wrap.appendChild(cd);

  panel.insertBefore(wrap, panel.firstChild);
}

function formatTime(totalSec){
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return `${mm}:${ss}`;
}

function startClock(){
  if (clockInterval) clearInterval(clockInterval);
  if (uiClockEl) uiClockEl.textContent = formatTime(gameClockSeconds);
  clockInterval = setInterval(() => {
    gameClockSeconds++;
    if (uiClockEl) uiClockEl.textContent = formatTime(gameClockSeconds);
    refreshCooldownUI();
  }, 1000);
}

function refreshCooldownUI(){
  if (!uiCooldownEl) return;
  const now = Date.now();
  if (now < lockUntil){
    const remainingMs = lockUntil - now;
    const remSec = Math.ceil(remainingMs / 1000);
    uiCooldownEl.textContent = `Wait ${String(remSec).padStart(2,'0')}s`;
    uiCooldownEl.style.color = '#c94a6b';
  } else {
    uiCooldownEl.textContent = 'Ready';
    uiCooldownEl.style.color = 'rgba(0,0,0,0.6)';
  }
}

// --- players & decks ---
function createFullDecks(){
  const decks = { red: [], blue: [], yellow: [], green: [] };
  for (let set = 0; set < 2; set++){
    for (let v = 1; v <= 9; v++){
      decks.red.push({ value: v, color: 'red', id: `red-${set}-${v}` });
      decks.blue.push({ value: v, color: 'blue', id: `blue-${set}-${v}` });
      decks.yellow.push({ value: v, color: 'yellow', id: `yellow-${set}-${v}` });
      decks.green.push({ value: v, color: 'green', id: `green-${set}-${v}` });
    }
  }
  return decks;
}

function initializePlayers(){
  const colors = ['red','blue','yellow','green'];
  const decks = createFullDecks();
  gameState.players = [];
  for (let i = 0; i < 4; i++){
    const color = colors[i];
    const deckArr = shuffle(decks[color].slice());
    const hand = deckArr.splice(0, 3);
    gameState.players.push({
      id: i + 1,
      name: `Player ${i+1}`,
      color,
      cards: hand,
      deck: deckArr
    });
  }
  gameState.currentPlayerIndex = 0;
  gameState.selectedCard = null;
}

// --- board init & display ---
function initializeBoard(){
  gameState.board = Array.from({ length: gameState.size }, () => Array(gameState.size).fill(null));
  if (!boardEl) return;
  boardEl.innerHTML = '';
  for (let r = 0; r < gameState.size; r++){
    for (let c = 0; c < gameState.size; c++){
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      if (r === Math.floor(gameState.size/2) && c === Math.floor(gameState.size/2)) cell.classList.add('center');
      cell.addEventListener('click', () => handleCellClick(r, c));
      boardEl.appendChild(cell);
    }
  }
  updateBoardDisplay();
}

function updateBoardDisplay(){
  if (!boardEl) return;
  for (let r = 0; r < gameState.size; r++){
    for (let c = 0; c < gameState.size; c++){
      const entry = gameState.board[r][c];
      const cell = boardEl.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
      if (!cell) continue;
      cell.innerHTML = '';
      if (entry){
        const wrapper = document.createElement('div');
        wrapper.className = `placed-card card ${entry.color}`;
        wrapper.dataset.playerId = entry.playerId;
        wrapper.dataset.value = entry.value;
        wrapper.dataset.placedId = entry.placedId || `${entry.playerId}-${entry.value}-${Date.now()}`;

        const img = createImgWithFallback(getCandidateImagePaths(entry, entry.playerId), `${entry.color} ${entry.value}`);
        wrapper.appendChild(img);

        const badge = document.createElement('span');
        badge.className = 'card-number';
        badge.textContent = entry.value;
        // board badge left-bottom
        badge.style.left = '6px';
        badge.style.bottom = '6px';
        badge.style.transform = 'none';
        badge.style.zIndex = '8';
        wrapper.appendChild(badge);

        wrapper.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const pid = parseInt(wrapper.dataset.playerId, 10);
          const player = getPlayerById(pid);
          if (!player) return;
          // return card to player's hand
          gameState.board[r][c] = null;
          const returnedCard = { value: entry.value, color: entry.color, id: `ret-${pid}-${entry.value}-${Date.now()}` };
          player.cards.push(returnedCard);
          if (player.id === 1) updatePlayerCardsDisplay(player);
          updateBoardDisplay();
          logMsg(`${player.name} gets card ${entry.value} back.`);
        });

        cell.appendChild(wrapper);
      }
    }
  }
}

// --- helpers ---
function getPlayerById(id){
  return gameState.players.find(p => p.id === id) || null;
}
function drawCard(player){
  if (!player) return false;
  if (player.deck && player.deck.length > 0){
    const card = player.deck.shift();
    player.cards.push(card);
    return true;
  }
  return false;
}

// --- render Player 1 hand (show up to 3 cards) ---
function updatePlayerCardsDisplay(player){
  if (!controlCardsContainer || !player) return;
  controlCardsContainer.innerHTML = '';
  const hand = player.cards.slice(0, 3);

  hand.forEach((card, idx) => {
    const el = document.createElement('div');
    el.className = `player-card ${card.color} in-hand`;
    el.dataset.cardId = card.id;
    el.dataset.cardIndex = idx;

    const img = createImgWithFallback(getCandidateImagePaths(card, player.id), `${card.color} ${card.value}`);
    el.appendChild(img);

    const badge = document.createElement('span');
    badge.className = 'card-number';
    badge.textContent = card.value;
    el.appendChild(badge);

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      handleCardSelect(player.id, card.id);
    });

    if (gameState.selectedCard && gameState.selectedCard.cardId === card.id) el.classList.add('selected');
    controlCardsContainer.appendChild(el);
  });

  // filler slots (if less than 3)
  for (let i = hand.length; i < 3; i++){
    const slot = document.createElement('div');
    slot.className = 'player-card placeholder';
    slot.style.opacity = '0.04';
    controlCardsContainer.appendChild(slot);
  }
}

// --- selection & placement (blocked during cooldown) ---
function handleCardSelect(playerId, cardId){
  const now = Date.now();
  if (now < lockUntil){
    const rem = Math.ceil((lockUntil - now) / 1000);
    logMsg(`Please wait ${rem}s before selecting another card.`);
    refreshCooldownUI();
    return;
  }

  const curPlayer = gameState.players[gameState.currentPlayerIndex];
  if (!curPlayer) return;
  if (curPlayer.id !== playerId){
    logMsg(`Not ${getPlayerById(playerId).name}'s turn.`);
    return;
  }
  const player = getPlayerById(playerId);
  if (!player) { logMsg('Player not found'); return; }
  const foundIndex = player.cards.findIndex(c => c.id === cardId);
  if (foundIndex === -1){
    logMsg('Card not found in hand.');
    return;
  }

  gameState.selectedCard = { playerId, cardId, cardIndexInHand: foundIndex };
  if (player.id === 1) updatePlayerCardsDisplay(player);
  logMsg(`${player.name}: selected ${player.cards[foundIndex].value}. Click a board cell to place.`);
}

function handleCellClick(r, c){
  const sel = gameState.selectedCard;
  if (!sel) return;
  const player = getPlayerById(sel.playerId);
  if (!player){
    gameState.selectedCard = null;
    return;
  }
  if (gameState.board[r][c]){
    logMsg('Cell already occupied.');
    return;
  }
  const cardIndex = player.cards.findIndex(x => x.id === sel.cardId);
  if (cardIndex === -1){
    logMsg('Card no longer in hand.');
    gameState.selectedCard = null;
    if (player.id === 1) updatePlayerCardsDisplay(player);
    return;
  }
  const card = player.cards[cardIndex];

  const entry = {
    value: card.value, color: card.color, playerId: player.id,
    placedId: `${player.id}-${card.id}-${Date.now()}`
  };
  gameState.board[r][c] = entry;

  // remove from hand
  player.cards.splice(cardIndex, 1);

  // draw to refill hand if deck available
  drawCard(player);

  // set cooldown for 6 seconds
  lockUntil = Date.now() + 6000;
  refreshCooldownUI();

  // clear selection
  gameState.selectedCard = null;

  // update UI
  if (player.id === 1) updatePlayerCardsDisplay(player);
  updateBoardDisplay();

  logMsg(`${player.name} placed ${entry.value} at [${r},${c}].`);
  // note: if you want round-robin turn change, uncomment next lines:
  // gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
  // const next = gameState.players[gameState.currentPlayerIndex];
  // logMsg(`Turn: ${next.name}`);
}

// --- reset & sample ---
function resetGame(){
  initializePlayers();
  initializeBoard();
  const p1 = getPlayerById(1);
  if (p1) updatePlayerCardsDisplay(p1);
  updateBoardDisplay();
  gameClockSeconds = 1;
  lockUntil = 0;
  refreshCooldownUI();
}
function sampleAction(){ alert('Sample button pressed.'); }

// --- bgm autoplay attempt (unchanged) ---
function setupBgmAutoplay(){
  if (!bgm) return;
  bgm.volume = 0;
  let started = false;
  function ramp(to = 0.28, dur = 700){
    const steps = 20, stepMs = Math.max(20, Math.floor(dur/steps));
    const start = bgm.volume, delta = to - start; let i = 0;
    const t = setInterval(()=>{ i++; bgm.volume = Math.min(1, Math.max(0, start + delta*(i/steps))); if (i>=steps) clearInterval(t); }, stepMs);
  }
  function tryPlay(){
    if (started) return;
    const p = bgm.play();
    if (p && typeof p.then === 'function'){
      p.then(()=>{ started=true; ramp(); }).catch(()=>{});
    } else { started=true; ramp(); }
    ['click','mousemove','keydown'].forEach(ev => window.removeEventListener(ev, tryPlay));
  }
  ['click','mousemove','keydown'].forEach(ev => window.addEventListener(ev, tryPlay, {passive:true}));
}

// --- init ---
document.addEventListener('DOMContentLoaded', () => {
  injectClockUI();
  startClock();
  initializePlayers();
  initializeBoard();
  const p1 = getPlayerById(1);
  if (p1) updatePlayerCardsDisplay(p1);
  updateBoardDisplay();

  if (btnReset) btnReset.addEventListener('click', resetGame);
  if (btnSample) btnSample.addEventListener('click', sampleAction);

  // small interval to keep cooldown UI fresh
  setInterval(refreshCooldownUI, 200);

  setupBgmAutoplay();
});

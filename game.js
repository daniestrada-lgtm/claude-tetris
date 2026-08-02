'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - light blue
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const POWER_BASE = 8;          // valores de celda 8..12 == power-up (nunca entran en board)
const POWERUP_EVERY = 5;       // líneas necesarias para armar el siguiente power-up
const FREEZE_MS = 5000;        // duración de Congelar
const FLASH_MS = 380;          // destello de las celdas afectadas

const POWERUPS = [
  { id: 'bomb',    label: 'BOMBA',    glyph: '✷', color: '#ff7043' }, // ✷
  { id: 'bolt',    label: 'RAYO',     glyph: '↯', color: '#ffee58' }, // ↯
  { id: 'dye',     label: 'TINTE',    glyph: '◈', color: '#f06292' }, // ◈
  { id: 'gravity', label: 'GRAVEDAD', glyph: '⇓', color: '#4db6ac' }, // ⇓
  { id: 'freeze',  label: 'CONGELAR', glyph: '✻', color: '#90caf9' }, // ✻
];

// puntos por bloque afectado; se multiplican por level igual que LINE_SCORES
const POWER_POINTS = { bomb: 30, bolt: 20, dye: 10, gravity: 5, freeze: 250 };

const HS_KEY = 'tetris-highscores';    // top 5: [{name, score, lines, combo}]
const HS_STATS_KEY = 'tetris-best-stats'; // récords absolutos: {bestCombo, bestLines}
const HS_MAX = 5;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const powerStatusEl = document.getElementById('power-status');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const startOverlay = document.getElementById('start-overlay');
const startLeaderboardEl = document.getElementById('start-leaderboard');
const playBtn = document.getElementById('play-btn');
const resetScoresBtn = document.getElementById('reset-scores-btn');
const nameEntry = document.getElementById('name-entry');
const nameInput = document.getElementById('name-input');
const saveScoreBtn = document.getElementById('save-score-btn');
const overlayLeaderboardEl = document.getElementById('overlay-leaderboard');
const gameoverBox = document.getElementById('gameover-box');
const pauseBox = document.getElementById('pause-box');
const pauseViewMain = document.getElementById('pause-view-main');
const pauseViewControls = document.getElementById('pause-view-controls');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const showControlsBtn = document.getElementById('show-controls-btn');
const hideControlsBtn = document.getElementById('hide-controls-btn');
const startLevelSelect = document.getElementById('start-level-select');

const THEME_STORAGE_KEY = 'tetris-theme';
const START_LEVEL_STORAGE_KEY = 'tetris-start-level';
const MAX_START_LEVEL = 10;
const GRID_COLOR = { dark: '#22222e', light: '#e0e0e8' };

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let powerCharge, powerArmed, freezeLeft, flashCells, flashLeft, maxCombo, startLevel;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, power: -1, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function powerPiece() {
  const kind = Math.floor(Math.random() * POWERUPS.length);
  const shape = [[POWER_BASE + kind]];
  return { type: POWER_BASE + kind, shape, power: kind,
           x: Math.floor(COLS / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    if (cleared > maxCombo) maxCombo = cleared;
    score += LINE_SCORES[Math.min(cleared, LINE_SCORES.length - 1)] * level;
    level = Math.floor(lines / 10) + startLevel;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    powerCharge += cleared;
    if (powerCharge >= POWERUP_EVERY) { powerCharge -= POWERUP_EVERY; powerArmed = true; }
    updateHUD();
  }
  return cleared;
}

function settleColumns() {
  let moved = 0;
  for (let c = 0; c < COLS; c++) {
    let write = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!board[r][c]) continue;
      if (r !== write) { board[write][c] = board[r][c]; board[r][c] = 0; moved++; }
      write--;
    }
  }
  return moved;
}

function powerBomb(cx, cy) {
  let hit = 0;
  for (let r = cy - 1; r <= cy + 1; r++) {
    if (r < 0 || r >= ROWS) continue;
    for (let c = cx - 1; c <= cx + 1; c++) {
      if (c < 0 || c >= COLS) continue;
      flashCells.push([c, r]);
      if (board[r][c]) { board[r][c] = 0; hit++; }
    }
  }
  return hit * POWER_POINTS.bomb;
}

function powerBolt(cx, cy) {
  let hit = 0;
  for (let c = 0; c < COLS; c++) {
    flashCells.push([c, cy]);
    if (board[cy][c]) { board[cy][c] = 0; hit++; }
  }
  for (let r = 0; r < ROWS; r++) {
    if (r === cy) continue;
    flashCells.push([cx, r]);
    if (board[r][cx]) { board[r][cx] = 0; hit++; }
  }
  return hit * POWER_POINTS.bolt;
}

// Tinte: destruye TODOS los bloques del color más abundante, luego compacta y cascadea
function powerDye() {
  const tally = new Array(COLORS.length).fill(0);
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c]) tally[board[r][c]]++;

  let best = 0;
  for (let v = 1; v < tally.length; v++) if (tally[v] > tally[best]) best = v;
  if (!best) return 0;                       // tablero vacío: nada que teñir

  let hit = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c] === best) { board[r][c] = 0; flashCells.push([c, r]); hit++; }

  settleColumns();
  clearLines();                              // cascada: las filas que se completen puntúan normal
  return hit * POWER_POINTS.dye;
}

function powerGravity() {
  const moved = settleColumns();
  clearLines();
  return moved * POWER_POINTS.gravity;
}

function powerFreeze() {
  freezeLeft = FREEZE_MS;
  return POWER_POINTS.freeze;
}

function firePowerUp(kind, x, y) {
  flashCells = [];
  let gained = 0;
  switch (POWERUPS[kind].id) {
    case 'bomb':    gained = powerBomb(x, y); break;
    case 'bolt':    gained = powerBolt(x, y); break;
    case 'dye':     gained = powerDye();      break;
    case 'gravity': gained = powerGravity();  break;
    case 'freeze':  gained = powerFreeze();   break;
  }
  score += gained * level;
  flashLeft = FLASH_MS;
  canvas.classList.remove('power-flash');
  void canvas.offsetWidth;                   // fuerza reflow para reiniciar la animación
  canvas.classList.add('power-flash');
  updateHUD();
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  if (current.power >= 0) {
    firePowerUp(current.power, current.x, current.y);
  } else {
    merge();
    clearLines();
  }
  spawn();
}

function spawn() {
  current = next;
  next = powerArmed ? powerPiece() : randomPiece();
  powerArmed = false;
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  updatePowerHUD();
}

function updatePowerHUD() {
  if (!current || !next) return;
  let text, color = '';
  if (freezeLeft > 0) {
    text = `CONGELADO ${(freezeLeft / 1000).toFixed(1)}s`;
    color = POWERUPS[4].color;
  } else if (current.power >= 0) {
    text = `${POWERUPS[current.power].glyph} ${POWERUPS[current.power].label}`;
    color = POWERUPS[current.power].color;
  } else if (next.power >= 0) {
    text = `SIGUE: ${POWERUPS[next.power].label}`;
    color = POWERUPS[next.power].color;
  } else {
    text = `${POWERUP_EVERY - powerCharge} líneas`;
  }
  if (powerStatusEl.textContent !== text) powerStatusEl.textContent = text;
  powerStatusEl.style.color = color || '';
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  if (colorIndex >= POWER_BASE) { drawPowerBlock(context, x, y, size, alpha, colorIndex - POWER_BASE); return; }
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawPowerBlock(context, x, y, size, alpha, kind) {
  const p = POWERUPS[kind];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = p.color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.25)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  // glifo
  context.fillStyle = 'rgba(20,20,30,0.85)';
  context.font = `bold ${Math.round(size * 0.62)}px system-ui, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(p.glyph, x * size + size / 2, y * size + size / 2 + 1);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = document.body.classList.contains('light-theme') ? GRID_COLOR.light : GRID_COLOR.dark;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function drawPowerPreview() {
  const p = POWERUPS[current.power];
  if (p.id !== 'bomb' && p.id !== 'bolt') return;
  const gy = ghostY();
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = p.color;
  if (p.id === 'bomb') {
    ctx.fillRect((current.x - 1) * BLOCK, (gy - 1) * BLOCK, BLOCK * 3, BLOCK * 3);
  } else {
    ctx.fillRect(0, gy * BLOCK, COLS * BLOCK, BLOCK);
    ctx.fillRect(current.x * BLOCK, 0, BLOCK, ROWS * BLOCK);
  }
  ctx.globalAlpha = 1;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  if (!current) return; // aún no se ha iniciado la partida (pantalla de inicio)

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // destello de celdas afectadas por el último power-up
  if (flashLeft > 0) {
    ctx.globalAlpha = (flashLeft / FLASH_MS) * 0.8;
    ctx.fillStyle = '#ffffff';
    for (const [c, r] of flashCells) ctx.fillRect(c * BLOCK + 1, r * BLOCK + 1, BLOCK - 2, BLOCK - 2);
    ctx.globalAlpha = 1;
  }

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  if (current.power >= 0) drawPowerPreview();

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!next) return; // aún no se ha iniciado la partida (pantalla de inicio)
  const shape = next.shape;
  const offX = next.power >= 0 ? 1.5 : Math.floor((4 - shape[0].length) / 2);
  const offY = next.power >= 0 ? 1.5 : Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function loadHighScores() {
  try {
    const list = JSON.parse(localStorage.getItem(HS_KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveHighScores(list) {
  localStorage.setItem(HS_KEY, JSON.stringify(list));
}

function loadBestStats() {
  try {
    const stats = JSON.parse(localStorage.getItem(HS_STATS_KEY));
    return stats && typeof stats === 'object'
      ? { bestCombo: stats.bestCombo || 0, bestLines: stats.bestLines || 0 }
      : { bestCombo: 0, bestLines: 0 };
  } catch {
    return { bestCombo: 0, bestLines: 0 };
  }
}

function saveBestStats(stats) {
  localStorage.setItem(HS_STATS_KEY, JSON.stringify(stats));
}

// se llama siempre al terminar la partida, entre en el top 5 o no
function updateBestStats(comboThisGame, linesThisGame) {
  const stats = loadBestStats();
  let changed = false;
  if (comboThisGame > stats.bestCombo) { stats.bestCombo = comboThisGame; changed = true; }
  if (linesThisGame > stats.bestLines) { stats.bestLines = linesThisGame; changed = true; }
  if (changed) saveBestStats(stats);
  return stats;
}

function isHighScore(candidateScore) {
  const list = loadHighScores();
  if (list.length < HS_MAX) return true;
  return candidateScore > list[list.length - 1].score;
}

function addHighScore(entry) {
  const list = loadHighScores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  list.length = Math.min(list.length, HS_MAX);
  saveHighScores(list);
  return list;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function leaderboardHTML(list, highlightIndex) {
  const stats = loadBestStats();
  const rows = list.length
    ? `<ol class="hs-list">${list.map((e, i) => `
        <li class="${i === highlightIndex ? 'hs-highlight' : ''}">
          <span class="hs-rank">${i + 1}.</span>
          <span class="hs-name">${escapeHtml(e.name)}</span>
          <span class="hs-score">${e.score.toLocaleString()}</span>
        </li>`).join('')}</ol>`
    : '<p class="hs-empty">Sin récords aún</p>';
  const statsLine = `<p class="hs-stats">Mejor combo: ${stats.bestCombo} líneas · Máx. líneas: ${stats.bestLines}</p>`;
  return rows + statsLine;
}

function renderStartLeaderboard() {
  startLeaderboardEl.innerHTML = leaderboardHTML(loadHighScores(), -1);
}

function renderGameOverLeaderboard(highlightIndex) {
  overlayLeaderboardEl.innerHTML = leaderboardHTML(loadHighScores(), highlightIndex);
  overlayLeaderboardEl.classList.remove('hidden');
}

function submitScore() {
  const name = (nameInput.value.trim() || 'AAA').toUpperCase().slice(0, 10);
  const entry = { name, score, lines, combo: maxCombo };
  const list = addHighScore(entry);
  nameEntry.classList.add('hidden');
  renderGameOverLeaderboard(list.indexOf(entry));
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  pauseBox.classList.add('hidden');
  gameoverBox.classList.remove('hidden');
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  updateBestStats(maxCombo, lines);
  if (isHighScore(score)) {
    nameEntry.classList.remove('hidden');
    overlayLeaderboardEl.classList.add('hidden');
    nameInput.value = '';
    overlay.classList.remove('hidden');
    nameInput.focus();
  } else {
    nameEntry.classList.add('hidden');
    renderGameOverLeaderboard(-1);
    overlay.classList.remove('hidden');
  }
}

function setTheme(isLight) {
  document.body.classList.toggle('light-theme', isLight);
  themeToggle.checked = isLight;
  localStorage.setItem(THEME_STORAGE_KEY, isLight ? 'light' : 'dark');
  draw();
  drawNext();
}

function loadTheme() {
  setTheme(localStorage.getItem(THEME_STORAGE_KEY) === 'light');
}

function setStartLevel(value) {
  startLevel = Math.min(MAX_START_LEVEL, Math.max(1, value));
  startLevelSelect.value = String(startLevel);
  localStorage.setItem(START_LEVEL_STORAGE_KEY, String(startLevel));
}

function loadStartLevel() {
  const stored = parseInt(localStorage.getItem(START_LEVEL_STORAGE_KEY), 10);
  setStartLevel(Number.isInteger(stored) ? stored : 1);
}

function showPauseView(view) {
  pauseViewMain.classList.toggle('hidden', view !== 'main');
  pauseViewControls.classList.toggle('hidden', view !== 'controls');
}

function openPauseMenu() {
  paused = true;
  cancelAnimationFrame(animId);
  showPauseView('main');
  gameoverBox.classList.add('hidden');
  pauseBox.classList.remove('hidden');
  overlay.classList.remove('hidden');
}

function resumeGame() {
  paused = false;
  overlay.classList.add('hidden');
  lastTime = performance.now();
  animId = requestAnimationFrame(loop);
}

function togglePause() {
  if (gameOver) return;
  if (paused) {
    resumeGame();
  } else {
    openPauseMenu();
  }
}

function loop(ts) {
  if (gameOver) return;
  const dt = ts - lastTime;
  lastTime = ts;
  if (flashLeft > 0) flashLeft = Math.max(0, flashLeft - dt);
  if (freezeLeft > 0) {
    freezeLeft = Math.max(0, freezeLeft - dt);
    dropAccum = 0;                 // no acumular gravedad mientras está congelado
    updatePowerHUD();
  } else {
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  powerCharge = 0;
  powerArmed = false;
  freezeLeft = 0;
  flashCells = [];
  flashLeft = 0;
  maxCombo = 0;
  canvas.classList.remove('power-flash');
  next = randomPiece();
  spawn();
  updateHUD();
  gameoverBox.classList.remove('hidden');
  pauseBox.classList.add('hidden');
  showPauseView('main');
  overlay.classList.add('hidden');
  nameEntry.classList.add('hidden');
  overlayLeaderboardEl.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (!current) return; // pantalla de inicio: partida aún no iniciada
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
themeToggle.addEventListener('change', () => setTheme(themeToggle.checked));
resumeBtn.addEventListener('click', resumeGame);
pauseRestartBtn.addEventListener('click', init);
showControlsBtn.addEventListener('click', () => showPauseView('controls'));
hideControlsBtn.addEventListener('click', () => showPauseView('main'));
startLevelSelect.addEventListener('change', () => setStartLevel(parseInt(startLevelSelect.value, 10)));

playBtn.addEventListener('click', () => {
  startOverlay.classList.add('hidden');
  init();
});

resetScoresBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todos los récords guardados?')) return;
  localStorage.removeItem(HS_KEY);
  localStorage.removeItem(HS_STATS_KEY);
  renderStartLeaderboard();
});

saveScoreBtn.addEventListener('click', submitScore);
nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') submitScore();
});

loadStartLevel();
loadTheme();
renderStartLeaderboard();

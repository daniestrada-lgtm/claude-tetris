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

// paleta suavizada para el skin Pastel (mismo orden de índices que COLORS)
const PASTEL_COLORS = [
  null,
  '#b3e5eb', // I
  '#fff2c2', // O
  '#e3c6ea', // T
  '#c9e8ca', // S
  '#f5c9c9', // Z
  '#c3ddf7', // J
  '#ffe0bd', // L
];

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
const skinSelect = document.getElementById('skin-select');

const THEME_STORAGE_KEY = 'tetris-theme';
const SKIN_STORAGE_KEY = 'tetris-skin';
const GRID_COLOR = { dark: '#22222e', light: '#e0e0e8' };

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let powerCharge, powerArmed, freezeLeft, flashCells, flashLeft;
let activeSkinId = 'retro';

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
    score += LINE_SCORES[Math.min(cleared, LINE_SCORES.length - 1)] * level;
    level = Math.floor(lines / 10) + 1;
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

// ---- Skins: cada uno define cómo pintar un bloque normal y un bloque de power-up.
// El resto del juego siempre llama a drawBlock()/drawPowerBlock() (firma estable);
// estas dos delegan en el skin activo.

function roundedRectPath(context, x, y, w, h, r) {
  if (typeof context.roundRect === 'function') {
    context.beginPath();
    context.roundRect(x, y, w, h, r);
    return;
  }
  // fallback manual (arcTo) para motores sin roundRect nativo
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function shadeColor(hex, amt) {
  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0xff) + amt;
  let b = (num & 0xff) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}

// dither/textura tipo pixel-art: cuadrícula 4x4 alternando luz/sombra sobre el color base
function drawDither(context, px, py, size, hexColor) {
  const light = shadeColor(hexColor, 22);
  const dark = shadeColor(hexColor, -22);
  const cell = size / 4;
  for (let gy = 0; gy < 4; gy++) {
    for (let gx = 0; gx < 4; gx++) {
      context.fillStyle = (gx + gy) % 2 === 0 ? light : dark;
      context.fillRect(px + gx * cell, py + gy * cell, cell, cell);
    }
  }
}

const SKINS = [
  {
    id: 'retro',
    label: 'Retro',
    colors: COLORS,
    // idéntico byte a byte al render original: bloque plano + franja de brillo
    drawBlock(context, x, y, colorIndex, size, alpha) {
      const color = COLORS[colorIndex];
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      // highlight
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      context.globalAlpha = 1;
    },
    drawPowerBlock(context, x, y, size, alpha, kind) {
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
    },
  },
  {
    id: 'neon',
    label: 'Neon',
    colors: COLORS,
    gridColor: () => 'rgba(0, 229, 255, 0.08)', // grid tenue cian, independiente de claro/oscuro
    drawBlock(context, x, y, colorIndex, size, alpha) {
      const color = COLORS[colorIndex];
      context.globalAlpha = alpha ?? 1;
      context.shadowBlur = 12;
      context.shadowColor = color;
      context.fillStyle = color;
      context.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
      // IMPORTANTE: apagar el resplandor tras cada bloque para que no se filtre
      // al grid/ghost/siguiente elemento dibujado sobre el mismo canvas.
      context.shadowBlur = 0;
      context.shadowColor = 'transparent';
      context.strokeStyle = color;
      context.lineWidth = 1;
      context.strokeRect(x * size + 1.5, y * size + 1.5, size - 3, size - 3);
      context.globalAlpha = 1;
    },
    drawPowerBlock(context, x, y, size, alpha, kind) {
      const p = POWERUPS[kind];
      context.globalAlpha = alpha ?? 1;
      context.shadowBlur = 16;
      context.shadowColor = p.color;
      context.fillStyle = p.color;
      context.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
      context.shadowBlur = 0;
      context.shadowColor = 'transparent';
      context.fillStyle = 'rgba(0,0,0,0.85)';
      context.font = `bold ${Math.round(size * 0.62)}px system-ui, sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(p.glyph, x * size + size / 2, y * size + size / 2 + 1);
      context.globalAlpha = 1;
    },
  },
  {
    id: 'pastel',
    label: 'Pastel',
    colors: PASTEL_COLORS,
    drawBlock(context, x, y, colorIndex, size, alpha) {
      const color = PASTEL_COLORS[colorIndex];
      const r = size * 0.22;
      context.globalAlpha = alpha ?? 1;
      context.save();
      roundedRectPath(context, x * size + 1, y * size + 1, size - 2, size - 2, r);
      context.clip();
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      context.restore();
      context.globalAlpha = 1;
    },
    drawPowerBlock(context, x, y, size, alpha, kind) {
      const p = POWERUPS[kind];
      const r = size * 0.22;
      context.globalAlpha = alpha ?? 1;
      context.save();
      roundedRectPath(context, x * size + 1, y * size + 1, size - 2, size - 2, r);
      context.clip();
      context.fillStyle = p.color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.4)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      context.restore();
      context.fillStyle = 'rgba(20,20,30,0.75)';
      context.font = `bold ${Math.round(size * 0.6)}px system-ui, sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(p.glyph, x * size + size / 2, y * size + size / 2 + 1);
      context.globalAlpha = 1;
    },
  },
  {
    id: 'pixel',
    label: 'Pixel Art',
    colors: COLORS,
    drawBlock(context, x, y, colorIndex, size, alpha) {
      const color = COLORS[colorIndex];
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      drawDither(context, x * size + 1, y * size + 1, size - 2, color);
      context.strokeStyle = 'rgba(0,0,0,0.35)';
      context.lineWidth = 1;
      context.strokeRect(x * size + 1.5, y * size + 1.5, size - 3, size - 3);
      context.globalAlpha = 1;
    },
    drawPowerBlock(context, x, y, size, alpha, kind) {
      const p = POWERUPS[kind];
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = p.color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      drawDither(context, x * size + 1, y * size + 1, size - 2, p.color);
      context.strokeStyle = 'rgba(0,0,0,0.35)';
      context.lineWidth = 1;
      context.strokeRect(x * size + 1.5, y * size + 1.5, size - 3, size - 3);
      context.fillStyle = 'rgba(20,20,30,0.85)';
      context.font = `bold ${Math.round(size * 0.62)}px system-ui, sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(p.glyph, x * size + size / 2, y * size + size / 2 + 1);
      context.globalAlpha = 1;
    },
  },
];

function getSkin() {
  return SKINS.find(s => s.id === activeSkinId) || SKINS[0];
}

function getActiveSkin() {
  return activeSkinId;
}

function setSkin(id) {
  activeSkinId = SKINS.some(s => s.id === id) ? id : 'retro';
  document.body.dataset.skin = activeSkinId;
  if (skinSelect) skinSelect.value = activeSkinId;
  localStorage.setItem(SKIN_STORAGE_KEY, activeSkinId);
  draw();
  drawNext();
}

function loadSkin() {
  setSkin(localStorage.getItem(SKIN_STORAGE_KEY) || 'retro');
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  if (colorIndex >= POWER_BASE) { drawPowerBlock(context, x, y, size, alpha, colorIndex - POWER_BASE); return; }
  getSkin().drawBlock(context, x, y, colorIndex, size, alpha);
}

function drawPowerBlock(context, x, y, size, alpha, kind) {
  getSkin().drawPowerBlock(context, x, y, size, alpha, kind);
}

function drawGrid() {
  const skin = getSkin();
  const isLight = document.body.classList.contains('light-theme');
  const color = skin.gridColor ? skin.gridColor(isLight) : (isLight ? GRID_COLOR.light : GRID_COLOR.dark);
  if (!color) return; // el skin activo no quiere líneas de grid
  ctx.strokeStyle = color;
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
  const shape = next.shape;
  const offX = next.power >= 0 ? 1.5 : Math.floor((4 - shape[0].length) / 2);
  const offY = next.power >= 0 ? 1.5 : Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
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

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
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
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  powerCharge = 0;
  powerArmed = false;
  freezeLeft = 0;
  flashCells = [];
  flashLeft = 0;
  canvas.classList.remove('power-flash');
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
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
if (skinSelect) skinSelect.addEventListener('change', () => setSkin(skinSelect.value));

init();
loadTheme();
loadSkin();

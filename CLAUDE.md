# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Classic Tetris implemented in vanilla JavaScript (ES6+), HTML5 Canvas, and CSS. No dependencies, no build step, no bundler, no `package.json`. The entire game logic lives in `game.js` (~460 lines).

## Running the game

There is no build/lint/test tooling. To run:

```bash
start index.html          # Windows: open directly in browser
# or serve statically, e.g.
npx serve .
python3 -m http.server 8000
```

Then verify changes by opening the page in a browser and playing — there are no automated tests.

## Architecture

Three files, no modules:

- `index.html` — DOM structure: `#board` canvas (300×600, 30px cells), `#next-canvas` for the next-piece preview, HUD spans (`#score`, `#lines`, `#level`, `#power-status`), and the pause/game-over `#overlay`.
- `style.css` — dark/retro arcade visual theme.
- `game.js` — all game logic, driven by global mutable state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `powerCharge`, `powerArmed`, `freezeLeft`, `flashCells`, `flashLeft`, etc.) rather than classes or modules.

### Core model

- **Board**: `ROWS × COLS` (20×10) matrix; each cell is `0` (empty) or a color index `1–7` identifying the locked piece type. Values `≥ POWER_BASE` (8–12) exist only in a falling power-up's `shape` and in render code — they are **never** written to `board`, because `lockPiece` fires the effect instead of calling `merge()` when the piece is a power-up.
- **Pieces**: defined in `PIECES` as square matrices of color indices. Rotation is done via `rotateCW` (transpose + row reversal), not by storing pre-rotated states.
- **Collision** (`collide`): checks board bounds and overlap with locked cells for a given shape/offset.
- **Wall kicks** (`tryRotate`): after rotating, tries offsets `[0, -1, 1, -2, 2]` and keeps the first that doesn't collide.
- **Game loop** (`loop`): `requestAnimationFrame`-driven; returns immediately if `gameOver`; accumulates delta time and advances the piece one row once `dropAccum >= dropInterval`, otherwise locks it (`lockPiece`); skips the drop entirely (but keeps ticking down `freezeLeft`) while a Congelar effect is active.
- **Line clears** (`clearLines`): scans bottom-up, splices completed rows and unshifts empty rows at the top; re-checks the same row index after a splice; returns the number of rows cleared.
- **Scoring**: `LINE_SCORES[Math.min(cleared, 4)]` multiplied by `level` (clamped because power-up cascades can clear more than 4 rows at once); hard drop adds 2 pts/cell dropped, soft drop adds 1 pt/row; power-up effects add `POWER_POINTS[id] * level` per affected cell, via `score` only — never via `lines`.
- **Leveling/speed**: level = `floor(lines / 10) + 1`; `dropInterval = max(100, 1000 - (level - 1) * 90)` ms.
- **Ghost piece** (`ghostY`): projects the current piece straight down to its landing row, drawn at `globalAlpha = 0.2`.

### Power-ups

Every `POWERUP_EVERY` (5) lines cleared arms `powerArmed`; it's consumed by the next `spawn()`, so the power-up piece appears first in the `next` preview and becomes `current` a piece later. A power-up is a 1×1 block with cell value `POWER_BASE + kind` — it is rendered (`drawPowerBlock`) but never merged into `board`. On lock, `lockPiece` branches to `firePowerUp` instead of `merge()`/`clearLines()`. The five effects (`powerBomb`, `powerBolt`, `powerDye`, `powerGravity`, `powerFreeze`) live right after `clearLines()`. Two rules that are easy to get wrong when touching this code:

1. **Never write `dropInterval` for Congelar.** `clearLines()` unconditionally recomputes `dropInterval` on every clear, so any direct override gets silently clobbered. Congelar instead ticks a `dt`-based `freezeLeft` down inside `loop()`, which is pause-safe for free (`togglePause()` resets `lastTime` on resume).
2. **Destroyed/moved cells never increment `lines`.** `lines` drives both level speed and the power-up cadence — feeding bomb/rayo/tinte destruction counts into it would create a feedback loop. Only genuinely completed rows (via `clearLines()`, including cascades from Tinte/Gravedad) count.

### Control flow

`init()` builds the board, seeds `next`, calls `spawn()`, and starts the `loop`. Each `keydown` dispatches to move/rotate/soft-drop/hard-drop/pause handlers (see the `switch` at the bottom of `game.js`); `P` toggles pause independent of game-over state. If a freshly spawned piece immediately collides, `endGame()` fires and shows the Game Over overlay; `#restart-btn` calls `init()` again.

## Tunable constants (`game.js`)

`COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, initial `dropInterval`, `POWERUP_EVERY`, `FREEZE_MS`, `FLASH_MS`, `POWER_POINTS`, `POWERUPS`. If `COLS`/`ROWS`/`BLOCK` change, update the `#board` canvas `width`/`height` in `index.html` to match (`COLS × BLOCK`, `ROWS × BLOCK`).

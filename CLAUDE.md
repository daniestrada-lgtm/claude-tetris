# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Classic Tetris implemented in vanilla JavaScript (ES6+), HTML5 Canvas, and CSS. No dependencies, no build step, no bundler, no `package.json`. The entire game logic lives in `game.js` (~300 lines).

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

- `index.html` — DOM structure: `#board` canvas (300×600, 30px cells), `#next-canvas` for the next-piece preview, HUD spans (`#score`, `#lines`, `#level`), and the pause/game-over `#overlay`.
- `style.css` — dark/retro arcade visual theme.
- `game.js` — all game logic, driven by global mutable state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.) rather than classes or modules.

### Core model

- **Board**: `ROWS × COLS` (20×10) matrix; each cell is `0` (empty) or a color index `1–7` identifying the locked piece type.
- **Pieces**: defined in `PIECES` as square matrices of color indices. Rotation is done via `rotateCW` (transpose + row reversal), not by storing pre-rotated states.
- **Collision** (`collide`): checks board bounds and overlap with locked cells for a given shape/offset.
- **Wall kicks** (`tryRotate`): after rotating, tries offsets `[0, -1, 1, -2, 2]` and keeps the first that doesn't collide.
- **Game loop** (`loop`): `requestAnimationFrame`-driven; accumulates delta time and advances the piece one row once `dropAccum >= dropInterval`, otherwise locks it (`lockPiece`).
- **Line clears** (`clearLines`): scans bottom-up, splices completed rows and unshifts empty rows at the top; re-checks the same row index after a splice.
- **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by `level`; hard drop adds 2 pts/cell dropped, soft drop adds 1 pt/row.
- **Leveling/speed**: level = `floor(lines / 10) + 1`; `dropInterval = max(100, 1000 - (level - 1) * 90)` ms.
- **Ghost piece** (`ghostY`): projects the current piece straight down to its landing row, drawn at `globalAlpha = 0.2`.

### Control flow

`init()` builds the board, seeds `next`, calls `spawn()`, and starts the `loop`. Each `keydown` dispatches to move/rotate/soft-drop/hard-drop/pause handlers (see the `switch` at the bottom of `game.js`); `P` toggles pause independent of game-over state. If a freshly spawned piece immediately collides, `endGame()` fires and shows the Game Over overlay; `#restart-btn` calls `init()` again.

## Tunable constants (`game.js`)

`COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, initial `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, update the `#board` canvas `width`/`height` in `index.html` to match (`COLS × BLOCK`, `ROWS × BLOCK`).

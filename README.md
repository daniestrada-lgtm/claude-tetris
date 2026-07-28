# Tetris

Implementación del clásico **Tetris** en JavaScript vanilla, usando HTML5 Canvas y CSS. Sin dependencias externas, sin frameworks, sin proceso de build: solo abrir y jugar.

![Tech](https://img.shields.io/badge/HTML5-Canvas-orange)
![Tech](https://img.shields.io/badge/CSS3-blueviolet)
![Tech](https://img.shields.io/badge/JavaScript-Vanilla-yellow)

---

## Tabla de contenidos

- [Tetris](#tetris)
  - [Tabla de contenidos](#tabla-de-contenidos)
  - [Qué hace el proyecto](#qué-hace-el-proyecto)
  - [Cómo ejecutar el juego](#cómo-ejecutar-el-juego)
    - [Opción 1: abrir el archivo directamente](#opción-1-abrir-el-archivo-directamente)
    - [Opción 2: servidor local (recomendado)](#opción-2-servidor-local-recomendado)
  - [Controles](#controles)
  - [Power-ups](#power-ups)
  - [Menú de pausa](#menú-de-pausa)
  - [Tabla de records](#tabla-de-records)
  - [Temas visuales / skins](#temas-visuales--skins)
  - [Cómo funciona](#cómo-funciona)
    - [1. `index.html`](#1-indexhtml)
    - [2. `style.css`](#2-stylecss)
    - [3. `game.js`](#3-gamejs)
    - [Flujo del juego](#flujo-del-juego)
  - [Tecnologías](#tecnologías)
  - [Estructura del proyecto](#estructura-del-proyecto)
  - [Personalización](#personalización)
  - [Licencia](#licencia)

---

## Qué hace el proyecto

Es una versión jugable del Tetris clásico con todas las mecánicas que esperarías:

- Tablero de **10 × 20** celdas.
- Las **7 piezas estándar** (I, O, T, S, Z, J, L) con colores diferenciados.
- **Rotación** con _wall kicks_ básicos (pequeños desplazamientos para que la pieza pueda rotar pegada a la pared).
- **Soft drop** (bajada acelerada) y **hard drop** (caída instantánea).
- **Pieza fantasma** (_ghost piece_): muestra dónde aterrizará la pieza actual.
- **Vista previa** de la siguiente pieza.
- **Sistema de puntuación** clásico de Tetris (100 / 300 / 500 / 800 multiplicado por nivel).
- **Niveles** que aumentan cada 10 líneas y aceleran la caída.
- **Power-ups aleatorios**: cada 5 líneas eliminadas aparece una pieza especial con un efecto (Bomba, Rayo, Tinte, Gravedad o Congelar).
- **Pausa** y **Game Over** con opción de reinicio.
- **Menú de pausa completo**: `P` o `Escape` abren un menú con Reanudar, Reiniciar, un listado de controles y un selector del nivel en el que empezará la próxima partida.
- **Tabla de records local**: guarda en el navegador el top 5 de puntuaciones, el mejor combo conseguido y el máximo de líneas en una partida.
- **Pantalla de inicio**: pantalla de bienvenida con botón **JUGAR** y la tabla de records, mostrada antes de que empiece cualquier partida.
- **Temas visuales (skins)**: 4 estilos de renderizado del tablero (Retro, Neon, Pastel, Pixel art), independientes del interruptor de tema claro/oscuro.

---

## Cómo ejecutar el juego

No hay nada que instalar ni compilar. Tienes dos opciones:

### Opción 1: abrir el archivo directamente

```bash
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

### Opción 2: servidor local (recomendado)

Cualquier servidor estático funciona. Algunos ejemplos:

```bash
# Con Python 3
python3 -m http.server 8000

# Con Node.js (npx)
npx serve .

# Con PHP
php -S localhost:8000
```

Después abre `http://localhost:8000` en el navegador.

---

## Controles

| Tecla     | Acción                            |
| --------- | --------------------------------- |
| `←` / `→` | Mover la pieza horizontalmente    |
| `↑` o `X` | Rotar la pieza en sentido horario |
| `↓`       | Soft drop (bajar más rápido)      |
| `Espacio` | Hard drop (caída instantánea)     |
| `P` / `Escape` | Abrir / cerrar el menú de pausa   |

Los power-ups no necesitan teclas nuevas: llegan como una pieza que cae y se activan automáticamente al aterrizar.

Mientras el menú de pausa está abierto, el resto de teclas (mover, rotar, soft drop, hard drop) queda bloqueado — no se procesan hasta cerrar el menú, para evitar movimientos accidentales al reanudar.

---

## Power-ups

Cada **5 líneas** eliminadas, la vista `NEXT` anuncia una pieza especial (un bloque 1×1 con un glifo) que, al aterrizar, dispara su efecto y desaparece del tablero — no se fusiona como una pieza normal.

| Icono | Nombre     | Efecto                                                                 | Puntos               |
| ----- | ---------- | ----------------------------------------------------------------------- | --------------------- |
| ✷     | Bomba      | Destruye un área 3×3 centrada en la celda de aterrizaje                 | 30 × nivel / bloque   |
| ↯     | Rayo       | Limpia la fila y la columna donde aterriza (una cruz)                   | 20 × nivel / bloque   |
| ◈     | Tinte      | Destruye todos los bloques del color más abundante del tablero          | 10 × nivel / bloque   |
| ⇓     | Gravedad   | Compacta los huecos: cada columna cae hasta el fondo                    | 5 × nivel / bloque    |
| ✻     | Congelar   | Pausa la caída de la pieza actual durante 5 segundos (el input sigue vivo) | 250 × nivel (fijo)  |

Notas de diseño:

- **Bomba y Rayo dejan huecos y bloques flotantes a propósito** — no compactan el tablero por sí solos. Para eso está **Gravedad**: sin los huecos de los otros dos efectos, Gravedad no tendría nada que hacer.
- **Tinte** y **Gravedad** sí pueden completar filas (cascada), y esas filas cuentan como líneas normales — pero los bloques destruidos directamente por un power-up solo dan puntos, nunca incrementan el contador de `LINES` (para evitar que un power-up dispare el nivel y se auto-alimente).
- Congelar no cancela el aterrizaje ni el input: puedes seguir moviendo, rotando y haciendo soft/hard drop mientras el tablero está congelado.

---

## Menú de pausa

Al presionar `P` o `Escape` se abre `#pause-menu`, un menú completo (no solo un overlay de "PAUSA") con las siguientes opciones:

- **Reanudar**: cierra el menú y continúa la partida exactamente donde se quedó.
- **Reiniciar**: llama a `init()` sin recargar la página — empieza una partida nueva desde el menú, sin pasar por la pantalla de inicio.
- **Ver controles**: alterna dentro del propio menú un listado de teclas, para no tener que recordar los controles a mitad de partida.
- **Selector de nivel inicial** (`#pm-start-level`): un `<select>` con los niveles del 1 al 10 que define en qué nivel arrancará la **siguiente** partida (no afecta a la que está en curso). La elección se guarda en `localStorage` bajo la clave `tetris-start-level` y se recuerda entre sesiones.

Mientras `#pause-menu` está abierto, **todos los inputs de juego quedan bloqueados**: mover, rotar, soft drop y hard drop no tienen efecto hasta que el menú se cierra (por Reanudar, o volviendo a presionar `P`/`Escape`). Esto evita que, por ejemplo, una tecla de movimiento presionada justo antes de reanudar mueva la pieza sin que el jugador lo vea venir.

---

## Tabla de records

El juego guarda un mini-leaderboard local en `localStorage`, bajo la clave `tetris-records`, con esta forma:

```json
{
  "top": [
    { "name": "AAA", "score": 12345, "lines": 42, "level": 5 }
  ],
  "bestCombo": 7,
  "maxLines": 42
}
```

- **`top`**: hasta **5** entradas, ordenadas de mayor a menor puntaje (`score`). Cada entrada guarda el nombre ingresado, el puntaje final, las líneas eliminadas y el nivel alcanzado en esa partida.
- **`bestCombo`**: el mejor combo histórico — la racha más larga de piezas consecutivas que, al fijarse, completaron al menos una línea.
- **`maxLines`**: el máximo de líneas eliminadas en una sola partida, histórico.
- La tabla se muestra en la **pantalla de inicio** y también en el overlay de **Game Over** al terminar cada partida.
- Si el puntaje final de la partida entra en el top 5, el overlay de Game Over pide el nombre del jugador antes de guardar la entrada; la nueva entrada se resalta visualmente en la tabla para distinguirla de las anteriores.
- Un botón **`#reset-records`** permite borrar toda la tabla (records, mejor combo y máximo de líneas); antes de borrar pide una confirmación (`confirm(...)`) para evitar borrados accidentales.

---

## Temas visuales / skins

Un selector (`<select id="skin-select">`) permite elegir entre **4 estilos visuales completos** para el tablero y las piezas. La elección se guarda en `localStorage` bajo la clave `tetris-skin` y se aplica de inmediato.

| Skin       | Estilo visual                                                                 |
| ---------- | ------------------------------------------------------------------------------ |
| Retro      | El estilo original: bloques planos de un solo color, sin efectos adicionales.  |
| Neon       | Fondo negro y un resplandor (`shadowBlur` del canvas) alrededor de cada bloque. |
| Pastel     | Paleta de colores suavizada, con esquinas redondeadas simuladas en cada bloque. |
| Pixel art  | Un patrón de textura/dithering dibujado sobre cada bloque, look retro 8-bit.    |

El skin es **independiente** del interruptor de tema claro/oscuro ya existente: el skin gobierna cómo se dibujan el tablero y los bloques (incluyendo los power-ups); el interruptor claro/oscuro gobierna el resto del "chrome" de la página (paneles, fondo, tipografía del HUD). Ambos se pueden combinar libremente — por ejemplo, "Neon" + tema claro es una combinación válida.

---

## Cómo funciona

El juego se compone de tres archivos que cooperan:

### 1. `index.html`

Define la estructura visual:

- Un `#start-screen` que se muestra al cargar la página, con el botón **JUGAR** (`#start-btn`) y la tabla de records — el juego ya no arranca automáticamente al abrir el archivo.
- Un `<canvas id="board">` de **300 × 600** píxeles donde se renderiza el tablero.
- Un panel lateral con `SCORE`, `LINES`, `LEVEL`, `POWER-UP` (estado del próximo/actual power-up), vista de la siguiente pieza, la leyenda de power-ups, la lista de controles y el selector de skin (`#skin-select`).
- Un `#pause-menu` con Reanudar, Reiniciar, Ver controles y el selector de nivel inicial (`#pm-start-level`) — sustituye al overlay simple de PAUSA que existía antes de esta versión.
- Un overlay para el estado **GAME OVER**, con opción de reinicio, el formulario de nombre cuando el puntaje entra al top 5 y el botón `#reset-records`.

### 2. `style.css`

Aporta el aspecto visual con estética _dark / retro arcade_: fondo oscuro, tipografía monoespaciada para los marcadores y _backdrop blur_ en los overlays.

### 3. `game.js`

Contiene toda la lógica del juego. A grandes rasgos:

- **Modelo del tablero**: una matriz `ROWS × COLS` donde cada celda guarda `0` (vacía) o un índice de color (1–7) que identifica la pieza.
- **Piezas**: definidas como matrices cuadradas. Para rotar se calcula la transposición + reverso de filas (`rotateCW`).
- **Detección de colisiones** (`collide`): comprueba que ninguna celda de la pieza salga del tablero ni se solape con bloques ya fijados.
- **Wall kicks** (`tryRotate`): si la rotación choca, intenta desplazar la pieza ±1 y ±2 columnas antes de descartar el giro.
- **Game loop** (`loop`): basado en `requestAnimationFrame`, acumula el tiempo transcurrido y baja la pieza una fila cuando se supera `dropInterval`.
- **Limpieza de líneas** (`clearLines`): recorre el tablero de abajo hacia arriba; cada fila completa se elimina y se inserta una vacía en la cima.
- **Puntuación**: usa la tabla clásica `[0, 100, 300, 500, 800]` multiplicada por el nivel actual; el hard drop suma 2 puntos por celda recorrida y el soft drop 1 punto por fila.
- **Nivel y velocidad**: el nivel sube cada 10 líneas; la velocidad de caída se calcula como `max(100, 1000 − (level − 1) × 90)` milisegundos.
- **Ghost piece** (`ghostY`): proyecta la posición final de la pieza actual hacia abajo y la dibuja con `globalAlpha = 0.2`.
- **Power-ups**: cada 5 líneas se arma la siguiente pieza generada como power-up (bloque 1×1, valores de celda 8–12 que nunca se escriben en `board`). Al aterrizar, `lockPiece` la dispara (`firePowerUp`) en lugar de fusionarla; los efectos posicionales (Bomba, Rayo) se telegrafían en el tablero como el ghost. Congelar usa un contador `freezeLeft` basado en delta-tiempo, así que sobrevive a la pausa sin usar `Date.now()`.
- **Persistencia en `localStorage`**: el nivel inicial elegido en el menú de pausa (`tetris-start-level`), la tabla de records (`tetris-records`) y el skin activo (`tetris-skin`) se guardan en el navegador y se recuperan al recargar la página; la lectura de estos valores es defensiva (si el dato guardado está corrupto o falta, se usa un valor por defecto en lugar de lanzar un error).

### Flujo del juego

```
carga de la página
  └─ #start-screen visible (muestra la tabla de records) — NO se llama a init()
        ↓ clic en #start-btn ("JUGAR")

init()
  ├─ createBoard()                  → matriz vacía
  ├─ level = startLevel             → leído de localStorage (tetris-start-level)
  ├─ next = randomPiece()
  ├─ spawn()                        → mueve next a current y genera nueva next
  └─ requestAnimationFrame(loop)
        ↓
   loop(timestamp)
     ├─ si gameOver → return (no se reprograma)
     ├─ acumula dt
     ├─ si freezeLeft > 0 → no baja la pieza (solo descuenta freezeLeft)
     ├─ si no: si dt ≥ dropInterval → baja la pieza o llama a lockPiece()
     ├─ draw()  (grid + tablero + destello + ghost + pieza actual, según el skin activo)
     └─ requestAnimationFrame(loop)

   lockPiece()
     ├─ si pieza normal  → merge() → clearLines() (actualiza combo, records si aplica)
     └─ si power-up      → firePowerUp() (no hace merge: la pieza desaparece)

   keydown
     ├─ si #pause-menu está abierto → sólo procesa el propio menú, todo lo demás se ignora
     ├─ `P` / `Escape` → abre/cierra #pause-menu (Reanudar / Reiniciar / Ver controles / nivel inicial)
     └─ si no → mover / rotar / soft-drop / hard-drop
```

Cuando una pieza recién generada ya colisiona al aparecer (`spawn`), se dispara `endGame()` y se muestra el overlay de **Game Over**.

---

## Tecnologías

- **HTML5** — marcado y dos elementos `<canvas>` (tablero y vista previa).
- **CSS3** — _flexbox_, variables de color, `backdrop-filter` y `box-shadow`.
- **JavaScript (ES6+) vanilla** — `const`/`let`, _arrow functions_, _spread operator_, `Array.from`, _template literals_…
- **Canvas 2D API** — para todo el renderizado del juego.
- **`requestAnimationFrame`** — para el bucle de juego sincronizado con el navegador.
- **Web Storage (`localStorage`)** — persiste el nivel inicial elegido, la tabla de records y el skin activo entre sesiones.

**Sin dependencias.** No hay `package.json`, ni bundler, ni transpilador.

---

## Estructura del proyecto

```
03-tetris/
├── index.html      # Estructura del DOM y canvas
├── style.css       # Estilos del juego (dark theme)
├── game.js         # Toda la lógica del Tetris (~650 líneas, estimado)
└── README.md
```

---

## Personalización

Algunos parámetros fáciles de tunear en `game.js`:

| Constante      | Significado                              | Por defecto           |
| -------------- | ---------------------------------------- | --------------------- |
| `COLS`         | Columnas del tablero                     | `10`                  |
| `ROWS`         | Filas del tablero                        | `20`                  |
| `BLOCK`        | Tamaño en píxeles de cada celda          | `30`                  |
| `COLORS`       | Paleta de colores por tipo de pieza      | 7 colores             |
| `LINE_SCORES`  | Puntos por 1, 2, 3 o 4 líneas eliminadas | `[0,100,300,500,800]` |
| `dropInterval` | Velocidad inicial de caída en ms         | `1000`                |
| `POWERUP_EVERY`| Líneas necesarias para armar un power-up | `5`                    |
| `FREEZE_MS`    | Duración del efecto Congelar en ms       | `5000`                 |
| `tetris-start-level` (localStorage) | Nivel inicial elegido en el menú de pausa para la próxima partida | `1` |
| `tetris-records` (localStorage)     | Tabla de records: top 5, mejor combo y máximo de líneas           | `{ top: [], bestCombo: 0, maxLines: 0 }` |
| `tetris-skin` (localStorage)        | Skin visual activo (Retro / Neon / Pastel / Pixel art)            | `"retro"` |

> Si cambias `COLS`, `ROWS` o `BLOCK`, recuerda ajustar también `width` y `height` del `<canvas id="board">` en `index.html` para que coincida (`COLS × BLOCK` × `ROWS × BLOCK`).

---

## Licencia

Proyecto de uso libre con fines educativos y de práctica.

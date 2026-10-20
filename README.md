# Ghost Snake

A retro-arcade take on Snake. Three ghosts wander the maze; eat the glowing **power pellet** and the tables turn for exactly five seconds. Plain HTML, CSS and JavaScript on a `<canvas>`: no frameworks, no build step, no external assets. All sounds are synthesised with the Web Audio API.

## Run it

Open `index.html` in a modern browser. That's it. (Scripts are classic `<script>` tags, so it works from `file://` as well as from a web server.)

Optional local server:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Controls

| Key | Action |
| --- | --- |
| Arrow keys / `W` `A` `S` `D` | Steer the snake |
| `Space` / `Enter` | Start, resume, or play again |
| `P` / `Esc` | Pause / resume |
| `R` | Restart (back to the start screen, where you can change difficulty) |
| `M` | Mute / unmute |

The game also auto-pauses when the tab is hidden.

## Rules

- **Food** (yellow dots): +10 points and the snake grows by one.
- **Power pellet** (glowing, pulsing cyan orb): appears after every 4th food. +50 points, and **every ghost turns blue and edible for exactly 5 seconds** (game time, so pausing does not eat into it). Eating another pellet while powered refreshes the timer to 5 seconds. A side-panel meter shows the countdown; in the last 1.5 s the ghosts flash and the meter turns red.
- **Edible ghosts**: eating one scores 200, then 400, 800, 1600 for each further ghost in the same power window. An eaten ghost respawns at least 7 cells from your head.
- **Deadly things**: walls and wall blocks, your own body, and any ghost that is *not* blue.
- **Difficulty** changes the snake's speed: Easy (170 ms/step), Medium (125 ms), Hard (85 ms). Ghosts move relative to that speed (slower than the snake, slower still when frightened). Pick a difficulty on the start or game-over screen.
- **Best score** is saved in `localStorage`, separately for each difficulty.

### Collision rules

Contact between the snake's head and a ghost is resolved the same way no matter who moved:

- Snake moves onto a ghost, or ghost moves onto the head: if the ghost is dangerous the game ends, if it is edible the ghost is eaten.
- Ghosts cannot enter walls, other ghosts, or the snake's body (only the head cell), so they never pass through you.
- The snake may follow into the cell its tail is leaving on the same tick, but not into any other body cell.

## Project layout

```
index.html          page structure
css/style.css       neon arcade styling
js/config.js        constants, difficulty table, maze layout
js/collision.js     pure grid/collision queries
js/spawner.js       free-cell selection for pellets and ghosts
js/ghosts.js        ghost definitions and random-walk movement
js/game.js          game state and rules (DOM-free)
js/storage.js       best-score persistence
js/audio.js         Web Audio sound effects
js/input.js         keyboard handling
js/renderer.js      canvas drawing
js/ui.js            overlay, HUD and button wiring
js/main.js          wiring and the single requestAnimationFrame loop
tests/run-tests.js  logic tests (Node, no dependencies)
```

Audio note: browsers keep audio locked until a user gesture, so the audio context is created/resumed on the first key press or click. Sounds triggered before that are simply skipped.

## Tests

```sh
node tests/run-tests.js
```

Runs the DOM-free modules (collisions, spawning, power timer, scoring, storage, file references) with no dependencies.

## Deploy to GitHub Pages

All asset paths are relative, so the site works from a project sub-path.

1. Push the repository to GitHub with `index.html` at the repository root on `main`.
2. Go to **Settings -> Pages**.
3. Under **Build and deployment**, set **Source** to *Deploy from a branch*, choose branch `main` and folder `/ (root)`, then **Save**.
4. After a minute the game is live at `https://<your-username>.github.io/<repository-name>/`.

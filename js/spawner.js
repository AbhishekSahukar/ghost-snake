/* Picks free cells for pellets and ghosts. Takes an rng so tests can be deterministic. */
(function (root) {
  const GS = (root.GhostSnake = root.GhostSnake || {});
  const { GRID } = GS.Config;
  const C = GS.Collision;

  /** Cells that are floor and not covered by the snake, a ghost or a pellet. */
  function freeCells(state, filter) {
    const cells = [];
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (C.isBlocked(x, y)) continue;
        if (C.onSnake(state.snake, x, y)) continue;
        if (C.ghostAt(state.ghosts, x, y)) continue;
        if (state.food && state.food.x === x && state.food.y === y) continue;
        if (state.power && state.power.x === x && state.power.y === y) continue;
        if (filter && !filter(x, y)) continue;
        cells.push({ x: x, y: y });
      }
    }
    return cells;
  }

  function pick(cells, rng) {
    return cells.length ? cells[Math.floor(rng() * cells.length)] : null;
  }

  function spawnFood(state, rng) {
    return pick(freeCells(state), rng);
  }

  /** Ghosts prefer cells away from the head; fall back to any free cell on a crowded board. */
  function spawnGhostCell(state, rng, minDistance) {
    const head = state.snake[0];
    const far = freeCells(state, function (x, y) {
      return Math.abs(x - head.x) + Math.abs(y - head.y) >= minDistance;
    });
    return pick(far.length ? far : freeCells(state), rng);
  }

  GS.Spawner = { freeCells, spawnFood, spawnGhostCell };
})(globalThis);

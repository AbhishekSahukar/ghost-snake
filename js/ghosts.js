/* Ghost definitions and random-walk movement. */
(function (root) {
  const GS = (root.GhostSnake = root.GhostSnake || {});
  const C = GS.Collision;

  const DIRS = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];

  const LOOKS = [
    { name: 'Blinky', color: '#ff3355' },
    { name: 'Pinky', color: '#ff7be5' },
    { name: 'Inky', color: '#35f2ff' },
  ];

  function createGhost(index, cell) {
    const look = LOOKS[index % LOOKS.length];
    return { id: index, name: look.name, color: look.color, x: cell.x, y: cell.y, dir: DIRS[1] };
  }

  /**
   * Legal next cells for a ghost: inside the arena, not a wall, not the snake's body, not another ghost.
   * The snake's head IS allowed: that is how a ghost catches (or gets caught by) the snake.
   */
  function legalMoves(ghost, state) {
    const moves = [];
    for (let i = 0; i < DIRS.length; i++) {
      const d = DIRS[i];
      const nx = ghost.x + d.x;
      const ny = ghost.y + d.y;
      if (C.isBlocked(nx, ny)) continue;
      if (C.onSnake(state.snake.slice(1), nx, ny)) continue;
      if (C.ghostAt(state.ghosts, nx, ny, ghost)) continue;
      moves.push(d);
    }
    return moves;
  }

  /** Random walk that avoids instantly reversing unless that is the only way out. Returns a direction or null. */
  function chooseDirection(ghost, state, rng) {
    const moves = legalMoves(ghost, state);
    if (!moves.length) return null;
    const forward = moves.filter(function (d) {
      return !(d.x === -ghost.dir.x && d.y === -ghost.dir.y);
    });
    const pool = forward.length ? forward : moves;
    // Keep going straight about half the time so ghosts look like they are wandering, not jittering.
    const straight = pool.find(function (d) {
      return d.x === ghost.dir.x && d.y === ghost.dir.y;
    });
    if (straight && rng() < 0.5) return straight;
    return pool[Math.floor(rng() * pool.length)];
  }

  GS.Ghosts = { DIRS, createGhost, legalMoves, chooseDirection };
})(globalThis);

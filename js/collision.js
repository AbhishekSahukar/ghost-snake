/* Pure grid and collision queries. No state is mutated here. */
(function (root) {
  const GS = (root.GhostSnake = root.GhostSnake || {});
  const { GRID, MAP } = GS.Config;

  function inBounds(x, y) {
    return x >= 0 && y >= 0 && x < GRID && y < GRID;
  }

  /** True for the arena boundary and for interior wall blocks. */
  function isBlocked(x, y) {
    return !inBounds(x, y) || MAP[y][x] === '#';
  }

  function same(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  /**
   * Would the head hit the body if it moved to `next`?
   * When the snake is not growing, the tail cell is vacated on the same tick, so it is safe to enter.
   */
  function hitsSnakeBody(snake, next, growing) {
    const end = growing ? snake.length : snake.length - 1;
    for (let i = 0; i < end; i++) {
      if (same(snake[i], next)) return true;
    }
    return false;
  }

  /** Any snake segment, head included. */
  function onSnake(snake, x, y) {
    for (let i = 0; i < snake.length; i++) {
      if (snake[i].x === x && snake[i].y === y) return true;
    }
    return false;
  }

  function ghostAt(ghosts, x, y, ignore) {
    for (let i = 0; i < ghosts.length; i++) {
      const g = ghosts[i];
      if (g !== ignore && g.x === x && g.y === y) return g;
    }
    return null;
  }

  GS.Collision = { inBounds, isBlocked, same, hitsSnakeBody, onSnake, ghostAt };
})(globalThis);

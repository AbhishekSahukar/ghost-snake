/*
 * Game state and rules. DOM-free: it never touches the canvas, audio or storage.
 * Things the outside world cares about (sounds, popups, game over) are pushed onto state.events;
 * the main loop drains that list every frame.
 */
(function (root) {
  const GS = (root.GhostSnake = root.GhostSnake || {});
  const Cfg = GS.Config;
  const C = GS.Collision;
  const S = GS.Spawner;
  const G = GS.Ghosts;

  const RIGHT = { x: 1, y: 0 };
  const START_HEAD = { x: 5, y: 12 };

  function create(difficulty, rng) {
    rng = rng || Math.random;
    const state = {
      status: 'ready', // ready | playing | paused | over
      difficulty: Cfg.DIFFICULTIES[difficulty] ? difficulty : Cfg.DEFAULT_DIFFICULTY,
      rng: rng,
      snake: [],
      dir: RIGHT,
      queue: [],
      grow: 0,
      score: 0,
      foodEaten: 0,
      food: null,
      power: null,
      powerLeft: 0, // ms of power mode remaining; 0 = ghosts are dangerous
      ghostChain: 0,
      ghosts: [],
      snakeAcc: 0,
      ghostAcc: 0,
      deathCause: null,
      events: [],
    };
    for (let i = 0; i < Cfg.SNAKE_START_LENGTH; i++) {
      state.snake.push({ x: START_HEAD.x - i, y: START_HEAD.y });
    }
    for (let i = 0; i < Cfg.GHOST_COUNT; i++) {
      const cell = S.spawnGhostCell(state, rng, Cfg.GHOST_SPAWN_MIN_DISTANCE);
      state.ghosts.push(G.createGhost(i, cell));
    }
    state.food = S.spawnFood(state, rng);
    return state;
  }

  function isEdible(state) {
    return state.powerLeft > 0;
  }

  function snakeStepMs(state) {
    return Cfg.DIFFICULTIES[state.difficulty].stepMs;
  }

  function ghostStepMs(state) {
    return snakeStepMs(state) * (isEdible(state) ? Cfg.EDIBLE_STEP_FACTOR : Cfg.GHOST_STEP_FACTOR);
  }

  /* ---- status transitions ---- */

  function start(state) {
    if (state.status === 'ready') state.status = 'playing';
  }

  function pause(state) {
    if (state.status === 'playing') state.status = 'paused';
  }

  function resume(state) {
    if (state.status === 'paused') state.status = 'playing';
  }

  /* ---- input ---- */

  /** Queue a turn. Same-direction and 180-degree reversals (relative to the last queued turn) are ignored. */
  function queueDirection(state, dir) {
    if (state.status !== 'playing') return;
    const last = state.queue.length ? state.queue[state.queue.length - 1] : state.dir;
    if (dir.x === last.x && dir.y === last.y) return;
    if (dir.x === -last.x && dir.y === -last.y) return;
    if (state.queue.length >= Cfg.MAX_QUEUED_TURNS) return;
    state.queue.push(dir);
  }

  /* ---- simulation ---- */

  function update(state, dtMs) {
    if (state.status !== 'playing') return;
    const dt = Math.min(dtMs, Cfg.MAX_FRAME_MS);

    if (state.powerLeft > 0) {
      state.powerLeft = Math.max(0, state.powerLeft - dt);
      if (state.powerLeft === 0) {
        state.ghostChain = 0;
        state.events.push({ type: 'powerEnd' });
      }
    }

    state.snakeAcc += dt;
    const snakeStep = snakeStepMs(state);
    while (state.status === 'playing' && state.snakeAcc >= snakeStep) {
      state.snakeAcc -= snakeStep;
      stepSnake(state);
    }

    state.ghostAcc += dt;
    while (state.status === 'playing' && state.ghostAcc >= ghostStepMs(state)) {
      state.ghostAcc -= ghostStepMs(state);
      stepGhosts(state);
    }
  }

  function takeNextDirection(state) {
    while (state.queue.length) {
      const d = state.queue.shift();
      if (!(d.x === -state.dir.x && d.y === -state.dir.y)) {
        state.dir = d;
        return;
      }
    }
  }

  function stepSnake(state) {
    takeNextDirection(state);
    const head = state.snake[0];
    const next = { x: head.x + state.dir.x, y: head.y + state.dir.y };

    if (C.isBlocked(next.x, next.y)) return die(state, 'wall');
    if (C.hitsSnakeBody(state.snake, next, state.grow > 0)) return die(state, 'self');

    const ghost = C.ghostAt(state.ghosts, next.x, next.y);
    if (ghost) {
      if (!isEdible(state)) return die(state, 'ghost');
      eatGhost(state, ghost);
    }

    state.snake.unshift(next);
    if (state.grow > 0) state.grow--;
    else state.snake.pop();

    if (state.food && C.same(next, state.food)) eatFood(state);
    if (state.power && C.same(next, state.power)) eatPower(state);
  }

  function stepGhosts(state) {
    for (let i = 0; i < state.ghosts.length; i++) {
      const ghost = state.ghosts[i];
      const dir = G.chooseDirection(ghost, state, state.rng);
      if (!dir) continue;
      ghost.dir = dir;
      ghost.x += dir.x;
      ghost.y += dir.y;
      if (C.same(ghost, state.snake[0])) {
        if (isEdible(state)) eatGhost(state, ghost);
        else return die(state, 'ghost');
      }
    }
  }

  function eatFood(state) {
    state.score += Cfg.SCORE_FOOD;
    state.grow++;
    state.foodEaten++;
    state.events.push({ type: 'food' });
    state.food = S.spawnFood(state, state.rng);
    if (state.foodEaten % Cfg.POWER_PELLET_EVERY === 0 && !state.power) {
      state.power = S.spawnFood(state, state.rng);
    }
  }

  function eatPower(state) {
    state.score += Cfg.SCORE_POWER;
    state.power = null;
    state.powerLeft = Cfg.POWER_MS; // eating another one mid-power simply refreshes the timer
    state.ghostChain = 0;
    state.events.push({ type: 'power' });
  }

  function eatGhost(state, ghost) {
    const points = Cfg.SCORE_GHOST_BASE * Math.pow(2, Math.min(state.ghostChain, 3));
    state.ghostChain++;
    state.score += points;
    state.events.push({ type: 'ghost', x: ghost.x, y: ghost.y, points: points });
    // Send the ghost back to a spot away from the head so it cannot instantly catch the snake.
    const cell = S.spawnGhostCell(state, state.rng, Cfg.GHOST_SPAWN_MIN_DISTANCE);
    if (cell) {
      ghost.x = cell.x;
      ghost.y = cell.y;
    }
  }

  function die(state, cause) {
    state.status = 'over';
    state.deathCause = cause;
    state.powerLeft = 0;
    state.events.push({ type: 'die', cause: cause });
  }

  GS.Game = { create, start, pause, resume, update, queueDirection, isEdible, snakeStepMs, ghostStepMs };
})(globalThis);

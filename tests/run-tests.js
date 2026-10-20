/*
 * Logic tests for the DOM-free modules. Run with:  node tests/run-tests.js
 * The game files are plain browser scripts, so they are loaded into a vm context the same way
 * index.html loads them (globalThis acts as the browser global).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..');

function load(files, extra) {
  const ctx = vm.createContext(Object.assign({}, extra || {}));
  files.forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f });
  });
  return ctx.GhostSnake;
}

const LOGIC = ['config.js', 'collision.js', 'spawner.js', 'ghosts.js', 'game.js'];
let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok  ' + name);
  } catch (e) {
    console.error('FAIL  ' + name + '\n' + e.stack);
    process.exitCode = 1;
  }
}

// Deterministic rng (mulberry32)
function seeded(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GS = load(LOGIC);
const { Config, Game, Collision, Spawner } = GS;
const UP = { x: 0, y: -1 }, DOWN = { x: 0, y: 1 }, LEFT = { x: -1, y: 0 }, RIGHT = { x: 1, y: 0 };

function fresh(diff) {
  const s = Game.create(diff || 'medium', seeded(1));
  Game.start(s);
  return s;
}
/** Park every ghost somewhere harmless and clear the pellets so a test controls the board. */
function isolate(s) {
  s.ghosts.forEach(function (g, i) { g.x = 21; g.y = 1 + i * 2; });
  s.food = null;
  s.power = null;
}
/** Advance game time in frame-sized chunks (update() clamps any single frame to MAX_FRAME_MS). */
function advance(s, ms) {
  for (let t = 0; t < ms && s.status === 'playing'; t += 10) Game.update(s, 10);
}
/** Run exactly n snake steps (ghosts may also step; tests park them out of the way). */
function tickSnake(s, n) {
  for (let i = 0; i < (n || 1); i++) {
    s.snakeAcc = 0;
    advance(s, Game.snakeStepMs(s));
  }
}
/** Let ghosts take exactly one step while the snake is frozen in place. */
function tickGhosts(s) {
  s.snakeAcc = -1e9;
  s.ghostAcc = 0;
  advance(s, Game.ghostStepMs(s));
}

test('map is 24x24 and every open cell is reachable', function () {
  assert.strictEqual(Config.MAP.length, Config.GRID);
  Config.MAP.forEach(function (row) { assert.strictEqual(row.length, Config.GRID); });
  const seen = new Set(['0,0']);
  const stack = [[0, 0]];
  while (stack.length) {
    const [x, y] = stack.pop();
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
      const nx = x + d[0], ny = y + d[1], k = nx + ',' + ny;
      if (!Collision.isBlocked(nx, ny) && !seen.has(k)) { seen.add(k); stack.push([nx, ny]); }
    });
  }
  let open = 0;
  Config.MAP.forEach(function (r) { open += r.split('.').length - 1; });
  assert.strictEqual(seen.size, open);
});

test('initial state: snake clear of walls, 3 ghosts away from head, food on a free cell', function () {
  const s = Game.create('easy', seeded(7));
  assert.strictEqual(s.ghosts.length, 3);
  s.snake.forEach(function (c) { assert.ok(!Collision.isBlocked(c.x, c.y)); });
  s.ghosts.forEach(function (g) {
    assert.ok(!Collision.isBlocked(g.x, g.y));
    assert.ok(Math.abs(g.x - s.snake[0].x) + Math.abs(g.y - s.snake[0].y) >= Config.GHOST_SPAWN_MIN_DISTANCE);
  });
  assert.ok(!Collision.onSnake(s.snake, s.food.x, s.food.y));
});

test('wall collision ends the game', function () {
  const s = fresh();
  isolate(s);
  tickSnake(s, 30);
  assert.strictEqual(s.status, 'over');
  assert.strictEqual(s.deathCause, 'wall');
});

test('obstacle block collision ends the game', function () {
  const s = fresh();
  isolate(s);
  s.snake = [{ x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 }];
  s.dir = LEFT; // (2,3) is a wall block
  tickSnake(s);
  assert.strictEqual(s.deathCause, 'wall');
});

test('self collision ends the game; entering the vacating tail cell is safe', function () {
  const s = fresh();
  isolate(s);
  s.snake = [{ x: 6, y: 12 }, { x: 6, y: 13 }, { x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 6, y: 11 }];
  s.dir = UP; // head -> (6,11) which is the tail cell; tail moves away this tick
  tickSnake(s);
  assert.strictEqual(s.status, 'playing');
  const t = fresh();
  isolate(t);
  t.snake = [{ x: 6, y: 12 }, { x: 6, y: 13 }, { x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 6, y: 11 }, { x: 5, y: 11 }];
  t.dir = UP; // (6,11) is a body cell, not the tail
  tickSnake(t);
  assert.strictEqual(t.deathCause, 'self');
});

test('cannot reverse into yourself; turns are queued', function () {
  const s = fresh();
  isolate(s);
  Game.queueDirection(s, LEFT); // opposite of RIGHT: ignored
  assert.strictEqual(s.queue.length, 0);
  Game.queueDirection(s, UP);
  Game.queueDirection(s, LEFT); // up then left is legal
  assert.strictEqual(s.queue.length, 2);
  tickSnake(s, 2);
  assert.strictEqual(s.status, 'playing');
  assert.deepStrictEqual(s.dir, LEFT);
});

test('eating food grows the snake, scores 10 and respawns food off the snake', function () {
  const s = fresh();
  isolate(s);
  s.food = { x: 6, y: 12 };
  const len = s.snake.length;
  tickSnake(s);
  assert.strictEqual(s.score, 10);
  tickSnake(s);
  assert.strictEqual(s.snake.length, len + 1);
  assert.ok(s.food && !Collision.onSnake(s.snake, s.food.x, s.food.y));
});

test('power pellet appears after every 4th food and never overlaps snake or ghosts', function () {
  const s = fresh();
  isolate(s);
  s.foodEaten = 3;
  s.food = { x: 6, y: 12 };
  tickSnake(s);
  assert.ok(s.power, 'power pellet spawned');
  assert.ok(!Collision.onSnake(s.snake, s.power.x, s.power.y));
  assert.ok(!Collision.ghostAt(s.ghosts, s.power.x, s.power.y));
});

test('spawned pellets never land on snake, ghosts, walls or each other (many seeds)', function () {
  for (let seed = 1; seed <= 200; seed++) {
    const s = Game.create('hard', seeded(seed));
    for (let i = 0; i < 20; i++) {
      const c = Spawner.spawnFood(s, s.rng);
      assert.ok(!Collision.isBlocked(c.x, c.y));
      assert.ok(!Collision.onSnake(s.snake, c.x, c.y));
      assert.ok(!Collision.ghostAt(s.ghosts, c.x, c.y));
      assert.ok(!(s.food && s.food.x === c.x && s.food.y === c.y));
      s.power = c;
      s.food = Spawner.spawnFood(s, s.rng);
    }
  }
});

test('power pellet: edible for exactly 5000ms of game time, then ghosts are dangerous again', function () {
  const s = fresh('easy');
  isolate(s);
  s.power = { x: 6, y: 12 };
  tickSnake(s);
  assert.strictEqual(s.powerLeft, Config.POWER_MS);
  assert.ok(Game.isEdible(s));
  s.snake = [{ x: 5, y: 12 }, { x: 4, y: 12 }, { x: 3, y: 12 }];
  // Burn 4990ms in 10ms frames while keeping the snake safe from the wall.
  for (let i = 0; i < 499; i++) { s.snake = [{ x: 5, y: 12 }, { x: 4, y: 12 }, { x: 3, y: 12 }]; s.dir = RIGHT; s.snakeAcc = 0; Game.update(s, 10); }
  assert.strictEqual(s.powerLeft, 10);
  assert.ok(Game.isEdible(s));
  s.snakeAcc = 0;
  Game.update(s, 10);
  assert.strictEqual(s.powerLeft, 0);
  assert.ok(!Game.isEdible(s));
  assert.ok(s.events.some(function (e) { return e.type === 'powerEnd'; }));
});

test('pausing does not consume power time', function () {
  const s = fresh();
  isolate(s);
  s.powerLeft = 3000;
  Game.pause(s);
  Game.update(s, 100);
  Game.update(s, 100);
  assert.strictEqual(s.powerLeft, 3000);
  Game.resume(s);
  Game.update(s, 50);
  assert.strictEqual(s.powerLeft, 2950);
});

test('dangerous ghost kills the snake when the snake moves into it', function () {
  const s = fresh();
  isolate(s);
  s.ghosts[0].x = 6; s.ghosts[0].y = 12;
  tickSnake(s);
  assert.strictEqual(s.deathCause, 'ghost');
});

test('dangerous ghost kills the snake when the ghost moves onto the head', function () {
  const s = fresh();
  isolate(s);
  // Ghost boxed in so its only legal move is the head cell.
  s.ghosts[0].x = 12; s.ghosts[0].y = 3; s.ghosts[0].dir = DOWN;
  s.snake = [{ x: 12, y: 4 }, { x: 11, y: 4 }, { x: 13, y: 4 }, { x: 13, y: 3 }, { x: 11, y: 3 }];
  s.dir = DOWN;
  tickGhosts(s);
  assert.strictEqual(s.deathCause, 'ghost');
});

test('edible ghost is eaten by snake: bonus points, chain doubles, ghost respawns far away', function () {
  const s = fresh();
  isolate(s);
  s.powerLeft = 4000;
  s.ghosts[0].x = 6; s.ghosts[0].y = 12;
  s.ghosts[1].x = 7; s.ghosts[1].y = 12;
  tickSnake(s);
  assert.strictEqual(s.status, 'playing');
  assert.strictEqual(s.score, 200);
  const g0 = s.ghosts[0];
  assert.ok(Math.abs(g0.x - s.snake[0].x) + Math.abs(g0.y - s.snake[0].y) >= Config.GHOST_SPAWN_MIN_DISTANCE);
  tickSnake(s);
  assert.strictEqual(s.score, 200 + 400);
});

test('edible ghost that walks onto the head is eaten, not fatal', function () {
  const s = fresh();
  isolate(s);
  s.powerLeft = 4000;
  s.ghosts[0].x = 12; s.ghosts[0].y = 3; s.ghosts[0].dir = DOWN;
  s.snake = [{ x: 12, y: 4 }, { x: 11, y: 4 }, { x: 13, y: 4 }, { x: 13, y: 3 }, { x: 11, y: 3 }];
  s.dir = DOWN;
  tickGhosts(s);
  assert.strictEqual(s.status, 'playing');
  assert.strictEqual(s.score, 200);
});

test('ghosts never walk through walls, snake body or each other (random walk fuzz)', function () {
  const s = fresh('easy');
  isolate(s);
  s.snake = [{ x: 5, y: 12 }, { x: 4, y: 12 }, { x: 3, y: 12 }, { x: 2, y: 12 }];
  s.ghosts[0].x = 8; s.ghosts[0].y = 11;
  s.ghosts[1].x = 15; s.ghosts[1].y = 6;
  s.ghosts[2].x = 18; s.ghosts[2].y = 18;
  for (let i = 0; i < 5000; i++) {
    s.snakeAcc = 0; // freeze the snake; only ghosts move
    Game.update(s, 50);
    if (s.status !== 'playing') { s.status = 'playing'; s.ghosts.forEach(function (g, k) { g.x = 10 + k * 3; g.y = 18; }); }
    const seen = new Set();
    s.ghosts.forEach(function (g) {
      assert.ok(!Collision.isBlocked(g.x, g.y), 'ghost in wall');
      assert.ok(!Collision.onSnake(s.snake.slice(1), g.x, g.y), 'ghost in body');
      const k = g.x + ',' + g.y;
      assert.ok(!seen.has(k), 'ghosts overlap');
      seen.add(k);
    });
  }
});

test('difficulty changes snake speed', function () {
  const e = Game.create('easy', seeded(1)), m = Game.create('medium', seeded(1)), h = Game.create('hard', seeded(1));
  assert.ok(Game.snakeStepMs(e) > Game.snakeStepMs(m) && Game.snakeStepMs(m) > Game.snakeStepMs(h));
});

test('game does nothing while paused, ready or over', function () {
  const s = Game.create('medium', seeded(3));
  const before = JSON.stringify(s.snake);
  Game.update(s, 1000);
  assert.strictEqual(JSON.stringify(s.snake), before);
  Game.start(s); Game.pause(s);
  Game.update(s, 1000);
  assert.strictEqual(JSON.stringify(s.snake), before);
});

test('huge frame gaps are clamped (tab switch cannot teleport the snake)', function () {
  const s = fresh('hard');
  isolate(s);
  s.snake = [{ x: 5, y: 12 }, { x: 4, y: 12 }, { x: 3, y: 12 }];
  Game.update(s, 60000);
  assert.ok(s.snake[0].x <= 5 + Math.ceil(Config.MAX_FRAME_MS / Config.DIFFICULTIES.hard.stepMs));
});

test('best score storage: saves only improvements, survives a throwing localStorage', function () {
  const store = {};
  const ls = { getItem: function (k) { return k in store ? store[k] : null; }, setItem: function (k, v) { store[k] = v; } };
  const S = load(['config.js', 'storage.js'], { localStorage: ls }).Storage;
  assert.strictEqual(S.getBest('easy'), 0);
  assert.strictEqual(S.submit('easy', 50), 50);
  assert.strictEqual(S.submit('easy', 30), 50);
  assert.strictEqual(S.getBest('easy'), 50);
  assert.strictEqual(S.getBest('hard'), 0);
  const bad = { getItem: function () { throw new Error('blocked'); }, setItem: function () { throw new Error('blocked'); } };
  const S2 = load(['config.js', 'storage.js'], { localStorage: bad }).Storage;
  assert.strictEqual(S2.getBest('easy'), 0);
  assert.strictEqual(S2.submit('easy', 10), 10);
});

test('every file referenced by index.html exists', function () {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const refs = [];
  html.replace(/(?:src|href)="([^"]+)"/g, function (_, p) { refs.push(p); });
  assert.ok(refs.length >= 10);
  refs.forEach(function (p) {
    assert.ok(!/^(https?:)?\/\//.test(p) && !p.startsWith('/'), 'non-relative path ' + p);
    assert.ok(fs.existsSync(path.join(root, p)), 'missing ' + p);
  });
});

console.log('\n' + passed + ' tests passed' + (process.exitCode ? ' (with failures)' : ''));

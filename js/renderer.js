/* Canvas drawing. Reads game state, never changes it. */
(function (root) {
  const GS = (root.GhostSnake = root.GhostSnake || {});
  const Cfg = GS.Config;
  const Game = GS.Game;
  const { GRID, CELL, MAP } = Cfg;
  const SIZE = GRID * CELL;

  const COLORS = {
    bg: '#07051a',
    grid: 'rgba(80, 90, 255, 0.14)',
    wallFill: '#12104a',
    wallEdge: '#4a5cff',
    food: '#ffe44d',
    power: '#3dfcff',
    snake: '#39ff88',
    snakeHead: '#b6ffd3',
    snakePowered: '#ffd34d',
    scared: '#2740ff',
    scaredFlash: '#f4f6ff',
  };

  const POPUP_MS = 900;
  let popups = [];

  function create(canvas) {
    canvas.width = SIZE;
    canvas.height = SIZE;
    return canvas.getContext('2d');
  }

  function addPopup(x, y, text, now) {
    popups.push({ x: x, y: y, text: text, born: now });
  }

  function clearPopups() {
    popups = [];
  }

  /* ---- layers ---- */

  function drawBackground(ctx, powered) {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= GRID; i++) {
      const p = i * CELL + 0.5;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, SIZE);
      ctx.moveTo(0, p);
      ctx.lineTo(SIZE, p);
    }
    ctx.stroke();

    if (powered) {
      ctx.strokeStyle = 'rgba(61, 252, 255, 0.55)';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, SIZE - 4, SIZE - 4);
    }
  }

  function drawWalls(ctx) {
    ctx.fillStyle = COLORS.wallFill;
    ctx.strokeStyle = COLORS.wallEdge;
    ctx.lineWidth = 2;
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (MAP[y][x] !== '#') continue;
        ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 1, CELL - 1);
        ctx.strokeRect(x * CELL + 3, y * CELL + 3, CELL - 5, CELL - 5);
      }
    }
  }

  function glowCircle(ctx, cx, cy, r, color, blur) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPellets(ctx, state, now) {
    if (state.food) {
      glowCircle(ctx, state.food.x * CELL + CELL / 2, state.food.y * CELL + CELL / 2, 4.5, COLORS.food, 10);
    }
    if (state.power) {
      const cx = state.power.x * CELL + CELL / 2;
      const cy = state.power.y * CELL + CELL / 2;
      const pulse = 0.5 + 0.5 * Math.sin(now / 160);
      ctx.save();
      ctx.strokeStyle = COLORS.power;
      ctx.globalAlpha = 0.35 + 0.35 * pulse;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 9 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      glowCircle(ctx, cx, cy, 6.5 + pulse * 1.5, COLORS.power, 22);
      glowCircle(ctx, cx, cy, 3, '#ffffff', 0);
    }
  }

  function drawSnake(ctx, state) {
    const powered = Game.isEdible(state);
    const body = powered ? COLORS.snakePowered : COLORS.snake;
    const n = state.snake.length;

    ctx.save();
    ctx.shadowColor = body;
    ctx.shadowBlur = 8;
    for (let i = n - 1; i >= 0; i--) {
      const s = state.snake[i];
      const inset = i === 0 ? 1 : 2 + Math.min(2, i / n * 2);
      ctx.fillStyle = i === 0 ? COLORS.snakeHead : body;
      ctx.globalAlpha = i === 0 ? 1 : 1 - (i / n) * 0.35;
      roundRect(ctx, s.x * CELL + inset, s.y * CELL + inset, CELL - inset * 2, CELL - inset * 2, 5);
      ctx.fill();
    }
    ctx.restore();

    // Eyes on the head, offset toward the travel direction.
    const h = state.snake[0];
    const cx = h.x * CELL + CELL / 2;
    const cy = h.y * CELL + CELL / 2;
    const d = state.dir;
    const px = -d.y; // perpendicular, to spread the two eyes
    const py = d.x;
    ctx.fillStyle = '#05140c';
    [-1, 1].forEach(function (side) {
      ctx.beginPath();
      ctx.arc(cx + d.x * 4 + px * side * 4, cy + d.y * 4 + py * side * 4, 2.2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---- ghosts ---- */

  // Body silhouette: dome on top, straight sides, skirt along the bottom. Skirt style differs per ghost.
  function ghostPath(ctx, cx, cy, r, style, wobble) {
    const left = cx - r;
    const right = cx + r;
    const bottom = cy + r;
    ctx.beginPath();
    ctx.moveTo(left, bottom);
    ctx.lineTo(left, cy);
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.lineTo(right, bottom);
    const teeth = 4;
    const w = (r * 2) / teeth;
    for (let i = 0; i < teeth; i++) {
      const x1 = right - w * i;
      if (style === 'scallop') {
        ctx.arc(x1 - w / 2, bottom, w / 2, 0, Math.PI, wobble ? i % 2 === 0 : i % 2 === 1);
      } else {
        const up = (i % 2 === 0) !== wobble;
        ctx.lineTo(x1 - w / 2, bottom - (up ? r * 0.35 : 0));
        ctx.lineTo(x1 - w, bottom);
      }
    }
    ctx.closePath();
  }

  const GHOST_STYLES = ['zigzag', 'scallop', 'zigzag'];

  function drawGhost(ctx, ghost, state, now) {
    const cx = ghost.x * CELL + CELL / 2;
    const cy = ghost.y * CELL + CELL / 2 - 1;
    const r = CELL * 0.42;
    const wobble = Math.floor(now / 180) % 2 === 0;
    const edible = Game.isEdible(state);

    ctx.save();
    if (edible) {
      const warning = state.powerLeft <= Cfg.POWER_WARNING_MS && Math.floor(now / 140) % 2 === 0;
      ctx.shadowColor = warning ? COLORS.scaredFlash : COLORS.scared;
      ctx.shadowBlur = 10;
      ghostPath(ctx, cx, cy, r, 'zigzag', wobble);
      ctx.fillStyle = warning ? COLORS.scaredFlash : COLORS.scared;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Scared face: small dot eyes and a wavy mouth.
      const face = warning ? COLORS.scared : '#ffffff';
      ctx.fillStyle = face;
      ctx.fillRect(cx - 5, cy - 4, 3, 3);
      ctx.fillRect(cx + 2, cy - 4, 3, 3);
      ctx.strokeStyle = face;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy + 5);
      for (let i = 0; i < 4; i++) ctx.lineTo(cx - 6 + 3 * (i + 1), cy + (i % 2 === 0 ? 2 : 5));
      ctx.stroke();
    } else {
      ctx.shadowColor = ghost.color;
      ctx.shadowBlur = 12;
      ghostPath(ctx, cx, cy, r, GHOST_STYLES[ghost.id % GHOST_STYLES.length], wobble);
      ctx.fillStyle = ghost.color;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Inky gets two horns so ghosts are told apart by shape as well as colour.
      if (ghost.id === 2) {
        ctx.fillStyle = ghost.color;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.8, cy - r * 0.5);
        ctx.lineTo(cx - r * 0.5, cy - r * 1.25);
        ctx.lineTo(cx - r * 0.1, cy - r * 0.9);
        ctx.moveTo(cx + r * 0.8, cy - r * 0.5);
        ctx.lineTo(cx + r * 0.5, cy - r * 1.25);
        ctx.lineTo(cx + r * 0.1, cy - r * 0.9);
        ctx.fill();
      }

      // Eyes look where the ghost is heading; angry brows mark it as dangerous.
      const d = ghost.dir;
      [-1, 1].forEach(function (side) {
        const ex = cx + side * 4.5;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex, cy - 2, 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#10103a';
        ctx.beginPath();
        ctx.arc(ex + d.x * 1.6, cy - 2 + d.y * 1.6, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#10103a';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(ex + side * 3.5, cy - 9);
        ctx.lineTo(ex - side * 3.5, cy - 6);
        ctx.stroke();
      });
    }
    ctx.restore();
  }

  function drawPopups(ctx, now) {
    popups = popups.filter(function (p) { return now - p.born < POPUP_MS; });
    ctx.save();
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.textAlign = 'center';
    popups.forEach(function (p) {
      const t = (now - p.born) / POPUP_MS;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = COLORS.power;
      ctx.shadowBlur = 8;
      ctx.fillText(p.text, p.x * CELL + CELL / 2, p.y * CELL + CELL / 2 - t * 22);
    });
    ctx.restore();
  }

  function render(ctx, state, now) {
    drawBackground(ctx, Game.isEdible(state));
    drawWalls(ctx);
    drawPellets(ctx, state, now);
    drawSnake(ctx, state);
    state.ghosts.forEach(function (g) { drawGhost(ctx, g, state, now); });
    drawPopups(ctx, now);
  }

  GS.Renderer = { create, render, addPopup, clearPopups, SIZE };
})(globalThis);

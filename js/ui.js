/* DOM side: overlay screens, HUD, power meter and button wiring. Holds no game logic. */
(function (root) {
  const GS = (root.GhostSnake = root.GhostSnake || {});
  const Cfg = GS.Config;
  const doc = root.document;

  const $ = function (id) { return doc.getElementById(id); };
  let el = null;
  const cache = {};

  /** Write to the DOM only when the value actually changed (sync runs every frame). */
  function setText(node, key, value) {
    if (cache[key] === value) return;
    cache[key] = value;
    node.textContent = value;
  }

  function setClass(node, key, cls, on) {
    const k = key + ':' + cls;
    if (cache[k] === on) return;
    cache[k] = on;
    node.classList.toggle(cls, on);
  }

  const DEATH_TEXT = {
    wall: 'You crashed into a wall.',
    self: 'You bit your own tail.',
    ghost: 'A ghost caught you.',
  };

  /**
   * handlers: { onPrimary, onPause, onRestart, onMute, onDifficulty(key) }
   */
  function bind(handlers) {
    el = {
      overlay: $('overlay'),
      title: $('overlay-title'),
      text: $('overlay-text'),
      difficultyGroup: $('difficulty-group'),
      diffButtons: Array.prototype.slice.call(doc.querySelectorAll('.diff-btn')),
      primary: $('primary-btn'),
      overlayRestart: $('overlay-restart-btn'),
      score: $('score'),
      best: $('best'),
      bestLabel: $('best-label'),
      meter: $('power-meter'),
      powerText: $('power-text'),
      powerFill: $('power-fill'),
      pause: $('pause-btn'),
      restart: $('restart-btn'),
      mute: $('mute-btn'),
    };

    el.primary.addEventListener('click', handlers.onPrimary);
    el.overlayRestart.addEventListener('click', handlers.onRestart);
    el.pause.addEventListener('click', handlers.onPause);
    el.restart.addEventListener('click', handlers.onRestart);
    el.mute.addEventListener('click', handlers.onMute);
    el.diffButtons.forEach(function (btn) {
      btn.addEventListener('click', function () { handlers.onDifficulty(btn.dataset.difficulty); });
    });
  }

  function renderOverlay(view) {
    const state = view.state;
    const over = state.status === 'over';
    const showDifficulty = state.status === 'ready' || over;

    setClass(el.overlay, 'overlay', 'is-over', over);
    if (state.status === 'playing') {
      if (!cache.overlayHidden) { el.overlay.hidden = true; cache.overlayHidden = true; }
      return;
    }
    if (cache.overlayHidden !== false) { el.overlay.hidden = false; cache.overlayHidden = false; }

    if (state.status === 'ready') {
      setText(el.title, 'title', 'GHOST SNAKE');
      setText(el.text, 'text', 'Choose a difficulty, then press Start.\nGrab the glowing power pellet to hunt the ghosts!');
      setText(el.primary, 'primary', 'START');
    } else if (state.status === 'paused') {
      setText(el.title, 'title', 'PAUSED');
      setText(el.text, 'text', 'Press Space, Enter or P to resume.');
      setText(el.primary, 'primary', 'RESUME');
    } else {
      setText(el.title, 'title', 'GAME OVER');
      const lines = [DEATH_TEXT[state.deathCause] || 'Game over.', 'Score: ' + state.score + '   Best: ' + view.best];
      if (view.newBest) lines.push('NEW BEST SCORE!');
      lines.push('Pick a difficulty to play again.');
      setText(el.text, 'text', lines.join('\n'));
      setText(el.primary, 'primary', 'PLAY AGAIN');
    }

    el.difficultyGroup.hidden = !showDifficulty;
    el.overlayRestart.hidden = state.status !== 'paused';
    el.diffButtons.forEach(function (btn) {
      const on = btn.dataset.difficulty === view.difficulty;
      if (btn.getAttribute('aria-checked') !== String(on)) btn.setAttribute('aria-checked', String(on));
    });
  }

  function renderPower(state) {
    const left = state.powerLeft;
    const active = left > 0;
    setClass(el.meter, 'meter', 'active', active);
    setClass(el.meter, 'meter', 'warning', active && left <= Cfg.POWER_WARNING_MS);
    setText(el.powerText, 'powerText', active ? (left / 1000).toFixed(1) + 's' : state.power ? 'PELLET ON BOARD!' : 'EAT FOOD...');
    const pct = active ? Math.round((left / Cfg.POWER_MS) * 100) : 0;
    if (cache.fill !== pct) { cache.fill = pct; el.powerFill.style.width = pct + '%'; }
  }

  /** view: { state, best, newBest, difficulty, muted } */
  function sync(view) {
    const state = view.state;
    setText(el.score, 'score', String(state.score));
    setText(el.best, 'best', String(state.status === 'over' ? view.best : Math.max(view.best, state.score)));
    setText(el.bestLabel, 'bestLabel', '(' + Cfg.DIFFICULTIES[view.difficulty].label + ')');
    setText(el.pause, 'pauseLabel', state.status === 'paused' ? 'RESUME' : 'PAUSE');
    el.pause.disabled = state.status !== 'playing' && state.status !== 'paused';
    setText(el.mute, 'mute', view.muted ? 'SOUND: OFF' : 'SOUND: ON');
    el.mute.setAttribute('aria-pressed', String(view.muted));
    renderPower(state);
    renderOverlay(view);
  }

  GS.UI = { bind, sync };
})(globalThis);

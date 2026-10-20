/* Wires everything together and owns the single animation loop. */
(function (root) {
  const GS = (root.GhostSnake = root.GhostSnake || {});
  const Cfg = GS.Config;
  const Game = GS.Game;

  let state = null;
  let selected = Cfg.DEFAULT_DIFFICULTY;
  let newBest = false;
  let best = 0;
  let ctx = null;
  let lastTime = 0;
  let rafId = null;

  function newGame() {
    state = Game.create(selected);
    newBest = false;
    best = GS.Storage.getBest(selected);
    GS.Renderer.clearPopups();
  }

  /* ---- intents (from keyboard and buttons) ---- */

  function primary() {
    GS.Audio.unlock();
    if (state.status === 'ready') Game.start(state);
    else if (state.status === 'paused') Game.resume(state);
    else if (state.status === 'over') { newGame(); Game.start(state); }
    else if (state.status === 'playing') Game.pause(state);
  }

  function togglePause() {
    if (state.status === 'playing') Game.pause(state);
    else if (state.status === 'paused') Game.resume(state);
  }

  function restart() {
    GS.Audio.unlock();
    newGame(); // back to the ready screen so the difficulty can be changed
  }

  function selectDifficulty(key) {
    if (!Cfg.DIFFICULTIES[key]) return;
    if (state.status !== 'ready' && state.status !== 'over') return;
    selected = key;
    best = GS.Storage.getBest(selected);
    if (state.status === 'ready') newGame(); // rebuild so the ready board matches the choice
    // When over, the choice is applied by the next primary() -> newGame().
  }

  function toggleMute() {
    GS.Audio.unlock();
    GS.Audio.setMuted(!GS.Audio.isMuted());
  }

  /* ---- events emitted by the game ---- */

  function drainEvents(now) {
    const events = state.events.splice(0);
    events.forEach(function (e) {
      if (e.type === 'food') GS.Audio.play('food');
      else if (e.type === 'power') GS.Audio.play('power');
      else if (e.type === 'ghost') {
        GS.Audio.play('ghost');
        GS.Renderer.addPopup(e.x, e.y, '+' + e.points, now);
      } else if (e.type === 'die') {
        GS.Audio.play('die');
        const prev = GS.Storage.getBest(state.difficulty);
        newBest = state.score > prev;
        best = GS.Storage.submit(state.difficulty, state.score);
      }
    });
  }

  /* ---- loop: one rAF chain for the whole page lifetime; pausing just stops updating ---- */

  function frame(now) {
    const dt = now - lastTime;
    lastTime = now;
    Game.update(state, dt);
    drainEvents(now);
    GS.Renderer.render(ctx, state, now);
    GS.UI.sync({ state: state, best: best, newBest: newBest, difficulty: selected, muted: GS.Audio.isMuted() });
    rafId = root.requestAnimationFrame(frame);
  }

  function init() {
    ctx = GS.Renderer.create(root.document.getElementById('game'));
    newGame();

    GS.UI.bind({
      onPrimary: primary,
      onPause: togglePause,
      onRestart: restart,
      onMute: toggleMute,
      onDifficulty: selectDifficulty,
    });

    GS.Input.attach({
      onAnyKey: GS.Audio.unlock,
      onDirection: function (dir) { Game.queueDirection(state, dir); },
      onPrimary: primary,
      onPause: togglePause,
      onRestart: restart,
      onMute: toggleMute,
    });

    root.document.addEventListener('pointerdown', GS.Audio.unlock);
    root.document.addEventListener('visibilitychange', function () {
      if (root.document.hidden) Game.pause(state);
    });

    GS.App = { getState: function () { return state; } };

    if (rafId === null) {
      lastTime = root.performance.now();
      rafId = root.requestAnimationFrame(frame);
    }
  }

  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', init);
  else init();
})(globalThis);

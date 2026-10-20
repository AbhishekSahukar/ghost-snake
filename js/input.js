/* Keyboard handling. Translates keys into intents and hands them to callbacks; knows nothing about game state. */
(function (root) {
  const GS = (root.GhostSnake = root.GhostSnake || {});

  const DIRECTION_KEYS = {
    ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 }, W: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 }, S: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, A: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 }, D: { x: 1, y: 0 },
  };

  /**
   * handlers: { onDirection(dir), onPrimary(), onPause(), onRestart(), onMute(), onAnyKey() }
   * onPrimary = Enter/Space (start, resume, play again).
   */
  function attach(handlers) {
    root.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (handlers.onAnyKey) handlers.onAnyKey();

      const dir = DIRECTION_KEYS[e.key];
      if (dir) {
        e.preventDefault(); // stop arrow keys scrolling the page
        handlers.onDirection(dir);
        return;
      }

      // Enter/Space on a focused action button should still activate that button. The difficulty
      // buttons are just a selector, so after picking one Enter/Space should start the game.
      const t = e.target;
      const onButton = t && t.tagName === 'BUTTON' && !t.classList.contains('diff-btn');
      switch (e.key) {
        case ' ':
          if (!onButton) { e.preventDefault(); handlers.onPrimary(); }
          break;
        case 'Enter':
          if (!onButton) { e.preventDefault(); handlers.onPrimary(); }
          break;
        case 'p':
        case 'P':
        case 'Escape':
          handlers.onPause();
          break;
        case 'r':
        case 'R':
          handlers.onRestart();
          break;
        case 'm':
        case 'M':
          handlers.onMute();
          break;
      }
    });
  }

  GS.Input = { attach };
})(globalThis);

/* Best-score persistence. localStorage can throw (private mode, blocked cookies), so every call is guarded. */
(function (root) {
  const GS = (root.GhostSnake = root.GhostSnake || {});
  const PREFIX = GS.Config.STORAGE_PREFIX;

  function getBest(difficulty) {
    try {
      const value = parseInt(root.localStorage.getItem(PREFIX + difficulty), 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (e) {
      return 0;
    }
  }

  /** Stores the score if it beats the saved best. Returns the best score after the call. */
  function submit(difficulty, score) {
    const best = getBest(difficulty);
    if (score <= best) return best;
    try {
      root.localStorage.setItem(PREFIX + difficulty, String(score));
    } catch (e) {
      /* storage unavailable: best score just won't persist */
    }
    return score;
  }

  GS.Storage = { getBest, submit };
})(globalThis);

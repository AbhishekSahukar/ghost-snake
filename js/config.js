/* Shared constants. Every other module reads its tunables from here. */
(function (root) {
  const GS = (root.GhostSnake = root.GhostSnake || {});

  // '#' = wall block, '.' = open floor. 24 x 24, symmetric, row 12 left side stays clear for the snake start.
  const MAP = [
    '........................',
    '........................',
    '..####............####..',
    '..#..................#..',
    '..#..................#..',
    '........................',
    '........................',
    '.......##......##.......',
    '.......#........#.......',
    '........................',
    '..........####..........',
    '........................',
    '........................',
    '........................',
    '..........####..........',
    '........................',
    '.......#........#.......',
    '.......##......##.......',
    '........................',
    '..#..................#..',
    '..#..................#..',
    '..####............####..',
    '........................',
    '........................',
  ];

  GS.Config = {
    GRID: 24,
    CELL: 24,
    MAP: MAP,

    DIFFICULTIES: {
      easy: { label: 'Easy', stepMs: 170 },
      medium: { label: 'Medium', stepMs: 125 },
      hard: { label: 'Hard', stepMs: 85 },
    },
    DEFAULT_DIFFICULTY: 'medium',

    GHOST_COUNT: 3,
    GHOST_STEP_FACTOR: 1.8, // ghost step time = snake step time * factor
    EDIBLE_STEP_FACTOR: 2.6, // frightened ghosts are slower
    GHOST_SPAWN_MIN_DISTANCE: 7, // Manhattan distance from the snake head

    POWER_MS: 5000,
    POWER_WARNING_MS: 1500, // edible ghosts blink during this final window
    POWER_PELLET_EVERY: 4, // a power pellet appears after every Nth food eaten
    MAX_FRAME_MS: 100, // clamp huge frame gaps (tab switch) so nothing teleports

    SNAKE_START_LENGTH: 3,
    SCORE_FOOD: 10,
    SCORE_POWER: 50,
    SCORE_GHOST_BASE: 200, // doubles for every ghost eaten in one power window
    MAX_QUEUED_TURNS: 2,

    STORAGE_PREFIX: 'ghostSnake.best.',
  };
})(globalThis);

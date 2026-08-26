/**
 * LEVEL 0 — THE LOBBY
 *
 * The map is just text. Edit the grid below and reload — that's the whole
 * level editor. Every character is one 4m x 4m cell.
 *
 *   #  wall
 *   .  floor
 *   S  player spawn
 *   L  floor with a ceiling light above it
 *   1  switch 1        (press in the order given by `sequence`)
 *   2  switch 2
 *   3  switch 3
 *   b  battery pickup
 *   X  exit door
 *   (space)  void — nothing rendered at all
 *
 * Rules: every row must be the same length, and the map must be sealed by
 * walls or you'll walk off the edge into nothing.
 */

export default {
  name: 'Level 0 — The Lobby',

  cellSize: 4,
  wallHeight: 3.2,

  /** The order the switches must be pressed in. Wrong order = full reset. */
  sequence: [2, 3, 1],

  /** Scenery. Keys must exist in MODELS in src/config/manifest.js. */
  props: [
    // { model: 'chair', cell: [6, 12], rotation: 0.4 }
  ],

  grid: [
    '############################',
    '#S...L....#.......#....L...#',
    '#.........#...b...#........#',
    '#..####...#...#####........#',
    '#..#..#...........#....##..#',
    '#.....#..L#####...#....##..#',
    '#..#..#...#...#...L.....2..#',
    '#..####...#...#............#',
    '#.........#...#.....########',
    '#####..####...#####........#',
    '#...#..#..........#..L.....#',
    '#.1.#..#..#####...#....b...#',
    '#...#..#..#...#...#........#',
    '#...L..#..#.3.#............#',
    '#......#......#....#####...#',
    '#..b...#..#####....#...#...#',
    '#......#...........X...#...#',
    '#......#....L......#####...#',
    '#..........................#',
    '############################'
  ]
};

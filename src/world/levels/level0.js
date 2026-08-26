/**
 * LEVEL 0 — THE LOBBY
 *
 * The map is text. Edit the grid, save, reload. That's the level editor.
 * Each character is one 4m x 4m cell.
 *
 *   #  wall            .  floor          S  player spawn
 *   L  ceiling light   H  hiding crack   M  monster spawn
 *   1 2 3  switches    X  exit door      (space) void
 *
 * Rules: every row the same length, map sealed by walls, and put H cracks
 * where a panicking player could plausibly reach one.
 */
export default {
  name: 'Level 0 — The Lobby',
  cellSize: 4,
  wallHeight: 3.2,
  sequence: [2, 3, 1],

  wallTexture: 'wall',
  floorTexture: 'carpet',
  ceilingTexture: 'ceiling',

  props: [
    { model: 'chair', cell: [12, 2], rotation: 0.4 },
    { model: 'desk',  cell: [13, 2], rotation: 0 },
    { model: 'boxes', cell: [21, 10], rotation: 1.1 },
    { model: 'sofa',  cell: [3, 18], rotation: 0 }
  ],

  grid: [
    '############################',
    '#S...L....#.......#....L...#',
    '#.........#...H...#........#',
    '#..####...#...#####........#',
    '#..#..#...........#....##..#',
    '#.....#..L#####...#....##..#',
    '#..#..#...#...#...L.....2..#',
    '#..####...#...#............#',
    '#.........#...#.....########',
    '#####..####...#####........#',
    '#...#..#..........#..L.....#',
    '#.1.#..#..#####...#....H...#',
    '#...#..#..#...#...#........#',
    '#...L..#..#.3.#.....M......#',
    '#......#......#....#####...#',
    '#..H...#..#####....#...#...#',
    '#......#...........X...#...#',
    '#......#....L......#####...#',
    '#..........................#',
    '############################'
  ]
};

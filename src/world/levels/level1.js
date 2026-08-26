/**
 * LEVEL 1 — HABITAT
 *
 * Bigger, darker, more open than the Lobby. Concrete instead of wallpaper.
 * Four switches now, and the cracks are further apart -- you have to commit
 * to a direction when it starts chasing.
 */
export default {
  name: 'Level 1 — Habitat',
  cellSize: 4,
  wallHeight: 4.0,
  sequence: [3, 1, 2],

  wallTexture: 'concrete',
  floorTexture: 'concrete',
  ceilingTexture: 'concrete',

  props: [
    { model: 'barrel',    cell: [5, 4],   rotation: 0 },
    { model: 'crate',     cell: [6, 4],   rotation: 0.7 },
    { model: 'generator', cell: [22, 14], rotation: 1.57 },
    { model: 'pipe',      cell: [14, 8],  rotation: 0 },
    { model: 'trolley',   cell: [9, 16],  rotation: 2.1 }
  ],

  grid: [
    '##############################',
    '#S......#..........#.........#',
    '#.......#....L.....#....H....#',
    '#..L....#..........#.........#',
    '#.......#####..#####.........#',
    '#............................#',
    '##.##..#####...####....#######',
    '#...#..#...#...#..#..........#',
    '#.H.#..#...#...#..#....L.....#',
    '#...#..#.1.#...#..#..........#',
    '#####..##.##...#..#####..#####',
    '#..............#..#..........#',
    '#....L.........#..#....2.....#',
    '#..............#..#..........#',
    '#####..#########..#####..#####',
    '#....#....................#..#',
    '#..H......L....M..........#..#',
    '#....#....................#..#',
    '#....########..#####......#..#',
    '#...........#..#...#..L......#',
    '#....3......#....X.#.........#',
    '#...........#..#####.........#',
    '##############################'

  ]
};

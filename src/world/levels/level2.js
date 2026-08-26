/**
 * LEVEL 2 — THE HUB
 *
 * Tight tunnels. Sightlines are short, so you hear it long before you see it.
 * Only three cracks in the whole level -- learn where they are on the way in.
 */
export default {
  name: 'Level 2 — The Hub',
  cellSize: 4,
  wallHeight: 2.8,
  sequence: [1, 3, 2],

  wallTexture: 'tile',
  floorTexture: 'concrete',
  ceilingTexture: 'tile',

  props: [
    { model: 'pipe',    cell: [4, 3],   rotation: 0 },
    { model: 'vent',    cell: [16, 6],  rotation: 0 },
    { model: 'cabinet', cell: [20, 12], rotation: 3.14 },
    { model: 'lamp',    cell: [8, 14],  rotation: 0 }
  ],

  grid: [
    '##########################',
    '#S...#........#..........#',
    '#....#...L....#....H.....#',
    '#....#........#..........#',
    '#..###...######....#######',
    '#....#...#....#..........#',
    '#....#...#....#....L.....#',
    '#..H.#...#....#..........#',
    '####.#...#..###....#..####',
    '#........#....#....#.....#',
    '#....L...#.1..#....#..2..#',
    '#........#....#....#.....#',
    '#..###.###....######.....#',
    '#..#.....#....#..........#',
    '#..#..M..#....#....L.....#',
    '#..#.....#....#..........#',
    '#..#..####....####....####',
    '#..#....................H#',
    '#..######..####..#########',
    '#........#..#.X.#........#',
    '#...3....#..#####........#',
    '#........#...............#',
    '##########################'

  ]
};

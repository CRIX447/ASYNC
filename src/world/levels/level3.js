/**
 * LEVEL 3 — THE OFFICES
 *
 * Brightest level in the game, and the least comfortable for it. Overhead
 * fluorescents everywhere means almost nowhere to hide from sight, and the
 * cubicle grid gives the monster long clear sightlines down every aisle.
 * Sanity barely drains here. Staying alive is the problem.
 */
export default {
  name: 'Level 3 — The Offices',
  cellSize: 4,
  wallHeight: 3.0,
  sequence: [1, 2, 3],

  wallTexture: 'tile',
  floorTexture: 'carpet',
  ceilingTexture: 'ceiling',

  lighting: {
    fogColor: 0x1a1a16,
    fogDensity: 0.014,
    skyColor: 0x101010,

    ambientColor: 0x8a8878,
    ambientIntensity: 1.5,

    lightColor: 0xf2f4ff,     // cold office white, not the Lobby's amber
    lightIntensity: 14,
    lightRange: 20,
    panelIntensity: 3.6,

    flicker: true,
    flickerStrength: 0.25
  },

  props: [
    { model: 'desk',        cell: [4, 3],   rotation: 0 },
    { model: 'computer',    cell: [4, 4],   rotation: 0 },
    { model: 'filecabinet', cell: [21, 5],  rotation: 1.57 },
    { model: 'chair',       cell: [9, 12],  rotation: 2.2 },
    { model: 'desk',        cell: [16, 16], rotation: 1.57 }
  ],

  grid: [
    '##############################',
    '#S...L....#..L....#....L.....#',
    '#.........#.......#..........#',
    '#..#####..#..###..#..#####...#',
    '#..#...#..L..#H#..L..#...#.L.#',
    '#....1.#.....#.#.....#...#...#',
    '#..#...#..#..#.#..#..#####...#',
    '#..#####..#..#.#..#......L...#',
    '#.....L...#..#.#..#..........#',
    '#####..####..#.#..####..######',
    '#....L.......#.#.......L.....#',
    '#....#####...#.#...#####.....#',
    '#....#...#...L.L......H#..L..#',
    '#..L...2.#.........#...#.....#',
    '#....#...#..#####..#####.....#',
    '#....#####..#...#....L.......#',
    '#......L......M.#..#####..L..#',
    '#####..######...#..#...#.....#',
    '#....L.....L#####....X.#.....#',
    '#..H.....L.........#####..L..#',
    '#....#####..L..#####.....L...#',
    '#......3.#.....#...#.........#',
    '#....#...#..L..#...#....L....#',
    '##############################'

  ]
};

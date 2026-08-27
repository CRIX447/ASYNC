/**
 * LEVEL 4 — THE HOTEL
 *
 * Warm, carpeted, and far too quiet. Long corridors of identical doors, so
 * you lose track of which way you came almost immediately. Lights are sparse
 * and heavily flickering: the darkest stretch of the run before the Suburbs.
 */
export default {
  name: 'Level 4 — The Hotel',
  cellSize: 4,
  wallHeight: 3.4,
  sequence: [3, 2, 1],

  wallTexture: 'wall',
  floorTexture: 'carpet',
  ceilingTexture: 'ceiling',

  lighting: {
    fogColor: 0x0f0a06,
    fogDensity: 0.042,
    skyColor: 0x080604,

    ambientColor: 0x2a1f10,
    ambientIntensity: 0.5,

    lightColor: 0xffc98a,     // dim tungsten sconces
    lightIntensity: 8,
    lightRange: 13,
    panelIntensity: 2.0,

    flicker: true,
    flickerStrength: 1.0      // full sickly stutter
  },

  props: [
    { model: 'lamp',    cell: [3, 5],   rotation: 0 },
    { model: 'sofa',    cell: [14, 2],  rotation: 3.14 },
    { model: 'trolley', cell: [8, 14],  rotation: 1.57 },
    { model: 'cabinet', cell: [22, 18], rotation: 0 },
    { model: 'lamp',    cell: [19, 11], rotation: 0 }
  ],

  grid: [
    '############################',
    '#S....#....L....#....#..L..#',
    '#.....#.........#....#.....#',
    '#..L..#..#####.....H.#.....#',
    '#.....#..#...#..#....#..#..#',
    '#.#####....1.#..######..#..#',
    '#........#...#.........L#..#',
    '#..####..#####..#####...#..#',
    '#..#..#.........#...#...#..#',
    '#..#..#..L####....M.#......#',
    '#..#..#...#..#..#...#..###.#',
    '#..#..#...#..#..#####..#L#.#',
    '#..####...#..#.........#.#.#',
    '#.........#..#..#####..#.#.#',
    '#..#####..#..#..#...#..#.#.#',
    '#..#...#..####....2.#....#.#',
    '#....H.#........#...#....#.#',
    '#..#...#..####..#####..L.#.#',
    '#..#####..#..#.............#',
    '#......L..#..#..#####..H...#',
    '#..####...####..#...#..#####',
    '#..#..#...........X.#......#',
    '#..#..#..L...L..#####...3..#',
    '############################'

  ]
};

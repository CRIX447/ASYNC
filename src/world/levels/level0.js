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
 * This is the first level anyone sees, so it's the brightest: thin fog, warm
 * ambient, lights roughly every third room and only a mild flicker. It should
 * feel stale and endless rather than dark.
 */
export default {
  name: 'Level 0 — The Lobby',
  cellSize: 4,
  wallHeight: 3.2,
  sequence: [2, 3, 1],

  wallTexture: 'wall',
  floorTexture: 'carpet',
  ceilingTexture: 'ceiling',

  lighting: {
    fogColor: 0x141005,
    fogDensity: 0.018,        // was 0.036 — you can now see down a corridor
    skyColor: 0x0d0b06,

    ambientColor: 0x6b5a30,
    ambientIntensity: 1.15,   // was 0.55

    lightColor: 0xfff0c4,
    lightIntensity: 13,
    lightRange: 22,
    panelIntensity: 3.2,

    flicker: true,
    flickerStrength: 0.45     // present, but not a strobe
  },

  props: [
    { model: 'chair', cell: [12, 2], rotation: 0.4 },
    { model: 'desk',  cell: [13, 2], rotation: 0 },
    { model: 'boxes', cell: [21, 10], rotation: 1.1 },
    { model: 'sofa',  cell: [3, 18], rotation: 0 }
  ],

  grid: [
    '############################',
    '#S..L....L#...L...#..L.L...#',
    '#.........#...H...#........#',
    '#..####..L#...#####...L....#',
    '#..#..#...........#....##..#',
    '#...L.#..L#####..L#..L.##..#',
    '#..#..#..L#.L.#...L.....2..#',
    '#..####...#...#.....L......#',
    '#....L....#.L.#..L..########',
    '#####..####...#####...L....#',
    '#..L#..#....L.....#..L.....#',
    '#.1.#.L#..#####..L#....H...#',
    '#...#..#..#.L.#...#...L....#',
    '#..L#..#..#.3.#..L..M......#',
    '#......#...L..#....#####...#',
    '#..H..L#..#####..L.#...#.L.#',
    '#......#....L......X..L#...#',
    '#..L...#..L.L...L..#####...#',
    '#....L.......L.......L.....#',
    '############################'
  ]
};

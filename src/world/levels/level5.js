/**
 * LEVEL 5 — THE ENDLESS SUBURBS
 *
 * Outdoors, at a night that never ends. No ceiling — the sky is a flat dead
 * grey-blue with no stars and no moon, and it goes up forever.
 *
 * This is the one level built differently: `ceiling: false` removes the roof,
 * the walls are house blocks rather than corridors, and the lights are
 * streetlamps, so `flicker` is off — steady sodium light pooling on empty road
 * is far more unsettling here than a stutter would be.
 *
 * Sightlines are enormous, so the monster spots you from a long way off, but
 * there's real distance to run and hedgerow gaps to break line of sight.
 */
export default {
  name: 'Level 5 — The Endless Suburbs',
  cellSize: 5,              // wider streets than indoor levels
  wallHeight: 5.5,          // two-storey houses
  sequence: [2, 1, 3],

  ceiling: false,           // <- the whole trick

  wallTexture: 'concrete',
  floorTexture: 'concrete',
  ceilingTexture: 'concrete',

  lighting: {
    fogColor: 0x1a1f2b,
    fogDensity: 0.020,
    skyColor: 0x232a38,     // overcast, lit from nowhere

    ambientColor: 0x3d4657, // cold blue moonless wash
    ambientIntensity: 0.85,

    lightColor: 0xffb552,   // sodium streetlamps
    lightIntensity: 16,
    lightRange: 26,
    panelIntensity: 4.0,
    panelSize: [0.5, 0.5, 1.4],

    flicker: false,         // streetlamps hold steady
    flickerStrength: 0
  },

  props: [
    { model: 'lamp',    cell: [6, 6],   rotation: 0 },
    { model: 'barrel',  cell: [17, 9],  rotation: 0.6 },
    { model: 'crate',   cell: [24, 14], rotation: 1.2 },
    { model: 'trolley', cell: [11, 18], rotation: 2.4 },
    { model: 'boxes',   cell: [20, 21], rotation: 0 }
  ],

  grid: [
    '##############################',
    '#S...L.........L..........L..#',
    '#..####..####..####..####....#',
    '#..#..#..#..#...H.#..#..#....#',
    '#..####..####..####..####....#',
    '#............................#',
    '#..L......L.......L.......L..#',
    '#..####..####..####..####....#',
    '#..#..#..#..#..#..#..#..#..2.#',
    '#..####..####..####..####....#',
    '#............................#',
    '#..L......L.......L.......L..#',
    '#..####..####..####..####....#',
    '#....1#..#..#..#..#...H.#....#',
    '#..####..####..####..####....#',
    '#..............M.............#',
    '#..L......L.......L.......L..#',
    '#..####..####..####..####....#',
    '#..#..#..#..#..#..#..#..#....#',
    '#..####..####..####..####....#',
    '#............................#',
    '#..L......L....X..L.......L..#',
    '#..####..####..####..####..H.#',
    '#..#..#....3#..#..#..#..#....#',
    '#..####..####..####..####....#',
    '#............................#',
    '##############################'

  ]
};

import level0 from './level0.js';
import level1 from './level1.js';
import level2 from './level2.js';
import level3 from './level3.js';
import level4 from './level4.js';
import level5 from './level5.js';

/**
 * Level order. Finishing one loads the next; finishing the last ends the run.
 * Add a level by importing it and appending here — nothing else to wire up.
 *
 * Pacing is deliberate: bright and open, then tighter and darker, then the
 * Offices blow the lights back up, the Hotel takes them away again, and the
 * Suburbs open out into somewhere with no ceiling at all.
 */
export const LEVELS = [level0, level1, level2, level3, level4, level5];

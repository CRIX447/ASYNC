import level0 from './level0.js';
import level1 from './level1.js';
import level2 from './level2.js';

/**
 * Level order. Finishing one loads the next; finishing the last ends the run.
 * Add new levels by importing them and appending here.
 */
export const LEVELS = [level0, level1, level2];

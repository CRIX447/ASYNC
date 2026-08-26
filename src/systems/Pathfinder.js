/**
 * Breadth-first search over the level grid.
 *
 * BFS rather than A* on purpose: the maps are small (a few hundred cells), it
 * returns a guaranteed-shortest path, and there's no heuristic to get wrong.
 * A* would matter at 10,000 cells. It doesn't here.
 */
export function findPath(grid, width, height, start, goal, isSolid) {
  const sk = start[0] + ',' + start[1];
  const gk = goal[0] + ',' + goal[1];
  if (sk === gk) return [];

  const prev = new Map([[sk, null]]);
  const queue = [start];
  let head = 0;

  while (head < queue.length) {
    const [c, r] = queue[head++];

    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= width || nr >= height) continue;
      if (isSolid(nc, nr)) continue;

      const k = nc + ',' + nr;
      if (prev.has(k)) continue;

      prev.set(k, [c, r]);

      if (k === gk) {
        // Walk the chain back to the start.
        const path = [];
        let cur = [nc, nr];
        while (cur) {
          path.push(cur);
          cur = prev.get(cur[0] + ',' + cur[1]);
        }
        path.reverse();
        return path.slice(1); // drop the cell we're already standing in
      }

      queue.push([nc, nr]);
    }
  }

  return []; // unreachable
}

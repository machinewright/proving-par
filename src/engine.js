// Beamwright engine: grid model + beam tracing. Pure, no DOM.
// Directions: 0=up, 1=right, 2=down, 3=left.
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];

// Cell types
export const EMPTY = 'empty';
export const WALL = 'wall';
export const EMITTER = 'emitter'; // { dir, color? }
export const MIRROR = 'mirror';   // { rot: 0 = '/', 1 = '\\' }, rotatable unless fixed
export const TARGET = 'target';   // { color? }: lit only by a beam of the same color
// Colors are small integers; 0 is the default (and only) color in single-color levels.
export const colorOf = (c) => c.color ?? 0;
export const FILTER = 'filter';     // { color }: its own color passes straight through, others are absorbed
export const SPLITTER = 'splitter'; // { rot }: half-silvered — passes straight AND reflects

// Reflection tables: '/' maps up->right, right->up, down->left, left->down.
const SLASH = [1, 0, 3, 2];
// '\\' maps up->left, left->up, down->right, right->down.
const BACK = [3, 2, 1, 0];

export function reflect(rot, dir) {
  return rot === 0 ? SLASH[dir] : BACK[dir];
}

export function makeGrid(w, h) {
  const cells = [];
  for (let i = 0; i < w * h; i++) cells.push({ type: EMPTY });
  return { w, h, cells };
}

export function cloneGrid(g) {
  return { w: g.w, h: g.h, cells: g.cells.map((c) => ({ ...c })) };
}

export const at = (g, x, y) => g.cells[y * g.w + x];
export const inBounds = (g, x, y) => x >= 0 && y >= 0 && x < g.w && y < g.h;

// Trace all beams. Returns { segments: [{x1,y1,x2,y2,color}], lit: Set<index> } where
// coordinates are cell centers, and lit holds indices of lit target cells. Beams of different
// colors pass through each other; a target absorbs any beam but only lights for its own color.
export function trace(g) {
  const segments = [];
  const lit = new Set();
  const seen = new Set(); // (cell*4+dir)*8+color, prevents infinite loops
  const queue = [];
  g.cells.forEach((c, i) => {
    if (c.type === EMITTER) queue.push([i % g.w, Math.floor(i / g.w), c.dir, colorOf(c)]);
  });
  while (queue.length) {
    let [x, y, dir, color] = queue.pop();
    const seg = (x1, y1, x2, y2) => segments.push({ x1, y1, x2, y2, color });
    const sx = x, sy = y;
    for (;;) {
      const nx = x + DX[dir], ny = y + DY[dir];
      if (!inBounds(g, nx, ny)) {
        // run to the edge of the board
        seg(sx, sy, x + DX[dir] * 0.5, y + DY[dir] * 0.5);
        break;
      }
      const key = ((ny * g.w + nx) * 4 + dir) * 8 + color;
      if (seen.has(key)) {
        seg(sx, sy, nx, ny);
        break;
      }
      seen.add(key);
      x = nx; y = ny;
      const c = at(g, x, y);
      if (c.type === WALL || c.type === EMITTER) {
        seg(sx, sy, x - DX[dir] * 0.5, y - DY[dir] * 0.5);
        break;
      }
      if (c.type === FILTER && colorOf(c) !== color) {
        seg(sx, sy, x, y);
        break; // wrong color: absorbed in the filter
      }
      if (c.type === TARGET) {
        if (colorOf(c) === color) lit.add(y * g.w + x);
        seg(sx, sy, x, y);
        break; // targets absorb light
      }
      if (c.type === MIRROR) {
        seg(sx, sy, x, y);
        queue.push([x, y, reflect(c.rot, dir), color]);
        break;
      }
      if (c.type === SPLITTER) {
        seg(sx, sy, x, y);
        queue.push([x, y, reflect(c.rot, dir), color]);
        queue.push([x, y, dir, color]);
        break;
      }
    }
  }
  return { segments, lit };
}

export function targets(g) {
  const out = [];
  g.cells.forEach((c, i) => c.type === TARGET && out.push(i));
  return out;
}

export function isSolved(g) {
  const { lit } = trace(g);
  return targets(g).every((i) => lit.has(i));
}

// Rotate a rotatable piece in place. Returns true if something changed.
export function rotate(g, x, y) {
  const c = at(g, x, y);
  if ((c.type === MIRROR || c.type === SPLITTER) && !c.fixed) {
    c.rot ^= 1;
    return true;
  }
  return false;
}

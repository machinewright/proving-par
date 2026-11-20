// Optimistic ("ghost") beam tracing for the essay's widgets.
// decided[i]: -1 = undecided (the piece sends light both ways), otherwise the piece's rot.
// Pieces that aren't rotatable ignore `decided`. Every segment downstream of an undecided piece is
// marked ghost: it shows where light *might* go, not where it does.
import { at, inBounds, reflect, colorOf, DX, DY, WALL, EMITTER, FILTER, TARGET, MIRROR, SPLITTER } from './engine.js';

export const UNDECIDED = -1;
const rotatable = (c) => (c.type === MIRROR || c.type === SPLITTER) && !c.fixed;

export function traceGhost(g, decided) {
  const segments = [];
  const lit = new Set(), litReal = new Set(), reached = new Set(); // reached: cells any beam enters
  const seen = new Set(); // (cell*4+dir)*8+color*2+ghost
  const queue = [];
  g.cells.forEach((c, i) => {
    if (c.type === EMITTER) queue.push([i % g.w, Math.floor(i / g.w), c.dir, colorOf(c), false]);
  });
  while (queue.length) {
    let [x, y, dir, color, ghost] = queue.pop();
    const sx = x, sy = y;
    const seg = (x2, y2) => segments.push({ x1: sx, y1: sy, x2, y2, color, ghost });
    for (;;) {
      const nx = x + DX[dir], ny = y + DY[dir];
      if (!inBounds(g, nx, ny)) { seg(x + DX[dir] * 0.5, y + DY[dir] * 0.5); break; }
      const key = (((ny * g.w + nx) * 4 + dir) * 8 + color) * 2 + (ghost ? 1 : 0);
      if (seen.has(key)) { seg(nx, ny); break; }
      seen.add(key);
      x = nx; y = ny;
      const i = y * g.w + x, c = at(g, x, y);
      reached.add(i);
      if (c.type === WALL || c.type === EMITTER) { seg(x - DX[dir] * 0.5, y - DY[dir] * 0.5); break; }
      if (c.type === FILTER && colorOf(c) !== color) { seg(x, y); break; }
      if (c.type === TARGET) {
        if (colorOf(c) === color) { lit.add(i); if (!ghost) litReal.add(i); }
        seg(x, y); break;
      }
      if (c.type === MIRROR || c.type === SPLITTER) {
        seg(x, y);
        const d = rotatable(c) ? decided[i] : c.rot;
        if (d === UNDECIDED) {
          queue.push([x, y, reflect(0, dir), color, true], [x, y, reflect(1, dir), color, true]);
        } else queue.push([x, y, reflect(d, dir), color, ghost]);
        if (c.type === SPLITTER) queue.push([x, y, dir, color, ghost]); // passes straight either way
        break;
      }
    }
  }
  return { segments, lit, litReal, reached };
}

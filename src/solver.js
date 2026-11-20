// Exact minimum-move solver. A move flips one rotatable piece, and each piece has two states,
// so the optimum is the smallest set of pieces to flip. Pieces no beam ever reaches don't
// matter, so we decide pieces lazily: trace with a partial assignment, and branch only when a
// beam reaches an undecided piece (keep = cost 0, flip = cost 1). Branch-and-bound on cost.
import { targets, colorOf, FILTER, MIRROR, SPLITTER, EMITTER, WALL, TARGET, DX, DY, reflect } from './engine.js';

const isRot = (c) => (c.type === MIRROR || c.type === SPLITTER) && !c.fixed;

// Trace with `rot` overrides for decided pieces (rotOf[i] = 0/1, or -1 if undecided).
// Returns the first undecided rotatable piece a beam reaches, or -1 if none (and then
// lit[] is stamped with `stamp` for every lit target). Typed arrays + stamps: no allocation.
function makeTracer(g) {
  const n = g.w * g.h;
  const type = new Uint8Array(n); // 0 empty, 1 block, 2 target, 3 mirror, 4 splitter, 5 filter
  const rot0 = new Int8Array(n);
  const movable = new Uint8Array(n);
  const tcolor = new Uint8Array(n);
  const emitters = [];
  g.cells.forEach((c, i) => {
    type[i] = c.type === FILTER ? 5 : c.type === MIRROR ? 3 : c.type === SPLITTER ? 4 : c.type === TARGET ? 2
      : (c.type === WALL || c.type === EMITTER) ? 1 : 0;
    rot0[i] = c.rot ?? 0;
    movable[i] = isRot(c) ? 1 : 0;
    tcolor[i] = colorOf(c);
    if (c.type === EMITTER) emitters.push((i * 4 + c.dir) * 4 + colorOf(c));
  });
  const seen = new Uint32Array(n * 16); // (cell*4+dir)*4+color; colors 0..3
  const lit = new Uint32Array(n);
  const queue = new Int32Array(n * 16 + emitters.length + 4);
  let stamp = 0;
  // wild: undecided pieces send light both ways (an optimistic superset of what any
  // completion can light), used to prune branches that can no longer light every target.
  function run(rotOf, frozen, wild = false) {
    stamp++;
    let qn = 0;
    for (const e of emitters) queue[qn++] = e;
    while (qn) {
      const s = queue[--qn];
      const color = s & 3;
      let i = s >> 4, dir = (s >> 2) & 3, x = i % g.w, y = (i - x) / g.w;
      for (;;) {
        x += DX[dir]; y += DY[dir];
        if (x < 0 || y < 0 || x >= g.w || y >= g.h) break;
        i = y * g.w + x;
        const key = (i * 4 + dir) * 4 + color;
        if (seen[key] === stamp) break;
        seen[key] = stamp;
        const t = type[i];
        if (t === 0) continue;
        if (t === 1) break;
        if (t === 2) { if (tcolor[i] === color) lit[i] = stamp; break; }
        if (t === 5) { if (tcolor[i] === color) continue; break; }
        let r = rot0[i];
        if (movable[i]) {
          if (rotOf[i] >= 0) r = rotOf[i];
          else if (wild) queue[qn++] = (i * 4 + reflect(r ^ 1, dir)) * 4 + color;
          else if (!frozen) return i;
        }
        queue[qn++] = (i * 4 + reflect(r, dir)) * 4 + color;
        if (t === 4) queue[qn++] = (i * 4 + dir) * 4 + color;
        break;
      }
    }
    return -1;
  }
  return { run, isLit: (i) => lit[i] === stamp, rot0, n };
}

// Returns { moves, flips: [idx...] } for an optimal solution, or null if none within `limit`
// moves or the node budget runs out (then `exhausted` is set).
export function solve(g, { limit = Infinity, maxNodes = 300000, ghost = true } = {}) {
  const goal = targets(g);
  const tr = makeTracer(g);
  const rotOf = new Int8Array(tr.n).fill(-1);
  let best = null;
  let bound = limit;
  let nodes = 0;
  let exhausted = false;
  const flips = [];

  function dfs(cost) {
    if (exhausted) return;
    if (++nodes > maxNodes) { exhausted = true; return; }
    // with no flips left to spend, every undecided piece keeps its current state
    const maxCost = best ? bound - 1 : bound;
    if (ghost && cost < maxCost) { // (at maxCost the frozen trace below is already exact)
      tr.run(rotOf, false, true);
      if (!goal.every(tr.isLit)) return;
    }
    const i = tr.run(rotOf, cost >= maxCost);
    if (i < 0) {
      if (cost <= maxCost && goal.every(tr.isLit)) {
        best = { moves: cost, flips: [...flips] };
        bound = cost;
      }
      return;
    }
    const cur = tr.rot0[i];
    rotOf[i] = cur; // keep
    dfs(cost);
    if (cost + 1 <= (best ? bound - 1 : bound)) {
      rotOf[i] = cur ^ 1; // flip
      flips.push(i);
      dfs(cost + 1);
      flips.pop();
    }
    rotOf[i] = -1;
  }
  dfs(0);
  if (best) return { ...best, exhausted, nodes };
  return exhausted ? { moves: null, exhausted, nodes } : null;
}

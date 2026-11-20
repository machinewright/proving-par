// Instrumented search for the essay's tree widgets. Same rules as solver.js, but slow and simple,
// and it records every node so a widget can draw the tree.
//   budget: prove/find a solution with at most this many flips (Infinity = no budget)
//   lazy:   decide a mirror only when a (certain) beam reaches it; otherwise go in a fixed order
//   ghost:  prune a node when even ghost beams can't light every target
//   best:   once a solution is found, only look for strictly cheaper ones (branch and bound)
// Node: { mirror, choice: 'keep'|'flip'|null, cost, outcome, children, decided }
//   outcome: 'branch' (has children) | 'solved' | 'fail' (all decided, not solved)
//            | 'over' (budget spent, frozen trace fails) | 'ghost' (pruned by ghost beams)
import { MIRROR, SPLITTER, targets } from './engine.js';
import { traceGhost, UNDECIDED } from './ghost.js';

const isRot = (c) => (c.type === MIRROR || c.type === SPLITTER) && !c.fixed;

export function searchTree(g, { budget = Infinity, lazy = true, ghost = false, best: bnb = false, maxNodes = 200000 } = {}) {
  const goal = targets(g);
  const order = g.cells.map((c, i) => (isRot(c) ? i : -1)).filter((i) => i >= 0);
  const decided = new Int8Array(g.cells.length).fill(UNDECIDED);
  let count = 0, bound = budget, best = null, truncated = false;

  // Real beams only: certain light. Returns the first undecided mirror a certain beam reaches.
  function frontier() {
    const t = traceGhost(g, decided);
    // a certain (non-ghost) segment ends at an undecided mirror
    for (const s of t.segments) {
      if (s.ghost) continue;
      const i = s.y2 * g.w + s.x2;
      if (Number.isInteger(s.x2) && Number.isInteger(s.y2) && i >= 0 && i < decided.length
        && isRot(g.cells[i]) && decided[i] === UNDECIDED) return { i, t };
    }
    return { i: -1, t };
  }
  const allLit = (set) => goal.every((k) => set.has(k));
  const frozenSolved = () => {
    const d = Int8Array.from(decided, (v, i) => (v === UNDECIDED && isRot(g.cells[i]) ? g.cells[i].rot : v));
    return allLit(traceGhost(g, d).litReal);
  };

  function visit(node, cost) {
    if (++count > maxNodes) { truncated = true; node.outcome = 'cut'; return node; }
    node.cost = cost;
    const limit = best && bnb ? bound - 1 : bound;
    let next;
    if (lazy) {
      const f = frontier();
      if (ghost && cost < limit && !allLit(f.t.lit)) { node.outcome = 'ghost'; return node; }
      next = f.i;
      if (next < 0) {
        if (allLit(f.t.litReal)) return found(node, cost);
        node.outcome = 'fail'; return node;
      }
    } else {
      if (ghost && cost < limit && !allLit(traceGhost(g, decided).lit)) { node.outcome = 'ghost'; return node; }
      next = order.find((i) => decided[i] === UNDECIDED) ?? -1;
      if (next < 0) {
        if (frozenSolved()) return found(node, cost);
        node.outcome = 'fail'; return node;
      }
    }
    if (cost >= limit) { // no flips left: every undecided mirror keeps its state
      if (frozenSolved()) return found(node, cost);
      node.outcome = 'over'; return node;
    }
    node.outcome = 'branch'; node.mirror = next; node.children = [];
    const cur = g.cells[next].rot;
    for (const [choice, val, add] of [['keep', cur, 0], ['flip', cur ^ 1, 1]]) {
      const lim = best && bnb ? bound - 1 : bound;
      if (cost + add > lim) { node.children.push({ choice, cost: cost + add, outcome: 'skip' }); continue; }
      decided[next] = val;
      node.children.push(visit({ choice, mirror: next }, cost + add));
      decided[next] = UNDECIDED;
      if (truncated) break;
    }
    return node;
  }
  function found(node, cost) {
    node.outcome = 'solved';
    node.flips = order.filter((i) => decided[i] !== UNDECIDED && decided[i] !== g.cells[i].rot);
    if (!best || cost < best.cost) { best = { cost, flips: node.flips }; if (bnb) bound = cost; }
    return node;
  }
  const root = visit({ choice: null }, 0);
  return { root, nodes: count, best, truncated };
}

export function countOutcomes(root) {
  const out = {};
  (function walk(n) { out[n.outcome] = (out[n.outcome] || 0) + 1; (n.children || []).forEach(walk); })(root);
  return out;
}

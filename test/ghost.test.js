import test from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../src/generator.js';
import { trace, MIRROR, SPLITTER, cloneGrid } from '../src/engine.js';
import { traceGhost, UNDECIDED } from '../src/ghost.js';
import { solve } from '../src/solver.js';

// The essay's central claim: ghost beams light a superset of what any completion can light.
test('ghost trace over-approximates every completion (random partial decisions)', () => {
  let checked = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const { puzzle: g } = generate(seed, 4 + (seed % 10));
    const rot = g.cells.map((c, i) => ((c.type === MIRROR || c.type === SPLITTER) && !c.fixed ? i : -1)).filter((i) => i >= 0);
    for (let k = 0; k < 20; k++) {
      const decided = new Int8Array(g.cells.length).fill(UNDECIDED);
      rot.forEach((i) => { if ((seed * 31 + k * 7 + i) % 3 === 0) decided[i] = (i + k) % 2; });
      const ghost = traceGhost(g, decided);
      // a random completion of the undecided pieces
      const h = cloneGrid(g);
      rot.forEach((i) => { h.cells[i].rot = decided[i] === UNDECIDED ? (i * k + seed) % 2 : decided[i]; });
      for (const i of trace(h).lit) assert.ok(ghost.lit.has(i), `seed ${seed} k ${k}: target ${i}`);
      checked++;
    }
  }
  assert.ok(checked >= 800);
});

test('with nothing undecided, ghost trace equals the real trace', () => {
  const { puzzle: g } = generate(147, 4);
  const decided = Int8Array.from(g.cells, (c) => c.rot ?? 0);
  const t = traceGhost(g, decided);
  assert.ok(t.segments.every((s) => !s.ghost));
  assert.deepEqual([...t.litReal].sort(), [...trace(g).lit].sort());
});

test('hook puzzle: par 7, and keeping any of seven mirrors is a dead end', () => {
  const { puzzle: g, par } = generate(147, 4);
  assert.equal(par, 7);
  assert.equal(solve(g, { limit: 6 }), null);
  const goal = g.cells.map((c, i) => (c.type === 'target' ? i : -1)).filter((i) => i >= 0);
  const forced = g.cells.filter((c, i) => {
    if (c.type !== MIRROR) return false;
    const d = new Int8Array(g.cells.length).fill(UNDECIDED); d[i] = c.rot;
    const t = traceGhost(g, d);
    return goal.some((k) => !t.lit.has(k));
  });
  assert.equal(forced.length, 7);
});

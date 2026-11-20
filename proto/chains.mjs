// Project-3 feasibility: on generated boards, how far does iterated ghost deduction get?
// Round r: for each undecided mirror, if keeping it (given decisions so far) leaves a target dark even in ghost
// light, it must flip; if flipping does, it must stay. Repeat to a fixpoint.
import { generate, generateWith, paramsFor } from '../src/generator.js';
import { traceGhost } from '../src/ghost.js';
import { targets } from '../src/engine.js';
function deduce(g) {
  const goal = targets(g), d = new Int8Array(g.cells.length).fill(-1);
  const mirrors = g.cells.map((c, i) => (c.type === 'mirror' ? i : -1)).filter((i) => i >= 0);
  const dark = (dd) => { const t = traceGhost(g, dd); return goal.some((k) => !t.lit.has(k)); };
  let rounds = 0, changed = true;
  while (changed) {
    changed = false; const found = [];
    for (const i of mirrors) if (d[i] === -1) for (const v of [g.cells[i].rot, g.cells[i].rot ^ 1]) {
      const dd = d.slice(); dd[i] = v; if (dark(dd)) found.push([i, v ^ 1]);
    }
    if (found.length) { rounds++; changed = true; for (const [i, v] of found) d[i] = v; }
  }
  const flips = mirrors.filter((i) => d[i] !== -1 && d[i] !== g.cells[i].rot).length;
  return { rounds, flips, decided: mirrors.filter((i) => d[i] !== -1).length, mirrors: mirrors.length };
}
const rows = [];
for (const L of [3, 4, 5, 6, 8, 10]) for (let s = 1; s <= 40; s++) {
  const p = { ...paramsFor(L), colors: 1, filters: 0, splitters: 0 };
  let r; try { r = generateWith(s * 7 + L, p); } catch { continue; }
  const x = deduce(r.puzzle);
  rows.push({ L, par: r.par, ...x, proves: x.flips === r.par });
}
for (const L of [3, 4, 5, 6, 8, 10]) {
  const R = rows.filter((r) => r.L === L);
  const pr = R.filter((r) => r.proves);
  console.log(`L${L}: n=${R.length} proved by deduction ${pr.length}; of those multi-round ${pr.filter((r) => r.rounds >= 2).length} (max rounds ${Math.max(0, ...pr.map((r) => r.rounds))}); avg par ${(R.reduce((a, r) => a + r.par, 0) / R.length).toFixed(1)}`);
}

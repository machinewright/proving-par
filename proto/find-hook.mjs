import { generate } from '../src/generator.js';
import { solve } from '../src/solver.js';
import { MIRROR, SPLITTER, targets } from '../src/engine.js';
const out = [];
for (const level of [4, 5, 6, 7]) for (let seed = 1; seed < 3000; seed++) {
  const r = generate(seed, level);
  const g = r.puzzle;
  if (r.par !== 7 || g.cells.some((c) => c.type === SPLITTER)) continue;
  const rot = g.cells.filter((c) => c.type === MIRROR).length;
  const p6 = solve(g, { limit: 6 });
  out.push({ level, seed, w: g.w, rot, targets: targets(g).length, nodes6: p6 === null ? 'proved' : p6 });
  if (out.length > 12) break;
}
console.table(out);

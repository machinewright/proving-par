import { generate } from '../src/generator.js';
import { MIRROR, targets } from '../src/engine.js';
import { traceGhost } from '../src/ghost.js';
const { puzzle: g } = generate(147, 4);
const goal = targets(g);
g.cells.forEach((c, i) => { if (c.type !== MIRROR) return;
  for (const choice of [c.rot, c.rot ^ 1]) {
    const d = new Int8Array(g.cells.length).fill(-1); d[i] = choice;
    const t = traceGhost(g, d);
    if (goal.some((k) => !t.lit.has(k))) console.log('dead:', i % g.w, Math.floor(i / g.w), choice === c.rot ? 'keep' : 'flip');
  }});

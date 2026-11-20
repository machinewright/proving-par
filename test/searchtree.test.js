import test from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../src/generator.js';
import { solve } from '../src/solver.js';
import { searchTree } from '../src/searchtree.js';

// The tree widgets must agree with the real solver, or the essay would be showing a fake proof.
test('searchTree finds the same optimum as solve(), in every mode', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const { puzzle: g, par } = generate(seed, 3 + (seed % 6));
    assert.equal(solve(g).moves, par);
    for (const mode of [{ lazy: true, best: true }, { lazy: true, ghost: true, best: true }]) {
      const r = searchTree(g, mode);
      assert.equal(r.best.cost, par, `seed ${seed} ${JSON.stringify(mode)}`);
    }
    // the tree widgets run without branch-and-bound tightening: the best solution found must still be par
    for (const ghost of [false, true]) {
      const all = searchTree(g, { ghost });
      const sols = [];
      (function walk(n) { if (n.outcome === 'solved') sols.push(n.flips.length); (n.children || []).forEach(walk); })(all.root);
      assert.equal(Math.min(...sols), par, `seed ${seed} ghost ${ghost}: full tree`);
    }
    for (const ghost of [false, true]) {
      assert.equal(searchTree(g, { budget: par - 1, ghost }).best, null, `seed ${seed}: par-1 must be impossible`);
      assert.equal(searchTree(g, { budget: par, ghost }).best?.cost, par);
    }
    if (g.cells.filter((c) => c.type === 'mirror' || c.type === 'splitter').length <= 12) {
      assert.equal(searchTree(g, { lazy: false, best: true }).best.cost, par);
    }
  }
});

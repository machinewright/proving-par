import test from 'node:test';
import assert from 'node:assert/strict';
import { BOARDS, board } from '../src/boards.js';
import { solve } from '../src/solver.js';
import { isSolved } from '../src/engine.js';

test('frozen essay boards keep their proven par', () => {
  for (const [name, b] of Object.entries(BOARDS)) {
    const g = board(name);
    assert.ok(!isSolved(g), name);
    assert.equal(solve(g, { maxNodes: 1e7 }).moves, b.par, name);
    assert.equal(solve(g, { limit: b.par - 1, maxNodes: 1e7 }), null, `${name}: no shorter solution`);
  }
});

test('solver gives the same par with ghost pruning off, using more nodes', () => {
  for (const name of Object.keys(BOARDS)) {
    const g = board(name);
    const on = solve(g, { maxNodes: 1e7 }), off = solve(g, { maxNodes: 1e7, ghost: false });
    assert.equal(off.moves, on.moves, name);
    assert.ok(off.nodes > on.nodes, name);
  }
});

test('ghost pruning never changes the answer (60 generated boards)', async () => {
  const { generate } = await import('../src/generator.js');
  for (let seed = 1; seed <= 60; seed++) {
    const g = generate(seed, 2 + (seed % 20)).puzzle;
    const on = solve(g, { maxNodes: 1e6 }), off = solve(g, { maxNodes: 1e6, ghost: false });
    if (off.exhausted) continue;
    assert.equal(on.moves, off.moves, `seed ${seed}`);
  }
});

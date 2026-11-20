// §5: ghost light. Undecided mirrors (drawn as X) send light both ways. Click a mirror to cycle
// undecided → kept → flipped. "Test every mirror" keeps each mirror alone in turn and marks the ones
// that kill a target even with ghost light: those must flip in every solution, so they count toward a
// lower bound.
import { board, BOARDS } from '../src/boards.js';
import { makeCanvas, drawBoard, allUndecided, isMirror, flipCount } from '../src/view.js';
import { traceGhost, UNDECIDED } from '../src/ghost.js';
import { targets } from '../src/engine.js';

export function mount(el, opts = {}) {
  const name = opts.board || 'hook';
  const g = board(name), goal = targets(g), par = BOARDS[name].par;
  const mirrors = g.cells.map((c, i) => (isMirror(c) ? i : -1)).filter((i) => i >= 0);
  let decided = allUndecided(g);
  let forced = new Set(), testing = -1, timer = null;

  const view = makeCanvas(g, { label: 'Board with ghost light. Click a mirror to cycle it between undecided, kept, and flipped. Arrow keys move between mirrors; Enter cycles one.', onActivate });
  const controls = document.createElement('div'); controls.className = 'controls';
  const resetB = button('Everything undecided', () => { stop(); decided = allUndecided(g); forced.clear(); view.redraw(); });
  const testB = button('Test every mirror', testAll); testB.classList.add('primary');
  controls.append(resetB, testB);
  const readout = document.createElement('p'); readout.className = 'readout';
  readout.setAttribute('role', 'status'); readout.setAttribute('aria-live', 'polite');
  const count = document.createElement('p'); count.className = 'note'; count.setAttribute('role', 'status');
  el.append(view.canvas, controls, readout, count);

  function onActivate(i) {
    if (!isMirror(g.cells[i])) return;
    if (timer || testing >= 0) { stop(); decided = allUndecided(g); }
    forced.clear(); // the rings only hold for the all-undecided test
    const r = g.cells[i].rot;
    decided[i] = decided[i] === UNDECIDED ? r : decided[i] === r ? r ^ 1 : UNDECIDED;
    view.redraw();
  }

  const deadWith = (d) => { const t = traceGhost(g, d); return goal.filter((k) => !t.lit.has(k)).length; };

  view.setDraw(() => {
    drawBoard(view.canvas, g, decided, { focus: testing >= 0 ? testing : view.cursor });
    // forced mirrors: a red ring
    const ctx = view.canvas.getContext('2d'), cell = view.canvas.width / g.w;
    ctx.strokeStyle = '#ff8a80'; ctx.lineWidth = Math.max(2, cell * 0.045);
    for (const i of forced) {
      ctx.beginPath(); ctx.arc((i % g.w + 0.5) * cell, (Math.floor(i / g.w) + 0.5) * cell, cell * 0.44, 0, 7); ctx.stroke();
    }
    const open = decided.reduce((n, v, i) => n + (isMirror(g.cells[i]) && v === UNDECIDED ? 1 : 0), 0);
    const flips = flipCount(g, decided);
    count.textContent = `${flips} flipped, ${mirrors.length - open - flips} kept, ${open} undecided.`;
    if (testing >= 0 || timer) return; // the test run writes its own text
    if (forced.size && open === mirrors.length) {
      readout.innerHTML = forced.size === par
        ? `<b>${forced.size} mirrors</b> (ringed) can't be kept: keeping any one of them leaves a target dark even with ghost light. `
          + `So every solution flips all ${forced.size}. No solution can use fewer than ${par} flips, and the first puzzle has a solution with exactly ${par}. <span class="good">Proven.</span>`
        : `${forced.size} mirrors (ringed) must flip in every solution, so every solution needs at least ${forced.size} flips.`;
      return;
    }
    const dead = deadWith(decided);
    const t = traceGhost(g, decided);
    if (dead) {
      readout.innerHTML = `<span class="bad">Dead end.</span> Even with every undecided mirror sending light both ways, `
        + `${dead === 1 ? 'a target stays' : `${dead} targets stay`} dark. No way of finishing these choices can work, `
        + `so the search can skip all ${(2 ** open).toLocaleString('en-US')} of them at once.`;
    } else if (goal.every((k) => t.litReal.has(k))) {
      readout.innerHTML = `<span class="good">Solved</span>, with ${flips} flip${flips === 1 ? '' : 's'}.`;
    } else {
      readout.innerHTML = '<span class="maybe">Still possible.</span> Ghost light reaches every target, so some way of finishing these choices might work. The search has to keep looking here.';
    }
  });

  // Keep each mirror on its own (everything else undecided); ring the ones that make a target unreachable.
  function testAll() {
    stop(); forced.clear();
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let k = 0;
    const tick = () => {
      if (k > 0) { // finish the previous one
        if (deadWith(decided)) forced.add(testing);
      }
      if (k === mirrors.length) { stop(); decided = allUndecided(g); view.redraw(); return; }
      testing = mirrors[k++];
      decided = allUndecided(g); decided[testing] = g.cells[testing].rot;
      const dead = deadWith(decided);
      readout.innerHTML = `Keeping mirror ${k} of ${mirrors.length}: `
        + (dead ? '<span class="bad">a target goes dark</span>, so this mirror must flip.' : '<span class="maybe">every target can still be reached.</span> No conclusion.');
      view.redraw();
    };
    if (reduce) { for (;;) { tick(); if (testing === -1) return; } }
    timer = setInterval(tick, 650); tick();
  }
  function stop() {
    if (timer) clearInterval(timer);
    timer = null; testing = -1;
  }
  return {};
}

function button(text, fn) {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.onclick = fn; return b;
}

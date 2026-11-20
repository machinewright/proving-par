// §7 and §8: the real solver, with and without ghost pruning, on a bigger board. Both counters advance at
// the same speed, one position per tick, so the bars show how much work each version does.
import { board } from '../src/boards.js';
import { makeCanvas, drawBoard, startState, allUndecided, isMirror } from '../src/view.js';
import { solve } from '../src/solver.js';

const fmt = (n) => n.toLocaleString('en-US');
const ms = (x) => (x < 0.1 ? "under 0.1 ms" : x < 1 ? `${x.toFixed(2)} ms` : `${x.toFixed(1)} ms`); // browsers round timers to ~0.1 ms

export function mount(el, opts = {}) {
  const name = opts.board || 'big';
  const g = board(name);
  const mirrors = g.cells.filter(isMirror).length;
  const showGhostStart = opts.view === 'ghost';
  let state = showGhostStart ? allUndecided(g) : startState(g);
  let timer = null;

  // best of 5 runs each, interleaved, so neither version pays for the JIT warming up
  const time = (o) => { const t0 = performance.now(); const r = solve(g, { maxNodes: 1e7, ...o }); return { ...r, ms: performance.now() - t0 }; };
  const best = (o) => { let r = null; for (let k = 0; k < 5; k++) { const x = time(o); if (!r || x.ms < r.ms) r = x; } return r; };
  best({}); best({ ghost: false });
  const plain = best({ ghost: false }), ghost = best({});

  const view = makeCanvas(g, { label: `A ${g.w} by ${g.h} board with ${mirrors} mirrors.` });
  view.canvas.classList.add('big');
  view.setDraw(() => drawBoard(view.canvas, g, state, { fadeUnreached: false }));
  const bars = document.createElement('div');
  bars.innerHTML = `
    <div class="race-row"><div class="race-label">Without ghost light</div><div class="race-track"><div class="race-bar" style="background:#7d8594"></div></div><div class="race-n num">0</div></div>
    <div class="race-row"><div class="race-label">With ghost light</div><div class="race-track"><div class="race-bar" style="background:#e3a21a"></div></div><div class="race-n num">0</div></div>`;
  const [barA, barB] = bars.querySelectorAll('.race-bar'), [nA, nB] = bars.querySelectorAll('.race-n');
  const controls = document.createElement('div'); controls.className = 'controls';
  const raceB = button('Race', race); raceB.classList.add('primary');
  controls.append(raceB);
  if (showGhostStart) {
    const toggle = button('Show the puzzle', () => {
      const ghostNow = state.every((v, i) => !isMirror(g.cells[i]) || v === -1);
      state = ghostNow ? startState(g) : allUndecided(g);
      toggle.textContent = ghostNow ? 'Show ghost light at the start' : 'Show the puzzle';
      view.redraw();
    });
    controls.append(toggle);
  }
  const readout = document.createElement('p'); readout.className = 'readout';
  readout.setAttribute('role', 'status'); readout.setAttribute('aria-live', 'polite');
  readout.innerHTML = `${mirrors} mirrors: listing every flip set would mean checking 2<sup>${mirrors}</sup> = ${fmt(2 ** mirrors)} of them.`;
  el.append(view.canvas, bars, controls, readout);

  function show(k) {
    const a = Math.min(k, plain.nodes), b = Math.min(k, ghost.nodes);
    barA.style.width = `${(a / plain.nodes) * 100}%`; barB.style.width = `${(b / plain.nodes) * 100}%`;
    nA.textContent = fmt(a); nB.textContent = fmt(b);
  }
  function race() {
    if (timer) return;
    state = startState(g); view.redraw();
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const total = plain.nodes, perTick = Math.max(1, Math.ceil(total / 150));
    let k = 0;
    raceB.disabled = true;
    const tick = () => {
      k = Math.min(total, k + perTick); show(k);
      if (k >= total) { clearInterval(timer); timer = null; raceB.disabled = false; finish(); }
    };
    if (reduce) { k = total - perTick; tick(); return; }
    timer = setInterval(tick, 20);
  }
  function finish() {
    for (const i of ghost.flips) state[i] ^= 1;
    view.redraw();
    const ratio = plain.nodes / ghost.nodes;
    readout.innerHTML = (plain.moves === ghost.moves ? `Both prove the same answer: <span class="num">${ghost.moves}</span> flips (the blue mirrors). `
      : `<span class="bad">The two searches disagree (${plain.moves} vs ${ghost.moves}). That's a bug.</span> `)
      + `Without ghost light the solver looks at <span class="num">${fmt(plain.nodes)}</span> positions; with it, <span class="num">${fmt(ghost.nodes)}</span>`
      + (ratio >= 3 ? `, about ${fmt(Math.round(ratio))} times fewer.` : `. That's only ${ratio.toFixed(1)} times fewer.`)
      + ` <span class="note">Time on this device: ${ms(plain.ms)} without, ${ms(ghost.ms)} with. A position with ghost pruning costs more to check, since the light is traced twice.</span>`;
  }
  show(0);
  return {};
}

function button(text, fn) {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.onclick = fn; return b;
}

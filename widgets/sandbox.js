// §8 sandbox: build a board and see how hard the solver has to work, with and without ghost light.
import { board } from '../src/boards.js';
import { makeGrid, cloneGrid, EMPTY, WALL, EMITTER, MIRROR, TARGET } from '../src/engine.js';
import { drawBoard, startState } from '../src/view.js';
import { solve } from '../src/solver.js';

const fmt = (n) => n.toLocaleString('en-US');
const ms = (x) => (x < 0.1 ? "under 0.1 ms" : x < 1 ? `${x.toFixed(2)} ms` : `${x.toFixed(1)} ms`); // browsers round timers to ~0.1 ms
const MAX_MIRRORS = 40, MAX_EMITTERS = 4, MAX_NODES = 2e6;
const TOOLS = [['mirror', 'Mirror'], ['target', 'Target'], ['emitter', 'Light'], ['wall', 'Wall'], ['erase', 'Erase']];

function emptyBoard() {
  const g = makeGrid(8, 8);
  Object.assign(g.cells[3 * 8], { type: EMITTER, dir: 1 });
  g.cells[4 * 8 + 7].type = TARGET;
  return g;
}
// A size-n board with the given board copied into its top left corner.
function padded(src, n) {
  const g = makeGrid(n, n);
  src.cells.forEach((c, i) => { g.cells[(Math.floor(i / src.w)) * n + (i % src.w)] = { ...c }; });
  return g;
}

export function mount(el) {
  let g = padded(board('hook'), 8), shownSolution = null, cursor = -1, tool = 'mirror', warn = '';

  const canvas = document.createElement('canvas'); canvas.className = 'board big'; canvas.tabIndex = 0;
  canvas.style.cursor = 'pointer';
  canvas.setAttribute('role', 'application');
  const LABEL = 'Board editor. Arrow keys move the cursor, Enter or Space applies the selected tool.';
  canvas.setAttribute('aria-label', LABEL);
  const tools = document.createElement('div'); tools.className = 'controls'; tools.setAttribute('role', 'group'); tools.setAttribute('aria-label', 'Tool');
  const toolButtons = TOOLS.map(([k, label]) => {
    const b = button(label, () => { tool = k; toolButtons.forEach((x) => x.setAttribute('aria-pressed', String(x === b))); });
    b.setAttribute('aria-pressed', String(k === tool)); return b;
  });
  tools.append(...toolButtons);
  const presets = document.createElement('div'); presets.className = 'controls presets';
  presets.append(
    button('Opening puzzle', () => load(padded(board('hook'), 8))),
    button('The open board', () => load(board('weak'))),
    button('Empty', () => load(emptyBoard())),
  );
  const actions = document.createElement('div'); actions.className = 'controls';
  const solveB = button('Solve', run); solveB.classList.add('primary');
  const showB = button('Show solution', () => { if (result?.flips) { shownSolution = result.flips; draw(); } });
  showB.disabled = true;
  actions.append(solveB, showB);
  const info = document.createElement('p'); info.className = 'note';
  const readout = document.createElement('p'); readout.className = 'readout';
  readout.setAttribute('role', 'status'); readout.setAttribute('aria-live', 'polite');
  el.append(tools, canvas, info, actions, readout, presets);

  let result = null;
  const count = (t) => g.cells.filter((c) => c.type === t).length;

  function load(ng) { g = ng; edited(); }
  function edited() {
    warn = '';
    shownSolution = null; result = null; showB.disabled = true;
    readout.textContent = 'Press Solve to find the fewest flips and see how much searching it took.';
    draw();
  }
  const DIRS = ['up', 'right', 'down', 'left'];
  const what = (c) => (c.type === MIRROR ? `mirror ${c.rot ? '\\' : '/'}` : c.type === EMITTER ? `light pointing ${DIRS[c.dir]}`
    : c.type === EMPTY ? 'empty' : c.type);
  // keyboard users hear where the cursor is and what is there (the board itself is only drawn)
  const announce = () => canvas.setAttribute('aria-label', `Column ${cursor % g.w + 1}, row ${Math.floor(cursor / g.w) + 1}: ${what(g.cells[cursor])}${warn ? `. ${warn}` : ''}`);
  function apply(i) {
    const c = g.cells[i];
    if (tool === 'erase') { g.cells[i] = { type: EMPTY }; }
    else if (tool === 'mirror') {
      if (c.type === MIRROR) c.rot ^= 1;
      else if (count(MIRROR) >= MAX_MIRRORS) { warn = `At most ${MAX_MIRRORS} mirrors.`; draw(); return; }
      else g.cells[i] = { type: MIRROR, rot: 0 };
    } else if (tool === 'emitter') {
      if (c.type === EMITTER) c.dir = (c.dir + 1) % 4;
      else if (count(EMITTER) >= MAX_EMITTERS) { warn = `At most ${MAX_EMITTERS} light sources.`; draw(); return; }
      else g.cells[i] = { type: EMITTER, dir: 1 };
    } else if (tool === 'target') g.cells[i] = { type: TARGET };
    else if (tool === 'wall') g.cells[i] = { type: WALL };
    edited();
  }

  function draw() {
    const css = canvas.getBoundingClientRect().width || 300, dpr = devicePixelRatio || 1;
    const w = Math.round(css * dpr);
    if (canvas.width !== w || canvas.height !== Math.round(w * g.h / g.w)) { canvas.width = w; canvas.height = Math.round(w * g.h / g.w); }
    const d = startState(g);
    if (shownSolution) for (const i of shownSolution) d[i] ^= 1;
    drawBoard(canvas, g, d, { focus: cursor, fadeUnreached: false });
    const m = count(MIRROR);
    info.innerHTML = warn ? `<span class="maybe">${warn}</span>`
      : `${m} mirror${m === 1 ? '' : 's'}, so 2<sup>${m}</sup> = ${fmt(2 ** m)} ways to set them. `
        + 'Click a mirror again to change its starting tilt, a light source to turn it.';
  }
  new ResizeObserver(draw).observe(canvas);

  async function run() {
    if (!count(TARGET) || !count(EMITTER)) { readout.textContent = 'The board needs at least one light source and one target.'; return; }
    readout.textContent = 'Solving…'; solveB.disabled = true;
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    const time = (o) => { const t0 = performance.now(); const r = solve(cloneGrid(g), { maxNodes: MAX_NODES, ...o }); return { r, ms: performance.now() - t0 }; };
    let on = time({}), off = time({ ghost: false });
    for (let k = 0; k < 4 && on.ms + off.ms < 60; k++) { // quick ones: best of several, so JIT warm-up doesn't skew it
      const a = time({}), b = time({ ghost: false });
      if (a.ms < on.ms) on = a;
      if (b.ms < off.ms) off = b;
    }
    solveB.disabled = false;
    result = on.r;
    const nodes = (x) => (x.r?.exhausted ? `more than ${fmt(MAX_NODES)} (it gave up)` : fmt(x.r ? x.r.nodes : 0));
    // solve() returns null when the search finishes without a solution; count isn't reported then
    if (on.r === null) {
      readout.innerHTML = '<span class="bad">No combination of flips lights every target.</span> The search proved it.';
    } else if (on.r.moves == null) {
      readout.innerHTML = `The solver gave up after ${fmt(MAX_NODES)} positions without finishing. You built a hard one.`;
    } else {
      readout.innerHTML = on.r.moves === 0 ? 'It is already solved: no flips needed. ' : `Fewest flips: <span class="num">${on.r.moves}</span>. `;
      readout.innerHTML += `With ghost light, the solver looked at <span class="num">${nodes(on)}</span> positions (${ms(on.ms)}); `
        + `without it, <span class="num">${nodes(off)}</span> (${ms(off.ms)}).`;
      showB.disabled = on.r.moves === 0;
    }
  }

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / r.width * g.w), y = Math.floor((e.clientY - r.top) / r.height * g.h);
    if (x >= 0 && y >= 0 && x < g.w && y < g.h) { cursor = -1; apply(y * g.w + x); }
  });
  canvas.addEventListener('keydown', (e) => {
    const mv = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key];
    if (cursor < 0 && (mv || e.key === 'Enter' || e.key === ' ')) { cursor = 0; e.preventDefault(); draw(); announce(); return; }
    if (mv) {
      e.preventDefault();
      const x = Math.min(g.w - 1, Math.max(0, cursor % g.w + mv[0])), y = Math.min(g.h - 1, Math.max(0, Math.floor(cursor / g.w) + mv[1]));
      cursor = y * g.w + x; draw(); announce();
    } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apply(cursor); announce(); }
  });
  canvas.addEventListener('blur', () => { cursor = -1; draw(); canvas.setAttribute('aria-label', LABEL); });
  edited();
  return {};
}

function button(text, fn) {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.onclick = fn; return b;
}

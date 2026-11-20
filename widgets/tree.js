// §3–§5: the search tree, drawn as an icicle (each row is one decision; a box's width is its share of
// the leaves). Linked to the board: pick a box and the board shows that partial position.
// Options (data-* attributes): board, budget, ghost ("1"), slider ("1": budget slider), order ("1": a toggle
// between deciding mirrors in a fixed order and deciding them when light reaches them).
import { board as loadBoard, BOARDS } from '../src/boards.js';
import { makeCanvas, drawBoard, allUndecided, startState } from '../src/view.js';
import { searchTree } from '../src/searchtree.js';
import { UNDECIDED } from '../src/ghost.js';

const FILL = {
  keep: '#2c3647', flip: '#28476a', root: '#3a4558',
  solved: '#3fa86b', fail: '#7a3a3f', over: '#9a6420', skip: '#1b2029', ghost: '#7a6a2a',
};
const LEGEND = [
  ['keep', 'keep a mirror'], ['flip', 'flip a mirror'], ['solved', 'solution'], ['fail', 'dead end'],
  ['over', 'out of budget'], ['ghost', 'cut by ghost light'],
];

export function mount(el, opts = {}) {
  const g = loadBoard(opts.board || 'hook'), par = BOARDS[opts.board || 'hook'].par;
  const ghost = opts.ghost === '1';
  let budget = opts.budget != null ? Number(opts.budget) : Infinity;
  let lazy = true;
  let tree, nodes, shown, selected, timer = null;

  const split = document.createElement('div'); split.className = 'split';
  const bview = makeCanvas(g, { label: 'The board at the selected point in the search.' });
  const tcanvas = document.createElement('canvas');
  tcanvas.className = 'board'; tcanvas.tabIndex = 0; tcanvas.style.cursor = 'pointer';
  tcanvas.setAttribute('role', 'img');
  tcanvas.setAttribute('aria-label', 'Search tree. Use the arrow keys to move between positions; the board and the text below follow.');
  const tbox = document.createElement('div'); tbox.append(tcanvas);
  const legend = document.createElement('div'); legend.className = 'legend';
  tbox.append(legend);
  split.append(bview.canvas, tbox);

  const controls = document.createElement('div'); controls.className = 'controls';
  const runB = button('Watch the search', run);
  const stepB = button('Step', step);
  const allB = button('Show whole tree', () => { stop(); shown = nodes.length; select(nodes[0]); });
  controls.append(runB, stepB, allB);
  let orderB = null;
  if (opts.order === '1') {
    orderB = button('', () => { lazy = !lazy; rebuild(); });
    controls.append(orderB);
  }
  let sliderOut = null;
  if (opts.slider === '1') {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'range'; input.min = 3; input.max = 9; input.value = budget; input.setAttribute('aria-label', 'Flip budget');
    sliderOut = document.createElement('span');
    label.append('Budget: at most', input, sliderOut);
    input.oninput = () => { budget = Number(input.value); rebuild(); };
    controls.append(label);
  }
  const summary = document.createElement('p'); summary.className = 'readout';
  const detail = document.createElement('p'); detail.className = 'readout note';
  detail.setAttribute('role', 'status'); detail.setAttribute('aria-live', 'polite');
  el.append(split, controls, summary, detail);

  function rebuild() {
    stop();
    tree = searchTree(g, { budget, ghost, lazy });
    nodes = [];
    (function index(n, parent, depth) {
      n.parent = parent; n.depth = depth; nodes.push(n);
      n.leaves = 0;
      for (const c of n.children || []) { index(c, n, depth + 1); n.leaves += c.leaves; }
      if (!n.children) n.leaves = 1;
    })(tree.root, null, 0);
    shown = nodes.length;
    if (orderB) orderB.textContent = lazy ? 'Decide in a fixed order instead' : 'Decide mirrors when light reaches them';
    if (sliderOut) sliderOut.textContent = `${budget} flip${budget === 1 ? '' : 's'}`;
    const used = new Set(nodes.map((n) => (n.children ? n.choice : n.outcome)));
    legend.innerHTML = LEGEND.filter(([k]) => used.has(k) || (k === 'over' && used.has('skip')))
      .map(([k, t]) => `<span><i style="background:${FILL[k]}"></i>${t}</span>`).join('');
    writeSummary();
    select(nodes[0]);
  }

  // The board position at a node: every decision on the path from the root.
  function decidedAt(n) {
    const d = allUndecided(g);
    for (let p = n; p.parent; p = p.parent) d[p.parent.mirror] = g.cells[p.parent.mirror].rot ^ (p.choice === 'flip' ? 1 : 0);
    // a node at the budget limit, or a finished one: undecided mirrors stay as they are
    if (['solved', 'over', 'fail'].includes(n.outcome)) {
      const s = startState(g);
      d.forEach((v, i) => { if (v === UNDECIDED && s[i] !== UNDECIDED) d[i] = s[i]; });
    }
    return d;
  }

  function select(n) {
    selected = n;
    bview.redraw(); drawTree(); describe(n);
  }
  bview.setDraw(() => {
    if (!selected) return;
    const n = selected.outcome === 'skip' ? selected.parent : selected;
    drawBoard(bview.canvas, g, decidedAt(n), { focus: n.children ? n.mirror : -1, ghosts: ghost, fadeUnreached: ghost });
  });

  const ROW = 24;
  function drawTree() {
    const css = tcanvas.getBoundingClientRect().width || 300, dpr = devicePixelRatio || 1;
    const depth = Math.max(...nodes.map((n) => n.depth)) + 1;
    const W = Math.round(css * dpr), H = Math.round(depth * ROW * dpr);
    if (tcanvas.width !== W || tcanvas.height !== H) { tcanvas.width = W; tcanvas.height = H; }
    const ctx = tcanvas.getContext('2d');
    ctx.fillStyle = '#0d1017'; ctx.fillRect(0, 0, W, H);
    const unit = W / tree.root.leaves, rh = ROW * dpr;
    let x0 = 0;
    (function layout(n, x) {
      n.x = x; n.w = n.leaves * unit;
      let cx = x;
      for (const c of n.children || []) { layout(c, cx); cx += c.w; }
    })(tree.root, x0);
    ctx.font = `${11 * dpr}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let k = 0; k < shown; k++) {
      const n = nodes[k];
      const leaf = !n.children;
      const fill = leaf ? FILL[n.outcome] || FILL.fail : n.choice ? FILL[n.choice] : FILL.root;
      const gap = n.w > 3 * dpr ? dpr : 0;
      ctx.fillStyle = fill;
      ctx.fillRect(n.x + gap / 2, n.depth * rh + dpr, Math.max(n.w - gap, 0.6), rh - 2 * dpr);
      if (leaf && n.outcome === 'skip') {
        ctx.strokeStyle = FILL.over; ctx.lineWidth = dpr;
        ctx.strokeRect(n.x + gap / 2 + dpr / 2, n.depth * rh + 1.5 * dpr, Math.max(n.w - gap - dpr, 0.6), rh - 3 * dpr);
      }
      if (n.w > 38 * dpr) {
        ctx.fillStyle = '#e6eaf0';
        const label = !n.choice ? 'start' : leaf && n.outcome !== 'branch' ? { solved: '✓', fail: '✗', over: 'budget', skip: 'budget', ghost: 'ghost', cut: '…' }[n.outcome] : n.choice;
        ctx.fillText(label, n.x + n.w / 2, n.depth * rh + rh / 2);
      }
    }
    if (selected) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * dpr;
      ctx.strokeRect(selected.x + dpr, selected.depth * rh + dpr, Math.max(selected.w - 2 * dpr, 2 * dpr), rh - 2 * dpr);
    }
  }
  new ResizeObserver(() => drawTree()).observe(tcanvas);

  // "column 3, row 2", counted from the top left
  const where = (i) => `column ${i % g.w + 1}, row ${Math.floor(i / g.w) + 1}`;
  function describe(n) {
    const path = [];
    for (let p = n; p.parent; p = p.parent) path.unshift(p);
    const flips = path.filter((p) => p.choice === 'flip' && p.outcome !== 'skip').length;
    const head = path.length
      ? `Decisions so far: ${path.length} (${flips} flip${flips === 1 ? '' : 's'}). Last: ${n.choice} the mirror at ${where(n.parent.mirror)}. `
      : 'The start: nothing decided yet. ';
    const B = budget;
    const what = {
      branch: lazy ? 'Light reaches an undecided mirror (outlined). The search tries keeping it, then flipping it.'
        : 'The next mirror in the fixed order is outlined. The search tries keeping it, then flipping it.',
      solved: `Every target is lit, with ${flips} flip${flips === 1 ? '' : 's'}.`,
      fail: lazy ? 'No light reaches any undecided mirror, and a target is still dark. Dead end.'
        : 'Every mirror is decided, and a target is still dark. Dead end.',
      over: `The budget of ${B} flips is spent, so every other mirror must stay as it is, and then a target is dark. Dead end.`,
      skip: `Flipping here would take ${flips + 1} flips, over the budget of ${B}. The search doesn't even look.`,
      ghost: 'Even ghost light, going both ways through every undecided mirror, can\'t reach every target. Nothing below this point can work, so the search skips all of it.',
      cut: 'The tree is too big to draw past this point.',
    }[n.outcome];
    detail.textContent = head + what;
  }

  function writeSummary() {
    const looked = nodes.filter((n) => n.outcome !== 'skip').length;
    const sols = nodes.filter((n) => n.outcome === 'solved');
    let s = `<span class="num">${looked.toLocaleString('en-US')}</span> positions looked at. `;
    if (budget === Infinity) {
      const best = Math.min(...sols.map((n) => n.flips.length));
      s += sols.length ? `Best solution found: <span class="num">${best}</span> flips.` : 'No solution.';
    } else if (sols.length) {
      s += `<span class="good">Found a solution with ${sols[0].flips.length} flips</span>, within the budget of ${budget}.`;
    } else {
      s += `<span class="bad">No solution with ${budget} or fewer flips.</span> Every branch ran out. The finished tree is the proof.`;
    }
    summary.innerHTML = s;
  }

  // Animation: reveal nodes in the order the search visits them (depth first: keep before flip).
  function run() {
    if (timer) { stop(); return; }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { shown = nodes.length; select(nodes[0]); return; }
    if (shown >= nodes.length) shown = 0;
    runB.textContent = 'Pause';
    const per = Math.max(1, Math.ceil(nodes.length / 120));
    timer = setInterval(() => { for (let k = 0; k < per; k++) if (!step(true)) { stop(); break; } }, nodes.length > 200 ? 30 : 140);
  }
  function stop() { clearInterval(timer); timer = null; runB.textContent = 'Watch the search'; }
  function step(fromTimer) {
    if (!fromTimer) stop();
    if (shown >= nodes.length) shown = 0;
    shown++;
    select(nodes[shown - 1]);
    return shown < nodes.length;
  }

  tcanvas.addEventListener('click', (e) => {
    const r = tcanvas.getBoundingClientRect(), dpr = tcanvas.width / r.width;
    const px = (e.clientX - r.left) * dpr, depth = Math.floor((e.clientY - r.top) / ROW);
    // exact hit, or else the nearest box in that row within ~12px (tiny boxes are hard to tap)
    const row = nodes.slice(0, shown).filter((n) => n.depth === depth);
    const dist = (n) => (px < n.x ? n.x - px : px >= n.x + n.w ? px - (n.x + n.w) : 0);
    const near = row.sort((a, b) => dist(a) - dist(b))[0];
    const hit = near && dist(near) <= 12 * dpr ? near : null;
    if (hit) { stop(); select(hit); }
  });
  tcanvas.addEventListener('keydown', (e) => {
    const vis = nodes.slice(0, shown), n = selected;
    let next = null;
    if (e.key === 'ArrowUp') next = n.parent;
    else if (e.key === 'ArrowDown') next = (n.children || []).find((c) => vis.includes(c));
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const row = vis.filter((m) => m.depth === n.depth).sort((a, b) => a.x - b.x);
      next = row[row.indexOf(n) + (e.key === 'ArrowLeft' ? -1 : 1)];
    } else return;
    e.preventDefault();
    if (next) { stop(); select(next); }
  });

  rebuild();
  return { par };
}

function button(text, fn) {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.onclick = fn; return b;
}

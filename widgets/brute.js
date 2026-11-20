// Section 2, "Just try everything?": brute-force the hook puzzle live, then show how
// the exhaustive list explodes with mirror count. DOM work happens only inside mount();
// the imports and helpers at top level are DOM-free, so node can import this file.
import { board } from '../src/boards.js';
import { isSolved, cloneGrid } from '../src/engine.js';
import { makeCanvas, drawBoard, startState, isMirror, COLORS } from '../src/view.js';

// 1,024 -> "1,024"; at 1e12 and up, scientific: "1.2 × 10^18" (2 significant figures).
export function formatBig(n) {
  if (n < 1e12) return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const e = Math.floor(Math.log10(n));
  const m = Math.round((n / 10 ** e) * 10) / 10;
  return m >= 10 ? `1 × 10^${e + 1}` : `${m} × 10^${e}`;
}

const YEAR = 365.25 * 86400;
// Round to 2 significant figures for values of 100 and up, to the nearest integer below.
const round2sf = (x) => {
  if (x < 100) return Math.round(x);
  const p = 10 ** (Math.floor(Math.log10(x)) - 1);
  return Math.round(x / p) * p;
};

// "under a second", "3 seconds", "16 days", "45,000 years"; past a billion years,
// "about 47 billion years", noting the universe's age once a duration passes it.
export function formatDuration(seconds) {
  if (!(seconds >= 1)) return 'under a second';
  for (const [size, name] of [[YEAR, 'year'], [86400, 'day'], [3600, 'hour'], [60, 'minute'], [1, 'second']]) {
    if (seconds < size) continue;
    const v = seconds / size;
    if (name === 'year' && v > 1e9) {
      const b = v / 1e9;
      const s = b < 10 ? String(Math.round(b * 10) / 10) : formatBig(round2sf(b));
      return `about ${s} billion years` + (v > 13.8e9 ? ' (the universe is 13.8 billion years old)' : '');
    }
    const n = round2sf(v);
    return `${formatBig(n)} ${name}${n === 1 ? '' : 's'}`;
  }
}

const MIRROR_COUNTS = [10, 20, 30, 40, 50, 60, 80, 100];

export function mount(el) {
  const num = (s) => {
    const sp = document.createElement('span');
    sp.className = 'num';
    sp.textContent = s;
    return sp;
  };
  const txt = (s) => document.createTextNode(s);

  // ---- Part A: check every one of the 1,024 flip sets ----
  const g = board('hook');
  const mirrors = g.cells.map((c, i) => (isMirror(c) ? i : -1)).filter((i) => i >= 0);
  const total = 2 ** mirrors.length;
  const decided = startState(g); // mask 0: every mirror kept as it is
  const testGrid = cloneGrid(g);
  // Apply flip set m to a decided array (for drawing) or to the test grid's rots.
  const setMask = (m, set) => {
    for (let j = 0; j < mirrors.length; j++) set(mirrors[j], g.cells[mirrors[j]].rot ^ ((m >> j) & 1));
  };
  const checkMask = (m) => {
    let flips = 0;
    setMask(m, (i, rot) => { testGrid.cells[i].rot = rot; });
    for (let j = 0; j < mirrors.length; j++) flips += (m >> j) & 1;
    return { works: isSolved(testGrid), flips };
  };

  const view = makeCanvas(g, { label: 'The hook puzzle: 6 by 6 grid, 10 mirrors, 2 targets' });
  view.setDraw(() => drawBoard(view.canvas, g, decided));
  const controls = document.createElement('div');
  controls.className = 'controls';
  const runBtn = document.createElement('button'); runBtn.classList.add('primary');
  runBtn.type = 'button';
  runBtn.textContent = `Check all ${formatBig(total)} ways`;
  controls.append(runBtn);
  const readoutA = document.createElement('div');
  readoutA.className = 'readout';
  readoutA.setAttribute('role', 'status');
  readoutA.setAttribute('aria-live', 'polite');

  // One tiny cell per flip set: 32 x 32. Grey = fails, green = lights every target.
  const SIDE = 32;
  const cells = document.createElement('canvas');
  const dpr = Math.min(devicePixelRatio || 1, 3);
  cells.width = cells.height = SIDE * 10 * dpr;
  cells.className = 'bf-cells';
  cells.setAttribute('role', 'img');
  cells.setAttribute('aria-label', `One small square per flip set, ${formatBig(total)} in all. Grey means a target stays dark, green means every target is lit.`);
  const cctx = cells.getContext('2d');
  const cw = cells.width / SIDE;
  const gap = Math.max(1, cw * 0.12);
  const clearCells = () => {
    cctx.fillStyle = COLORS.bg; cctx.fillRect(0, 0, cells.width, cells.height);
    cctx.fillStyle = '#20262f';
    for (let m = 0; m < total; m++) cctx.fillRect((m % SIDE) * cw + gap / 2, Math.floor(m / SIDE) * cw + gap / 2, cw - gap, cw - gap);
  };
  const paintCell = (m, works) => {
    cctx.save();
    if (works) { cctx.shadowColor = COLORS.lit; cctx.shadowBlur = cw * 0.8; }
    cctx.fillStyle = works ? COLORS.lit : '#4b5363';
    cctx.fillRect((m % SIDE) * cw + gap / 2, Math.floor(m / SIDE) * cw + gap / 2, cw - gap, cw - gap);
    cctx.restore();
  };
  clearCells();
  const cellsNote = document.createElement('div');
  cellsNote.className = 'note';
  cellsNote.textContent = `One cell per flip set, checked in order. Grey: some target stays dark. Green: every target lit.`;

  readoutA.replaceChildren(
    txt(`${mirrors.length} mirrors, each kept or flipped: `), num(formatBig(total)), txt(` ways to set the board.`),
  );

  let next = 0, works = 0, minFlips = Infinity, bestMask = 0;
  const showProgress = () => {
    readoutA.replaceChildren(
      txt('Checked '), num(formatBig(next)), txt(` of ${formatBig(total)}. Working: `), num(formatBig(works)),
      txt('. Fewest flips among them: '), works ? num(String(minFlips)) : txt('none yet'), txt('.'),
    );
  };
  const showFinal = () => {
    readoutA.replaceChildren(
      txt(`All ${formatBig(total)} checked. `), num(formatBig(works)),
      txt(' of them light every target, and the fewest flips any of them uses is '), num(String(minFlips)),
      txt(`. So no solution with ${minFlips - 1} or fewer flips exists: that's a proof, by exhaustion.`),
    );
  };
  const step = () => {
    const r = checkMask(next);
    if (r.works) {
      works++;
      if (r.flips < minFlips) { minFlips = r.flips; bestMask = next; }
    }
    paintCell(next, r.works);
    setMask(next, (i, rot) => { decided[i] = rot; });
    next++;
  };
  const finish = () => {
    setMask(bestMask, (i, rot) => { decided[i] = rot; });
    view.redraw();
    showFinal();
    runBtn.disabled = false;
    runBtn.textContent = 'Run again';
  };
  runBtn.addEventListener('click', () => {
    next = 0; works = 0; minFlips = Infinity; bestMask = 0;
    clearCells();
    runBtn.disabled = true;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      while (next < total) step();
      finish();
      return;
    }
    showProgress();
    const t0 = performance.now();
    const frame = (t) => {
      const upto = Math.min(total, Math.round(((t - t0) / 2500) * total));
      while (next < upto) step();
      view.redraw();
      showProgress();
      if (next >= total) finish();
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  el.append(view.canvas, controls, readoutA, cells, cellsNote);

  // ---- Part B: how the list grows ----
  const partB = document.createElement('div');
  partB.style.marginTop = '18px';
  const controlsB = document.createElement('div');
  controlsB.className = 'controls';
  const label = document.createElement('label');
  const countNum = num(String(MIRROR_COUNTS[0]));
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = String(MIRROR_COUNTS.length - 1);
  slider.step = '1';
  slider.value = '0';
  slider.style.flex = '1';
  label.append(txt('Mirrors on the board: '), countNum, slider);
  controlsB.append(label);
  const readoutB = document.createElement('div');
  readoutB.className = 'readout';
  readoutB.setAttribute('role', 'status');
  readoutB.setAttribute('aria-live', 'polite');
  const rateNote = document.createElement('div');
  rateNote.className = 'note';

  // Measure this device's check speed once, for about 60 ms, with random mirror settings.
  let n = 0;
  const t0 = performance.now();
  while (performance.now() - t0 < 60) {
    for (const i of mirrors) testGrid.cells[i].rot = Math.random() < 0.5 ? 0 : 1;
    isSolved(testGrid);
    n++;
  }
  const rate = Math.max(1, round2sf(n / ((performance.now() - t0) / 1000)));
  rateNote.textContent = 'Check speed measured on this device when the page loaded.';

  const updateB = () => {
    const count = MIRROR_COUNTS[Number(slider.value)];
    countNum.textContent = String(count);
    const ways = 2 ** count;
    readoutB.replaceChildren(
      txt('2'), Object.assign(document.createElement('sup'), { textContent: String(count) }), txt(' = '), num(formatBig(ways)), txt(' ways. At '), num(formatBig(rate)),
      txt(' checks a second, that takes '), txt(formatDuration(ways / rate)), txt('.'),
    );
    readoutB.innerHTML = readoutB.innerHTML.replace(/10\^(\d+)/g, '10<sup>$1</sup>');
  };
  slider.addEventListener('input', updateB);
  updateB();
  partB.append(controlsB, readoutB, rateNote);
  el.append(partB);
}

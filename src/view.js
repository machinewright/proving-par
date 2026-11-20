// Shared canvas board renderer for the essay's widgets.
// state.decided[i]: the mirror's rot, or UNDECIDED (-1): drawn as an X that sends light both ways.
// A mirror whose decided rot differs from the board's starting rot is drawn as "flipped" (blue).
import { MIRROR, TARGET, WALL, EMITTER, DX, DY } from './engine.js';
import { traceGhost, UNDECIDED } from './ghost.js';

export const COLORS = {
  bg: '#12161f', grid: '#232a36', beam: '#ffd166', ghost: 'rgba(255,209,102,0.5)', wall: '#3a4252',
  mirror: '#d8dee9', flipped: '#8ec9ff', undecided: '#8b93a1', lit: '#7ef0a8', dead: '#ff8a80', focus: '#ffffff',
};

export const isMirror = (c) => c.type === MIRROR && !c.fixed;
export const startState = (g) => Int8Array.from(g.cells, (c) => (isMirror(c) ? c.rot : UNDECIDED));
export const allUndecided = (g) => new Int8Array(g.cells.length).fill(UNDECIDED);
export const flipCount = (g, d) => g.cells.reduce((n, c, i) => n + (isMirror(c) && d[i] !== UNDECIDED && d[i] !== c.rot ? 1 : 0), 0);

// Returns the trace so callers can describe the state in text.
export function drawBoard(canvas, g, decided, { focus = -1, fadeUnreached = true, ghosts = true } = {}) {
  // ghosts=false: show only certain light; undecided mirrors are drawn faintly in their starting tilt.
  const ctx = canvas.getContext('2d');
  const W = canvas.width, cell = W / g.w, cx = (x) => (x + 0.5) * cell, cy = (y) => (y + 0.5) * cell;
  const t = traceGhost(g, decided);
  // with every mirror decided there's no "might": an unlit target is just unlit, not ruled out
  if (!g.cells.some((c, i) => isMirror(c) && decided[i] === UNDECIDED)) ghosts = false;
  ctx.fillStyle = COLORS.bg; ctx.fillRect(0, 0, W, canvas.height);
  ctx.strokeStyle = COLORS.grid; ctx.lineWidth = Math.max(1, cell * 0.012);
  for (let i = 1; i < g.w; i++) { ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, g.h * cell); ctx.stroke(); }
  for (let i = 1; i < g.h; i++) { ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(W, i * cell); ctx.stroke(); }
  ctx.lineCap = 'round';
  const line = (s) => { ctx.beginPath(); ctx.moveTo(cx(s.x1), cy(s.y1)); ctx.lineTo(cx(s.x2), cy(s.y2)); ctx.stroke(); };
  ctx.strokeStyle = COLORS.ghost; ctx.lineWidth = Math.max(1.5, cell * 0.04); ctx.setLineDash([cell * 0.09, cell * 0.09]);
  if (ghosts) t.segments.filter((s) => s.ghost).forEach(line);
  ctx.setLineDash([]);
  for (const [w, a] of [[0.26, 0.12], [0.13, 0.25], [0.055, 1]]) {
    ctx.globalAlpha = a; ctx.lineWidth = Math.max(1.5, cell * w); ctx.strokeStyle = COLORS.beam;
    t.segments.filter((s) => !s.ghost).forEach(line);
  }
  ctx.globalAlpha = 1;
  g.cells.forEach((c, i) => {
    const x = i % g.w, y = Math.floor(i / g.w), px = cx(x), py = cy(y), r = cell * 0.34;
    if (c.type === WALL) { // a raised block: lit top edge, shaded bottom, faint brick seams
      const m = cell * 0.07, x0 = x * cell + m, y0 = y * cell + m, s = cell - 2 * m, rr = cell * 0.08;
      ctx.fillStyle = '#2e3646'; roundRect(ctx, x0, y0, s, s, rr); ctx.fill();
      ctx.fillStyle = '#3b4456'; roundRect(ctx, x0, y0, s, s * 0.82, rr); ctx.fill();
      ctx.strokeStyle = 'rgba(18,22,31,0.55)'; ctx.lineWidth = Math.max(1, cell * 0.025);
      ctx.beginPath(); ctx.moveTo(x0, y0 + s * 0.41); ctx.lineTo(x0 + s, y0 + s * 0.41);
      ctx.moveTo(x0 + s * 0.5, y0); ctx.lineTo(x0 + s * 0.5, y0 + s * 0.41);
      ctx.moveTo(x0 + s * 0.25, y0 + s * 0.41); ctx.lineTo(x0 + s * 0.25, y0 + s * 0.82);
      ctx.moveTo(x0 + s * 0.75, y0 + s * 0.41); ctx.lineTo(x0 + s * 0.75, y0 + s * 0.82); ctx.stroke();
    }
    else if (c.type === EMITTER) { // a lamp: dark housing with a glowing lens on the side the light leaves
      const d = c.dir, h = cell * 0.3;
      ctx.fillStyle = '#2a3140'; roundRect(ctx, px - h, py - h, 2 * h, 2 * h, cell * 0.08); ctx.fill();
      ctx.strokeStyle = '#4a5468'; ctx.lineWidth = Math.max(1, cell * 0.02); ctx.stroke();
      const tip = r * 0.95, back = r * 0.15, wide = r * 0.62;
      ctx.save(); ctx.shadowColor = COLORS.beam; ctx.shadowBlur = cell * 0.25;
      ctx.fillStyle = COLORS.beam; ctx.beginPath();
      ctx.moveTo(px + DX[d] * tip, py + DY[d] * tip);
      ctx.lineTo(px - DX[d] * back + DX[(d + 1) % 4] * wide, py - DY[d] * back + DY[(d + 1) % 4] * wide);
      ctx.lineTo(px - DX[d] * back + DX[(d + 3) % 4] * wide, py - DY[d] * back + DY[(d + 3) % 4] * wide);
      ctx.closePath(); ctx.fill(); ctx.restore();
    } else if (c.type === TARGET) { // a socket: dark well, ring, and a core that glows green when lit
      const real = t.litReal.has(i), maybe = ghosts ? t.lit.has(i) : true;
      const ring = real ? COLORS.lit : !ghosts ? '#9aa3b2' : maybe ? COLORS.beam : COLORS.dead;
      ctx.fillStyle = '#0b0e14'; ctx.beginPath(); ctx.arc(px, py, r * 0.78, 0, 7); ctx.fill();
      ctx.save();
      if (real) { ctx.shadowColor = COLORS.lit; ctx.shadowBlur = cell * 0.35; }
      ctx.lineWidth = cell * 0.065; ctx.strokeStyle = ring;
      ctx.setLineDash(!real && ghosts && maybe ? [cell * 0.08, cell * 0.06] : []);
      ctx.beginPath(); ctx.arc(px, py, r * 0.7, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = real ? COLORS.lit : ring; ctx.globalAlpha = real ? 1 : 0.55;
      ctx.beginPath(); ctx.arc(px, py, r * (real ? 0.36 : 0.16), 0, 7); ctx.fill();
      ctx.restore();
      if (!maybe) { // no beam, not even a ghost, reaches it: cross it out
        ctx.strokeStyle = COLORS.dead; ctx.lineWidth = cell * 0.06; ctx.beginPath();
        ctx.moveTo(px - r * 0.42, py - r * 0.42); ctx.lineTo(px + r * 0.42, py + r * 0.42); ctx.stroke();
      }
    } else if (isMirror(c)) {
      const d = decided[i];
      const stroke = (rot, alpha, width) => {
        const s = rot === 0 ? -1 : 1; ctx.globalAlpha = alpha; ctx.lineWidth = width;
        ctx.beginPath(); ctx.moveTo(px - r, py - s * r); ctx.lineTo(px + r, py + s * r); ctx.stroke(); ctx.globalAlpha = 1;
      };
      const far = fadeUnreached && !t.reached.has(i) ? 0.3 : 1;
      if (d === UNDECIDED && !ghosts) { ctx.strokeStyle = COLORS.undecided; stroke(c.rot, 0.45, cell * 0.06); }
      else if (d === UNDECIDED) { ctx.strokeStyle = COLORS.undecided; stroke(0, 0.6 * far, cell * 0.05); stroke(1, 0.6 * far, cell * 0.05); }
      else {
        const flipped = d !== c.rot;
        ctx.strokeStyle = flipped ? COLORS.flipped : COLORS.mirror; stroke(d, far, cell * 0.09);
        if (flipped) { ctx.fillStyle = COLORS.flipped; ctx.beginPath(); ctx.arc(x * cell + cell * 0.84, y * cell + cell * 0.16, cell * 0.065, 0, 7); ctx.fill(); }
      }
    }
    if (i === focus) {
      ctx.strokeStyle = COLORS.focus; ctx.lineWidth = Math.max(2, cell * 0.04); ctx.setLineDash([cell * 0.1, cell * 0.06]);
      ctx.strokeRect(x * cell + cell * 0.05, y * cell + cell * 0.05, cell * 0.9, cell * 0.9); ctx.setLineDash([]);
    }
  });
  return t;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// A responsive, crisp canvas for a board, with click/tap and keyboard cursor support.
// onActivate(i) is called with the cell index when a cell is clicked or Enter/Space is pressed.
export function makeCanvas(g, { label, onActivate } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'board';
  canvas.setAttribute('role', 'img');
  if (label) canvas.setAttribute('aria-label', label);
  let redraw = () => {};
  let cursor = -1;
  const fit = () => {
    const css = canvas.getBoundingClientRect().width || 300, dpr = devicePixelRatio || 1;
    const w = Math.round(css * dpr);
    const h = Math.round(w * g.h / g.w);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    redraw();
  };
  new ResizeObserver(fit).observe(canvas);
  if (onActivate) {
    canvas.tabIndex = 0;
    canvas.style.cursor = 'pointer';
    canvas.addEventListener('click', (e) => {
      const r = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - r.left) / r.width * g.w), y = Math.floor((e.clientY - r.top) / r.height * g.h);
      if (x >= 0 && y >= 0 && x < g.w && y < g.h) { cursor = -1; onActivate(y * g.w + x); }
    });
    canvas.addEventListener('keydown', (e) => {
      const mirrors = g.cells.map((c, i) => (isMirror(c) ? i : -1)).filter((i) => i >= 0);
      if (cursor < 0) cursor = mirrors[0];
      const x = cursor % g.w, y = Math.floor(cursor / g.w);
      const move = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key];
      if (move) {
        e.preventDefault();
        // jump to the nearest mirror in that direction
        let bestI = cursor, bestD = Infinity;
        for (const m of mirrors) {
          const dx = m % g.w - x, dy = Math.floor(m / g.w) - y;
          const along = dx * move[0] + dy * move[1], across = Math.abs(dx * move[1] + dy * move[0]);
          if (along > 0 && along + 2 * across < bestD) { bestD = along + 2 * across; bestI = m; }
        }
        cursor = bestI; redraw();
      } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(cursor); }
    });
    canvas.addEventListener('blur', () => { cursor = -1; redraw(); });
  }
  return {
    canvas,
    get cursor() { return cursor; },
    setDraw(fn) { redraw = fn; fit(); },
    redraw: () => redraw(),
  };
}

// Seeded procedural level generator. Builds a solved board, then scrambles it,
// so every generated level is solvable by construction (verified with trace()).
import {
  makeGrid, at, inBounds, trace, isSolved, reflect, cloneGrid,
  DX, DY, EMPTY, WALL, EMITTER, MIRROR, TARGET, SPLITTER, FILTER,
} from './engine.js';
import { solve } from './solver.js';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Difficulty level (1..) -> generator parameters.
export function paramsFor(level) {
  const L = Math.max(1, level);
  const size = Math.min(5 + Math.floor((L - 1) / 3), 10);
  // Past level 22 (the hardest daily) the board is full size, so difficulty keeps climbing
  // through longer routes, a 4th emitter, more splitters and more decoys instead.
  const late = Math.max(0, L - 22);
  return {
    w: size,
    h: size,
    emitters: L < 4 ? 1 : L < 13 ? 2 : L < 34 ? 3 : 4,
    colors: L < 12 ? 1 : L < 20 ? 2 : 3, // emitter e gets color e % colors
    filters: L < 14 ? 0 : Math.min(1 + Math.floor((L - 14) / 6), 3),
    turns: Math.min(2 + Math.floor(L / 2), 7) + Math.min(Math.floor(late / 6), 2),
    splitters: L < 6 ? 0 : Math.min(1 + Math.floor((L - 6) / 4), 3) + (late >= 8 ? 1 : 0),
    decoys: Math.min(Math.floor(L / 2) + 1, 10) + Math.min(Math.floor(late / 4), 4),
    walls: Math.min(Math.floor(L / 3), 8),
    candidates: 1 + Math.min(Math.floor(late / 6), 3),
  };
}

const ri = (r, n) => Math.floor(r() * n);
const pick = (r, arr) => arr[ri(r, arr.length)];

// rot that turns a beam travelling `from` into `to` (must be perpendicular).
function rotFor(from, to) {
  return reflect(0, from) === to ? 0 : 1;
}

function tryBuild(r, p) {
  const g = makeGrid(p.w, p.h);
  const idx = (x, y) => y * g.w + x;
  const beam = new Set(); // cells a beam passes through in the solution
  const beamColors = new Map(); // cell -> bitmask of solution beam colors through it
  const isFree = (x, y) => inBounds(g, x, y) && at(g, x, y).type === EMPTY;
  let splittersLeft = p.splitters;
  let color = 0; // color of the emitter currently being routed

  // Free stopping cells reachable from (x,y) heading dir.
  function stopsFrom(x, y, dir) {
    const stops = [];
    for (let cx = x + DX[dir], cy = y + DY[dir]; inBounds(g, cx, cy); cx += DX[dir], cy += DY[dir]) {
      if (at(g, cx, cy).type !== EMPTY) break; // can't pass through pieces
      if (!beam.has(idx(cx, cy))) stops.push([cx, cy]);
    }
    return stops;
  }

  function mark(x, y, dir, sx, sy) {
    for (let tx = x + DX[dir], ty = y + DY[dir]; ; tx += DX[dir], ty += DY[dir]) {
      beam.add(idx(tx, ty));
      beamColors.set(idx(tx, ty), (beamColors.get(idx(tx, ty)) ?? 0) | (1 << color));
      if (tx === sx && ty === sy) break;
    }
  }

  // Walk a beam from (x,y) heading dir, placing up to `turns` pieces then a target.
  // If the path gets boxed in, it ends early on a target rather than failing.
  function walk(x, y, dir, turns) {
    for (;;) {
      const stops = stopsFrom(x, y, dir);
      if (!stops.length) return false;
      // prefer stops from which the beam can still turn somewhere
      const turnable = turns > 0
        ? stops.filter(([sx, sy]) => [1, 3].some((k) => {
            const nd = (dir + k) % 4;
            return stopsFrom(sx, sy, nd).some(([a, b]) => !(a === sx && b === sy));
          }))
        : [];
      const [sx, sy] = pick(r, turnable.length ? turnable : stops);
      mark(x, y, dir, sx, sy);
      if (turns <= 0 || !turnable.length) {
        Object.assign(at(g, sx, sy), { type: TARGET, color });
        return true;
      }
      const options = [1, 3].map((k) => (dir + k) % 4).filter((nd) => stopsFrom(sx, sy, nd).length);
      const nd = pick(r, options);
      const rot = rotFor(dir, nd);
      const canSplit = splittersLeft > 0 && stopsFrom(sx, sy, dir).length > 0;
      if (canSplit && r() < 0.4) {
        splittersLeft--;
        Object.assign(at(g, sx, sy), { type: SPLITTER, rot });
        // the straight-through branch also needs to end on a target
        if (!walk(sx, sy, dir, Math.max(0, Math.floor(turns / 2) - 1))) return false;
        // the straight branch may have claimed the cells we wanted to turn into
        if (!stopsFrom(sx, sy, nd).length) return false;
      } else {
        Object.assign(at(g, sx, sy), { type: MIRROR, rot });
      }
      x = sx; y = sy; dir = nd; turns--;
    }
  }

  for (let e = 0; e < p.emitters; e++) {
    let placed = false;
    for (let tries = 0; tries < 20 && !placed; tries++) {
      const x = ri(r, g.w), y = ri(r, g.h);
      if (!isFree(x, y) || beam.has(idx(x, y))) continue;
      const dir = ri(r, 4);
      if (!isFree(x + DX[dir], y + DY[dir])) continue;
      color = e % (p.colors ?? 1);
      Object.assign(at(g, x, y), { type: EMITTER, dir, color });
      beam.add(idx(x, y));
      if (!walk(x, y, dir, p.turns - ri(r, 2))) return null;
      placed = true;
    }
    if (!placed) return null;
  }

  // Decoy mirrors and walls go on cells no solution beam touches.
  const freeCells = () => g.cells
    .map((c, i) => i)
    .filter((i) => g.cells[i].type === EMPTY && !beam.has(i));
  const decoys = new Set();
  for (let d = 0; d < p.decoys; d++) {
    const f = freeCells();
    if (!f.length) break;
    const i = pick(r, f);
    decoys.add(i);
    Object.assign(g.cells[i], { type: MIRROR, rot: ri(r, 2) });
  }
  for (let d = 0; d < p.walls; d++) {
    const f = freeCells();
    if (!f.length) break;
    g.cells[pick(r, f)].type = WALL;
  }

  // Filters sit on empty solution-beam cells crossed by exactly one color, matching it:
  // they never block the solution, but they rule out routes and hint where a color goes.
  const single = [1, 2, 4];
  const filterSpots = () => g.cells.map((c, i) => i)
    .filter((i) => g.cells[i].type === EMPTY && single.includes(beamColors.get(i)));
  for (let f = 0; f < (p.filters ?? 0); f++) {
    const spots = filterSpots();
    if (!spots.length) break;
    const i = pick(r, spots);
    Object.assign(g.cells[i], { type: FILTER, color: single.indexOf(beamColors.get(i)) });
  }

  if (!isSolved(g)) return null;
  return { g, decoys };
}

// Generate { puzzle, solution } for a seed and level.
export function generate(seed, level = 1) {
  const r = rng(seed);
  const p = paramsFor(level);
  // Late levels: build a few candidates from the same seed and keep the one with the highest par.
  // (Level 22 and below build one, so their puzzles are unchanged.)
  let pick = null;
  for (let k = 0; k < p.candidates; k++) {
    const c = generateOne(r, p, level, seed);
    if (!pick || (c.parExact && !pick.parExact) || (c.parExact === pick.parExact && c.par > pick.par)) pick = c;
  }
  return pick;
}

function generateOne(r, p, level, seed) {
  let fallback = null, inexact = 0;
  for (let attempt = 0; attempt < 500; attempt++) {
    const built = tryBuild(r, p);
    if (!built) continue;
    const { g: solution, decoys } = built;
    const par = (pz) => minMoves(pz, solution, decoys);
    const puzzle = cloneGrid(solution);
    const rotatable = puzzle.cells.filter((c) => c.type === MIRROR || c.type === SPLITTER);
    // scramble until unsolved (and not trivially close: flip at least ~half)
    for (let s = 0; s < 20; s++) {
      rotatable.forEach((c) => { c.rot = ri(r, 2); });
      if (!isSolved(puzzle) && par(puzzle) >= Math.min(2, rotatable.length - decoys.size)) break;
    }
    if (isSolved(puzzle)) continue;
    // exact par from the solver; the reference-solution diff is an upper bound / fallback
    const upper = par(puzzle);
    const exact = solve(puzzle, { limit: upper });
    const best = exact && exact.moves != null ? exact.moves : upper;
    if (best < Math.min(2, upper)) continue; // a 1-move puzzle is too easy; try again
    const level = { puzzle, solution, par: best, parExact: !!exact && !exact.exhausted, params: p };
    // Prefer levels whose par is proven optimal (so ★★★ really means "best possible");
    // after a few unprovable candidates, accept the first one rather than stall.
    if (level.parExact) return level;
    fallback ??= level;
    if (++inexact >= 5) return fallback;
  }
  if (fallback) return fallback;
  throw new Error(`could not generate level ${level} for seed ${seed}`);
}

// Non-decoy pieces that differ from the reference solution (an upper bound on optimal moves).
export function minMoves(puzzle, solution, decoys = new Set()) {
  let n = 0;
  puzzle.cells.forEach((c, i) => {
    if (decoys.has(i)) return;
    if ((c.type === MIRROR || c.type === SPLITTER) && c.rot !== solution.cells[i].rot) n++;
  });
  return n;
}

// Local calendar date as YYYY-MM-DD (the daily puzzle follows the player's own day).
export function dateKey(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

// Daily difficulty ramps through the week: Monday gentle, Sunday hardest (with colors).
const DAILY_LEVELS = [22, 8, 10, 12, 14, 16, 18]; // indexed by getDay(): 0 = Sunday
const DAILY_NAMES = ['Sunday challenge', 'gentle', 'easy', 'medium', 'medium', 'tricky', 'hard'];
export function dailyLevel(date = new Date()) {
  return { level: DAILY_LEVELS[date.getDay()], name: DAILY_NAMES[date.getDay()] };
}

// Consecutive days solved, ending today (or yesterday, if today isn't solved yet).
// `solvedKeys` is a collection of dateKey strings.
export function streak(solvedKeys, date = new Date()) {
  const have = new Set(solvedKeys);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (!have.has(dateKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (have.has(dateKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export function dailySeed(date = new Date()) {
  return hashString('beamwright-daily-' + dateKey(date));
}

// Essay helper: generate with explicit parameters (e.g. mirrors only, one color).
export function generateWith(seed, params) {
  return generateOne(rng(seed), { candidates: 1, ...params }, 0, seed);
}

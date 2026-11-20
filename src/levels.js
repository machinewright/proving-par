// Hand-made tutorial levels, written as ASCII maps of the *starting* (scrambled) board.
//   .  empty      #  wall       T  target
//   > v < ^  emitter facing that way
//   / \  mirror   P  splitter like '/'   Q  splitter like '\'
// `colors` optionally gives emitters/targets a non-default color: { 'x,y': color }.
// `filters` turns empty cells into color filters: { 'x,y': color }.
import { makeGrid, EMITTER, MIRROR, SPLITTER, TARGET, WALL, FILTER, EMPTY } from './engine.js';

export const TUTORIAL = [
  {
    hint: 'Click (or tap) the mirror to flip it, so the beam reaches the target ◯.',
    map: [
      '>../',
      '....',
      '....',
      '...T',
    ],
  },
  {
    hint: 'Beams can bounce off several mirrors. Not every mirror is part of the answer.',
    map: [
      'v..T.',
      '../..',
      '.....',
      '/..\\.',
      '.....',
    ],
  },
  {
    hint: 'Dashed splitters flip like mirrors. They reflect light AND let it pass straight through: one beam, two targets.',
    map: [
      '..T..',
      '.....',
      '>.Q./',
      '.....',
      '....T',
    ],
  },
  {
    hint: 'Walls block light. The puzzle is solved when every target is lit at the same time. Par (above the board) is the fewest moves possible: match it for ★★★.',
    map: [
      '>.../.',
      '..\\...',
      '.#..T.',
      'T..../',
      '..#...',
      '.....^',
    ],
  },
  {
    hint: 'Colors: ◯ amber, ▢ cyan. A target lights up only for a beam of its own color; any other beam just stops there.',
    map: [
      '...T./',
      '......',
      '>../..',
      '......',
      '.\\...^',
      '...T..',
    ],
    colors: { '3,0': 1, '5,4': 1 },
  },
  {
    hint: 'Tinted panes are filters: their own color passes through, any other color stops. See the cyan beam pass and the bottom amber beam stop.',
    map: [
      '......',
      '>/....',
      '>....T',
      './...T',
      '>.....',
      '......',
    ],
    colors: { '0,2': 1, '5,2': 1 },
    filters: { '2,2': 1, '2,4': 1 },
  },
];

const EMIT = { '^': 0, '>': 1, 'v': 2, '<': 3 };

export function parseMap(rows, colors = {}, filters = {}) {
  const g = makeGrid(rows[0].length, rows.length);
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const c = g.cells[y * g.w + x];
    if (ch in EMIT) Object.assign(c, { type: EMITTER, dir: EMIT[ch] });
    else if (ch === '/' || ch === '\\') Object.assign(c, { type: MIRROR, rot: ch === '/' ? 0 : 1 });
    else if (ch === 'P' || ch === 'Q') Object.assign(c, { type: SPLITTER, rot: ch === 'P' ? 0 : 1 });
    else if (ch === 'T') c.type = TARGET;
    else if (ch === '#') c.type = WALL;
    else if (ch !== '.') throw new Error(`bad map char ${ch}`);
  }));
  for (const [k, color] of Object.entries(colors)) {
    const [x, y] = k.split(',').map(Number);
    g.cells[y * g.w + x].color = color;
  }
  for (const [k, color] of Object.entries(filters)) {
    const [x, y] = k.split(',').map(Number);
    if (g.cells[y * g.w + x].type !== EMPTY) throw new Error(`filter on a non-empty cell ${k}`);
    Object.assign(g.cells[y * g.w + x], { type: FILTER, color });
  }
  return g;
}

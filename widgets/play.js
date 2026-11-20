// §1: play the hook puzzle. Click a mirror to flip it; the counter counts flips.
import { board, BOARDS } from '../src/boards.js';
import { makeCanvas, drawBoard, startState, flipCount, isMirror } from '../src/view.js';
import { solve } from '../src/solver.js';
import { targets } from '../src/engine.js';

export function mount(el) {
  const g = board('hook'), par = BOARDS.hook.par, goal = targets(g);
  let state = startState(g), moves = 0;
  const view = makeCanvas(g, { label: 'Puzzle: a 6 by 6 board with two light sources, two targets and ten mirrors. Click a mirror to flip it.', onActivate });
  const controls = document.createElement('div'); controls.className = 'controls';
  const reset = button('Start over', () => { state = startState(g); moves = 0; view.redraw(); });
  const reveal = button(`Show a ${par}-flip solution`, () => {
    state = startState(g);
    for (const i of solve(g).flips) state[i] ^= 1;
    moves = null; view.redraw();
  });
  const readout = document.createElement('p'); readout.className = 'readout'; readout.setAttribute('role', 'status'); readout.setAttribute('aria-live', 'polite');
  controls.append(reset, reveal);
  el.append(view.canvas, controls, readout);

  function onActivate(i) {
    if (!isMirror(g.cells[i])) return;
    if (moves === null) moves = 0; // continue from a revealed solution, counting new clicks
    state[i] ^= 1; moves++; view.redraw();
  }
  view.setDraw(() => {
    const t = drawBoard(view.canvas, g, state, { focus: view.cursor, fadeUnreached: false });
    const lit = goal.filter((i) => t.litReal.has(i)).length, net = flipCount(g, state);
    if (moves === null) {
      readout.innerHTML = `This is a solution with <span class="num">${par}</span> flips: the mirrors marked blue are the ones flipped.`;
    } else if (lit === goal.length) {
      readout.innerHTML = `Solved in <span class="num">${moves}</span> click${moves === 1 ? '' : 's'}`
        + (net !== moves ? ` (<span class="num">${net}</span> mirrors end up flipped)` : '') + '. '
        + (net <= par ? 'That is the best possible.' : `The best possible is <span class="num">${par}</span>.`);
    } else {
      readout.innerHTML = `Clicks: <span class="num">${moves}</span>. Targets lit: <span class="num">${lit}</span> of ${goal.length}.`;
    }
  });
}

function button(text, fn) {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.onclick = fn; return b;
}

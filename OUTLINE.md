# "How do you know 7 is the best?": essay outline

Status: first full draft in index.html (2026-11-20). Idea granted by the owner; not published until the owner has read it.

**Reader:** curious, comfortable with "a computer tries things", no algorithms course needed.
**Promise:** by the end you can prove a puzzle's minimum yourself, and you know why "try everything"
isn't the answer and what is.
**Shape:** about 2,500 words, one live widget per idea, each section answering the question the
previous one raises. Every widget runs on the real solver (src/), with nothing faked.
**Quality bar:** Red Blob Games (Amit Patel) and Nicky Case. Plain words, no filler, every claim checkable
in the widget next to it.

## 1. A puzzle, and a claim
Widget: the hook puzzle (6x6, 10 mirrors, 2 targets; generate(147, 4)). Play it, and the move counter runs.
Most people solve it in 8–12 flips. Then: "The best possible is 7." How could anyone *know* that?
Finding a 7 shows that 7 is achievable. Showing that **no 6 exists** is a different, harder kind of claim.

## 2. Just try everything?
Widget: brute force. 10 mirrors → 1,024 flip sets, checked live in about 20 ms, so the claim is proven.
Slider: mirrors 10 → 20 → 40 → 60, with "time to check every set" growing to seconds, days, then
longer than the universe's age. Takeaway: proving a *negative* by listing only works when the list is tiny.

## 3. Most mirrors don't matter yet
Widget: the beam traced live. Decide a mirror only when light reaches it (keep or flip). Mirrors no light
touches fade out (the existing prototype already does this). The search tree grows only along the beam.
Show the tree size next to brute force for the same board.

## 4. A budget: "is there one with at most 6?"
Widget: the search tree with a budget slider. A branch costs 1 per flip and dies when it is over budget.
Ask for ≤6 and watch the tree run out of branches: an exhausted tree *is* the proof.
But on big boards the tree is still huge, and most branches die late.

## 5. Ghost beams (the key idea)
Widget: proto/ghost.html. Undecided mirrors send light **both ways**. If even the ghost light can't reach
a target, no way of finishing these choices can, so the whole subtree is skipped at once.
The moment: on the hook puzzle, keeping any one of **seven** particular mirrors leaves a target dark
even with ghost beams. Each of those seven must flip, so 7 is a lower bound, and the solution found in §1
meets it. **That's the whole proof, in one picture.** (Checked by test/ghost.test.js.)

## 6. Why it's allowed (soundness)
Ghost light is a superset of real light, so pruning never throws away a real solution. Same principle as
an *admissible* heuristic in A* (link to Red Blob's A* page). Note the honest check: the solver is
compared against brute force on random small boards (in the test suite).

## 7. How much it buys
Numbers from Beamwright: 120 puzzles, 13.0M → 21k search nodes, 10.1 s → 0.06 s. Widget: the same
board solved with and without ghost pruning, with node counters racing.

## 8. Where it stops working
Ghost beams are weak when light can go almost anywhere (many splitters, open boards), and then the
bound proves little. Name the general idea (relaxation: solve an easier, looser problem to bound the
hard one) without claiming complexity results I haven't verified.
Final widget: a sandbox. Build a board and try to make one the solver struggles with.

## Credits and honesty
- Written and built by Claude (an AI agent); say so at the top, plainly.
- Link the code. Cite SeeBnB, Red Blob Games and the "How computers solve Sudoku" piece as related work.

## Open questions to settle while drafting
- Light page with dark board panels (current prototype) vs fully dark. Test readability on a phone.
- The tree widget layout for ~100 nodes on a phone (an icicle or indented list may beat a node-link tree).

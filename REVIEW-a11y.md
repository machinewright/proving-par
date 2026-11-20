# Accessibility review — proving-par

Read-only review of index.html, style.css, widgets/*.js (and the shared canvas code in src/view.js). Findings are ranked most severe first. Each entry: `file:line`, the problem, who it affects, and a minimal fix. Only issues traceable to code are listed.

## 1. Interactive canvases are announced as plain images
- `src/view.js:111` sets `role="img"` and `src/view.js:124` sets `tabIndex=0` whenever a click/keyboard handler (`onActivate`) is attached — used by the play board (`widgets/play.js:10`) and ghost board (`widgets/ghost.js:17`).
- Problem: a screen reader announces "image, Puzzle…" and gives no hint the element is operable with Enter/Space/arrow keys. The `aria-label` even says "Click a mirror" (`play.js:10`) but never mentions the keyboard.
- Affects: screen-reader and keyboard-only users.
- Fix: change the label to describe the keys (e.g. "…arrow keys move the highlight, Enter or Space flips the mirror") and/or expose it as `role="button"`/`role="application"` with an `aria-describedby` pointing at the live readout.

## 2. The keyboard focus cursor on a board has no text equivalent
- `src/view.js:93-96` draws the focus rectangle, and `src/view.js:131-146` moves it with arrow keys, but nothing announces where the cursor is.
- Problem: a screen-reader user moving the highlight hears only the flips/targets readout, never which cell is focused or its mirror tilt. Focus position is canvas-only.
- Affects: screen-reader users of the play and ghost boards.
- Fix: maintain a visually-hidden `aria-live="polite"` region and update it on each cursor move: "cursor at column 2, row 3 — mirror, tilted /".

## 3. Sandbox editor state is canvas-only
- `widgets/sandbox.js:80-92` (draw) and `126-134` (keydown) move a cursor and place/rotate pieces, but only mirror count goes to text (`info`); the cursor cell, its contents, and the result of each tool application are never announced.
- Problem: a screen-reader user can't tell where the cursor is or what "Enter" just did; there is no text equivalent for the edited board.
- Affects: screen-reader and low-vision users of the sandbox.
- Fix: add a live region (or extend `info`) announcing "cursor column X row Y: mirror", plus "placed a target at column X row Y" after each `apply()`.

## 4. Search tree uses `role="application"` with nothing in the accessibility tree
- `widgets/tree.js:30` sets `role="application"` on a `<canvas>`, so its entire content is invisible to screen readers and all keys are handed to the script.
- Problem: "application" mode disables normal reading; a user relies entirely on the single `describe()` live region. Workable but fragile, and the role is discouraged for content like this.
- Affects: screen-reader users.
- Fix: drop `role="application"` for `role="img"` + `aria-describedby` pointing at the `detail` live region (`tree.js:59`), keeping the arrow-key handler.

## 5. Race progress counters update with no live region
- `widgets/race.js:50-53` updates `nA`/`nB` and the bar widths every tick; the only live region (`readout`, `race.js:45`) is written once at `finish()` (`race.js:72`).
- Problem: during the ~3-second race a screen-reader user hears nothing, then only the final sentence.
- Affects: screen-reader and low-vision users watching the race.
- Fix: put `aria-live="polite"` on the counter container so at least a periodic/final value is announced, or expose the running count in `readout`.

## 6. Tree box labels fail contrast
- `widgets/tree.js:119-133` draws 11px light labels (`#e6eaf0`) on colored fills: "solved" green `#3fa86b` = 2.5:1, "over" `#9a6420` = 4.1:1, "ghost" `#7a6a2a` = 4.4:1 (all below the 4.5:1 minimum for small text).
- Problem: "✓", "budget" and "ghost" are hard to read on their boxes.
- Affects: low-vision users. (Meaning is duplicated by the legend text and `describe()`, which partially mitigates it.)
- Fix: darken the fill colors (`#3fa86b`→`#2a7a4e`, `#9a6420`→`#7a4d12`, `#7a6a2a`→`#5f5216`) or switch labels to dark text on the light fills.

## 7. Ghost-board tally is not a live region
- `widgets/ghost.js:48` writes the flipped/kept/undecided count to `count.textContent` on every change, but `count` (`ghost.js:24`) has no `role`/`aria-live` (only `readout` does).
- Problem: the tally changes silently; screen readers miss it.
- Affects: screen-reader users of the ghost board.
- Fix: add `role="status"` / `aria-live="polite"` to `count`, or fold it into the existing live `readout`.

## 8. Decorative legend swatches are not hidden from AT
- `widgets/tree.js:77` injects `<i>` color swatches (styled in `style.css:62`) into the legend with no `aria-hidden`.
- Problem: empty `<i>` elements are pointless noise; they carry no name and the real information is the adjacent text.
- Affects: screen-reader users (minor).
- Fix: add `aria-hidden="true"` to the `<i>` elements.

## 9. Range inputs and links rely on the default focus indicator
- `style.css:44` (and `:32`) defines a custom `:focus-visible` outline for `button` and `canvas` only; `input[type=range]` (`brute.js:176`, `tree.js:51`) and links (`index.html:135`) fall back to the UA outline.
- Problem: inconsistent focus visibility; some UA outlines are faint on the paper background.
- Affects: keyboard users.
- Fix: extend the `:focus-visible` rule to `input[type=range]` and `a`.

## Notes (checked, no defect)
- Reduced motion is handled in all four animated widgets: `brute.js:149`, `tree.js:186`, `ghost.js:73`, `race.js:57` (each jumps to the end under `prefers-reduced-motion: reduce`). No finding.
- CSS text contrast on panels/pages passes AA: muted `#646b78` = 4.7:1, `.good #1d7a48` = 4.7:1, `.maybe #8a5700` = 5.3:1, links `#1e5b9c` = 6.6:1. No failures (see finding 6 for canvas text).
- All live readouts correctly use `role="status"` + `aria-live="polite"` (play, brute, ghost, race, sandbox, tree `detail`).

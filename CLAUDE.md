# CLAUDE.md — orientation for AI sessions

## Read first

**[DESIGN.md](DESIGN.md) is the authoritative document.** Read it before
writing code. Then, depending on the task:

- Touching simulation logic or numbers → **[docs/ECONOMY.md](docs/ECONOMY.md)**
- Touching interface or styling → **[docs/UI.md](docs/UI.md)**
- Touching colours, skins, assets or audio → **[docs/THEMING.md](docs/THEMING.md)**

Where a document and the code disagree, that is a bug in one of them. Fix it in
the same commit that caused the drift.

---

## Working style

The project owner is a beginner at coding and works in an executive role
outside software. When collaborating:

- **Explain the *why* in plain English**, not just what to type.
- **One terminal command per message.** They are on Windows and pasting
  multiple lines merges them into a broken command.
- **Lay out real decisions as options with a recommendation and reasoning.**
- **Never silently install heavy dependencies or restructure folders.** Say what
  is about to change, then do it.
- **When something fails, explain what the error actually means** before fixing.

---

## Non-negotiable architecture rules

Full text in DESIGN.md §5. Violating one is wrong even if it works.

1. **`src/sim/` is pure TypeScript.** No React, no DOM, no network, no
   `Date.now()`, no locale-dependent formatting.
2. **Determinism.** Same state in, same state out. No `Math.random()` in the
   engine. Randomness uses the seeded PRNG whose state lives in `GameState`.
3. **One serializable state object.** `GameState` round-trips through JSON
   losslessly. No class instances, `Date`s, functions, `Map`s, `Set`s,
   `undefined`, or non-finite numbers.
4. **Content is data, not code.** Adding an event means editing a content file.
   Trigger conditions and effects are declarative structures the engine
   interprets — never callbacks.
5. **Every number explains itself.** Nothing mutates a stat directly. All
   changes flow through the modifier ledger so the UI can always show which
   sources produced a displayed value, summing visibly to the total.
6. **The tick loop lives outside React.** The engine owns state in a plain
   module variable and publishes to Zustand at most 4×/second, independent of
   simulation speed.
7. **The UI is a renderer.** Zero simulation math in components. Derived
   simulation numbers come from `src/sim/`; presentation-only formatting from
   `src/lib/`.
8. **Saves are versioned.** On mismatch, migrate or refuse cleanly with a
   readable message. Never crash, never silently load a broken state.

---

## Historical data integrity

This matters as much as the architecture rules.

- Every historical figure in `src/content/history/` carries a **source
  citation**.
- **Never fabricate a historical number.** No guessing, no silent
  interpolation, no plausible-looking placeholder. If we lack a sourced figure,
  the data is marked unavailable and the UI says so explicitly.
- Distinguish the two categories (DESIGN.md §12.2):
  - **Benchmark data** (`src/content/history/`) — claims about what really
    happened. Cited, or explicitly marked unavailable. Shown as history.
  - **Calibration constants** (`src/sim/calibration.ts`) — game-design
    parameters. Documented in ECONOMY.md. **Never shown as historical fact.**
- Known data gaps are tracked in ECONOMY.md §3. Adding to that list is a
  correct outcome; filling a gap with a guess is not.

---

## Conventions

- **Every formula carries its causal claim as a comment above it**, in plain
  English, matching the wording in ECONOMY.md. That is how the model document
  and the engine stay in sync.
- **Design tokens live in `src/app/globals.css`** under `@theme` (Tailwind v4 is
  configured in CSS, not `tailwind.config.ts`). No arbitrary hex values in
  components — add the token first. **A test enforces this**: it reads the source
  of every component and fails on a hex value, an arbitrary Tailwind value, or a
  hardcoded asset path. See `docs/THEMING.md`.
- **`steel-*` colors are reserved for historical/benchmark data only.** No
  simulated value and no UI chrome may use them.
- **All numeric displays use tabular numerals.** Enforced through the shared
  `<Stat>` primitive.
- **Never encode meaning in color alone.** Pair with an arrow, icon, or word.
- **1800 was not a leap year.** The Gregorian century rule applies. Use
  `src/sim/calendar.ts`, never `year % 4 === 0`.

---

## Current status

**Phase 1 shipped. The Phase 2 §9 queue is complete — all fifteen items.**

Read **[docs/PROGRESS.md](docs/PROGRESS.md)** for where things actually stand:
what each item built, what was decided and why, and what is still open. It is
written so a session with no memory of the work can resume from the repository
alone.

At the last commit: 902 tests, save schema version 10 with nine committed
fixtures, all four gates green, deployed.

Open items are in **[docs/BLOCKERS.md](docs/BLOCKERS.md)** — none of them block
anything, and each records what was tried and what would clear it.

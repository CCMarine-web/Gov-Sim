# PROGRESS.md

**Live status of the build. Written for a reader with no memory of the session
that produced it.**

If you are resuming with no context: read `DESIGN.md` first, then this file,
then `docs/DECISIONS.md` and `docs/BLOCKERS.md`. Then continue the queue in
`gov-sim-autonomous-run.md` §5 without asking anything.

**Last updated:** autonomous run of 2026-08-15, after Item 2.

---

## Where things stand

| | |
|---|---|
| Production URL | <https://gov-sim.vercel.app> |
| Deploy | auto-deploys from `main` on push |
| Tests | 236 passing |
| Gates | tests, lint, typecheck, production build — all green |
| Database | Supabase, `save_games` table migrated, verified reachable from production |

---

## Autonomous run queue

| Item | Status |
|---|---|
| 1 — Treasury screen | **complete** |
| 2 — Supabase auth and save/load | **built; cloud path awaits two env vars** |
| 3 — History comparison view | not started |
| 4 — Government screen | not started |
| 5 — Full acceptance pass | not started |
| Stretch 1–6 | not started |

---

## What exists

**Engine** (`src/sim/`) — pure TypeScript, no React, no DOM, deterministic.

- `calendar.ts` — integer day ↔ civil date, proleptic Gregorian. Day 0 is
  1789-04-30; Phase 1 ends day 4262 (1800-12-31). **1800 is not a leap year.**
- `rng.ts` — seeded mulberry32 behind a pure interface. Resumes identically
  after a JSON round trip.
- `modifiers.ts` — the ledger. Fixed resolution order, additive percentages,
  clamping exposed as an explicit reconciling line.
- `types.ts` — `GameState` and content shapes.
- `calibration.ts` — every tunable constant, in one place.
- `conditions.ts` / `effects.ts` — declarative content grammars, plus
  `describe()` so locked content explains itself.
- `economy/production.ts`, `economy/fiscal.ts`, `economy/society.ts` — the
  model, each formula carrying its causal claim as a comment.
- `advanceDay.ts` — the tick. Daily and monthly cadences. Also `resolveDecision`.
- `createGame.ts` — day-0 state from census seed data.
- `policy.ts` — enacting a budget, and its legitimacy cost.
- `projection.ts` — forward simulation for the Treasury screen.
- `narrative.ts` — state-of-the-union prose and crisis lines.

**Content** (`src/content/`) — nine events, six laws, region seed data, all
with sourced historical context.

**Runtime** (`src/runtime/gameLoop.ts`) — the authoritative state lives here in
a module variable, NOT in Zustand. rAF accumulator, 10-day frame cap, publishes
to the store at most 4×/second.

**UI** (`src/components/`, `src/app/`) — title, founding, and the three-zone
shell with Desk, Treasury, Legislation, Regions, and Chronicle. Government and
History still render honest not-built states.

---

## Item 1 — Treasury screen: complete

Built:

- Tax sliders (tariff, excise, land) and spending sliders (military, civil,
  infrastructure), with debt service shown as non-discretionary.
- Live projection with **both columns forward-simulated over the same 365
  days** by the real engine.
- Explicit Enact and Revert. Nothing commits from a drag.
- Enacting charges legitimacy through the ledger and writes a chronicle entry.
- The tariff slider marks the 25% revenue peak on its track.
- The excise slider shows live projected frontier compliance.

**The projection is not a separate formula.** It clones the state, calls the
same `enactPolicy` the button calls, and runs `advanceDay` forward. A test
asserts the projection equals what actually happens when the policy is played
out. See `DECISIONS.md` D-002 for why that mattered — the first version was
0.02% optimistic because it skipped the legitimacy cost.

24 new tests, including the tariff curve turning over inside the projection and
the excise compliance collapse being visible in it.

---

## Item 2 — auth and save/load: built, cloud path dormant

Built:

- `src/sim/migrations/` — the load path. Same version loads; older with a
  registered path migrates forward; older without one, newer than this build,
  malformed JSON, and non-save files all **refuse readably**. Never throws.
  16 tests, including a guard against a migration that forgets to bump the
  version and would otherwise loop forever.
- `src/lib/saves/` — one `SaveStore` interface, two implementations
  (`localStore`, `cloudStore`), and a facade that picks between them. A failed
  cloud write falls back to local and says so; a network hiccup cannot destroy
  a run.
- `src/lib/saves/autosave.ts` — subscribes to the **store**, never the tick
  path. Writes on in-game month turnover with a 60s real-time floor.
- `/api/saves` and `/api/saves/[slot]` — list, write, read, delete. Every query
  scoped to the authenticated user id.
- `SaveMenu` — four slots, sign-in by emailed link, sync-local-upward.

**Not active:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
are unset in both local and production. See `docs/ENV-SETUP.md` for exactly
where to get them and what else to configure in Supabase. Setting them
activates the cloud path with no code change.

**Consequence for acceptance criterion 7:** the local half is done and testable;
the cross-device half cannot be verified until those variables exist.

> ⚠️ **Authorization note for anyone touching the save routes.** Prisma connects
> as the database owner and **bypasses Row Level Security**. The `getUserId()`
> check in each route handler is the only thing separating one player's saves
> from another's. A route that forgets it is a data leak, not a bug.

---

## What to do next

Item 3: the History comparison view. It is **not blocked** — shipping the
honest gap state is the deliverable. Build the full view, fill what is
sourceable, and render the explicit unavailable state for the rest. See
`BLOCKERS.md` B-001 and B-002 for what is missing and why.

---

## Standing constraints (do not violate)

- **Never fabricate historical data.** The gap state is a finished deliverable.
- Never break working functionality to add new functionality.
- All four gates pass before every commit.
- Never weaken a test to make it pass.
- No destructive database commands. Additive migrations only.
- No force-push, no rewriting pushed history.
- No secrets in tracked files.
- **Do not start Phase 2.** Nothing after 1800-12-31.

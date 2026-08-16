# Autonomous Build Session — Phase 1 Completion

Paste this to Claude Code as a single message before stepping away.

---

I'm stepping away for several hours and will be unreachable. This is an **autonomous run**. I don't want you stopping at milestones to ask me things — I want to come back to as much finished, working, committed, deployed work as you can produce. Read this entire brief, then work continuously until you've exhausted the queue or genuinely cannot proceed.

---

## 1. Standing authority for this session

For the duration of this run, you have my authority to make decisions I would normally be asked about. Specifically:

- **Do not ask me questions.** If a question arises, choose the option that best serves the design brief in `DESIGN.md`, write the decision and your reasoning into `docs/DECISIONS.md`, and keep moving. I'll review the log when I'm back and reverse anything I disagree with.
- **When two approaches are defensible, pick the simpler one** and note the alternative in `DECISIONS.md`.
- **When you hit something genuinely blocking**, do not spin on it and do not sit idle waiting for me. Log it in `docs/BLOCKERS.md` with what you tried and what you need from me, then skip to the next item in the queue.
- **Do not idle.** If the queue empties, move to the stretch queue in section 6. There is always more to do.

The one thing I have *not* authorized: changing the architecture rules in `DESIGN.md`. Those stay fixed. If you believe one is wrong, log the argument in `DECISIONS.md` and work within the rule anyway.

---

## 2. Rules that hold no matter what

These override any local judgment call:

1. **Never fabricate historical data.** This is the hardest rule in the project and the one most likely to be quietly bent under pressure to "finish" the History view. If a real figure isn't available from a citable source, the correct output is the honest gap state — "no verified data for this year," styled distinctly, with an explanation of what's missing. That gap state *is* a finished deliverable, not a failure. Never interpolate silently, never estimate into a blank, never carry a value forward across years to fill a hole.

2. **Never break working functionality to add new functionality.** The founding screen, the clock, the event modal, the regions view, and the stat breakdown all work right now. Every commit must leave them working.

3. **All four gates pass before every commit:** tests, lint, typecheck, production build. If a change breaks a gate, fix it or revert it — do not commit red and do not disable a rule to make it pass. If a lint rule is fighting you, that rule is usually pointing at a real design problem, the way the `setState`-in-effect one did earlier.

4. **Never weaken a test to make it pass.** If a test fails, either the code is wrong or the test encoded a wrong assumption. Fix the actual thing and note in the commit message which it was.

5. **Never run destructive database commands.** No `prisma migrate reset`, no dropping tables, no truncating. Additive migrations only.

6. **Never force-push. Never rewrite pushed history.** Small, frequent, ordinary commits.

7. **Never commit secrets.** No keys, tokens, or connection strings in tracked files. Verify `.env*` is gitignored before your first push.

---

## 3. Commit and recovery discipline

I may not see this session's output until much later, and you may hit context compaction before you're done. Protect against both:

- **Commit and push after each completed unit of work**, not at the end. A unit is one screen, one system, or one coherent slice — not the whole queue. Every push is a checkpoint I can inspect independently.
- **Descriptive commit messages.** What changed and why, one line of subject plus a short body. I will be reading these as a narrative of the session.
- **Maintain `docs/PROGRESS.md` continuously.** After every unit of work, update it with: what's done, what's in flight, what's next, and any decisions or blockers logged elsewhere. Write it for an audience of *you, after context compaction, with no memory of this session*. Assume that reader knows nothing except what's in the repo. This file is your lifeline — if you lose context mid-run, read `DESIGN.md`, `docs/PROGRESS.md`, `docs/DECISIONS.md`, and `docs/BLOCKERS.md`, then resume the queue without asking me anything.
- **Verify Vercel picks up each push** and note the deployment status in `PROGRESS.md`. If a deploy fails, fixing it is top priority — a broken production deploy outranks any new feature.

---

## 4. Testing without a browser

You don't have browser tools, so you can't visually confirm anything. Compensate by pushing verification down into code:

- Pure simulation logic gets thorough unit tests. Economic formulas especially — test the causal claims, not just that the function returns a number. If `docs/ECONOMY.md` says a tariff above roughly 25% suppresses total receipts, write the test that proves the curve actually turns over.
- Every reducer, selector, and modifier calculation gets tests.
- Component-level tests where they're cheap and meaningful: does the Treasury screen render sliders, does dragging update the projection, does Enact dispatch the right action, does an undismissable modal actually refuse to dismiss.
- For anything you truly cannot verify without eyes on it, write down the specific manual check in `docs/MANUAL-QA.md` as a numbered list I can run through when I'm back. Be precise: what to click, what I should see, what would indicate a problem.

Keep the suite green the whole way. 200 tests passing now — I expect meaningfully more by the end.

---

## 5. Work queue — do these in order

### Item 1: Treasury screen
The highest-value remaining piece, and the one that makes acceptance criterion 3 demonstrable.

Per the UI spec: tax rate sliders (excise, tariff, land) on the left, spending allocation on the right, live projected annual balance updating as sliders move, clear visual separation between *current* policy and *projected* policy, and an explicit Enact button so no accidental policy change can happen from a stray drag. A Revert control to discard uncommitted changes. Enacting writes modifiers through the ledger like everything else, and produces a chronicle entry.

The projection must be computed by the real engine running a forward simulation on a cloned state — not a separate simplified formula written for the UI. Two different calculations of the same thing will drift apart and one of them will be lying. If forward-simulating is too slow to run on every slider drag, debounce it, but do not duplicate the model.

Also make sure the causal chain is actually observable: after enacting a tax change I should be able to run the clock forward and watch receipts move within weeks and regional sentiment move over months, with every step traceable through the stat breakdown popover.

### Item 2: Supabase auth and save/load
Schema is ready, wiring hasn't started. This is acceptance criterion 7 and the thing most likely to have environment surprises, so I want it attempted while there's still runway.

- Supabase Auth for accounts. Email-based is fine; simplest working path.
- Save games persist the full `GameState` JSON with `schemaVersion` recorded.
- Autosave on a sensible cadence — in-game monthly or every couple of real minutes, debounced, and never on the tick path.
- Manual save/load UI with named saves, timestamps, and the in-game date shown.
- Local storage fallback so the game remains playable while logged out, with a clear path to sync up on login.
- On schema mismatch at load: migrate if you can, refuse cleanly with a readable message if you can't. Never crash, never load a half-valid state.

**If this needs environment variables I haven't provided:** build everything up to that boundary behind a clean interface, keep the local fallback fully working so the game doesn't regress, and write the exact list of required variables and where to get each one into `docs/ENV-SETUP.md`. Then move on. Don't stall the whole session on a missing key.

Watch the connection-string details from `DESIGN.md`: pooler on 6543 with `?pgbouncer=true` for `DATABASE_URL`, direct on 5432 for `DIRECT_URL`, and any special characters in the password percent-encoded.

### Item 3: History comparison view
You flagged this as blocked on the price index decision and a receipts data gap. Re-read section 9 of the brief: **it isn't blocked.** Shipping the honest gap state is the deliverable. Build the full view now:

- Side-by-side Your America vs Historical America for the current date.
- All specified metrics, with delta percentages and dual-line trajectory charts from 1789 to present-in-game.
- Rows lacking verified data render the explicit unavailable state naming exactly which source we'd need — which you're already doing well in the empty states you built.
- Every historical figure carries a visible source citation.
- Date scrubber for reviewing any past point in the run.

Proceed on whatever price index decision is already recorded. If the recorded decision turns out to be unworkable, pick the defensible alternative, document the reversal in `DECISIONS.md`, and continue. For the receipts gap: fill what OMB Historical Table 1.1 actually covers, gap the rest honestly, and list precisely what's missing in `BLOCKERS.md` so I can go source it.

### Item 4: Government screen
Cabinet and officeholders, succession status appropriate to the chosen government type, and a legitimacy breakdown showing every contributing modifier. This is the screen where the monarchy/republic divergence should feel most concrete — bloodline succession versus administration turnover — even though nobody actually leaves office in the Phase 1 window.

### Item 5: Full acceptance pass
Walk section 11 of the original brief criterion by criterion. For each, either demonstrate it with a test, or write the exact manual verification step into `docs/MANUAL-QA.md`. Produce a table in `PROGRESS.md` showing all nine criteria and their status with evidence. Be honest — a criterion that's 80% there is not met, and I'd much rather read an accurate assessment than an optimistic one.

---

## 6. Stretch queue — only after items 1–5

Do not start these while anything above is incomplete.

1. **Performance verification.** Confirm the render throttle actually holds at 5x — instrument render counts in a test and assert the ceiling. Confirm a long run doesn't leak memory or grow the modifier list unboundedly. Confirm the modifier ledger prunes expired entries.
2. **More historical events.** Six is the minimum; twelve to fifteen would make the 1790s feel populated. Real events, real dates, real branching consequences, factual `historicalContext` on every one, sources cited. Follow-on events so choices echo forward.
3. **Accessibility audit.** Keyboard operability on every screen, focus traps on modals, ARIA live region on the chronicle feed, contrast check against WCAG AA, verify nothing encodes meaning in color alone.
4. **Responsive check down to 1280px.** Right feed collapses to a drawer, nothing overflows or overlaps.
5. **Documentation sweep.** `README.md`, `DESIGN.md`, and `docs/ECONOMY.md` reconciled against what the code actually does now. Documentation that has drifted from reality is worse than none.
6. **Chronicle filtering and search**, if everything above is genuinely done.

---

## 7. Hard scope fence

**Do not start Phase 2.** No map, no territorial expansion, no combat, no diplomacy, no elections, nothing after 1800-12-31. If you find yourself with time and the queues are exhausted, spend it deepening and hardening Phase 1 rather than starting the next era. A polished, tested, honest slice is worth far more to me than a broad shallow one.

---

## 8. When you're finished or out of runway

Write a final summary as your last message containing:

- Which queue items are complete, partial, or untouched
- The acceptance criteria table with honest status
- Every decision you made on my behalf, with reasoning
- Every blocker, with what you need from me to clear it
- The current production URL and deploy status
- Exactly what you'd do next, in priority order
- Anything you're uncertain about or that deserves my scrutiny

Then stop. Don't start new work after the summary.

Begin with Item 1. Don't reply with a plan — just start building.

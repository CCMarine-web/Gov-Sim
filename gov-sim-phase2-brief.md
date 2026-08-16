# Phase 2 Build Brief — Governance, Map, and Diplomacy

Paste this to Claude Code as a single message. Same working rules as before: one terminal command per message, plain-English explanations, commit and push after every unit of work, all four gates green before every commit.

---

Phase 1 is done and deployed. This brief opens Phase 2. It's large — treat it as a multi-session queue, not one sitting. Work top to bottom, commit at every checkpoint, and keep `docs/PROGRESS.md` current enough that a context-compacted version of you could resume from the repo alone.

The standing authority from the last session still applies: don't stop to ask me questions, make the call, log it in `docs/DECISIONS.md`, keep moving. Log blockers and skip past them rather than idling.

---

## 0. Priority zero — fix these first, before any new features

### 0.1 Numbers flashing and glitching during play

Numbers visibly flicker and drop out while the clock runs. This makes the game feel broken and it outranks every feature below.

Diagnose before patching. Write your hypothesis into `docs/DECISIONS.md` before you touch code. The likely suspects, in rough order:

- The value-interpolation animation restarting on every throttled store update, so it never settles
- Unstable React keys causing remounts instead of updates
- Conditional rendering that briefly returns null between frames
- `tabular-nums` missing somewhere, so digit-width changes read as jitter
- The throttle and the animation duration fighting each other

Fix the actual cause, then write a regression test that would have caught it — assert render counts and value stability across simulated ticks. This is one of the failures you flagged as unverifiable without a browser, so push the verification into code this time.

### 0.2 Rebalance clock speeds

Current 5x is roughly where I want 3x to sit. Restructure to five speeds:

- Read the current days-per-real-second config and write the existing values into `DECISIONS.md` before changing anything
- New 3x should match the current 5x rate
- 1x and 2x scale down proportionally from there
- 4x is meaningfully faster than 3x
- 5x is **uncapped** — run as fast as the engine can process, the way HOI4's top speed does. If the machine can do 200 days a second, let it

Express all of this as one explicit table in a config file, in days per real second, with the UI reading from that table. No magic numbers scattered around. Verify the render throttle still holds at uncapped speed — that's exactly where it will break, and a test should assert the ceiling.

---

## 1. Design direction — what we're taking from where

I want this game to be a compilation of Democracy 4, Power & Revolution, and Hearts of Iron IV. I researched all three. Here's what to borrow and, just as importantly, what to leave.

### From Democracy 4

<cite index="6-1">Its simulation models voter groups through interconnected systems shaped like a neural network</cite>, and this is the single best idea to steal because **we already have the data for it.** The modifier ledger built in Phase 1 is a causal graph — it just isn't drawn yet.

- <cite index="3-1">Nobody in Democracy 4 is only a member of one group; voters exist on spectrums across liberal/conservative and socialist/capitalist axes plus income tiers</cite>. Our equivalent: citizens belong to multiple overlapping blocs simultaneously — planters, merchants, frontier settlers, artisans, financiers, clergy, seamen, small farmers — with graduated rather than binary membership.
- <cite index="3-1">Group membership is fluid and policies change the size of groups over time — raising farmers' disposable income moves some of them from poor into middle income</cite>. Build this. Blocs should grow and shrink in response to policy, not just get happier or angrier.
- <cite index="13-1">Political capital is generated each turn based on popularity, electoral majority, minister loyalty, and whether emergency powers are active</cite>, and <cite index="10-1">it gates what you can implement, raise, lower, or abolish — an unpopular leader simply cannot pass certain things</cite>. Adopt this as the core action currency. Details in section 3.
- <cite index="7-1">Each policy carries separate capital costs for introducing, cancelling, raising, and lowering it, belongs to a department, has prerequisites that must be true to be available, and has a min and max cost across its slider range</cite>. Use this schema almost verbatim for our legislation data model.
- <cite index="10-1">A severe enough crisis can grant temporary Emergency Powers that spike political capital far above normal, letting the government push through drastic reform</cite>. Excellent fit for wartime and crisis periods in US history.
- **What to leave:** <cite index="4-1">Democracy 4 doesn't model the opposition's actual policies — they're assumed to simply oppose everything you do</cite>. We're doing better than that. Our parties have real positions and vote on the merits.

### From Power & Revolution

- <cite index="14-1">The head of state distributes budget across ministries, sets personnel and salaries in major administrative positions, and directs spending by setting priorities among many specific budgetary pillars</cite>. This granularity is the direction our Treasury should grow — line-item spending, not four sliders.
- <cite index="16-1">Bills are proposed and voted on in Parliament</cite> — the legislative-approval loop is the mechanic I want most for the republic playthrough.
- <cite index="15-1">It offers nearly thirty types of taxes</cite>. Our taxes must become a dynamic list, not a fixed three. Section 4.3.
- Ministers with competence and loyalty ratings who affect how well their department's policies actually execute.
- **What to leave:** the sprawl. P&R is famously deep and famously unpolished. We ship fewer systems, each of which works.

### From Hearts of Iron IV

- <cite index="26-1">Political power is the government's currency, generated at a base rate per day and modified by leaders and circumstances</cite> — daily accrual fits our real-time clock better than D4's quarterly turns.
- <cite index="24-1">Amending a law costs political power, but also requires the right ideology, national spirit, and war support, with different requirements for each law</cite>. Our version: bills need capital *and* preconditions, and the UI must show exactly which precondition is blocking.
- <cite index="28-1">National focus trees let the player direct long-term national development along branching paths, with each focus consuming political power over a fixed number of days and only one active at a time</cite>. Build a **National Agenda** tree — long-term projects like Assume the State Debts, Establish a National Bank, Open the Northwest, Build a Navy. This gives the player direction between events. Later phase, but design the data model for it now.
- <cite index="25-1">World tension gates aggressive actions, with different ideologies facing different thresholds — democracies need very high tension to declare war while fascist countries aren't limited by it at all</cite>. Our analogue: a monarchy can declare war far more freely than a republic, which needs a congressional declaration and sufficient public support. This is a great structural expression of the two playthroughs.
- <cite index="29-1">The default map mode combines political and terrain views, showing national colors when zoomed out and terrain plus symbols for bases, capitals, and victory points when zoomed in</cite>. Map modes are the model for section 6.
- <cite index="35-1">HOI4's top speed simply runs as fast as the machine can handle</cite> — which is the behavior I asked for in 0.2.

---

## 2. The monarchy/republic split must become the defining choice

Right now the two paths differ by starting stats. That's not enough. They should play like different games.

### 2.1 Monarchy — rule by decree

- Any law the king wants is enacted **immediately**. No vote, no delay beyond phase-in time.
- The cost is legitimacy and grievance. Every decree spends legitimacy, and spends more when it runs against the interests of powerful blocs. Decreeing against the planters repeatedly builds planter grievance specifically, not just generic unhappiness.
- Grievance accumulates per bloc and per region. Above thresholds it produces unrest events, tax resistance, regional non-compliance, and eventually revolt or attempted coup. The Whiskey Rebellion should feel like a warning shot, not a one-off.
- Succession: the ruler ages and dies. The heir inherits with their own traits and a legitimacy penalty. Succession crises when no clear heir exists. The player continues as the new monarch.
- Speed is the monarchy's advantage and instability is its price. If decree is strictly better than legislating, the balance is wrong.

### 2.2 Republic — rule by persuasion

- Bills must pass Congress. Model both chambers: House seats apportioned by state population, Senate with two per state.
- Parties are historically grounded. 1789–1792 has no formal parties — model Federalist and Anti-Federalist factions. Democratic-Republicans emerge around 1792. Party seat counts shift at elections driven by regional sentiment and bloc satisfaction.
- Every party has positions on issue axes (federal power vs states' rights, commercial vs agrarian, pro-British vs pro-French, fiscal, slavery). Members also carry regional interests that can override party line — this is the seed of sectional politics and eventually the Civil War.
- **Vote resolution must be transparent and inspectable.** Before committing to introduce a bill, the player sees a projected whip count broken down by party and by region, with each bloc's reasoning visible. Same modifier-ledger honesty as everything else.
- Player tools to change the count:
  - **Spend political capital** to persuade individual blocs
  - **Amend the bill** — weaken provisions to buy votes, with the reduced effects shown live before committing
  - **Attach riders** — bundle a sweetener for a specific faction, at a cost
  - **Log-roll** — promise future support, creating an obligation that comes due later
- Failed bills go on cooldown and cost reputation. Repeatedly failing bills should visibly damage the player's standing.
- Elections every two years for the House, staggered Senate, presidential every four. The player persists through all of them, but a hostile Congress makes the job genuinely harder.

---

## 3. Political capital

One currency, daily accrual, drawn from D4 and HOI4.

- Accrues daily from legitimacy, popular support, seat share (republic) or noble/elite satisfaction (monarchy), and cabinet quality.
- Spent on: introducing bills, whipping votes, decrees, cabinet appointments, diplomatic actions, and National Agenda progress.
- Has a cap, so hoarding indefinitely isn't a strategy.
- Crises can grant temporary emergency powers that raise both accrual and cap — the D4 mechanic. War, rebellion, and financial panic should all be candidates.
- Displayed in the command bar with full modifier breakdown on hover like every other stat.

---

## 4. Legislation — build this out properly

The current Legislation tab is thin. It becomes the heart of the game.

### 4.1 Categories

Organize bills into departments, D4-style, each with its own screen zone:

Taxation · Trade & Tariffs · Banking & Currency · Military & Naval · Federal Judiciary & Law Enforcement · Public Works & Infrastructure · Land & Territory · Immigration & Naturalization · Slavery & Civil Rights · Education · Postal & Communications · Foreign Affairs & Treaties · Agriculture · Labor & Manufactures · Health & Welfare · Elections & Suffrage · Federal Administration

Not every category has content in 1790 — empty ones show what unlocks them and when, rather than being hidden.

### 4.2 Bill schema

Model it closely on Democracy 4's policy structure:

```ts
interface Bill {
  id: string;
  category: Department;
  name: string;
  description: string;
  historicalNote: string;        // what actually happened, factually
  sources: string[];
  hasSlider: boolean;            // rate/intensity, or a flat enact/repeal
  sliderRange?: [number, number];
  capitalCost: { introduce: number; repeal: number; raise: number; lower: number };
  treasuryCost: { min: number; max: number };   // across slider range
  phaseInDays: number;           // effects ramp in, never instant
  prerequisites: Condition[];
  availableFrom: string;         // earliest plausible date
  availableUntil?: string;
  historicity: 'enacted' | 'proposed' | 'counterfactual' | 'anachronistic';
  effects: ModifierTemplate[];
  blocReactions: BlocReaction[]; // who gains, who loses, how strongly
}
```

### 4.3 The critical requirement — legislation creates real objects

**When I pass a new tax in Legislation, it must appear as a new line in Treasury.** Same for spending programs, agencies, and tariff schedules.

This means taxes stop being three hardcoded sliders and become instances in state:

```ts
interface TaxInstance {
  id: string;
  name: string;
  createdByBillId: string;
  base: 'imports' | 'exports' | 'land' | 'spirits' | 'carriages' | 'slaves' | 'income' | 'sales' | ...;
  rate: number;
  exemptions: string[];
  collectionEfficiency: number;  // enforcement is a real problem in 1790
  enactedDay: number;
  repealedDay: number | null;
}
```

Treasury renders whatever exists in that array. Revenue is computed per instance from its own base and efficiency, and the modifier ledger attributes each dollar to its originating law by name. Same pattern for `SpendingProgram[]`. Getting this data model right is the single most important structural change in this brief — do it before building any UI on top of it.

### 4.4 Counterfactual legislation

I don't want to be limited to laws that actually passed. Three tiers:

- **Enacted** — happened in reality. Flag it, show the real date and outcome.
- **Proposed** — genuinely debated at the time but failed or stalled. Fully available.
- **Counterfactual** — plausible for the era's technology, economy, and political vocabulary, but never seriously advanced. Available, marked clearly as ahistorical.
- **Anachronistic** — impossible for the period. Locked, with an explanation of what has to exist first. A federal income tax in 1791 is locked; the lock text explains the constitutional and administrative reasons.

Every bill carries factual historical context regardless of tier. That's the educational spine and it doesn't get dropped because a bill is counterfactual.

---

## 5. Cabinet and administration

Take P&R's minister model. Appointees have competence and loyalty. Competence affects how efficiently their department's policies execute — a low-competence Treasury Secretary means tax collection efficiency drops and programs cost more to deliver. Loyalty affects whether they undermine you, leak, or resign publicly at damaging moments.

Appointments cost political capital. In a republic, significant appointments need Senate confirmation, which is its own vote. Real historical figures where appropriate, with sourced biographical notes.

---

## 6. The map — replace the Desk with it

The main view becomes a map of the United States as it currently exists in-game.

### 6.1 Geometry approach

Full historically accurate boundaries for every year is out of scope and would swallow the whole phase. Do this instead:

- Use modern state outlines as the atomic geometry. The `us-atlas` package on npm provides TopoJSON for US states and is reachable from our allowed domains.
- Model territory in data as a list of records, each with a status and a status history: `unorganized` · `organized_territory` · `petitioning` · `state` · `foreign` · `disputed` · `native_nation`.
- Pre-statehood regions render as merged groups of the modern shapes they'd eventually become, drawn without internal borders and labeled as the territory.
- **Document this simplification prominently** in `DESIGN.md` and visibly in-game. It's a real inaccuracy and I'd rather it be stated than discovered.

### 6.2 Map modes

Toggleable, HOI4-style, in a corner control:

- **Political** — states, territories, statehood status
- **Support** — how strongly each state backs the player, diverging color scale
- **Economic** — output, wealth per capita, dominant sector
- **Party** — congressional delegation control by state (republic only; monarchy shows noble/elite alignment instead)
- **Population** — density and growth
- **Sectional tension** — the map mode that should make the coming Civil War legible decades in advance
- **Infrastructure** — roads, ports, postal routes
- **Military** — garrisons, forts, naval stations
- **Compliance** — tax collection efficiency and federal authority by region, which makes rebellion risk visible

Clicking a state opens a detail panel: population, economy, sentiment, delegation, active grievances, notable figures.

### 6.3 Expansion

The map is the payoff for territorial growth, so wire the mechanics that change it: land purchases, treaties, war settlements, territorial organization, and statehood petitions. A territory petitioning for statehood should be a real decision with real consequences — its delegation shifts the balance in Congress, which is exactly how the sectional crisis actually worked.

---

## 7. Diplomacy tab

New top-level section.

- **Foreign powers as modeled entities**: Britain, France, Spain, the Dutch Republic, Portugal, the Barbary states, and the major Native nations — the Cherokee, Creek, Iroquois Confederacy, Shawnee, and the Northwest Confederacy. Native nations are sovereign polities with their own interests, diplomacy, and military capacity, not map obstacles. Represent them factually and seriously; the historical record here is ugly and the game shouldn't launder it.
- **Nation panel** per power: government type, ruler, population, economy, military strength, current wars and alliances, relationship with us, active treaties. Real 1790s figures where sourced, honest gaps where not — the same data-integrity rule applies to foreign nations as to our own.
- **Actions**: improve or damage relations, negotiate trade agreements and tariff arrangements, sign treaties, guarantee independence, demand tribute, purchase territory, fabricate or press claims, declare war.
- **Trade agreements** feed the real economy — trade volume, customs revenue, and regional prosperity. They must flow through the same model, not a parallel one.
- **War declaration is where the two playthroughs diverge hardest.** A monarch declares war by decree. A republic requires a congressional declaration, which needs public support and a defensible pretext. Model the HOI4-style threshold gate: aggression without justification tanks legitimacy, invites foreign hostility, and in a republic can simply be voted down.
- Combat itself is **not in this phase**. Build declaration, claims, treaties, and resolution-by-event. Actual military operations are Phase 3.

---

## 8. Preparing for artwork and music

We'll eventually redo the entire visual design around real artwork and add a soundtrack. I can't hand you those assets now, so build so that adding them later is configuration rather than surgery.

- **Every color, font, spacing value, and radius lives in one theme module as tokens.** Zero hardcoded hex values or Tailwind arbitrary values in components. Audit and fix any that exist now.
- **Support multiple named skins from day one.** Implement the current look as skin `ledger`, and add a stub second skin so the switching mechanism is real and tested rather than theoretical. A future art-driven skin should require no component edits.
- **Asset registry.** Every image, portrait, icon, seal, and texture is referenced by a logical key resolved through a single manifest — `assets.portrait('washington')`, never a hardcoded path. Ship with placeholders. Swapping in real art becomes a manifest edit.
- **Reserve the space now.** Portrait frames, panel background slots, and header banner areas should exist in the layout at correct dimensions with placeholder fills, so adding art doesn't reflow every screen.
- **Audio bus abstraction with no assets.** Build `audio.play('event.crisis')`, `audio.music.setLayer('war')` with crossfade support, as a silent no-op implementation. Add volume sliders and a mute toggle to settings now, persisted with other preferences. When we have music, we register files in a manifest and nothing else changes.
- **Copy lives in content files, not inline JSX**, so a visual redesign doesn't mean editing text and a text edit doesn't risk breaking layout.
- Document the whole approach in `docs/THEMING.md` including exactly what an artist would need to deliver and in what formats and dimensions.

---

## 9. Work queue and checkpoints

Ship each item complete, tested, committed, pushed, and deployed before starting the next. Do not work on several at once.

1. **Numbers flicker fix** + regression test
2. **Speed rebalance** with config table
3. **Dynamic tax and spending instances** — the data model change from 4.3, with Treasury rendering from state. Nothing else in this brief works properly until this lands.
4. **Political capital system** with full ledger integration
5. **Legislation categories and bill schema**, populated with at least 25 bills spanning enacted, proposed, and counterfactual across at least six categories
6. **Monarchy decree path** — instant enactment, legitimacy cost, per-bloc grievance accumulation, unrest thresholds
7. **Congress and the republic path** — chambers, parties, positions, whip count preview, amendments, riders, vote resolution
8. **Bloc model** — overlapping membership, fluid sizes responding to policy
9. **Map view replacing the Desk**, with political, support, economic, and party modes minimum
10. **Remaining map modes** and the state detail panel
11. **Diplomacy tab** — nation panels, relations, treaties, trade agreements
12. **War declaration paths** diverging by government type
13. **Cabinet competence and loyalty**
14. **Theming, asset registry, and audio abstraction** from section 8
15. **Causal web view** — visualize the modifier ledger as D4's policy network. We already have the graph data; this is mostly rendering, and it may end up the best screen in the game

If the queue outlives the session, stop at a clean checkpoint and write the resume state into `PROGRESS.md`.

---

## 10. Rules that still hold

1. **Never fabricate historical data.** Foreign nation stats, state populations, party seat counts — all of it. Sourced or honestly gapped. No exceptions, and no quiet interpolation to make a map mode look complete.
2. **Everything flows through the modifier ledger.** A new system that mutates stats directly is a bug regardless of whether it works.
3. **Engine stays pure and deterministic**, isolated from React.
4. Four gates green before every commit. Never weaken a test to pass it.
5. Additive migrations only. No force-push. No secrets committed.
6. **Balance is a real deliverable.** If monarchy is strictly better than republic, or a single bill trivially wins the game, that's a defect. Write down in `DECISIONS.md` what tradeoff each path is supposed to embody and check your work against it.

---

## 11. Out of scope for this phase

No military combat resolution. No period beyond 1860. No multiplayer. No AI opponents playing other nations as full agents — foreign powers react through rules and events, not a competing planner. Don't start these even if the queue empties; deepen and harden what's here instead.

Begin with item 1. Don't reply with a plan — start working.

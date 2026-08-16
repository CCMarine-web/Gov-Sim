# MANUAL-QA.md

Checks that require eyes on a browser. The autonomous run had no browser tools,
so anything visual or interaction-timing dependent is listed here rather than
claimed as verified.

Run these against <https://gov-sim.vercel.app> or a local `npm run dev`.

Each item states: what to do, what you should see, and what would indicate a
problem.

---

## 1. Founding and first run

**1.1 — Title screen renders**
Open the site. You should see "The American Experiment" in a serif face on a
near-black ground, a brass-outlined seal plate, and a New Game button.
*Problem if:* text is unstyled, the font is a system sans, or colours are
default browser blue/white — that would mean the design tokens or `next/font`
failed to load.

**1.2 — Founding cards differ meaningfully**
Click New Game. Compare the two cards. Monarchy should show Legitimacy 50 with
New England and Mid-Atlantic negative; Republic should show 70 with both
positive.
*Problem if:* the numbers are identical between cards, which would mean the
seed data is not being read.

**1.3 — Confirmation step appears**
Click a card. A confirm panel should slide in below with name and dynasty/party
fields, and the field label should read "Dynasty" for monarchy and "Party" for
republic.

**1.4 — The game starts**
Click Found the Nation. You should land on the shell: command bar across the
top, nav on the left, main panel centre, chronicle on the right. The date reads
30 April 1789.

---

## 2. The clock — acceptance criterion 2

**2.1 — Space toggles pause**
Press Space. The date should begin advancing at roughly one and two-thirds days
per second — about three days every two seconds.
*Problem if:* nothing happens, or the date jumps erratically.

**2.2 — Speed controls**
There are **five** speeds, keys `1` through `5`, defined in one table in
`src/runtime/speeds.ts` (`DECISIONS.md` D-016). Step through them and check the
rate roughly matches:

| Key | Expected |
|---|---|
| `1` | ~1.7 days/sec |
| `2` | ~3.3 days/sec — visibly twice 1x |
| `3` | 5 days/sec — this is what Phase 1 called 5x |
| `4` | 10 days/sec — clearly twice 3x, not a nudge |
| `5` | Uncapped. Should be dramatically faster than 4x and vary with the machine |

The active speed gets a brass underline. Hovering any speed button should show
its description.
*Problem if:* the underline moves but the rate does not change; or 5x is not
noticeably faster than 4x, which would mean the uncapped path is not being
taken.

**2.2b — Uncapped speed stays responsive**
Sit at 5x for thirty seconds. The interface must stay clickable and the left
nav must still respond immediately.
*Problem if:* the tab locks up. The frame is supposed to yield after 8ms of
simulating; if it does not, the wall-clock budget is not being honoured.

**2.3 — CPU does not peg**
Leave it at 4x for two minutes with a task manager open. The tab should stay
well under one core.
*Problem if:* a core saturates, or the UI becomes unresponsive to clicks. That
would mean the render throttle is not holding.

At 5x the machine *will* work hard — that is the point of an uncapped speed —
but the interface must remain responsive and the numbers must still update no
more than four times a second.

**2.4 — Numbers do not jitter**
Watch the treasury figure in the command bar as it ticks. Digits should change
without the number shifting left or right.
*Problem if:* the number visibly wobbles — that means tabular numerals are not
applied somewhere.

**2.5 — Background tab auto-pauses**
Start the clock, switch to another tab for thirty seconds, come back. The game
should be paused, with "Paused (tab hidden)" shown.
*Problem if:* it is still running, or the date has jumped forward by many days.

---

## 3. The stat breakdown — acceptance criterion 4

**3.1 — Hover reveals the breakdown**
Hover Stability in the command bar. A popover should list Base, then each
contributing modifier with its source name, then Total.

**3.2 — The arithmetic reconciles**
Add up Base plus every listed contribution. It must equal the Total shown.
*Problem if:* it does not — that is a bug, and a test exists that should have
caught it, so tell me.

**3.3 — Lag is disclosed**
The Stability popover should end with a line reading roughly "Moving toward X ·
about 3 months to register".

**3.4 — Keyboard access**
Tab to a stat and confirm the popover opens on focus, and Escape closes it.

---

## 4. Treasury — acceptance criterion 3

**4.1 — Sliders move, nothing commits**
Go to Treasury. Drag the tariff slider. The value turns brass and shows "(now
10.0%)" beside it. Nothing in the command bar changes.
*Problem if:* the treasury figure changes while dragging — policy must never
commit from a drag.

**4.2 — The projection updates**
After a moment's pause the Projection block recalculates. The "simulating…"
label appears briefly then shows "365 days forward".
*Problem if:* it never resolves, or resolves instantly on every pixel — the
debounce is 180ms.

**4.3 — The tariff curve turns over**
Set the tariff to 25%, note projected receipts. Now set it to 40%. Projected
receipts should be **lower** at 40% than at 25%.
*This is the headline causal claim of the whole economy.* A test covers it, but
confirm it is visible on screen.

**4.4 — The revenue peak mark**
There should be a faint vertical brass line on the tariff slider track at 25%,
labelled "revenue peak at 25%".

**4.5 — The excise warning is live**
Drag the excise to 30%. The note under the slider should show frontier
compliance falling, and the wording should change (e.g. "largely refusing").

**4.6 — Enact and Revert**
With changes pending, Revert should restore the committed values and disable
both buttons. Re-make a change and press Enact. The chronicle should gain an
entry reading "The budget is altered" with a sentence naming the change.

**4.7 — The political cost is visible**
Raise the tariff substantially and Enact. Then hover Legitimacy. There should
be a `policy` line reading "Tax rise of [date]" with a negative value.
*Problem if:* no such line appears.

**4.8 — The causal chain over time**
After enacting a big excise rise, run the clock forward. Within a month or two
the excise receipts on the Desk should rise. Over six to twelve months the
Frontier's sentiment and compliance on the Regions screen should fall. This is
acceptance criterion 3 end to end.

---

## 5. Events — acceptance criterion 5

**5.1 — The clock stops on the day**
Run from the start at 5x, the uncapped speed. On 20 June 1790 the game should
stop and a modal appear for the assumption of state debts.
*Problem if:* the date runs past it — a decision must never be missed at speed,
and the uncapped path is where that is most likely to go wrong, because a single
frame simulates hundreds of days.

**5.2 — The modal cannot be dismissed**
Press Escape. Click outside it. Neither should close it.

**5.3 — Historical context is present and distinct**
The modal should show a parchment-coloured block headed "What actually
happened", with sources listed beneath. It should be visually obvious which
text is narrative and which is history.

**5.4 — Choosing resolves and stays paused**
Pick an option. The modal closes, the chronicle gains a "You chose: …" entry,
and **the clock stays paused** until you restart it.

**5.5 — Path-specific options**
On the Bill of Rights event (15 Dec 1791), a republic should see the "proclaim
as foundation" option enabled and the monarchy option disabled with a stated
reason, and vice versa on a monarchy run.

---

## 6. History view — acceptance criterion 6

**6.1 — Gaps are honest**
Federal receipts and federal outlays rows must render an explicit "no verified
data" state naming the missing source, **not** a zero, a blank, or a dash.
*Problem if:* any number appears in those rows. That would be fabricated data
and is the most serious defect possible in this project.

**6.2 — Citations are visible**
Population, GDP and federal debt rows should each show their source.

**6.3 — Simulated and historical are distinguishable**
The two columns must differ by colour *and* marker *and* label — check by
taking a greyscale screenshot; the distinction must survive.

**6.4 — Date scrubber**
Drag the scrubber back to an earlier year. Every row should update to that
date, and the historical figures should show the date of the figure they quote.

---

## 7. Save and load — acceptance criterion 7

**7.1 — Local persistence**
Play a few in-game months, reload the page. You should be offered the local
save and resume at the same date.

**7.2 — Cross-device** *(requires B-004 cleared)*
Not verifiable until the Supabase auth variables are set. See
`docs/ENV-SETUP.md`.

---

## 8. Responsiveness and accessibility

**8.1 — Down to 1280px**
Narrow the window to exactly 1280px. Nothing should overlap or overflow
horizontally. The command bar must not collapse, and the right feed should
still be a fixed column.

**8.2 — Below 1280px**
Narrow further. The right feed should disappear and a **Chronicle** button
should appear beside "Saved games". Click it: the feed slides in from the right
over a dimmed backdrop. Clicking the backdrop or pressing Escape closes it.
*Problem if:* the feed simply vanishes with no way to reach it — a pending
decision must stay reachable at every width.

**8.3 — The drawer badge**
With a decision pending and the window below 1280px, the Chronicle button
should carry a brass count badge.

**8.4 — Keyboard only**
Unplug the mouse. Confirm you can reach every nav section, open a stat popover,
operate the Treasury sliders, and answer an event modal.

**8.5 — Focus trapping**
Open **Saved games** and press Tab repeatedly. Focus should cycle within the
dialog and never reach the page behind. Press Escape: it closes and focus
returns to the button that opened it. Repeat with an event modal — focus should
cycle, and **Escape should do nothing**.

**8.6 — Keyboard reference**
Press `?`. A shortcut reference should open. Escape closes it. Now click into
the Chronicle search box and press `?` again — it should type a question mark
rather than opening the dialog.

**8.7 — Reduced motion**
Enable "reduce motion" in your OS. Number transitions should snap rather than
interpolate; nothing should become unusable.

**8.8 — Greyscale check**
Take a screenshot of the History view and desaturate it. The simulated and
historical columns must still be tellable apart — they carry different markers
(▪ vs ▫), different line styles (solid vs dashed) and text labels, not just
different colours.

---

## 9. Chronicle filtering

**9.1 — Category and kind filters**
Go to Chronicle. Click a category chip, then a kind chip. The count line should
update, and only matching entries should show.

**9.2 — Search**
Type "whiskey" into the search box. Entries whose title or body contain it
should remain.

**9.3 — Empty states are distinguishable**
Filter to something with no matches. It should read "No entries match these
filters", **not** "Nothing has happened yet" — those are different situations
and confusing them makes the player wonder whether the log is broken.

**9.4 — Clear**
The Clear button should appear only when a filter is active, and reset all
three controls.

---

## 10. Number stability — Phase 2 brief §0.1

Most of this is now asserted in code by
`src/components/game/numberStability.test.tsx`, which drives the real loop
against a real DOM. The checks below are the ones a test cannot make, because
jsdom has no layout engine.

**10.1 — The Treasury projection does not blank while the clock runs**
Open Treasury, press play, and let it run at 5x for a minute. The five
projection rows and the three per-slider revenue figures should stay on screen
the whole time. **None of them should flash to an em-dash.** The header should
read "365 days forward from <a date>", and that date should advance about once
per in-game month rather than continuously.

*This was the reported defect.* Before the fix, 405 of every 600 frames showed
em-dashes. See `DECISIONS.md` D-011.

**10.2 — The command bar does not jump**
Play at 5x and watch the six headline stats, particularly Treasury as it grows
past $10,000 and then past $1,000,000. The row must not shift horizontally or
vertically, and **no horizontal scrollbar may appear in the command bar at any
window width.** Try it narrow — around 1024px is where it used to appear.

**10.3 — A stat popover is not clipped**
At a narrow width, hover the rightmost command bar stat (GDP). The full
breakdown panel must be visible; it used to be cut off by the bar's overflow
container. Check the leftmost (Treasury) too.

**10.4 — CPU while idle**
With the Treasury screen open and the clock running at 5x, the tab should not
peg a core. Before the fix this screen ran two 365-day forward simulations four
times a second — about 2,900 simulated days per second of wall time.

---

## 11. Taxes as instances — Phase 2 brief §4.3

Most of this is asserted in `src/components/game/treasuryInstances.test.tsx`.
These are the parts worth seeing with your own eyes, because the point of the
change is what the screen does.

**11.1 — Treasury opens with three taxes and says so**
The Taxation panel should be headed by "3 taxes in force" and show sliders for
the Impost of 1789, the excise on distilled spirits and the direct tax on land.
The last two sit at zero: there was no federal excise until 1791 and no federal
direct tax until 1798.

**11.2 — A tax gains a name and a date when it is actually enacted**
Play to March 1791 and take the whiskey excise. The excise slider's label should
change from "Excise on distilled spirits" to "Whiskey Excise of 1791", and its
statutory exemption for small private stills should appear beneath it.
*Problem if:* the label does not change — that would mean the event moved a rate
rather than enacting a statute.

**11.3 — Repealing a tax removes its line**
Reach the Whiskey Rebellion in 1794 and choose to repeal the excise. The slider
should **disappear** and the header drop to "2 taxes in force".
*Problem if:* the slider stays at zero. A repealed statute is not a tax at nought.

**11.4 — Every dollar names its source**
Scroll to "Where the revenue comes from". There should be one row per tax, each
naming the tax and its base, with columns for what was assessed, what was not
remitted, what was uncollected, and what was received. The Received column plus
the fees row must **add up to the Total receipts row.**
*Problem if:* it does not reconcile. A test asserts this, so tell me.

**11.5 — The two kinds of loss are distinguishable**
Raise the excise hard and let it run a year. "Not remitted" should grow for the
excise as frontier compliance collapses, while "Uncollected" stays put — the
first is consent, the second is administrative reach, and they should not move
together.

**11.6 — Historical context travels with the tax**
Expand "Historical context" under any tax. It should give the statute, its date
and its citation. Under the impost that is the Tariff Act of 4 July 1789,
1 Stat. 24.

---

## 12. Political capital — Phase 2 brief §3

Asserted in `src/sim/politicalCapital.test.ts` (30 tests) and in
`treasuryInstances.test.tsx`. These are the parts to feel rather than assert.

**12.1 — It is in the command bar, and it explains itself**
A "Capital" stat should sit between Debt and Stability, reading something like
"32 / 108". Hover it: the popover explains the **accrual rate**, not the stock,
because the rate is what the player's decisions actually move. Base plus each
contribution must sum to the total.

**12.2 — It ticks up every day, not once a month**
Press play at 1x and watch. The first number should rise continuously.
*Problem if:* it jumps once a month — that would mean accrual has been folded
into the monthly recompute.

**12.3 — The ceiling is real**
Let a game run an hour without spending anything. Capital should sit against its
ceiling and stop. That is the mechanic: hoarding is not a strategy.

**12.4 — Acting costs, and being unable to act is explained**
On Treasury, drag the tariff a long way. A line should appear giving the price
and your reserve. Drag it far enough and Enact should **disable**, with a
sentence saying how many days of accrual short you are.
*Problem if:* Enact stays enabled and then fails, or disables with no reason.

**12.5 — The administration starts at nothing and grows**
Start a new game and open Government. On 30 April 1789 no executive department
exists — State was created 27 July, War 7 August, the Treasury 2 September. The
capital accrual rate should be visibly lower in the first weeks than a year in.

**12.6b — Legislation is where capital goes**
Open Legislation and try to pass the Direct Tax of 1798 at the top of its range.
It should cost around 95 political capital — a serious act, several weeks of
accrual, not something to do casually.

**12.6 — Emergency powers, and their end**
Reach the Whiskey Rebellion of 1794 and call out the militia. A ⚡ should appear
beside Capital, the ceiling should jump, and accrual should roughly double. Then
keep playing: after about nine months the chronicle should record "Emergency
powers lapse" and the ceiling should fall back.
*Problem if:* the powers never end. Temporary powers the game forgets to end are
not temporary, and that is the failure mode worth watching for.

---

## 13. Legislation — Phase 2 brief §4

Asserted in `src/sim/bills.test.ts` (38 tests) and
`src/components/game/legislation.test.tsx` (15). These are the parts to read
rather than assert.

**13.1 — Every department is listed, including the empty ones**
Open Legislation. All seventeen departments should appear. Education,
Agriculture, Health & Welfare and Elections have little or nothing in this
period, and each should say what it is waiting for rather than being hidden.
*Problem if:* a department is missing. A player should be able to see the shape
of the government they do not yet have.

**13.2 — A locked bill teaches you something**
Find "A Duty on Exported Staples" under Taxation. It should be locked, and the
reason should quote Article I §9 cl. 5 in full — not "unavailable". Do the same
for "A Federal Tax on Incomes": the reason should explain apportionment and name
the Sixteenth Amendment.
*Problem if:* either says only that it is locked. A lock with a shrug for a
reason teaches nothing, which is the one thing a locked bill must not do.

**13.3 — Counterfactual is not the same as locked**
"A General Tax on Retail Sales" is marked Counterfactual and is **passable**.
"A Federal Plan of Gradual Emancipation" likewise — at a price of about 200
political capital and total planter opposition. Neither should be locked.
*Why:* locking them would say the Constitution forbade them, which is false.
Pricing them says the true thing: possible, and nobody could carry it.

**13.4 — Passing a tax bill creates a Treasury line**
Reach 1794, pass the Carriage Duty, then open Treasury. A slider called
"Carriage Duty of 1794" should be there, and after the next 1st of the month a
row in "Where the revenue comes from" naming `carriage_duty_1794` as its origin.
Repeal the bill and both should disappear.
*This is the requirement the brief states most plainly.*

**13.5 — Effects phase in**
Pass the Judiciary Act and hover Stability immediately. Its contribution should
be **zero** on the day of signature and grow over the following months, reaching
its full +5 after 270 days. The popover arithmetic must still add up at every
point in between.
*Problem if:* the full effect lands at once, or the popover shows a number the
stat does not reflect.

**13.6 — Who gains and who loses, with reasons**
Every bill card lists its bloc reactions with a strength and a clause of
explanation. Read the Commercial Discrimination bill: artisans +70 and merchants
−75, each with a reason a person could argue with.

**13.7 — Sources on every tier**
Expand "Historical context" on an enacted bill, a proposed one and a
counterfactual one. All three should carry a factual note and at least one
citation. The counterfactual needs it most: it tells the player what they are
departing from.

---

## 14. The monarchy path — Phase 2 brief §2.1

Asserted in `src/sim/grievance.test.ts` (38 tests) and
`src/components/game/monarchy.test.tsx` (12). These are the parts to feel.

**14.1 — A decree states its whole price**
Found a monarchy. Open Legislation and look at any bill with strong opposition —
the Direct Tax of 1798 is the clearest. The card should show three costs:
political capital (a fraction of what a republic pays), legitimacy, and
grievance, with a line explaining that no vote is required.
*Problem if:* only the capital cost appears. Showing one side of the bargain
misrepresents the choice entirely.

**14.2 — The same bill costs a republic differently**
Start a republic and compare the same card. The capital price should be
roughly three times higher, and there should be no legitimacy or grievance line.
*Why:* the republic's cost is already charged in capital, which is dear because
a coalition has to be assembled. Charging both would make it strictly worse.

**14.3 — Grievance is specific, and it names names**
As a monarch, decree three or four measures the planters hate. Open Regions. The
South should grow a Grievance panel reading "Chiefly the planters", and the
other regions should stay clear.
*Problem if:* every region gains grievance equally. The whole design is that
decreeing against the planters builds planter grievance, not generic unhappiness.

**14.4 — The warning comes before the bill**
Keep going. Sentiment in the aggrieved region should fall first, then — past 35
— compliance, and the chronicle should record "Quiet non-payment in the South"
naming the bloc behind it. Past 55 it becomes "Open defiance"; past 78, "Armed
rising".
*This is the Whiskey Rebellion as a warning shot rather than a one-off, which is
what the brief asked for.*

**14.5 — It should be impossible to be surprised**
At no point should a revolt arrive without the Regions screen having shown the
grievance climbing for months beforehand.
*Problem if:* it does. Then the warning channel is not working, and the mechanic
is a punishment rather than a system.

**14.6 — The crown dies**
Play a monarchy for a decade at 4x. The ruler should die at some point — the
chronicle records it, the name in the command bar changes, legitimacy drops by
9, and **you carry on governing**. There is no game over.
*Problem if:* the game ends, or the ruler never ages past his starting year.

**14.7 — The succession outlook is stated, and you control it**
Open Government. While legitimacy is healthy it should read that the succession
is settled and would pass without argument. Decree recklessly until legitimacy
falls below about 42, then look again: it should warn that no successor is
beyond argument and that your death would be a crisis.
*Problem if:* the outlook never changes. Then the crisis is a die roll, not a
consequence.

**14.8 — Determinism survives all of it**
Save a monarchy, note the date the king died, reload the save and replay. Same
king, same day. Mortality is the first random thing in the simulation and it
must still replay exactly.

---

## 15. Congress, and the republic's half of the bargain

*Phase 2, queue item 7. Start a **republic** unless a step says otherwise.*

**15.1 — The count is visible before you commit**
Open Legislation and look at any unlocked bill. Under it should be a projected
division: House and Senate separately, votes for and against, how many are
undecided, and whether it would pass. Nothing here should require you to
introduce the bill first.
*Problem if:* you have to spend capital to find out whether a bill can pass.
That turns legislation into a slot machine.

**15.2 — The reasons are inspectable, like every other number**
Click "Show every delegation". Every state should be listed, grouped by region,
with its seats, its verdict, and the reasons behind it in words — party line,
its own state's interest, and grievance where there is any. The reasons should
add up to the verdict.
*Problem if:* a delegation votes a way its listed reasons do not support. That is
the same defect as a stat that does not equal its contributions.

**15.3 — Region beats party, on the right bills**
Find a bill that divides the sections — a tariff, or anything touching slavery.
Open the breakdown and compare two states of the same party in different
regions. They should disagree.
*Problem if:* every state of a party votes alike. Then party is the only thing
in the model and the sectional politics the game is building toward cannot
happen.

**15.4 — The tools have prices on them, before you use them**
Whip a party, attach a rider, offer a promise. Each should state its cost in
political capital **on the button**, move the projected count when applied, and
say plainly that whipping and riders are spent whether the bill carries or not.
The promise should warn that it comes due later at twice what it cost.
*Problem if:* a cost appears only after the fact.

**15.5 — A bill can actually be refused**
Introduce something the projected count says will fail. It should fail. The
chronicle should name the chamber that refused it and give the division;
legitimacy should drop; the bill should go on a cooldown and be visibly
unavailable until it expires.
*Problem if:* everything you introduce passes. Then Congress is scenery and the
republic has no half of the bargain.

**15.6 — Losing repeatedly costs more each time**
Lose three bills. The third should cost more standing than the first, and the
Congress screen should say so rather than leaving you to notice.

**15.7 — A promise comes due**
Buy votes with a promise, then keep playing. On the due day the government pays
— capital if it has any, legitimacy if it does not. The Congress screen should
list the promise as outstanding, with its cost, the whole time.
*Problem if:* a promise is never called in. Then it is free votes.

**15.8 — Elections re-seat the country as it now is**
Play through 4 March of an odd year. A new Congress should convene, the
chronicle should name the largest party in each chamber, and any whipping you
paid for should be gone — while cooldowns, promises and your record of defeats
survive.
Now do it deliberately: alienate one region badly (decree at it, or tax it
hard), then play to the next election. That region should return members who
vote you down.
*Problem if:* the composition never moves. Then elections are a date on the
calendar.

**15.9 — The Senate lags the House**
Right after that election, open Congress and compare the two chambers' party
splits. They should differ, and the Senate should be closer to where opinion was
*before* the swing. The note under it should say why — a third at a time,
Article I §3.
*Problem if:* the two chambers always match. Then the Senate is a small copy of
the House and there is no constitutional brake (`DECISIONS.md` D-032).

**15.10 — The screen is honest about what it knows**
On the Congress screen the seat totals should be presented as history with their
citation, and the party split should say in plain words that it is a model.
*Problem if:* the party split is presented as a historical figure. That is the
one rule in this project with no exceptions (`BLOCKERS.md` B-006).

**15.11 — A monarchy sees none of it**
Start a monarchy and open Legislation. There should be no whip counts anywhere —
there is no vote to project. The Congress screen should explain that this is the
legislature you do not need, and point at the grievance you are accumulating
instead.
*Problem if:* a monarchy is shown a projected division. It would be projecting a
vote that cannot happen.

---

## 16. Blocs — who the country is made of

*Phase 2, queue item 8. `ECONOMY.md` §7.21, `DECISIONS.md` D-033 to D-035.*

**16.1 — Every region says who lives in it**
Open Regions. Under each region's stats there should be a "Who lives here"
list: the blocs, largest first, each with a share.
*Problem if:* a region shows no blocs, or shows all eight at identical shares.

**16.2 — The shares do not add to a hundred, and the screen says why**
Add up the frontier's shares. They come to about 137%. The note underneath
should explain that people belong to more than one at once.
*Problem if:* there is no note. The first thing a careful reader does is add the
column up, and without the note they will conclude the screen is broken.

**16.3 — The South's missing four tenths are named**
Look at the South. Its shares come to about 60%, and the note should say that a
further third of the region were enslaved and belonged to none of these,
having been allowed no political interest at all.
*Problem if:* the shortfall is silent, or the enslaved have been quietly folded
into "small farmers" to make the column tidy. That would be the project's
hardest rule broken by rounding.

**16.4 — A statute changes the country, not just its mood**
Start a monarchy so you can decree freely. Pass **Bounties on Manufactures** at
the top of its slider, then run several years at speed. Come back to Regions:
the artisans in the Mid-Atlantic and New England should be visibly larger than
they were, marked "growing", and the small farmers slightly smaller.
*Problem if:* nothing moves. Then blocs only ever get happier or angrier, which
is exactly what item 8 was for.

**16.5 — It takes years, not weeks**
Watch how long that takes. It should be years of game time before the change is
worth noticing, and it should still be moving after a decade.
*Problem if:* a bloc jumps within a month or two. Occupations do not change
because a statute passed, and a bloc that snaps makes policy feel like a switch.

**16.6 — Taking a law back leaves the country roughly as it was**
Pass the bounties, run one year, then repeal. Run two more. The artisans should
end up close to where they started.
*Problem if:* a brief experiment permanently rebuilds the economy.

**16.7 — Where a bloc lives determines where its anger lands**
Play long enough for the artisans to have grown substantially in one region,
then decree something they hate. The grievance should show up where they now
are.
*Problem if:* anger lands where the bloc used to be. Then membership is moving
on screen without anything downstream reading it.

**16.8 — The founding sits still**
Start a fresh game and run a year with no legislation at all. The bloc shares
should be essentially unchanged, and nothing should be marked growing or
shrinking.
*Problem if:* the country starts changing on its own from day one. The founding
is meant to be an equilibrium, not a slope.

**16.9 — Direction is never carried by colour alone**
A growing bloc should say "growing" with an arrow, and a shrinking one
"shrinking". (UI.md §10)
*Problem if:* the only difference is that one number is green.

**16.10 — An old save loads into its own country**
Load a save made before this update. It should open with the founding shares
and then start changing from its own date onward — not lurch on the first month,
and not arrive with a decade of change it never made.

---

## 17. The map

*Phase 2, queue item 9. `DESIGN.md` §8.4, `DECISIONS.md` D-036 to D-038.*

**17.1 — The map is the first thing you see**
Start a game. The main view should be a map of the United States, with the old
Desk panels — vitals, treasury, crises, active laws — beneath it.
*Problem if:* the Desk is still the landing view, or the Desk's panels have been
thrown away with it.

**17.2 — It is 1789, not the present day**
Look at the political map on day one. Eleven states should be in the union.
North Carolina and Rhode Island should be a different colour and, when clicked,
say they are outside it. Everything west of the Appalachians should be
territory, Spanish, or disputed — not American states.
*Problem if:* the map looks like a modern one with fifty states.

**17.3 — It changes as the country does**
Play to 1791 and watch Vermont join; to June 1792 for Kentucky; to June 1796
for Tennessee. Each should change colour on its real date.

**17.4 — The four modes are one click away**
Political, Support, Economic, Party. Each should recolour the map immediately
and change the legend.
*Problem if:* a mode changes the legend but not the map, or vice versa.

**17.5 — Every colour has a word next to it**
Check each legend. Every band should be labelled in words — "Hostile",
"Prosperous", "Organised territory". Hovering a state should give the same word
in its tooltip.
*Problem if:* any band is a swatch with no label. (UI.md §10)

**17.6 — Areas with no figure are visibly empty, and counted**
Switch to Support in the 1790s. The western territories should be a flat,
obviously-empty fill — not a middling shade — and the legend should say how
many areas have no figure. Click one: it should explain that it has no
sentiment toward a government it is not part of.
*Problem if:* a territory is shaded as though it had a middling opinion. That is
a fabricated number wearing a colour.

**17.7 — The map says what it is actually measuring**
Under the legend, the Support map should say the figures are regional and that
every state in a region is therefore the same colour. Check: Virginia and
Georgia should match, always.
*Problem if:* it implies a per-state figure this model does not have.

**17.8 — Party is the one map where states differ within a region**
Switch to Party. States in the same region can and should differ. The legend
should name the parties that existed on the date — Pro- and Anti-Administration
before 1793, Federalist and Democratic-Republican after — and say plainly that
the seat counts are historical while the split is a model.
*Problem if:* the party split is presented as a record of how a state voted.

**17.9 — The modern-outline caveat is on the map itself**
Read the line under the map. It should say the outlines are modern boundaries,
and name West Virginia and the District of Maine as the two obvious cases.
*Problem if:* the caveat lives only in DESIGN.md. The brief asked for it to be
stated in-game rather than discovered.

**17.10 — Clicking anything explains it**
Click a state, a territory, a foreign holding. Each should open a panel with the
name it had on that date — "Territory South of the River Ohio", not "Tennessee";
"Spanish Louisiana", not "Louisiana" — and a line of context.
*Problem if:* a click does nothing, or the panel shows the modern name.

**17.11 — The long view**
If you can get a run to 1860, the map should be recognisably the country of that
year: Texas and California in, Kansas still a territory. That is the map the
sectional crisis was fought over, and it should be legible.

---

## 18. The rest of the map, and the state detail panel

*Phase 2, queue item 10. `DECISIONS.md` D-039 to D-041, `ECONOMY.md` §7.22.*

**18.1 — Seven modes, not four**
Political, Support, Economic, Party, Population, Sectional strain, Compliance.
*Problem if:* Infrastructure or Military have appeared. They were deliberately
not built, because the model has nothing to draw them from — see B-007. If
someone has shipped them, check very carefully where the numbers came from.

**18.2 — Population is the one economic-looking map where states differ**
Switch to Population. Virginia should be visibly larger than Georgia, and New
York than Delaware. The legend note should say the 1790 census figures are real
and the growth applied to them is the region's.
*Problem if:* every state in a region is the same size. The census says they
were not.

**18.3 — Sectional strain shows the South from day one**
Start a fresh game and open Sectional strain immediately. The South should
already be well up the scale. **That is correct and is not a bug.** A third of
its people were enslaved, that is the axis the conflict was fought on, and a map
where 1789 looks calm would be lying about 1789.

**18.4 — And it responds to what you do**
Decree repeatedly against one region, or tax it hard, until grievance builds.
Its strain should rise. Then alienate a region in the opposite direction — make
one adore the government while the others are cool — and watch that one's strain
rise too.
*Problem if:* only unhappiness raises strain. A region that feels utterly
differently from everyone else is pulling away whichever way it leans.

**18.5 — Compliance is the rebellion warning**
Push a region into unrest. On the Compliance map it should slide down the bands,
and clicking it should name the episode running there.
*Problem if:* compliance stays green through an armed rising.

**18.6 — The detail panel says where each figure comes from**
Click Virginia. You should get the region's prosperity, sentiment, compliance
and strain; the delegation with its seats and party shares; the 1790 census
figures in the steel reserved for historical data, including how many people
were enslaved.
*Problem if:* the census figures are in the same colour as simulated ones.

**18.7 — And it says what it does not know**
The panel should end with a "Not tracked" list: no roster of members, the
economy figures are regional, no roads or garrisons by state.
*Problem if:* that block is gone. Without it a missing row reads as a zero, and
the brief asked for notable figures which this model genuinely does not have.

**18.8 — Outside the union means none, not zero**
Click Spanish Louisiana in the 1790s. It should say the model simulates no
economy or sentiment outside the union, and that this is "not zero, none".
*Problem if:* it shows a prosperity of 0. That would be a measurement, and none
was taken.

**18.9 — The record is cited**
Any territory you click should show the act or treaty behind its status —
"Act of 26 May 1790" for the Southwest Territory, the Louisiana Purchase Treaty
for Louisiana.

---

## 19. Diplomacy

*Phase 2, queue item 11. `DECISIONS.md` D-042 to D-044, `ECONOMY.md` §7.23.*

**19.1 — The world is there, and it is not neutral**
Open Diplomacy on day one. Britain should be cool, France warm, Algiers
hostile, Morocco friendly. Each power should name its government and its ruler.
*Problem if:* everybody starts at zero. The first decade's diplomacy was
constrained by an inheritance and the screen should show it.

**19.2 — Governments change with the date**
Look at France in 1791, then play to 1793, 1796 and 1800. Louis XVI, then the
National Convention, then the Directory, then Bonaparte.
*Problem if:* the ruler never changes.

**19.3 — Gaps are gaps, and say why**
Look at the Cherokee, the Muscogee, Spain. Where there is no population figure
the panel should say "no verified figure" and explain — estimates vary, nobody
counted, no source at the required standard.
*Problem if:* you see a dash, a zero, or a number with no citation. The rule
that governs our own figures governs theirs.

**19.4 — Native nations are polities, not scenery**
They should be in the same list as Britain, with rulers, interests, sources and
a real military strength. The Northwestern Confederacy's context should mention
St Clair's defeat and Greenville.
*Problem if:* they are grouped as obstacles, or their strength is nil. They
destroyed two American armies.

**19.5 — A minister costs, and buys little**
Send one to Britain. Political capital should drop by the stated amount and the
relation should improve slightly. Send several: it should take many missions to
move a relationship far.
*Problem if:* one mission transforms a relationship. Then every treaty
prerequisite can be bought past in a single action.

**19.6 — And stopping loses it**
Improve a relation substantially, then play a few years without touching it. It
should drift back toward where it started — not to zero, toward that power's own
baseline.

**19.7 — A treaty you cannot sign says why**
Open Britain and look at full commercial reciprocity. It should say relations
are too poor and name the figure needed. Open it before 1794 and the Jay Treaty
should say it is not available yet; after 1798, that the moment has passed.
*Problem if:* any treaty is greyed out with no reason.

**19.8 — A treaty changes the actual economy**
Sign Pinckney's Treaty. Over the following year or two the frontier's prosperity
and sentiment should rise on the Regions screen and the map. Open the stat
popover on frontier prosperity: **the treaty should be a named line in the
breakdown**, alongside any laws.
*Problem if:* the effect appears but the treaty is not in the breakdown. Then
there are two economies.

**19.9 — And it does not land all at once**
The effect should phase in over months, like a statute does.

**19.10 — Pleasing one power displeases another**
Sign the Jay Treaty. Britain should improve sharply and France should fall
sharply. That is what happened.

**19.11 — Tribute is real money, every year**
Sign the treaty with Algiers. The one-off cost should come out of the balance
immediately, and the civil outlay line in Treasury should rise by the annual
tribute and stay risen.
*Problem if:* tribute is invisible in the Treasury. It was about a fifth of
federal spending and hiding it would misrepresent the decade.

**19.12 — Breaking your word costs at home**
Repudiate a treaty. Its effects should leave the ledger immediately, relations
should fall hard, and legitimacy should drop.
*Problem if:* repudiation is free, or the effects linger.

**19.13 — An old save inherits the world but not the achievements**
Load a save made before this update. Relations should be at their 1789
baselines and **nothing should be signed** — even if the save's date is after
the Jay Treaty was historically concluded. A treaty is something the player
earns.

---

## 20. War

*Phase 2, queue item 12. `DECISIONS.md` D-045 to D-047, `ECONOMY.md` §7.24.*

**20.1 — A crown declares; a republic asks**
Open Diplomacy on a monarchy and expand any power. The button should read
"Declare war" and the note above should say the crown declares and nothing can
refuse it. Start a republic and the same button should read "Put it to
Congress", with a note that it can be voted down.
*Problem if:* both paths use the same wording. They are different acts.

**20.2 — The republic can actually refuse**
As a republic, try to declare war on Britain on a manufactured grievance. It
should be voted down, the chronicle should record which chamber refused and by
what division, and the capital should still be spent.
*Problem if:* it passes, or the failed attempt is free.

**20.3 — And can be persuaded**
Try the Algerine captures as a republic. Unwhipped it should fail — the seamen
and merchants want it and are outnumbered. Whip both parties hard and it should
carry.
*Problem if:* no amount of whipping moves it. Then the tools are decoration.

**20.4 — The crown cannot be refused, and pays for it**
As a monarchy, declare on a manufactured grievance. It happens immediately.
Legitimacy should drop sharply, and the blocs that opposed it should show new
grievance on the Regions screen.

**20.5 — The price is on the label before you commit**
Each ground should show how good a case it makes out of 100, what it costs in
capital, roughly what it costs in legitimacy, and — for a weak or manufactured
one — that every other power will think less of us.
*Problem if:* any of that only becomes visible after the declaration.

**20.6 — Aggression really does invite foreign hostility**
Note your relations with everyone, then declare on a manufactured pretext.
**Every** other power's relation should fall, not just the victim's.
*Problem if:* only the victim reacts. A government that invents its reasons once
is one nobody can safely sign anything with.

**20.7 — A good case costs almost nothing abroad**
Declare on the Algerine captures instead. Britain and France should be
unchanged.

**20.8 — Diplomacy closes the grounds**
Look at Spain's grounds: the closure of the Mississippi should be there. Sign
Pinckney's Treaty and look again — it should be gone. Do the same with Britain
and the Jay Treaty: the retained posts disappear, and **impressment does not**,
because the treaty was silent on it.
*Problem if:* signing a treaty leaves its grievance available, or removes one it
never addressed.

**20.9 — A war is felt**
While at war, trade capacity should carry a named "War with…" line in its
breakdown, stability should fall, and weariness should climb month by month.
*Problem if:* the war has no line in the ledger.

**20.10 — A bad war gets worse**
Run two games: one at war on a strong case, one on a fabricated one. After a
year, the fabricated war's weariness should be visibly higher.

**20.11 — Peace is a judgement, not a gamble**
Before seeking peace the panel should say what terms are on offer today. Play on
and watch them change as the country tires. Seeking peace twice from the same
position should give the same answer.
*Problem if:* the terms vary at random. With no combat to simulate there is
nothing for a die roll to represent, and it would make "fight on or settle"
unanswerable.

**20.12 — Winning is worth something**
Make peace from a strong position: legitimacy should rise. From an exhausted
one: it should fall.

**20.13 — No treaties with a power you are fighting**
While at war with Spain, Pinckney's Treaty should say there is a war on.

---

## 21. The cabinet

*Phase 2, queue item 13. `DECISIONS.md` D-048 to D-050, `ECONOMY.md` §7.25.*

**21.1 — The cabinet you inherit is history's, and the screen says so**
Open Government at the start. Each office should name its holder and say "as
history had it". Play to 1793 and the Treasury should read Hamilton.
*Problem if:* it says "your appointment" for someone you never chose.

**21.2 — Competence and loyalty are in words, not only numbers**
Each holder should carry both, with a word — "The best available", "Out of his
depth", "Openly at odds".
*Problem if:* either is a bare number, or is only a colour.

**21.3 — The ratings are labelled a model**
Read the note under the cabinet. It should say the biographies are cited history
and the ratings are a model, that nobody rated these men out of a hundred, and
that they are not a verdict on anybody.
*Problem if:* that note is missing. These are real people and the screen must
not imply the numbers are historical fact.

**21.4 — A bad appointment is a real cost**
Play to 1797, when McHenry holds the War Department at 40. Compare the
administration figure with 1794, when Hamilton and Bradford were in post. It
should be lower. Open a stat the Treasury affects — regional compliance — and
the Secretary should appear **by name** in the breakdown.
*Problem if:* a weak officer merely fails to help. The brief asks for collection
efficiency to drop, and it should drop.

**21.5 — The Senate can refuse a president his own cabinet**
As a republic, try appointing Hamilton to the Treasury. The Senate should refuse
— he is against the planters, the small farmers and the frontier at once — the
chronicle should record the division, and the capital should be gone anyway.
Then try Anthony Wayne at War: the frontier's own general should be confirmed.
*Problem if:* every appointment sails through. Article II §2 is not decoration.

**21.6 — A crown appoints whom it likes**
Do the same on a monarchy. Hamilton goes in without anybody being asked.

**21.7 — Loyalty falls for a reason you can trace**
Appoint Jefferson to State in 1791, then pass measures his people hate — the
Bank, the excise. His loyalty should fall each time, and the word beside it
should change.
*Problem if:* loyalty moves at random, or never moves.

**21.8 — And a resignation can be seen coming**
Keep going. When his loyalty crosses the line he should resign **publicly**: a
crisis entry in the chronicle, legitimacy down, and the office back to whoever
history had in it.
*Problem if:* he resigns without warning. A number you can watch crossing a line
you can see is the whole difference between a consequence and a punishment.

**21.9 — And a quiet spell brings him back, but only so far**
Stop antagonising an officer and his loyalty should recover — toward the value he
started at, not past it. A sceptic does not become a partisan because a quiet
year passed.

**21.10 — Candidates explain themselves before you choose**
Click "Consider someone else". Each candidate should show a real biography with
sources, competence and loyalty in words, and the price. A candidate you cannot
appoint yet should say why rather than being hidden.

**21.11 — An old save keeps the cabinet it had**
Load a save from before this update. Every office should still show its
historical holder, marked "as history had it", with nothing marked as yours.

---

## 22. Theming, assets and audio

*Phase 2, queue item 14. Full documentation is `docs/THEMING.md`;
`DECISIONS.md` D-051 to D-053.*

**22.1 — Settings opens**
A "Settings" button beside "Saved games". It should open a panel with appearance
and sound.

**22.2 — The second skin actually works**
Switch to Parchment. **Every screen** should invert to dark ink on paper — the
shell, the panels, the map, the chronicle. Walk through all nine sections.
*Problem if:* any panel, border, or map fill stays dark. That is a hardcoded
value the audit missed, and it is exactly what the stub skin exists to find.

**22.3 — And it says it is a stub**
The Parchment option should say it is a working stub, not a finished design, and
that it has not been through a contrast audit.
*Problem if:* it presents as finished. The contrast work in UI.md §10 was
measured against Ledger only.

**22.4 — The choice survives a reload**
Switch skins, reload the page. It should still be the skin you chose. Load a
saved game: the skin should not change, because it belongs to you rather than to
the republic.

**22.5 — Nothing moves when you switch**
Watch a dense screen — Treasury or the map — while switching skins. Colours
change; **nothing reflows**. No text rewraps, no panel resizes.
*Problem if:* the layout shifts. A skin must not be able to change dimensions.

**22.6 — Portraits are reserved, and labelled**
Open Government. There should be a portrait plate beside the ruler and a small
one beside each cabinet office, each a grey box reading `portrait/<name>`.
*Problem if:* the boxes are missing, or are a different size from each other.
The whole point is that real art drops in without moving anything.

**22.7 — The sound controls are there and honest**
Settings should have a mute toggle and four sliders — overall, music, events,
interface — and should say plainly that there are no sounds yet.
*Problem if:* the controls are absent, or present with no explanation. A dead
control with no note reads as a bug.

**22.8 — And they persist**
Set music to 30%, mute, reload. Both should come back as you left them.

**22.9 — Muting disables the sliders and says "Muted"**
Not just greyed out: the word should replace the percentage.

**22.10 — Nothing in the interface is a hex value**
This one is enforced by a test rather than by eye
(`src/lib/theming.test.ts`), which reads the source of every component. If it
ever fails, a colour has been hardcoded and is no longer skinnable.

---

## 23. The causal web

*Phase 2, queue item 15. `DECISIONS.md` D-054 to D-056, `ECONOMY.md` §7.26.*

**23.1 — It opens on a question, not on a hairball**
Open "Causes". It should show the treasury balance with its neighbourhood — a
few dozen nodes, not the whole model.
*Problem if:* it opens on everything. A screen that answers all questions at
once answers none.

**23.2 — Clicking a node asks a question of it**
Click customs. The panel should re-focus: what moves customs, and what customs
moves next, each with the reason in words.

**23.3 — The reasons are sentences, not labels**
Every link in the side panels should carry a plain-English claim — "customs are
levied on what actually crosses the wharf, not on what would have".
*Problem if:* a link is only an arrow and a weight.

**23.4 — Hovering a line says why it exists**
Hover any edge in the diagram. A tooltip should give the causal claim.

**23.5 — Both kinds of line are explained**
Under the diagram: solid lines are how the country transmits an effect, dashed
are what the statute book is doing now, thicker is stronger.
*Problem if:* the two kinds are distinguished only by appearance with no key.

**23.6 — What is acting right now matches the stat popover**
Focus a stat that has laws on it — national stability after passing a few bills.
The "what moves it" list should name exactly the same sources, with the same
values, as the popover on that stat elsewhere in the game.
*Problem if:* they differ by so much as a source. Two screens describing one
number must agree; that is what the ledger is for.

**23.7 — Follow a chain**
From the treasury balance, click "Follow it further" on debt principal. You
should get a path — balance → debt principal → debt service → balance — with the
claim at each hop and a statement of the net effect.

**23.8 — The tariff refuses to have a direction**
Show everything, focus the tariff rate, and trace it to trade volume. The net
effect should say **"not in one direction — a link on this path turns"**.
*Problem if:* it claims a direction. Revenue rises with the rate to 25% and
falls after; asserting a sign would put the model's most common
misunderstanding on screen as a fact.

**23.9 — Nothing moves when the clock runs**
Start the clock at 4x and watch the web. Line weights may change as laws phase
in; **nodes must not move at all.**
*Problem if:* the layout settles or drifts. The layout is deterministic
precisely so that reading it while time passes is possible.

**23.10 — A screen with no causes says so**
Focus something the model declares no cause for — cabinet competence. It should
say nothing is acting on it and that this is an answer rather than a gap.

**23.11 — The whole graph is available and honest about itself**
"Everything at once" should show the full web, with a note saying it is worth
looking at once and that focusing is the view that answers anything.

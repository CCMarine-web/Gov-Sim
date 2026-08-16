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

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

**12.6 — Emergency powers, and their end**
Reach the Whiskey Rebellion of 1794 and call out the militia. A ⚡ should appear
beside Capital, the ceiling should jump, and accrual should roughly double. Then
keep playing: after about nine months the chronicle should record "Emergency
powers lapse" and the ceiling should fall back.
*Problem if:* the powers never end. Temporary powers the game forgets to end are
not temporary, and that is the failure mode worth watching for.

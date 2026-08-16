# THEMING.md — skins, assets, audio, and what an artist would deliver

**Owner of:** the theme token system, the skin mechanism, the asset registry,
the audio bus, and the interface copy registry.

`docs/UI.md` owns the screen-by-screen specification and the contrast measurements.
This document owns the machinery that lets all of it be replaced.

Built in Phase 2, queue item 14, against `gov-sim-phase2-brief.md` §8:

> "We'll eventually redo the entire visual design around real artwork and add a
> soundtrack. I can't hand you those assets now, so build so that adding them
> later is configuration rather than surgery."

That sentence is the standard everything here is measured against. The test is
not "is it tidy" but **"can this be replaced without editing a component".**

---

## 1. The shape of it

| Concern | Lives in | Replaced by |
|---|---|---|
| Colours, type, spacing, radii, motion | `src/app/globals.css` under `@theme` | Editing a token |
| A named skin | `[data-skin='…']` block in the same file | Adding a CSS block + one entry in `src/lib/theme.ts` |
| Images, portraits, seals, textures, banners | `src/lib/assets.ts` manifest | Editing the manifest |
| Sound cues and music layers | `src/lib/audio.ts` manifest | Editing the manifest |
| Interface copy | `src/content/copy.ts` | Editing the string |
| Player preferences | `src/lib/preferences.ts` → localStorage | — |

**No component contains a hex value, an arbitrary Tailwind value, or an asset
path.** That is enforced by a test (`src/lib/theming.test.ts`) that reads the
source of every `.tsx` under `src/components` and fails on either. It is the one
requirement in this document that decays silently — nothing *breaks* when
somebody writes `stroke="#C9A227"`, it just quietly stops being skinnable — so a
test is the only thing that keeps it true.

---

## 2. Tokens

All in `src/app/globals.css` under `@theme`, which is where Tailwind v4 is
configured. Every token generates utilities automatically: `--color-ink-800`
gives `bg-ink-800`, `text-ink-800`, `border-ink-800`.

The families, and what each is for:

| Family | For |
|---|---|
| `ink-*` | Shell, chrome, structure. The ground. |
| `parchment-*` | Dense content surfaces |
| `content-*` | Text, by prominence |
| `brass-*` | The player's authority; primary actions; focus |
| `oxblood-*` | Danger, deficit, crisis |
| `verdigris-*` | Favourable, surplus |
| `steel-*` | **Historical and benchmark data only.** No simulated value and no chrome may use these (UI.md §9) |
| `map-*` | Choropleth fills only, never text (UI.md §11a) |
| `size-*` | Fixed layout dimensions and reserved art slots |
| `text-*`, `font-*` | Typography |
| `radius-*`, `duration-*` | Radii and motion |

**Adding a colour means adding a token first.** If a component needs a colour
that is not here, the token comes first and the component references it.

---

## 3. Layout tokens, and why dimensions are tokens too

```css
--size-nav: 200px;              /* left navigation */
--size-feed: 320px;             /* chronicle column at ≥1280px */
--size-feed-drawer: min(320px, 85vw);
--size-table-history: 720px;    /* minimum before horizontal scroll */
--size-table-treasury: 42rem;
```

These were `w-[200px]` and `min-w-[42rem]` in components until item 14. A skin
that wants a wider navigation, or a redesign that changes the shell proportions,
should not require finding every arbitrary value in the tree — so they are
tokens, applied through `style={{ width: 'var(--size-nav)' }}`.

Inline `style` with a `var()` rather than a class is deliberate: Tailwind cannot
generate a utility for a value it does not know at build time, and the
alternative is an arbitrary value, which is the thing being removed.

---

## 4. Skins

A skin is **a set of CSS custom-property overrides applied by `data-skin` on the
document element.** It is not props, not context, and not a class components
branch on.

```
src/lib/theme.ts     the NAMES, and applySkin()
globals.css          the VALUES, under [data-skin='…']
```

**Why it has to be CSS.** The brief's requirement is that "a future art-driven
skin should require no component edits". A component that reads a theme *object*
can always be written to branch on it, and eventually one will be. A component
that only emits `className="bg-ink-700"` physically cannot. The switching
mechanism has to live somewhere components cannot reach.

### Shipped skins

| Id | Name | State |
|---|---|---|
| `ledger` | Ledger | **Complete.** The design UI.md specifies and every contrast ratio was measured against. Needs no override block — it *is* `@theme`. |
| `parchment` | Parchment | **A stub.** Dark ink on aged paper. Not contrast-audited, and the settings panel says so. |

`parchment` exists because the brief asks for the mechanism to be "real and
tested rather than theoretical". It **inverts the ground completely**, which is
the harshest thing a skin can do to a layout — so anything in the interface that
quietly assumes a dark background shows up the moment you switch to it. A second
skin that merely shifted a hue would prove nothing.

### Adding a skin

1. Add a block to `globals.css`:
   ```css
   [data-skin='yourskin'] {
     --color-ink-800: …;
     /* only the tokens that differ */
   }
   ```
2. Add an entry to `SKINS` in `src/lib/theme.ts`.
3. There is no step 3. It appears in settings, persists, and applies.

**Contrast is your responsibility.** UI.md §10 requires AA for body text, and
those ratios were measured against `ledger`. They do not carry over. A skin that
has not been audited must set `complete: false`, which makes the settings panel
say so.

---

## 5. Assets — what an artist would deliver

Everything is referenced by a **logical key** through `src/lib/assets.ts`:

```ts
assets.portrait('hamilton')   // never a path
assets.seal('national')
assets.banner('founding')
```

Until a file exists, the registry returns a **generated inline SVG placeholder**
at the correct dimensions, carrying its own key as a label. So a screenshot of
the game names every missing asset and what to call the file that replaces it.

Placeholders are generated rather than committed on purpose: a placeholder file
can itself go missing, and the failure then looks like a bug rather than an
absence. A generated one cannot 404 and cannot be mistaken for a design decision.

### What is needed

| Kind | Key examples | Dimensions | Format | Notes |
|---|---|---:|---|---|
| `portrait` | `washington`, `hamilton`, `jefferson`, `knox`, `randolph`, `adams`, `unknown` | **96 × 120** (4:5) | SVG preferred; PNG at 2× (192 × 240) acceptable | The proportion of the period's engraved portraits. Head and shoulders; the frame does not crop. `unknown` is a monogram plate for a player-named ruler, who has no likeness |
| `seal` | `national`, `treasury`, `war`, `state` | **64 × 64** | SVG required | Must read at 64px *and* at 256px on the title screen |
| `texture` | `parchment`, `linen` | **512 × 512**, tileable | PNG or WebP | Seamless. Panel and shell grounds |
| `banner` | `founding`, `chronicle` | **1200 × 120** | SVG or WebP | Safe area is the centre 800px; the edges are cropped at narrow widths |
| `icon` | `quill`, `ledger` | **24 × 24** | SVG required | Only for period-specific marks. Functional icons stay with `lucide-react` |

**Alt text is required** on every portrait and seal, in the manifest rather than
at the call site. An asset with no alt text is an asset a screen reader cannot
report, and portraits are never decorative.

Run `assets.outstanding()` for the live list of what is still missing.

### Delivering them

1. Put files in `public/art/<kind>/<key>.<ext>`.
2. Set `src` in the manifest entry.
3. Nothing else changes. The placeholder stops being used, the dimensions are
   already reserved, and no layout moves.

**The dimensions are the important part.** Reserved slots (`--size-portrait-w`
and its siblings) exist at final size with placeholder fills specifically so that
adding art does not reflow every screen. A placeholder at the wrong size would
guarantee the reflow it exists to prevent.

---

## 6. Audio

`src/lib/audio.ts` is a **silent implementation, not a stub.** There are no
files, so nothing makes a sound. Everything else is real: it resolves cue keys
against a manifest, applies mute and both faders, tracks the current music layer,
and runs crossfades on a real clock.

That distinction matters. A stub that returned instantly would let the interface
develop a dependency on audio being instantaneous — a handler that plays a cue
and assumes the transition is finished. When files arrive that assumption breaks,
and the fix would be in the callers: exactly the surgery the brief is avoiding.

```ts
audio.play('event.crisis');
audio.music.setLayer('war');       // crossfades over CROSSFADE_MS
audio.music.isCrossfading();
```

### Buses

`master` · `music` · `effects` · `ui` — `master` multiplies the others. Volumes
and mute are in the settings panel and persist with the other preferences.

### Cues

| Key | Bus | For |
|---|---|---|
| `event.crisis` | effects | A crisis-tier event opens. Short, low, not a sting |
| `event.decision` | effects | A decision the player must answer |
| `event.enactment` | effects | A bill carries, or a treaty is signed |
| `event.defeat` | effects | Congress votes the government down |
| `event.war` | effects | War is declared |
| `ui.click` / `ui.panel` / `ui.error` | ui | Nearly inaudible |
| `clock.pause` / `clock.resume` | ui | The clock stops and starts |

### Music layers

`menu` · `peace` · `tension` · `war` · `crisis`

HOI4-style: the score follows the state of the country. Layers crossfade over
**2400ms**; setting the layer already playing is a no-op rather than a restart,
so the score does not jump because the country entered the same state twice.

### Delivering audio

1. Files in `public/audio/`.
2. Set `src` in `CUES` or `LAYERS`.
3. Nothing else changes.

Composer's note: layers should be **stem-compatible** — the same tempo and key
across `peace`, `tension` and `war` — so a crossfade between them is a change of
weight rather than a change of piece.

---

## 7. Copy

`src/content/copy.ts` holds the interface chrome: navigation labels, section
titles, shell controls, and the settings panel. One import, typed, no component
inventing a string for a thing that has a name.

**What is deliberately not there**, and why:

- **Prose the engine generates** — chronicle entries, unrest announcements, whip
  count reasons. Already outside JSX, in `src/sim/`. Moving their fragments here
  would scatter one sentence across two files.
- **Content prose** — bill descriptions, historical notes, treaty text, candidate
  biographies. Already in `src/content/`, which is where the brief wants them.
- **The long explanatory paragraphs still inline in panels** — the map's
  modern-outline caveat, the cabinet's ratings note, the Congress screen's
  history-versus-model line. These are arguments rather than labels, they are
  asserted verbatim by tests, and moving them is mechanical work with real
  regression risk. Tracked as `BLOCKERS.md` B-008 rather than half-done.

---

## 8. What a redesign actually costs, today

| Change | Cost |
|---|---|
| New colour scheme | One CSS block |
| New typeface | Two tokens, plus the font in `layout.tsx` |
| Different shell proportions | Three `--size-*` tokens |
| All the artwork | One manifest edit |
| A soundtrack | One manifest edit |
| Rewording the chrome | One content file |
| Restyling a single screen | Component edits — this is the honest exception, and it is the one case where a redesign *is* surgery |

The last row is the current limit of the approach. A screen's *structure* — what
sits beside what — is in its component, and no token system fixes that. What the
work in item 14 buys is that **nothing about a screen's structure has to change
to change how it looks.**

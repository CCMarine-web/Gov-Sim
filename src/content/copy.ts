/**
 * INTERFACE COPY
 *
 * Phase 2 brief §8:
 *
 *   "Copy lives in content files, not inline JSX, so a visual redesign doesn't
 *    mean editing text and a text edit doesn't risk breaking layout."
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IS HERE AND WHAT IS NOT, STATED HONESTLY
 *
 * HERE: the chrome. Navigation labels, section titles, settings, and the
 * standing explanatory notes — everything a redesign would touch and a
 * translator would need, and none of which depends on simulation state.
 *
 * NOT HERE, deliberately:
 *
 *   - PROSE THE ENGINE GENERATES. Chronicle entries, unrest announcements, whip
 *     count reasons. These are built from state by `src/sim/`, are already
 *     outside JSX, and moving their fragments here would scatter one sentence
 *     across two files.
 *   - CONTENT PROSE. Bill descriptions, historical notes, treaty text, candidate
 *     biographies. Already in `src/content/`, which is where the brief wants
 *     them; they are content rather than interface copy.
 *   - THE LONG EXPLANATORY PARAGRAPHS still inline in panels — the map's
 *     modern-outline caveat, the cabinet's ratings note, the Congress screen's
 *     history-versus-model line. These are ARGUMENTS rather than labels, they
 *     are asserted verbatim by tests, and moving them is mechanical work with
 *     real regression risk. Logged as BLOCKERS.md B-008 with the reasoning
 *     rather than half-done.
 *
 * The mechanism is what item 14 owed: a typed registry, one import, and no
 * component inventing its own string for a thing that has a name.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const COPY = {
  /** Left navigation. The order lives in the component; the words live here. */
  nav: {
    map: 'Map',
    treasury: 'Treasury',
    legislation: 'Legislation',
    congress: 'Congress',
    diplomacy: 'Diplomacy',
    regions: 'Regions',
    government: 'Government',
    history: 'History',
    chronicle: 'Chronicle',
  },

  /** Section headings, which are not always the nav label. */
  section: {
    map: 'The United States',
    treasury: 'Treasury',
    legislation: 'Legislation',
    congress: 'Congress',
    diplomacy: 'Diplomacy',
    regions: 'Regions',
    government: 'Government',
    history: 'History',
    chronicle: 'Chronicle',
  },

  /** Shell controls. */
  shell: {
    chronicle: 'Chronicle',
    openChronicle: 'Open chronicle',
    savedGames: 'Saved games',
    settings: 'Settings',
    close: 'Close',
  },

  /** The settings panel, which item 14 introduced. */
  settings: {
    title: 'Settings',
    appearance: 'Appearance',
    appearanceNote:
      'A skin changes every colour in the interface at once. Nothing in the ' +
      'simulation changes, and nothing is saved into your game.',
    incompleteSkin:
      'A working stub rather than a finished design. It exists so the skin ' +
      'mechanism is exercised rather than theoretical, and it has not been ' +
      'through a contrast audit.',
    audio: 'Sound',
    audioNote:
      'There are no sounds yet. The controls are here because the audio bus is ' +
      'built and silent — when music and effects arrive they will already know ' +
      'these settings, and nothing on this panel will change.',
    mute: 'Mute everything',
    muted: 'Muted',
  },
} as const;

/** Every leaf string, for the test that asserts none is empty. */
export function allCopy(): string[] {
  const out: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === 'string') out.push(value);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(COPY);
  return out;
}

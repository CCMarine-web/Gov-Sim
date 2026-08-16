/**
 * ASSET REGISTRY
 *
 * Phase 2 brief §8:
 *
 *   "Every image, portrait, icon, seal, and texture is referenced by a logical
 *    key resolved through a single manifest — `assets.portrait('washington')`,
 *    never a hardcoded path. Ship with placeholders. Swapping in real art
 *    becomes a manifest edit."
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT A PLACEHOLDER IS HERE, AND WHY IT IS NOT A FILE
 *
 * Every placeholder is a generated inline SVG data URI. No file exists, nothing
 * is fetched, and no 404 is possible. Three reasons that is the right answer for
 * a project with no art yet:
 *
 *   1. A missing-file placeholder that is itself a file has to be committed,
 *      served, and cached — and if it goes missing the interface breaks in a way
 *      that looks like a bug rather than like an absence.
 *   2. A GENERATED placeholder can be labelled. Every one carries its own
 *      logical key, so a screenshot of the game says exactly which asset is
 *      missing and what to name the file that replaces it.
 *   3. It is honest. A grey box that says `portrait/washington` is obviously a
 *      placeholder; a stock silhouette is a design decision nobody made.
 *
 * The DIMENSIONS are real, and match the layout tokens in `globals.css`. That is
 * the other half of "reserve the space now": a placeholder at the wrong size
 * would guarantee a reflow the day the real art arrives.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type AssetKind = 'portrait' | 'seal' | 'texture' | 'banner' | 'icon';

export interface AssetEntry {
  /** Where the real file will live, once there is one. Null while there is not. */
  src: string | null;
  /** Intrinsic size, in CSS pixels. Used by the placeholder and by the layout. */
  width: number;
  height: number;
  /** Required. An asset with no alt text is an asset a screen reader cannot report. */
  alt: string;
  /** What an artist needs to know about this specific one. */
  note?: string;
}

type Manifest = Record<AssetKind, Record<string, AssetEntry>>;

/**
 * THE MANIFEST.
 *
 * Everything the interface will ever ask for, with `src: null` until the file
 * exists. Adding real art is editing this object and nothing else — no component
 * changes, no path strings anywhere else in the codebase.
 *
 * Formats and dimensions an artist should deliver are in docs/THEMING.md §5.
 */
const MANIFEST: Manifest = {
  portrait: {
    /*
      One per ruler and per cabinet candidate. 96×120 is a 4:5 plate, which is
      the proportion of the period's engraved portraits and sits correctly in
      the Government screen's frame without cropping a face.
    */
    washington: { src: null, width: 96, height: 120, alt: 'George Washington' },
    hamilton: { src: null, width: 96, height: 120, alt: 'Alexander Hamilton' },
    jefferson: { src: null, width: 96, height: 120, alt: 'Thomas Jefferson' },
    knox: { src: null, width: 96, height: 120, alt: 'Henry Knox' },
    randolph: { src: null, width: 96, height: 120, alt: 'Edmund Randolph' },
    adams: { src: null, width: 96, height: 120, alt: 'John Adams' },
    /** The fallback when a ruler is one the player named themselves. */
    unknown: {
      src: null,
      width: 96,
      height: 120,
      alt: 'No portrait',
      note:
        'Used for a player-named ruler, who by definition has no likeness. A ' +
        'monogram plate rather than a face — UI.md §13 open question 2.',
    },
  },
  seal: {
    national: {
      src: null,
      width: 64,
      height: 64,
      alt: 'The seal of the United States',
      note: 'Title screen and founding screen. Must read at 64px and at 256px.',
    },
    treasury: { src: null, width: 64, height: 64, alt: 'Seal of the Treasury' },
    war: { src: null, width: 64, height: 64, alt: 'Seal of the War Department' },
    state: { src: null, width: 64, height: 64, alt: 'Seal of the Department of State' },
  },
  texture: {
    parchment: {
      src: null,
      width: 512,
      height: 512,
      alt: '',
      note: 'Tileable. Panel grounds on the parchment skin.',
    },
    linen: { src: null, width: 512, height: 512, alt: '', note: 'Tileable. Shell ground.' },
  },
  banner: {
    founding: {
      src: null,
      width: 1200,
      height: 120,
      alt: '',
      note: 'Header band on the founding screen. Safe area is the centre 800px.',
    },
    chronicle: { src: null, width: 1200, height: 120, alt: '' },
  },
  icon: {
    // The interface uses lucide-react for functional icons and will keep doing
    // so; this space is for period-specific marks that lucide has no equivalent
    // for.
    quill: { src: null, width: 24, height: 24, alt: '' },
    ledger: { src: null, width: 24, height: 24, alt: '' },
  },
};

/** A grey plate carrying its own key, so a screenshot names the missing asset. */
function placeholder(kind: AssetKind, key: string, entry: AssetEntry): string {
  const label = `${kind}/${key}`;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${entry.width}" height="${entry.height}" viewBox="0 0 ${entry.width} ${entry.height}">`,
    `<rect width="100%" height="100%" fill="#232833"/>`,
    `<rect x="0.5" y="0.5" width="${entry.width - 1}" height="${entry.height - 1}" fill="none" stroke="#3d4452"/>`,
    `<text x="50%" y="50%" fill="#979286" font-family="monospace" font-size="9" text-anchor="middle" dominant-baseline="middle">${label}</text>`,
    `</svg>`,
  ].join('');

  // encodeURIComponent rather than base64: it survives a diff, and a developer
  // can read the key straight out of the DOM.
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export interface ResolvedAsset {
  src: string;
  width: number;
  height: number;
  alt: string;
  /** True while this is a generated placeholder rather than real art. */
  isPlaceholder: boolean;
}

function resolve(kind: AssetKind, key: string): ResolvedAsset {
  const entry = MANIFEST[kind][key];

  if (!entry) {
    /*
      An unknown key is a programming error, and it returns a VISIBLE plate
      saying so rather than throwing. A missing portrait must not take down the
      Government screen, and a silent empty box would hide the mistake.
    */
    const unknown: AssetEntry = { src: null, width: 96, height: 120, alt: `Missing asset: ${kind}/${key}` };
    return {
      src: placeholder(kind, `${key}?`, unknown),
      width: unknown.width,
      height: unknown.height,
      alt: unknown.alt,
      isPlaceholder: true,
    };
  }

  return {
    src: entry.src ?? placeholder(kind, key, entry),
    width: entry.width,
    height: entry.height,
    alt: entry.alt,
    isPlaceholder: entry.src === null,
  };
}

export const assets = {
  portrait: (key: string) => resolve('portrait', key),
  seal: (key: string) => resolve('seal', key),
  texture: (key: string) => resolve('texture', key),
  banner: (key: string) => resolve('banner', key),
  icon: (key: string) => resolve('icon', key),

  /** Every key the manifest knows about. For the documentation and its test. */
  keys: (kind: AssetKind): string[] => Object.keys(MANIFEST[kind]),
  /** What an artist still has to deliver. */
  outstanding: (): Array<{ kind: AssetKind; key: string; entry: AssetEntry }> => {
    const out: Array<{ kind: AssetKind; key: string; entry: AssetEntry }> = [];
    for (const kind of Object.keys(MANIFEST) as AssetKind[]) {
      for (const [key, entry] of Object.entries(MANIFEST[kind])) {
        if (entry.src === null) out.push({ kind, key, entry });
      }
    }
    return out;
  },
};

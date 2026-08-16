/**
 * THEME AND SKINS
 *
 * Phase 2 brief §8:
 *
 *   "Every color, font, spacing value, and radius lives in one theme module as
 *    tokens. Zero hardcoded hex values or Tailwind arbitrary values in
 *    components… Support multiple named skins from day one. Implement the
 *    current look as skin `ledger`, and add a stub second skin so the switching
 *    mechanism is real and tested rather than theoretical. A future art-driven
 *    skin should require no component edits."
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HOW A SKIN WORKS, AND WHY IT WORKS THAT WAY
 *
 * A skin is a set of CSS CUSTOM PROPERTY OVERRIDES, applied by putting
 * `data-skin="…"` on the document element. It is not a set of component props,
 * not a React context, and not a class name components branch on.
 *
 * That matters for the brief's actual requirement — "a future art-driven skin
 * should require no component edits". A component that reads a theme object can
 * always be written to branch on it; a component that only emits
 * `className="bg-ink-700"` physically cannot. The switching mechanism has to be
 * somewhere the components cannot reach, and CSS is that place.
 *
 * So: this module knows the NAMES of the skins and how to apply one. The values
 * live in `globals.css` under `[data-skin='…']`. Adding a third skin is a block
 * of CSS and one entry here.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type SkinId = 'ledger' | 'parchment';

export interface Skin {
  id: SkinId;
  name: string;
  /** One line, for the settings panel. */
  description: string;
  /** Whether it is finished. The stub is honestly labelled. */
  complete: boolean;
}

export const SKINS: readonly Skin[] = [
  {
    id: 'ledger',
    name: 'Ledger',
    description:
      'Ink and brass on dark ground. The look the game was designed in, and the ' +
      'one every contrast ratio in docs/UI.md was measured against.',
    complete: true,
  },
  {
    id: 'parchment',
    name: 'Parchment',
    /*
      THE STUB THE BRIEF ASKS FOR, and it is deliberately honest about being
      one. Its job is to prove the switching mechanism is real: it inverts the
      ground entirely, which is the harshest thing a skin can do to a layout, so
      if anything in the interface is quietly hardcoded it shows up immediately.
    */
    description:
      'Dark ink on aged paper. A working stub rather than a finished design — ' +
      'it exists so the skin mechanism is exercised rather than theoretical, and ' +
      'it has not been through a contrast audit.',
    complete: false,
  },
];

export const DEFAULT_SKIN: SkinId = 'ledger';

export const SKIN_BY_ID: Readonly<Record<SkinId, Skin>> = Object.fromEntries(
  SKINS.map((s) => [s.id, s]),
) as Record<SkinId, Skin>;

export function isSkinId(value: unknown): value is SkinId {
  return typeof value === 'string' && value in SKIN_BY_ID;
}

/**
 * Apply a skin.
 *
 * One attribute on the document element, and every token in the tree resolves
 * differently. No re-render, no context, no component knows it happened.
 */
export function applySkin(skin: SkinId): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.skin = skin;
}

export function currentSkin(): SkinId {
  if (typeof document === 'undefined') return DEFAULT_SKIN;
  const value = document.documentElement.dataset.skin;
  return isSkinId(value) ? value : DEFAULT_SKIN;
}

/**
 * FORMATTING
 *
 * Presentation only. Nothing here is simulation truth — if a number needs
 * deriving rather than displaying, that derivation belongs in src/sim/.
 * (DESIGN.md Rule 7)
 *
 * Every function returns a string ready to render. None of them round in a way
 * that changes meaning: a treasury of -$412 must not display as "$0".
 */

/** Fixed locale, so output does not vary by the viewer's machine. */
const LOCALE = 'en-US';

/**
 * Money, compacted for display: $1.24M, $71.1M, $412.
 *
 * Compaction is a readability decision, not an accuracy one. The full precise
 * figure is always available in the stat popover, so the command bar can show
 * "$1.24M" without hiding anything from the player.
 */
export function formatCurrency(value: number, decimals?: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  if (abs >= 1_000_000_000) {
    return `${sign}$${(abs / 1_000_000_000).toFixed(decimals ?? 2)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(decimals ?? 2)}M`;
  }
  if (abs >= 10_000) {
    return `${sign}$${(abs / 1_000).toFixed(decimals ?? 1)}K`;
  }
  return `${sign}$${abs.toLocaleString(LOCALE, { maximumFractionDigits: 0 })}`;
}

/** The exact figure, for popovers and tooltips where precision matters. */
export function formatCurrencyExact(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toLocaleString(LOCALE, {
    maximumFractionDigits: 2,
  })}`;
}

/** A plain count with thousands separators. */
export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Compacted population: 3.93M, 109.4K. */
export function formatPopulation(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return formatNumber(value);
}

/** A rate stored as 0..1, shown as a percentage. */
export function formatRate(rate: number, decimals = 1): string {
  return `${(rate * 100).toFixed(decimals)}%`;
}

/** A 0-100 index, shown without a percent sign because it is not one. */
export function formatIndex(value: number): string {
  return value.toFixed(0);
}

/** Signed, for deltas: +6, -3.4. */
export function formatSigned(value: number, decimals = 0): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}`;
}

export type Direction = 'up' | 'down' | 'flat';

/**
 * Direction of travel, with a dead zone.
 *
 * The dead zone matters: without it a stat drifting by 0.001 would flicker
 * between up and down arrows every publish, which is exactly the kind of
 * jitter a ticking clock makes unbearable.
 */
export function direction(current: number, previous: number, epsilon = 0.05): Direction {
  const delta = current - previous;
  if (Math.abs(delta) < epsilon) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

/**
 * The glyph for a direction.
 *
 * Meaning is never carried by colour alone (UI.md §10), so every direction has
 * a distinct shape as well as a distinct colour.
 */
export function directionGlyph(dir: Direction): string {
  switch (dir) {
    case 'up':
      return '▲';
    case 'down':
      return '▼';
    case 'flat':
      return '▬';
  }
}

/** Screen-reader text for a direction, so the arrow is not the only signal. */
export function directionLabel(dir: Direction): string {
  switch (dir) {
    case 'up':
      return 'rising';
    case 'down':
      return 'falling';
    case 'flat':
      return 'steady';
  }
}

/**
 * Tailwind class for a direction.
 *
 * `favourableWhenRising` is false for things like debt, where going up is bad.
 * Getting this wrong would colour a debt increase green.
 */
export function directionClass(dir: Direction, favourableWhenRising = true): string {
  if (dir === 'flat') return 'text-content-muted';
  const good = favourableWhenRising ? dir === 'up' : dir === 'down';
  return good ? 'text-verdigris-400' : 'text-oxblood-300';
}

/** Regional sentiment as a word, so the bar is not the only signal. */
export function sentimentWord(sentiment: number): string {
  if (sentiment >= 50) return 'devoted';
  if (sentiment >= 20) return 'warm';
  if (sentiment >= 5) return 'favourable';
  if (sentiment > -5) return 'neutral';
  if (sentiment > -20) return 'cool';
  if (sentiment > -50) return 'hostile';
  return 'seditious';
}

/** Compliance as a word. */
export function complianceWord(compliance: number): string {
  if (compliance >= 90) return 'remitting in full';
  if (compliance >= 75) return 'remitting most';
  if (compliance >= 50) return 'remitting below assessment';
  if (compliance >= 25) return 'largely refusing';
  return 'in open defiance';
}

/** Exposure as a word, paired with the pip bar in the Regions view. */
export function exposureWord(exposure: number): string {
  if (exposure >= 2) return 'very high';
  if (exposure >= 1.2) return 'high';
  if (exposure >= 0.8) return 'moderate';
  if (exposure >= 0.5) return 'low';
  return 'very low';
}

'use client';

/**
 * ART SLOTS
 *
 * Phase 2 brief §8: "Reserve the space now. Portrait frames, panel background
 * slots, and header banner areas should exist in the layout at correct
 * dimensions with placeholder fills, so adding art doesn't reflow every screen."
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE POINT IS THE DIMENSIONS, NOT THE PICTURE
 *
 * Every one of these renders at a fixed size taken from a layout token in
 * `globals.css`, and the placeholder it shows is generated at exactly that size
 * by the asset registry. So the day real art lands, nothing about the layout
 * changes: the same box, the same space around it, the same line breaks in the
 * paragraph beside it.
 *
 * A placeholder that reflows when replaced is worse than no placeholder, because
 * it hides the reflow until the moment art arrives — which is the moment nobody
 * wants to be fixing layout.
 *
 * Every component here takes a LOGICAL KEY and never a path. `assets.portrait`
 * resolves it; nothing in this file knows where a file would live.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { assets } from '@/lib/assets';

/**
 * A portrait plate.
 *
 * 4:5, which is the proportion of the period's engraved portraits. `small` is
 * the list variant — the cabinet has four of these on one screen and a full
 * plate each would push the figures below the fold.
 */
export function Portrait({
  id,
  size = 'full',
  className = '',
}: {
  id: string;
  size?: 'full' | 'small';
  className?: string;
}) {
  const asset = assets.portrait(id);
  const w = size === 'full' ? 'var(--size-portrait-w)' : 'var(--size-portrait-sm-w)';
  const h = size === 'full' ? 'var(--size-portrait-h)' : 'var(--size-portrait-sm-h)';

  return (
    <span
      data-portrait={id}
      data-placeholder={asset.isPlaceholder ? 'true' : 'false'}
      style={{ width: w, height: h }}
      className={`inline-block shrink-0 overflow-hidden rounded border border-ink-400 bg-ink-600 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a data URI
          placeholder has no remote origin to optimise, and next/image would
          demand a loader for something that is not a file. */}
      <img
        src={asset.src}
        alt={asset.alt}
        width={asset.width}
        height={asset.height}
        className="h-full w-full object-cover"
      />
    </span>
  );
}

/** The national or departmental seal. Square, and readable small. */
export function Seal({ id = 'national', className = '' }: { id?: string; className?: string }) {
  const asset = assets.seal(id);

  return (
    <span
      data-seal={id}
      data-placeholder={asset.isPlaceholder ? 'true' : 'false'}
      style={{ width: 'var(--size-seal)', height: 'var(--size-seal)' }}
      className={`inline-block shrink-0 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset.src}
        alt={asset.alt}
        width={asset.width}
        height={asset.height}
        className="h-full w-full object-contain"
      />
    </span>
  );
}

/**
 * A header band.
 *
 * Full width, fixed height, and it keeps its height whether or not there is
 * anything in it — which is the entire reason it exists before there is art.
 * Children render over it, so the band is a ground rather than a picture.
 */
export function Banner({
  id,
  children,
  className = '',
}: {
  id: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const asset = assets.banner(id);

  return (
    <div
      data-banner={id}
      data-placeholder={asset.isPlaceholder ? 'true' : 'false'}
      style={{
        height: 'var(--size-banner-h)',
        backgroundImage: `url("${asset.src}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      className={`flex w-full items-center justify-center rounded-card border border-ink-400 ${className}`}
    >
      {children}
    </div>
  );
}

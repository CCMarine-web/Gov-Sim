'use client';

/**
 * LEFT NAV
 *
 * Icon plus label, 36px rows. A section showing a badge dot needs attention.
 * The dot is paired with an aria-label suffix, never colour alone. (UI.md §4.2)
 */

import {
  BookOpen,
  Coins,
  Landmark,
  LayoutGrid,
  Map,
  Globe,
  Network,
  Scale,
  ScrollText,
  Users,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { COPY } from '@/content/copy';

export type SectionId =
  /** The main view. Was 'desk' until queue item 9 replaced it with the map. */
  | 'map'
  | 'treasury'
  | 'legislation'
  | 'congress'
  | 'diplomacy'
  | 'regions'
  | 'government'
  | 'causal'
  | 'history'
  | 'chronicle';

interface NavItem {
  id: SectionId;
  label: string;
  Icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

const ITEMS: NavItem[] = [
  { id: 'map', label: COPY.nav.map, Icon: Map },
  { id: 'treasury', label: COPY.nav.treasury, Icon: Coins },
  { id: 'legislation', label: COPY.nav.legislation, Icon: Scale },
  { id: 'congress', label: COPY.nav.congress, Icon: Users },
  { id: 'diplomacy', label: COPY.nav.diplomacy, Icon: Globe },
  { id: 'regions', label: COPY.nav.regions, Icon: LayoutGrid },
  { id: 'government', label: COPY.nav.government, Icon: Landmark },
  { id: 'causal', label: COPY.nav.causal, Icon: Network },
  { id: 'history', label: COPY.nav.history, Icon: BookOpen },
  { id: 'chronicle', label: COPY.nav.chronicle, Icon: ScrollText },
];

export function LeftNav({
  active,
  onSelect,
  badges = {},
}: {
  active: SectionId;
  onSelect: (id: SectionId) => void;
  badges?: Partial<Record<SectionId, number>>;
}) {
  return (
    <nav
      style={{ width: 'var(--size-nav)' }}
      className="flex shrink-0 flex-col gap-0.5 border-r border-ink-400 bg-ink-800 p-2"
      aria-label="Sections"
    >
      {ITEMS.map(({ id, label, Icon }) => {
        const count = badges[id] ?? 0;
        const isActive = id === active;

        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={
              count > 0
                ? `${label}, ${count} item${count === 1 ? '' : 's'} needing attention`
                : label
            }
            className={`flex h-9 items-center gap-2.5 rounded px-2 text-body transition-colors ${
              isActive
                ? 'bg-ink-600 text-content-primary'
                : 'text-content-secondary hover:bg-ink-700 hover:text-content-primary'
            }`}
          >
            <Icon size={16} strokeWidth={1.75} className="shrink-0" />
            <span className="flex-1 text-left">{label}</span>
            {count > 0 && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-brass-400"
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

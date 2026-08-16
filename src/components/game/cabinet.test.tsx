// @vitest-environment jsdom

/**
 * THE CABINET ON SCREEN
 *
 * Phase 2 brief §5, queue item 13. What the interface has to get right:
 *
 *   - Whose appointment each office is. A player who appoints nobody gets the
 *     cabinet history gave them, and must not believe they chose it.
 *   - Competence and loyalty in WORDS as well as numbers.
 *   - That the ratings are a MODEL and the biographies are history. Nobody rated
 *     Hamilton out of a hundred, and a screen implying otherwise would break the
 *     project's hardest rule against a real person.
 *   - What an appointment costs, and that a republic must ask the Senate.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { OFFICES } from '@/content/government/cabinet';
import { appoint } from '@/sim/cabinet';
import { isoToDay } from '@/sim/calendar';
import { createTestGame } from '@/sim/createGame';
import { PARTIES } from '@/content';
import type { GameState, GovernmentType } from '@/sim/types';
import { GovernmentPanel } from './GovernmentPanel';

afterEach(cleanup);

function ready(
  governmentType: GovernmentType = 'monarchy',
  day = isoToDay('1796-01-01'),
): GameState {
  const base = createTestGame({ governmentType });
  return {
    ...base,
    day,
    politicalCapital: { ...base.politicalCapital, current: 600, cap: 600 },
  };
}

describe('the cabinet panel', () => {
  it('lists every office with who holds it', () => {
    const { container } = render(
      <GovernmentPanel state={ready('monarchy', isoToDay('1793-01-01'))} />,
    );
    const cabinet = container.querySelector('[data-testid="cabinet"]')!;

    for (const office of OFFICES) {
      expect(cabinet.querySelector(`[data-office="${office.id}"]`), office.id).not.toBeNull();
    }
    expect(cabinet.textContent).toContain('Alexander Hamilton');
  });

  it('says whether an office is yours or history’s', () => {
    const before = render(<GovernmentPanel state={ready()} />);
    expect(
      before.container.querySelector('[data-office="treasury"]')!.textContent,
    ).toContain('as history had it');
    cleanup();

    const outcome = appoint(ready(), OFFICES[0], 'gallatin', PARTIES, OFFICES);
    if (outcome.kind !== 'appointed') throw new Error('expected an appointment');

    const { container } = render(<GovernmentPanel state={outcome.state} />);
    expect(container.querySelector('[data-office="treasury"]')!.textContent).toContain(
      'your appointment',
    );
  });

  it('gives competence and loyalty in words as well as numbers', () => {
    const { container } = render(
      <GovernmentPanel state={ready('monarchy', isoToDay('1793-01-01'))} />,
    );
    const holder = container.querySelector('[data-holder="treasury"]')!;

    expect(holder.textContent).toContain('Competence:');
    expect(holder.textContent).toContain('Loyalty:');
    // Hamilton is the top of the scale, and the word says so.
    expect(holder.textContent).toContain('The best available');
  });

  it('says plainly that the ratings are a model and the lives are not', () => {
    const { container } = render(<GovernmentPanel state={ready()} />);
    const note = container.querySelector('[data-testid="cabinet-note"]')!;

    expect(note.textContent).toContain('biographies are history');
    expect(note.textContent).toContain('ratings are a model');
    expect(note.textContent).toContain('nobody rated these men out of a hundred');
    expect(note.textContent).toContain('not a verdict on anybody');
  });

  it('tells a republic that the Senate has to concur', () => {
    const { container } = render(<GovernmentPanel state={ready('republic')} />);
    expect(container.querySelector('[data-testid="cabinet-note"]')!.textContent).toContain(
      'Senate to concur',
    );
    cleanup();

    const crown = render(<GovernmentPanel state={ready('monarchy')} />);
    expect(
      crown.container.querySelector('[data-testid="cabinet-note"]')!.textContent,
    ).toContain('nobody concurs');
  });
});

describe('considering someone else', () => {
  it('opens a list of candidates with their notes and sources', () => {
    const { container } = render(<GovernmentPanel state={ready()} />);
    const office = container.querySelector('[data-office="treasury"]')!;

    fireEvent.click(
      [...office.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Consider someone else'),
      )!,
    );

    const list = container.querySelector('[data-candidates="treasury"]')!;
    expect(list.querySelector('[data-candidate="gallatin"]')).not.toBeNull();
    expect(list.textContent).toContain('twelve years');
    // Sources sit in the steel reserved for historical material. (UI.md §9)
    expect(list.innerHTML).toContain('steel');
  });

  it('states the price, and that the Senate is involved', () => {
    const { container } = render(<GovernmentPanel state={ready('republic')} />);
    fireEvent.click(
      [...container.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Consider someone else'),
      )!,
    );

    const button = container.querySelector('[data-appoint="gallatin"]')!;
    expect(button.textContent).toContain('capital');
    expect(button.textContent).toContain('subject to the Senate');
  });

  it('calls the handler with the office and the candidate', () => {
    const onAppoint = vi.fn();
    const { container } = render(
      <GovernmentPanel state={ready()} onAppoint={onAppoint} />,
    );
    fireEvent.click(
      [...container.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Consider someone else'),
      )!,
    );

    fireEvent.click(container.querySelector('[data-appoint="gallatin"]')!);
    expect(onAppoint).toHaveBeenCalledWith('treasury', 'gallatin');
  });

  it('says why a candidate cannot be appointed rather than hiding him', () => {
    const { container } = render(<GovernmentPanel state={ready('monarchy', 200)} />);
    const office = container.querySelector('[data-office="treasury"]')!;

    fireEvent.click(
      [...office.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Consider someone else'),
      )!,
    );

    // Gallatin is not available until 1795, and the panel says so.
    const gallatin = container.querySelector('[data-candidate="gallatin"]')!;
    expect(gallatin.textContent).toContain('Not available before');
    expect(gallatin.querySelector('[data-appoint="gallatin"]')).toBeNull();
  });

  it('disables an appointment there is no capital for', () => {
    const base = ready();
    const poor: GameState = {
      ...base,
      politicalCapital: { ...base.politicalCapital, current: 0 },
    };

    const { container } = render(<GovernmentPanel state={poor} />);
    fireEvent.click(
      [...container.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Consider someone else'),
      )!,
    );

    expect(
      container.querySelector('[data-appoint="gallatin"]')!.hasAttribute('disabled'),
    ).toBe(true);
  });
});

describe('resignations', () => {
  it('says nothing when nobody has walked out', () => {
    const { container } = render(<GovernmentPanel state={ready()} />);
    expect(container.querySelector('[data-testid="resignations"]')).toBeNull();
  });

  it('reports them when they have', () => {
    const base = ready();
    const bruised: GameState = {
      ...base,
      cabinet: {
        ...base.cabinet,
        resignations: [{ officeId: 'state', candidateId: 'jefferson', day: 400 }],
      },
    };

    const { container } = render(<GovernmentPanel state={bruised} />);
    expect(container.querySelector('[data-testid="resignations"]')!.textContent).toContain(
      'officer has',
    );
  });
});

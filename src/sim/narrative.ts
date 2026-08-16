/**
 * NARRATIVE GENERATION
 *
 * Turns current state into prose for the Desk's "state of the union" panel.
 *
 * This lives in src/sim/ rather than in a component because it is a derivation
 * from simulation state, and Rule 7 puts derivations here. It is pure: same
 * state in, same sentences out, with no locale-dependent formatting.
 *
 * It is deliberately PROSE, not a stat dump. The panel's job is to name the one
 * or two things that most need attention, in the register of a briefing.
 */

import type { GameState } from './types';

/** Clauses are picked by threshold, then joined into paragraphs. */
export function stateOfTheUnion(state: GameState): string {
  const parts: string[] = [];
  const { nation, treasury, regions } = state;

  // --- Fiscal position -----------------------------------------------------
  const receipts =
    treasury.annualisedReceipts.customs +
    treasury.annualisedReceipts.excise +
    treasury.annualisedReceipts.land +
    treasury.annualisedReceipts.other;
  const outlays =
    treasury.annualisedOutlays.debtService +
    treasury.annualisedOutlays.military +
    treasury.annualisedOutlays.civil +
    treasury.annualisedOutlays.infrastructure;
  const balance = receipts - outlays;

  if (treasury.emergencyBorrowing) {
    parts.push(
      'The Treasury is empty and the government is borrowing at punitive rates to meet its obligations.',
    );
  } else if (balance > receipts * 0.15) {
    parts.push('The Treasury runs a comfortable surplus.');
  } else if (balance > 0) {
    parts.push('The Treasury runs a modest surplus.');
  } else {
    parts.push('The Treasury runs a deficit.');
  }

  const debtService = treasury.annualisedOutlays.debtService;
  if (receipts > 0 && debtService / receipts > 0.5) {
    parts.push(
      'Debt service now consumes more than half of all revenue, crowding out every other purpose.',
    );
  }

  // --- Credit --------------------------------------------------------------
  if (treasury.creditRating >= 70) {
    parts.push('Federal credit stands high and money can be raised cheaply.');
  } else if (treasury.creditRating < 30) {
    parts.push('Federal credit is poor; new borrowing comes dear.');
  } else if (state.day < 400) {
    parts.push('Federal credit is untested.');
  }

  // --- Regional temper -----------------------------------------------------
  const sorted = [...regions].sort((a, b) => b.sentiment - a.sentiment);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  if (worst.sentiment < -40) {
    parts.push(
      `${worst.name} is in open disaffection and remits only part of what it owes.`,
    );
  } else if (worst.sentiment < -10) {
    parts.push(`${worst.name} is restive.`);
  }

  if (best.sentiment > 15 && best.id !== worst.id) {
    parts.push(`${best.name} remains broadly supportive.`);
  }

  // --- Compliance ----------------------------------------------------------
  const defiant = regions.filter((r) => r.compliance < 70);
  if (defiant.length > 0) {
    parts.push(
      defiant.length === 1
        ? `Revenue from ${defiant[0].name} is arriving well below assessment.`
        : `Revenue is arriving well below assessment in ${defiant.length} regions.`,
    );
  }

  // --- Union ---------------------------------------------------------------
  if (nation.sectionalTension > 60) {
    parts.push(
      'The sections are pulling hard in opposite directions; the union itself is now a question.',
    );
  } else if (nation.sectionalTension > 40) {
    parts.push('Sectional feeling is hardening.');
  }

  // --- Legitimacy ----------------------------------------------------------
  if (nation.legitimacy < 25) {
    parts.push(
      state.governmentType === 'monarchy'
        ? 'The crown commands little consent, and its instructions are increasingly ignored.'
        : 'The administration commands little consent, and its instructions are increasingly ignored.',
    );
  } else if (nation.legitimacy < 45) {
    parts.push('The government’s authority is questioned in more quarters than it was.');
  }

  // --- Stability -----------------------------------------------------------
  if (nation.stability < 30) {
    parts.push('Order is precarious.');
  }

  return parts.join(' ');
}

/** Short crisis lines for the Desk's crises card. Empty when all is calm. */
export function currentCrises(state: GameState): string[] {
  const crises: string[] = [];

  if (state.treasury.emergencyBorrowing) {
    crises.push('Treasury insolvent — borrowing at penalty rates');
  }

  for (const region of state.regions) {
    if (region.compliance < 70) {
      crises.push(
        `${region.name} — compliance ${region.compliance.toFixed(0)}, remitting below assessment`,
      );
    } else if (region.sentiment < -40) {
      crises.push(`${region.name} — disaffected (sentiment ${region.sentiment.toFixed(0)})`);
    }
  }

  if (state.nation.sectionalTension > 60) {
    crises.push(
      `Sectional tension at ${state.nation.sectionalTension.toFixed(0)} — the union is strained`,
    );
  }

  if (state.nation.legitimacy < 25) {
    crises.push(`Legitimacy at ${state.nation.legitimacy.toFixed(0)} — authority is failing`);
  }

  /*
    Unrest is listed by name and by cause, because a player who can see only
    that "the South is unhappy" cannot tell whether to conciliate the planters
    or the small farmers. Ordinary grievance is not listed here — it belongs on
    the Regions screen as a warning, and a crisis list that included every
    complaint would stop being a crisis list. (brief §2.1)
  */
  for (const episode of state.grievance.episodes) {
    if (episode.endedDay !== null) continue;
    const region = state.regions.find((r) => r.id === episode.regionId);
    const bloc = episode.drivenBy.replace(/_/g, ' ');

    crises.push(
      episode.severity === 'revolt'
        ? `${region?.name ?? episode.regionId} in arms — the ${bloc} at the head of it`
        : episode.severity === 'defiance'
          ? `${region?.name ?? episode.regionId} openly defiant — the ${bloc} will not pay`
          : `${region?.name ?? episode.regionId} quietly withholding — the ${bloc} are behind it`,
    );
  }

  if (state.flags.succession_disputed === true) {
    crises.push('The succession is disputed — the crown is claimed and contested');
  }

  return crises;
}

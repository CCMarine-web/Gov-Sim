/**
 * TAX AND SPENDING INSTANCES
 *
 * Pure operations over `PolicyState.taxes` and `PolicyState.programs`.
 *
 * This is the layer that replaced three hard-coded tax rates and three spending
 * lines (Phase 2 brief §4.3). Everything here is a pure function of state — no
 * time, no randomness — so the engine, the projection and the interface all get
 * their answers from the same place, and a component never has to work out for
 * itself what "the tariff rate" means when there might be two of them.
 *
 * A REPEALED TAX IS NOT DELETED. `repealedDay` is set and the instance stays in
 * the array, so the run keeps a record of what was levied and when. Every query
 * here therefore asks about taxes IN FORCE on a given day rather than about the
 * array's contents.
 */

import { TAX_BASES, type BurdenChannel, type TaxBase } from './taxBases';
import type {
  PolicyState,
  ReceiptBreakdown,
  RevenueLine,
  SpendingCategory,
  SpendingProgram,
  TaxInstance,
} from './types';

// ============================================================================
// QUERIES
// ============================================================================

/** Taxes in force on `day`: enacted on or before it, not yet repealed. */
export function taxesInForce(policies: PolicyState, day: number): TaxInstance[] {
  return policies.taxes.filter(
    (tax) =>
      tax.enactedDay <= day && (tax.repealedDay === null || tax.repealedDay > day),
  );
}

/** Programmes funded on `day`. */
export function programsInForce(
  policies: PolicyState,
  day: number,
): SpendingProgram[] {
  return policies.programs.filter(
    (p) => p.enactedDay <= day && (p.repealedDay === null || p.repealedDay > day),
  );
}

export function findTax(policies: PolicyState, taxId: string): TaxInstance | null {
  return policies.taxes.find((t) => t.id === taxId) ?? null;
}

export function findProgram(
  policies: PolicyState,
  programId: string,
): SpendingProgram | null {
  return policies.programs.find((p) => p.id === programId) ?? null;
}

/**
 * The combined rate levied on one base.
 *
 * Two duties on imports are, to the merchant paying them, one duty at the sum of
 * their rates — and to the trade-suppression curve likewise. Anything that asks
 * "how heavily is trade taxed" has to ask this rather than picking a tax.
 */
export function aggregateRate(
  policies: PolicyState,
  day: number,
  base: TaxBase,
): number {
  let total = 0;
  for (const tax of taxesInForce(policies, day)) {
    if (tax.base === base) total += Math.max(0, tax.rate);
  }
  return total;
}

/**
 * The rate that suppresses trade, and that shelters domestic manufacturing.
 *
 * Every tax whose base is assessed on trade AND which suppresses its own base
 * contributes. In practice that is the impost; an export duty would too, if the
 * Constitution allowed one. (ECONOMY.md §7.5)
 */
export function tradeTaxRate(policies: PolicyState, day: number): number {
  let total = 0;
  for (const tax of taxesInForce(policies, day)) {
    const definition = TAX_BASES[tax.base];
    if (definition.assessment === 'trade' && definition.suppressesItsOwnBase) {
      total += Math.max(0, tax.rate);
    }
  }
  return total;
}

/** Every tax in force as a rate plus the exposure channel its burden travels. */
export function burdenLevies(
  policies: PolicyState,
  day: number,
): Array<{ rate: number; channel: BurdenChannel }> {
  return taxesInForce(policies, day).map((tax) => ({
    rate: Math.max(0, tax.rate),
    channel: TAX_BASES[tax.base].burden,
  }));
}

/** Total annual outlay for one spending category. */
export function spendingFor(
  policies: PolicyState,
  day: number,
  category: SpendingCategory,
): number {
  let total = 0;
  for (const program of programsInForce(policies, day)) {
    if (program.category === category) total += Math.max(0, program.annualAmount);
  }
  return total;
}

// ============================================================================
// ROLLUP
// ============================================================================

/**
 * Sum per-instance revenue lines into the four headline buckets.
 *
 * The buckets exist for display, for the monthly series and for the History
 * view. Deriving them from the lines rather than computing them separately is
 * what guarantees the detail and the headline cannot disagree — which is the
 * same principle as the modifier ledger, applied to revenue.
 */
export function rollupReceipts(
  lines: RevenueLine[],
  otherReceipts: number,
): ReceiptBreakdown {
  const rollup: ReceiptBreakdown = {
    customs: 0,
    excise: 0,
    land: 0,
    other: otherReceipts,
  };

  for (const line of lines) {
    rollup[line.bucket] += line.net;
  }

  return rollup;
}

// ============================================================================
// UPDATES — all pure, all returning a new PolicyState
// ============================================================================

/**
 * Create a tax, or replace it wholesale if the id already exists.
 *
 * Idempotent by id, for the same reason modifier ids are (DESIGN.md Rule 5): an
 * event that fires twice, or a migration run twice, must not silently double a
 * country's taxes.
 *
 * `enactedDay` is whatever the caller passes, including on a replacement. That
 * is deliberate: enacting a tax is an act that happens on a day, and a tax
 * repealed in 1802 and reimposed in 1813 was reimposed in 1813. Changing a
 * RATE is a different operation with a different function — `setTaxRate` — and
 * it leaves the enactment day alone.
 */
export function upsertTax(
  policies: PolicyState,
  tax: Omit<TaxInstance, 'repealedDay'> & { repealedDay?: number | null },
): PolicyState {
  const existing = policies.taxes.findIndex((t) => t.id === tax.id);
  const instance: TaxInstance = {
    ...tax,
    repealedDay: tax.repealedDay ?? null,
  };

  if (existing === -1) {
    return { ...policies, taxes: [...policies.taxes, instance] };
  }

  const taxes = [...policies.taxes];
  taxes[existing] = instance;
  return { ...policies, taxes };
}

export function setTaxRate(
  policies: PolicyState,
  taxId: string,
  rate: number,
): PolicyState {
  const index = policies.taxes.findIndex((t) => t.id === taxId);
  if (index === -1) return policies;

  const taxes = [...policies.taxes];
  taxes[index] = { ...taxes[index], rate: Math.max(0, rate) };
  return { ...policies, taxes };
}

/** Repeal on `day`. A tax already repealed is left alone. */
export function repealTax(
  policies: PolicyState,
  taxId: string,
  day: number,
): PolicyState {
  const index = policies.taxes.findIndex((t) => t.id === taxId);
  if (index === -1 || policies.taxes[index].repealedDay !== null) return policies;

  const taxes = [...policies.taxes];
  taxes[index] = { ...taxes[index], repealedDay: day };
  return { ...policies, taxes };
}

export function upsertProgram(
  policies: PolicyState,
  program: Omit<SpendingProgram, 'repealedDay'> & { repealedDay?: number | null },
): PolicyState {
  const existing = policies.programs.findIndex((p) => p.id === program.id);
  const instance: SpendingProgram = {
    ...program,
    repealedDay: program.repealedDay ?? null,
  };

  if (existing === -1) {
    return { ...policies, programs: [...policies.programs, instance] };
  }

  const programs = [...policies.programs];
  programs[existing] = instance;
  return { ...policies, programs };
}

export function setProgramAmount(
  policies: PolicyState,
  programId: string,
  annualAmount: number,
): PolicyState {
  const index = policies.programs.findIndex((p) => p.id === programId);
  if (index === -1) return policies;

  const programs = [...policies.programs];
  programs[index] = { ...programs[index], annualAmount: Math.max(0, annualAmount) };
  return { ...policies, programs };
}

export function defundProgram(
  policies: PolicyState,
  programId: string,
  day: number,
): PolicyState {
  const index = policies.programs.findIndex((p) => p.id === programId);
  if (index === -1 || policies.programs[index].repealedDay !== null) return policies;

  const programs = [...policies.programs];
  programs[index] = { ...programs[index], repealedDay: day };
  return { ...policies, programs };
}

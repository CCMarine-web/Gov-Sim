/**
 * MIGRATION v1 → v2 — three tax rates become tax instances
 *
 * Phase 2 brief §4.3 replaced `policies.taxRates` (three fields) and
 * `policies.spending` (three fields) with `policies.taxes` and
 * `policies.programs`, arrays of instances. A v1 save has the old shape, and a
 * player mid-run must not lose their game to a data model change.
 *
 * WHAT THIS HAS TO GET RIGHT
 *
 * The migration is BEHAVIOUR-PRESERVING. A v1 save carried forward must produce
 * exactly the same economy it would have produced under v1, because the three
 * founding instances reproduce the three old formulas arithmetically: same rate,
 * same base, collection efficiency 1.0. A migration that quietly changed a
 * player's revenue would be worse than one that refused the save.
 *
 * `enactedDay: 0` for all six. The old shape recorded no enactment day, and
 * inventing one from the current day would be a lie in the opposite direction —
 * it would claim the impost was created on the day the save was loaded. Day 0 is
 * the honest answer: these are the founding settings, whenever they were last
 * changed.
 *
 * Pure, and loosely typed on the way in by design: the v1 shape has no
 * TypeScript type in this build.
 */

import {
  FOUNDING_PROGRAM_IDS,
  FOUNDING_TAX_IDS,
  type SpendingProgram,
  type TaxInstance,
} from '../types';

/** Read a number out of loosely-typed state, defaulting rather than throwing. */
function num(source: unknown, key: string, fallback: number): number {
  if (source === null || typeof source !== 'object') return fallback;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function v1ToV2(state: Record<string, unknown>): Record<string, unknown> {
  const policies = (state.policies ?? {}) as Record<string, unknown>;
  const taxRates = policies.taxRates ?? {};
  const spending = policies.spending ?? {};

  const taxes: TaxInstance[] = [
    {
      id: FOUNDING_TAX_IDS.impost,
      name: 'Impost of 1789',
      createdByBillId: null,
      base: 'imports',
      rate: num(taxRates, 'tariffAvg', 0.1),
      exemptions: [
        'Goods carried in American-built and American-owned vessels paid a reduced duty',
      ],
      collectionEfficiency: 1.0,
      enactedDay: 0,
      repealedDay: null,
    },
    {
      id: FOUNDING_TAX_IDS.spirits,
      name: 'Excise on distilled spirits',
      createdByBillId: null,
      base: 'spirits',
      rate: num(taxRates, 'excise', 0),
      exemptions: [],
      collectionEfficiency: 1.0,
      enactedDay: 0,
      repealedDay: null,
    },
    {
      id: FOUNDING_TAX_IDS.land,
      name: 'Direct tax on land',
      createdByBillId: null,
      base: 'land',
      rate: num(taxRates, 'landTax', 0),
      exemptions: [],
      collectionEfficiency: 1.0,
      enactedDay: 0,
      repealedDay: null,
    },
  ];

  const programs: SpendingProgram[] = [
    {
      id: FOUNDING_PROGRAM_IDS.military,
      name: 'Army and militia',
      createdByBillId: null,
      category: 'military',
      annualAmount: num(spending, 'military', 0),
      enactedDay: 0,
      repealedDay: null,
    },
    {
      id: FOUNDING_PROGRAM_IDS.civil,
      name: 'Civil establishment',
      createdByBillId: null,
      category: 'civil',
      annualAmount: num(spending, 'civil', 0),
      enactedDay: 0,
      repealedDay: null,
    },
    {
      id: FOUNDING_PROGRAM_IDS.infrastructure,
      name: 'Roads, posts and lighthouses',
      createdByBillId: null,
      category: 'infrastructure',
      annualAmount: num(spending, 'infrastructure', 0),
      enactedDay: 0,
      repealedDay: null,
    },
  ];

  const treasury = (state.treasury ?? {}) as Record<string, unknown>;

  return {
    ...state,
    schemaVersion: 2,
    policies: {
      // taxRates and spending are dropped rather than kept alongside. Keeping
      // both would be one fact in two places, which is precisely the drift the
      // project rules forbid — and the stale copy would be the one a future
      // reader trusted.
      taxes,
      programs,
      enactedLawIds: Array.isArray(policies.enactedLawIds)
        ? policies.enactedLawIds
        : [],
      cumulativeInfrastructure: num(policies, 'cumulativeInfrastructure', 0),
    },
    treasury: {
      ...treasury,
      /*
        Left empty rather than reconstructed. The attribution lines are rebuilt
        from scratch on the next monthly recompute, which is at most 31 in-game
        days away, and a fabricated set would claim to attribute revenue that was
        never attributed when it was collected. An empty array renders as "no
        detail yet for this month", which is true.
      */
      receiptLines: [],
      outlayLines: [],
    },
  };
}

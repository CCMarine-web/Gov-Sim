/**
 * GENERATE A SAVE FIXTURE FOR AN OLD SCHEMA VERSION
 *
 *   npx tsx scripts/make-fixture.mts <version>
 *
 * Writes `src/sim/migrations/fixtures/v<version>-republic-day900.json`, a real
 * save in that version's format, and REFUSES TO OVERWRITE ONE THAT EXISTS.
 *
 * That refusal is the important part. A fixture rebuilt from current code stops
 * being a record of the old format and becomes a restatement of the new one,
 * which makes its migration test pass by construction and prove nothing. The
 * rule used to be a comment; it is now behaviour.
 *
 * HOW AN OLD SHAPE IS PRODUCED
 * A current game is simulated to day 900 — 16 October 1791, past the whiskey
 * excise, so the fixture carries a non-zero excise rate and tests something —
 * and then DOWNGRADED by hand. Each downgrade below is written at the moment
 * the corresponding fields were removed, so the old shape is known precisely
 * rather than reconstructed later from memory.
 */

import { existsSync, writeFileSync } from 'node:fs';
import { advanceDay, resolveDecision } from '../src/sim/advanceDay.js';
import { createTestGame } from '../src/sim/createGame.js';
import { billStatus, enactBill } from '../src/sim/bills.js';
import { PHASE_1_CONTENT } from '../src/content/index.js';
import { aggregateRate, spendingFor } from '../src/sim/taxes.js';
import type { GameState } from '../src/sim/types.js';

const version = Number(process.argv[2]);
if (!Number.isInteger(version) || version < 1) {
  console.error('usage: npx tsx scripts/make-fixture.mts <schema version>');
  process.exit(1);
}

const path = `src/sim/migrations/fixtures/v${version}-republic-day900.json`;
if (existsSync(path)) {
  console.error(
    `${path} already exists and will NOT be regenerated.\n` +
      'A fixture rebuilt from current code restates the new format instead of\n' +
      'recording the old one, and its migration test would pass by construction.\n' +
      'Delete it deliberately if you are certain.',
  );
  process.exit(1);
}

// --- Play a real game to day 900 -------------------------------------------
//
// Events are answered with the first option, and every affordable bill is
// passed at two checkpoints. A fixture from an empty run tests almost nothing:
// the point of committing one is that it carries a real save's worth of taxes,
// bills, modifiers and log entries for the migration to carry forward.
let state: GameState = createTestGame();

function passWhatItCan(): void {
  // Given plenty of capital, so the fixture is about the schema rather than
  // about affordability.
  state = {
    ...state,
    politicalCapital: { ...state.politicalCapital, current: 900, cap: 900 },
  };

  for (const bill of PHASE_1_CONTENT.bills) {
    if (billStatus(state, bill).kind !== 'available') continue;
    state = enactBill(state, bill, bill.hasSlider ? bill.sliderRange![0] : null).state;
  }
}

for (let i = 0; i < 900; i++) {
  state = advanceDay(state, PHASE_1_CONTENT).state;
  while (state.eventState.pendingDecisions.length > 0) {
    const pending = state.eventState.pendingDecisions[0];
    const event = PHASE_1_CONTENT.events.find((e) => e.id === pending.eventId)!;
    state = resolveDecision(
      state,
      PHASE_1_CONTENT,
      pending.eventId,
      event.options[0].id,
    ).state;
  }
  if (state.day === 400 || state.day === 800) passWhatItCan();
}

// --- Downgrade to the requested format --------------------------------------
type Loose = Record<string, unknown>;

/** v8 → v7: there was no diplomacy. */
function downgradeToV7(current: Loose): Loose {
  const out = { ...current, schemaVersion: 7 };
  delete (out as Loose).diplomacy;
  return out;
}

/** v7 → v6: blocs were a static table, not state. */
function downgradeToV6(current: Loose): Loose {
  const out = { ...current, schemaVersion: 6 };
  delete (out as Loose).blocs;
  return out;
}

/** v6 → v5: there was no Congress. */
function downgradeToV5(current: Loose): Loose {
  const out = { ...current, schemaVersion: 5 };
  delete (out as Loose).congress;
  return out;
}

/** v5 → v4: grievance did not exist, and a ruler could not die. */
function downgradeToV4(current: Loose): Loose {
  const ruler = { ...(current.ruler as Loose) };
  delete ruler.reignNumber;
  delete ruler.accededDay;

  const out = { ...current, schemaVersion: 4, ruler };
  delete (out as Loose).grievance;
  return out;
}

/** v4 → v3: `policies.bills` was a flat list of enacted law ids. */
function downgradeToV3(current: Loose, played: GameState): Loose {
  const policies = { ...(current.policies as Loose) };
  delete policies.bills;
  policies.enactedLawIds = played.policies.bills
    .filter((b) => b.repealedDay === null)
    .map((b) => b.billId);

  // Modifiers had no phase-in ramp.
  const activeModifiers = (current.activeModifiers as Loose[]).map((m) => {
    const copy = { ...m };
    delete copy.rampDays;
    return copy;
  });

  return { ...current, schemaVersion: 3, policies, activeModifiers };
}

/** v3 → v2: political capital and administrative capacity did not exist. */
function downgradeToV2(current: Loose): Loose {
  const nation = { ...(current.nation as Loose) };
  delete nation.administrativeCapacity;

  const out = { ...current, schemaVersion: 2, nation };
  delete (out as Loose).politicalCapital;
  return out;
}

/** v2 → v1: three tax rates and three spending lines, no attribution lines. */
function downgradeToV1(current: Loose, played: GameState): Loose {
  const treasury = { ...(current.treasury as Loose) };
  delete treasury.receiptLines;
  delete treasury.outlayLines;

  return {
    ...current,
    schemaVersion: 1,
    policies: {
      taxRates: {
        tariffAvg: aggregateRate(played.policies, played.day, 'imports'),
        excise: aggregateRate(played.policies, played.day, 'spirits'),
        landTax: aggregateRate(played.policies, played.day, 'land'),
      },
      spending: {
        military: spendingFor(played.policies, played.day, 'military'),
        civil: spendingFor(played.policies, played.day, 'civil'),
        infrastructure: spendingFor(played.policies, played.day, 'infrastructure'),
      },
      // Already downgraded to the v3 shape by the time this runs.
      enactedLawIds: (current.policies as Loose).enactedLawIds ?? [],
      cumulativeInfrastructure: played.policies.cumulativeInfrastructure,
    },
    treasury,
  };
}

let fixture: Loose = JSON.parse(JSON.stringify(state));
if (version <= 7) fixture = downgradeToV7(fixture);
if (version <= 6) fixture = downgradeToV6(fixture);
if (version <= 5) fixture = downgradeToV5(fixture);
if (version <= 4) fixture = downgradeToV4(fixture);
if (version <= 3) fixture = downgradeToV3(fixture, state);
if (version <= 2) fixture = downgradeToV2(fixture);
if (version <= 1) fixture = downgradeToV1(fixture, state);

writeFileSync(path, JSON.stringify(fixture, null, 2) + '\n', 'utf8');
console.log(`wrote ${path} — schemaVersion ${fixture.schemaVersion}, day ${fixture.day}`);

/**
 * GENERATE THE v1 FIXTURE SAVE
 *
 * Run once, with the output committed to
 * `src/sim/migrations/fixtures/v1-republic-day900.json`. It is not regenerated:
 * a fixture that is rebuilt from current code stops being a record of the old
 * format and becomes a restatement of the new one, which would make the
 * migration test pass by construction and prove nothing.
 *
 *   npx tsx scripts/make-v1-fixture.mts
 *
 * HOW THE v1 SHAPE IS PRODUCED
 * A current game is simulated to day 900 and then DOWNGRADED to the v1 shape by
 * hand: `policies.taxes` and `policies.programs` become `taxRates` and
 * `spending`, the attribution lines are removed, and `schemaVersion` becomes 1.
 * That is exactly the shape v1 wrote — the fields are known precisely, because
 * they were removed in the same commit that added this script.
 */

import { writeFileSync } from 'node:fs';
import { advanceDay } from '../src/sim/advanceDay.js';
import { createTestGame } from '../src/sim/createGame.js';
import { PHASE_1_CONTENT } from '../src/content/index.js';
import { aggregateRate, spendingFor } from '../src/sim/taxes.js';
import type { GameState } from '../src/sim/types.js';

let state: GameState = createTestGame();
for (let i = 0; i < 900; i++) {
  const result = advanceDay(state, PHASE_1_CONTENT);
  state = result.state;
  // Answer anything blocking with the first option, so the run reaches day 900.
  while (state.eventState.pendingDecisions.length > 0) {
    const pending = state.eventState.pendingDecisions[0];
    const event = PHASE_1_CONTENT.events.find((e) => e.id === pending.eventId)!;
    const { resolveDecision } = await import('../src/sim/advanceDay.js');
    state = resolveDecision(
      state,
      PHASE_1_CONTENT,
      pending.eventId,
      event.options[0].id,
    ).state;
  }
}

const v1 = {
  ...state,
  schemaVersion: 1,
  policies: {
    taxRates: {
      tariffAvg: aggregateRate(state.policies, state.day, 'imports'),
      excise: aggregateRate(state.policies, state.day, 'spirits'),
      landTax: aggregateRate(state.policies, state.day, 'land'),
    },
    spending: {
      military: spendingFor(state.policies, state.day, 'military'),
      civil: spendingFor(state.policies, state.day, 'civil'),
      infrastructure: spendingFor(state.policies, state.day, 'infrastructure'),
    },
    enactedLawIds: state.policies.enactedLawIds,
    cumulativeInfrastructure: state.policies.cumulativeInfrastructure,
  },
  treasury: (() => {
    const t = { ...state.treasury } as Record<string, unknown>;
    delete t.receiptLines;
    delete t.outlayLines;
    return t;
  })(),
};

const path = 'src/sim/migrations/fixtures/v1-republic-day900.json';
writeFileSync(path, JSON.stringify(v1, null, 2) + '\n', 'utf8');
console.log(`wrote ${path} — day ${v1.day}, tariff ${v1.policies.taxRates.tariffAvg}`);

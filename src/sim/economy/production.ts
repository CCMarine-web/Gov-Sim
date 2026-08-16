/**
 * PRODUCTION
 *
 * Labor, output, trade, and GDP. Implements ECONOMY.md sections 7.3 to 7.6.
 *
 * Every function below is preceded by the causal claim it encodes, in the same
 * wording used in ECONOMY.md. The claim is the thing to argue with; the
 * algebra is only its encoding. Keeping the wording identical in both places
 * is how the model document and the engine stay in sync.
 */

import {
  AG_LABOR_SHARE,
  AG_PRODUCTIVITY,
  COERCED_PARTICIPATION,
  FREE_PARTICIPATION,
  GOV_OUTPUT_FACTOR,
  INFRA_MAX,
  INFRA_SCALE,
  MAN_PRODUCTIVITY,
  STABILITY_DRAG_FLOOR,
  STABILITY_DRAG_RANGE,
  TARIFF_ELASTICITY_K,
  TARIFF_PROTECTION_K,
  TRADE_SERVICES_MULTIPLIER,
} from '../calibration';

/**
 * CAUSAL CLAIM
 * Only part of a population works. In 1790 roughly half the population was
 * under sixteen, so participation was low by modern standards. Enslaved people
 * were subjected to forced labor at far higher participation rates, including
 * women, children, and the elderly. This is a documented fact of the period's
 * economy, and the model would misstate Southern output if it were ignored.
 */
export function computeLaborForce(
  population: number,
  enslavedPopulation: number,
): number {
  const free = Math.max(0, population - enslavedPopulation);
  return free * FREE_PARTICIPATION + enslavedPopulation * COERCED_PARTICIPATION;
}

/**
 * CAUSAL CLAIM
 * Infrastructure raises productivity, but with diminishing returns: the tenth
 * road matters less than the first. The bonus is asymptotic, so infrastructure
 * can never be spammed to infinity.
 */
export function infrastructureBonus(cumulativeSpend: number): number {
  if (cumulativeSpend <= 0) return 0;
  return INFRA_MAX * (1 - Math.exp(-cumulativeSpend / INFRA_SCALE));
}

/**
 * CAUSAL CLAIM
 * Instability suppresses output: disrupted markets, seized goods, and men
 * under arms rather than at the plough.
 */
export function stabilityDrag(stability: number): number {
  const normalised = Math.min(100, Math.max(0, stability)) / 100;
  return STABILITY_DRAG_FLOOR + STABILITY_DRAG_RANGE * normalised;
}

/**
 * CAUSAL CLAIM (protection)
 * A tariff makes imported manufactures more expensive, which shelters domestic
 * manufacturing and lets it grow. This benefit accrues to regions that HAVE
 * manufacturing, namely New England and the Mid-Atlantic, while the cost falls
 * on every region that buys manufactured goods. That asymmetry is the origin
 * of sectional conflict over the tariff, and the model must produce it rather
 * than assert it.
 */
export function tariffProtectionBonus(tariffRate: number): number {
  return TARIFF_PROTECTION_K * Math.max(0, tariffRate);
}

export interface RegionOutput {
  agricultural: number;
  manufacturing: number;
}

/**
 * CAUSAL CLAIM
 * Output is labor times productivity. Productivity rises slowly with
 * infrastructure investment and falls with instability. Agriculture dominates
 * this period; manufacturing is small but is the thing tariff protection can
 * grow.
 */
export function computeRegionOutput(params: {
  regionId: string;
  laborForce: number;
  stability: number;
  cumulativeInfrastructure: number;
  tariffRate: number;
}): RegionOutput {
  const agShare = AG_LABOR_SHARE[params.regionId] ?? 0.8;
  const manShare = 1 - agShare;

  const infra = 1 + infrastructureBonus(params.cumulativeInfrastructure);
  const drag = stabilityDrag(params.stability);

  return {
    agricultural: params.laborForce * agShare * AG_PRODUCTIVITY * infra * drag,
    manufacturing:
      params.laborForce *
      manShare *
      MAN_PRODUCTIVITY *
      infra *
      drag *
      (1 + tariffProtectionBonus(params.tariffRate)),
  };
}

/**
 * CAUSAL CLAIM - THE TARIFF CURVE
 * A tariff raises revenue on every dollar of trade, but it also suppresses the
 * volume of trade it taxes. At low rates the suppression is negligible and
 * revenue rises almost linearly. As the rate climbs the suppression compounds,
 * and above roughly 25% the volume lost outweighs the rate gained and total
 * customs receipts FALL. Punitive tariffs collect less money than moderate
 * ones.
 *
 * Revenue is maximised at 1/sqrt(2K), which with K = 8 is exactly 0.25.
 */
export function tradeSuppression(tariffRate: number): number {
  const rate = Math.max(0, tariffRate);
  return Math.exp(-TARIFF_ELASTICITY_K * rate * rate);
}

/** Trade volume given capacity and the current tariff. */
export function computeTradeVolume(
  tradeCapacity: number,
  tariffRate: number,
): number {
  return tradeCapacity * tradeSuppression(tariffRate);
}

/**
 * Customs revenue. The product of what is traded and the rate charged on it,
 * which is precisely why raising the rate past the peak lowers the total.
 */
export function computeCustomsRevenue(
  tradeVolume: number,
  tariffRate: number,
): number {
  return tradeVolume * Math.max(0, tariffRate);
}

/**
 * CAUSAL CLAIM
 * GDP is the sum of what the country produces. Our composition must match the
 * composition of the historical series we benchmark against, or the comparison
 * view will report a difference that is really a definitional artefact.
 *
 * The Johnston-Williamson series we compare against deliberately INCLUDES
 * government output and private services. Omitting government output would
 * make our GDP systematically lower than the benchmark for reasons that have
 * nothing to do with player performance, which is exactly the false signal the
 * History view exists to avoid. (ECONOMY.md sections 2.3 and 7.6)
 */
export function computeGdp(params: {
  agriculturalOutput: number;
  manufacturingOutput: number;
  tradeVolume: number;
  federalOutlays: number;
}): number {
  const tradeServices = params.tradeVolume * TRADE_SERVICES_MULTIPLIER;
  const governmentOutput = params.federalOutlays * GOV_OUTPUT_FACTOR;
  return (
    params.agriculturalOutput +
    params.manufacturingOutput +
    tradeServices +
    governmentOutput
  );
}

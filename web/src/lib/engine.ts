import type { Descriptor, Observation, Rule, RuleWeight } from "@prisma/client";

export type EnrichedObservationRow = {
  observationId: number;
  isin: string;
  aldIssuerClass: string;
  fundIssuerClassOverride: string | null;
  aldRegion: string;
  fundRegionOverride: string | null;
  aldRatingBand: string;
  fundRatingBandOverride: string | null;
  effectiveIssuerClass: string;
  effectiveRegion: string;
  effectiveRatingBand: string;
  activeFeatureIds: number[];
  scoreByRuleId: Record<number, number>;
  scoreA: number;
  scoreB: number;
  scoreC: number;
  winningRuleId: number;
  winningDecisionCode: string;
  winningScore: number;
  descriptor: {
    routingQueue: string;
    slaBucket: string;
    costCenter: string;
  } | null;
};

function effectiveOverride(override: string | null | undefined, ald: string): string {
  const t = (override ?? "").trim();
  return t === "" ? ald : t;
}

/** Mirrors sql/postgres/demo.sql kernelization (LATERAL VALUES). */
export function kernelizeFeatureIds(o: Observation): number[] {
  const effIssuer = effectiveOverride(o.fundIssuerClassOverride, o.aldIssuerClass);
  const effRegion = effectiveOverride(o.fundRegionOverride, o.aldRegion);
  const effRating = effectiveOverride(o.fundRatingBandOverride, o.aldRatingBand);

  const ids: number[] = [];
  if (effIssuer === "sovereign") ids.push(1);
  if (effIssuer === "corporate") ids.push(2);
  if (effRegion === "emea") ids.push(3);
  if (effRegion === "na") ids.push(4);
  if (effRating === "ig") ids.push(5);
  return ids;
}

function scoreForObservation(
  featureIds: Set<number>,
  ruleId: number,
  weights: RuleWeight[],
): number {
  let s = 0;
  for (const rw of weights) {
    if (rw.ruleId === ruleId && featureIds.has(rw.featureId)) {
      s += rw.weight;
    }
  }
  return s;
}

export function computeEnrichedRows(
  observations: Observation[],
  rules: Rule[],
  weights: RuleWeight[],
  descriptors: Descriptor[],
): EnrichedObservationRow[] {
  const descByRule = new Map(descriptors.map((d) => [d.ruleId, d]));
  const ruleIds = [...rules].sort((a, b) => a.id - b.id).map((r) => r.id);

  return observations.map((o) => {
    const featureIds = new Set(kernelizeFeatureIds(o));
    const scoreByRuleId: Record<number, number> = {};
    for (const rid of ruleIds) {
      scoreByRuleId[rid] = scoreForObservation(featureIds, rid, weights);
    }

    const scoreA = scoreByRuleId[1] ?? 0;
    const scoreB = scoreByRuleId[2] ?? 0;
    const scoreC = scoreByRuleId[3] ?? 0;

    const firstId = ruleIds[0];
    let winningRuleId = firstId;
    let winningScore = scoreByRuleId[firstId] ?? 0;
    for (const rid of ruleIds) {
      const sc = scoreByRuleId[rid] ?? 0;
      if (sc > winningScore || (sc === winningScore && rid < winningRuleId)) {
        winningScore = sc;
        winningRuleId = rid;
      }
    }

    const winningRule = rules.find((r) => r.id === winningRuleId);
    const d = descByRule.get(winningRuleId);

    return {
      observationId: o.id,
      isin: o.isin,
      aldIssuerClass: o.aldIssuerClass,
      fundIssuerClassOverride: o.fundIssuerClassOverride,
      aldRegion: o.aldRegion,
      fundRegionOverride: o.fundRegionOverride,
      aldRatingBand: o.aldRatingBand,
      fundRatingBandOverride: o.fundRatingBandOverride,
      effectiveIssuerClass: effectiveOverride(o.fundIssuerClassOverride, o.aldIssuerClass),
      effectiveRegion: effectiveOverride(o.fundRegionOverride, o.aldRegion),
      effectiveRatingBand: effectiveOverride(o.fundRatingBandOverride, o.aldRatingBand),
      activeFeatureIds: [...featureIds].sort((a, b) => a - b),
      scoreByRuleId,
      scoreA,
      scoreB,
      scoreC,
      winningRuleId,
      winningDecisionCode: winningRule?.decisionCode ?? "",
      winningScore,
      descriptor: d
        ? {
            routingQueue: d.routingQueue,
            slaBucket: d.slaBucket,
            costCenter: d.costCenter,
          }
        : null,
    };
  });
}

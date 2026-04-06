import type { HierarchyRule, Observation, Rule } from "@prisma/client";

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
  hierarchyTop: string;
  hierarchyMiddle: string;
  hierarchyBottom: string;
  matchedHierarchyRuleId: number | null;
  descriptorValues: Array<string | null>;
  activeFeatureIds: number[];
  scoreByRuleId: Record<number, number>;
  scoreA: number;
  scoreB: number;
  scoreC: number;
  winningRuleId: number;
  winningDecisionCode: string;
  winningScore: number;
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

function deriveHierarchy(issuerClass: string): {
  hierarchyTop: string;
  hierarchyMiddle: string;
  hierarchyBottom: string;
} {
  const hierarchyTop = "Debt";
  const hierarchyMiddle =
    issuerClass === "sovereign" ? "Govt" : issuerClass === "corporate" ? "Corp" : "Deriv";
  return {
    hierarchyTop,
    hierarchyMiddle,
    hierarchyBottom: issuerClass,
  };
}

function resolveHierarchyRule(
  hierarchyRules: HierarchyRule[],
  hierarchyTop: string,
  hierarchyMiddle: string,
  hierarchyBottom: string,
) {
  const candidates = hierarchyRules
    .filter(
      (r) =>
        (r.hierarchyTop === "*" || r.hierarchyTop === hierarchyTop) &&
        (r.hierarchyMiddle === "*" || r.hierarchyMiddle === hierarchyMiddle) &&
        (r.hierarchyBottom === "*" || r.hierarchyBottom === hierarchyBottom),
    )
    .map((r) => ({
      rule: r,
      specificity:
        Number(r.hierarchyTop !== "*") +
        Number(r.hierarchyMiddle !== "*") +
        Number(r.hierarchyBottom !== "*"),
    }))
    .sort((a, b) => b.specificity - a.specificity || a.rule.id - b.rule.id);

  const winner = candidates[0];
  if (!winner) {
    return {
      matchedRule: null,
      matchStrength: 0,
    };
  }

  return {
    matchedRule: winner.rule,
    matchStrength: winner.specificity / 3,
  };
}

export function computeEnrichedRows(
  observations: Observation[],
  rules: Rule[],
  hierarchyRules: HierarchyRule[] = [],
): EnrichedObservationRow[] {
  const ruleIds = [...rules].sort((a, b) => a.id - b.id).map((r) => r.id);

  return observations.map((o) => {
    const featureIds = new Set(kernelizeFeatureIds(o));
    const effectiveIssuerClass = effectiveOverride(o.fundIssuerClassOverride, o.aldIssuerClass);
    const effectiveRegion = effectiveOverride(o.fundRegionOverride, o.aldRegion);
    const effectiveRatingBand = effectiveOverride(o.fundRatingBandOverride, o.aldRatingBand);
    const hierarchy = deriveHierarchy(effectiveIssuerClass);
    const hierarchyMatch = resolveHierarchyRule(hierarchyRules, hierarchy.hierarchyTop, hierarchy.hierarchyMiddle, hierarchy.hierarchyBottom);
    const scoreByRuleId: Record<number, number> = {};
    for (const rid of ruleIds) scoreByRuleId[rid] = 0;

    for (const rule of hierarchyRules) {
      const candidate = resolveHierarchyRule(
        [rule],
        hierarchy.hierarchyTop,
        hierarchy.hierarchyMiddle,
        hierarchy.hierarchyBottom,
      );
      if (candidate.matchStrength > (scoreByRuleId[rule.ruleId] ?? 0)) {
        scoreByRuleId[rule.ruleId] = candidate.matchStrength;
      }
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
    const matched = hierarchyMatch.matchedRule;
    const descriptorValues: Array<string | null> = matched
      ? [
          matched.descriptor01,
          matched.descriptor02,
          matched.descriptor03,
          matched.descriptor04,
          matched.descriptor05,
          matched.descriptor06,
          matched.descriptor07,
          matched.descriptor08,
          matched.descriptor09,
          matched.descriptor10,
        ]
      : [null, null, null, null, null, null, null, null, null, null];

    return {
      observationId: o.id,
      isin: o.isin,
      aldIssuerClass: o.aldIssuerClass,
      fundIssuerClassOverride: o.fundIssuerClassOverride,
      aldRegion: o.aldRegion,
      fundRegionOverride: o.fundRegionOverride,
      aldRatingBand: o.aldRatingBand,
      fundRatingBandOverride: o.fundRatingBandOverride,
      effectiveIssuerClass,
      effectiveRegion,
      effectiveRatingBand,
      hierarchyTop: hierarchy.hierarchyTop,
      hierarchyMiddle: hierarchy.hierarchyMiddle,
      hierarchyBottom: hierarchy.hierarchyBottom,
      matchedHierarchyRuleId: matched?.id ?? null,
      descriptorValues,
      activeFeatureIds: [...featureIds].sort((a, b) => a - b),
      scoreByRuleId,
      scoreA,
      scoreB,
      scoreC,
      winningRuleId,
      winningDecisionCode: winningRule?.decisionCode ?? "",
      winningScore,
    };
  });
}

import { unstable_noStore as noStore } from "next/cache";
import type { EnrichedObservationRow } from "@/lib/engine";
import { prisma } from "@/lib/prisma";

type SqlEnrichedRow = {
  observation_id: number;
  isin: string;
  ald_issuer_class: string;
  fund_issuer_class_override: string | null;
  ald_region: string;
  fund_region_override: string | null;
  ald_rating_band: string;
  fund_rating_band_override: string | null;
  effective_issuer_class: string;
  effective_region: string;
  effective_rating_band: string;
  hierarchy_top: string;
  hierarchy_middle: string;
  hierarchy_bottom: string;
  matched_hierarchy_rule_id: number | null;
  descriptor_01: string | null;
  descriptor_02: string | null;
  descriptor_03: string | null;
  descriptor_04: string | null;
  descriptor_05: string | null;
  descriptor_06: string | null;
  descriptor_07: string | null;
  descriptor_08: string | null;
  descriptor_09: string | null;
  descriptor_10: string | null;
  active_feature_ids: string | null;
  score_a: number | null;
  score_b: number | null;
  score_c: number | null;
  winning_rule_id: number;
  winning_workstream: string;
  winning_score: number;
};

type SqlScoreRow = { observation_id: number; rule_id: number; score: number };

/** Loads enriched rows via SQL using matrix-constraint scoring and argmax gating. */
export async function loadEnrichedRows() {
  noStore();
  const [rows, scoreRows, rules] = await Promise.all([
    prisma.$queryRawUnsafe<SqlEnrichedRow[]>("SELECT * FROM demo_get_enriched_rows()"),
    prisma.$queryRawUnsafe<SqlScoreRow[]>(
      "SELECT observation_id, rule_id, score FROM demo_get_dense_scores() ORDER BY observation_id, rule_id",
    ),
    prisma.rule.findMany({ orderBy: { id: "asc" } }),
  ]);

  const ruleIds = rules.map((r) => r.id);
  const scoreByObs = new Map<number, Record<number, number>>();
  for (const s of scoreRows) {
    const obsId = Number(s.observation_id);
    const ruleId = Number(s.rule_id);
    if (!scoreByObs.has(obsId)) {
      const init: Record<number, number> = {};
      for (const rid of ruleIds) init[rid] = 0;
      scoreByObs.set(obsId, init);
    }
    scoreByObs.get(obsId)![ruleId] = Number(s.score ?? 0);
  }

  return rows.map((r): EnrichedObservationRow => ({
    observationId: Number(r.observation_id),
    isin: r.isin,
    aldIssuerClass: r.ald_issuer_class,
    fundIssuerClassOverride: r.fund_issuer_class_override,
    aldRegion: r.ald_region,
    fundRegionOverride: r.fund_region_override,
    aldRatingBand: r.ald_rating_band,
    fundRatingBandOverride: r.fund_rating_band_override,
    effectiveIssuerClass: r.effective_issuer_class,
    effectiveRegion: r.effective_region,
    effectiveRatingBand: r.effective_rating_band,
    hierarchyTop: r.hierarchy_top,
    hierarchyMiddle: r.hierarchy_middle,
    hierarchyBottom: r.hierarchy_bottom,
    matchedHierarchyRuleId: r.matched_hierarchy_rule_id === null ? null : Number(r.matched_hierarchy_rule_id),
    descriptorValues: [
      r.descriptor_01,
      r.descriptor_02,
      r.descriptor_03,
      r.descriptor_04,
      r.descriptor_05,
      r.descriptor_06,
      r.descriptor_07,
      r.descriptor_08,
      r.descriptor_09,
      r.descriptor_10,
    ],
    activeFeatureIds: (r.active_feature_ids ?? "")
      .split(",")
      .map((x) => Number(x))
      .filter((x) => Number.isInteger(x) && x > 0),
    scoreByRuleId: scoreByObs.get(Number(r.observation_id)) ?? {},
    scoreA: Number(r.score_a ?? 0),
    scoreB: Number(r.score_b ?? 0),
    scoreC: Number(r.score_c ?? 0),
    winningRuleId: Number(r.winning_rule_id),
    winningDecisionCode: r.winning_workstream,
    winningScore: Number(r.winning_score ?? 0),
  }));
}

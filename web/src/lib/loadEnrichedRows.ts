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

type SqlScoreRow = {
  observation_id: number;
  rule_id: number;
  score: number;
};

/** Loads enriched rows by executing SQL scoring logic in SQLite (source-of-truth aligned with demo SQL). */
export async function loadEnrichedRows() {
  noStore();
  const [rows, scoreRows, rules] = await Promise.all([
    prisma.$queryRawUnsafe<SqlEnrichedRow[]>(`
      WITH obs_effective AS (
        SELECT
          o.observation_id,
          o.isin,
          o.ald_issuer_class,
          o.fund_issuer_class_override,
          o.ald_region,
          o.fund_region_override,
          o.ald_rating_band,
          o.fund_rating_band_override,
          COALESCE(NULLIF(TRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) AS effective_issuer_class,
          COALESCE(NULLIF(TRIM(o.fund_region_override), ''), o.ald_region) AS effective_region,
          COALESCE(NULLIF(TRIM(o.fund_rating_band_override), ''), o.ald_rating_band) AS effective_rating_band,
          'Debt' AS hierarchy_top,
          CASE
            WHEN COALESCE(NULLIF(TRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) = 'sovereign' THEN 'Govt'
            WHEN COALESCE(NULLIF(TRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) = 'corporate' THEN 'Corp'
            ELSE 'Deriv'
          END AS hierarchy_middle,
          COALESCE(NULLIF(TRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) AS hierarchy_bottom
        FROM observations o
      ),
      dense_scores AS (
        SELECT
          oe.observation_id,
          oe.isin,
          r.rule_id,
          r.decision_code,
          COALESCE(MAX(((hr.hierarchy_top <> '*') + (hr.hierarchy_middle <> '*') + (hr.hierarchy_bottom <> '*')) / 3.0), 0) AS score
        FROM obs_effective oe
        CROSS JOIN rules r
        LEFT JOIN hierarchy_enrichment_rules hr
          ON hr.rule_id = r.rule_id
         AND (hr.hierarchy_top = '*' OR hr.hierarchy_top = oe.hierarchy_top)
         AND (hr.hierarchy_middle = '*' OR hr.hierarchy_middle = oe.hierarchy_middle)
         AND (hr.hierarchy_bottom = '*' OR hr.hierarchy_bottom = oe.hierarchy_bottom)
        GROUP BY oe.observation_id, oe.isin, r.rule_id, r.decision_code
      ),
      wide AS (
        SELECT
          observation_id,
          MAX(CASE WHEN rule_id = 1 THEN score END) AS score_a,
          MAX(CASE WHEN rule_id = 2 THEN score END) AS score_b,
          MAX(CASE WHEN rule_id = 3 THEN score END) AS score_c
        FROM dense_scores
        GROUP BY observation_id
      ),
      ranked AS (
        SELECT
          ds.*,
          ROW_NUMBER() OVER (PARTITION BY ds.observation_id ORDER BY ds.score DESC, ds.rule_id ASC) AS rn
        FROM dense_scores ds
      ),
      hierarchy_candidates AS (
        SELECT
          oe.observation_id,
          hr.hierarchy_rule_id,
          hr.descriptive_value_a,
          hr.descriptive_value_b,
          hr.descriptive_value_c,
          hr.descriptive_value_d,
          hr.descriptive_value_e,
          hr.descriptive_value_f,
          hr.descriptive_value_g,
          hr.descriptive_value_h,
          hr.descriptive_value_i,
          hr.descriptive_value_j,
          ((hr.hierarchy_top <> '*') + (hr.hierarchy_middle <> '*') + (hr.hierarchy_bottom <> '*')) AS specificity
        FROM obs_effective oe
        INNER JOIN hierarchy_enrichment_rules hr
          ON (hr.hierarchy_top = '*' OR hr.hierarchy_top = oe.hierarchy_top)
         AND (hr.hierarchy_middle = '*' OR hr.hierarchy_middle = oe.hierarchy_middle)
         AND (hr.hierarchy_bottom = '*' OR hr.hierarchy_bottom = oe.hierarchy_bottom)
      ),
      hierarchy_ranked AS (
        SELECT
          hc.*,
          ROW_NUMBER() OVER (PARTITION BY hc.observation_id ORDER BY hc.specificity DESC, hc.hierarchy_rule_id ASC) AS rn
        FROM hierarchy_candidates hc
      ),
      feature_ids AS (
        SELECT x.observation_id, GROUP_CONCAT(CAST(x.feature_id AS TEXT), ',') AS active_feature_ids
        FROM (
          SELECT observation_id, 1 AS feature_id FROM obs_effective WHERE effective_issuer_class = 'sovereign'
          UNION ALL
          SELECT observation_id, 2 AS feature_id FROM obs_effective WHERE effective_issuer_class = 'corporate'
          UNION ALL
          SELECT observation_id, 3 AS feature_id FROM obs_effective WHERE effective_region = 'emea'
          UNION ALL
          SELECT observation_id, 4 AS feature_id FROM obs_effective WHERE effective_region = 'na'
          UNION ALL
          SELECT observation_id, 5 AS feature_id FROM obs_effective WHERE effective_rating_band = 'ig'
          ORDER BY observation_id, feature_id
        ) x
        GROUP BY x.observation_id
      )
      SELECT
        oe.observation_id,
        oe.isin,
        oe.ald_issuer_class,
        oe.fund_issuer_class_override,
        oe.ald_region,
        oe.fund_region_override,
        oe.ald_rating_band,
        oe.fund_rating_band_override,
        oe.effective_issuer_class,
        oe.effective_region,
        oe.effective_rating_band,
        oe.hierarchy_top,
        oe.hierarchy_middle,
        oe.hierarchy_bottom,
        hrk.hierarchy_rule_id AS matched_hierarchy_rule_id,
        hrk.descriptive_value_a AS descriptor_01,
        hrk.descriptive_value_b AS descriptor_02,
        hrk.descriptive_value_c AS descriptor_03,
        hrk.descriptive_value_d AS descriptor_04,
        hrk.descriptive_value_e AS descriptor_05,
        hrk.descriptive_value_f AS descriptor_06,
        hrk.descriptive_value_g AS descriptor_07,
        hrk.descriptive_value_h AS descriptor_08,
        hrk.descriptive_value_i AS descriptor_09,
        hrk.descriptive_value_j AS descriptor_10,
        fi.active_feature_ids,
        w.score_a,
        w.score_b,
        w.score_c,
        win.rule_id AS winning_rule_id,
        win.decision_code AS winning_workstream,
        win.score AS winning_score
      FROM obs_effective oe
      INNER JOIN ranked win ON win.observation_id = oe.observation_id AND win.rn = 1
      LEFT JOIN hierarchy_ranked hrk ON hrk.observation_id = oe.observation_id AND hrk.rn = 1
      LEFT JOIN wide w ON w.observation_id = oe.observation_id
      LEFT JOIN feature_ids fi ON fi.observation_id = oe.observation_id
      ORDER BY oe.observation_id;
    `),
    prisma.$queryRawUnsafe<SqlScoreRow[]>(`
      WITH obs_effective AS (
        SELECT
          o.observation_id,
          'Debt' AS hierarchy_top,
          CASE
            WHEN COALESCE(NULLIF(TRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) = 'sovereign' THEN 'Govt'
            WHEN COALESCE(NULLIF(TRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) = 'corporate' THEN 'Corp'
            ELSE 'Deriv'
          END AS hierarchy_middle,
          COALESCE(NULLIF(TRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) AS hierarchy_bottom
        FROM observations o
      )
      SELECT
        oe.observation_id,
        r.rule_id,
        COALESCE(MAX(((hr.hierarchy_top <> '*') + (hr.hierarchy_middle <> '*') + (hr.hierarchy_bottom <> '*')) / 3.0), 0) AS score
      FROM obs_effective oe
      CROSS JOIN rules r
      LEFT JOIN hierarchy_enrichment_rules hr
        ON hr.rule_id = r.rule_id
       AND (hr.hierarchy_top = '*' OR hr.hierarchy_top = oe.hierarchy_top)
       AND (hr.hierarchy_middle = '*' OR hr.hierarchy_middle = oe.hierarchy_middle)
       AND (hr.hierarchy_bottom = '*' OR hr.hierarchy_bottom = oe.hierarchy_bottom)
      GROUP BY oe.observation_id, r.rule_id
      ORDER BY oe.observation_id, r.rule_id;
    `),
    prisma.rule.findMany({ orderBy: { id: "asc" } }),
  ]);

  const ruleIds = rules.map((r) => r.id);
  const scoreByObs = new Map<number, Record<number, number>>();
  for (const s of scoreRows) {
    if (!scoreByObs.has(s.observation_id)) {
      const init: Record<number, number> = {};
      for (const rid of ruleIds) init[rid] = 0;
      scoreByObs.set(s.observation_id, init);
    }
    scoreByObs.get(s.observation_id)![s.rule_id] = Number(s.score ?? 0);
  }

  return rows.map((r): EnrichedObservationRow => ({
    observationId: r.observation_id,
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
    matchedHierarchyRuleId: r.matched_hierarchy_rule_id,
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
    scoreByRuleId: scoreByObs.get(r.observation_id) ?? {},
    scoreA: Number(r.score_a ?? 0),
    scoreB: Number(r.score_b ?? 0),
    scoreC: Number(r.score_c ?? 0),
    winningRuleId: r.winning_rule_id,
    winningDecisionCode: r.winning_workstream,
    winningScore: Number(r.winning_score ?? 0),
  }));
}

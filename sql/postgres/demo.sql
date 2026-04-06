-- =============================================================================
-- Synthetic demo: kernelization + matrix-style rule scoring
-- Domain: fixed income *securities* with **ald_*** vendor-style reference fields
-- and **fund_***_override columns (fund semantic layer). Effective = COALESCE
-- trimmed non-empty override, else ald. All ISINs fabricated; not vendor data.
--
-- Kernelization:
--   Each row carries **vendor (Aladdin-style) reference attributes** plus optional
--   **fund semantic-layer overrides** per hierarchy level. Effective value for
--   scoring is COALESCE(NULLIF(TRIM(fund_override),''), ald_value). That lets PMs
--   rebook geography, issuer bucket, or rating band for internal aggregation without
--   mutating the vendor feed.
--
-- NN analogy (interpretation, not training):
--   After kernelization, each observation is a feature vector d in R^M.
--   Applying K is a linear map R^M -> R^N: one score per outcome (same shape as
--   "logits" from a single linear layer — no bias term here, no activation).
--   The final step takes argmax over those scores — a hard max / winner-take-all
--   gate. (Production also layered precedence "waterfall" rules on top.)
--
-- Canonical routines created by this script:
--   demo_get_dense_scores()  -> matrix-style score rows (sparse dot-product)
--   demo_get_enriched_rows() -> final one-row-per-observation enriched output
--
-- The script runs in a single transaction (BEGIN … COMMIT) so it is atomic; on
-- success, demo_* tables remain for ad hoc queries (re-run safe via DROP IF EXISTS).
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS demo_get_enriched_rows();
DROP FUNCTION IF EXISTS demo_get_dense_scores();
DROP TABLE IF EXISTS demo_hierarchy_enrichment_rules;
DROP TABLE IF EXISTS demo_rules;
DROP TABLE IF EXISTS demo_observations;

CREATE TABLE demo_rules (
  rule_id         SMALLINT PRIMARY KEY,
  decision_code   TEXT NOT NULL UNIQUE
);

-- Raw observations: Aladdin-style reference columns + nullable fund overrides (UI / semantic layer).
CREATE TABLE demo_observations (
  observation_id BIGSERIAL PRIMARY KEY,
  isin                        TEXT NOT NULL,
  ald_issuer_class            TEXT NOT NULL,
  fund_issuer_class_override  TEXT,
  ald_region                  TEXT NOT NULL,
  fund_region_override        TEXT,
  ald_rating_band             TEXT NOT NULL,
  fund_rating_band_override   TEXT
);

-- Wildcard-capable hierarchy enrichment rules (specific beats general).
CREATE TABLE demo_hierarchy_enrichment_rules (
  hierarchy_rule_id  SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rule_id            SMALLINT NOT NULL REFERENCES demo_rules (rule_id),
  hierarchy_top      TEXT NOT NULL,
  hierarchy_middle   TEXT NOT NULL,
  hierarchy_bottom   TEXT NOT NULL,
  hierarchy_level_04 TEXT NOT NULL DEFAULT '*',
  hierarchy_level_05 TEXT NOT NULL DEFAULT '*',
  hierarchy_level_06 TEXT NOT NULL DEFAULT '*',
  hierarchy_level_07 TEXT NOT NULL DEFAULT '*',
  descriptive_value_a TEXT NOT NULL,
  descriptive_value_b TEXT,
  descriptive_value_c TEXT,
  descriptive_value_d TEXT,
  descriptive_value_e TEXT,
  descriptive_value_f TEXT,
  descriptive_value_g TEXT,
  descriptive_value_h TEXT,
  descriptive_value_i TEXT,
  descriptive_value_j TEXT
);

INSERT INTO demo_rules (rule_id, decision_code) VALUES
  (1, 'ald_sov_rates_na'),
  (2, 'ald_corp_credit_na'),
  (3, 'ald_corp_credit_emea');

-- Synthetic FI securities. Row 3: Aladdin books US corporate in **NA**; fund overrides
-- **region** to **emea** so it aggregates with EMEA credit cohorts (same scores as DE row).
INSERT INTO demo_observations (
  isin, ald_issuer_class, fund_issuer_class_override,
  ald_region, fund_region_override,
  ald_rating_band, fund_rating_band_override
) VALUES
  ('US00ALDINFI01', 'sovereign', NULL, 'na',   NULL, 'ig',   NULL),
  ('DE00ALDINFI02', 'corporate', NULL, 'emea', NULL, 'core', NULL),
  ('US00ALDINFI03', 'corporate', NULL, 'na',   'emea', 'core', NULL),
  ('GB00ALDINFI04', 'sovereign', NULL, 'emea', NULL, 'ig',   NULL),
  ('FR00ALDINFI05', 'corporate', NULL, 'emea', NULL, 'ig',   'core'),
  ('CA00ALDINFI06', 'corporate', NULL, 'na',   'emea', 'core', NULL),
  ('US00ALDINFI07', 'derivative',NULL, 'na',   NULL, 'core', NULL);

-- Rules are matched by effective hierarchy using '*' as wildcard.
-- Specificity precedence: rule with more non-wildcard levels wins.
INSERT INTO demo_hierarchy_enrichment_rules (
  rule_id, hierarchy_top, hierarchy_middle, hierarchy_bottom,
  descriptive_value_a, descriptive_value_b, descriptive_value_c, descriptive_value_d
) VALUES
  (1, 'Debt', 'Govt',  'sovereign', 'rates_coverage', 'SOV-RATES-NA', 'T+0_CLOSE', 'BOOK_NA_GOVT'),
  (3, 'Debt', 'Corp',  'corporate', 'credit_coverage', 'CORP-CREDIT-EMEA', 'T+1_STD', 'BOOK_EMEA_CREDIT'),
  (2, 'Debt', '*',     '*',         'general_debt_coverage', 'CORP-CREDIT-NA', 'T+1_STD', 'BOOK_NA_CREDIT');

-- Canonical scoring routine used by both demo output and web app API.
-- Implementation shape: sparse kernel features + dot-product style aggregation.
CREATE OR REPLACE FUNCTION demo_get_dense_scores()
RETURNS TABLE (
  observation_id BIGINT,
  isin TEXT,
  rule_id SMALLINT,
  decision_code TEXT,
  score NUMERIC
)
LANGUAGE SQL
AS $$
  WITH obs_hierarchy AS (
    SELECT
      o.observation_id,
      o.isin,
      'Debt'::TEXT AS hierarchy_top,
      CASE
        WHEN COALESCE(NULLIF(BTRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) = 'sovereign' THEN 'Govt'
        WHEN COALESCE(NULLIF(BTRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) = 'corporate' THEN 'Corp'
        ELSE 'Deriv'
      END AS hierarchy_middle,
      COALESCE(NULLIF(BTRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) AS hierarchy_bottom,
      COALESCE(NULLIF(BTRIM(o.fund_region_override), ''), o.ald_region) AS hierarchy_level_04,
      COALESCE(NULLIF(BTRIM(o.fund_rating_band_override), ''), o.ald_rating_band) AS hierarchy_level_05,
      '*'::TEXT AS hierarchy_level_06,
      '*'::TEXT AS hierarchy_level_07
    FROM demo_observations o
  ),
  obs_kernel AS (
    SELECT observation_id, 'top'::TEXT AS feature_axis, hierarchy_top AS feature_value FROM obs_hierarchy
    UNION ALL
    SELECT observation_id, 'middle'::TEXT AS feature_axis, hierarchy_middle AS feature_value FROM obs_hierarchy
    UNION ALL
    SELECT observation_id, 'bottom'::TEXT AS feature_axis, hierarchy_bottom AS feature_value FROM obs_hierarchy
    UNION ALL
    SELECT observation_id, 'l04'::TEXT AS feature_axis, hierarchy_level_04 AS feature_value FROM obs_hierarchy
    UNION ALL
    SELECT observation_id, 'l05'::TEXT AS feature_axis, hierarchy_level_05 AS feature_value FROM obs_hierarchy
    UNION ALL
    SELECT observation_id, 'l06'::TEXT AS feature_axis, hierarchy_level_06 AS feature_value FROM obs_hierarchy
    UNION ALL
    SELECT observation_id, 'l07'::TEXT AS feature_axis, hierarchy_level_07 AS feature_value FROM obs_hierarchy
  ),
  rule_kernel AS (
    SELECT hierarchy_rule_id, rule_id, 'top'::TEXT AS feature_axis, hierarchy_top AS feature_value
    FROM demo_hierarchy_enrichment_rules
    WHERE hierarchy_top <> '*'
    UNION ALL
    SELECT hierarchy_rule_id, rule_id, 'middle'::TEXT AS feature_axis, hierarchy_middle AS feature_value
    FROM demo_hierarchy_enrichment_rules
    WHERE hierarchy_middle <> '*'
    UNION ALL
    SELECT hierarchy_rule_id, rule_id, 'bottom'::TEXT AS feature_axis, hierarchy_bottom AS feature_value
    FROM demo_hierarchy_enrichment_rules
    WHERE hierarchy_bottom <> '*'
    UNION ALL
    SELECT hierarchy_rule_id, rule_id, 'l04'::TEXT AS feature_axis, hierarchy_level_04 AS feature_value
    FROM demo_hierarchy_enrichment_rules
    WHERE hierarchy_level_04 <> '*'
    UNION ALL
    SELECT hierarchy_rule_id, rule_id, 'l05'::TEXT AS feature_axis, hierarchy_level_05 AS feature_value
    FROM demo_hierarchy_enrichment_rules
    WHERE hierarchy_level_05 <> '*'
    UNION ALL
    SELECT hierarchy_rule_id, rule_id, 'l06'::TEXT AS feature_axis, hierarchy_level_06 AS feature_value
    FROM demo_hierarchy_enrichment_rules
    WHERE hierarchy_level_06 <> '*'
    UNION ALL
    SELECT hierarchy_rule_id, rule_id, 'l07'::TEXT AS feature_axis, hierarchy_level_07 AS feature_value
    FROM demo_hierarchy_enrichment_rules
    WHERE hierarchy_level_07 <> '*'
  ),
  obs_rule_space AS (
    SELECT
      oh.observation_id,
      oh.isin,
      r.rule_id,
      r.decision_code,
      hr.hierarchy_rule_id
    FROM obs_hierarchy oh
    CROSS JOIN demo_rules r
    LEFT JOIN demo_hierarchy_enrichment_rules hr
      ON hr.rule_id = r.rule_id
  ),
  hierarchy_rule_scores AS (
    SELECT
      ors.observation_id,
      ors.isin,
      ors.rule_id,
      ors.decision_code,
      ors.hierarchy_rule_id,
      CASE
        WHEN COALESCE(SUM(
          CASE
            WHEN rk.feature_axis IS NOT NULL
             AND ok.feature_value IS DISTINCT FROM rk.feature_value THEN 1
            ELSE 0
          END
        ), 0) > 0 THEN 0
        ELSE COALESCE(SUM(
          CASE
            WHEN rk.feature_axis IS NOT NULL
             AND ok.feature_value = rk.feature_value THEN 1
            ELSE 0
          END
        ) / GREATEST(
          COALESCE(SUM(CASE WHEN rk.feature_axis IS NOT NULL THEN 1 ELSE 0 END), 0),
          3
        )::NUMERIC, 0)
      END AS score
    FROM obs_rule_space ors
    LEFT JOIN rule_kernel rk
      ON rk.hierarchy_rule_id = ors.hierarchy_rule_id
    LEFT JOIN obs_kernel ok
      ON ok.observation_id = ors.observation_id
     AND ok.feature_axis = rk.feature_axis
    GROUP BY
      ors.observation_id,
      ors.isin,
      ors.rule_id,
      ors.decision_code,
      ors.hierarchy_rule_id
  )
  SELECT
    hrs.observation_id,
    hrs.isin,
    hrs.rule_id,
    hrs.decision_code,
    MAX(hrs.score) AS score
  FROM hierarchy_rule_scores hrs
  GROUP BY hrs.observation_id, hrs.isin, hrs.rule_id, hrs.decision_code
  ORDER BY hrs.observation_id, hrs.rule_id;
$$;

-- Canonical enriched-row routine (table-valued function; planner can cache plan).
CREATE OR REPLACE FUNCTION demo_get_enriched_rows()
RETURNS TABLE (
  observation_id BIGINT,
  isin TEXT,
  ald_issuer_class TEXT,
  fund_issuer_class_override TEXT,
  ald_region TEXT,
  fund_region_override TEXT,
  ald_rating_band TEXT,
  fund_rating_band_override TEXT,
  effective_issuer_class TEXT,
  effective_region TEXT,
  effective_rating_band TEXT,
  hierarchy_top TEXT,
  hierarchy_middle TEXT,
  hierarchy_bottom TEXT,
  hierarchy_level_04 TEXT,
  hierarchy_level_05 TEXT,
  hierarchy_level_06 TEXT,
  hierarchy_level_07 TEXT,
  matched_hierarchy_rule_id SMALLINT,
  descriptor_01 TEXT,
  descriptor_02 TEXT,
  descriptor_03 TEXT,
  descriptor_04 TEXT,
  descriptor_05 TEXT,
  descriptor_06 TEXT,
  descriptor_07 TEXT,
  descriptor_08 TEXT,
  descriptor_09 TEXT,
  descriptor_10 TEXT,
  active_feature_ids TEXT,
  score_a NUMERIC,
  score_b NUMERIC,
  score_c NUMERIC,
  winning_rule_id SMALLINT,
  winning_workstream TEXT,
  winning_score NUMERIC
)
LANGUAGE SQL
AS $$
  WITH dense_scores AS (
    SELECT * FROM demo_get_dense_scores()
  ),
  wide AS (
    SELECT
      observation_id,
      isin,
      MAX(score) FILTER (WHERE rule_id = 1) AS a,
      MAX(score) FILTER (WHERE rule_id = 2) AS b,
      MAX(score) FILTER (WHERE rule_id = 3) AS c
    FROM dense_scores
    GROUP BY observation_id, isin
  ),
  unpivoted AS (
    SELECT
      w.observation_id,
      w.isin,
      x.slot,
      x.rule_id,
      x.pre_max_score
    FROM wide w
    CROSS JOIN LATERAL (
      VALUES
        ('a', 1, w.a),
        ('b', 2, w.b),
        ('c', 3, w.c)
    ) AS x(slot, rule_id, pre_max_score)
  ),
  ranked AS (
    SELECT
      u.*,
      ROW_NUMBER() OVER (PARTITION BY u.observation_id ORDER BY u.pre_max_score DESC, u.rule_id) AS rn
    FROM unpivoted u
  ),
  obs_hierarchy AS (
    SELECT
      o.observation_id,
      'Debt'::TEXT AS hierarchy_top,
      CASE
        WHEN COALESCE(NULLIF(BTRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) = 'sovereign' THEN 'Govt'
        WHEN COALESCE(NULLIF(BTRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) = 'corporate' THEN 'Corp'
        ELSE 'Deriv'
      END AS hierarchy_middle,
      COALESCE(NULLIF(BTRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) AS hierarchy_bottom,
      COALESCE(NULLIF(BTRIM(o.fund_region_override), ''), o.ald_region) AS hierarchy_level_04,
      COALESCE(NULLIF(BTRIM(o.fund_rating_band_override), ''), o.ald_rating_band) AS hierarchy_level_05,
      '*'::TEXT AS hierarchy_level_06,
      '*'::TEXT AS hierarchy_level_07
    FROM demo_observations o
  ),
  hierarchy_candidates AS (
    SELECT
      oh.observation_id,
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
      (
        (hr.hierarchy_top <> '*')::INT +
        (hr.hierarchy_middle <> '*')::INT +
        (hr.hierarchy_bottom <> '*')::INT +
        (hr.hierarchy_level_04 <> '*')::INT +
        (hr.hierarchy_level_05 <> '*')::INT +
        (hr.hierarchy_level_06 <> '*')::INT +
        (hr.hierarchy_level_07 <> '*')::INT
      ) AS specificity
    FROM obs_hierarchy oh
    JOIN demo_hierarchy_enrichment_rules hr
      ON (hr.hierarchy_top = '*' OR hr.hierarchy_top = oh.hierarchy_top)
     AND (hr.hierarchy_middle = '*' OR hr.hierarchy_middle = oh.hierarchy_middle)
     AND (hr.hierarchy_bottom = '*' OR hr.hierarchy_bottom = oh.hierarchy_bottom)
     AND (hr.hierarchy_level_04 = '*' OR hr.hierarchy_level_04 = oh.hierarchy_level_04)
     AND (hr.hierarchy_level_05 = '*' OR hr.hierarchy_level_05 = oh.hierarchy_level_05)
     AND (hr.hierarchy_level_06 = '*' OR hr.hierarchy_level_06 = oh.hierarchy_level_06)
     AND (hr.hierarchy_level_07 = '*' OR hr.hierarchy_level_07 = oh.hierarchy_level_07)
  ),
  hierarchy_ranked AS (
    SELECT
      *,
      ROW_NUMBER() OVER (PARTITION BY observation_id ORDER BY specificity DESC, hierarchy_rule_id ASC) AS rn
    FROM hierarchy_candidates
  ),
  feature_ids AS (
    SELECT
      x.observation_id,
      STRING_AGG(x.feature_id::TEXT, ',' ORDER BY x.feature_id) AS active_feature_ids
    FROM (
      SELECT o.observation_id, 1 AS feature_id FROM demo_observations o WHERE COALESCE(NULLIF(BTRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) = 'sovereign'
      UNION ALL
      SELECT o.observation_id, 2 AS feature_id FROM demo_observations o WHERE COALESCE(NULLIF(BTRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) = 'corporate'
      UNION ALL
      SELECT o.observation_id, 3 AS feature_id FROM demo_observations o WHERE COALESCE(NULLIF(BTRIM(o.fund_region_override), ''), o.ald_region) = 'emea'
      UNION ALL
      SELECT o.observation_id, 4 AS feature_id FROM demo_observations o WHERE COALESCE(NULLIF(BTRIM(o.fund_region_override), ''), o.ald_region) = 'na'
      UNION ALL
      SELECT o.observation_id, 5 AS feature_id FROM demo_observations o WHERE COALESCE(NULLIF(BTRIM(o.fund_rating_band_override), ''), o.ald_rating_band) = 'ig'
    ) x
    GROUP BY x.observation_id
  )
  SELECT
    o.observation_id,
    o.isin,
    o.ald_issuer_class,
    o.fund_issuer_class_override,
    o.ald_region,
    o.fund_region_override,
    o.ald_rating_band,
    o.fund_rating_band_override,
    COALESCE(NULLIF(BTRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) AS effective_issuer_class,
    COALESCE(NULLIF(BTRIM(o.fund_region_override), ''), o.ald_region) AS effective_region,
    COALESCE(NULLIF(BTRIM(o.fund_rating_band_override), ''), o.ald_rating_band) AS effective_rating_band,
    'Debt'::TEXT AS hierarchy_top,
    CASE
      WHEN COALESCE(NULLIF(BTRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) = 'sovereign' THEN 'Govt'
      WHEN COALESCE(NULLIF(BTRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) = 'corporate' THEN 'Corp'
      ELSE 'Deriv'
    END AS hierarchy_middle,
    COALESCE(NULLIF(BTRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) AS hierarchy_bottom,
    COALESCE(NULLIF(BTRIM(o.fund_region_override), ''), o.ald_region) AS hierarchy_level_04,
    COALESCE(NULLIF(BTRIM(o.fund_rating_band_override), ''), o.ald_rating_band) AS hierarchy_level_05,
    '*'::TEXT AS hierarchy_level_06,
    '*'::TEXT AS hierarchy_level_07,
    hm.hierarchy_rule_id AS matched_hierarchy_rule_id,
    hm.descriptive_value_a AS descriptor_01,
    hm.descriptive_value_b AS descriptor_02,
    hm.descriptive_value_c AS descriptor_03,
    hm.descriptive_value_d AS descriptor_04,
    hm.descriptive_value_e AS descriptor_05,
    hm.descriptive_value_f AS descriptor_06,
    hm.descriptive_value_g AS descriptor_07,
    hm.descriptive_value_h AS descriptor_08,
    hm.descriptive_value_i AS descriptor_09,
    hm.descriptive_value_j AS descriptor_10,
    fi.active_feature_ids,
    w.a AS score_a,
    w.b AS score_b,
    w.c AS score_c,
    win.rule_id AS winning_rule_id,
    r.decision_code AS winning_workstream,
    win.pre_max_score AS winning_score
  FROM demo_observations o
  JOIN wide w ON w.observation_id = o.observation_id
  JOIN ranked win ON win.observation_id = o.observation_id AND win.rn = 1
  JOIN demo_rules r ON r.rule_id = win.rule_id
  LEFT JOIN hierarchy_ranked hm ON hm.observation_id = o.observation_id AND hm.rn = 1
  LEFT JOIN feature_ids fi ON fi.observation_id = o.observation_id
  ORDER BY o.observation_id;
$$;

-- Runtime hierarchy rules (no static K table): sparse-kernel matrix-style scoring drives real-time score.
SELECT
  'HIERARCHY_RULE_SPACE' AS section,
  hr.hierarchy_rule_id,
  hr.rule_id,
  r.decision_code,
  hr.hierarchy_top,
  hr.hierarchy_middle,
  hr.hierarchy_bottom,
  hr.hierarchy_level_04,
  hr.hierarchy_level_05,
  hr.hierarchy_level_06,
  hr.hierarchy_level_07,
  hr.descriptive_value_a
FROM demo_hierarchy_enrichment_rules hr
JOIN demo_rules r ON r.rule_id = hr.rule_id
ORDER BY hr.hierarchy_rule_id;

-- ---------------------------------------------------------------------------
-- Final enriched output now comes from the canonical table-valued function.
-- ---------------------------------------------------------------------------
SELECT
  'ENRICHED_OBSERVATION_ROW' AS section,
  *
FROM demo_get_enriched_rows();

COMMIT;

-- =============================================================================
-- Synthetic demo: kernelization + variable space / subject space + rule scoring
-- Domain: fixed income *securities* with **ald_*** vendor-style reference fields
-- and **fund_***_override columns (fund semantic layer). Effective = COALESCE
-- trimmed non-empty override, else ald. All ISINs fabricated; not vendor data.
--
-- Variable space (standard multivariate view):
--   Each *observation* is a vector in R^M: one coordinate per atomic feature
--   (column / dimension). Rows of D are points in that space.
--
-- Subject space (dual view):
--   Each *feature* is a vector over the O observations (same inner products;
--   geometrically the transpose). Useful to see which securities activate
--   which dimensions together.
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
-- UNPIVOT-shaped pipeline: PostgreSQL uses LATERAL VALUES to match SQL Server
-- UNPIVOT (wide a,b,c -> long rows). Then argmax -> join raw feed + semantic
-- descriptors on one row per observation (ENRICHED_OBSERVATION_ROW).
--
-- The script runs in a single transaction (BEGIN … COMMIT) so it is atomic; on
-- success, demo_* tables remain for ad hoc queries (re-run safe via DROP IF EXISTS).
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS demo_observation_features;
DROP TABLE IF EXISTS demo_hierarchy_enrichment_rules;
DROP TABLE IF EXISTS demo_rules;
DROP TABLE IF EXISTS demo_features;
DROP TABLE IF EXISTS demo_observations;

CREATE TABLE demo_features (
  feature_id   SMALLINT PRIMARY KEY,
  feature_code TEXT NOT NULL UNIQUE
);

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

-- D (sparse): kernelized 0/1 coordinates in variable space.
CREATE TABLE demo_observation_features (
  observation_id BIGINT NOT NULL REFERENCES demo_observations (observation_id),
  feature_id     SMALLINT NOT NULL REFERENCES demo_features (feature_id),
  PRIMARY KEY (observation_id, feature_id)
);

-- Wildcard-capable hierarchy enrichment rules (specific beats general).
CREATE TABLE demo_hierarchy_enrichment_rules (
  hierarchy_rule_id  SMALLINT PRIMARY KEY,
  rule_id            SMALLINT NOT NULL REFERENCES demo_rules (rule_id),
  hierarchy_top      TEXT NOT NULL,
  hierarchy_middle   TEXT NOT NULL,
  hierarchy_bottom   TEXT NOT NULL,
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

INSERT INTO demo_features (feature_id, feature_code) VALUES
  (1, 'fi_sovereign'),
  (2, 'fi_corporate'),
  (3, 'region_emea'),
  (4, 'region_na'),
  (5, 'rating_ig');

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
  hierarchy_rule_id, rule_id, hierarchy_top, hierarchy_middle, hierarchy_bottom,
  descriptive_value_a, descriptive_value_b, descriptive_value_c, descriptive_value_d
) VALUES
  (1, 1, 'Debt', 'Govt',  'sovereign', 'rates_coverage', 'SOV-RATES-NA', 'T+0_CLOSE', 'BOOK_NA_GOVT'),
  (2, 3, 'Debt', 'Corp',  'corporate', 'credit_coverage', 'CORP-CREDIT-EMEA', 'T+1_STD', 'BOOK_EMEA_CREDIT'),
  (3, 2, 'Debt', '*',     '*',         'general_debt_coverage', 'CORP-CREDIT-NA', 'T+1_STD', 'BOOK_NA_CREDIT');

-- ---------------------------------------------------------------------------
-- Kernelization: qualitative -> fixed binary features in R^M
-- (Explicit mapping; in production this can be table-driven from the semantic layer.)
-- ---------------------------------------------------------------------------
INSERT INTO demo_observation_features (observation_id, feature_id)
SELECT o.observation_id, v.feature_id
FROM demo_observations o
CROSS JOIN LATERAL (
  VALUES
    (CASE WHEN COALESCE(NULLIF(BTRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) = 'sovereign' THEN 1 END),
    (CASE WHEN COALESCE(NULLIF(BTRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) = 'corporate' THEN 2 END),
    (CASE WHEN COALESCE(NULLIF(BTRIM(o.fund_region_override), ''), o.ald_region) = 'emea' THEN 3 END),
    (CASE WHEN COALESCE(NULLIF(BTRIM(o.fund_region_override), ''), o.ald_region) = 'na'   THEN 4 END),
    (CASE WHEN COALESCE(NULLIF(BTRIM(o.fund_rating_band_override), ''), o.ald_rating_band) = 'ig' THEN 5 END)
) AS v(feature_id)
WHERE v.feature_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Variable space: each row is d_j in R^M (coordinates over shared feature axes).
-- Same axes as rows of K; score_ij = <k_i, d_j> with sparse nonzero entries.
-- ---------------------------------------------------------------------------
SELECT
  'VARIABLE_SPACE_D_MATRIX' AS section,
  o.observation_id,
  o.isin,
  COALESCE(BOOL_OR(ofe.feature_id = 1), FALSE)::INT AS f_fi_sovereign,
  COALESCE(BOOL_OR(ofe.feature_id = 2), FALSE)::INT AS f_fi_corporate,
  COALESCE(BOOL_OR(ofe.feature_id = 3), FALSE)::INT AS f_region_emea,
  COALESCE(BOOL_OR(ofe.feature_id = 4), FALSE)::INT AS f_region_na,
  COALESCE(BOOL_OR(ofe.feature_id = 5), FALSE)::INT AS f_rating_ig
FROM demo_observations o
LEFT JOIN demo_observation_features ofe ON ofe.observation_id = o.observation_id
GROUP BY o.observation_id, o.isin
ORDER BY o.observation_id;

-- Runtime hierarchy rules (no static K table): specificity drives real-time score.
SELECT
  'HIERARCHY_RULE_SPACE' AS section,
  hr.hierarchy_rule_id,
  hr.rule_id,
  r.decision_code,
  hr.hierarchy_top,
  hr.hierarchy_middle,
  hr.hierarchy_bottom,
  hr.descriptive_value_a
FROM demo_hierarchy_enrichment_rules hr
JOIN demo_rules r ON r.rule_id = hr.rule_id
ORDER BY hr.hierarchy_rule_id;

-- ---------------------------------------------------------------------------
-- Subject space: each row is one feature's vector over observations (transpose
-- of D). Coordinates are activation (0/1) per security after kernelization.
-- ---------------------------------------------------------------------------
SELECT
  'SUBJECT_SPACE_BY_ISIN' AS section,
  fe.feature_code,
  o.isin,
  COALESCE(MAX(CASE WHEN ofe.feature_id IS NOT NULL THEN 1 END), 0) AS is_active
FROM demo_features fe
CROSS JOIN demo_observations o
LEFT JOIN demo_observation_features ofe
  ON ofe.feature_id = fe.feature_id
 AND ofe.observation_id = o.observation_id
GROUP BY fe.feature_id, fe.feature_code, o.isin
ORDER BY fe.feature_id, o.isin;

-- ---------------------------------------------------------------------------
-- Linear layer: s_ij = <k_i, d_j> = sum_m k_im * d_jm  (sparse; same as one
-- column of K * D^T). Each column j is an N-vector of pre-max "scores".
-- ---------------------------------------------------------------------------
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
    COALESCE(NULLIF(BTRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) AS hierarchy_bottom
  FROM demo_observations o
),
dense_scores AS (
  SELECT
    oh.observation_id,
    oh.isin,
    r.rule_id,
    r.decision_code,
    COALESCE(MAX(((hr.hierarchy_top <> '*')::INT + (hr.hierarchy_middle <> '*')::INT + (hr.hierarchy_bottom <> '*')::INT) / 3.0), 0) AS score
  FROM obs_hierarchy oh
  CROSS JOIN demo_rules r
  LEFT JOIN demo_hierarchy_enrichment_rules hr
    ON hr.rule_id = r.rule_id
   AND (hr.hierarchy_top = '*' OR hr.hierarchy_top = oh.hierarchy_top)
   AND (hr.hierarchy_middle = '*' OR hr.hierarchy_middle = oh.hierarchy_middle)
   AND (hr.hierarchy_bottom = '*' OR hr.hierarchy_bottom = oh.hierarchy_bottom)
  GROUP BY oh.observation_id, oh.isin, r.rule_id, r.decision_code
),
scores AS (
  SELECT * FROM dense_scores WHERE score > 0
)
SELECT
  'LINEAR_LAYER_SCORES' AS section,
  observation_id,
  isin,
  rule_id,
  decision_code,
  score AS pre_max_score
FROM scores
ORDER BY observation_id, rule_id;

-- ---------------------------------------------------------------------------
-- Gating: argmax over outcomes (hard max). rn = 1 is the winning class.
-- ---------------------------------------------------------------------------
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
    COALESCE(NULLIF(BTRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) AS hierarchy_bottom
  FROM demo_observations o
),
scores AS (
  SELECT
    oh.observation_id,
    oh.isin,
    r.rule_id,
    r.decision_code,
    COALESCE(MAX(((hr.hierarchy_top <> '*')::INT + (hr.hierarchy_middle <> '*')::INT + (hr.hierarchy_bottom <> '*')::INT) / 3.0), 0) AS score
  FROM obs_hierarchy oh
  CROSS JOIN demo_rules r
  LEFT JOIN demo_hierarchy_enrichment_rules hr
    ON hr.rule_id = r.rule_id
   AND (hr.hierarchy_top = '*' OR hr.hierarchy_top = oh.hierarchy_top)
   AND (hr.hierarchy_middle = '*' OR hr.hierarchy_middle = oh.hierarchy_middle)
   AND (hr.hierarchy_bottom = '*' OR hr.hierarchy_bottom = oh.hierarchy_bottom)
  GROUP BY oh.observation_id, oh.isin, r.rule_id, r.decision_code
),
ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (PARTITION BY observation_id ORDER BY score DESC, rule_id) AS rn
  FROM scores
)
SELECT
  'ARGMAX_GATE' AS section,
  observation_id,
  isin,
  decision_code AS winning_workstream,
  score AS winning_score
FROM ranked
WHERE rn = 1
ORDER BY observation_id;

-- ---------------------------------------------------------------------------
-- Long score shape (same rows as SQL Server UNPIVOT on a,b,c).
-- ---------------------------------------------------------------------------
WITH dense_scores AS (
  SELECT
    oh.observation_id,
    oh.isin,
    r.rule_id,
    COALESCE(MAX(((hr.hierarchy_top <> '*')::INT + (hr.hierarchy_middle <> '*')::INT + (hr.hierarchy_bottom <> '*')::INT) / 3.0), 0) AS score
  FROM (
    SELECT
      o.observation_id,
      o.isin,
      'Debt'::TEXT AS hierarchy_top,
      CASE
        WHEN COALESCE(NULLIF(BTRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) = 'sovereign' THEN 'Govt'
        WHEN COALESCE(NULLIF(BTRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) = 'corporate' THEN 'Corp'
        ELSE 'Deriv'
      END AS hierarchy_middle,
      COALESCE(NULLIF(BTRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) AS hierarchy_bottom
    FROM demo_observations o
  ) oh
  CROSS JOIN demo_rules r
  LEFT JOIN demo_hierarchy_enrichment_rules hr
    ON hr.rule_id = r.rule_id
   AND (hr.hierarchy_top = '*' OR hr.hierarchy_top = oh.hierarchy_top)
   AND (hr.hierarchy_middle = '*' OR hr.hierarchy_middle = oh.hierarchy_middle)
   AND (hr.hierarchy_bottom = '*' OR hr.hierarchy_bottom = oh.hierarchy_bottom)
  GROUP BY oh.observation_id, oh.isin, r.rule_id
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
    x.slot AS decision_slot,
    x.rule_id,
    x.pre_max_score
  FROM wide w
  CROSS JOIN LATERAL (
    VALUES
      ('a', 1, w.a),
      ('b', 2, w.b),
      ('c', 3, w.c)
  ) AS x(slot, rule_id, pre_max_score)
)
SELECT
  'UNPIVOT_LONG' AS section,
  observation_id,
  isin,
  decision_slot,
  rule_id,
  pre_max_score
FROM unpivoted
ORDER BY observation_id, decision_slot;

-- ---------------------------------------------------------------------------
-- Wide score vector -> UNPIVOT equivalent (LATERAL VALUES) -> argmax ->
-- one output row per observation: raw qualitative feed + winning decision +
-- semantic-layer descriptors (blog: row-shaped for downstream consumers).
-- Short slot names a,b,c mirror production use of minimal UNPIVOT column ids.
-- Dense scores (every obs x rule, zeros included) so argmax matches production.
-- ---------------------------------------------------------------------------
WITH dense_scores AS (
  SELECT
    oh.observation_id,
    oh.isin,
    r.rule_id,
    COALESCE(MAX(((hr.hierarchy_top <> '*')::INT + (hr.hierarchy_middle <> '*')::INT + (hr.hierarchy_bottom <> '*')::INT) / 3.0), 0) AS score
  FROM (
    SELECT
      o.observation_id,
      o.isin,
      'Debt'::TEXT AS hierarchy_top,
      CASE
        WHEN COALESCE(NULLIF(BTRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) = 'sovereign' THEN 'Govt'
        WHEN COALESCE(NULLIF(BTRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) = 'corporate' THEN 'Corp'
        ELSE 'Deriv'
      END AS hierarchy_middle,
      COALESCE(NULLIF(BTRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) AS hierarchy_bottom
    FROM demo_observations o
  ) oh
  CROSS JOIN demo_rules r
  LEFT JOIN demo_hierarchy_enrichment_rules hr
    ON hr.rule_id = r.rule_id
   AND (hr.hierarchy_top = '*' OR hr.hierarchy_top = oh.hierarchy_top)
   AND (hr.hierarchy_middle = '*' OR hr.hierarchy_middle = oh.hierarchy_middle)
   AND (hr.hierarchy_bottom = '*' OR hr.hierarchy_bottom = oh.hierarchy_bottom)
  GROUP BY oh.observation_id, oh.isin, r.rule_id
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
    COALESCE(NULLIF(BTRIM(o.fund_issuer_class_override), ''), o.ald_issuer_class) AS hierarchy_bottom
  FROM demo_observations o
),
hierarchy_candidates AS (
  SELECT
    oh.observation_id,
    hr.hierarchy_rule_id,
    hr.descriptive_value_a,
    ((hr.hierarchy_top <> '*')::INT + (hr.hierarchy_middle <> '*')::INT + (hr.hierarchy_bottom <> '*')::INT) AS specificity
  FROM obs_hierarchy oh
  JOIN demo_hierarchy_enrichment_rules hr
    ON (hr.hierarchy_top = '*' OR hr.hierarchy_top = oh.hierarchy_top)
   AND (hr.hierarchy_middle = '*' OR hr.hierarchy_middle = oh.hierarchy_middle)
   AND (hr.hierarchy_bottom = '*' OR hr.hierarchy_bottom = oh.hierarchy_bottom)
),
hierarchy_ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (PARTITION BY observation_id ORDER BY specificity DESC, hierarchy_rule_id ASC) AS rn
  FROM hierarchy_candidates
)
SELECT
  'ENRICHED_OBSERVATION_ROW' AS section,
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
  w.a AS score_a,
  w.b AS score_b,
  w.c AS score_c,
  r.decision_code AS winning_workstream,
  win.pre_max_score AS winning_score,
  hm.descriptive_value_a,
  hm.descriptive_value_b AS descriptor_02,
  hm.descriptive_value_c AS descriptor_03,
  hm.descriptive_value_d AS descriptor_04,
  hm.descriptive_value_e AS descriptor_05,
  hm.descriptive_value_f AS descriptor_06,
  hm.descriptive_value_g AS descriptor_07,
  hm.descriptive_value_h AS descriptor_08,
  hm.descriptive_value_i AS descriptor_09,
  hm.descriptive_value_j AS descriptor_10
FROM demo_observations o
JOIN wide w ON w.observation_id = o.observation_id
JOIN ranked win ON win.observation_id = o.observation_id AND win.rn = 1
JOIN demo_rules r ON r.rule_id = win.rule_id
LEFT JOIN hierarchy_ranked hm ON hm.observation_id = o.observation_id AND hm.rn = 1
ORDER BY o.observation_id;

COMMIT;

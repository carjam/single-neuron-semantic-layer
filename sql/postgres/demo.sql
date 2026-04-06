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
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS demo_observation_features;
DROP TABLE IF EXISTS demo_rule_enrichment;
DROP TABLE IF EXISTS demo_rule_weights;
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

-- User-maintained semantic attributes per decision (white columns in the blog UI).
CREATE TABLE demo_rule_enrichment (
  rule_id         SMALLINT PRIMARY KEY REFERENCES demo_rules (rule_id),
  routing_queue   TEXT NOT NULL,
  sla_bucket      TEXT NOT NULL,
  cost_center     TEXT NOT NULL
);

-- K: N decisions x M features; row-normalized weights (row sums to 1).
CREATE TABLE demo_rule_weights (
  rule_id    SMALLINT NOT NULL REFERENCES demo_rules (rule_id),
  feature_id SMALLINT NOT NULL REFERENCES demo_features (feature_id),
  weight     NUMERIC(6, 5) NOT NULL CHECK (weight >= 0 AND weight <= 1),
  PRIMARY KEY (rule_id, feature_id)
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

INSERT INTO demo_rule_enrichment (rule_id, routing_queue, sla_bucket, cost_center) VALUES
  (1, 'SOV-RATES-NA',   'T+0_CLOSE', 'BOOK_NA_GOVT'),
  (2, 'CORP-CREDIT-NA', 'T+1_STD',   'BOOK_NA_CREDIT'),
  (3, 'CORP-CREDIT-EMEA', 'T+1_STD', 'BOOK_EMEA_CREDIT');

INSERT INTO demo_rule_weights (rule_id, feature_id, weight) VALUES
  (1, 1, 0.50), (1, 5, 0.50),
  (2, 2, 0.40), (2, 4, 0.60),
  (3, 2, 0.40), (3, 3, 0.60);

-- Synthetic FI securities. Row 3: Aladdin books US corporate in **NA**; fund overrides
-- **region** to **emea** so it aggregates with EMEA credit cohorts (same scores as DE row).
INSERT INTO demo_observations (
  isin, ald_issuer_class, fund_issuer_class_override,
  ald_region, fund_region_override,
  ald_rating_band, fund_rating_band_override
) VALUES
  ('US00ALDINFI01', 'sovereign', NULL, 'na',   NULL, 'ig',   NULL),
  ('DE00ALDINFI02', 'corporate', NULL, 'emea', NULL, 'core', NULL),
  ('US00ALDINFI03', 'corporate', NULL, 'na',   'emea', 'core', NULL);

-- ---------------------------------------------------------------------------
-- Kernelization: qualitative -> fixed binary features in R^M
-- (Explicit mapping; in production this can be table-driven from the semantic layer.)
-- ---------------------------------------------------------------------------
INSERT INTO demo_observation_features (observation_id, feature_id)
SELECT o.observation_id, k.feature_id
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

-- K: same M axes; cell = weight k_im (0 if absent).
SELECT
  'VARIABLE_SPACE_K_ROWS' AS section,
  r.rule_id,
  r.decision_code,
  COALESCE(MAX(CASE WHEN rw.feature_id = 1 THEN rw.weight END), 0) AS w_fi_sovereign,
  COALESCE(MAX(CASE WHEN rw.feature_id = 2 THEN rw.weight END), 0) AS w_fi_corporate,
  COALESCE(MAX(CASE WHEN rw.feature_id = 3 THEN rw.weight END), 0) AS w_region_emea,
  COALESCE(MAX(CASE WHEN rw.feature_id = 4 THEN rw.weight END), 0) AS w_region_na,
  COALESCE(MAX(CASE WHEN rw.feature_id = 5 THEN rw.weight END), 0) AS w_rating_ig,
  SUM(rw.weight) AS row_weight_sum
FROM demo_rules r
JOIN demo_rule_weights rw ON rw.rule_id = r.rule_id
GROUP BY r.rule_id, r.decision_code
ORDER BY r.rule_id;

-- ---------------------------------------------------------------------------
-- Subject space: each row is one feature's vector over observations (transpose
-- of D). Coordinates are activation (0/1) per security after kernelization.
-- ---------------------------------------------------------------------------
SELECT
  'SUBJECT_SPACE_BY_ISIN' AS section,
  fe.feature_code,
  COALESCE(MAX(CASE WHEN o.isin = 'US00ALDINFI01' THEN 1 END), 0) AS sec_us_sov_na,
  COALESCE(MAX(CASE WHEN o.isin = 'DE00ALDINFI02' THEN 1 END), 0) AS sec_de_corp_emea,
  COALESCE(MAX(CASE WHEN o.isin = 'US00ALDINFI03' THEN 1 END), 0) AS sec_us_corp_na
FROM demo_features fe
LEFT JOIN demo_observation_features ofe ON ofe.feature_id = fe.feature_id
LEFT JOIN demo_observations o ON o.observation_id = ofe.observation_id
GROUP BY fe.feature_id, fe.feature_code
ORDER BY fe.feature_id;

-- ---------------------------------------------------------------------------
-- Linear layer: s_ij = <k_i, d_j> = sum_m k_im * d_jm  (sparse; same as one
-- column of K * D^T). Each column j is an N-vector of pre-max "scores".
-- ---------------------------------------------------------------------------
WITH scores AS (
  SELECT
    o.observation_id,
    o.isin,
    r.rule_id,
    r.decision_code,
    SUM(rw.weight) AS score
  FROM demo_observations o
  JOIN demo_observation_features ofe ON ofe.observation_id = o.observation_id
  JOIN demo_rule_weights rw ON rw.feature_id = ofe.feature_id
  JOIN demo_rules r ON r.rule_id = rw.rule_id
  GROUP BY o.observation_id, o.isin, r.rule_id, r.decision_code
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
WITH scores AS (
  SELECT
    o.observation_id,
    o.isin,
    r.rule_id,
    r.decision_code,
    SUM(rw.weight) AS score
  FROM demo_observations o
  JOIN demo_observation_features ofe ON ofe.observation_id = o.observation_id
  JOIN demo_rule_weights rw ON rw.feature_id = ofe.feature_id
  JOIN demo_rules r ON r.rule_id = rw.rule_id
  GROUP BY o.observation_id, o.isin, r.rule_id, r.decision_code
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
    o.observation_id,
    o.isin,
    r.rule_id,
    COALESCE(SUM(rw.weight), 0) AS score
  FROM demo_observations o
  CROSS JOIN demo_rules r
  LEFT JOIN demo_observation_features ofe ON ofe.observation_id = o.observation_id
  LEFT JOIN demo_rule_weights rw
    ON rw.rule_id = r.rule_id
   AND rw.feature_id = ofe.feature_id
  GROUP BY o.observation_id, o.isin, r.rule_id
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
    o.observation_id,
    o.isin,
    r.rule_id,
    COALESCE(SUM(rw.weight), 0) AS score
  FROM demo_observations o
  CROSS JOIN demo_rules r
  LEFT JOIN demo_observation_features ofe ON ofe.observation_id = o.observation_id
  LEFT JOIN demo_rule_weights rw
    ON rw.rule_id = r.rule_id
   AND rw.feature_id = ofe.feature_id
  GROUP BY o.observation_id, o.isin, r.rule_id
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
  e.routing_queue,
  e.sla_bucket,
  e.cost_center
FROM demo_observations o
JOIN wide w ON w.observation_id = o.observation_id
JOIN ranked win ON win.observation_id = o.observation_id AND win.rn = 1
JOIN demo_rules r ON r.rule_id = win.rule_id
JOIN demo_rule_enrichment e ON e.rule_id = win.rule_id
ORDER BY o.observation_id;

ROLLBACK;

/*
  Synthetic demo: kernelization + variable space / subject space + rule scoring.
  T-SQL; temp tables.   Observations = FI securities: **ald_*** vendor reference + optional **fund_***_override
  per hierarchy level; effective = COALESCE(NULLIF(TRIM(override),''), ald_*). ISINs fabricated.

  Variable space: each observation is a vector in R^M (rows of D).
  Subject space: each feature is a vector over observations (transpose of D).
  Kernelization: effective issuer / region / rating_band -> sparse 0/1.

  NN analogy: K is a linear map R^M -> R^N (logit-like scores, no activation);
  argmax over scores is a hard max / winner-take-all gate (plus tie-break).

  Final step: wide score columns (a,b,c) -> UNPIVOT -> argmax -> join raw obs +
  user-maintained decision descriptors (row-shaped enriched output).
*/

SET NOCOUNT ON;

IF OBJECT_ID('tempdb..#features') IS NOT NULL DROP TABLE #features;
IF OBJECT_ID('tempdb..#rules') IS NOT NULL DROP TABLE #rules;
IF OBJECT_ID('tempdb..#rule_enrichment') IS NOT NULL DROP TABLE #rule_enrichment;
IF OBJECT_ID('tempdb..#rule_weights') IS NOT NULL DROP TABLE #rule_weights;
IF OBJECT_ID('tempdb..#observations') IS NOT NULL DROP TABLE #observations;
IF OBJECT_ID('tempdb..#observation_features') IS NOT NULL DROP TABLE #observation_features;

CREATE TABLE #features (
  feature_id    SMALLINT NOT NULL PRIMARY KEY,
  feature_code  VARCHAR(32) NOT NULL
);

CREATE TABLE #rules (
  rule_id         SMALLINT NOT NULL PRIMARY KEY,
  decision_code   VARCHAR(32) NOT NULL
);

CREATE TABLE #rule_enrichment (
  rule_id        SMALLINT NOT NULL PRIMARY KEY,
  routing_queue  VARCHAR(32) NOT NULL,
  sla_bucket     VARCHAR(16) NOT NULL,
  cost_center    VARCHAR(24) NOT NULL
);

CREATE TABLE #rule_weights (
  rule_id    SMALLINT NOT NULL,
  feature_id SMALLINT NOT NULL,
  weight     DECIMAL(6, 5) NOT NULL,
  PRIMARY KEY (rule_id, feature_id)
);

CREATE TABLE #observations (
  observation_id INT NOT NULL PRIMARY KEY,
  isin                         VARCHAR(16) NOT NULL,
  ald_issuer_class             VARCHAR(16) NOT NULL,
  fund_issuer_class_override   VARCHAR(16) NULL,
  ald_region                   VARCHAR(16) NOT NULL,
  fund_region_override         VARCHAR(16) NULL,
  ald_rating_band              VARCHAR(16) NOT NULL,
  fund_rating_band_override    VARCHAR(16) NULL
);

CREATE TABLE #observation_features (
  observation_id INT NOT NULL,
  feature_id     SMALLINT NOT NULL,
  PRIMARY KEY (observation_id, feature_id)
);

INSERT INTO #features (feature_id, feature_code) VALUES
  (1, 'fi_sovereign'), (2, 'fi_corporate'),
  (3, 'region_emea'), (4, 'region_na'), (5, 'rating_ig');

INSERT INTO #rules (rule_id, decision_code) VALUES
  (1, 'ald_sov_rates_na'),
  (2, 'ald_corp_credit_na'),
  (3, 'ald_corp_credit_emea');

INSERT INTO #rule_enrichment (rule_id, routing_queue, sla_bucket, cost_center) VALUES
  (1, 'SOV-RATES-NA',     'T+0_CLOSE', 'BOOK_NA_GOVT'),
  (2, 'CORP-CREDIT-NA',   'T+1_STD',   'BOOK_NA_CREDIT'),
  (3, 'CORP-CREDIT-EMEA', 'T+1_STD',   'BOOK_EMEA_CREDIT');

INSERT INTO #rule_weights (rule_id, feature_id, weight) VALUES
  (1, 1, 0.50), (1, 5, 0.50),
  (2, 2, 0.40), (2, 4, 0.60),
  (3, 2, 0.40), (3, 3, 0.60);

INSERT INTO #observations (
  observation_id, isin, ald_issuer_class, fund_issuer_class_override,
  ald_region, fund_region_override, ald_rating_band, fund_rating_band_override
) VALUES
  (1, 'US00ALDINFI01', 'sovereign', NULL, 'na',   NULL, 'ig',   NULL),
  (2, 'DE00ALDINFI02', 'corporate', NULL, 'emea', NULL, 'core', NULL),
  (3, 'US00ALDINFI03', 'corporate', NULL, 'na',   'emea', 'core', NULL);

/* --- Kernelization: effective attributes (fund override wins if non-blank) --- */
INSERT INTO #observation_features (observation_id, feature_id)
SELECT o.observation_id, v.feature_id
FROM #observations o
CROSS APPLY (
  VALUES
    (CASE WHEN COALESCE(NULLIF(LTRIM(RTRIM(o.fund_issuer_class_override)), ''), o.ald_issuer_class) = 'sovereign' THEN 1 END),
    (CASE WHEN COALESCE(NULLIF(LTRIM(RTRIM(o.fund_issuer_class_override)), ''), o.ald_issuer_class) = 'corporate' THEN 2 END),
    (CASE WHEN COALESCE(NULLIF(LTRIM(RTRIM(o.fund_region_override)), ''), o.ald_region) = 'emea' THEN 3 END),
    (CASE WHEN COALESCE(NULLIF(LTRIM(RTRIM(o.fund_region_override)), ''), o.ald_region) = 'na'   THEN 4 END),
    (CASE WHEN COALESCE(NULLIF(LTRIM(RTRIM(o.fund_rating_band_override)), ''), o.ald_rating_band) = 'ig' THEN 5 END)
) AS v(feature_id)
WHERE v.feature_id IS NOT NULL;

/* --- Variable space: rows of D (observation vectors) --- */
SELECT
  'VARIABLE_SPACE_D_MATRIX' AS section,
  o.observation_id,
  o.isin,
  CAST(MAX(CASE WHEN ofe.feature_id = 1 THEN 1 ELSE 0 END) AS TINYINT) AS f_fi_sovereign,
  CAST(MAX(CASE WHEN ofe.feature_id = 2 THEN 1 ELSE 0 END) AS TINYINT) AS f_fi_corporate,
  CAST(MAX(CASE WHEN ofe.feature_id = 3 THEN 1 ELSE 0 END) AS TINYINT) AS f_region_emea,
  CAST(MAX(CASE WHEN ofe.feature_id = 4 THEN 1 ELSE 0 END) AS TINYINT) AS f_region_na,
  CAST(MAX(CASE WHEN ofe.feature_id = 5 THEN 1 ELSE 0 END) AS TINYINT) AS f_rating_ig
FROM #observations o
LEFT JOIN #observation_features ofe ON ofe.observation_id = o.observation_id
GROUP BY o.observation_id, o.isin
ORDER BY o.observation_id;

/* --- Variable space: rows of K (same M axes, weights) --- */
SELECT
  'VARIABLE_SPACE_K_ROWS' AS section,
  r.rule_id,
  r.decision_code,
  ISNULL(MAX(CASE WHEN rw.feature_id = 1 THEN rw.weight END), 0) AS w_fi_sovereign,
  ISNULL(MAX(CASE WHEN rw.feature_id = 2 THEN rw.weight END), 0) AS w_fi_corporate,
  ISNULL(MAX(CASE WHEN rw.feature_id = 3 THEN rw.weight END), 0) AS w_region_emea,
  ISNULL(MAX(CASE WHEN rw.feature_id = 4 THEN rw.weight END), 0) AS w_region_na,
  ISNULL(MAX(CASE WHEN rw.feature_id = 5 THEN rw.weight END), 0) AS w_rating_ig,
  SUM(rw.weight) AS row_weight_sum
FROM #rules r
INNER JOIN #rule_weights rw ON rw.rule_id = r.rule_id
GROUP BY r.rule_id, r.decision_code
ORDER BY r.rule_id;

/* --- Subject space: feature vectors over securities (transpose of D) --- */
SELECT
  'SUBJECT_SPACE_BY_ISIN' AS section,
  fe.feature_code,
  CAST(ISNULL(MAX(CASE WHEN o.isin = 'US00ALDINFI01' THEN 1 END), 0) AS TINYINT) AS sec_us_sov_na,
  CAST(ISNULL(MAX(CASE WHEN o.isin = 'DE00ALDINFI02' THEN 1 END), 0) AS TINYINT) AS sec_de_corp_emea,
  CAST(ISNULL(MAX(CASE WHEN o.isin = 'US00ALDINFI03' THEN 1 END), 0) AS TINYINT) AS sec_us_corp_na
FROM #features fe
LEFT JOIN #observation_features ofe ON ofe.feature_id = fe.feature_id
LEFT JOIN #observations o ON o.observation_id = ofe.observation_id
GROUP BY fe.feature_id, fe.feature_code
ORDER BY fe.feature_id;

/* --- Linear layer: pre-max scores (sparse <k_i, d_j>) --- */
;WITH scores AS (
  SELECT
    o.observation_id,
    o.isin,
    r.rule_id,
    r.decision_code,
    SUM(rw.weight) AS score
  FROM #observations o
  INNER JOIN #observation_features ofe ON ofe.observation_id = o.observation_id
  INNER JOIN #rule_weights rw ON rw.feature_id = ofe.feature_id
  INNER JOIN #rules r ON r.rule_id = rw.rule_id
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

/* --- Argmax gate: one winning outcome per observation --- */
;WITH scores AS (
  SELECT
    o.observation_id,
    o.isin,
    r.rule_id,
    r.decision_code,
    SUM(rw.weight) AS score
  FROM #observations o
  INNER JOIN #observation_features ofe ON ofe.observation_id = o.observation_id
  INNER JOIN #rule_weights rw ON rw.feature_id = ofe.feature_id
  INNER JOIN #rules r ON r.rule_id = rw.rule_id
  GROUP BY o.observation_id, o.isin, r.rule_id, r.decision_code
),
ranked AS (
  SELECT
    s.*,
    ROW_NUMBER() OVER (PARTITION BY s.observation_id ORDER BY s.score DESC, s.rule_id) AS rn
  FROM scores s
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

/* --- UNPIVOT long scores (a,b,c = minimal column ids per blog) -> argmax -> enriched row --- */
;WITH dense_scores AS (
  SELECT
    o.observation_id,
    o.isin,
    r.rule_id,
    ISNULL(SUM(rw.weight), 0) AS score
  FROM #observations o
  CROSS JOIN #rules r
  LEFT JOIN #observation_features ofe ON ofe.observation_id = o.observation_id
  LEFT JOIN #rule_weights rw
    ON rw.rule_id = r.rule_id
   AND rw.feature_id = ofe.feature_id
  GROUP BY o.observation_id, o.isin, r.rule_id
),
wide AS (
  SELECT
    observation_id,
    isin,
    MAX(CASE WHEN rule_id = 1 THEN score END) AS a,
    MAX(CASE WHEN rule_id = 2 THEN score END) AS b,
    MAX(CASE WHEN rule_id = 3 THEN score END) AS c
  FROM dense_scores
  GROUP BY observation_id, isin
),
unpivoted AS (
  SELECT
    u.observation_id,
    u.isin,
    u.decision_slot,
    CASE u.decision_slot
      WHEN 'a' THEN CAST(1 AS SMALLINT)
      WHEN 'b' THEN CAST(2 AS SMALLINT)
      WHEN 'c' THEN CAST(3 AS SMALLINT)
    END AS rule_id,
    u.pre_max_score
  FROM wide w
  UNPIVOT (pre_max_score FOR decision_slot IN (a, b, c)) AS u
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

;WITH dense_scores AS (
  SELECT
    o.observation_id,
    o.isin,
    r.rule_id,
    ISNULL(SUM(rw.weight), 0) AS score
  FROM #observations o
  CROSS JOIN #rules r
  LEFT JOIN #observation_features ofe ON ofe.observation_id = o.observation_id
  LEFT JOIN #rule_weights rw
    ON rw.rule_id = r.rule_id
   AND rw.feature_id = ofe.feature_id
  GROUP BY o.observation_id, o.isin, r.rule_id
),
wide AS (
  SELECT
    observation_id,
    isin,
    MAX(CASE WHEN rule_id = 1 THEN score END) AS a,
    MAX(CASE WHEN rule_id = 2 THEN score END) AS b,
    MAX(CASE WHEN rule_id = 3 THEN score END) AS c
  FROM dense_scores
  GROUP BY observation_id, isin
),
unpivoted AS (
  SELECT
    u.observation_id,
    u.isin,
    CASE u.decision_slot
      WHEN 'a' THEN CAST(1 AS SMALLINT)
      WHEN 'b' THEN CAST(2 AS SMALLINT)
      WHEN 'c' THEN CAST(3 AS SMALLINT)
    END AS rule_id,
    u.pre_max_score
  FROM wide w
  UNPIVOT (pre_max_score FOR decision_slot IN (a, b, c)) AS u
),
ranked AS (
  SELECT
    p.*,
    ROW_NUMBER() OVER (PARTITION BY p.observation_id ORDER BY p.pre_max_score DESC, p.rule_id) AS rn
  FROM unpivoted p
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
  COALESCE(NULLIF(LTRIM(RTRIM(o.fund_issuer_class_override)), ''), o.ald_issuer_class) AS effective_issuer_class,
  COALESCE(NULLIF(LTRIM(RTRIM(o.fund_region_override)), ''), o.ald_region) AS effective_region,
  COALESCE(NULLIF(LTRIM(RTRIM(o.fund_rating_band_override)), ''), o.ald_rating_band) AS effective_rating_band,
  w.a AS score_a,
  w.b AS score_b,
  w.c AS score_c,
  r.decision_code AS winning_workstream,
  win.pre_max_score AS winning_score,
  e.routing_queue,
  e.sla_bucket,
  e.cost_center
FROM #observations o
INNER JOIN wide w ON w.observation_id = o.observation_id
INNER JOIN ranked win ON win.observation_id = o.observation_id AND win.rn = 1
INNER JOIN #rules r ON r.rule_id = win.rule_id
INNER JOIN #rule_enrichment e ON e.rule_id = win.rule_id
ORDER BY o.observation_id;

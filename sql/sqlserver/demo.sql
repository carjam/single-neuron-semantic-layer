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
IF OBJECT_ID('tempdb..#hierarchy_enrichment_rules') IS NOT NULL DROP TABLE #hierarchy_enrichment_rules;
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

CREATE TABLE #hierarchy_enrichment_rules (
  hierarchy_rule_id   SMALLINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  rule_id             SMALLINT NOT NULL,
  hierarchy_top       VARCHAR(16) NOT NULL,
  hierarchy_middle    VARCHAR(16) NOT NULL,
  hierarchy_bottom    VARCHAR(16) NOT NULL,
  descriptive_value_a VARCHAR(64) NOT NULL,
  descriptive_value_b VARCHAR(64) NULL,
  descriptive_value_c VARCHAR(64) NULL,
  descriptive_value_d VARCHAR(64) NULL,
  descriptive_value_e VARCHAR(64) NULL,
  descriptive_value_f VARCHAR(64) NULL,
  descriptive_value_g VARCHAR(64) NULL,
  descriptive_value_h VARCHAR(64) NULL,
  descriptive_value_i VARCHAR(64) NULL,
  descriptive_value_j VARCHAR(64) NULL
);

INSERT INTO #features (feature_id, feature_code) VALUES
  (1, 'fi_sovereign'), (2, 'fi_corporate'),
  (3, 'region_emea'), (4, 'region_na'), (5, 'rating_ig');

INSERT INTO #rules (rule_id, decision_code) VALUES
  (1, 'ald_sov_rates_na'),
  (2, 'ald_corp_credit_na'),
  (3, 'ald_corp_credit_emea');

INSERT INTO #observations (
  observation_id, isin, ald_issuer_class, fund_issuer_class_override,
  ald_region, fund_region_override, ald_rating_band, fund_rating_band_override
) VALUES
  (1, 'US00ALDINFI01', 'sovereign', NULL, 'na',   NULL, 'ig',   NULL),
  (2, 'DE00ALDINFI02', 'corporate', NULL, 'emea', NULL, 'core', NULL),
  (3, 'US00ALDINFI03', 'corporate', NULL, 'na',   'emea', 'core', NULL),
  (4, 'GB00ALDINFI04', 'sovereign', NULL, 'emea', NULL, 'ig',   NULL),
  (5, 'FR00ALDINFI05', 'corporate', NULL, 'emea', NULL, 'ig',   'core'),
  (6, 'CA00ALDINFI06', 'corporate', NULL, 'na',   'emea', 'core', NULL),
  (7, 'US00ALDINFI07', 'derivative',NULL, 'na',   NULL, 'core', NULL);

INSERT INTO #hierarchy_enrichment_rules (
  rule_id, hierarchy_top, hierarchy_middle, hierarchy_bottom,
  descriptive_value_a, descriptive_value_b, descriptive_value_c, descriptive_value_d
) VALUES
  (1, 'Debt', 'Govt',  'sovereign', 'rates_coverage', 'SOV-RATES-NA', 'T+0_CLOSE', 'BOOK_NA_GOVT'),
  (3, 'Debt', 'Corp',  'corporate', 'credit_coverage', 'CORP-CREDIT-EMEA', 'T+1_STD', 'BOOK_EMEA_CREDIT'),
  (2, 'Debt', '*',     '*',         'general_debt_coverage', 'CORP-CREDIT-NA', 'T+1_STD', 'BOOK_NA_CREDIT');

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

/* --- Runtime hierarchy rules (no static K rows). --- */
SELECT
  'HIERARCHY_RULE_SPACE' AS section,
  hr.hierarchy_rule_id,
  hr.rule_id,
  r.decision_code,
  hr.hierarchy_top,
  hr.hierarchy_middle,
  hr.hierarchy_bottom,
  hr.descriptive_value_a
FROM #hierarchy_enrichment_rules hr
INNER JOIN #rules r ON r.rule_id = hr.rule_id
ORDER BY hr.hierarchy_rule_id;

/* --- Subject space: feature vectors over securities (transpose of D) --- */
SELECT
  'SUBJECT_SPACE_BY_ISIN' AS section,
  fe.feature_code,
  o.isin,
  CAST(ISNULL(MAX(CASE WHEN ofe.feature_id IS NOT NULL THEN 1 END), 0) AS TINYINT) AS is_active
FROM #features fe
CROSS JOIN #observations o
LEFT JOIN #observation_features ofe
  ON ofe.feature_id = fe.feature_id
 AND ofe.observation_id = o.observation_id
GROUP BY fe.feature_id, fe.feature_code, o.isin
ORDER BY fe.feature_id, o.isin;

/* --- Linear layer: pre-max scores (sparse <k_i, d_j>) --- */
;WITH obs_hierarchy AS (
  SELECT
    o.observation_id,
    o.isin,
    CAST('Debt' AS VARCHAR(16)) AS hierarchy_top,
    CASE
      WHEN COALESCE(NULLIF(LTRIM(RTRIM(o.fund_issuer_class_override)), ''), o.ald_issuer_class) = 'sovereign' THEN 'Govt'
      WHEN COALESCE(NULLIF(LTRIM(RTRIM(o.fund_issuer_class_override)), ''), o.ald_issuer_class) = 'corporate' THEN 'Corp'
      ELSE 'Deriv'
    END AS hierarchy_middle,
    COALESCE(NULLIF(LTRIM(RTRIM(o.fund_issuer_class_override)), ''), o.ald_issuer_class) AS hierarchy_bottom
  FROM #observations o
),
scores AS (
  SELECT
    oh.observation_id,
    oh.isin,
    r.rule_id,
    r.decision_code,
    ISNULL(MAX((CAST((
      (CASE WHEN hr.hierarchy_top = oh.hierarchy_top THEN 1 ELSE 0 END) +
      (CASE WHEN hr.hierarchy_middle = '*' THEN 0 WHEN hr.hierarchy_middle = oh.hierarchy_middle THEN 1 ELSE 0 END) +
      (CASE WHEN hr.hierarchy_bottom = '*' THEN 0 WHEN hr.hierarchy_bottom = oh.hierarchy_bottom THEN 1 ELSE 0 END)
    ) AS DECIMAL(6,5)) / 3.0)), 0) AS score
  FROM obs_hierarchy oh
  CROSS JOIN #rules r
  LEFT JOIN #hierarchy_enrichment_rules hr
    ON hr.rule_id = r.rule_id
   AND (hr.hierarchy_top = '*' OR hr.hierarchy_top = oh.hierarchy_top)
   AND (hr.hierarchy_middle = '*' OR hr.hierarchy_middle = oh.hierarchy_middle)
   AND (hr.hierarchy_bottom = '*' OR hr.hierarchy_bottom = oh.hierarchy_bottom)
  GROUP BY oh.observation_id, oh.isin, r.rule_id, r.decision_code
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
;WITH obs_hierarchy AS (
  SELECT
    o.observation_id,
    o.isin,
    CAST('Debt' AS VARCHAR(16)) AS hierarchy_top,
    CASE
      WHEN COALESCE(NULLIF(LTRIM(RTRIM(o.fund_issuer_class_override)), ''), o.ald_issuer_class) = 'sovereign' THEN 'Govt'
      WHEN COALESCE(NULLIF(LTRIM(RTRIM(o.fund_issuer_class_override)), ''), o.ald_issuer_class) = 'corporate' THEN 'Corp'
      ELSE 'Deriv'
    END AS hierarchy_middle,
    COALESCE(NULLIF(LTRIM(RTRIM(o.fund_issuer_class_override)), ''), o.ald_issuer_class) AS hierarchy_bottom
  FROM #observations o
),
scores AS (
  SELECT
    oh.observation_id,
    oh.isin,
    r.rule_id,
    r.decision_code,
    ISNULL(MAX((CAST((
      (CASE WHEN hr.hierarchy_top = oh.hierarchy_top THEN 1 ELSE 0 END) +
      (CASE WHEN hr.hierarchy_middle = '*' THEN 0 WHEN hr.hierarchy_middle = oh.hierarchy_middle THEN 1 ELSE 0 END) +
      (CASE WHEN hr.hierarchy_bottom = '*' THEN 0 WHEN hr.hierarchy_bottom = oh.hierarchy_bottom THEN 1 ELSE 0 END)
    ) AS DECIMAL(6,5)) / 3.0)), 0) AS score
  FROM obs_hierarchy oh
  CROSS JOIN #rules r
  LEFT JOIN #hierarchy_enrichment_rules hr
    ON hr.rule_id = r.rule_id
   AND (hr.hierarchy_top = '*' OR hr.hierarchy_top = oh.hierarchy_top)
   AND (hr.hierarchy_middle = '*' OR hr.hierarchy_middle = oh.hierarchy_middle)
   AND (hr.hierarchy_bottom = '*' OR hr.hierarchy_bottom = oh.hierarchy_bottom)
  GROUP BY oh.observation_id, oh.isin, r.rule_id, r.decision_code
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
    oh.observation_id,
    oh.isin,
    r.rule_id,
    ISNULL(MAX((CAST((
      (CASE WHEN hr.hierarchy_top = oh.hierarchy_top THEN 1 ELSE 0 END) +
      (CASE WHEN hr.hierarchy_middle = '*' THEN 0 WHEN hr.hierarchy_middle = oh.hierarchy_middle THEN 1 ELSE 0 END) +
      (CASE WHEN hr.hierarchy_bottom = '*' THEN 0 WHEN hr.hierarchy_bottom = oh.hierarchy_bottom THEN 1 ELSE 0 END)
    ) AS DECIMAL(6,5)) / 3.0)), 0) AS score
  FROM (
    SELECT
      o.observation_id,
      o.isin,
      CAST('Debt' AS VARCHAR(16)) AS hierarchy_top,
      CASE
        WHEN COALESCE(NULLIF(LTRIM(RTRIM(o.fund_issuer_class_override)), ''), o.ald_issuer_class) = 'sovereign' THEN 'Govt'
        WHEN COALESCE(NULLIF(LTRIM(RTRIM(o.fund_issuer_class_override)), ''), o.ald_issuer_class) = 'corporate' THEN 'Corp'
        ELSE 'Deriv'
      END AS hierarchy_middle,
      COALESCE(NULLIF(LTRIM(RTRIM(o.fund_issuer_class_override)), ''), o.ald_issuer_class) AS hierarchy_bottom
    FROM #observations o
  ) oh
  CROSS JOIN #rules r
  LEFT JOIN #hierarchy_enrichment_rules hr
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
    oh.observation_id,
    oh.isin,
    r.rule_id,
    ISNULL(MAX((CAST((
      (CASE WHEN hr.hierarchy_top = oh.hierarchy_top THEN 1 ELSE 0 END) +
      (CASE WHEN hr.hierarchy_middle = '*' THEN 0 WHEN hr.hierarchy_middle = oh.hierarchy_middle THEN 1 ELSE 0 END) +
      (CASE WHEN hr.hierarchy_bottom = '*' THEN 0 WHEN hr.hierarchy_bottom = oh.hierarchy_bottom THEN 1 ELSE 0 END)
    ) AS DECIMAL(6,5)) / 3.0)), 0) AS score
  FROM (
    SELECT
      o.observation_id,
      o.isin,
      CAST('Debt' AS VARCHAR(16)) AS hierarchy_top,
      CASE
        WHEN COALESCE(NULLIF(LTRIM(RTRIM(o.fund_issuer_class_override)), ''), o.ald_issuer_class) = 'sovereign' THEN 'Govt'
        WHEN COALESCE(NULLIF(LTRIM(RTRIM(o.fund_issuer_class_override)), ''), o.ald_issuer_class) = 'corporate' THEN 'Corp'
        ELSE 'Deriv'
      END AS hierarchy_middle,
      COALESCE(NULLIF(LTRIM(RTRIM(o.fund_issuer_class_override)), ''), o.ald_issuer_class) AS hierarchy_bottom
    FROM #observations o
  ) oh
  CROSS JOIN #rules r
  LEFT JOIN #hierarchy_enrichment_rules hr
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
),
obs_hierarchy AS (
  SELECT
    o.observation_id,
    CAST('Debt' AS VARCHAR(16)) AS hierarchy_top,
    CASE
      WHEN COALESCE(NULLIF(LTRIM(RTRIM(o.fund_issuer_class_override)), ''), o.ald_issuer_class) = 'sovereign' THEN 'Govt'
      WHEN COALESCE(NULLIF(LTRIM(RTRIM(o.fund_issuer_class_override)), ''), o.ald_issuer_class) = 'corporate' THEN 'Corp'
      ELSE 'Deriv'
    END AS hierarchy_middle,
    COALESCE(NULLIF(LTRIM(RTRIM(o.fund_issuer_class_override)), ''), o.ald_issuer_class) AS hierarchy_bottom
  FROM #observations o
),
hierarchy_candidates AS (
  SELECT
    oh.observation_id,
    hr.hierarchy_rule_id,
    hr.descriptive_value_a,
    (CASE WHEN hr.hierarchy_top <> '*' THEN 1 ELSE 0 END
     + CASE WHEN hr.hierarchy_middle <> '*' THEN 1 ELSE 0 END
     + CASE WHEN hr.hierarchy_bottom <> '*' THEN 1 ELSE 0 END) AS specificity
  FROM obs_hierarchy oh
  INNER JOIN #hierarchy_enrichment_rules hr
    ON (hr.hierarchy_top = '*' OR hr.hierarchy_top = oh.hierarchy_top)
   AND (hr.hierarchy_middle = '*' OR hr.hierarchy_middle = oh.hierarchy_middle)
   AND (hr.hierarchy_bottom = '*' OR hr.hierarchy_bottom = oh.hierarchy_bottom)
),
hierarchy_ranked AS (
  SELECT
    c.*,
    ROW_NUMBER() OVER (PARTITION BY c.observation_id ORDER BY c.specificity DESC, c.hierarchy_rule_id ASC) AS rn
  FROM hierarchy_candidates c
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
FROM #observations o
INNER JOIN wide w ON w.observation_id = o.observation_id
INNER JOIN ranked win ON win.observation_id = o.observation_id AND win.rn = 1
INNER JOIN #rules r ON r.rule_id = win.rule_id
LEFT JOIN hierarchy_ranked hm ON hm.observation_id = o.observation_id AND hm.rn = 1
ORDER BY o.observation_id;

-- =============================================================================
-- Synthetic demo: kernelization + variable space / subject space + rule scoring
-- Domain: fictional support tickets. PostgreSQL.
--
-- Variable space (standard multivariate view):
--   Each *observation* is a vector in R^M: one coordinate per atomic feature
--   (column / dimension). Rows of D are points in that space.
--
-- Subject space (dual view):
--   Each *feature* is a vector over the O observations (same inner products;
--   geometrically the transpose). Useful to see which observations activate
--   which dimensions together.
--
-- Kernelization:
--   Upstream delivers qualitative labels (tier, region, priority). We map
--   them into a fixed sparse 0/1 representation in R^M so linear weights
--   (rows of K) apply without string matching on the hot path.
--
-- NN analogy (interpretation, not training):
--   After kernelization, each observation is a feature vector d in R^M.
--   Applying K is a linear map R^M -> R^N: one score per outcome (same shape as
--   "logits" from a single linear layer — no bias term here, no activation).
--   The final step takes argmax over those scores — a hard max / winner-take-all
--   gate. (Production also layered precedence "waterfall" rules on top.)
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS demo_observation_features;
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

-- K: N decisions x M features; row-normalized weights (row sums to 1).
CREATE TABLE demo_rule_weights (
  rule_id    SMALLINT NOT NULL REFERENCES demo_rules (rule_id),
  feature_id SMALLINT NOT NULL REFERENCES demo_features (feature_id),
  weight     NUMERIC(6, 5) NOT NULL CHECK (weight >= 0 AND weight <= 1),
  PRIMARY KEY (rule_id, feature_id)
);

-- Raw observations: qualitative fields as they might arrive from a feed.
CREATE TABLE demo_observations (
  observation_id BIGSERIAL PRIMARY KEY,
  ticket_ref     TEXT NOT NULL,
  tier             TEXT NOT NULL,
  region           TEXT NOT NULL,
  priority         TEXT NOT NULL
);

-- D (sparse): kernelized 0/1 coordinates in variable space.
CREATE TABLE demo_observation_features (
  observation_id BIGINT NOT NULL REFERENCES demo_observations (observation_id),
  feature_id     SMALLINT NOT NULL REFERENCES demo_features (feature_id),
  PRIMARY KEY (observation_id, feature_id)
);

INSERT INTO demo_features (feature_id, feature_code) VALUES
  (1, 'tier_enterprise'),
  (2, 'tier_standard'),
  (3, 'region_emea'),
  (4, 'region_na'),
  (5, 'priority_high');

INSERT INTO demo_rules (rule_id, decision_code) VALUES
  (1, 'team_platform'),
  (2, 'team_regional_na'),
  (3, 'team_regional_emea');

INSERT INTO demo_rule_weights (rule_id, feature_id, weight) VALUES
  (1, 1, 0.50), (1, 5, 0.50),
  (2, 2, 0.40), (2, 4, 0.60),
  (3, 2, 0.40), (3, 3, 0.60);

-- Qualitative feed (would be bulk-loaded in production).
INSERT INTO demo_observations (ticket_ref, tier, region, priority) VALUES
  ('TK-1001', 'enterprise', 'na',   'high'),
  ('TK-1002', 'standard',   'emea', 'normal'),
  ('TK-1003', 'standard',   'na',   'normal');

-- ---------------------------------------------------------------------------
-- Kernelization: qualitative -> fixed binary features in R^M
-- (Explicit mapping; in production this can be table-driven from the semantic layer.)
-- ---------------------------------------------------------------------------
INSERT INTO demo_observation_features (observation_id, feature_id)
SELECT o.observation_id, k.feature_id
FROM demo_observations o
CROSS JOIN LATERAL (
  VALUES
    (CASE WHEN o.tier = 'enterprise' THEN 1 END),
    (CASE WHEN o.tier = 'standard'  THEN 2 END),
    (CASE WHEN o.region = 'emea' THEN 3 END),
    (CASE WHEN o.region = 'na'   THEN 4 END),
    (CASE WHEN o.priority = 'high' THEN 5 END)
) AS v(feature_id)
WHERE v.feature_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Variable space: each row is d_j in R^M (coordinates over shared feature axes).
-- Same axes as rows of K; score_ij = <k_i, d_j> with sparse nonzero entries.
-- ---------------------------------------------------------------------------
SELECT
  'VARIABLE_SPACE_D_MATRIX' AS section,
  o.observation_id,
  o.ticket_ref,
  COALESCE(BOOL_OR(ofe.feature_id = 1), FALSE)::INT AS f_tier_enterprise,
  COALESCE(BOOL_OR(ofe.feature_id = 2), FALSE)::INT AS f_tier_standard,
  COALESCE(BOOL_OR(ofe.feature_id = 3), FALSE)::INT AS f_region_emea,
  COALESCE(BOOL_OR(ofe.feature_id = 4), FALSE)::INT AS f_region_na,
  COALESCE(BOOL_OR(ofe.feature_id = 5), FALSE)::INT AS f_priority_high
FROM demo_observations o
LEFT JOIN demo_observation_features ofe ON ofe.observation_id = o.observation_id
GROUP BY o.observation_id, o.ticket_ref
ORDER BY o.observation_id;

-- K: same M axes; cell = weight k_im (0 if absent).
SELECT
  'VARIABLE_SPACE_K_ROWS' AS section,
  r.rule_id,
  r.decision_code,
  COALESCE(MAX(CASE WHEN rw.feature_id = 1 THEN rw.weight END), 0) AS w_tier_enterprise,
  COALESCE(MAX(CASE WHEN rw.feature_id = 2 THEN rw.weight END), 0) AS w_tier_standard,
  COALESCE(MAX(CASE WHEN rw.feature_id = 3 THEN rw.weight END), 0) AS w_region_emea,
  COALESCE(MAX(CASE WHEN rw.feature_id = 4 THEN rw.weight END), 0) AS w_region_na,
  COALESCE(MAX(CASE WHEN rw.feature_id = 5 THEN rw.weight END), 0) AS w_priority_high,
  SUM(rw.weight) AS row_weight_sum
FROM demo_rules r
JOIN demo_rule_weights rw ON rw.rule_id = r.rule_id
GROUP BY r.rule_id, r.decision_code
ORDER BY r.rule_id;

-- ---------------------------------------------------------------------------
-- Subject space: each row is one feature's vector over observations (transpose
-- of D). Coordinates are activation (0/1) per ticket after kernelization.
-- ---------------------------------------------------------------------------
SELECT
  'SUBJECT_SPACE_BY_TICKET' AS section,
  fe.feature_code,
  COALESCE(MAX(CASE WHEN o.ticket_ref = 'TK-1001' THEN 1 END), 0) AS tk1001,
  COALESCE(MAX(CASE WHEN o.ticket_ref = 'TK-1002' THEN 1 END), 0) AS tk1002,
  COALESCE(MAX(CASE WHEN o.ticket_ref = 'TK-1003' THEN 1 END), 0) AS tk1003
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
    o.ticket_ref,
    r.rule_id,
    r.decision_code,
    SUM(rw.weight) AS score
  FROM demo_observations o
  JOIN demo_observation_features ofe ON ofe.observation_id = o.observation_id
  JOIN demo_rule_weights rw ON rw.feature_id = ofe.feature_id
  JOIN demo_rules r ON r.rule_id = rw.rule_id
  GROUP BY o.observation_id, o.ticket_ref, r.rule_id, r.decision_code
)
SELECT
  'LINEAR_LAYER_SCORES' AS section,
  observation_id,
  ticket_ref,
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
    o.ticket_ref,
    r.rule_id,
    r.decision_code,
    SUM(rw.weight) AS score
  FROM demo_observations o
  JOIN demo_observation_features ofe ON ofe.observation_id = o.observation_id
  JOIN demo_rule_weights rw ON rw.feature_id = ofe.feature_id
  JOIN demo_rules r ON r.rule_id = rw.rule_id
  GROUP BY o.observation_id, o.ticket_ref, r.rule_id, r.decision_code
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
  ticket_ref,
  decision_code AS winning_team,
  score AS winning_score
FROM ranked
WHERE rn = 1
ORDER BY observation_id;

ROLLBACK;

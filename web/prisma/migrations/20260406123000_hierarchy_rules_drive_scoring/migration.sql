DROP TABLE IF EXISTS "hierarchy_enrichment_rules";

CREATE TABLE "hierarchy_enrichment_rules" (
    "hierarchy_rule_id" INTEGER NOT NULL PRIMARY KEY,
    "rule_id" INTEGER NOT NULL,
    "hierarchy_top" TEXT NOT NULL,
    "hierarchy_middle" TEXT NOT NULL,
    "hierarchy_bottom" TEXT NOT NULL,
    "descriptive_value_a" TEXT NOT NULL,
    "descriptive_value_b" TEXT,
    "descriptive_value_c" TEXT,
    "descriptive_value_d" TEXT,
    "descriptive_value_e" TEXT,
    "descriptive_value_f" TEXT,
    "descriptive_value_g" TEXT,
    "descriptive_value_h" TEXT,
    "descriptive_value_i" TEXT,
    "descriptive_value_j" TEXT,
    CONSTRAINT "hierarchy_enrichment_rules_rule_id_fkey"
      FOREIGN KEY ("rule_id") REFERENCES "rules" ("rule_id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

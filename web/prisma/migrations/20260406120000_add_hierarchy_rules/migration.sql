CREATE TABLE "hierarchy_enrichment_rules" (
    "hierarchy_rule_id" INTEGER NOT NULL PRIMARY KEY,
    "hierarchy_top" TEXT NOT NULL,
    "hierarchy_middle" TEXT NOT NULL,
    "hierarchy_bottom" TEXT NOT NULL,
    "descriptive_value_a" TEXT NOT NULL
);

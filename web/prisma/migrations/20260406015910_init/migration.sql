-- CreateTable
CREATE TABLE "rules" (
    "rule_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "decision_code" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "descriptors" (
    "rule_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "routing_queue" TEXT NOT NULL,
    "sla_bucket" TEXT NOT NULL,
    "cost_center" TEXT NOT NULL,
    CONSTRAINT "descriptors_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "rules" ("rule_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "features" (
    "feature_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "feature_code" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "rule_weights" (
    "ruleId" INTEGER NOT NULL,
    "featureId" INTEGER NOT NULL,
    "weight" REAL NOT NULL,

    PRIMARY KEY ("ruleId", "featureId"),
    CONSTRAINT "rule_weights_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "rules" ("rule_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "rule_weights_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "features" ("feature_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "observations" (
    "observation_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "isin" TEXT NOT NULL,
    "ald_issuer_class" TEXT NOT NULL,
    "fund_issuer_class_override" TEXT,
    "ald_region" TEXT NOT NULL,
    "fund_region_override" TEXT,
    "ald_rating_band" TEXT NOT NULL,
    "fund_rating_band_override" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "rules_decision_code_key" ON "rules"("decision_code");

-- CreateIndex
CREATE UNIQUE INDEX "features_feature_code_key" ON "features"("feature_code");

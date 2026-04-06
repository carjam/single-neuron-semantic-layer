ALTER TABLE "demo_hierarchy_enrichment_rules"
  ADD COLUMN IF NOT EXISTS "hierarchy_level_04" TEXT NOT NULL DEFAULT '*',
  ADD COLUMN IF NOT EXISTS "hierarchy_level_05" TEXT NOT NULL DEFAULT '*',
  ADD COLUMN IF NOT EXISTS "hierarchy_level_06" TEXT NOT NULL DEFAULT '*',
  ADD COLUMN IF NOT EXISTS "hierarchy_level_07" TEXT NOT NULL DEFAULT '*';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type HealthRow = {
  has_enriched_fn: boolean;
  has_dense_fn: boolean;
};

export async function GET() {
  const rows = await prisma.$queryRawUnsafe<HealthRow[]>(`
    SELECT
      (to_regprocedure('demo_get_enriched_rows()') IS NOT NULL) AS has_enriched_fn,
      (to_regprocedure('demo_get_dense_scores()') IS NOT NULL) AS has_dense_fn
  `);
  const row = rows[0] ?? { has_enriched_fn: false, has_dense_fn: false };
  const ok = Boolean(row.has_enriched_fn && row.has_dense_fn);
  return NextResponse.json(
    {
      ok,
      checks: {
        demoGetEnrichedRows: row.has_enriched_fn,
        demoGetDenseScores: row.has_dense_fn,
      },
    },
    { status: ok ? 200 : 503 },
  );
}

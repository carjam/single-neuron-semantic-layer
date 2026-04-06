import { computeEnrichedRows } from "@/lib/engine";
import { enrichedRowsToCsv } from "@/lib/enrichedCsv";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [observations, rules, weights, descriptors] = await Promise.all([
    prisma.observation.findMany({ orderBy: { id: "asc" } }),
    prisma.rule.findMany({ orderBy: { id: "asc" } }),
    prisma.ruleWeight.findMany(),
    prisma.descriptor.findMany(),
  ]);

  const rows = computeEnrichedRows(observations, rules, weights, descriptors);
  const csv = enrichedRowsToCsv(rows);

  return new Response("\uFEFF" + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="enriched_observations.csv"',
      "Cache-Control": "no-store",
    },
  });
}

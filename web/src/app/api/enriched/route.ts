import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeEnrichedRows } from "@/lib/engine";

export async function GET() {
  const [observations, rules, weights, descriptors] = await Promise.all([
    prisma.observation.findMany({ orderBy: { id: "asc" } }),
    prisma.rule.findMany({ orderBy: { id: "asc" } }),
    prisma.ruleWeight.findMany(),
    prisma.descriptor.findMany(),
  ]);

  const rows = computeEnrichedRows(observations, rules, weights, descriptors);
  return NextResponse.json({ rows });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rules = await prisma.rule.findMany({
    orderBy: { id: "asc" },
  });
  return NextResponse.json({
    items: rules.map((r) => ({
      ruleId: r.id,
      decisionCode: r.decisionCode,
    })),
  });
}

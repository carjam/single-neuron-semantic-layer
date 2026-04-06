import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rules = await prisma.rule.findMany({
    include: { descriptor: true },
    orderBy: { id: "asc" },
  });
  return NextResponse.json({
    items: rules.map((r) => ({
      ruleId: r.id,
      decisionCode: r.decisionCode,
      hasDescriptor: r.descriptor !== null,
    })),
  });
}

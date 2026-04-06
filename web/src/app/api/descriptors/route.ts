import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.descriptor.findMany({
    include: { rule: true },
    orderBy: { ruleId: "asc" },
  });
  return NextResponse.json({
    items: rows.map((d) => ({
      ruleId: d.ruleId,
      decisionCode: d.rule.decisionCode,
      routingQueue: d.routingQueue,
      slaBucket: d.slaBucket,
      costCenter: d.costCenter,
    })),
  });
}

type PostBody = {
  ruleId?: unknown;
  routingQueue?: unknown;
  slaBucket?: unknown;
  costCenter?: unknown;
};

export async function POST(request: Request) {
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const ruleId = typeof body.ruleId === "number" ? body.ruleId : Number(body.ruleId);
  const routingQueue = typeof body.routingQueue === "string" ? body.routingQueue.trim() : "";
  const slaBucket = typeof body.slaBucket === "string" ? body.slaBucket.trim() : "";
  const costCenter = typeof body.costCenter === "string" ? body.costCenter.trim() : "";

  if (!Number.isInteger(ruleId) || ruleId < 1) {
    return NextResponse.json({ error: "ruleId must be a positive integer" }, { status: 400 });
  }
  if (!routingQueue || !slaBucket || !costCenter) {
    return NextResponse.json(
      { error: "routingQueue, slaBucket, and costCenter are required non-empty strings" },
      { status: 400 },
    );
  }

  const rule = await prisma.rule.findUnique({ where: { id: ruleId } });
  if (!rule) {
    return NextResponse.json({ error: `Rule ${ruleId} not found` }, { status: 404 });
  }

  const existing = await prisma.descriptor.findUnique({ where: { ruleId } });
  if (existing) {
    return NextResponse.json(
      { error: `Descriptor for rule ${ruleId} already exists; use PATCH` },
      { status: 409 },
    );
  }

  const created = await prisma.descriptor.create({
    data: { ruleId, routingQueue, slaBucket, costCenter },
    include: { rule: true },
  });

  return NextResponse.json(
    {
      item: {
        ruleId: created.ruleId,
        decisionCode: created.rule.decisionCode,
        routingQueue: created.routingQueue,
        slaBucket: created.slaBucket,
        costCenter: created.costCenter,
      },
    },
    { status: 201 },
  );
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ ruleId: string }> };

function parseRuleId(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

export async function GET(_request: Request, context: Ctx) {
  const { ruleId: raw } = await context.params;
  const ruleId = parseRuleId(raw);
  if (ruleId === null) {
    return NextResponse.json({ error: "Invalid ruleId" }, { status: 400 });
  }

  const row = await prisma.descriptor.findUnique({
    where: { ruleId },
    include: { rule: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Descriptor not found" }, { status: 404 });
  }

  return NextResponse.json({
    item: {
      ruleId: row.ruleId,
      decisionCode: row.rule.decisionCode,
      routingQueue: row.routingQueue,
      slaBucket: row.slaBucket,
      costCenter: row.costCenter,
    },
  });
}

type PatchBody = {
  routingQueue?: unknown;
  slaBucket?: unknown;
  costCenter?: unknown;
};

export async function PATCH(request: Request, context: Ctx) {
  const { ruleId: raw } = await context.params;
  const ruleId = parseRuleId(raw);
  if (ruleId === null) {
    return NextResponse.json({ error: "Invalid ruleId" }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: { routingQueue?: string; slaBucket?: string; costCenter?: string } = {};
  if (body.routingQueue !== undefined) {
    if (typeof body.routingQueue !== "string" || body.routingQueue.trim() === "") {
      return NextResponse.json({ error: "routingQueue must be a non-empty string" }, { status: 400 });
    }
    data.routingQueue = body.routingQueue.trim();
  }
  if (body.slaBucket !== undefined) {
    if (typeof body.slaBucket !== "string" || body.slaBucket.trim() === "") {
      return NextResponse.json({ error: "slaBucket must be a non-empty string" }, { status: 400 });
    }
    data.slaBucket = body.slaBucket.trim();
  }
  if (body.costCenter !== undefined) {
    if (typeof body.costCenter !== "string" || body.costCenter.trim() === "") {
      return NextResponse.json({ error: "costCenter must be a non-empty string" }, { status: 400 });
    }
    data.costCenter = body.costCenter.trim();
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const updated = await prisma.descriptor.update({
      where: { ruleId },
      data,
      include: { rule: true },
    });
    return NextResponse.json({
      item: {
        ruleId: updated.ruleId,
        decisionCode: updated.rule.decisionCode,
        routingQueue: updated.routingQueue,
        slaBucket: updated.slaBucket,
        costCenter: updated.costCenter,
      },
    });
  } catch {
    return NextResponse.json({ error: "Descriptor not found" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  const { ruleId: raw } = await context.params;
  const ruleId = parseRuleId(raw);
  if (ruleId === null) {
    return NextResponse.json({ error: "Invalid ruleId" }, { status: 400 });
  }

  try {
    await prisma.descriptor.delete({ where: { ruleId } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Descriptor not found" }, { status: 404 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ ruleId: string }> };

function parseRuleId(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

function normHierarchyValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (t === "") return null;
  return t === "*" ? "*" : t;
}

function normalizeOptionalHierarchyLevel(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (value === null) return "*";
  const v = normHierarchyValue(value);
  return v ?? "*";
}

export async function GET(_request: Request, context: Ctx) {
  const { ruleId: raw } = await context.params;
  const ruleId = parseRuleId(raw);
  if (ruleId === null) {
    return NextResponse.json({ error: "Invalid ruleId" }, { status: 400 });
  }

  const row = await prisma.hierarchyRule.findUnique({ where: { id: ruleId }, include: { rule: true } });
  if (!row) {
    return NextResponse.json({ error: "Hierarchy rule not found" }, { status: 404 });
  }

  return NextResponse.json({
    item: {
      hierarchyRuleId: row.id,
      ruleId: row.ruleId,
      decisionCode: row.rule.decisionCode,
      hierarchyTop: row.hierarchyTop,
      hierarchyMiddle: row.hierarchyMiddle,
      hierarchyBottom: row.hierarchyBottom,
      hierarchyLevel04: row.hierarchyLevel04,
      hierarchyLevel05: row.hierarchyLevel05,
      hierarchyLevel06: row.hierarchyLevel06,
      hierarchyLevel07: row.hierarchyLevel07,
      hierarchyLevels: [
        row.hierarchyTop,
        row.hierarchyMiddle,
        row.hierarchyBottom,
        row.hierarchyLevel04,
        row.hierarchyLevel05,
        row.hierarchyLevel06,
        row.hierarchyLevel07,
      ],
      descriptorValues: [
        row.descriptor01,
        row.descriptor02,
        row.descriptor03,
        row.descriptor04,
        row.descriptor05,
        row.descriptor06,
        row.descriptor07,
        row.descriptor08,
        row.descriptor09,
        row.descriptor10,
      ],
    },
  });
}

type PatchBody = {
  ruleId?: unknown;
  hierarchyTop?: unknown;
  hierarchyMiddle?: unknown;
  hierarchyBottom?: unknown;
  hierarchyLevel04?: unknown;
  hierarchyLevel05?: unknown;
  hierarchyLevel06?: unknown;
  hierarchyLevel07?: unknown;
  hierarchyLevels?: unknown;
  descriptorValues?: unknown;
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

  const data: {
    ruleId?: number;
    hierarchyTop?: string;
    hierarchyMiddle?: string;
    hierarchyBottom?: string;
    hierarchyLevel04?: string;
    hierarchyLevel05?: string;
    hierarchyLevel06?: string;
    hierarchyLevel07?: string;
    descriptor01?: string;
    descriptor02?: string | null;
    descriptor03?: string | null;
    descriptor04?: string | null;
    descriptor05?: string | null;
    descriptor06?: string | null;
    descriptor07?: string | null;
    descriptor08?: string | null;
    descriptor09?: string | null;
    descriptor10?: string | null;
  } = {};

  if (body.ruleId !== undefined) {
    const ruleIdValue = typeof body.ruleId === "number" ? body.ruleId : Number(body.ruleId);
    if (!Number.isInteger(ruleIdValue) || ruleIdValue < 1) {
      return NextResponse.json({ error: "ruleId must be a positive integer" }, { status: 400 });
    }
    const rule = await prisma.rule.findUnique({ where: { id: ruleIdValue } });
    if (!rule) {
      return NextResponse.json({ error: `Rule ${ruleIdValue} not found` }, { status: 404 });
    }
    data.ruleId = ruleIdValue;
  }

  if (body.hierarchyTop !== undefined) {
    const v = normHierarchyValue(body.hierarchyTop);
    if (!v) return NextResponse.json({ error: "hierarchyTop must be a non-empty string" }, { status: 400 });
    data.hierarchyTop = v;
  }
  if (body.hierarchyMiddle !== undefined) {
    const v = normHierarchyValue(body.hierarchyMiddle);
    if (!v) return NextResponse.json({ error: "hierarchyMiddle must be a non-empty string" }, { status: 400 });
    data.hierarchyMiddle = v;
  }
  if (body.hierarchyBottom !== undefined) {
    const v = normHierarchyValue(body.hierarchyBottom);
    if (!v) return NextResponse.json({ error: "hierarchyBottom must be a non-empty string" }, { status: 400 });
    data.hierarchyBottom = v;
  }
  const levelArray = Array.isArray(body.hierarchyLevels) ? body.hierarchyLevels : null;
  const level04 = normalizeOptionalHierarchyLevel(body.hierarchyLevel04 ?? levelArray?.[3]);
  const level05 = normalizeOptionalHierarchyLevel(body.hierarchyLevel05 ?? levelArray?.[4]);
  const level06 = normalizeOptionalHierarchyLevel(body.hierarchyLevel06 ?? levelArray?.[5]);
  const level07 = normalizeOptionalHierarchyLevel(body.hierarchyLevel07 ?? levelArray?.[6]);
  if (level04 !== undefined) data.hierarchyLevel04 = level04;
  if (level05 !== undefined) data.hierarchyLevel05 = level05;
  if (level06 !== undefined) data.hierarchyLevel06 = level06;
  if (level07 !== undefined) data.hierarchyLevel07 = level07;

  if (body.descriptorValues !== undefined) {
    if (!Array.isArray(body.descriptorValues)) {
      return NextResponse.json({ error: "descriptorValues must be an array" }, { status: 400 });
    }
    const values = Array.from({ length: 10 }, (_, idx) => {
      const v = body.descriptorValues?.[idx];
      if (typeof v !== "string") return null;
      const t = v.trim();
      return t === "" ? null : t;
    });
    if (!values[0]) {
      return NextResponse.json({ error: "descriptorValues[0] must be non-empty" }, { status: 400 });
    }
    data.descriptor01 = values[0];
    data.descriptor02 = values[1];
    data.descriptor03 = values[2];
    data.descriptor04 = values[3];
    data.descriptor05 = values[4];
    data.descriptor06 = values[5];
    data.descriptor07 = values[6];
    data.descriptor08 = values[7];
    data.descriptor09 = values[8];
    data.descriptor10 = values[9];
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const updated = await prisma.hierarchyRule.update({
      where: { id: ruleId },
      data,
      include: { rule: true },
    });
    return NextResponse.json({
      item: {
        hierarchyRuleId: updated.id,
        ruleId: updated.ruleId,
        decisionCode: updated.rule.decisionCode,
        hierarchyTop: updated.hierarchyTop,
        hierarchyMiddle: updated.hierarchyMiddle,
        hierarchyBottom: updated.hierarchyBottom,
        hierarchyLevel04: updated.hierarchyLevel04,
        hierarchyLevel05: updated.hierarchyLevel05,
        hierarchyLevel06: updated.hierarchyLevel06,
        hierarchyLevel07: updated.hierarchyLevel07,
        hierarchyLevels: [
          updated.hierarchyTop,
          updated.hierarchyMiddle,
          updated.hierarchyBottom,
          updated.hierarchyLevel04,
          updated.hierarchyLevel05,
          updated.hierarchyLevel06,
          updated.hierarchyLevel07,
        ],
        descriptorValues: [
          updated.descriptor01,
          updated.descriptor02,
          updated.descriptor03,
          updated.descriptor04,
          updated.descriptor05,
          updated.descriptor06,
          updated.descriptor07,
          updated.descriptor08,
          updated.descriptor09,
          updated.descriptor10,
        ],
      },
    });
  } catch {
    return NextResponse.json({ error: "Hierarchy rule not found" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  const { ruleId: raw } = await context.params;
  const ruleId = parseRuleId(raw);
  if (ruleId === null) {
    return NextResponse.json({ error: "Invalid ruleId" }, { status: 400 });
  }

  try {
    await prisma.hierarchyRule.delete({ where: { id: ruleId } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Hierarchy rule not found" }, { status: 404 });
  }
}

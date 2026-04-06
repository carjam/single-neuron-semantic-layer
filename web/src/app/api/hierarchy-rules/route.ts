import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function normHierarchyValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (t === "") return null;
  return t === "*" ? "*" : t;
}

function normalizeHierarchyLevels(body: {
  hierarchyTop?: unknown;
  hierarchyMiddle?: unknown;
  hierarchyBottom?: unknown;
  hierarchyLevel04?: unknown;
  hierarchyLevel05?: unknown;
  hierarchyLevel06?: unknown;
  hierarchyLevel07?: unknown;
  hierarchyLevels?: unknown;
}) {
  const fromArray = Array.isArray(body.hierarchyLevels) ? body.hierarchyLevels : null;
  const raw = [
    body.hierarchyTop,
    body.hierarchyMiddle,
    body.hierarchyBottom,
    body.hierarchyLevel04 ?? fromArray?.[3],
    body.hierarchyLevel05 ?? fromArray?.[4],
    body.hierarchyLevel06 ?? fromArray?.[5],
    body.hierarchyLevel07 ?? fromArray?.[6],
  ];
  const parsed = raw.map((v, idx) => {
    if (idx < 3) return normHierarchyValue(v);
    if (v === undefined || v === null) return "*";
    const normalized = normHierarchyValue(v);
    return normalized ?? "*";
  });
  return {
    hierarchyTop: parsed[0],
    hierarchyMiddle: parsed[1],
    hierarchyBottom: parsed[2],
    hierarchyLevel04: parsed[3]!,
    hierarchyLevel05: parsed[4]!,
    hierarchyLevel06: parsed[5]!,
    hierarchyLevel07: parsed[6]!,
    hierarchyLevels: parsed as string[],
  };
}

export async function GET() {
  const rows = await prisma.hierarchyRule.findMany({ include: { rule: true }, orderBy: { id: "asc" } });
  return NextResponse.json({
    items: rows.map((r) => ({
      hierarchyRuleId: r.id,
      ruleId: r.ruleId,
      decisionCode: r.rule.decisionCode,
      hierarchyTop: r.hierarchyTop,
      hierarchyMiddle: r.hierarchyMiddle,
      hierarchyBottom: r.hierarchyBottom,
      hierarchyLevel04: r.hierarchyLevel04,
      hierarchyLevel05: r.hierarchyLevel05,
      hierarchyLevel06: r.hierarchyLevel06,
      hierarchyLevel07: r.hierarchyLevel07,
      hierarchyLevels: [
        r.hierarchyTop,
        r.hierarchyMiddle,
        r.hierarchyBottom,
        r.hierarchyLevel04,
        r.hierarchyLevel05,
        r.hierarchyLevel06,
        r.hierarchyLevel07,
      ],
      descriptorValues: [
        r.descriptor01,
        r.descriptor02,
        r.descriptor03,
        r.descriptor04,
        r.descriptor05,
        r.descriptor06,
        r.descriptor07,
        r.descriptor08,
        r.descriptor09,
        r.descriptor10,
      ],
    })),
  });
}

type PostBody = {
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

export async function POST(request: Request) {
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const ruleId = typeof body.ruleId === "number" ? body.ruleId : Number(body.ruleId);
  const hierarchy = normalizeHierarchyLevels(body);
  const descriptorValuesRaw = Array.isArray(body.descriptorValues) ? body.descriptorValues : [];
  const descriptorValues = Array.from({ length: 10 }, (_, idx) => {
    const v = descriptorValuesRaw[idx];
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t === "" ? null : t;
  });

  if (!Number.isInteger(ruleId) || ruleId < 1) {
    return NextResponse.json({ error: "ruleId must be a positive integer" }, { status: 400 });
  }
  if (!hierarchy.hierarchyTop || !hierarchy.hierarchyMiddle || !hierarchy.hierarchyBottom || !descriptorValues[0]) {
    return NextResponse.json(
      { error: "hierarchyTop, hierarchyMiddle, hierarchyBottom and descriptorValues[0] are required; hierarchyLevel04..07 are optional" },
      { status: 400 },
    );
  }

  const rule = await prisma.rule.findUnique({ where: { id: ruleId } });
  if (!rule) {
    return NextResponse.json({ error: `Rule ${ruleId} not found` }, { status: 404 });
  }

  const created = await prisma.hierarchyRule.create({
    data: {
      ruleId,
      hierarchyTop: hierarchy.hierarchyTop,
      hierarchyMiddle: hierarchy.hierarchyMiddle,
      hierarchyBottom: hierarchy.hierarchyBottom,
      hierarchyLevel04: hierarchy.hierarchyLevel04,
      hierarchyLevel05: hierarchy.hierarchyLevel05,
      hierarchyLevel06: hierarchy.hierarchyLevel06,
      hierarchyLevel07: hierarchy.hierarchyLevel07,
      descriptor01: descriptorValues[0],
      descriptor02: descriptorValues[1],
      descriptor03: descriptorValues[2],
      descriptor04: descriptorValues[3],
      descriptor05: descriptorValues[4],
      descriptor06: descriptorValues[5],
      descriptor07: descriptorValues[6],
      descriptor08: descriptorValues[7],
      descriptor09: descriptorValues[8],
      descriptor10: descriptorValues[9],
    },
    include: { rule: true },
  });

  return NextResponse.json(
    {
      item: {
        hierarchyRuleId: created.id,
        ruleId: created.ruleId,
        decisionCode: created.rule.decisionCode,
        hierarchyTop: created.hierarchyTop,
        hierarchyMiddle: created.hierarchyMiddle,
        hierarchyBottom: created.hierarchyBottom,
        hierarchyLevel04: created.hierarchyLevel04,
        hierarchyLevel05: created.hierarchyLevel05,
        hierarchyLevel06: created.hierarchyLevel06,
        hierarchyLevel07: created.hierarchyLevel07,
        hierarchyLevels: [
          created.hierarchyTop,
          created.hierarchyMiddle,
          created.hierarchyBottom,
          created.hierarchyLevel04,
          created.hierarchyLevel05,
          created.hierarchyLevel06,
          created.hierarchyLevel07,
        ],
        descriptorValues: [
          created.descriptor01,
          created.descriptor02,
          created.descriptor03,
          created.descriptor04,
          created.descriptor05,
          created.descriptor06,
          created.descriptor07,
          created.descriptor08,
          created.descriptor09,
          created.descriptor10,
        ],
      },
    },
    { status: 201 },
  );
}

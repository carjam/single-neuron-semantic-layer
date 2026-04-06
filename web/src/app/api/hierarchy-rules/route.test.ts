import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());
const ruleFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    hierarchyRule: { findMany, create },
    rule: { findUnique: ruleFindUnique },
  },
}));

import { GET, POST } from "./route";

describe("GET /api/hierarchy-rules", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists rules ordered by id", async () => {
    findMany.mockResolvedValue([
      {
        id: 1,
        ruleId: 1,
        hierarchyTop: "Debt",
        hierarchyMiddle: "Govt",
        hierarchyBottom: "sovereign",
        descriptor01: "rates_coverage",
        descriptor02: null,
        descriptor03: null,
        descriptor04: null,
        descriptor05: null,
        descriptor06: null,
        descriptor07: null,
        descriptor08: null,
        descriptor09: null,
        descriptor10: null,
        rule: { decisionCode: "ald_sov_rates_na" },
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0].hierarchyRuleId).toBe(1);
    expect(body.items[0].descriptorValues[0]).toBe("rates_coverage");
  });
});

describe("POST /api/hierarchy-rules", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a new hierarchy rule", async () => {
    ruleFindUnique.mockResolvedValue({ id: 1 });
    create.mockResolvedValue({
      id: 9,
      ruleId: 1,
      hierarchyTop: "Debt",
      hierarchyMiddle: "*",
      hierarchyBottom: "*",
      descriptor01: "general",
      descriptor02: null,
      descriptor03: null,
      descriptor04: null,
      descriptor05: null,
      descriptor06: null,
      descriptor07: null,
      descriptor08: null,
      descriptor09: null,
      descriptor10: null,
      rule: { decisionCode: "ald_sov_rates_na" },
    });

    const req = new Request("http://localhost/api/hierarchy-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ruleId: 1,
        hierarchyTop: "Debt",
        hierarchyMiddle: "*",
        hierarchyBottom: "*",
        descriptorValues: ["general"],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.item.hierarchyRuleId).toBe(9);
  });
});


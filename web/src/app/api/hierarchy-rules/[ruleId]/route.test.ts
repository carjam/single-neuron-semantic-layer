import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn());
const ruleFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    hierarchyRule: { findUnique, update, delete: remove },
    rule: { findUnique: ruleFindUnique },
  },
}));

import { DELETE, GET, PATCH } from "./route";

describe("GET /api/hierarchy-rules/:ruleId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns one hierarchy rule", async () => {
    findUnique.mockResolvedValue({
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
    });

    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ ruleId: "1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.hierarchyRuleId).toBe(1);
  });
});

describe("PATCH /api/hierarchy-rules/:ruleId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates fields", async () => {
    ruleFindUnique.mockResolvedValue({ id: 3 });
    update.mockResolvedValue({
      id: 1,
      ruleId: 3,
      hierarchyTop: "Debt",
      hierarchyMiddle: "Corp",
      hierarchyBottom: "corporate",
      descriptor01: "credit_coverage",
      descriptor02: null,
      descriptor03: null,
      descriptor04: null,
      descriptor05: null,
      descriptor06: null,
      descriptor07: null,
      descriptor08: null,
      descriptor09: null,
      descriptor10: null,
      rule: { decisionCode: "ald_corp_credit_emea" },
    });

    const req = new Request("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruleId: 3, hierarchyMiddle: "Corp", hierarchyBottom: "corporate", descriptorValues: ["credit_coverage"] }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ ruleId: "1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.hierarchyMiddle).toBe("Corp");
  });
});

describe("DELETE /api/hierarchy-rules/:ruleId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 204 when deleted", async () => {
    remove.mockResolvedValue({});
    const res = await DELETE(new Request("http://localhost"), { params: Promise.resolve({ ruleId: "3" }) });
    expect(res.status).toBe(204);
  });
});


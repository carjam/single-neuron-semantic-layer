import { beforeEach, describe, expect, it, vi } from "vitest";

const rFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rule: { findMany: rFindMany },
  },
}));

import { GET } from "./route";

describe("GET /api/rules", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns rule summaries", async () => {
    rFindMany.mockResolvedValue([
      { id: 1, decisionCode: "a" },
      { id: 2, decisionCode: "b" },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [
        { ruleId: 1, decisionCode: "a" },
        { ruleId: 2, decisionCode: "b" },
      ],
    });
  });
});

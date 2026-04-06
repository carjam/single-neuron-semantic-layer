import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: queryRaw,
  },
}));

import { GET } from "./route";

describe("GET /api/health", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok=true when required demo functions exist", async () => {
    queryRaw.mockResolvedValue([{ has_enriched_fn: true, has_dense_fn: true }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      checks: {
        demoGetEnrichedRows: true,
        demoGetDenseScores: true,
      },
    });
  });

  it("returns 503 when either function is missing", async () => {
    queryRaw.mockResolvedValue([{ has_enriched_fn: true, has_dense_fn: false }]);
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      ok: false,
      checks: {
        demoGetEnrichedRows: true,
        demoGetDenseScores: false,
      },
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const loadEnrichedRows = vi.hoisted(() => vi.fn());

vi.mock("@/lib/loadEnrichedRows", () => ({
  loadEnrichedRows,
}));

import { GET } from "./route";

describe("GET /api/enriched/export", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns CSV with BOM and attachment headers", async () => {
    loadEnrichedRows.mockResolvedValue([
      {
        observationId: 1,
        isin: "X",
        aldIssuerClass: "sovereign",
        fundIssuerClassOverride: null,
        aldRegion: "na",
        fundRegionOverride: null,
        aldRatingBand: "ig",
        fundRatingBandOverride: null,
        effectiveIssuerClass: "sovereign",
        effectiveRegion: "na",
        effectiveRatingBand: "ig",
        hierarchyTop: "Debt",
        hierarchyMiddle: "Govt",
        hierarchyBottom: "sovereign",
        matchedHierarchyRuleId: 1,
        descriptorValues: ["rates_coverage", null, null, null, null, null, null, null, null, null],
        activeFeatureIds: [1, 4, 5],
        scoreByRuleId: { 1: 1 },
        scoreA: 1,
        scoreB: 0,
        scoreC: 0,
        winningRuleId: 1,
        winningDecisionCode: "d1",
        winningScore: 1,
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(buf[0]).toBe(0xef);
    expect(buf[1]).toBe(0xbb);
    expect(buf[2]).toBe(0xbf);
    const text = new TextDecoder("utf-8").decode(buf.subarray(3));
    expect(text).toContain("obs_id");
    expect(text).toContain("X");
  });
});

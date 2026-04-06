import { beforeEach, describe, expect, it, vi } from "vitest";

const loadEnrichedRows = vi.hoisted(() => vi.fn());

vi.mock("@/lib/loadEnrichedRows", () => ({
  loadEnrichedRows,
}));

import { GET } from "./route";

describe("GET /api/enriched", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns computed rows", async () => {
    loadEnrichedRows.mockResolvedValue([
      {
        observationId: 1,
        isin: "US00ALDINFI01",
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
        scoreByRuleId: { 1: 1, 2: 0.6, 3: 0 },
        scoreA: 1,
        scoreB: 0.6,
        scoreC: 0,
        winningRuleId: 1,
        winningDecisionCode: "ald_sov_rates_na",
        winningScore: 1,
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].winningRuleId).toBe(1);
    expect(body.rows[0].isin).toBe("US00ALDINFI01");
  });
});

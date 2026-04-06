import type { EnrichedObservationRow } from "@/lib/engine";
import { describe, expect, it } from "vitest";
import { enrichedRowsToCsv } from "./enrichedCsv";

function row(p: Partial<EnrichedObservationRow>): EnrichedObservationRow {
  return {
    observationId: 1,
    isin: "ISIN1",
    aldIssuerClass: "corporate",
    fundIssuerClassOverride: null,
    aldRegion: "na",
    fundRegionOverride: null,
    aldRatingBand: "core",
    fundRatingBandOverride: null,
    effectiveIssuerClass: "corporate",
    effectiveRegion: "na",
    effectiveRatingBand: "core",
    activeFeatureIds: [2, 4],
    scoreByRuleId: { 1: 0, 2: 0.4, 3: 0 },
    scoreA: 0,
    scoreB: 0.4,
    scoreC: 0,
    winningRuleId: 2,
    winningDecisionCode: "ald_corp_credit_na",
    winningScore: 0.4,
    hierarchyTop: "Debt",
    hierarchyMiddle: "Corp",
    hierarchyBottom: "corporate",
    matchedHierarchyRuleId: 2,
    descriptorValues: ["credit_coverage", null, null, null, null, null, null, null, null, null],
    ...p,
  };
}

describe("enrichedRowsToCsv", () => {
  it("includes header and CRLF line endings", () => {
    const csv = enrichedRowsToCsv([]);
    expect(csv.startsWith("obs_id,")).toBe(true);
    expect(csv).not.toContain("\n\n");
    expect(csv.split("\r\n").length).toBe(1);
  });

  it("escapes fields with commas", () => {
    const csv = enrichedRowsToCsv([row({ isin: "A,B" })]);
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine).toContain('"A,B"');
  });

  it("escapes double quotes by doubling", () => {
    const csv = enrichedRowsToCsv([row({ isin: 'say"hi' })]);
    expect(csv.split("\r\n")[1]).toContain('""');
  });

  it("escapes fields with newlines", () => {
    const csv = enrichedRowsToCsv([row({ winningDecisionCode: "a\nb" })]);
    expect(csv).toMatch(/"a\nb"/);
  });

  it("outputs empty strings for null overrides and null descriptor columns", () => {
    const csv = enrichedRowsToCsv([
      row({
        fundIssuerClassOverride: null,
        descriptorValues: [null, null, null, null, null, null, null, null, null, null],
      }),
    ]);
    const cols = csv.split("\r\n")[1].split(",");
    expect(cols.length).toBeGreaterThan(10);
    expect(csv).toContain(",,");
  });

  it("joins active feature ids without spaces", () => {
    const line = enrichedRowsToCsv([row({ activeFeatureIds: [1, 3, 5] })]).split("\r\n")[1];
    expect(line).toContain("1,3,5");
  });

  it("formats scores with five decimal places", () => {
    const line = enrichedRowsToCsv([row({ scoreA: 1, scoreB: 0.5, scoreC: 0, winningScore: 0.5 })]).split("\r\n")[1];
    expect(line).toContain("1.00000");
    expect(line).toContain("0.50000");
  });
});

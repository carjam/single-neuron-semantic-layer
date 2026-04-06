import type { HierarchyRule, Observation, Rule } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { computeEnrichedRows, kernelizeFeatureIds } from "./engine";

function obs(p: Partial<Observation> & Pick<Observation, "id" | "isin">): Observation {
  return {
    aldIssuerClass: "corporate",
    fundIssuerClassOverride: null,
    aldRegion: "na",
    fundRegionOverride: null,
    aldRatingBand: "core",
    fundRatingBandOverride: null,
    ...p,
  } as Observation;
}

const demoRules: Rule[] = [
  { id: 1, decisionCode: "ald_sov_rates_na" },
  { id: 2, decisionCode: "ald_corp_credit_na" },
  { id: 3, decisionCode: "ald_corp_credit_emea" },
] as Rule[];

const demoHierarchyRules: HierarchyRule[] = [
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
  },
  {
    id: 2,
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
  },
  {
    id: 3,
    ruleId: 2,
    hierarchyTop: "Debt",
    hierarchyMiddle: "*",
    hierarchyBottom: "*",
    descriptor01: "general_debt_coverage",
    descriptor02: null,
    descriptor03: null,
    descriptor04: null,
    descriptor05: null,
    descriptor06: null,
    descriptor07: null,
    descriptor08: null,
    descriptor09: null,
    descriptor10: null,
  },
] as HierarchyRule[];

describe("kernelizeFeatureIds", () => {
  it("maps sovereign + na + ig to features 1,4,5", () => {
    expect(
      kernelizeFeatureIds(
        obs({
          id: 1,
          isin: "X",
          aldIssuerClass: "sovereign",
          aldRegion: "na",
          aldRatingBand: "ig",
        }),
      ),
    ).toEqual([1, 4, 5]);
  });

  it("maps corporate + emea (no ig) to 2,3", () => {
    expect(
      kernelizeFeatureIds(
        obs({
          id: 1,
          isin: "X",
          aldIssuerClass: "corporate",
          aldRegion: "emea",
          aldRatingBand: "core",
        }),
      ),
    ).toEqual([2, 3]);
  });

  it("uses trimmed fund override for issuer when non-empty", () => {
    expect(
      kernelizeFeatureIds(
        obs({
          id: 1,
          isin: "X",
          aldIssuerClass: "sovereign",
          fundIssuerClassOverride: "  corporate  ",
          aldRegion: "emea",
          aldRatingBand: "core",
        }),
      ),
    ).toEqual([2, 3]);
  });

  it("ignores blank override (whitespace only)", () => {
    expect(
      kernelizeFeatureIds(
        obs({
          id: 1,
          isin: "X",
          aldIssuerClass: "sovereign",
          fundIssuerClassOverride: "   ",
          aldRegion: "na",
          aldRatingBand: "ig",
        }),
      ),
    ).toEqual([1, 4, 5]);
  });

  it("uses fund region override over vendor region", () => {
    expect(
      kernelizeFeatureIds(
        obs({
          id: 1,
          isin: "X",
          aldIssuerClass: "corporate",
          aldRegion: "na",
          fundRegionOverride: "emea",
          aldRatingBand: "core",
        }),
      ),
    ).toEqual([2, 3]);
  });

  it("uses fund rating override", () => {
    expect(
      kernelizeFeatureIds(
        obs({
          id: 1,
          isin: "X",
          aldIssuerClass: "corporate",
          aldRegion: "na",
          aldRatingBand: "core",
          fundRatingBandOverride: "ig",
        }),
      ),
    ).toEqual([2, 4, 5]);
  });
});

describe("computeEnrichedRows", () => {
  it("matches sovereign row to specific hierarchy rule", () => {
    const rows = computeEnrichedRows(
      [
        obs({
          id: 1,
          isin: "US00ALDINFI01",
          aldIssuerClass: "sovereign",
          aldRegion: "na",
          aldRatingBand: "ig",
        }),
      ],
      demoRules,
      demoHierarchyRules,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].winningRuleId).toBe(1);
    expect(rows[0].winningScore).toBe(1);
    expect(rows[0].matchedHierarchyRuleId).toBe(1);
    expect(rows[0].descriptorValues[0]).toBe("rates_coverage");
    expect(rows[0].scoreA).toBe(1);
    expect(rows[0].scoreB).toBeCloseTo(1 / 3, 5);
    expect(rows[0].scoreC).toBe(0);
  });

  it("breaks ties in favor of lower rule_id", () => {
    const rules = [
      { id: 2, decisionCode: "second" },
      { id: 1, decisionCode: "first" },
    ] as Rule[];
    const hierarchyRules = [
      {
        id: 1,
        ruleId: 1,
        hierarchyTop: "Debt",
        hierarchyMiddle: "Govt",
        hierarchyBottom: "sovereign",
        descriptor01: "A",
        descriptor02: null,
        descriptor03: null,
        descriptor04: null,
        descriptor05: null,
        descriptor06: null,
        descriptor07: null,
        descriptor08: null,
        descriptor09: null,
        descriptor10: null,
      },
      {
        id: 2,
        ruleId: 2,
        hierarchyTop: "Debt",
        hierarchyMiddle: "Govt",
        hierarchyBottom: "sovereign",
        descriptor01: "B",
        descriptor02: null,
        descriptor03: null,
        descriptor04: null,
        descriptor05: null,
        descriptor06: null,
        descriptor07: null,
        descriptor08: null,
        descriptor09: null,
        descriptor10: null,
      },
    ] as HierarchyRule[];
    const rows = computeEnrichedRows(
      [obs({ id: 1, isin: "T", aldIssuerClass: "sovereign", aldRegion: "xx", aldRatingBand: "xx" })],
      rules,
      hierarchyRules,
    );
    expect(rows[0].winningRuleId).toBe(1);
    expect(rows[0].winningDecisionCode).toBe("first");
  });

  it("returns null match when no hierarchy rule matches", () => {
    const rows = computeEnrichedRows(
      [obs({ id: 1, isin: "T", aldIssuerClass: "sovereign", aldRegion: "na", aldRatingBand: "ig" })],
      demoRules,
      [],
    );
    expect(rows[0].winningRuleId).toBe(1);
    expect(rows[0].matchedHierarchyRuleId).toBeNull();
    expect(rows[0].descriptorValues[0]).toBeNull();
  });

  it("uses score slots a/b/c as zero when rules 1–3 are absent", () => {
    const rules = [{ id: 10, decisionCode: "only_ten" }] as Rule[];
    const hierarchyRules = [
      {
        id: 10,
        ruleId: 10,
        hierarchyTop: "Debt",
        hierarchyMiddle: "Govt",
        hierarchyBottom: "sovereign",
        descriptor01: "only_ten",
        descriptor02: null,
        descriptor03: null,
        descriptor04: null,
        descriptor05: null,
        descriptor06: null,
        descriptor07: null,
        descriptor08: null,
        descriptor09: null,
        descriptor10: null,
      },
    ] as HierarchyRule[];
    const rows = computeEnrichedRows(
      [obs({ id: 1, isin: "T", aldIssuerClass: "sovereign", aldRegion: "na", aldRatingBand: "ig" })],
      rules,
      hierarchyRules,
    );
    expect(rows[0].scoreA).toBe(0);
    expect(rows[0].scoreB).toBe(0);
    expect(rows[0].scoreC).toBe(0);
    expect(rows[0].winningRuleId).toBe(10);
    expect(rows[0].winningDecisionCode).toBe("only_ten");
  });

  it("sorts activeFeatureIds", () => {
    const rows = computeEnrichedRows(
      [obs({ id: 1, isin: "T", aldIssuerClass: "corporate", aldRegion: "na", fundRatingBandOverride: "ig" })],
      demoRules,
      demoHierarchyRules,
    );
    expect(rows[0].activeFeatureIds).toEqual([2, 4, 5]);
  });
});

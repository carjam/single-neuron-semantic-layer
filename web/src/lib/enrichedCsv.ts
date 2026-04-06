import type { EnrichedObservationRow } from "@/lib/engine";

const HEADERS = [
  "obs_id",
  "isin",
  "ald_issuer_class",
  "fund_issuer_class_override",
  "ald_region",
  "fund_region_override",
  "ald_rating_band",
  "fund_rating_band_override",
  "effective_issuer_class",
  "effective_region",
  "effective_rating_band",
  "hierarchy_top",
  "hierarchy_middle",
  "hierarchy_bottom",
  "matched_hierarchy_rule_id",
  "descriptor_01",
  "descriptor_02",
  "descriptor_03",
  "descriptor_04",
  "descriptor_05",
  "descriptor_06",
  "descriptor_07",
  "descriptor_08",
  "descriptor_09",
  "descriptor_10",
  "active_feature_ids",
  "score_a",
  "score_b",
  "score_c",
  "winning_rule_id",
  "winning_workstream",
  "winning_score",
] as const;

function escapeCsvCell(raw: string): string {
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function rowValues(r: EnrichedObservationRow): string[] {
  const descriptorValues = Array.isArray(r.descriptorValues)
    ? [...r.descriptorValues, null, null, null, null, null, null, null, null, null, null].slice(0, 10)
    : Array.from({ length: 10 }, () => null);

  return [
    String(r.observationId),
    r.isin,
    r.aldIssuerClass,
    r.fundIssuerClassOverride ?? "",
    r.aldRegion,
    r.fundRegionOverride ?? "",
    r.aldRatingBand,
    r.fundRatingBandOverride ?? "",
    r.effectiveIssuerClass,
    r.effectiveRegion,
    r.effectiveRatingBand,
    r.hierarchyTop,
    r.hierarchyMiddle,
    r.hierarchyBottom,
    r.matchedHierarchyRuleId === null ? "" : String(r.matchedHierarchyRuleId),
    ...descriptorValues.map((v) => v ?? ""),
    r.activeFeatureIds.join(","),
    r.scoreA.toFixed(5),
    r.scoreB.toFixed(5),
    r.scoreC.toFixed(5),
    String(r.winningRuleId),
    r.winningDecisionCode,
    r.winningScore.toFixed(5),
  ];
}

/** RFC 4180-style CSV; one header row + one line per observation. */
export function enrichedRowsToCsv(rows: EnrichedObservationRow[]): string {
  const lines = [
    HEADERS.map(escapeCsvCell).join(","),
    ...rows.map((r) => rowValues(r).map(escapeCsvCell).join(",")),
  ];
  return lines.join("\r\n");
}

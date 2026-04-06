"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { Nav } from "@/components/Nav";

type EnrichedRow = {
  observationId: number;
  isin: string;
  aldIssuerClass: string;
  fundIssuerClassOverride: string | null;
  aldRegion: string;
  fundRegionOverride: string | null;
  aldRatingBand: string;
  fundRatingBandOverride: string | null;
  effectiveIssuerClass: string;
  effectiveRegion: string;
  effectiveRatingBand: string;
  activeFeatureIds: number[];
  scoreA: number;
  scoreB: number;
  scoreC: number;
  winningRuleId: number;
  winningDecisionCode: string;
  winningScore: number;
  descriptor: { routingQueue: string; slaBucket: string; costCenter: string } | null;
};

type ObsCol = {
  id: string;
  label: string;
  minWidth: string;
  maxWidth: string;
  mono?: boolean;
  render: (r: EnrichedRow) => string;
};

const observationColumns: ObsCol[] = [
  { id: "obs_id", label: "Observation ID", minWidth: "3.5rem", maxWidth: "5rem", mono: true, render: (r) => String(r.observationId) },
  { id: "isin", label: "ISIN", minWidth: "6.5rem", maxWidth: "9rem", mono: true, render: (r) => r.isin },
  { id: "ald_issuer", label: "Vendor issuer class", minWidth: "6rem", maxWidth: "10rem", render: (r) => r.aldIssuerClass },
  {
    id: "fund_issuer_override",
    label: "Fund issuer override",
    minWidth: "6rem",
    maxWidth: "10rem",
    render: (r) => r.fundIssuerClassOverride ?? "—",
  },
  { id: "ald_region", label: "Vendor region", minWidth: "5rem", maxWidth: "8rem", render: (r) => r.aldRegion },
  {
    id: "fund_region_override",
    label: "Fund region override",
    minWidth: "6rem",
    maxWidth: "10rem",
    render: (r) => r.fundRegionOverride ?? "—",
  },
  { id: "ald_rating", label: "Vendor rating band", minWidth: "6rem", maxWidth: "9rem", render: (r) => r.aldRatingBand },
  {
    id: "fund_rating_override",
    label: "Fund rating override",
    minWidth: "6rem",
    maxWidth: "10rem",
    render: (r) => r.fundRatingBandOverride ?? "—",
  },
  {
    id: "effective_issuer",
    label: "Effective issuer (for scoring)",
    minWidth: "6.5rem",
    maxWidth: "11rem",
    render: (r) => r.effectiveIssuerClass,
  },
  { id: "effective_region", label: "Effective region", minWidth: "6rem", maxWidth: "10rem", render: (r) => r.effectiveRegion },
  {
    id: "effective_rating",
    label: "Effective rating band",
    minWidth: "6.5rem",
    maxWidth: "11rem",
    render: (r) => r.effectiveRatingBand,
  },
  {
    id: "active_features",
    label: "Active feature IDs",
    minWidth: "5.5rem",
    maxWidth: "9rem",
    mono: true,
    render: (r) => r.activeFeatureIds.join(", ") || "—",
  },
];

type EnrichCol = {
  id: string;
  label: string;
  minWidth: string;
  maxWidth: string;
  first?: boolean;
  mono?: boolean;
  render: (r: EnrichedRow) => string;
  missingDescriptor?: boolean;
};

const enrichColumns: EnrichCol[] = [
  { id: "score_a", label: "Score, outcome 1", minWidth: "4.5rem", maxWidth: "7rem", first: true, render: (r) => r.scoreA.toFixed(2) },
  { id: "score_b", label: "Score, outcome 2", minWidth: "4.5rem", maxWidth: "7rem", render: (r) => r.scoreB.toFixed(2) },
  { id: "score_c", label: "Score, outcome 3", minWidth: "4.5rem", maxWidth: "7rem", render: (r) => r.scoreC.toFixed(2) },
  { id: "win_rule", label: "Winning rule ID", minWidth: "4rem", maxWidth: "7rem", mono: true, render: (r) => String(r.winningRuleId) },
  {
    id: "win_workstream",
    label: "Winning workstream",
    minWidth: "7rem",
    maxWidth: "12rem",
    mono: true,
    render: (r) => r.winningDecisionCode,
  },
  { id: "win_score", label: "Winning score", minWidth: "4.5rem", maxWidth: "7rem", render: (r) => r.winningScore.toFixed(2) },
  {
    id: "routing_queue",
    label: "Routing queue",
    minWidth: "6.5rem",
    maxWidth: "11rem",
    missingDescriptor: true,
    render: (r) => r.descriptor?.routingQueue ?? "—",
  },
  {
    id: "sla_bucket",
    label: "SLA bucket",
    minWidth: "5.5rem",
    maxWidth: "9rem",
    missingDescriptor: true,
    render: (r) => r.descriptor?.slaBucket ?? "—",
  },
  {
    id: "cost_center",
    label: "Cost center (book)",
    minWidth: "6.5rem",
    maxWidth: "11rem",
    missingDescriptor: true,
    render: (r) => r.descriptor?.costCenter ?? "—",
  },
];

const obsHeaderClass =
  "border-b border-r border-slate-300 bg-slate-200 px-2 py-2.5 text-left text-[11px] font-semibold leading-snug text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

const obsCellBase =
  "border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-xs leading-snug text-slate-900 align-top dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

const enrichHeaderClass =
  "border-b border-r border-emerald-200/90 bg-emerald-100 px-2 py-2.5 text-left text-[11px] font-semibold leading-snug text-emerald-950 dark:border-emerald-800/70 dark:bg-emerald-950/55 dark:text-emerald-100";

const enrichCellBase =
  "border-b border-r border-emerald-200/60 bg-emerald-50/50 px-2 py-2 text-xs leading-snug text-emerald-950 align-top dark:border-emerald-900/45 dark:bg-emerald-950/25 dark:text-emerald-100";

const enrichFirstHeaderClass = `${enrichHeaderClass} border-l-2 border-l-emerald-600 dark:border-l-emerald-500`;
const enrichFirstCellClass = `${enrichCellBase} border-l-2 border-l-emerald-600 dark:border-l-emerald-500`;

function colShellStyle(minWidth: string): CSSProperties {
  return { minWidth };
}

function wrapStyle(maxWidth: string): CSSProperties {
  return { maxWidth };
}

export default function EnrichedPage() {
  const [rows, setRows] = useState<EnrichedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/enriched");
    if (!res.ok) {
      setError("Failed to load enriched rows");
      setLoading(false);
      return;
    }
    const j = (await res.json()) as { rows: EnrichedRow[] };
    setRows(j.rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <Nav current="enriched" />
      <main className="px-4 py-8">
        <div className="mx-auto max-w-[100rem]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Enriched output
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                One row per observation. Scroll horizontally for all columns. Headers use plain language; long text wraps within each column.{" "}
                <strong className="text-slate-800 dark:text-slate-200">Slate</strong> = observation feed;{" "}
                <strong className="text-emerald-800 dark:text-emerald-200">Emerald</strong> = scores, winner, and descriptors.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  void load();
                }}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                Refresh
              </button>
              <a
                href="/api/enriched/export"
                download="enriched_observations.csv"
                className="inline-flex rounded-md border border-emerald-600/70 bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                Download CSV
              </a>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {error}
            </div>
          )}

          {loading ? (
            <p className="mt-8 text-sm text-zinc-500">Loading…</p>
          ) : (
            <div className="mt-6 rounded-lg border border-zinc-300 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-zinc-200 px-3 py-2.5 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-8 rounded-sm bg-slate-200 ring-1 ring-slate-400 dark:bg-slate-800 dark:ring-slate-600" />
                  Observation — raw + effective
                </span>
                <span className="text-zinc-300 dark:text-zinc-600">|</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-8 rounded-sm bg-emerald-200 ring-1 ring-emerald-500/60 dark:bg-emerald-900 dark:ring-emerald-600" />
                  Enrichment — scores, winner, descriptors
                </span>
              </div>

              <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: "min(75vh, 720px)" }}>
                <table className="min-w-max border-collapse text-left">
                  <thead>
                    <tr>
                      {observationColumns.map((col) => (
                        <th key={col.id} className={obsHeaderClass} style={colShellStyle(col.minWidth)}>
                          <div style={wrapStyle(col.maxWidth)} className="break-words">
                            {col.label}
                          </div>
                        </th>
                      ))}
                      {enrichColumns.map((col) => (
                        <th
                          key={col.id}
                          className={col.first ? enrichFirstHeaderClass : enrichHeaderClass}
                          style={colShellStyle(col.minWidth)}
                        >
                          <div style={wrapStyle(col.maxWidth)} className="break-words">
                            {col.label}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.observationId}>
                        {observationColumns.map((col) => (
                          <td
                            key={col.id}
                            className={`${obsCellBase} ${col.mono ? "font-mono text-[11px]" : ""}`}
                            style={colShellStyle(col.minWidth)}
                          >
                            <div style={wrapStyle(col.maxWidth)} className="break-words">
                              {col.render(r)}
                            </div>
                          </td>
                        ))}
                        {enrichColumns.map((col) => {
                          const missing = col.missingDescriptor && !r.descriptor;
                          return (
                            <td
                              key={col.id}
                              className={`${col.first ? enrichFirstCellClass : enrichCellBase} ${col.mono ? "font-mono text-[11px]" : ""} ${missing ? "italic text-amber-900 dark:text-amber-200" : ""}`}
                              style={colShellStyle(col.minWidth)}
                            >
                              <div style={wrapStyle(col.maxWidth)} className="break-words">
                                {col.render(r)}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

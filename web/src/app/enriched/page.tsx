"use client";

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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Nav current="enriched" />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Enriched output
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Same pipeline as <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">ENRICHED_OBSERVATION_ROW</code> in{" "}
              <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">sql/postgres/demo.sql</code>: kernelization → linear scores (slots a/b/c) →
              argmax → attach descriptors for the winning rule. Edit descriptors on the other screen and refresh here to see routing / SLA / book change
              for securities that land on that outcome.
            </p>
          </div>
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
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <p className="mt-8 text-sm text-zinc-500">Loading…</p>
        ) : (
          <div className="mt-8 grid gap-6">
            {rows.map((r) => (
              <article
                key={r.observationId}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="border-b border-zinc-100 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/80">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-50">{r.isin}</h2>
                    <span className="text-xs text-zinc-500">observation_id {r.observationId}</span>
                  </div>
                </div>
                <div className="grid gap-4 p-4 lg:grid-cols-2">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Vendor vs fund vs effective</h3>
                    <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-zinc-500">ald issuer / override</dt>
                        <dd className="font-mono text-zinc-900 dark:text-zinc-100">
                          {r.aldIssuerClass}
                          {r.fundIssuerClassOverride ? ` / override: ${r.fundIssuerClassOverride}` : ""}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">ald region / override</dt>
                        <dd className="font-mono text-zinc-900 dark:text-zinc-100">
                          {r.aldRegion}
                          {r.fundRegionOverride ? ` / override: ${r.fundRegionOverride}` : ""}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">ald rating / override</dt>
                        <dd className="font-mono text-zinc-900 dark:text-zinc-100">
                          {r.aldRatingBand}
                          {r.fundRatingBandOverride ? ` / override: ${r.fundRatingBandOverride}` : ""}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">effective (kernel input)</dt>
                        <dd className="font-mono text-zinc-900 dark:text-zinc-100">
                          {r.effectiveIssuerClass} · {r.effectiveRegion} · {r.effectiveRatingBand}
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-2 text-xs text-zinc-500">
                      Active feature ids: <span className="font-mono text-zinc-700 dark:text-zinc-300">{r.activeFeatureIds.join(", ") || "—"}</span>
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Scores & winner</h3>
                    <p className="mt-2 font-mono text-sm text-zinc-800 dark:text-zinc-200">
                      a (rule 1): {r.scoreA.toFixed(2)} · b (rule 2): {r.scoreB.toFixed(2)} · c (rule 3): {r.scoreC.toFixed(2)}
                    </p>
                    <p className="mt-2 text-sm text-zinc-900 dark:text-zinc-50">
                      Winner:{" "}
                      <span className="font-mono font-semibold">
                        {r.winningDecisionCode}
                      </span>{" "}
                      <span className="text-zinc-500">(rule_id {r.winningRuleId}, score {r.winningScore.toFixed(2)})</span>
                    </p>
                    <div
                      className={`mt-4 rounded-lg border px-3 py-3 text-sm ${
                        r.descriptor
                          ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                          : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
                      }`}
                    >
                      <h4 className="text-xs font-semibold uppercase tracking-wide opacity-80">Descriptors (from CRUD)</h4>
                      {r.descriptor ? (
                        <dl className="mt-2 grid gap-1">
                          <div>
                            <dt className="inline text-zinc-600 dark:text-zinc-400">routing_queue</dt>{" "}
                            <dd className="inline font-mono font-medium">{r.descriptor.routingQueue}</dd>
                          </div>
                          <div>
                            <dt className="inline text-zinc-600 dark:text-zinc-400">sla_bucket</dt>{" "}
                            <dd className="inline font-mono font-medium">{r.descriptor.slaBucket}</dd>
                          </div>
                          <div>
                            <dt className="inline text-zinc-600 dark:text-zinc-400">cost_center</dt>{" "}
                            <dd className="inline font-mono font-medium">{r.descriptor.costCenter}</dd>
                          </div>
                        </dl>
                      ) : (
                        <p className="mt-2">
                          No descriptor row for this winning rule — add one under <strong>Descriptors</strong> or restore defaults via{" "}
                          <code className="rounded bg-black/5 px-1 dark:bg-white/10">npm run db:seed</code>.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

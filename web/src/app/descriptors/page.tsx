"use client";

import { useCallback, useEffect, useState } from "react";
import { Nav } from "@/components/Nav";

type DescriptorRow = {
  ruleId: number;
  decisionCode: string;
  routingQueue: string;
  slaBucket: string;
  costCenter: string;
};

type RuleRow = { ruleId: number; decisionCode: string; hasDescriptor: boolean };

export default function DescriptorsPage() {
  const [items, setItems] = useState<DescriptorRow[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ routingQueue: "", slaBucket: "", costCenter: "" });
  const [createRuleId, setCreateRuleId] = useState<number | "">("");
  const [createForm, setCreateForm] = useState({ routingQueue: "", slaBucket: "", costCenter: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const [dRes, rRes] = await Promise.all([fetch("/api/descriptors"), fetch("/api/rules")]);
    if (!dRes.ok) {
      setError("Failed to load descriptors");
      setLoading(false);
      return;
    }
    if (!rRes.ok) {
      setError("Failed to load rules");
      setLoading(false);
      return;
    }
    const dJson = (await dRes.json()) as { items: DescriptorRow[] };
    const rJson = (await rRes.json()) as { items: RuleRow[] };
    setItems(dJson.items);
    setRules(rJson.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveEdit(ruleId: number) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/descriptors/${ruleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        routingQueue: form.routingQueue,
        slaBucket: form.slaBucket,
        costCenter: form.costCenter,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? "Update failed");
      return;
    }
    setEditingId(null);
    await load();
  }

  async function remove(ruleId: number) {
    if (!confirm(`Remove descriptor for rule ${ruleId}? Enriched rows that win this rule will show no routing metadata.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/descriptors/${ruleId}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? "Delete failed");
      return;
    }
    await load();
  }

  async function createDescriptor() {
    if (createRuleId === "") {
      setError("Choose a rule");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/descriptors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ruleId: createRuleId,
        routingQueue: createForm.routingQueue,
        slaBucket: createForm.slaBucket,
        costCenter: createForm.costCenter,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? "Create failed");
      return;
    }
    setCreateForm({ routingQueue: "", slaBucket: "", costCenter: "" });
    setCreateRuleId("");
    await load();
  }

  const availableRules = rules.filter((r) => !r.hasDescriptor);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Nav current="descriptors" />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Descriptor management
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          REST-backed CRUD for per-outcome semantic fields (<code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">routing_queue</code>,{" "}
          <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">sla_bucket</code>,{" "}
          <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">cost_center</code>) keyed by{" "}
          <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">rule_id</code>. Matches{" "}
          <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">demo_rule_enrichment</code> in the SQL demo.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Existing descriptors
          </h2>
          {loading ? (
            <p className="mt-4 text-sm text-zinc-500">Loading…</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-700">
                    <th className="py-2 pr-3 font-medium">rule_id</th>
                    <th className="py-2 pr-3 font-medium">decision_code</th>
                    <th className="py-2 pr-3 font-medium">routing_queue</th>
                    <th className="py-2 pr-3 font-medium">sla_bucket</th>
                    <th className="py-2 pr-3 font-medium">cost_center</th>
                    <th className="py-2 font-medium">actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.ruleId} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="py-2 pr-3 font-mono text-zinc-800 dark:text-zinc-200">{row.ruleId}</td>
                      <td className="py-2 pr-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">{row.decisionCode}</td>
                      <td className="py-2 pr-3 text-zinc-800 dark:text-zinc-200">
                        {editingId === row.ruleId ? (
                          <input
                            className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                            value={form.routingQueue}
                            onChange={(e) => setForm((f) => ({ ...f, routingQueue: e.target.value }))}
                          />
                        ) : (
                          row.routingQueue
                        )}
                      </td>
                      <td className="py-2 pr-3 text-zinc-800 dark:text-zinc-200">
                        {editingId === row.ruleId ? (
                          <input
                            className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                            value={form.slaBucket}
                            onChange={(e) => setForm((f) => ({ ...f, slaBucket: e.target.value }))}
                          />
                        ) : (
                          row.slaBucket
                        )}
                      </td>
                      <td className="py-2 pr-3 text-zinc-800 dark:text-zinc-200">
                        {editingId === row.ruleId ? (
                          <input
                            className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                            value={form.costCenter}
                            onChange={(e) => setForm((f) => ({ ...f, costCenter: e.target.value }))}
                          />
                        ) : (
                          row.costCenter
                        )}
                      </td>
                      <td className="py-2">
                        {editingId === row.ruleId ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                              onClick={() => void saveEdit(row.ruleId)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600"
                              onClick={() => {
                                setEditingId(row.ruleId);
                                setForm({
                                  routingQueue: row.routingQueue,
                                  slaBucket: row.slaBucket,
                                  costCenter: row.costCenter,
                                });
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 dark:border-red-900 dark:text-red-300"
                              onClick={() => void remove(row.ruleId)}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Add descriptor
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Only rules without a descriptor appear in the list (after a delete you can re-create).
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-500">rule_id</span>
              <select
                className="rounded-md border border-zinc-300 bg-white px-2 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                value={createRuleId === "" ? "" : String(createRuleId)}
                onChange={(e) => setCreateRuleId(e.target.value === "" ? "" : Number(e.target.value))}
              >
                <option value="">Select…</option>
                {availableRules.map((r) => (
                  <option key={r.ruleId} value={r.ruleId}>
                    {r.ruleId} — {r.decisionCode}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-500">routing_queue</span>
              <input
                className="rounded-md border border-zinc-300 bg-white px-2 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                value={createForm.routingQueue}
                onChange={(e) => setCreateForm((f) => ({ ...f, routingQueue: e.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-500">sla_bucket</span>
              <input
                className="rounded-md border border-zinc-300 bg-white px-2 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                value={createForm.slaBucket}
                onChange={(e) => setCreateForm((f) => ({ ...f, slaBucket: e.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-500">cost_center</span>
              <input
                className="rounded-md border border-zinc-300 bg-white px-2 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                value={createForm.costCenter}
                onChange={(e) => setCreateForm((f) => ({ ...f, costCenter: e.target.value }))}
              />
            </label>
          </div>
          <button
            type="button"
            disabled={busy || availableRules.length === 0}
            className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            onClick={() => void createDescriptor()}
          >
            Create (POST /api/descriptors)
          </button>
        </section>
      </main>
    </div>
  );
}

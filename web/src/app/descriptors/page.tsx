"use client";

import { useCallback, useEffect, useState } from "react";
import { Nav } from "@/components/Nav";

type RuleRow = { ruleId: number; decisionCode: string };

type HierarchyRuleRow = {
  hierarchyRuleId: number;
  ruleId: number;
  decisionCode: string;
  hierarchyTop: string;
  hierarchyMiddle: string;
  hierarchyBottom: string;
  hierarchyLevel04: string;
  hierarchyLevel05: string;
  hierarchyLevel06: string;
  hierarchyLevel07: string;
  descriptorValues: Array<string | null>;
};

type HierarchyRuleForm = {
  ruleId: string;
  hierarchyTop: string;
  hierarchyMiddle: string;
  hierarchyBottom: string;
  hierarchyLevel04: string;
  hierarchyLevel05: string;
  hierarchyLevel06: string;
  hierarchyLevel07: string;
  descriptorValues: string[];
};

function emptyForm(): HierarchyRuleForm {
  return {
    ruleId: "",
    hierarchyTop: "",
    hierarchyMiddle: "",
    hierarchyBottom: "",
    hierarchyLevel04: "*",
    hierarchyLevel05: "*",
    hierarchyLevel06: "*",
    hierarchyLevel07: "*",
    descriptorValues: Array.from({ length: 10 }, () => ""),
  };
}

export default function DescriptorsPage() {
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [items, setItems] = useState<HierarchyRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<HierarchyRuleForm>(emptyForm);

  const [createForm, setCreateForm] = useState<HierarchyRuleForm>(emptyForm);

  const load = useCallback(async () => {
    setError(null);
    const [rr, hr] = await Promise.all([fetch("/api/rules"), fetch("/api/hierarchy-rules")]);
    if (!rr.ok || !hr.ok) {
      setError("Failed to load hierarchy configuration");
      setLoading(false);
      return;
    }
    const rj = (await rr.json()) as { items: RuleRow[] };
    const hj = (await hr.json()) as { items: HierarchyRuleRow[] };
    setRules(rj.items);
    setItems(hj.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createRule() {
    const ruleId = Number(createForm.ruleId);
    if (!Number.isInteger(ruleId) || ruleId < 1) {
      setError("Please choose a decision rule");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/hierarchy-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ruleId,
        hierarchyTop: createForm.hierarchyTop,
        hierarchyMiddle: createForm.hierarchyMiddle,
        hierarchyBottom: createForm.hierarchyBottom,
        hierarchyLevel04: createForm.hierarchyLevel04,
        hierarchyLevel05: createForm.hierarchyLevel05,
        hierarchyLevel06: createForm.hierarchyLevel06,
        hierarchyLevel07: createForm.hierarchyLevel07,
        descriptorValues: createForm.descriptorValues,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? "Create failed");
      return;
    }
    setCreateForm(emptyForm());
    await load();
  }

  async function saveEdit(hierarchyRuleId: number) {
    const ruleId = Number(editForm.ruleId);
    if (!Number.isInteger(ruleId) || ruleId < 1) {
      setError("Please choose a decision rule");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/hierarchy-rules/${hierarchyRuleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ruleId,
        hierarchyTop: editForm.hierarchyTop,
        hierarchyMiddle: editForm.hierarchyMiddle,
        hierarchyBottom: editForm.hierarchyBottom,
        hierarchyLevel04: editForm.hierarchyLevel04,
        hierarchyLevel05: editForm.hierarchyLevel05,
        hierarchyLevel06: editForm.hierarchyLevel06,
        hierarchyLevel07: editForm.hierarchyLevel07,
        descriptorValues: editForm.descriptorValues,
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

  async function removeRule(hierarchyRuleId: number) {
    if (!confirm("Delete this hierarchy rule?")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/hierarchy-rules/${hierarchyRuleId}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? "Delete failed");
      return;
    }
    await load();
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Nav current="descriptors" />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Hierarchy rule management</h1>
        <p className="mt-2 max-w-4xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Choose a decision rule, define the hierarchy match pattern (<code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">*</code> allowed), and set up to 10 descriptors.
          Runtime scoring is derived from hierarchy match strength. Internal numeric IDs are auto-assigned by the database.
        </p>

        {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}

        <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Existing hierarchy rules</h2>
          {loading ? (
            <p className="mt-4 text-sm text-zinc-500">Loading…</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[1300px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-700">
                    <th className="py-2 pr-3 font-medium">Decision rule</th>
                    <th className="py-2 pr-3 font-medium">Hierarchy top</th>
                    <th className="py-2 pr-3 font-medium">Hierarchy middle</th>
                    <th className="py-2 pr-3 font-medium">Hierarchy bottom</th>
                    <th className="py-2 pr-3 font-medium">Hierarchy L4</th>
                    <th className="py-2 pr-3 font-medium">Hierarchy L5</th>
                    <th className="py-2 pr-3 font-medium">Hierarchy L6</th>
                    <th className="py-2 pr-3 font-medium">Hierarchy L7</th>
                    {Array.from({ length: 10 }, (_, i) => (
                      <th key={`hdr-${i}`} className="py-2 pr-3 font-medium">Descriptor {String(i + 1).padStart(2, "0")}</th>
                    ))}
                    <th className="py-2 pr-3 font-medium">Internal ID</th>
                    <th className="py-2 font-medium">actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.hierarchyRuleId} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="py-2 pr-3">
                        {editingId === row.hierarchyRuleId ? (
                          <select className="w-48 rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950" value={editForm.ruleId} onChange={(e) => setEditForm((f) => ({ ...f, ruleId: e.target.value }))}>
                            <option value="">Select…</option>
                            {rules.map((r) => <option key={r.ruleId} value={r.ruleId}>{r.decisionCode}</option>)}
                          </select>
                        ) : (
                          <div>
                            <div className="font-mono text-xs">{row.decisionCode}</div>
                            <div className="text-xs text-zinc-500">Rule #{row.ruleId}</div>
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {editingId === row.hierarchyRuleId ? (
                          <input className="w-28 rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950" value={editForm.hierarchyTop} onChange={(e) => setEditForm((f) => ({ ...f, hierarchyTop: e.target.value }))} />
                        ) : row.hierarchyTop}
                      </td>
                      <td className="py-2 pr-3">
                        {editingId === row.hierarchyRuleId ? (
                          <input className="w-28 rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950" value={editForm.hierarchyMiddle} onChange={(e) => setEditForm((f) => ({ ...f, hierarchyMiddle: e.target.value }))} />
                        ) : row.hierarchyMiddle}
                      </td>
                      <td className="py-2 pr-3">
                        {editingId === row.hierarchyRuleId ? (
                          <input className="w-28 rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950" value={editForm.hierarchyBottom} onChange={(e) => setEditForm((f) => ({ ...f, hierarchyBottom: e.target.value }))} />
                        ) : row.hierarchyBottom}
                      </td>
                      <td className="py-2 pr-3">
                        {editingId === row.hierarchyRuleId ? (
                          <input className="w-28 rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950" value={editForm.hierarchyLevel04} onChange={(e) => setEditForm((f) => ({ ...f, hierarchyLevel04: e.target.value }))} />
                        ) : row.hierarchyLevel04}
                      </td>
                      <td className="py-2 pr-3">
                        {editingId === row.hierarchyRuleId ? (
                          <input className="w-28 rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950" value={editForm.hierarchyLevel05} onChange={(e) => setEditForm((f) => ({ ...f, hierarchyLevel05: e.target.value }))} />
                        ) : row.hierarchyLevel05}
                      </td>
                      <td className="py-2 pr-3">
                        {editingId === row.hierarchyRuleId ? (
                          <input className="w-28 rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950" value={editForm.hierarchyLevel06} onChange={(e) => setEditForm((f) => ({ ...f, hierarchyLevel06: e.target.value }))} />
                        ) : row.hierarchyLevel06}
                      </td>
                      <td className="py-2 pr-3">
                        {editingId === row.hierarchyRuleId ? (
                          <input className="w-28 rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950" value={editForm.hierarchyLevel07} onChange={(e) => setEditForm((f) => ({ ...f, hierarchyLevel07: e.target.value }))} />
                        ) : row.hierarchyLevel07}
                      </td>
                      {Array.from({ length: 10 }, (_, idx) => (
                        <td key={`${row.hierarchyRuleId}-${idx}`} className="py-2 pr-3">
                          {editingId === row.hierarchyRuleId ? (
                            <input
                              className="w-36 rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                              value={editForm.descriptorValues[idx]}
                              onChange={(e) =>
                                setEditForm((f) => {
                                  const next = [...f.descriptorValues];
                                  next[idx] = e.target.value;
                                  return { ...f, descriptorValues: next };
                                })
                              }
                            />
                          ) : (
                            row.descriptorValues[idx] ?? "—"
                          )}
                        </td>
                      ))}
                      <td className="py-2 pr-3 font-mono text-xs text-zinc-500">{row.hierarchyRuleId}</td>
                      <td className="py-2">
                        {editingId === row.hierarchyRuleId ? (
                          <div className="flex flex-wrap gap-2">
                            <button type="button" disabled={busy} className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900" onClick={() => void saveEdit(row.hierarchyRuleId)}>Save</button>
                            <button type="button" disabled={busy} className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600" onClick={() => setEditingId(null)}>Cancel</button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600"
                              onClick={() => {
                                setEditingId(row.hierarchyRuleId);
                                setEditForm({
                                  ruleId: String(row.ruleId),
                                  hierarchyTop: row.hierarchyTop,
                                  hierarchyMiddle: row.hierarchyMiddle,
                                  hierarchyBottom: row.hierarchyBottom,
                                  hierarchyLevel04: row.hierarchyLevel04,
                                  hierarchyLevel05: row.hierarchyLevel05,
                                  hierarchyLevel06: row.hierarchyLevel06,
                                  hierarchyLevel07: row.hierarchyLevel07,
                                  descriptorValues: Array.from({ length: 10 }, (_, idx) => row.descriptorValues[idx] ?? ""),
                                });
                              }}
                            >
                              Edit
                            </button>
                            <button type="button" disabled={busy} className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 dark:border-red-900 dark:text-red-300" onClick={() => void removeRule(row.hierarchyRuleId)}>Delete</button>
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Add hierarchy rule</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            <label className="flex flex-col gap-1 text-sm"><span className="text-zinc-500">Decision rule</span><select className="rounded-md border border-zinc-300 bg-white px-2 py-2 dark:border-zinc-600 dark:bg-zinc-950" value={createForm.ruleId} onChange={(e) => setCreateForm((f) => ({ ...f, ruleId: e.target.value }))}><option value="">Select a decision rule…</option>{rules.map((r) => <option key={r.ruleId} value={r.ruleId}>{r.decisionCode}</option>)}</select></label>
            <label className="flex flex-col gap-1 text-sm"><span className="text-zinc-500">Hierarchy top</span><input className="rounded-md border border-zinc-300 bg-white px-2 py-2 dark:border-zinc-600 dark:bg-zinc-950" value={createForm.hierarchyTop} onChange={(e) => setCreateForm((f) => ({ ...f, hierarchyTop: e.target.value }))} /></label>
            <label className="flex flex-col gap-1 text-sm"><span className="text-zinc-500">Hierarchy middle</span><input className="rounded-md border border-zinc-300 bg-white px-2 py-2 dark:border-zinc-600 dark:bg-zinc-950" value={createForm.hierarchyMiddle} onChange={(e) => setCreateForm((f) => ({ ...f, hierarchyMiddle: e.target.value }))} /></label>
            <label className="flex flex-col gap-1 text-sm"><span className="text-zinc-500">Hierarchy bottom</span><input className="rounded-md border border-zinc-300 bg-white px-2 py-2 dark:border-zinc-600 dark:bg-zinc-950" value={createForm.hierarchyBottom} onChange={(e) => setCreateForm((f) => ({ ...f, hierarchyBottom: e.target.value }))} /></label>
            <label className="flex flex-col gap-1 text-sm"><span className="text-zinc-500">Hierarchy L4</span><input className="rounded-md border border-zinc-300 bg-white px-2 py-2 dark:border-zinc-600 dark:bg-zinc-950" value={createForm.hierarchyLevel04} onChange={(e) => setCreateForm((f) => ({ ...f, hierarchyLevel04: e.target.value }))} /></label>
            <label className="flex flex-col gap-1 text-sm"><span className="text-zinc-500">Hierarchy L5</span><input className="rounded-md border border-zinc-300 bg-white px-2 py-2 dark:border-zinc-600 dark:bg-zinc-950" value={createForm.hierarchyLevel05} onChange={(e) => setCreateForm((f) => ({ ...f, hierarchyLevel05: e.target.value }))} /></label>
            <label className="flex flex-col gap-1 text-sm"><span className="text-zinc-500">Hierarchy L6</span><input className="rounded-md border border-zinc-300 bg-white px-2 py-2 dark:border-zinc-600 dark:bg-zinc-950" value={createForm.hierarchyLevel06} onChange={(e) => setCreateForm((f) => ({ ...f, hierarchyLevel06: e.target.value }))} /></label>
            <label className="flex flex-col gap-1 text-sm"><span className="text-zinc-500">Hierarchy L7</span><input className="rounded-md border border-zinc-300 bg-white px-2 py-2 dark:border-zinc-600 dark:bg-zinc-950" value={createForm.hierarchyLevel07} onChange={(e) => setCreateForm((f) => ({ ...f, hierarchyLevel07: e.target.value }))} /></label>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 10 }, (_, idx) => (
              <label key={`create-desc-${idx}`} className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-500">Descriptor {String(idx + 1).padStart(2, "0")}</span>
                <input
                  className="rounded-md border border-zinc-300 bg-white px-2 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                  value={createForm.descriptorValues[idx]}
                  onChange={(e) =>
                    setCreateForm((f) => {
                      const next = [...f.descriptorValues];
                      next[idx] = e.target.value;
                      return { ...f, descriptorValues: next };
                    })
                  }
                />
              </label>
            ))}
          </div>

          <button type="button" disabled={busy} className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900" onClick={() => void createRule()}>
            Create rule
          </button>
        </section>
      </main>
    </div>
  );
}


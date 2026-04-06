# Case study: In-database semantic layer and rule scoring

This document is the **production and organizational** narrative (problem, constraints, scale, integrations). For **runnable SQL**, **sample inputs/outputs**, and the **linear-algebra / argmax-gate primer**, start with the repo [`README.md`](../README.md).

## Summary

Business users had built a **spreadsheet farm** to cleanse, enrich, and aggregate upstream feeds. Much of the “expert knowledge” lived in spreadsheets or in analysts’ heads. Reporting still depended heavily on a **legacy database-centric** system that was trusted and slow to replace. The goal was to give users a **maintainable semantic layer** (dimensions and labels they owned) while **merging that metadata with daily observations inside the database** so existing reporting pipelines could consume enriched rows without a big-bang rewrite.

## Problem

- Junior analysts spent large amounts of time on **manual data wrangling**.
- **User-defined metadata** had to be reflected **in real time** in queries (daily upstream refresh + live edits to rules/labels).
- The **observation table was large and heavily queried**; enrichment could not afford to scan the world or fight the optimizer on every report.

## Approach (high level)

1. **Semantic layer in the database + services + UI**  
   Experts create and maintain dimensions and descriptor values through a web UI; data is stored relationally and exposed via APIs (and optionally Excel/Power Query as a thin client).

2. **In-database scoring and enrichment**  
   User-maintained **rules** and **descriptor columns** (the “white” semantic fields) were combined with daily **observations** inside SQL: qualitative fields were **kernelized** to a fixed binary feature dictionary, **expert weights** formed rows of a matrix $K$, scores were **linear** in those features, outcomes were chosen with **argmax** (plus **waterfall / tie precedence** in production), and results were reshaped (**wide scores → `UNPIVOT`**) so consumers received **one enriched row per observation**.  

   **Formal notation** ($s_{ij}=\langle k_i,d_j\rangle$, problem class vs LP/QP, gate semantics), **reproducibility**, and a **worked numeric example** live in [`README.md`](../README.md) so this file stays focused on context and operations.

## Constraints and non-goals

- **Legacy reporting stayed in SQL** for a long time; the solution had to **meet the database where it was**, not only in an app tier.
- **Read replicas and limited write permissions** influenced use of **table-valued parameters**, **staged temp tables**, and **explicit contracts** (e.g., table-valued functions requiring key parameters) instead of a single monolithic view that filtered only at the end.
- **Security:** User-maintained strings are a **SQL injection** surface; validation and **`QUOTENAME`-style** defenses were part of the design.

## Performance themes

- **Shrink work early:** TVF (or equivalent) **requires** selective keys so the engine can use **indexes** on the large observation table instead of enriching everything.
- **Avoid expensive string logic on hot paths** where possible; preprocessing to **numeric/binary** features and keeping UNPIVOT column names **short** reduced string comparison cost.
- **Staging + indexes on intermediate results** inside the pipeline beat one giant CTE-only view when the planner could not push predicates effectively.

## Integrations

- **Enterprise GraphQL** for federated access.
- **Power BI** and **Excel (Power Query)** for analyst workflows.

## Lessons (still relevant)

- **Separating** “small, expert-maintained rule set” from “huge observation stream” drives the **kernelization + matrix-style** join pattern.
- **Contract-first access** (required parameters, typed TVPs) is a lever for **performance and safety** on shared fact tables.
- The same pipeline pattern can support other **post-score actions** (not only max/waterfall), e.g., diagnostics or drift-style checks, with different output layers.
- Framing scores as a **linear layer** and the decision as **argmax** communicates quickly to ML-literate stakeholders—while keeping clear that **$K$ is curated**, not gradient-learned.

## Reference

Public article describing the original system: [Building a Semantic Layer Using AI](https://dispassionatedeveloper.blogspot.com/2020/04/building-sql-based-expert-system-for.html).

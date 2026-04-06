# Semantic layer + SQL expert system (portfolio)

This repository is a **public, synthetic** companion to a production system I designed and built at a former employer. It documents architecture and tradeoffs and ships a **small runnable SQL demo** whose pipeline—**kernelization**, **variable / subject space** views, **linear scores**, **`UNPIVOT` / `LATERAL VALUES`**, **argmax gating**, **`ENRICHED_OBSERVATION_ROW`**—is spelled out in **How the scoring engine works** (linear algebra, logic gate, limitations, reproduction).

**Original write-up (2019 context, published 2020):** [Building a Semantic Layer Using AI](https://dispassionatedeveloper.blogspot.com/2020/04/building-sql-based-expert-system-for.html)

## What this repo is for

- **Interview narrative:** Production context, constraints, performance, integrations, and lessons in `docs/case-study.md` (this README holds the **technical primer**, **worked example**, and quick starts).
- **Technical proof of familiarity:** You can run the demo locally and step through the SQL.
- **Not a reproduction:** No proprietary schemas, data, or code from the employer.

## How the scoring engine works

### Stakeholder view (what each “run” decides)

For every **observation** in scope, the engine **chooses exactly one subject option** (outcome) from a finite catalog and **attaches that outcome’s descriptor fields** (queue, SLA, cost center, etc.). The **inputs** are the raw qualitative attributes plus the **expert-maintained** rule weights and enrichment rows. The **output** is the same grain as the feed—**one enriched row per observation**—so downstream SQL reports and BI tools can consume it without a separate scoring API.

**Separated for clarity (facts vs policy vs math):**

- **Data / structure (facts in the demo):** Kernelization maps text fields into a **fixed** list of binary features. Matrix $K$ holds **non-negative** weights $k_{im}$ on those features for each outcome $i$; demo rows are **normalized** ($\sum_m k_{im}=1$) so per-outcome scores sit on a comparable scale.
- **Business policy (declared, not learned):** The winning outcome is the one with the **highest score**; **ties** resolve by a **fixed ordering** on outcome id (`rule_id` in SQL). Production also used precedence “waterfall” rules—see `docs/case-study.md`.
- **What is *not* decided here:** Continuous allocation, budgets, or solver-tuned decision vectors; there is **no** numerical optimization over a free $x\in\mathbb{R}^n$ in this pattern.

### Technical primer: linear algebra and the argmax gate

**Notation.** $M$ = number of atomic binary features after kernelization. $N$ = number of outcomes (subject options). For observation $j$, let $d_j \in \{0,1\}^M$ be the feature vector (stored sparsely in SQL). For outcome $i$, let $k_i \in \mathbb{R}^M$ be the weight vector (zeros implied on features absent from `demo_rule_weights`).

**Linear score.** The score of outcome $i$ against observation $j$ is the standard inner product

$$
s_{ij} = \langle k_i, d_j \rangle = \sum_{m=1}^M k_{im}\, d_{jm}.
$$

Because $d_{jm}\in\{0,1\}$, only **active** features contribute—this is the sparse dot product implemented with joins and `SUM` in the scripts. Up to matrix layout, the full block of scores is $S = K D$, with columns of $D$ equal to the $d_j$ (or equivalently $K D^\top$ if observations are rows; same algebra).

**Wide scores and `UNPIVOT`.** For each observation $j$, the vector $(s_{1j},\ldots,s_{Nj})^\top$ is one column of that product. The demo materializes it as **wide** columns (`score_a`, `score_b`, `score_c` / `a`, `b`, `c`) so **T-SQL `UNPIVOT`** (or **PostgreSQL `LATERAL VALUES`**) can emit **long** rows `(outcome slot, score)`—the reshape step described in the original post before joining metadata.

**Logic gate (hard max).** The discrete decision is

$$
i^\star(j) \in \arg\max_{i=1,\ldots,N} s_{ij},
$$

with a **deterministic tie-break** among argmax ties (smallest `rule_id` in the demo). That is **winner-take-all gating**: no softmax, no temperature, **no gradient-based learning** of $K$ in this artifact. If you treat $(s_{1j},\ldots,s_{Nj})$ as **logits**, this matches **one linear layer + argmax**—frozen weights, expert-curated.

**Problem class (precision).** This is **not** LP, QP, or MILP in the sense of optimizing a continuous or mixed-integer decision $x$ subject to constraints. The mathematics is **linear functionals** of fixed binary $d_j$ plus **discrete maximization** over a **finite** label set—fast to evaluate and easy to audit, at the cost of no built-in uncertainty quantification.

### Reproducibility

- **Fixture:** `sql/postgres/demo.sql` or `sql/sqlserver/demo.sql` (all data in-script).
- **Command:** Run the **Quick start** sections below for PostgreSQL or SQL Server.
- **Main result to check:** final grid **`ENRICHED_OBSERVATION_ROW`** (and optionally **`UNPIVOT_LONG`**).

### Limitations (negative space)

- Scores $s_{ij}$ are **not** claimed to be calibrated probabilities; interpreting them across tickets requires an explicit business definition.
- **Kernelization** and $K$ must stay in sync; errors are **governance / data-quality** failures, not detected by the score formula.
- This repo does **not** reproduce production **scale** mechanics (indexed TVFs, staging on read replicas, etc.); those are described in `docs/case-study.md`.

## Repository layout

| Path | Purpose |
|------|--------|
| `docs/case-study.md` | Production / org narrative: problem, approach summary, constraints, performance, integrations, lessons; defers equations and demo tables to this README |
| `sql/postgres/demo.sql` | End-to-end toy example (PostgreSQL) |
| `sql/sqlserver/demo.sql` | Same idea, T-SQL flavored (closer to the original post) |

## Worked example (what the demo is doing)

The script uses a **fictional support-routing** domain. You can read the **inputs** in the `INSERT` statements, run the file, and match the last result set **`ENRICHED_OBSERVATION_ROW`** to the tables below.

### Inputs: observations (raw qualitative feed)

These rows are the **observations**—what might arrive from an upstream feed **before** any routing metadata exists:

| ticket_ref | tier       | region | priority |
|------------|------------|--------|----------|
| TK-1001    | enterprise | na     | high     |
| TK-1002    | standard   | emea   | normal   |
| TK-1003    | standard   | na     | normal   |

### Inputs: subject options (decisions + semantic descriptors)

Each **subject option** is a possible routing outcome (`decision_code`) plus **user-maintained** descriptor columns (queues, SLA, cost center), analogous to the “white” semantic columns in the original UI:

| decision_code        | routing_queue   | sla_bucket | cost_center |
|----------------------|-----------------|------------|-------------|
| team_platform        | PLAT-CRITICAL   | P1         | CC-900      |
| team_regional_na     | NA-GENERAL      | P3         | CC-100      |
| team_regional_emea   | EMEA-GENERAL    | P3         | CC-200      |

Experts also define **weights** over shared **atomic features** (e.g. `tier_enterprise`, `region_na`) so each team gets a numeric score against every ticket. The demo **kernelizes** the text columns into those binary features before scoring.

### Output: observations enriched with the best subject’s descriptors

The pipeline scores **every observation against every rule** (zeros when there is no feature overlap), takes **argmax**, then joins the **winning** row’s descriptors. Result set **`ENRICHED_OBSERVATION_ROW`** is **one row per ticket** with raw fields, wide scores for rules 1–3 (`score_a`, `score_b`, `score_c`), the winner, and the chosen descriptors:

| ticket_ref | tier       | region | priority | score_a | score_b | score_c | winning_team           | winning_score | routing_queue   | sla_bucket | cost_center |
|------------|------------|--------|----------|---------|---------|---------|------------------------|---------------|-----------------|------------|-------------|
| TK-1001    | enterprise | na     | high     | 1.00    | 0.60    | 0.00    | team_platform          | 1.00          | PLAT-CRITICAL   | P1         | CC-900      |
| TK-1002    | standard   | emea   | normal   | 0.00    | 0.40    | 1.00    | team_regional_emea     | 1.00          | EMEA-GENERAL    | P3         | CC-200      |
| TK-1003    | standard   | na     | normal   | 0.00    | 1.00    | 0.40    | team_regional_na       | 1.00          | NA-GENERAL      | P3         | CC-100      |

In short: **TK-1001** (enterprise, NA, high) goes to **platform** and picks up **PLAT-CRITICAL / P1 / CC-900**; **TK-1002** (standard, EMEA) goes to **EMEA-GENERAL**; **TK-1003** (standard, NA) goes to **NA-GENERAL**. Earlier result sets in the same script (`VARIABLE_SPACE_*`, `UNPIVOT_LONG`, etc.) show the geometry and the UNPIVOT step; this table is the **consumer-shaped** outcome.

## Quick start (PostgreSQL)

```bash
# From repo root — adjust connection flags for your environment
psql -U postgres -d postgres -f sql/postgres/demo.sql
```

## Quick start (SQL Server)

```bash
sqlcmd -S . -d master -i sql/sqlserver/demo.sql
```

## After you create a GitHub remote

```bash
cd semantic-layer-sql-expert-system
git init
git add .
git commit -m "Initial commit: case study and synthetic SQL demos"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

If you **already created an empty repo on GitHub**, clone it into this folder’s parent and copy these files in, or add `origin` as above.

**Git author:** If the first commit used placeholder `user.name` / `user.email` (local to this repo only), set your real identity and fix the author:

```bash
git config user.name "Your Name"
git config user.email "you@example.com"
git commit --amend --reset-author --no-edit
```

## Tags

Semantic layer, expert / rules engine, decision automation, linear scoring, SQL (PostgreSQL, T-SQL), data engineering, in-database enrichment, portfolio / interview artifact.

## License

Content and demo SQL are provided for portfolio use; adapt as you see fit.

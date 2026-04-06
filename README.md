# Semantic layer + SQL expert system (portfolio)

**Demo domain:** **Aladdin-style fixed income reference data**—each observation is a **synthetic security** (fabricated ISIN + issuer class, region, rating band). Workstream outcomes (`ald_sov_rates_na`, `ald_corp_credit_na`, `ald_corp_credit_emea`) stand in for analytics/ops routing. *Aladdin® is a registered trademark of BlackRock, Inc.; this project is **not** affiliated with BlackRock and uses **no** vendor or production data.*

This repository is a **public, synthetic** companion to a production system I designed and built at a former employer. It documents architecture and tradeoffs and ships runnable SQL that implements the full pipeline—**kernelization**, **variable / subject space** views, **linear scores**, **`UNPIVOT` / `LATERAL VALUES`**, **argmax gating**, **`ENRICHED_OBSERVATION_ROW`**—on that FI-shaped sample. Formalism is in **How the scoring engine works**; sample I/O is in **Worked example** and **Demo data model**.

**Original write-up (2019 context, published 2020):** [Building a Semantic Layer Using AI](https://dispassionatedeveloper.blogspot.com/2020/04/building-sql-based-expert-system-for.html)

## What this repo is for

- **Interview narrative:** Production context, constraints, performance, integrations, and lessons in `docs/case-study.md` (this README holds the **Aladdin-style FI demo**, **technical primer**, **worked example**, and quick starts).
- **Technical proof of familiarity:** Run the SQL scripts end-to-end; every result set is labeled (`VARIABLE_SPACE_*`, `SUBJECT_SPACE_BY_ISIN`, `ENRICHED_OBSERVATION_ROW`, etc.).
- **Not a reproduction:** No proprietary schemas, data, or code from the employer; ISINs and attributes are **fabricated** for pedagogy.

## How the scoring engine works

### Stakeholder view (what each “run” decides)

For every **security** in scope (one row in the reference-style feed), the engine **chooses exactly one subject option**—here, an **analytics / operations workstream**—from a finite catalog and **attaches that outcome’s descriptor fields** (routing queue, SLA bucket, book / cost-center tag). The **inputs** are qualitative **security-master-style** attributes (e.g. ISIN, issuer class, region, rating band) plus **expert-maintained** rule weights and enrichment rows. The **output** is **one enriched row per security**, same grain as the instrument feed, so risk, performance, and data teams can join results in SQL, Power BI, or downstream Aladdin-adjacent reporting without a separate scoring tier.

**Separated for clarity (facts vs policy vs math):**

- **Data / structure (facts in the demo):** Kernelization maps FI reference text (issuer class, region, rating band) into a **fixed** list of binary features (`fi_sovereign`, `fi_corporate`, `region_*`, `rating_ig`, …). Matrix $K$ holds **non-negative** weights $k_{im}$ on those features for each workstream $i$; demo rows are **normalized** ($\sum_m k_{im}=1$) so per-outcome scores sit on a comparable scale.
- **Business policy (declared, not learned):** The winning outcome is the one with the **highest score**; **ties** resolve by a **fixed ordering** on outcome id (`rule_id` in SQL). Production also used precedence “waterfall” rules—see `docs/case-study.md`.
- **What is *not* decided here:** Continuous allocation, budgets, or solver-tuned decision vectors; there is **no** numerical optimization over a free $x\in\mathbb{R}^n$ in this pattern.

### Technical primer: linear algebra and the argmax gate

**Notation.** $M$ = number of atomic binary features after kernelization. $N$ = number of outcomes (subject options / workstreams). For observation $j$ (e.g. one security in the demo), let $d_j \in \{0,1\}^M$ be the feature vector (stored sparsely in SQL). For outcome $i$, let $k_i \in \mathbb{R}^M$ be the weight vector (zeros implied on features absent from `demo_rule_weights`).

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

- **Fixture:** `sql/postgres/demo.sql` or `sql/sqlserver/demo.sql` (three **synthetic** FI securities, three **Aladdin-style** workstreams, all `INSERT`s in-script).
- **Command:** Run the **Quick start** sections below for PostgreSQL or SQL Server.
- **Main result to check:** final grid **`ENRICHED_OBSERVATION_ROW`** (security + chosen workstream + queue / SLA / book); optionally **`UNPIVOT_LONG`** and **`SUBJECT_SPACE_BY_ISIN`**.

### Limitations (negative space)

- Scores $s_{ij}$ are **not** claimed to be calibrated probabilities; interpreting them across securities or portfolios requires an explicit business definition.
- **Kernelization** and $K$ must stay in sync; errors are **governance / data-quality** failures, not detected by the score formula.
- This repo does **not** reproduce production **scale** mechanics (indexed TVFs, staging on read replicas, etc.); those are described in `docs/case-study.md`.

## Repository layout

| Path | Purpose |
|------|--------|
| `docs/case-study.md` | Production / org narrative; ties original system to this repo’s **Aladdin-style FI** portfolio demo |
| `sql/postgres/demo.sql` | End-to-end **Aladdin-style FI** reference demo (PostgreSQL; synthetic ISINs) |
| `sql/sqlserver/demo.sql` | Same pipeline, T-SQL (closer to the original SQL Server post) |
| `scripts/render_readme_preview.py` | Optional: `README.md` → `README.preview.html` for local viewing |

## Demo data model (Aladdin-style, synthetic)

| Layer | Contents |
|-------|-----------|
| **Raw observation** | `isin`, `issuer_class` (sovereign / corporate), `region` (na / emea), `rating_band` (ig / core)—shaped like fields you might join from a **security master** or FI reference extract, not a live Aladdin export. |
| **Kernelized features** | Sparse 0/1 atoms: `fi_sovereign`, `fi_corporate`, `region_emea`, `region_na`, `rating_ig`. |
| **Outcomes ($K$ rows)** | Workstreams: sovereign rates (NA), corporate credit (NA), corporate credit (EMEA)—each with `routing_queue`, `sla_bucket`, `cost_center` enrichment. |
| **Deliverable** | **`ENRICHED_OBSERVATION_ROW`**: one row per ISIN with raw attributes, wide scores `a/b/c`, `winning_workstream`, and attached operational metadata. |

## Worked example (what the demo is doing)

The script uses **three synthetic fixed income instruments** with qualitative fields similar to a **security-master / Aladdin-style FI reference** slice (ISIN-like id, issuer class, trading region, broad rating bucket). **ISINs are fabricated** (`…ALDIN…` pattern); they are **not** live instruments and **not** from any vendor feed. *Aladdin® is a registered trademark of BlackRock, Inc.; this repo is independent and for illustration only.*

Read the **inputs** in the `INSERT` statements, run the file, and match the last result set **`ENRICHED_OBSERVATION_ROW`** to the tables below.

### Inputs: observations (raw qualitative feed)

These rows are the **observations**—what might arrive from an upstream reference or analytics feed **before** workstream-specific enrichment is applied:

| isin            | issuer_class | region | rating_band |
|-----------------|----------------|--------|-------------|
| US00ALDINFI01   | sovereign      | na     | ig          |
| DE00ALDINFI02   | corporate      | emea   | core        |
| US00ALDINFI03   | corporate      | na     | core        |

### Inputs: subject options (decisions + semantic descriptors)

Each **subject option** is a possible **analytics / operations workstream** (`decision_code`) plus **user-maintained** descriptor columns (queue, SLA tier, book attribution), analogous to the “white” semantic columns in the original UI:

| decision_code          | routing_queue      | sla_bucket  | cost_center      |
|------------------------|--------------------|-------------|------------------|
| ald_sov_rates_na       | SOV-RATES-NA       | T+0_CLOSE   | BOOK_NA_GOVT     |
| ald_corp_credit_na     | CORP-CREDIT-NA     | T+1_STD     | BOOK_NA_CREDIT   |
| ald_corp_credit_emea   | CORP-CREDIT-EMEA   | T+1_STD     | BOOK_EMEA_CREDIT |

Experts also define **weights** over shared **atomic features** (`fi_sovereign`, `fi_corporate`, `region_na`, `region_emea`, `rating_ig`) so each workstream gets a numeric score against every security. The demo **kernelizes** the text columns into those binary features before scoring.

### Output: observations enriched with the best subject’s descriptors

The pipeline scores **every observation against every rule** (zeros when there is no feature overlap), takes **argmax**, then joins the **winning** row’s descriptors. Result set **`ENRICHED_OBSERVATION_ROW`** is **one row per security** with raw fields, wide scores for rules 1–3 (`score_a`, `score_b`, `score_c`), the winner (`winning_workstream`), and the chosen descriptors:

| isin            | issuer_class | region | rating_band | score_a | score_b | score_c | winning_workstream     | winning_score | routing_queue      | sla_bucket  | cost_center       |
|-----------------|--------------|--------|-------------|---------|---------|---------|------------------------|---------------|--------------------|-------------|-------------------|
| US00ALDINFI01   | sovereign    | na     | ig          | 1.00    | 0.60    | 0.00    | ald_sov_rates_na       | 1.00          | SOV-RATES-NA       | T+0_CLOSE   | BOOK_NA_GOVT      |
| DE00ALDINFI02   | corporate    | emea   | core        | 0.00    | 0.40    | 1.00    | ald_corp_credit_emea   | 1.00          | CORP-CREDIT-EMEA   | T+1_STD     | BOOK_EMEA_CREDIT  |
| US00ALDINFI03   | corporate    | na     | core        | 0.00    | 1.00    | 0.40    | ald_corp_credit_na     | 1.00          | CORP-CREDIT-NA     | T+1_STD     | BOOK_NA_CREDIT    |

In short: the **US sovereign IG NA** name routes to **sovereign rates (NA)**; the **EMEA corporate** name to **corporate credit (EMEA)**; the **US corporate** name to **corporate credit (NA)**. Earlier result sets in the same script (`VARIABLE_SPACE_*`, `SUBJECT_SPACE_BY_ISIN`, `UNPIVOT_LONG`, etc.) show the geometry and the UNPIVOT step; this table is the **consumer-shaped** outcome.

## Quick start (PostgreSQL)

```bash
# From repo root — Aladdin-style FI demo (synthetic ISINs); adjust connection flags
psql -U postgres -d postgres -f sql/postgres/demo.sql
```

## Quick start (SQL Server)

```bash
# Same demo as PostgreSQL; T-SQL + temp tables
sqlcmd -S . -d master -i sql/sqlserver/demo.sql
```

### Preview this README in a browser (GitHub-like)

Opening `README.md` directly in a browser usually shows **plain text**. On **GitHub**, the same file is rendered automatically on the repository home page. To preview locally: `pip install markdown`, then `python scripts/render_readme_preview.py`, then open **`README.preview.html`** (generated next to `README.md`; listed in `.gitignore`).

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

Semantic layer, expert / rules engine, fixed income reference data, decision automation, linear scoring, SQL (PostgreSQL, T-SQL), data engineering, in-database enrichment, portfolio / interview artifact.

## License

Content and demo SQL are provided for portfolio use; adapt as you see fit. **Demo securities and Aladdin-style naming are illustrative only** and imply no relationship to BlackRock or to any live instrument or data product.

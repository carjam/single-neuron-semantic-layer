# Semantic layer + SQL expert system (portfolio)

**Problem the demo illustrates:** Aladdin (and similar platforms) ship each security with a **vendor classification hierarchy**. **Fund managers** often need a **parallel, fund-specific taxonomy** so they can **aggregate and compare** names that vendor metadata would keep in separate buckets—without perpetual **manual munging** in spreadsheets. The original system gave them an **interactive semantic layer**: at whatever **hierarchy level** they chose (issuer type, region, rating bucket, …), they could record an **override value** that **takes precedence** over the vendor field when scoring, reporting, and routing.

**Demo domain:** **Synthetic** fixed income rows shaped like a security-master extract: **`ald_*`** columns mimic vendor reference data; nullable **`fund_*_override`** columns mimic PM-maintained semantics. **Effective** attributes are `COALESCE(non-blank override, ald_*)` before **kernelization**. Workstream outcomes (`ald_sov_rates_na`, …) stand in for analytics/ops routing. *Aladdin® is a registered trademark of BlackRock, Inc.; this project is **not** affiliated with BlackRock and uses **no** vendor or production data.*

This repository is a **public, synthetic** companion to a production system I designed and built at a former employer. It documents architecture and tradeoffs and ships runnable SQL—**kernelization** on **effective** classifications, **variable / subject space**, **linear scores**, **`UNPIVOT` / `LATERAL VALUES`**, **argmax**, **`ENRICHED_OBSERVATION_ROW`**—including a **fund region override** on one US corporate that rebooks it from **NA** to **EMEA** for scoring. Formalism is in **How the scoring engine works**; sample I/O is in **Worked example** and **Demo data model**.

**Original write-up (2019 context, published 2020):** [Building a Semantic Layer Using AI](https://dispassionatedeveloper.blogspot.com/2020/04/building-sql-based-expert-system-for.html)

## What this repo is for

- **Interview narrative:** Production context, constraints, performance, integrations, and lessons in `docs/case-study.md` (this README holds the **Aladdin-style FI demo**, **technical primer**, **worked example**, and quick starts).
- **Technical proof of familiarity:** Run the SQL scripts end-to-end; every result set is labeled (`VARIABLE_SPACE_*`, `SUBJECT_SPACE_BY_ISIN`, `ENRICHED_OBSERVATION_ROW`, etc.).
- **Not a reproduction:** No proprietary schemas, data, or code from the employer; ISINs and attributes are **fabricated** for pedagogy.

## How the scoring engine works

### Stakeholder view (what each “run” decides)

For every **security** in scope, the engine **chooses exactly one subject option**—here, an **analytics / operations workstream**—and **attaches that outcome’s descriptor fields** (routing queue, SLA bucket, book tag). **Inputs** combine **vendor reference** (`ald_*`) with optional **fund overrides** (`fund_*_override`) maintained in the semantic layer UI; **scoring uses the effective hierarchy** after overrides. The **output** is **one enriched row per security** (vendor columns, optional overrides, and **computed effective** values used for scoring), so PMs can **aggregate on their taxonomy** while preserving lineage to Aladdin-classified data for audit and reconciliation.

**Separated for clarity (facts vs policy vs math):**

- **Data / structure (facts in the demo):** For each dimension, **effective value** = non-blank **fund override** if set, else **`ald_*` vendor value**. Kernelization maps those **effective** labels into a **fixed** binary feature dictionary (`fi_sovereign`, `fi_corporate`, `region_*`, `rating_ig`, …). Matrix $K$ holds **non-negative** weights $k_{im}$ for each workstream $i$; rows are **normalized** ($\sum_m k_{im}=1$). In production, users chose **which level** of the hierarchy to override and **what value** to apply; the SQL demo fixes three dimensions (issuer, region, rating band) for clarity.
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

- **Fixture:** `sql/postgres/demo.sql` or `sql/sqlserver/demo.sql` (three **synthetic** FI rows with **`ald_*` + `fund_*_override`**, three workstreams, all `INSERT`s in-script).
- **Command:** Run the **Quick start** sections below for PostgreSQL or SQL Server.
- **Main result to check:** final grid **`ENRICHED_OBSERVATION_ROW`** (security + chosen workstream + queue / SLA / book); optionally **`UNPIVOT_LONG`** and **`SUBJECT_SPACE_BY_ISIN`**.

### Limitations (negative space)

- Scores $s_{ij}$ are **not** claimed to be calibrated probabilities; interpreting them across securities or portfolios requires an explicit business definition.
- **Kernelization** and $K$ must stay in sync; **overrides** need **governance** (who can change vendor-effective classification, how conflicts with risk or compliance are reviewed)—errors are operational, not caught by the score formula alone.
- This repo does **not** reproduce production **scale** mechanics (indexed TVFs, staging on read replicas, etc.); those are described in `docs/case-study.md`.

## Repository layout

| Path | Purpose |
|------|--------|
| `docs/case-study.md` | Production / org narrative; ties original system to this repo’s **Aladdin-style FI** portfolio demo |
| `sql/postgres/demo.sql` | End-to-end **Aladdin-style FI** reference demo (PostgreSQL; synthetic ISINs) |
| `sql/sqlserver/demo.sql` | Same pipeline, T-SQL (closer to the original SQL Server post) |
| `scripts/render_readme_preview.py` | Optional: `README.md` → `README.preview.html` for local viewing |

## Demo data model (Aladdin-style vendor + fund overrides, synthetic)

| Layer | Contents |
|-------|-----------|
| **Vendor reference (`ald_*`)** | Mimics platform hierarchy: `ald_issuer_class`, `ald_region`, `ald_rating_band` (values like sovereign / corporate, na / emea, ig / core). |
| **Fund semantic layer (`fund_*_override`)** | Nullable per column; when **non-blank**, replaces the corresponding `ald_*` for **scoring only** (vendor columns remain in the enriched output for lineage). |
| **Effective (implicit)** | `COALESCE(NULLIF(TRIM(override), ''), ald_value)` per dimension—this is what **kernelization** sees. |
| **Kernelized features** | Sparse 0/1 atoms over **effective** labels: `fi_sovereign`, `fi_corporate`, `region_emea`, `region_na`, `rating_ig`. |
| **Outcomes ($K$ rows)** | Workstreams: sovereign rates (NA), corporate credit (NA), corporate credit (EMEA)—each with `routing_queue`, `sla_bucket`, `cost_center`. |
| **Deliverable** | **`ENRICHED_OBSERVATION_ROW`**: `ald_*`, `fund_*_override`, **`effective_*`**, scores, `winning_workstream`, operational metadata. |

## Worked example (Aladdin-style FI data + fund overrides)

The SQL loads **three synthetic** fixed income rows: each has **vendor (`ald_*`)** reference attributes and optional **`fund_*_override`** values maintained by the fund (semantic layer). **Kernelization** uses **effective** = override when non-blank, else vendor. **ISINs are fabricated** (`…ALDIN…`). *Aladdin® is a registered trademark of BlackRock, Inc.; this repo is independent and for illustration only.*

Match the **`INSERT` into `demo_observations`** and **`ENRICHED_OBSERVATION_ROW`** to the tables below.

### Inputs: vendor hierarchy vs fund overrides

Illustrative layout: **Aladdin-classified** columns plus **fund** columns (same names as `demo_observations`). *Description / asset type / ccy* are **README-only** context.

| isin | illustrative name | asset type | **ald_issuer_class** | **fund_issuer_class_override** | **ald_region** | **fund_region_override** | **ald_rating_band** | **fund_rating_band_override** |
|------|-------------------|------------|----------------------|--------------------------------|----------------|---------------------------|---------------------|-------------------------------|
| US00ALDINFI01 | US Treasury note (synthetic) | Govt | sovereign | *(none)* | na | *(none)* | ig | *(none)* |
| DE00ALDINFI02 | EUR corporate note (synthetic) | Corp | corporate | *(none)* | emea | *(none)* | core | *(none)* |
| US00ALDINFI03 | US corporate bond (synthetic) | Corp | corporate | *(none)* | na | **`emea`** | core | *(none)* |

**Row 3 story:** Aladdin still books the name in **North America** (`ald_region = na`), but the fund sets **`fund_region_override = emea`** so—**for internal aggregation and workstream routing**—it is treated like an **EMEA corporate** (e.g. to align with a sleeve or mandate view) **without editing the vendor feed**.

- **Effective for scoring:** row 3 behaves as **corporate + emea + core** → same feature vector as row 2 → **corporate credit (EMEA)** wins.
- **`rating_band` = `core`:** no `rating_ig` bit in this toy; not a literal Aladdin enum.

### Inputs: subject options (workstreams + semantic “white columns”)

Each row is a candidate **downstream workstream**—similar to attaching an **operations / analytics queue** and **book** in a semantic layer. `decision_code` is the key joined after **argmax**.

| decision_code (system key) | Aladdin-style workstream label | routing_queue | sla_bucket | cost_center (book tag) |
|----------------------------|--------------------------------|---------------|------------|-------------------------|
| `ald_sov_rates_na` | Sovereign & rates — North America | SOV-RATES-NA | T+0_CLOSE | BOOK_NA_GOVT |
| `ald_corp_credit_na` | Corporate credit — North America | CORP-CREDIT-NA | T+1_STD | BOOK_NA_CREDIT |
| `ald_corp_credit_emea` | Corporate credit — EMEA | CORP-CREDIT-EMEA | T+1_STD | BOOK_EMEA_CREDIT |

Experts also maintain **$K$**: non-negative weights on `fi_sovereign`, `fi_corporate`, `region_*`, `rating_ig` (row-normalized in the script). The engine **kernelizes** each security row, computes scores, **UNPIVOT**-style reshapes wide scores (`a`/`b`/`c`), then applies **argmax** (tie-break on `rule_id`).

### Output: enriched rows (vendor + overrides + effective + winner)

**`ENRICHED_OBSERVATION_ROW`** mirrors the SQL: full **`ald_*` / `fund_*`**, computed **`effective_*`** (what was kernelized), scores, and workstream metadata. *Illustrative name* omitted from the query.

| isin | ald_region | fund_region_override | effective_region | effective_issuer | effective_rating | score_a | score_b | score_c | winning_workstream | winning_score | routing_queue |
|------|------------|----------------------|------------------|------------------|------------------|---------|---------|---------|---------------------|---------------|---------------|
| US00ALDINFI01 | na | | na | sovereign | ig | 1.00 | 0.60 | 0.00 | `ald_sov_rates_na` | 1.00 | SOV-RATES-NA |
| DE00ALDINFI02 | emea | | emea | corporate | core | 0.00 | 0.40 | 1.00 | `ald_corp_credit_emea` | 1.00 | CORP-CREDIT-EMEA |
| US00ALDINFI03 | na | emea | **emea** | corporate | core | 0.00 | 0.40 | 1.00 | **`ald_corp_credit_emea`** | 1.00 | **CORP-CREDIT-EMEA** |

**Readout:** Treasury **NA** **IG** → sovereign-rates NA. **DE corporate EMEA** → corporate credit EMEA. **US corporate** with **fund region override to EMEA** → **same queue as DE** (aggregation path aligned), even though Aladdin still shows **NA** geography—**no spreadsheet munging** required to compare the two names on the fund’s basis. Full output also includes `sla_bucket`, `cost_center`, and the remaining `ald_*` / `fund_*` columns. Earlier result sets (`VARIABLE_SPACE_*`, `SUBJECT_SPACE_BY_ISIN`, `UNPIVOT_LONG`, …) show the linear-algebra layout.

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

Semantic layer, classification override, vendor vs fund taxonomy, fixed income reference data, expert / rules engine, decision automation, linear scoring, SQL (PostgreSQL, T-SQL), data engineering, in-database enrichment, portfolio / interview artifact.

## License

Content and demo SQL are provided for portfolio use; adapt as you see fit. **Demo securities and Aladdin-style naming are illustrative only** and imply no relationship to BlackRock or to any live instrument or data product.

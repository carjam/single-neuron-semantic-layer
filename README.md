# Semantic layer + SQL expert system (portfolio)

This repository is a **public, synthetic** companion to a production system I designed and built at a former employer. It documents the architecture and tradeoffs and includes a **small runnable SQL demo**: **kernelization** of qualitative fields into sparse binary features, **variable space** ($D$ and $K$ as rows in shared $\mathbb{R}^M$), **subject space** (transpose: features × observations), then sparse inner products and a winning decision.

**Original write-up (2019 context, published 2020):** [Building a Semantic Layer Using AI](https://dispassionatedeveloper.blogspot.com/2020/04/building-sql-based-expert-system-for.html)

## What this repo is for

- **Interview narrative:** Problem, constraints, design, and lessons in one place (`docs/case-study.md`).
- **Technical proof of familiarity:** You can run the demo locally and step through the SQL.
- **Not a reproduction:** No proprietary schemas, data, or code from the employer.

## Repository layout

| Path | Purpose |
|------|--------|
| `docs/case-study.md` | Case study: context, design, performance, integrations |
| `sql/postgres/demo.sql` | End-to-end toy example (PostgreSQL) |
| `sql/sqlserver/demo.sql` | Same idea, T-SQL flavored (closer to the original post) |

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

## License

Content and demo SQL are provided for portfolio use; adapt as you see fit.

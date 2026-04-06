# Web demo (Next.js)

This folder is the **toy UI** for the portfolio project: hierarchy-rule CRUD (wildcards + up to 10 descriptors), enriched grid, and OpenAPI docs.

**Setup, scoring behavior, and how it relates to the SQL demos** are documented in the repository root [`README.md`](../README.md) (see **Reproducibility** and **Repository layout**).
The web app uses PostgreSQL tables created by `sql/postgres/demo.sql` (`demo_*` tables) as its data model.
Use `/api/health` to verify required demo SQL routines are present before using `/enriched`.

Quick start from this directory:

```bash
# First (from repo root): run sql/postgres/demo.sql to create demo tables/functions
# Then:
npm install
npm run db:generate
npm run dev
```

Use **`../README.md`** for the full narrative.

import Link from "next/link";
import { Nav } from "@/components/Nav";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Nav current="home" />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Toy UI: descriptors + enriched output
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Next.js (App Router) with a small SQLite database via Prisma. The server exposes REST handlers for CRUD on per-outcome{" "}
          <strong>descriptors</strong> (routing queue, SLA bucket, cost center) and a read-only view that applies the same kernelization →
          linear scores → argmax pipeline as <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">sql/postgres/demo.sql</code>, then
          attaches the winning rule&apos;s descriptor row.
        </p>
        <ul className="mt-8 flex flex-col gap-3 text-sm">
          <li>
            <Link
              href="/descriptors"
              className="font-medium text-zinc-900 underline decoration-zinc-400 underline-offset-4 hover:decoration-zinc-900 dark:text-zinc-50 dark:hover:decoration-zinc-50"
            >
              Descriptor management
            </Link>
            <span className="text-zinc-500"> — REST: </span>
            <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">GET/POST /api/descriptors</code>
            <span className="text-zinc-500">, </span>
            <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">GET/PATCH/DELETE /api/descriptors/[ruleId]</code>
          </li>
          <li>
            <Link
              href="/enriched"
              className="font-medium text-zinc-900 underline decoration-zinc-400 underline-offset-4 hover:decoration-zinc-900 dark:text-zinc-50 dark:hover:decoration-zinc-50"
            >
              Enriched output
            </Link>
            <span className="text-zinc-500"> — </span>
            <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">GET /api/enriched</code>
          </li>
        </ul>
        <section className="mt-10 rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Local run</h2>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-100 p-3 font-mono text-xs text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
            {`cd web
cp .env.example .env
npx prisma migrate dev
npm run dev`}
          </pre>
          <p className="mt-3">
            Migrations apply the schema; seed runs automatically on <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">migrate dev</code>{" "}
            the first time. To reset demo data: <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">npm run db:seed</code>.
          </p>
        </section>
      </main>
    </div>
  );
}

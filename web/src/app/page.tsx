import Link from "next/link";
import { Nav } from "@/components/Nav";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Nav current="home" />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Semantic layer demo
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Explore how per-outcome <strong>descriptors</strong> (routing, SLA, book) attach to securities after the engine scores
          observations and picks a winning workstream—aligned with the SQL portfolio demo in this repository.
        </p>
        <ul className="mt-8 flex flex-col gap-4 text-sm">
          <li>
            <Link
              href="/descriptors"
              className="font-medium text-zinc-900 underline decoration-zinc-400 underline-offset-4 hover:decoration-zinc-900 dark:text-zinc-50 dark:hover:decoration-zinc-50"
            >
              Descriptor management
            </Link>
            <p className="mt-1 max-w-xl text-zinc-600 dark:text-zinc-400">
              Create, edit, or remove semantic fields for each outcome (workstream).
            </p>
          </li>
          <li>
            <Link
              href="/enriched"
              className="font-medium text-zinc-900 underline decoration-zinc-400 underline-offset-4 hover:decoration-zinc-900 dark:text-zinc-50 dark:hover:decoration-zinc-50"
            >
              Enriched output
            </Link>
            <p className="mt-1 max-w-xl text-zinc-600 dark:text-zinc-400">
              View observations with scores, the chosen workstream, and the descriptors applied to each row. Download as CSV if needed.
            </p>
          </li>
          <li>
            <Link
              href="/api-docs"
              className="font-medium text-zinc-900 underline decoration-zinc-400 underline-offset-4 hover:decoration-zinc-900 dark:text-zinc-50 dark:hover:decoration-zinc-50"
            >
              API reference (OpenAPI)
            </Link>
            <p className="mt-1 max-w-xl text-zinc-600 dark:text-zinc-400">
              Standard OpenAPI 3 specification with interactive “Try it” documentation for integrators and technical stakeholders.
            </p>
          </li>
        </ul>
      </main>
    </div>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

function Card({
  href,
  title,
  children,
  variant = "primary",
}: {
  href: string;
  title: string;
  children: ReactNode;
  variant?: "primary" | "muted";
}) {
  const base =
    variant === "primary"
      ? "border-zinc-200 bg-white shadow-sm hover:border-zinc-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
      : "border-zinc-200/80 bg-zinc-50/80 hover:bg-zinc-100/80 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:bg-zinc-900";

  return (
    <Link
      href={href}
      className={`group flex h-full flex-col rounded-2xl border p-6 transition ${base}`}
    >
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h2>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{children}</p>
      <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 group-hover:text-emerald-800 dark:text-emerald-400 dark:group-hover:text-emerald-300">
        Open
        <span aria-hidden className="transition group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </Link>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-zinc-100 to-zinc-50 dark:from-zinc-900 dark:to-zinc-950">
      <Nav current="home" />
      <main className="mx-auto max-w-5xl flex-1 px-4 pb-16 pt-10 sm:pt-14">
        <header className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Illustrative demo
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            When a security is classified, where should it go next?
          </h1>
          <p className="mt-5 text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-400">
            Operations teams need consistent answers: which <strong className="font-semibold text-zinc-800 dark:text-zinc-200">workstream</strong>{" "}
            and <strong className="font-semibold text-zinc-800 dark:text-zinc-200">descriptor values</strong> apply once hierarchy rules match an
            observation. This experience walks through that handoff using sample securities, vendor attributes, and optional fund overrides.
          </p>
        </header>

        <section className="mt-12 sm:mt-14" aria-labelledby="explore-heading">
          <h2 id="explore-heading" className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Explore the demo
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card href="/descriptors" title="Hierarchy rules &amp; descriptors">
              Define wildcard hierarchy matching and the descriptor columns attached to each rule. Changes here flow through to the enriched
              output.
            </Card>
            <Card href="/enriched" title="Securities &amp; enriched output">
              Review each sample security end-to-end: effective attributes, matrix-constrained scores, winning workstream, and descriptors.
              Export a CSV if you want to compare outside the app.
            </Card>
            <Card href="/api-docs" title="Technical reference" variant="muted">
              For colleagues in technology or integration: machine-readable API description and try-it-yourself console. Most day-to-day users
              can skip this.
            </Card>
          </div>
        </section>

        <section
          className="mt-12 rounded-2xl border border-zinc-200 bg-white/60 px-5 py-5 dark:border-zinc-800 dark:bg-zinc-900/40 sm:px-6 sm:py-6"
          aria-label="What this is not"
        >
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Good to know</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            <li>All securities and fields are <strong className="font-medium text-zinc-800 dark:text-zinc-300">synthetic</strong>—for learning and discussion, not trading or reporting.</li>
            <li>The logic is a simplified cousin of a real semantic layer: vendor-style reference data plus optional fund overrides, then a clear winner and attached metadata.</li>
            <li>Nothing here connects to production systems or market data vendors.</li>
            <li>
              Use of this demo is subject to the{" "}
              <a href="/legal/terms" className="font-medium text-emerald-800 underline-offset-2 hover:underline dark:text-emerald-300">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/legal/privacy" className="font-medium text-emerald-800 underline-offset-2 hover:underline dark:text-emerald-300">
                Privacy Policy
              </a>
              .
            </li>
          </ul>
        </section>
      </main>
      <Footer />
    </div>
  );
}

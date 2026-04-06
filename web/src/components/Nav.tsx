import Link from "next/link";

const link =
  "rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white";

const active =
  "rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900";

export function Nav({ current }: { current: "home" | "descriptors" | "enriched" }) {
  return (
    <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Semantic layer demo
        </Link>
        <nav className="flex flex-wrap gap-1">
          <Link href="/" className={current === "home" ? active : link}>
            Home
          </Link>
          <Link href="/descriptors" className={current === "descriptors" ? active : link}>
            Descriptors
          </Link>
          <Link href="/enriched" className={current === "enriched" ? active : link}>
            Enriched output
          </Link>
        </nav>
      </div>
    </header>
  );
}

import type { ReactNode } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { LAST_UPDATED } from "@/lib/legal";

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{children}</div>
    </section>
  );
}

export function LegalDocument({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-zinc-100 to-zinc-50 dark:from-zinc-900 dark:to-zinc-950">
      <Nav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-12 pt-10">
        <header>
          <p className="text-sm font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Legal</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h1>
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-500">Last updated: {LAST_UPDATED}</p>
        </header>
        <article className="mt-6">{children}</article>
      </main>
      <Footer />
    </div>
  );
}

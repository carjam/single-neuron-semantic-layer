import Link from "next/link";
import { LEGAL_COPYRIGHT_YEARS, LEGAL_OWNER } from "@/lib/legal";

const linkClass =
  "text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200";

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between dark:text-zinc-400">
        <p>
          © {LEGAL_COPYRIGHT_YEARS} {LEGAL_OWNER}. All rights reserved. Portfolio demonstration only.
        </p>
        <nav className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Legal">
          <Link href="/legal/copyright" className={linkClass}>
            Copyright
          </Link>
          <Link href="/legal/terms" className={linkClass}>
            Terms of Service
          </Link>
          <Link href="/legal/privacy" className={linkClass}>
            Privacy Policy
          </Link>
        </nav>
      </div>
    </footer>
  );
}

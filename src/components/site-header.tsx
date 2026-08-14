import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Wordmark />
        <div className="flex items-center gap-6 text-sm">
          <Link
            href="/login"
            className="text-muted transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-accent px-4 py-2 font-medium text-[#1a1206] transition-colors hover:bg-accent-strong"
          >
            Get started
          </Link>
        </div>
      </nav>
    </header>
  );
}

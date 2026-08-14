import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Wordmark />
        <div className="flex items-center gap-6 text-sm">
          <Link
            href="/browse"
            className="text-muted transition-colors hover:text-foreground"
          >
            Browse
          </Link>
          <Link
            href="/plans"
            className="text-muted transition-colors hover:text-foreground"
          >
            Plans
          </Link>
          {user ? (
            <Link
              href="/account"
              className="rounded-full border border-border px-4 py-2 text-foreground transition-colors hover:border-accent hover:text-accent"
            >
              Account
            </Link>
          ) : (
            <>
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
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

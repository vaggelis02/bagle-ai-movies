import Link from "next/link";
import { submitForReview } from "@/app/creators/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "For creators" };

const statusLabel: Record<string, string> = {
  draft: "Draft",
  pending_review: "Waiting for review",
  published: "Published",
  rejected: "Rejected",
};

export default async function CreatorsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">For creators</h1>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted">
          Host your films and series here and earn a share of what subscribers
          watch. Sign in to get started.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/signup"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-[#1a1206] transition-colors hover:bg-accent-strong"
          >
            Create an account
          </Link>
          <Link
            href="/plans"
            className="rounded-full border border-border px-5 py-2.5 text-sm transition-colors hover:border-accent hover:text-accent"
          >
            See creator plans
          </Link>
        </div>
      </main>
    );
  }

  const [{ data: profile }, { data: titles }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase
      .from("titles")
      .select("id, slug, title, kind, status, created_at, episodes(status)")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const isCreator = ["creator", "admin"].includes(profile?.role ?? "");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Your films</h1>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/creators/earnings"
            className="rounded-full border border-border px-5 py-2.5 text-sm transition-colors hover:border-accent hover:text-accent"
          >
            Earnings
          </Link>
          {isCreator && (
            <Link
              href="/creators/new"
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-[#1a1206] transition-colors hover:bg-accent-strong"
            >
              Upload a film
            </Link>
          )}
        </div>
      </div>

      {!isCreator && (
        <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">You need a creator plan</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Creator plans let you publish films, series, or both, and earn from
            what subscribers watch.
          </p>
          <Link
            href="/plans"
            className="mt-5 inline-block rounded-full border border-border px-5 py-2.5 text-sm transition-colors hover:border-accent hover:text-accent"
          >
            See creator plans
          </Link>
        </div>
      )}

      {isCreator && (titles ?? []).length === 0 && (
        <p className="mt-10 text-sm text-muted">
          Nothing here yet. Upload your first film and it will appear on this
          page.
        </p>
      )}

      {(titles ?? []).length > 0 && (
        <ul className="mt-10 divide-y divide-border/60 border-y border-border/60">
          {(titles ?? []).map((t) => {
            const episodes = (t.episodes ?? []) as { status: string }[];
            const ready = episodes.some((e) => e.status === "ready");
            return (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-4 py-5"
              >
                <div className="min-w-0">
                  <Link
                    href={`/title/${t.slug}`}
                    className="text-sm font-medium hover:text-accent"
                  >
                    {t.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted">
                    {t.kind === "series" ? "Series" : "Film"} ·{" "}
                    {statusLabel[t.status] ?? t.status}
                    {!ready && episodes.length > 0 && " · video processing"}
                    {episodes.length === 0 && " · no video"}
                  </p>
                </div>

                {t.status === "draft" && ready && (
                  <form action={submitForReview}>
                    <input type="hidden" name="title_id" value={t.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-border px-4 py-2 text-xs transition-colors hover:border-accent hover:text-accent"
                    >
                      Submit for review
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

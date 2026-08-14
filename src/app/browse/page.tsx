import Link from "next/link";
import type { PosterTitle } from "@/components/poster-card";
import { TitleRow } from "@/components/title-row";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Browse" };

export default async function BrowsePage() {
  const supabase = await createClient();

  // RLS already limits this to published titles for anyone who is not the
  // owner or an admin, so no status filter is needed for correctness — it is
  // here only to keep a creator's own drafts out of the public shelves.
  const { data } = await supabase
    .from("titles")
    .select("slug, title, kind, poster_url, release_year, genres, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  const titles = (data ?? []) as (PosterTitle & { published_at: string })[];

  if (titles.length === 0) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-24">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            The catalogue is empty
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            No films have been published yet. The first one is on its way.
          </p>
          <Link
            href="/creators"
            className="mt-8 inline-block rounded-full border border-border px-5 py-2.5 text-sm transition-colors hover:border-accent hover:text-accent"
          >
            Publish yours
          </Link>
        </div>
      </main>
    );
  }

  const genres = [...new Set(titles.flatMap((t) => t.genres ?? []))].sort();

  return (
    <main className="w-full flex-1 py-10">
      <h1 className="mb-8 px-6 text-3xl font-semibold tracking-tight">Browse</h1>

      <TitleRow heading="New releases" titles={titles.slice(0, 20)} />
      <TitleRow
        heading="Films"
        titles={titles.filter((t) => t.kind === "film")}
      />
      <TitleRow
        heading="Series"
        titles={titles.filter((t) => t.kind === "series")}
      />

      {genres.map((genre) => (
        <TitleRow
          key={genre}
          heading={genre}
          titles={titles.filter((t) => (t.genres ?? []).includes(genre))}
        />
      ))}
    </main>
  );
}

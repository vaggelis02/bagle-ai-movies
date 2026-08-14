import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Episode = {
  id: string;
  episode_number: number;
  name: string | null;
  duration_seconds: number | null;
  status: string;
  season_id: string | null;
};

function runtime(seconds: number | null) {
  if (!seconds) return null;
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}

export async function generateMetadata(props: PageProps<"/title/[slug]">) {
  const { slug } = await props.params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("titles")
    .select("title, synopsis")
    .eq("slug", slug)
    .maybeSingle();
  return data
    ? { title: data.title, description: data.synopsis ?? undefined }
    : {};
}

export default async function TitlePage(props: PageProps<"/title/[slug]">) {
  const { slug } = await props.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS decides visibility: published titles for everyone, drafts only for
  // their owner or an admin. A draft therefore 404s for everyone else.
  const { data: title } = await supabase
    .from("titles")
    .select(
      "id, slug, kind, title, original_title, synopsis, genres, release_year, poster_url, status",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!title) notFound();

  const { data: episodeRows } = await supabase
    .from("episodes")
    .select("id, episode_number, name, duration_seconds, status, season_id")
    .eq("title_id", title.id)
    .order("episode_number");

  const episodes = (episodeRows ?? []) as Episode[];
  const playable = episodes.filter((e) => e.status === "ready");
  const first = playable[0];

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-14">
      {title.status !== "published" && (
        <p className="mb-8 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent-strong">
          This is your unpublished draft. Only you can see it.
        </p>
      )}

      <div className="flex flex-col gap-8 sm:flex-row">
        <div
          className="aspect-2/3 w-full shrink-0 overflow-hidden rounded-xl border border-border sm:w-56"
          style={
            title.poster_url
              ? undefined
              : { background: "linear-gradient(160deg,#241d12,var(--background))" }
          }
        >
          {title.poster_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={title.poster_url}
              alt=""
              className="h-full w-full object-cover"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            {title.title}
          </h1>
          {title.original_title && (
            <p className="mt-1 text-sm text-muted">{title.original_title}</p>
          )}

          <p className="mt-3 flex flex-wrap gap-x-2 text-sm text-muted">
            <span>{title.kind === "series" ? "Series" : "Film"}</span>
            {title.release_year && <span>· {title.release_year}</span>}
            {first?.duration_seconds && (
              <span>· {runtime(first.duration_seconds)}</span>
            )}
            {(title.genres ?? []).length > 0 && (
              <span>· {(title.genres ?? []).join(", ")}</span>
            )}
          </p>

          {title.synopsis && (
            <p className="mt-6 text-sm leading-relaxed text-muted">
              {title.synopsis}
            </p>
          )}

          <div className="mt-8">
            {first ? (
              <Link
                href={`/watch/${first.id}`}
                className="inline-block rounded-full bg-accent px-6 py-3 text-sm font-medium text-[#1a1206] transition-colors hover:bg-accent-strong"
              >
                {title.kind === "series" ? "Play first episode" : "Play"}
              </Link>
            ) : (
              <p className="text-sm text-muted">
                {episodes.length === 0
                  ? "No video has been uploaded yet."
                  : "Still processing — this becomes playable once encoding finishes."}
              </p>
            )}
            {!user && first && (
              <p className="mt-3 text-xs text-muted">
                You will need an account and an active subscription to watch.
              </p>
            )}
          </div>
        </div>
      </div>

      {title.kind === "series" && episodes.length > 0 && (
        <section className="mt-14">
          <h2 className="text-sm font-medium tracking-[0.12em] text-muted uppercase">
            Episodes
          </h2>
          <ul className="mt-4 divide-y divide-border/60 border-y border-border/60">
            {episodes.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-4 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    {e.episode_number}. {e.name ?? "Untitled"}
                  </p>
                  <p className="text-xs text-muted">
                    {runtime(e.duration_seconds) ??
                      (e.status === "ready" ? "" : "Processing")}
                  </p>
                </div>
                {e.status === "ready" && (
                  <Link
                    href={`/watch/${e.id}`}
                    className="shrink-0 rounded-full border border-border px-4 py-2 text-xs transition-colors hover:border-accent hover:text-accent"
                  >
                    Play
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

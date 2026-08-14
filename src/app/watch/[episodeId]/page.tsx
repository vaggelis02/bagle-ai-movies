import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { signedEmbedUrl } from "@/lib/bunny";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const metadata = { title: "Watch" };

/**
 * The paywall.
 *
 * Order matters here, and it is the order of the product's core rule:
 *
 *   1. Who is asking?                    — no session, no playback
 *   2. Are they entitled to THIS title?  — decided in Postgres, one function
 *   3. Only then, look up the video id   — service key, server side only
 *   4. Only then, mint a short-lived token
 *
 * The video id is never sent to the browser and never appears in this page's
 * HTML. What the browser receives is a signed URL that stops working within
 * minutes. Nothing here trusts anything the client said.
 */
export default async function WatchPage(props: PageProps<"/watch/[episodeId]">) {
  const { episodeId } = await props.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/watch/${episodeId}`);

  // Readable only if RLS lets this user see the parent title.
  const { data: episode } = await supabase
    .from("episodes")
    .select("id, title_id, name, status, titles(slug, title, kind)")
    .eq("id", episodeId)
    .maybeSingle();

  if (!episode) notFound();

  const parent = episode.titles as unknown as {
    slug: string;
    title: string;
    kind: string;
  } | null;

  // Step 2 — the single definition of "may this person watch this", evaluated
  // by the database rather than re-implemented here.
  const { data: allowed, error: checkError } = await supabase.rpc(
    "can_watch_title",
    { target_title: episode.title_id },
  );

  if (checkError || allowed !== true) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-24">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            You need a subscription
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            {parent?.title
              ? `“${parent.title}” is part of the BAGLE FLIX catalogue.`
              : "This film is part of the BAGLE FLIX catalogue."}{" "}
            Subscribe to watch it and everything else.
          </p>
          <Link
            href="/plans"
            className="mt-8 inline-block rounded-full bg-accent px-6 py-3 text-sm font-medium text-[#1a1206] transition-colors hover:bg-accent-strong"
          >
            See plans
          </Link>
        </div>
      </main>
    );
  }

  if (episode.status !== "ready") {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-24">
        <p className="text-sm text-muted">
          This video is still being processed. Check back shortly.
        </p>
      </main>
    );
  }

  // Step 3 — the secret half, reachable only with the service key, and only
  // now that entitlement has passed.
  const admin = createAdminClient();
  const { data: source } = await admin
    .from("episode_sources")
    .select("bunny_video_id")
    .eq("episode_id", episodeId)
    .maybeSingle();

  if (!source?.bunny_video_id) notFound();

  // Step 4 — a token that expires in minutes.
  const { url } = signedEmbedUrl(source.bunny_video_id);

  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        {parent && (
          <Link
            href={`/title/${parent.slug}`}
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            ← {parent.title}
          </Link>
        )}
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
          <iframe
            src={url}
            title={parent?.title ?? "Player"}
            loading="lazy"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
        {episode.name && (
          <h1 className="mt-5 text-lg font-medium">{episode.name}</h1>
        )}
      </div>
    </main>
  );
}

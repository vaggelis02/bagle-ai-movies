"use server";

import { revalidatePath } from "next/cache";
import { createVideo, getVideo, mapStatus, uploadSignature } from "@/lib/bunny";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export type NewTitleState = {
  error?: string;
  upload?: {
    libraryId: string;
    videoId: string;
    expires: number;
    signature: string;
    titleSlug: string;
    episodeId: string;
  };
};

function slugify(input: string) {
  return (
    input
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "untitled"
  );
}

/**
 * Creates a draft film and hands back everything the browser needs to upload
 * the video straight to Bunny.
 *
 * The file never passes through this server: a 26-minute film is far past what
 * a serverless function will accept, and proxying gigabytes would be slow and
 * expensive. The browser uploads directly, using a signature minted here that
 * is scoped to one video and expires.
 */
export async function createFilmDraft(
  _prev: NewTitleState,
  formData: FormData,
): Promise<NewTitleState> {
  const name = String(formData.get("title") ?? "").trim();
  const synopsis = String(formData.get("synopsis") ?? "").trim();
  const year = String(formData.get("release_year") ?? "").trim();
  const genres = String(formData.get("genres") ?? "")
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);

  if (!name) return { error: "Give the film a title." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in first." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["creator", "admin"].includes(profile.role)) {
    return {
      error:
        "Your account is not a creator account yet. Choose a creator plan first.",
    };
  }

  // Slugs are globally unique, so disambiguate rather than fail on collision.
  let slug = slugify(name);
  const { data: clash } = await supabase
    .from("titles")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const { data: title, error: titleError } = await supabase
    .from("titles")
    .insert({
      kind: "film",
      owner_id: user.id,
      slug,
      title: name,
      synopsis: synopsis || null,
      release_year: year ? Number(year) : null,
      genres,
      status: "draft",
    })
    .select("id, slug")
    .single();

  if (titleError || !title) {
    return { error: titleError?.message ?? "Could not create the film." };
  }

  const { data: episode, error: episodeError } = await supabase
    .from("episodes")
    .insert({
      title_id: title.id,
      episode_number: 1,
      status: "awaiting_upload",
    })
    .select("id")
    .single();

  if (episodeError || !episode) {
    return { error: episodeError?.message ?? "Could not prepare the video." };
  }

  let videoId: string;
  try {
    videoId = (await createVideo(name)).guid;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Bunny rejected the video." };
  }

  // The video id goes into the locked table, using the service key. It is
  // never returned to the browser through any normal query.
  const admin = createAdminClient();
  const { error: sourceError } = await admin
    .from("episode_sources")
    .insert({ episode_id: episode.id, bunny_video_id: videoId });

  if (sourceError) return { error: sourceError.message };

  revalidatePath("/creators");

  const sig = uploadSignature(videoId);
  return {
    upload: { ...sig, titleSlug: title.slug, episodeId: episode.id },
  };
}

/**
 * Asks Bunny how the encode is going and moves the episode forward.
 *
 * Bunny can also push a webhook, but polling from the page the creator is
 * already looking at needs no public endpoint and no shared secret, and this
 * is the only moment anyone is waiting on the answer.
 */
export async function refreshEpisodeStatus(episodeId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "unknown" as const };

  // Confirm this user may touch the episode before using the admin client.
  const { data: episode } = await supabase
    .from("episodes")
    .select("id, title_id, titles(owner_id)")
    .eq("id", episodeId)
    .maybeSingle();

  const owner = (episode?.titles as unknown as { owner_id: string } | null)
    ?.owner_id;
  if (!episode || owner !== user.id) return { status: "unknown" as const };

  const admin = createAdminClient();
  const { data: source } = await admin
    .from("episode_sources")
    .select("bunny_video_id")
    .eq("episode_id", episodeId)
    .maybeSingle();

  if (!source) return { status: "unknown" as const };

  try {
    const video = await getVideo(source.bunny_video_id);
    const status = mapStatus(video.status);
    await admin
      .from("episodes")
      .update({
        status,
        duration_seconds: video.length || null,
      })
      .eq("id", episodeId);
    revalidatePath("/creators");
    return { status };
  } catch {
    return { status: "unknown" as const };
  }
}

/** Sends a finished draft to an administrator for review. */
export async function submitForReview(formData: FormData) {
  const titleId = String(formData.get("title_id") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("titles")
    .update({ status: "pending_review" })
    .eq("id", titleId)
    .eq("owner_id", user.id);

  revalidatePath("/creators");
}

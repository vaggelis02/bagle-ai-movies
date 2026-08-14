import { createHash } from "node:crypto";

/**
 * Bunny Stream, server side only.
 *
 * Nothing in this file may ever be imported into a Client Component. The
 * library API key and the video ids it handles are exactly what must never
 * reach a browser — a leaked video id plus an unprotected library means the
 * whole catalogue is downloadable.
 */

function config() {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const apiKey = process.env.BUNNY_STREAM_API_KEY;
  if (!libraryId || !apiKey) {
    throw new Error("Bunny Stream is not configured");
  }
  return { libraryId, apiKey };
}

/** How long a playback token stays valid. Short on purpose. */
const PLAYBACK_TTL_SECONDS = 60 * 15;

/**
 * Signed embed URL for one video.
 *
 * Bunny's recipe: sha256(libraryId + apiKey + expiry + videoId), hex.
 * The caller MUST have already checked that this user is entitled to watch —
 * this function only signs, it does not authorise.
 */
export function signedEmbedUrl(videoId: string, ttlSeconds = PLAYBACK_TTL_SECONDS) {
  const { libraryId, apiKey } = config();
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const token = createHash("sha256")
    .update(libraryId + apiKey + expires + videoId)
    .digest("hex");

  const params = new URLSearchParams({
    token,
    expires: String(expires),
    autoplay: "true",
    preload: "true",
  });

  return {
    url: `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?${params}`,
    expiresAt: expires,
  };
}

/** Signature the browser needs to upload straight to Bunny over TUS. */
export function uploadSignature(videoId: string, ttlSeconds = 60 * 60 * 6) {
  const { libraryId, apiKey } = config();
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const signature = createHash("sha256")
    .update(libraryId + apiKey + expires + videoId)
    .digest("hex");
  return { libraryId, videoId, expires, signature };
}

async function bunnyFetch(path: string, init: RequestInit = {}) {
  const { libraryId, apiKey } = config();
  const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}${path}`, {
    ...init,
    headers: {
      AccessKey: apiKey,
      "Content-Type": "application/json",
      accept: "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Bunny ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/** Reserves an empty video in the library, ready to receive an upload. */
export async function createVideo(title: string): Promise<{ guid: string }> {
  return bunnyFetch("/videos", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export type BunnyVideo = {
  guid: string;
  status: number; // 0 queued · 1 processing · 2 encoding · 3 finished · 4 resolution finished · 5 failed
  length: number; // seconds
  thumbnailFileName?: string;
};

export async function getVideo(videoId: string): Promise<BunnyVideo> {
  return bunnyFetch(`/videos/${videoId}`);
}

/** Bunny's numeric status, mapped onto our asset_status enum. */
export function mapStatus(status: number): "processing" | "ready" | "failed" {
  if (status >= 5) return "failed";
  if (status === 3 || status === 4) return "ready";
  return "processing";
}

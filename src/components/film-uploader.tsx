"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import * as tus from "tus-js-client";
import {
  createFilmDraft,
  refreshEpisodeStatus,
  type NewTitleState,
} from "@/app/creators/actions";
import { Field, Message, SubmitButton } from "@/components/auth-ui";

type Phase = "form" | "uploading" | "encoding" | "done" | "failed";

export function FilmUploader() {
  const [state, action, pending] = useActionState(
    createFilmDraft,
    {} as NewTitleState,
  );
  const [phase, setPhase] = useState<Phase>("form");
  const [percent, setPercent] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = state.upload;

  async function startUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file || !upload) return;

    setProblem(null);
    setPhase("uploading");

    const tusUpload = new tus.Upload(file, {
      endpoint: "https://video.bunnycdn.com/tusupload",
      // Resumable: closing the laptop mid-upload does not mean starting a
      // 2 GB film over from zero.
      retryDelays: [0, 3000, 5000, 10000, 20000, 60000],
      headers: {
        AuthorizationSignature: upload.signature,
        AuthorizationExpire: String(upload.expires),
        VideoId: upload.videoId,
        LibraryId: upload.libraryId,
      },
      metadata: { filetype: file.type, title: file.name },
      onError(error) {
        setProblem(error.message);
        setPhase("failed");
      },
      onProgress(sent, total) {
        setPercent(Math.round((sent / total) * 100));
      },
      async onSuccess() {
        setPhase("encoding");
        // Bunny transcodes after the bytes land; poll until it is playable.
        for (let i = 0; i < 240; i++) {
          await new Promise((r) => setTimeout(r, 5000));
          const { status } = await refreshEpisodeStatus(upload.episodeId);
          if (status === "ready") return setPhase("done");
          if (status === "failed") {
            setProblem("Bunny could not encode this file.");
            return setPhase("failed");
          }
        }
        // Still going after 20 minutes — a long film, not necessarily broken.
        setPhase("encoding");
      },
    });

    const previous = await tusUpload.findPreviousUploads();
    if (previous.length) tusUpload.resumeFromPreviousUpload(previous[0]);
    tusUpload.start();
  }

  if (!upload) {
    return (
      <form action={action} className="space-y-4">
        <Message error={state.error} />
        <Field label="Title" name="title" required placeholder="Demigods vs Titans" />
        <Field label="Release year" name="release_year" type="number" placeholder="2026" />
        <Field
          label="Genres"
          name="genres"
          placeholder="Epic, Fantasy"
          hint="Separate with commas."
        />
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted">
            Synopsis
          </span>
          <textarea
            name="synopsis"
            rows={4}
            placeholder="What happens in it?"
            className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-accent"
          />
        </label>
        <SubmitButton pending={pending}>Continue to upload</SubmitButton>
      </form>
    );
  }

  return (
    <div className="space-y-5">
      {phase === "form" && (
        <>
          <p className="text-sm text-muted">
            Draft created. Now choose the video file — it uploads straight to
            our video host, so it will not be limited by this page.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            onChange={() => setProblem(null)}
            className="block w-full text-sm text-muted file:mr-4 file:rounded-full file:border file:border-border file:bg-surface file:px-4 file:py-2 file:text-sm file:text-foreground hover:file:border-accent"
          />
          <button
            type="button"
            onClick={startUpload}
            className="w-full rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-[#1a1206] transition-colors hover:bg-accent-strong"
          >
            Start upload
          </button>
        </>
      )}

      {phase === "uploading" && (
        <>
          <p className="text-sm">Uploading — {percent}%</p>
          <div className="h-2 overflow-hidden rounded-full bg-surface-raised">
            <div
              className="h-full bg-accent transition-[width]"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-xs text-muted">
            Keep this tab open. If the connection drops it picks up where it
            left off.
          </p>
        </>
      )}

      {phase === "encoding" && (
        <p className="text-sm text-muted">
          Uploaded. The video host is now encoding it for every screen size —
          this takes a few minutes for a short film, longer for a feature. You
          can close this tab; it carries on without you.
        </p>
      )}

      {phase === "done" && (
        <div className="space-y-4">
          <p className="text-sm text-accent-strong">
            Ready. Your film is encoded and playable.
          </p>
          <Link
            href={`/title/${upload.titleSlug}`}
            className="inline-block rounded-full border border-border px-5 py-2.5 text-sm transition-colors hover:border-accent hover:text-accent"
          >
            View it
          </Link>
        </div>
      )}

      {phase === "failed" && <Message error={problem ?? "Upload failed."} />}
    </div>
  );
}

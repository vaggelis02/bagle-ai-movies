"use client";

import { useState } from "react";

export function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-muted"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard blocked (insecure context, or the user denied it).
            // The input is selectable, so copying by hand still works.
          }
        }}
        className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs transition-colors hover:border-accent hover:text-accent"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; content: string };

const OPENERS = [
  "How do I cancel my subscription?",
  "What is the difference between Solo and Family?",
  "How does the referral code work?",
];

export function SupportChat({ signedIn }: { signedIn: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;

    const next: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    setDraft("");
    setBusy(true);

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });

      if (!res.ok || !res.body) {
        const { error } = await res.json().catch(() => ({ error: null }));
        setTurns([
          ...next,
          {
            role: "assistant",
            content:
              error ??
              "Support chat is unavailable right now. Email support@bagleflix.com.",
          },
        ]);
        return;
      }

      // Show the answer as it is written rather than after a long silence.
      setTurns([...next, { role: "assistant", content: "" }]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setTurns([...next, { role: "assistant", content: answer }]);
      }
    } catch {
      setTurns([
        ...next,
        {
          role: "assistant",
          content:
            "Could not reach support chat. Email support@bagleflix.com and we will help.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="min-h-[18rem] space-y-4 rounded-2xl border border-border bg-surface p-5">
        {turns.length === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Ask about your subscription, billing, or how anything here works.
              {!signedIn &&
                " Sign in first if your question is about your own account."}
            </p>
            <div className="flex flex-wrap gap-2">
              {OPENERS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => ask(q)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) => (
          <div
            key={i}
            className={t.role === "user" ? "flex justify-end" : "flex"}
          >
            <p
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                t.role === "user"
                  ? "bg-accent text-[#1a1206]"
                  : "border border-border bg-surface-raised text-foreground"
              }`}
            >
              {t.content || "…"}
            </p>
          </div>
        ))}

        {busy && turns[turns.length - 1]?.role === "user" && (
          <p className="text-xs text-muted">Thinking…</p>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
        className="flex gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2000}
          placeholder="Type your question"
          className="min-w-0 flex-1 rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-muted/60 focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy || draft.trim().length === 0}
          className="shrink-0 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-[#1a1206] transition-colors hover:bg-accent-strong disabled:opacity-50"
        >
          Send
        </button>
      </form>

      <p className="text-xs text-muted">
        This assistant cannot change your subscription or issue refunds. For
        those, use “Manage billing” on your account page or email{" "}
        <span className="text-foreground">support@bagleflix.com</span>.
      </p>
    </div>
  );
}

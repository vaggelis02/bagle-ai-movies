"use client";

import { useActionState, useState } from "react";
import {
  signIn,
  signInWithMagicLink,
  type AuthState,
} from "@/app/auth/actions";
import { Field, Message, SubmitButton } from "@/components/auth-ui";

const empty: AuthState = {};

export function LoginForm({ initialError }: { initialError?: string }) {
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [pwState, pwAction, pwPending] = useActionState(signIn, empty);
  const [magicState, magicAction, magicPending] = useActionState(
    signInWithMagicLink,
    empty,
  );

  const state = mode === "password" ? pwState : magicState;

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-full border border-border bg-surface p-1 text-xs">
        {(["password", "magic"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-full px-3 py-1.5 transition-colors ${
              mode === m
                ? "bg-accent text-[#1a1206]"
                : "text-muted hover:text-foreground"
            }`}
          >
            {m === "password" ? "Password" : "Email link"}
          </button>
        ))}
      </div>

      <Message error={state.error ?? initialError} notice={state.notice} />

      {mode === "password" ? (
        <form action={pwAction} className="space-y-4">
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
          />
          <SubmitButton pending={pwPending}>Sign in</SubmitButton>
        </form>
      ) : (
        <form action={magicAction} className="space-y-4">
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            hint="We email you a link — no password needed."
          />
          <SubmitButton pending={magicPending} variant="ghost">
            Send me a link
          </SubmitButton>
        </form>
      )}
    </div>
  );
}

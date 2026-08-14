"use client";

import { useActionState } from "react";
import { signUp, type AuthState } from "@/app/auth/actions";
import { Field, Message, SubmitButton } from "@/components/auth-ui";

export function SignupForm({ referral }: { referral?: string }) {
  const [state, action, pending] = useActionState(signUp, {} as AuthState);

  return (
    <div className="space-y-5">
      <Message error={state.error} notice={state.notice} />

      {!state.notice && (
        <form action={action} className="space-y-4">
          <Field
            label="Name"
            name="display_name"
            autoComplete="name"
            placeholder="How you want to be known"
          />
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
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
          />
          <Field
            label="Referral code (optional)"
            name="referral_code"
            defaultValue={referral ?? ""}
            placeholder="ABCD2345"
            hint={
              referral
                ? "Filled in from your invite link."
                : "If a friend invited you, put their code here."
            }
          />
          <SubmitButton pending={pending}>Create account</SubmitButton>
        </form>
      )}
    </div>
  );
}

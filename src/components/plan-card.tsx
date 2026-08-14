"use client";

import { useActionState } from "react";
import { startCheckout, type CheckoutState } from "@/app/plans/actions";

export function PlanCard({
  id,
  name,
  amount,
  detail,
  signedIn,
  featured = false,
}: {
  id: string;
  name: string;
  amount: number | null;
  detail: string;
  signedIn: boolean;
  featured?: boolean;
}) {
  const [state, action, pending] = useActionState(
    startCheckout,
    {} as CheckoutState,
  );

  return (
    <form
      action={action}
      className={`flex flex-col rounded-2xl border bg-surface p-6 ${
        featured ? "border-accent/50" : "border-border"
      }`}
    >
      <input type="hidden" name="plan_id" value={id} />

      <h3 className="text-lg font-semibold">{name}</h3>
      <p className="mt-1 text-xs text-muted">{detail}</p>

      <p className="mt-6 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight">
          {amount === null ? "—" : `€${(amount / 100).toFixed(0)}`}
        </span>
        <span className="text-sm text-muted">/month</span>
      </p>

      {state.error && (
        <p className="mt-4 text-xs text-red-300">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending || amount === null}
        className={`mt-6 rounded-full px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ${
          featured
            ? "bg-accent text-[#1a1206] hover:bg-accent-strong"
            : "border border-border text-foreground hover:border-accent hover:text-accent"
        }`}
      >
        {pending ? "Opening…" : signedIn ? "Subscribe" : "Sign in to subscribe"}
      </button>
    </form>
  );
}

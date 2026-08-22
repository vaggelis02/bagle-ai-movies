"use client";

import { useActionState } from "react";
import { startPurchase, type BuyState } from "@/app/title/actions";
import { formatMoney } from "@/lib/pricing";

export function BuyButtons({
  slug,
  currency,
  rentalCents,
  purchaseCents,
  rentalHours,
  signedIn,
}: {
  slug: string;
  currency: string;
  rentalCents: number | null;
  purchaseCents: number | null;
  rentalHours: number;
  signedIn: boolean;
}) {
  const [state, action, pending] = useActionState(
    startPurchase,
    {} as BuyState,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {rentalCents !== null && (
          <form action={action}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="kind" value="rental" />
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-[#1a1206] transition-colors hover:bg-accent-strong disabled:opacity-60"
            >
              {signedIn ? "Rent" : "Sign in to rent"} ·{" "}
              {formatMoney(rentalCents, currency)}
            </button>
          </form>
        )}

        {purchaseCents !== null && (
          <form action={action}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="kind" value="purchase" />
            <button
              type="submit"
              disabled={pending}
              className="rounded-full border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
            >
              Buy · {formatMoney(purchaseCents, currency)}
            </button>
          </form>
        )}
      </div>

      {rentalCents !== null && (
        <p className="text-xs text-muted">
          A rental gives you {rentalHours} hours from the moment you pay.
          Buying keeps it in your library.
        </p>
      )}

      {state.error && <p className="text-sm text-red-300">{state.error}</p>}
    </div>
  );
}

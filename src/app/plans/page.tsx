import Link from "next/link";
import { PlanCard } from "@/components/plan-card";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Plans" };

type Plan = {
  id: string;
  audience: "viewer" | "creator";
  name: string;
  stripe_price_id: string | null;
  max_profiles: number;
  trial_days: number;
};

/** Prices live in Stripe, so the page asks Stripe rather than a stale copy. */
async function withPrices(plans: Plan[]) {
  const stripe = getStripe();
  return Promise.all(
    plans.map(async (plan) => {
      if (!plan.stripe_price_id) return { ...plan, amount: null, currency: "usd" };
      try {
        const price = await stripe.prices.retrieve(plan.stripe_price_id);
        return {
          ...plan,
          amount: price.unit_amount,
          currency: price.currency,
        };
      } catch {
        return { ...plan, amount: null, currency: "usd" };
      }
    }),
  );
}

export default async function PlansPage(props: PageProps<"/plans">) {
  const { checkout } = await props.searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("plans")
    .select("id, audience, name, stripe_price_id, max_profiles, trial_days")
    .eq("audience", "creator")
    .eq("is_active", true);

  const creator = await withPrices((data ?? []) as Plan[]);
  const trialDays = creator.find((p) => p.trial_days > 0)?.trial_days ?? 0;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      {checkout === "cancelled" && (
        <p className="mb-8 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
          Checkout cancelled — nothing was charged.
        </p>
      )}

      <h1 className="text-3xl font-semibold tracking-tight">
        Watching is free. Publishing is a plan.
      </h1>

      <section className="mt-10 rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold">If you are here to watch</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          There is nothing to subscribe to. Create an account for free, then
          rent or buy the films you actually want to see. Creators set their own
          prices, so what you pay is up to whoever made it.
        </p>
        <Link
          href={user ? "/browse" : "/signup"}
          className="mt-5 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-[#1a1206] transition-colors hover:bg-accent-strong"
        >
          {user ? "Browse the catalogue" : "Create a free account"}
        </Link>
      </section>

      <section className="mt-14">
        <h2 className="text-xs font-medium tracking-[0.15em] text-muted uppercase">
          Publish your work
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Host your films and series here, set your own prices, and keep 80% of
          every rental and sale.
          {trialDays > 0 && (
            <>
              {" "}
              <span className="text-accent-strong">
                The first {Math.round(trialDays / 30)} months are free
              </span>{" "}
              — you are not charged until you have had time to bring an
              audience.
            </>
          )}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {creator.map((plan) => (
            <PlanCard
              key={plan.id}
              id={plan.id}
              name={plan.name.replace("BAGLE FLIX Creator — ", "")}
              amount={plan.amount}
              currency={plan.currency}
              detail={trialDays > 0 ? `Free for ${trialDays} days` : "Creator account"}
              signedIn={Boolean(user)}
              featured={plan.id === "creator_all"}
            />
          ))}
        </div>
      </section>

      <p className="mt-10 text-sm text-muted">
        Not sure what to charge for your work?{" "}
        <Link href="/creators/pricing" className="text-accent hover:underline">
          Read the pricing guide
        </Link>
        .
      </p>
    </main>
  );
}

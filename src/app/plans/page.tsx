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
};

/** Prices live in Stripe, so the page asks Stripe rather than a stale copy. */
async function withPrices(plans: Plan[]) {
  const stripe = getStripe();
  const priced = await Promise.all(
    plans.map(async (plan) => {
      if (!plan.stripe_price_id) return { ...plan, amount: null };
      try {
        const price = await stripe.prices.retrieve(plan.stripe_price_id);
        return { ...plan, amount: price.unit_amount };
      } catch {
        return { ...plan, amount: null };
      }
    }),
  );
  return priced;
}

export default async function PlansPage(props: PageProps<"/plans">) {
  const { checkout } = await props.searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("plans")
    .select("id, audience, name, stripe_price_id, max_profiles")
    .eq("is_active", true);

  const plans = await withPrices((data ?? []) as Plan[]);
  const viewer = plans.filter((p) => p.audience === "viewer");
  const creator = plans.filter((p) => p.audience === "creator");

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      {checkout === "cancelled" && (
        <p className="mb-8 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
          Checkout cancelled — nothing was charged.
        </p>
      )}

      <h1 className="text-3xl font-semibold tracking-tight">Plans</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
        Prices include VAT. Cancel whenever you like — you keep access until the
        end of the period you have paid for.
      </p>

      <section className="mt-12">
        <h2 className="text-xs font-medium tracking-[0.15em] text-muted uppercase">
          Watch
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {viewer.map((plan) => (
            <PlanCard
              key={plan.id}
              id={plan.id}
              name={plan.name}
              amount={plan.amount}
              detail={
                plan.max_profiles > 1
                  ? `Up to ${plan.max_profiles} profiles`
                  : "One profile"
              }
              signedIn={Boolean(user)}
              featured={plan.id === "viewer_solo"}
            />
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-xs font-medium tracking-[0.15em] text-muted uppercase">
          Publish
        </h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          For creators. Host your work here and earn a share of what subscribers
          watch.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {creator.map((plan) => (
            <PlanCard
              key={plan.id}
              id={plan.id}
              name={plan.name.replace("BAGLE FLIX Creator — ", "")}
              amount={plan.amount}
              detail="Creator account"
              signedIn={Boolean(user)}
            />
          ))}
        </div>
      </section>

      {!user && (
        <p className="mt-12 text-sm text-muted">
          You will be asked to sign in before payment.
        </p>
      )}
    </main>
  );
}

import type Stripe from "stripe";
import { NextResponse, type NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * The only thing that grants or removes a subscription.
 *
 * A user returning to /account?checkout=success proves nothing — they could
 * type that URL themselves. Access changes here, after Stripe has signed the
 * message and we have verified the signature, because Stripe is the only party
 * that knows whether money actually moved.
 */

// Stripe's signature is computed over the exact bytes it sent, so the body
// must not be parsed or re-serialised before verification.
export const dynamic = "force-dynamic";

const HANDLED = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

/** Stripe moved current_period_end onto subscription items; support both. */
function periodEnd(sub: Stripe.Subscription): string | null {
  const top = (sub as unknown as { current_period_end?: number })
    .current_period_end;
  const fromItem = sub.items?.data?.[0]?.current_period_end;
  const seconds = top ?? fromItem;
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

async function mirrorSubscription(sub: Stripe.Subscription) {
  const supabase = createAdminClient();

  const userId = sub.metadata?.user_id;
  const priceId = sub.items.data[0]?.price?.id ?? null;

  // Resolve our plan id from the Stripe price rather than trusting metadata,
  // so a plan renamed in Stripe still maps correctly.
  let planId = sub.metadata?.plan_id ?? null;
  if (priceId) {
    const { data: plan } = await supabase
      .from("plans")
      .select("id")
      .eq("stripe_price_id", priceId)
      .maybeSingle();
    if (plan) planId = plan.id;
  }

  if (!userId) {
    console.error("stripe webhook: subscription without user_id", sub.id);
    return;
  }

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      plan_id: planId,
      stripe_customer_id: String(sub.customer),
      stripe_subscription_id: sub.id,
      status: sub.status,
      current_period_end: periodEnd(sub),
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );

  if (error) console.error("stripe webhook: upsert failed", error.message);
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const raw = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, secret);
  } catch (e) {
    // An unverified payload is an impersonation attempt or a misconfiguration.
    // Either way it must never reach the database.
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "invalid signature" },
      { status: 400 },
    );
  }

  if (!HANDLED.has(event.type)) {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(
          String(session.subscription),
        );
        // Checkout metadata is the reliable source at this point; the
        // subscription may not carry it if it was created another way.
        sub.metadata = {
          ...sub.metadata,
          user_id:
            sub.metadata?.user_id ??
            session.metadata?.user_id ??
            session.client_reference_id ??
            "",
        };
        await mirrorSubscription(sub);
      }
    } else {
      await mirrorSubscription(event.data.object as Stripe.Subscription);
    }
  } catch (e) {
    // Returning 500 makes Stripe retry, which is what we want for a transient
    // failure — better a duplicate upsert than a lost subscription.
    console.error("stripe webhook: handler failed", e);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

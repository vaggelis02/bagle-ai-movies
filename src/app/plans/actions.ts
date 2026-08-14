"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export type CheckoutState = { error?: string };

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/**
 * Sends a signed-in user to Stripe Checkout for one plan.
 *
 * Nothing about their subscription is written here. The user coming back with
 * a success URL proves only that they returned from a page — the webhook is
 * what actually grants access, because only Stripe knows whether the money
 * moved.
 */
export async function startCheckout(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const planId = String(formData.get("plan_id") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/plans`);

  const { data: plan } = await supabase
    .from("plans")
    .select("id, name, stripe_price_id, audience")
    .eq("id", planId)
    .eq("is_active", true)
    .single();

  if (!plan?.stripe_price_id) return { error: "That plan is not available." };

  const stripe = getStripe();

  // Reuse this user's Stripe customer if they have subscribed before, so a
  // person does not accumulate duplicate customer records.
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  let url: string | null = null;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      ...(existing?.stripe_customer_id
        ? { customer: existing.stripe_customer_id }
        : { customer_email: user.email }),
      client_reference_id: user.id,
      // Carried through to the subscription so the webhook can attribute it
      // without depending on email matching.
      subscription_data: { metadata: { user_id: user.id, plan_id: plan.id } },
      metadata: { user_id: user.id, plan_id: plan.id },
      success_url: `${siteUrl()}/account?checkout=success`,
      cancel_url: `${siteUrl()}/plans?checkout=cancelled`,
      allow_promotion_codes: true,
    });
    url = session.url;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not start checkout." };
  }

  if (!url) return { error: "Stripe did not return a checkout page." };
  redirect(url);
}

/**
 * Opens Stripe's own billing portal, where a subscriber can change plan,
 * update their card or cancel. Building those screens ourselves would mean
 * handling card details, which we never want to touch.
 */
export async function openBillingPortal() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!sub?.stripe_customer_id) redirect("/plans");

  const session = await getStripe().billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${siteUrl()}/account`,
  });

  redirect(session.url);
}

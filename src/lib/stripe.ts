import Stripe from "stripe";

/**
 * Server-only Stripe client.
 *
 * Stripe is the source of truth for money. Anything this app stores about a
 * subscription is a mirror of what Stripe already decided, written by the
 * webhook — never by the browser, and never optimistically after a redirect.
 */
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

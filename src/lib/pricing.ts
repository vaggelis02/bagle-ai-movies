/**
 * Money helpers.
 *
 * Everything is integer cents. Prices are never floats anywhere in this
 * codebase — a rounding error in a split is money that belongs to somebody.
 */

/** What the platform keeps from each sale, in basis points. 2000 = 20%. */
export const DEFAULT_PLATFORM_CUT_BPS = 2000;

/** Below this a fixed card fee is a double-digit share of the sale. */
export const MIN_RENTAL_CENTS = 199;
export const MIN_PURCHASE_CENTS = 499;
export const MAX_PRICE_CENTS = 99900;

/** What we suggest to a creator who has no idea what to charge. */
export const SUGGESTED_RENTAL_CENTS = 399;
export const SUGGESTED_PURCHASE_CENTS = 999;

/** How to describe what a viewer already holds for a title. */
export function describeEntitlement(
  kind: "rental" | "purchase",
  expiresAt: string | null,
) {
  if (kind === "purchase") return "You own this";
  if (!expiresAt) return "Rented";
  const hoursLeft = Math.round(
    (new Date(expiresAt).getTime() - Date.now()) / 3_600_000,
  );
  if (hoursLeft <= 0) return "Your rental has expired";
  return hoursLeft < 24
    ? `Rented — ${hoursLeft}h left`
    : `Rented — ${Math.floor(hoursLeft / 24)}d left`;
}

export function formatMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

/**
 * Splits a sale. The platform's share is rounded down so the remainder always
 * falls to the creator — rounding should never quietly favour the house.
 */
export function splitSale(amountCents: number, platformCutBps: number) {
  const platform = Math.floor((amountCents * platformCutBps) / 10000);
  return { platformCents: platform, creatorCents: amountCents - platform };
}

/**
 * What the creator actually banks per sale, after the card fee and the
 * platform's share. Stripe's US card pricing is 2.9% + 30¢; the fee is taken
 * off the top before anything is split, because that is what Stripe does.
 */
export function creatorTakeHome(amountCents: number, platformCutBps: number) {
  const stripeFee = Math.round(amountCents * 0.029) + 30;
  const net = Math.max(0, amountCents - stripeFee);
  const { creatorCents, platformCents } = splitSale(net, platformCutBps);
  return { stripeFee, net, creatorCents, platformCents };
}

"use server";

import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export type BuyState = { error?: string };

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/**
 * Sends a signed-in viewer to Stripe to rent or buy one title.
 *
 * The price is read from the database here, never taken from the form. A form
 * field is a suggestion from the browser; letting it set the amount would let
 * anyone buy a film for a cent.
 *
 * Nothing is granted at this point. The webhook creates the entitlement after
 * Stripe confirms the payment — coming back to a success URL only proves the
 * person returned from a page.
 */
export async function startPurchase(
  _prev: BuyState,
  formData: FormData,
): Promise<BuyState> {
  const slug = String(formData.get("slug") ?? "");
  const kind = String(formData.get("kind") ?? "");

  if (kind !== "rental" && kind !== "purchase") {
    return { error: "Choose rent or buy." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/title/${slug}`);

  const { data: title } = await supabase
    .from("titles")
    .select(
      "id, slug, title, status, currency, rental_price_cents, purchase_price_cents, rental_hours, poster_url",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!title || title.status !== "published") {
    return { error: "That title is not available." };
  }

  const amount =
    kind === "rental" ? title.rental_price_cents : title.purchase_price_cents;

  if (!amount) {
    return {
      error:
        kind === "rental"
          ? "This title is not available to rent."
          : "This title is not available to buy.",
    };
  }

  // Already own it? Don't take the money twice.
  const { data: existing } = await supabase
    .from("entitlements")
    .select("kind, expires_at")
    .eq("user_id", user.id)
    .eq("title_id", title.id)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .limit(1)
    .maybeSingle();

  if (existing?.kind === "purchase") {
    return { error: "You already own this — it is in your library." };
  }
  if (existing && kind === "rental") {
    return { error: "Your rental of this title is still active." };
  }

  const label =
    kind === "rental"
      ? `${title.title} — ${title.rental_hours}-hour rental`
      : `${title.title} — buy`;

  let url: string | null = null;
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: title.currency,
            unit_amount: amount,
            // Prices are per title and set by creators, so there is no stored
            // Stripe Price to reference — the amount is sent per checkout,
            // read from the database a few lines above.
            product_data: {
              name: label,
              ...(title.poster_url ? { images: [title.poster_url] } : {}),
            },
            tax_behavior: "inclusive",
          },
        },
      ],
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        title_id: title.id,
        kind,
        rental_hours: String(title.rental_hours),
      },
      payment_intent_data: {
        metadata: { user_id: user.id, title_id: title.id, kind },
      },
      success_url: `${siteUrl()}/title/${title.slug}?bought=1`,
      cancel_url: `${siteUrl()}/title/${title.slug}?cancelled=1`,
    });
    url = session.url;
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not open checkout.",
    };
  }

  if (!url) return { error: "Stripe did not return a checkout page." };
  redirect(url);
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { openBillingPortal } from "@/app/plans/actions";
import { InviteLink } from "@/components/invite-link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Your account" };

const roleLabel: Record<string, string> = {
  viewer: "Viewer",
  creator: "Creator",
  admin: "Administrator",
};

/** Stripe's own vocabulary, said plainly. */
const statusLabel: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment failed",
  canceled: "Cancelled",
  unpaid: "Unpaid",
  incomplete: "Payment not finished",
  incomplete_expired: "Payment expired",
  paused: "Paused",
};

export default async function AccountPage(props: PageProps<"/account">) {
  const { checkout } = await props.searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, display_name, affiliate_code")
      .eq("id", user.id)
      .single(),
    supabase
      .from("subscriptions")
      .select("plan_id, status, current_period_end, cancel_at_period_end")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const live = subscription && ["active", "trialing"].includes(subscription.status);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      {checkout === "success" && (
        <p className="mb-8 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent-strong">
          Payment received. If your subscription is not shown yet, refresh in a
          few seconds — we are waiting for Stripe to confirm it.
        </p>
      )}

      <h1 className="text-2xl font-semibold tracking-tight">
        {profile?.display_name || "Your account"}
      </h1>
      <p className="mt-2 text-sm text-muted">{user.email}</p>

      <dl className="mt-10 divide-y divide-border/60 border-y border-border/60">
        <div className="flex items-center justify-between py-4">
          <dt className="text-sm text-muted">Role</dt>
          <dd className="text-sm">
            {roleLabel[profile?.role ?? "viewer"] ?? profile?.role}
          </dd>
        </div>

        <div className="flex items-center justify-between gap-4 py-4">
          <dt className="text-sm text-muted">Subscription</dt>
          <dd className="text-right text-sm">
            {subscription ? (
              <>
                <span className={live ? "text-foreground" : "text-red-300"}>
                  {statusLabel[subscription.status] ?? subscription.status}
                </span>
                {subscription.current_period_end && (
                  <span className="block text-xs text-muted">
                    {subscription.cancel_at_period_end ? "Ends" : "Renews"}{" "}
                    {new Date(
                      subscription.current_period_end,
                    ).toLocaleDateString("en-IE")}
                  </span>
                )}
              </>
            ) : (
              <Link href="/plans" className="text-accent hover:underline">
                Choose a plan
              </Link>
            )}
          </dd>
        </div>

        <div className="flex items-center justify-between py-4">
          <dt className="text-sm text-muted">Your referral code</dt>
          <dd className="font-mono text-sm tracking-wider text-accent">
            {profile?.affiliate_code ?? "—"}
          </dd>
        </div>
      </dl>

      {profile?.affiliate_code && (
        <div className="mt-8">
          <p className="mb-2 text-xs tracking-wide text-muted">
            Share this link — anyone who signs up through it is credited to you.
          </p>
          <InviteLink url={`${site}/signup?ref=${profile.affiliate_code}`} />
        </div>
      )}

      <div className="mt-12 flex flex-wrap gap-3">
        {subscription && (
          <form action={openBillingPortal}>
            <button
              type="submit"
              className="rounded-full border border-border px-5 py-2.5 text-sm transition-colors hover:border-accent hover:text-accent"
            >
              Manage billing
            </button>
          </form>
        )}
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-full border border-border px-5 py-2.5 text-sm text-muted transition-colors hover:border-red-500/40 hover:text-red-300"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}

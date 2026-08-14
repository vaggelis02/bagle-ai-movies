import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { InviteLink } from "@/components/invite-link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Your account" };

const roleLabel: Record<string, string> = {
  viewer: "Viewer",
  creator: "Creator",
  admin: "Administrator",
};

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Row Level Security means this can only ever return this user's own row.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, affiliate_code")
    .eq("id", user.id)
    .single();

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
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
        <div className="flex items-center justify-between py-4">
          <dt className="text-sm text-muted">Subscription</dt>
          <dd className="text-sm text-muted">None yet</dd>
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

      <form action={signOut} className="mt-12">
        <button
          type="submit"
          className="rounded-full border border-border px-5 py-2.5 text-sm text-muted transition-colors hover:border-red-500/40 hover:text-red-300"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}

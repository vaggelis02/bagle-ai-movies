import { SupportChat } from "@/components/support-chat";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Support" };

export default async function SupportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Support</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Answers about subscriptions, billing, and how BAGLE FLIX works.
      </p>
      <div className="mt-8">
        <SupportChat signedIn={Boolean(user)} />
      </div>
    </main>
  );
}

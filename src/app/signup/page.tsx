import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-ui";
import { SignupForm } from "@/components/signup-form";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Create account" };

export default async function SignupPage(props: PageProps<"/signup">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/account");

  // Invite links look like /signup?ref=ABCD2345
  const { ref } = await props.searchParams;

  return (
    <AuthShell
      title="Create your account"
      subtitle="One account for watching, and for publishing your own films."
      footer={
        <>
          Already have one?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm referral={typeof ref === "string" ? ref : undefined} />
    </AuthShell>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-ui";
import { LoginForm } from "@/components/login-form";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/account");

  const { error } = await props.searchParams;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to keep watching."
      footer={
        <>
          No account yet?{" "}
          <Link href="/signup" className="text-accent hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <LoginForm initialError={typeof error === "string" ? error : undefined} />
    </AuthShell>
  );
}

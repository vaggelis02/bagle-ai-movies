import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <ComingSoon
      phase="Phase 1"
      title="Sign in"
      description="Email and magic-link sign-in goes live as soon as the database is connected."
    />
  );
}

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Still the publishable key, still subject to Row Level Security — the
 * difference is that it reads the user's session from cookies, so `auth.uid()`
 * inside a policy resolves to the logged-in user. Use this for anything that
 * needs to know who is asking.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The proxy refreshes the session instead, so this is safe to skip.
          }
        },
      },
    },
  );
}

/**
 * Privileged client. Bypasses Row Level Security entirely.
 *
 * Only for server code that has already checked the caller's permission by
 * itself — minting a playback token, handling a Stripe webhook, an admin
 * action. Never import this into anything that reaches the browser.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

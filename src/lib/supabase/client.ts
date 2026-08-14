import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components.
 *
 * This one runs in the browser and therefore only ever holds the publishable
 * key. Every query it makes is filtered by Row Level Security, so the worst a
 * tampered-with browser can do is ask for rows the policies already allow.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Earnings" };

type Sale = {
  kind: "rental" | "purchase";
  amount_cents: number;
  creator_cents: number;
  currency: string;
  created_at: string;
  titles: { title: string; slug: string } | null;
};

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function EarningsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/creators/earnings");

  // Row Level Security returns only sales of titles this person owns — the
  // policy is what makes this page safe, not a WHERE clause we could forget.
  const { data } = await supabase
    .from("entitlements")
    .select("kind, amount_cents, creator_cents, currency, created_at, titles(title, slug)")
    .order("created_at", { ascending: false });

  const sales = (data ?? []) as unknown as Sale[];

  const total = sales.reduce((n, s) => n + s.creator_cents, 0);
  const thisMonth = sales
    .filter((s) => monthKey(s.created_at) === monthKey(new Date().toISOString()))
    .reduce((n, s) => n + s.creator_cents, 0);

  const byTitle = new Map<
    string,
    { title: string; slug: string; rentals: number; purchases: number; cents: number }
  >();
  for (const s of sales) {
    const key = s.titles?.slug ?? "unknown";
    const row =
      byTitle.get(key) ??
      {
        title: s.titles?.title ?? "Removed title",
        slug: key,
        rentals: 0,
        purchases: 0,
        cents: 0,
      };
    if (s.kind === "rental") row.rentals += 1;
    else row.purchases += 1;
    row.cents += s.creator_cents;
    byTitle.set(key, row);
  }

  const byMonth = new Map<string, number>();
  for (const s of sales) {
    byMonth.set(
      monthKey(s.created_at),
      (byMonth.get(monthKey(s.created_at)) ?? 0) + s.creator_cents,
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Earnings</h1>
        <Link
          href="/creators"
          className="text-sm text-muted transition-colors hover:text-accent"
        >
          Your films →
        </Link>
      </div>

      {sales.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-border bg-surface p-8">
          <p className="text-sm leading-relaxed text-muted">
            Nothing yet. This page fills in as people rent and buy your work —
            every sale, what you earned from it, and what it adds up to.
          </p>
          <Link
            href="/creators/pricing"
            className="mt-5 inline-block rounded-full border border-border px-5 py-2.5 text-sm transition-colors hover:border-accent hover:text-accent"
          >
            Check your prices
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface p-6">
              <p className="text-xs tracking-wide text-muted uppercase">
                This month
              </p>
              <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-accent-strong">
                {formatMoney(thisMonth)}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-6">
              <p className="text-xs tracking-wide text-muted uppercase">
                All time
              </p>
              <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">
                {formatMoney(total)}
              </p>
              <p className="mt-1 text-xs text-muted">
                {sales.length} sale{sales.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <section className="mt-12">
            <h2 className="text-xs font-medium tracking-[0.15em] text-muted uppercase">
              By title
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 text-left text-xs font-medium tracking-wide text-muted uppercase">
                      Title
                    </th>
                    <th className="py-2 text-right text-xs font-medium tracking-wide text-muted uppercase">
                      Rented
                    </th>
                    <th className="py-2 text-right text-xs font-medium tracking-wide text-muted uppercase">
                      Bought
                    </th>
                    <th className="py-2 text-right text-xs font-medium tracking-wide text-muted uppercase">
                      You earned
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...byTitle.values()]
                    .sort((a, b) => b.cents - a.cents)
                    .map((row) => (
                      <tr key={row.slug} className="border-b border-border/60">
                        <td className="py-3">
                          <Link
                            href={`/title/${row.slug}`}
                            className="hover:text-accent"
                          >
                            {row.title}
                          </Link>
                        </td>
                        <td className="py-3 text-right font-mono tabular-nums">
                          {row.rentals}
                        </td>
                        <td className="py-3 text-right font-mono tabular-nums">
                          {row.purchases}
                        </td>
                        <td className="py-3 text-right font-mono font-semibold tabular-nums text-accent-strong">
                          {formatMoney(row.cents)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-xs font-medium tracking-[0.15em] text-muted uppercase">
              By month
            </h2>
            <dl className="mt-4 divide-y divide-border/60 border-y border-border/60">
              {[...byMonth.entries()]
                .sort((a, b) => b[0].localeCompare(a[0]))
                .map(([key, cents]) => (
                  <div
                    key={key}
                    className="flex items-baseline justify-between py-3"
                  >
                    <dt className="text-sm text-muted">{monthLabel(key)}</dt>
                    <dd className="font-mono text-sm font-semibold tabular-nums">
                      {formatMoney(cents)}
                    </dd>
                  </div>
                ))}
            </dl>
          </section>

          <p className="mt-10 text-xs leading-relaxed text-muted">
            Amounts are what you earned after the card fee and the 20% platform
            share, recorded at the price each sale was made at. Payouts are not
            connected yet — this is the record of what you are owed.
          </p>
        </>
      )}
    </main>
  );
}

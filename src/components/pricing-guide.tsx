"use client";

import { useState } from "react";
import {
  MAX_PRICE_CENTS,
  MIN_PURCHASE_CENTS,
  MIN_RENTAL_CENTS,
  SUGGESTED_PURCHASE_CENTS,
  SUGGESTED_RENTAL_CENTS,
  creatorTakeHome,
  formatMoney,
} from "@/lib/pricing";

const PLATFORM_CUT_BPS = 2000;

/** Rough shapes of demand, so the numbers below are not one flattering case. */
const SCENARIOS = [
  { label: "A quiet month", rentals: 10, buys: 1 },
  { label: "Your circle shares it", rentals: 60, buys: 8 },
  { label: "It travels", rentals: 400, buys: 50 },
];

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-sm text-muted">{label}</span>
      <span
        className={`font-mono text-sm tabular-nums ${strong ? "font-semibold text-accent-strong" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

export function PricingGuide() {
  const [rental, setRental] = useState(SUGGESTED_RENTAL_CENTS);
  const [purchase, setPurchase] = useState(SUGGESTED_PURCHASE_CENTS);

  const r = creatorTakeHome(rental, PLATFORM_CUT_BPS);
  const p = creatorTakeHome(purchase, PLATFORM_CUT_BPS);

  const tooCheap = rental < MIN_RENTAL_CENTS || purchase < MIN_PURCHASE_CENTS;
  const steep = rental > 999 || purchase > 2499;

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold">Try your prices</h2>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 flex items-baseline justify-between text-sm">
              <span className="text-muted">Rental</span>
              <span className="font-mono font-semibold">
                {formatMoney(rental)}
              </span>
            </span>
            <input
              type="range"
              min={MIN_RENTAL_CENTS}
              max={2000}
              step={50}
              value={rental}
              onChange={(e) => setRental(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
          </label>

          <label className="block">
            <span className="mb-2 flex items-baseline justify-between text-sm">
              <span className="text-muted">Purchase</span>
              <span className="font-mono font-semibold">
                {formatMoney(purchase)}
              </span>
            </span>
            <input
              type="range"
              min={MIN_PURCHASE_CENTS}
              max={5000}
              step={100}
              value={purchase}
              onChange={(e) => setPurchase(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
          </label>
        </div>

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-medium tracking-[0.12em] text-muted uppercase">
              Per rental
            </h3>
            <div className="mt-2 divide-y divide-border/60">
              <Row label="Viewer pays" value={formatMoney(rental)} />
              <Row label="Card fee" value={`− ${formatMoney(r.stripeFee)}`} />
              <Row
                label="BAGLE FLIX (20%)"
                value={`− ${formatMoney(r.platformCents)}`}
              />
              <Row label="You receive" value={formatMoney(r.creatorCents)} strong />
            </div>
          </div>

          <div>
            <h3 className="text-xs font-medium tracking-[0.12em] text-muted uppercase">
              Per purchase
            </h3>
            <div className="mt-2 divide-y divide-border/60">
              <Row label="Viewer pays" value={formatMoney(purchase)} />
              <Row label="Card fee" value={`− ${formatMoney(p.stripeFee)}`} />
              <Row
                label="BAGLE FLIX (20%)"
                value={`− ${formatMoney(p.platformCents)}`}
              />
              <Row label="You receive" value={formatMoney(p.creatorCents)} strong />
            </div>
          </div>
        </div>

        {tooCheap && (
          <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Below {formatMoney(MIN_RENTAL_CENTS)} for a rental or{" "}
            {formatMoney(MIN_PURCHASE_CENTS)} to buy, the card fee eats most of
            the sale. Those are the lowest prices we accept.
          </p>
        )}
        {steep && !tooCheap && (
          <p className="mt-6 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent-strong">
            You can charge this — but you are now above what people pay for a
            new release on the big stores. Worth it only if your audience
            already knows your work.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">What that adds up to</h2>
        <p className="mt-2 text-sm text-muted">
          Nobody can promise you an audience. These are just three shapes a
          month can take, at the prices you picked above.
        </p>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 text-left text-xs font-medium tracking-wide text-muted uppercase">
                  Month
                </th>
                <th className="py-2 text-right text-xs font-medium tracking-wide text-muted uppercase">
                  Rentals
                </th>
                <th className="py-2 text-right text-xs font-medium tracking-wide text-muted uppercase">
                  Purchases
                </th>
                <th className="py-2 text-right text-xs font-medium tracking-wide text-muted uppercase">
                  You receive
                </th>
              </tr>
            </thead>
            <tbody>
              {SCENARIOS.map((s) => (
                <tr key={s.label} className="border-b border-border/60">
                  <td className="py-3">{s.label}</td>
                  <td className="py-3 text-right font-mono tabular-nums">
                    {s.rentals}
                  </td>
                  <td className="py-3 text-right font-mono tabular-nums">
                    {s.buys}
                  </td>
                  <td className="py-3 text-right font-mono font-semibold tabular-nums text-accent-strong">
                    {formatMoney(
                      s.rentals * r.creatorCents + s.buys * p.creatorCents,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold">How to choose</h2>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
          <li>
            <span className="text-foreground">Price for the second viewer.</span>{" "}
            The first is a friend who would pay anything. The second is a
            stranger deciding in four seconds.
          </li>
          <li>
            <span className="text-foreground">Renting is the front door.</span>{" "}
            Most people will not buy a film by someone they have never heard of.
            Make renting easy and let buying be for the ones who loved it.
          </li>
          <li>
            <span className="text-foreground">
              A high price is not a signal of quality here.
            </span>{" "}
            On a new platform it reads as a mistake. Earn the higher price with
            your second film.
          </li>
          <li>
            <span className="text-foreground">You can change it any time.</span>{" "}
            Anyone who already paid keeps what they bought at the old price.
          </li>
        </ul>
        <p className="mt-5 text-sm text-muted">
          If you want one answer rather than a slider:{" "}
          <span className="text-foreground">
            {formatMoney(SUGGESTED_RENTAL_CENTS)} to rent,{" "}
            {formatMoney(SUGGESTED_PURCHASE_CENTS)} to buy.
          </span>{" "}
          That is the shape most people expect, and you can raise it later.
        </p>
      </section>

      <p className="text-xs text-muted">
        Prices are in US dollars and include VAT where it applies. The maximum
        we accept is {formatMoney(MAX_PRICE_CENTS)}.
      </p>
    </div>
  );
}

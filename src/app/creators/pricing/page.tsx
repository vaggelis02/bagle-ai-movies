import Link from "next/link";
import { PricingGuide } from "@/components/pricing-guide";

export const metadata = { title: "What to charge" };

export default function CreatorPricingPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-balance">
        What should you charge?
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
        You set the price of your own films and series. Nobody here decides what
        your work is worth — but the numbers below are what the choice actually
        means for you.
      </p>

      <div className="mt-10">
        <PricingGuide />
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link
          href="/creators/new"
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-[#1a1206] transition-colors hover:bg-accent-strong"
        >
          Upload a film
        </Link>
        <Link
          href="/plans"
          className="rounded-full border border-border px-5 py-2.5 text-sm transition-colors hover:border-accent hover:text-accent"
        >
          See creator plans
        </Link>
      </div>
    </main>
  );
}

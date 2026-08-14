import Link from "next/link";

/**
 * Placeholder catalogue. These are NOT database records — the real catalogue
 * arrives in Phase 3, read from Supabase. Kept here so the landing page shows
 * the intended shape of the grid before any data exists.
 */
const upcoming = [
  {
    title: "Demigods vs Titans",
    meta: "Film · 26 min · Epic",
    tint: "from-[#3a2a12] to-[#0d0b08]",
    status: "First release",
  },
  {
    title: "Coming soon",
    meta: "Series",
    tint: "from-[#16223a] to-[#08080b]",
    status: null,
  },
  {
    title: "Coming soon",
    meta: "Film",
    tint: "from-[#2a1630] to-[#08080b]",
    status: null,
  },
  {
    title: "Coming soon",
    meta: "Film",
    tint: "from-[#12281f] to-[#08080b]",
    status: null,
  },
  {
    title: "Coming soon",
    meta: "Series",
    tint: "from-[#301616] to-[#08080b]",
    status: null,
  },
];

export default function Home() {
  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="bagle-drift pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[64rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,var(--glow),transparent_65%)] blur-3xl"
        />
        <div className="relative mx-auto w-full max-w-6xl px-6 pt-24 pb-20 sm:pt-32 sm:pb-28">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs tracking-wide text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            AI-generated cinema only
          </p>

          <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
            The BagleFlix of{" "}
            <span className="text-accent">AI Generated Cinema.</span>
          </h1>

          <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted sm:text-lg">
            Films and series that were never shot with a camera. One
            subscription to watch them — one plan to publish your own.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/plans"
              className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-[#1a1206] transition-colors hover:bg-accent-strong"
            >
              See plans
            </Link>
            <Link
              href="/creators"
              className="rounded-full border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
            >
              Publish your film
            </Link>
          </div>
        </div>
      </section>

      {/* Catalogue preview */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-sm font-medium tracking-[0.15em] text-muted uppercase">
            In the catalogue
          </h2>
        </div>

        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {upcoming.map((item, i) => (
            <li key={i}>
              <div
                className={`group relative aspect-2/3 overflow-hidden rounded-xl border border-border bg-gradient-to-b ${item.tint}`}
              >
                <div className="absolute inset-0 flex flex-col justify-end p-4">
                  {item.status && (
                    <span className="mb-2 w-fit rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent-strong">
                      {item.status}
                    </span>
                  )}
                  <p className="text-sm leading-snug font-medium text-foreground">
                    {item.title}
                  </p>
                  <p className="mt-2 text-[11px] text-muted">{item.meta}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Two sides */}
      <section className="border-t border-border/60 bg-surface/40">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-20 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-8">
            <h3 className="text-xl font-semibold">For viewers</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              One monthly subscription, the whole catalogue. No ads, in 1080p,
              picking up right where you left off.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-8">
            <h3 className="text-xl font-semibold">For creators</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Publish your films and series, see how many people watched them,
              and get paid for the audience you bring.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

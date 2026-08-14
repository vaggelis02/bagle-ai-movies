import Link from "next/link";

/**
 * Honest placeholder for routes that are scaffolded but not yet built.
 * Every one of these gets replaced by the real screen in a later phase —
 * no button on this site should pretend to do something it cannot do.
 */
export function ComingSoon({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-md text-center">
        <p className="text-xs tracking-[0.2em] text-accent uppercase">
          {phase}
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">{description}</p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-full border border-border px-5 py-2.5 text-sm transition-colors hover:border-accent hover:text-accent"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}

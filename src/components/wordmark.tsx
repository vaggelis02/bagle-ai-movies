import Link from "next/link";

export function Wordmark() {
  return (
    <Link href="/" className="group inline-flex items-baseline gap-1.5">
      <span className="text-lg font-semibold tracking-[0.2em] text-foreground">
        BAGLE
      </span>
      <span className="text-lg font-semibold tracking-[0.2em] text-accent transition-colors group-hover:text-accent-strong">
        FLIX
      </span>
    </Link>
  );
}

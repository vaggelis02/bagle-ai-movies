import Link from "next/link";

export type PosterTitle = {
  slug: string;
  title: string;
  kind: "film" | "series";
  poster_url: string | null;
  release_year: number | null;
  genres: string[] | null;
};

/**
 * A poster. When a title has no artwork yet, the card falls back to a tinted
 * panel derived from the slug rather than a broken image or a grey box — a
 * catalogue of empty rectangles reads as broken, not as "coming soon".
 */
export function PosterCard({ title }: { title: PosterTitle }) {
  const hue = [...title.slug].reduce((n, c) => n + c.charCodeAt(0), 0) % 360;

  return (
    <Link
      href={`/title/${title.slug}`}
      className="group block w-[150px] shrink-0 sm:w-[180px]"
    >
      <div
        className="relative aspect-2/3 overflow-hidden rounded-xl border border-border transition-colors group-hover:border-accent/60"
        style={
          title.poster_url
            ? undefined
            : {
                background: `linear-gradient(160deg, hsl(${hue} 30% 18%), var(--background))`,
              }
        }
      >
        {title.poster_url && (
          // Posters come from creator uploads on arbitrary hosts, so a plain
          // img avoids configuring every possible remote domain.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={title.poster_url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        )}
        {!title.poster_url && (
          <div className="absolute inset-0 flex items-end p-3">
            <span className="text-sm leading-snug font-medium text-foreground">
              {title.title}
            </span>
          </div>
        )}
      </div>

      <p className="mt-2 truncate text-sm text-foreground">{title.title}</p>
      <p className="text-xs text-muted">
        {title.kind === "series" ? "Series" : "Film"}
        {title.release_year ? ` · ${title.release_year}` : ""}
      </p>
    </Link>
  );
}

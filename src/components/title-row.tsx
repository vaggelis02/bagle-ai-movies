import { PosterCard, type PosterTitle } from "@/components/poster-card";

/**
 * One horizontal shelf of posters. Scrolls sideways inside itself so the page
 * body never scrolls horizontally, and hides entirely when it has nothing in
 * it — an empty shelf with a heading looks like a bug.
 */
export function TitleRow({
  heading,
  titles,
}: {
  heading: string;
  titles: PosterTitle[];
}) {
  if (titles.length === 0) return null;

  return (
    <section className="mt-10 first:mt-0">
      <h2 className="mb-3 px-6 text-sm font-medium tracking-[0.12em] text-muted uppercase">
        {heading}
      </h2>
      <div className="flex gap-4 overflow-x-auto px-6 pb-2 [scrollbar-width:thin]">
        {titles.map((t) => (
          <PosterCard key={t.slug} title={t} />
        ))}
      </div>
    </section>
  );
}

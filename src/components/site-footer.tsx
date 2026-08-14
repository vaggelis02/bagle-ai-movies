import { Wordmark } from "@/components/wordmark";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-10 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
        <Wordmark />
        <p>© {new Date().getFullYear()} SV SOCIAL MEDIA LTD · Cyprus</p>
      </div>
    </footer>
  );
}

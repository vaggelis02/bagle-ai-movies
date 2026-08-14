import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>
        <div className="mt-8">{children}</div>
        <div className="mt-8 text-center text-sm text-muted">{footer}</div>
      </div>
    </main>
  );
}

export function Field({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted">
        {label}
      </span>
      <input
        {...props}
        className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-accent"
      />
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function SubmitButton({
  children,
  pending,
  variant = "primary",
}: {
  children: ReactNode;
  pending: boolean;
  variant?: "primary" | "ghost";
}) {
  const base =
    "w-full rounded-full px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-60";
  const style =
    variant === "primary"
      ? "bg-accent text-[#1a1206] hover:bg-accent-strong"
      : "border border-border text-foreground hover:border-accent hover:text-accent";

  return (
    <button type="submit" disabled={pending} className={`${base} ${style}`}>
      {pending ? "Working…" : children}
    </button>
  );
}

export function Message({ error, notice }: { error?: string; notice?: string }) {
  if (!error && !notice) return null;
  return (
    <p
      role="status"
      className={`rounded-lg border px-3.5 py-2.5 text-sm ${
        error
          ? "border-red-500/30 bg-red-500/10 text-red-300"
          : "border-accent/30 bg-accent/10 text-accent-strong"
      }`}
    >
      {error ?? notice}
    </p>
  );
}

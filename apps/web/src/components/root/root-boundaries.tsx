import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { normalizeError, reportError } from "#/lib/error-reporting";

function reloadPage() {
  globalThis.location?.reload();
}

export function RootPending() {
  // Show this while the router waits for a route loader or server response.
  return (
    <main className="bg-paper text-ink grid min-h-screen place-items-center">
      <output
        aria-live="polite"
        className="border-line bg-paper-raised flex items-center gap-3 rounded-sm border px-5 py-4 shadow-sm"
      >
        <span className="bg-mineral size-2.5 animate-pulse rounded-full" />
        <span className="text-sm font-medium">Setting the table…</span>
      </output>
    </main>
  );
}

export function RootError({ error }: { error: unknown }) {
  const normalized = useMemo(() => normalizeError(error), [error]);

  // Report once per distinct error while showing a useful recovery action.
  useEffect(() => {
    reportError(normalized, { kind: "root.error-boundary" });
  }, [normalized]);

  return (
    <BoundaryCard
      eyebrow="A momentary pause"
      title="Something went quiet."
      description="This is on us. Refresh the page, or return home while we restore the experience."
    >
      <button
        type="button"
        onClick={reloadPage}
        className="bg-ink text-paper-raised hover:bg-mineral-dark rounded-sm px-4 py-2 text-sm font-medium"
      >
        Reload
      </button>
      <Link
        to="/"
        className="border-line hover:border-mineral rounded-sm border px-4 py-2 text-sm font-medium"
      >
        Go home
      </Link>
      {import.meta.env.DEV && (
        <pre className="text-muted mt-5 max-h-40 overflow-auto text-left text-xs whitespace-pre-wrap">
          {normalized.stack ?? normalized.message}
        </pre>
      )}
    </BoundaryCard>
  );
}

export function RootNotFound() {
  return (
    <BoundaryCard
      eyebrow="404 · Off the map"
      title="That page has drifted away."
      description="The page you're looking for does not exist."
    >
      <Link
        to="/"
        className="bg-ink text-paper-raised hover:bg-mineral-dark rounded-sm px-4 py-2 text-sm font-medium"
      >
        Return home
      </Link>
    </BoundaryCard>
  );
}

function BoundaryCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  // Reuse one visual layout for the root error and not-found pages.
  return (
    <main className="bg-paper text-ink relative grid min-h-screen place-items-center overflow-hidden px-5 py-12 text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(#b6ad99_0.7px,transparent_0.7px)] bg-size-[20px_20px] opacity-40"
      />
      <section className="border-line bg-paper-raised relative w-full max-w-lg rounded-sm border p-8 shadow-[0_18px_55px_-35px_rgba(24,38,43,0.35)] sm:p-10">
        <div
          aria-hidden="true"
          className="bg-mineral mx-auto mb-6 grid size-12 place-items-center rounded-sm"
        >
          <span className="bg-citron size-3 rotate-45 rounded-[1px]" />
        </div>
        <p className="text-mineral text-xs font-semibold tracking-[0.16em] uppercase">{eyebrow}</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted mx-auto mt-2 max-w-sm text-sm leading-6">{description}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">{children}</div>
      </section>
    </main>
  );
}

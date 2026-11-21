import { Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "#/components/ui/toast";
import { reportError } from "#/lib/error-reporting";
import { Sentry } from "#/lib/sentry";

function reloadPage() {
  globalThis.location?.reload();
}

export function RootLayout() {
  // Listen for errors outside React and show app-wide toast messages in this layout.
  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) =>
      reportError(event.reason, { kind: "unhandledrejection" });
    const onError = (event: ErrorEvent) =>
      reportError(event.error ?? event.message, {
        kind: "window.error",
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
      });
    globalThis.addEventListener("unhandledrejection", onUnhandledRejection);
    globalThis.addEventListener("error", onError);
    return () => {
      globalThis.removeEventListener("unhandledrejection", onUnhandledRejection);
      globalThis.removeEventListener("error", onError);
    };
  }, []);

  return (
    <Sentry.ErrorBoundary fallback={RootCrashFallback}>
      <Outlet />
      <Toaster />
    </Sentry.ErrorBoundary>
  );
}

function RootCrashFallback() {
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
        <p className="text-mineral text-xs font-semibold tracking-[0.16em] uppercase">
          A momentary pause
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Something went quiet.</h1>
        <p className="text-muted mx-auto mt-2 max-w-sm text-sm leading-6">
          Please refresh and try again.
        </p>
        <button
          type="button"
          onClick={reloadPage}
          className="bg-ink text-paper-raised hover:bg-mineral-dark mt-7 rounded-sm px-4 py-2 text-sm font-medium"
        >
          Reload
        </button>
      </section>
    </main>
  );
}

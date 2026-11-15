import { Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { reportError } from "@/lib/error-reporting";
import { Sentry } from "@/lib/sentry";

function reloadPage() {
  globalThis.location?.reload();
}

export function RootLayout() {
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
    </Sentry.ErrorBoundary>
  );
}

function RootCrashFallback() {
  return (
    <>
      Something went quiet.
      <br />
      Please refresh and try again.
      <br />
      <button type="button" onClick={reloadPage}>
        Reload
      </button>
    </>
  );
}

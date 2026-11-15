import { Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { normalizeError, reportError } from "@/lib/error-reporting";

function reloadPage() {
  globalThis.location?.reload();
}

export function RootPending() {
  return null;
}

export function RootError({ error }: { error: unknown }) {
  const normalized = useMemo(() => normalizeError(error), [error]);

  useEffect(() => {
    reportError(normalized, { kind: "root.error-boundary" });
  }, [normalized]);

  return (
    <>
      Something went quiet.
      <br />
      This is on us. Please refresh the page, or return home while we restore the experience.
      <br />
      <button type="button" onClick={reloadPage}>
        Reload
      </button>
      <Link to="/">Go home</Link>
      {import.meta.env.DEV && <>{normalized.stack ?? normalized.message}</>}
    </>
  );
}

export function RootNotFound() {
  return (
    <>
      That page has drifted away.
      <br />
      The page you&apos;re looking for does not exist.
      <br />
      <Link to="/">Return home</Link>
    </>
  );
}

import { Sentry } from "#/lib/sentry";

type ErrorMeta = Record<string, unknown>;

function serializeError(error: unknown) {
  // Convert non-Error values into a small payload that can be recorded reliably.
  return error instanceof Error
    ? { message: error.message, stack: error.stack }
    : { message: String(error) };
}

export function reportError(error: unknown, meta?: ErrorMeta) {
  // Keep the original error and extra context together for later debugging.
  const payload = {
    ...serializeError(error),
    meta,
    href: globalThis.location?.href,
    timestamp: new Date().toISOString(),
  };
  if (import.meta.env.DEV) {
    console.error("[AppError]", payload);
  }
  Sentry.captureException(error, meta ? { extra: meta } : undefined);
}

export function normalizeError(error: unknown) {
  // React boundaries expect an Error even when a loader threw a string or plain object.
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);
  try {
    return new Error(JSON.stringify(error));
  } catch {
    return new Error("Unknown application error");
  }
}

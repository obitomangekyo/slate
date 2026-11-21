import { useEffect, useState } from "react";

function secondsUntil(availableAt: string | undefined, now = Date.now()) {
  if (!availableAt) return 0;
  const timestamp = Date.parse(availableAt);
  if (!Number.isFinite(timestamp)) return 0;
  // Round up so the button never becomes available before the server time.
  return Math.max(0, Math.ceil((timestamp - now) / 1000));
}

export function useEmailResendCooldown(availableAt: string | undefined) {
  // Recalculate once a second only while the cooldown is active.
  const [now, setNow] = useState(() => Date.now());
  const secondsRemaining = secondsUntil(availableAt, now);

  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const timeout = window.setTimeout(() => setNow(Date.now()), 1000);
    return () => window.clearTimeout(timeout);
  }, [secondsRemaining]);

  return secondsRemaining;
}

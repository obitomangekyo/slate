import { Check, Copy, WarningTriangle } from "iconoir-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "#/components/ui/input-group";
import { toastManager } from "#/components/ui/toast";

export function CopyLinkArea() {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState("copied");
      toastManager.add({ type: "success", title: "Slate link copied" });
    } catch {
      setCopyState("error");
      toastManager.add({ type: "error", title: "Could not copy slate link" });
    }
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyState("idle"), 3_000);
  }, []);

  return (
    <InputGroup>
      <InputGroupInput
        readOnly
        type="url"
        value={window.location.href}
        className="overflow-hidden text-ellipsis"
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          type="button"
          onClick={copyLink}
          aria-label={
            copyState === "copied"
              ? "Copied"
              : copyState === "error"
                ? "Copy failed, try again"
                : "Copy public link"
          }
          disabled={copyState === "copied"}
        >
          {copyState === "copied" ? (
            <Check aria-hidden="true" />
          ) : copyState === "error" ? (
            <WarningTriangle aria-hidden="true" />
          ) : (
            <Copy aria-hidden="true" />
          )}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

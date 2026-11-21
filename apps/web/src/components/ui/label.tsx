import { cn } from "cn";
import type { ComponentProps } from "react";

// Require htmlFor so each visible label points to its matching input explicitly.
function Label({ className, htmlFor, ...props }: ComponentProps<"label"> & { htmlFor: string }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: htmlFor is required by this component's API.
    <label
      htmlFor={htmlFor}
      data-slot="label"
      className={cn(
        "text-ink flex items-center gap-2 text-xs leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };

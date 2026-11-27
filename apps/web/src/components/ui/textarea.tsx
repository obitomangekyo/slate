import { cn } from "cn";
import type { ComponentProps } from "react";

// Keep native multi-line editing while applying the same visual rules as Input.
function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-line bg-paper text-ink placeholder:text-muted/75 focus-visible:border-mineral focus-visible:ring-mineral/25 disabled:bg-paper/60 aria-invalid:border-clay aria-invalid:ring-clay/25 flex field-sizing-content min-h-16 w-full rounded-sm border px-3 py-2 text-base transition-colors outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };

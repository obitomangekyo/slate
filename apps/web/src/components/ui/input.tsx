import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "cn";
import type { ComponentProps } from "react";

// Keep native input behavior while applying the app's shared border and focus styles.
function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "border-line bg-paper text-ink file:text-ink placeholder:text-muted-ink/75 focus-visible:border-mineral focus-visible:ring-mineral/25 disabled:bg-paper/60 aria-invalid:border-clay aria-invalid:ring-clay/25 h-9 w-full min-w-0 rounded-sm border px-3 py-1.5 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Input };

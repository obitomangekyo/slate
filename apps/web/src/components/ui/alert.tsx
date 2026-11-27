import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps } from "react";

const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-sm border px-3 py-2.5 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-line bg-paper-raised text-ink",
        destructive:
          "border-clay/45 bg-clay/10 text-ink *:data-[slot=alert-description]:text-ink/85 *:[svg]:text-clay",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

// A message box for important information or errors near the related content.
function Alert({
  className,
  variant,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

// Give the alert a short heading that remains visible to assistive technology.
function AlertTitle({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "text-ink [&_a:hover]:text-mineral font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3",
        className,
      )}
      {...props}
    />
  );
}

// Hold the longer explanation shown under an alert title.
function AlertDescription({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-muted [&_a:hover]:text-mineral text-xs/relaxed text-balance md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-3",
        className,
      )}
      {...props}
    />
  );
}

// Place a related action, such as a retry button, inside the alert.
function AlertAction({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="alert-action" className={cn("absolute top-2 right-2", className)} {...props} />
  );
}

export { Alert, AlertAction, AlertDescription, AlertTitle };

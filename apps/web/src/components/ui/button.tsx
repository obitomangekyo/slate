import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const buttonVariants = cva(
  "group/button focus-visible:border-mineral focus-visible:ring-mineral/30 aria-invalid:border-clay aria-invalid:ring-clay/25 inline-flex shrink-0 items-center justify-center rounded-sm border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-invalid:ring-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-ink text-paper-raised hover:bg-deep-mineral active:bg-ink",
        mineral: "bg-mineral text-paper-raised hover:bg-deep-mineral active:bg-ink",
        outline:
          "border-line bg-paper-raised text-ink hover:border-mineral hover:bg-paper aria-expanded:border-mineral aria-expanded:bg-paper",
        secondary:
          "border-line/70 bg-paper text-ink hover:border-line hover:bg-paper-raised aria-expanded:bg-paper-raised",
        ghost:
          "text-muted-ink hover:bg-paper-raised hover:text-ink aria-expanded:bg-paper-raised aria-expanded:text-ink",
        clay: "border-ink/15 bg-clay text-ink hover:bg-clay/85 focus-visible:border-ink focus-visible:ring-clay/35",
        citron:
          "border-ink/15 bg-citron text-ink hover:bg-citron/80 focus-visible:border-ink focus-visible:ring-citron/40",
        link: "text-mineral hover:text-deep-mineral underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-xs px-2 text-xs in-data-[slot=button-group]:rounded-sm has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1.5 rounded-xs px-2.5 text-[0.8125rem] in-data-[slot=button-group]:rounded-sm has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-2 px-3.5 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-xs in-data-[slot=button-group]:rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-xs in-data-[slot=button-group]:rounded-sm",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };

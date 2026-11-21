import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import { cn } from "cn";

// Use the browser separator role and expose whether the divider runs across or down.
function Separator({ className, orientation = "horizontal", ...props }: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "bg-line shrink-0 data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };

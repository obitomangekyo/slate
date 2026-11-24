import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { cn } from "cn";
import type { Ref } from "react";

type ScrollBarOrientation = NonNullable<ScrollAreaPrimitive.Scrollbar.Props["orientation"]>;

type ScrollAreaProps = ScrollAreaPrimitive.Root.Props & {
  /** Orientations of scrollbars to render. Defaults to vertical-only. */
  scrollbars?: ScrollBarOrientation[];
  /** Optional ref forwarded to the internal viewport element. */
  viewportRef?: Ref<HTMLDivElement>;
};

function ScrollArea({
  className,
  children,
  scrollbars,
  viewportRef: viewportPropRef,
  ...props
}: ScrollAreaProps) {
  const scrollbarOrientations: ScrollBarOrientation[] = scrollbars?.length
    ? scrollbars
    : ["vertical"];
  const showCorner =
    scrollbarOrientations.includes("vertical") && scrollbarOrientations.includes("horizontal");

  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportPropRef}
        data-slot="scroll-area-viewport"
        className="focus-visible:ring-ring/50 size-full rounded-[inherit] transition-all outline-none focus-visible:ring-3 focus-visible:outline"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {Array.from(new Set(scrollbarOrientations)).map((orientation) => (
        <ScrollBar key={orientation} orientation={orientation} />
      ))}
      {showCorner && <ScrollAreaPrimitive.Corner />}
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "pointer-events-none flex touch-none p-px opacity-0 transition-opacity duration-300 select-none data-hovering:pointer-events-auto data-hovering:opacity-100 data-scrolling:pointer-events-auto data-scrolling:opacity-100 data-scrolling:duration-0 data-[orientation=horizontal]:h-2 data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:border-t data-[orientation=horizontal]:border-t-transparent data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2 data-[orientation=vertical]:border-l data-[orientation=vertical]:border-l-transparent",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className={cn("relative z-99 grow rounded-full")}
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

export type { ScrollAreaProps, ScrollBarOrientation };
export { ScrollArea, ScrollBar };

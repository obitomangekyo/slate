import { cn } from "cn";
import { Minus } from "iconoir-react";
import { OTPInput, OTPInputContext } from "input-otp";
import type { ComponentProps } from "react";
import { useContext } from "react";

// Wrap the OTP library and pass through its keyboard and accessibility behavior.
function InputOTP({
  className,
  containerClassName,
  ...props
}: ComponentProps<typeof OTPInput> & {
  containerClassName?: string;
}) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn("flex items-center gap-2 has-disabled:opacity-50", containerClassName)}
      spellCheck={false}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}

// Keep the separate code boxes together as one visual group.
function InputOTPGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  );
}

// Render one code character and show focus or placeholder state from the OTP context.
function InputOTPSlot({
  index,
  className,
  ...props
}: ComponentProps<"div"> & {
  index: number;
}) {
  const inputOTPContext = useContext(OTPInputContext);
  const slot = inputOTPContext?.slots[index];
  const char = slot?.char;
  const hasFakeCaret = slot?.hasFakeCaret;
  const isActive = slot?.isActive;

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(
        "border-line bg-paper text-ink data-[active=true]:border-mineral data-[active=true]:ring-mineral/25 aria-invalid:border-clay aria-invalid:ring-clay/25 relative flex size-11 items-center justify-center rounded-sm border text-lg font-medium transition-colors outline-none aria-invalid:ring-2 data-[active=true]:ring-2",
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink bg-foreground h-4 w-px duration-1000" />
        </div>
      )}
    </div>
  );
}

// Add a visual break between code boxes without changing the entered code.
function InputOTPSeparator({ ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-separator"
      className="text-muted-ink flex items-center [&_svg:not([class*='size-'])]:size-3"
      {...props}
    >
      <Minus />
    </div>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot };

import { Eye, EyeClosed, Lock } from "iconoir-react";
import { type ComponentProps, useCallback, useEffect, useRef, useState } from "react";
import { PasswordStrengthRing } from "#/components/auth/password-strength-ring";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "#/components/ui/input-group";

// Hide a revealed password again after five seconds for shoulder-surfing protection.
const REVEAL_DURATION_MS = 5_000;

type Props = Omit<ComponentProps<"input">, "type"> & {
  strengthScore?: number;
  strengthLabel?: string;
};

function PasswordInput({ strengthScore, strengthLabel, ...inputProps }: Props) {
  // Keep visibility local to this field; never change the value sent to the form.
  const [isVisible, setIsVisible] = useState(false);
  const timeout = useRef<number | undefined>(undefined);
  const hasStrength = strengthScore !== undefined;
  const visible = isVisible && !inputProps.disabled;

  // Remove the timer if the field leaves the page before it hides itself.
  useEffect(() => () => window.clearTimeout(timeout.current), []);

  const toggleVisibility = useCallback(() => {
    // Clear an old timer before either hiding now or starting a fresh reveal period.
    window.clearTimeout(timeout.current);
    if (visible) {
      setIsVisible(false);
      return;
    }

    setIsVisible(true);
    timeout.current = window.setTimeout(() => setIsVisible(false), REVEAL_DURATION_MS);
  }, [visible]);

  return (
    <InputGroup>
      <InputGroupAddon align="inline-start" aria-hidden={hasStrength ? undefined : true}>
        {hasStrength ? (
          <PasswordStrengthRing
            {...(strengthScore !== undefined && { score: strengthScore })}
            {...(strengthLabel !== undefined && { label: strengthLabel })}
          />
        ) : (
          <Lock strokeWidth={1.75} />
        )}
      </InputGroupAddon>
      <InputGroupInput {...inputProps} type={visible ? "text" : "password"} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          disabled={inputProps.disabled}
          onClick={toggleVisibility}
          size="icon-xs"
        >
          {visible ? <EyeClosed strokeWidth={1.75} /> : <Eye strokeWidth={1.75} />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

export { PasswordInput };

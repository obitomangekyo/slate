import { useCallback, useEffect, useRef, useState } from "react";

// `auto` is the wait time before a step advances itself; `busy` blocks extra clicks.
export type Step = { label: string; auto?: number; busy?: boolean };
type StepAdvance = "click" | "timeout";
type StepGenerator = AsyncGenerator<Step, void, StepAdvance>;

// The generator can await real work; it can also tell a click from a timer expiring.
export function useStepper(idle: string, factory: () => StepGenerator) {
  const generator = useRef<StepGenerator | null>(null);
  const advancing = useRef(false);
  const makeGenerator = useRef(factory);
  const [step, setStep] = useState<Step>({ label: idle });
  const [isAdvancing, setIsAdvancing] = useState(false);

  useEffect(() => {
    makeGenerator.current = factory;
  }, [factory]);

  const advanceWith = useCallback(
    async (source: StepAdvance) => {
      if (advancing.current) return;
      advancing.current = true;
      setIsAdvancing(true);
      generator.current ??= makeGenerator.current();
      try {
        const result = await generator.current.next(source);
        if (result.done) {
          generator.current = null;
          setStep({ label: idle });
        } else {
          setStep(result.value);
        }
      } catch {
        generator.current = null;
        setStep({ label: idle });
      } finally {
        advancing.current = false;
        setIsAdvancing(false);
      }
    },
    [idle],
  );

  const advance = useCallback(() => advanceWith("click"), [advanceWith]);

  useEffect(() => {
    if (step.auto == null) return;
    const timeout = setTimeout(() => advanceWith("timeout"), step.auto);
    return () => clearTimeout(timeout);
  }, [step, advanceWith]);

  return { label: step.label, busy: (step.busy ?? false) || isAdvancing, advance };
}

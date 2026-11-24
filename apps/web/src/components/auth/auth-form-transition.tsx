import { animated, config, useSpring } from "@react-spring/web";
import { useLocation } from "@tanstack/react-router";
import { type ReactNode, useMemo } from "react";
import { useMedia } from "react-use";

export function AuthFormTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const reducedMotion = useMedia("(prefers-reduced-motion: reduce)", true);
  const style = useSpring({
    from: { opacity: 0, y: 18, blur: 9 },
    to: { opacity: 1, y: 0, blur: 0 },
    reset: true,
    config: config.gentle,
    immediate: reducedMotion,
    keys: [pathname],
  });
  const animatedStyle = useMemo(
    () => ({
      opacity: style.opacity,
      y: style.y,
      filter: style.blur.to((blur) => `blur(${blur}px)`),
    }),
    [style.blur, style.opacity, style.y],
  );

  // Respect the device's reduced-motion setting by showing the form without animation.
  return (
    <animated.div className="auth-form-card" style={animatedStyle}>
      {children}
    </animated.div>
  );
}

import { animated, config, useSpring } from "@react-spring/web";
import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { cn } from "cn";
import { type PointerEvent, useCallback, useEffect, useMemo } from "react";
import { useMeasure, useMedia } from "react-use";
import SlateAppIcon from "#/assets/svgs/slate-app-icon.svg?react";

export const Route = createFileRoute("/_is_out")({
  // Auth bootstrap needs the browser's path-scoped refresh cookie before it can redirect.
  ssr: false,
  component: RouteComponent,
});

function RouteComponent() {
  const location = useLocation();
  const isRegister = location.pathname === "/register";
  const reducedMotion = useMedia("(prefers-reduced-motion: reduce)", true);
  const [contentRef, contentRect] = useMeasure<HTMLDivElement>();
  const [islandRef, islandRect] = useMeasure<HTMLDivElement>();

  const isWide = contentRect.width >= 1024;
  const halfWidth = contentRect.width / 2;
  const left = isWide
    ? isRegister
      ? (halfWidth - islandRect.width) / 2
      : halfWidth + (halfWidth - islandRect.width) / 2
    : (contentRect.width - islandRect.width) / 2;
  const top = Math.max(16, (contentRect.height - islandRect.height) / 2);

  const [islandStyle, islandApi] = useSpring(() => ({
    x: left,
    y: top,
    config: { ...config.gentle, mass: 1.15, tension: 150, friction: 25 },
    immediate: reducedMotion,
  }));
  const [sceneStyle, sceneApi] = useSpring(() => ({
    x: 0,
    y: 0,
    config: { mass: 5, tension: 110, friction: 32 },
    immediate: reducedMotion,
  }));
  // Keep the spring style objects stable so the animation library owns their updates.
  const sceneAnimatedStyle = useMemo(
    () => ({ x: sceneStyle.x.to((x) => x * 30), y: sceneStyle.y.to((y) => y * 22) }),
    [sceneStyle.x, sceneStyle.y],
  );
  const contentStyle = useMemo(
    () => ({ minHeight: `max(calc(100svh - 7rem), ${islandRect.height + 32}px)` }),
    [islandRect.height],
  );
  const islandAnimatedStyle = useMemo(
    () => ({ x: islandStyle.x, y: islandStyle.y }),
    [islandStyle.x, islandStyle.y],
  );

  useEffect(() => {
    islandApi.start({ x: left, y: top, immediate: reducedMotion });
  }, [islandApi, left, reducedMotion, top]);

  useEffect(() => {
    sceneApi.start({ x: 0, y: 0, immediate: reducedMotion });
  }, [reducedMotion, sceneApi]);

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (reducedMotion) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      const strength = event.pointerType === "touch" ? 0.45 : 1;
      const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2 * strength;
      const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2 * strength;
      sceneApi.start({ x, y });
    },
    [reducedMotion, sceneApi],
  );

  const handlePointerLeave = useCallback(() => {
    if (!reducedMotion) sceneApi.start({ x: 0, y: 0 });
  }, [reducedMotion, sceneApi]);

  return (
    <main
      className="auth-stage relative isolate flex min-h-svh flex-col overflow-x-clip"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <header>
        <div className="container mx-auto flex h-16 w-11/12 items-center gap-2.5 text-xl font-semibold tracking-tighter md:h-18 lg:h-16 xl:h-18">
          <SlateAppIcon aria-hidden="true" className="h-10" />
          <span>Slate</span>
        </div>
      </header>

      <animated.div className="auth-scene" aria-hidden="true" style={sceneAnimatedStyle} />

      <div
        ref={contentRef}
        className="auth-content container mx-auto grid w-11/12 flex-1 grid-cols-1 items-center"
        style={contentStyle}
      >
        <div
          className={cn(
            "auth-editorial hidden flex-col lg:flex",
            isRegister && "auth-editorial--register",
          )}
          aria-hidden="true"
        >
          <p className="auth-editorial__eyebrow text-mineral-dark font-semibold tracking-widest uppercase">
            A shared space for ideas
          </p>
          <p className="leading-none font-medium -tracking-widest">
            Good things
            <br />
            take shape
            <br />
            <em className="text-mineral-dark font-[Georgia,serif] font-normal">together.</em>
          </p>
          <div className="auth-editorial__signature flex opacity-70">
            <span>SLATE / STUDIO</span>
            <span>EST. FOR COLLABORATION</span>
          </div>
        </div>

        <animated.div
          ref={islandRef}
          className="auth-island absolute z-3 w-[min(30rem,calc(100%-2rem))] lg:w-[min(32rem,calc(50%-2rem))]"
          style={islandAnimatedStyle}
        >
          <Outlet />
        </animated.div>
      </div>

      <footer>
        <div className="container mx-auto flex h-12 w-11/12 items-center justify-between text-xs font-semibold tracking-widest text-[rgb(24_38_43/50%)] uppercase">
          <span>Ideas, in good company.</span>
          <span>SLATE &copy; 2026</span>
        </div>
      </footer>
    </main>
  );
}

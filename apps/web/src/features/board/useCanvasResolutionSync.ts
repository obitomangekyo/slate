// ############################################################################
// JOB: keeps the canvas crisp. Phones and retina screens pack several real
// pixels into one CSS pixel, so a canvas left alone looks blurry on them.
// ############################################################################

import { type RefObject, useLayoutEffect } from "react";

// Matches the canvas's inner drawing size to the screen's real pixels, now and
// again every time the browser window is resized.
export function useCanvasResolutionSync(
  dotGridCanvasRef: RefObject<HTMLCanvasElement | null>,
  redrawDotGridAndSyncItemsStage: () => void,
) {
  // useLayoutEffect (not the usual useEffect) on purpose. Resizing a canvas wipes
  // it clean. useLayoutEffect runs before the browser shows anything, so the
  // person never sees a blank or blurry canvas for a split second. This is the
  // one spot in the board where that timing really matters.
  useLayoutEffect(() => {
    // Grab the real canvas. If it does not exist yet, there is nothing to resize.
    const dotGridCanvas = dotGridCanvasRef.current;
    if (!dotGridCanvas) return;

    // The work to do on first load and on every window resize.
    const resizeCanvasBufferToPhysicalPixels = () => {
      // How many real screen pixels sit inside one CSS pixel. Normal screens: 1.
      // Retina and many phones: 2 or 3. Falls back to 1 if the browser gives nothing.
      const physicalPixelsPerCssPixel = window.devicePixelRatio || 1;

      // Size the canvas takes up on the page, in CSS pixels.
      const canvasCssWidth = dotGridCanvas.clientWidth;
      const canvasCssHeight = dotGridCanvas.clientHeight;

      // Make the hidden drawing area as many real pixels as the screen has, so dots look sharp.
      dotGridCanvas.width = Math.round(canvasCssWidth * physicalPixelsPerCssPixel);
      dotGridCanvas.height = Math.round(canvasCssHeight * physicalPixelsPerCssPixel);

      // Get the canvas's drawing pen.
      const canvasContext = dotGridCanvas.getContext("2d");
      if (canvasContext) {
        // Tell the pen to scale everything up automatically, so the rest of our
        // code can keep thinking in normal CSS pixels while the canvas paints in real ones.
        canvasContext.setTransform(
          physicalPixelsPerCssPixel,
          0,
          0,
          physicalPixelsPerCssPixel,
          0,
          0,
        );
      }

      // Resizing erased the canvas, so paint the dots again.
      redrawDotGridAndSyncItemsStage();
    };

    // Do it once right away so the first paint is already sharp.
    resizeCanvasBufferToPhysicalPixels();
    // And again whenever the window changes size.
    window.addEventListener("resize", resizeCanvasBufferToPhysicalPixels);

    // Cleanup: when this component goes away (or the effect reruns), stop
    // listening, so we do not leave a forgotten listener running.
    return () => {
      window.removeEventListener("resize", resizeCanvasBufferToPhysicalPixels);
    };
  }, [dotGridCanvasRef, redrawDotGridAndSyncItemsStage]);
}

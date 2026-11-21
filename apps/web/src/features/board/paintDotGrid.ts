// ############################################################################
// JOB: a pure "paint the dots" function. Give it the canvas plus where the
// camera is and how zoomed in it is, it paints. It remembers nothing, touches
// no React, so it is easy to understand and test on its own.
// ############################################################################

import { DOT_GRID_CELL_SIZE, DOT_GRID_DOT_COLOR, MIN_DOT_RADIUS_ON_SCREEN } from "./constants";

// The facts the painter needs, bundled into one labelled package. Named fields
// are harder to mix up than four loose numbers in a row.
type PaintDotGridOptions = {
  // The canvas element to paint on.
  dotGridCanvas: HTMLCanvasElement;
  // How far the board has been dragged sideways, in board units.
  cameraOffsetX: number;
  // How far the board has been dragged up or down, in board units.
  cameraOffsetY: number;
  // How zoomed in we are. 1 is normal, 2 is twice as big, 0.5 is half size.
  zoomLevel: number;
};

// Normal "remainder" maths gives negative answers for negative numbers
// (-3 % 20 is -3). We want the answer to always land between 0 and the divisor,
// so -3 becomes 17. This keeps the grid wrapping smoothly when dragged left or up.
function positiveRemainder(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

// Wipes the canvas and paints a fresh grid of dots for the current camera.
export function paintDotGrid({
  dotGridCanvas,
  cameraOffsetX,
  cameraOffsetY,
  zoomLevel,
}: PaintDotGridOptions) {
  // Ask the canvas for its "pen" (the 2D drawing tool). If the browser refuses
  // to hand one over, nothing can be drawn, so quit quietly.
  const canvasContext = dotGridCanvas.getContext("2d");
  if (!canvasContext) return;

  // Canvas size as the person sees it, in CSS pixels. We use this instead of
  // canvas.width because that one gets inflated on sharp (retina) screens.
  const canvasCssWidth = dotGridCanvas.clientWidth;
  const canvasCssHeight = dotGridCanvas.clientHeight;

  // Erase the previous frame so old dots do not smear into the new ones.
  canvasContext.clearRect(0, 0, canvasCssWidth, canvasCssHeight);

  // Pick the dot colour before painting.
  canvasContext.fillStyle = DOT_GRID_DOT_COLOR;

  // Gap between neighbouring dots on the actual screen. Zoom in and the dots
  // spread apart, zoom out and they bunch up.
  const dotSpacingOnScreen = DOT_GRID_CELL_SIZE * zoomLevel;

  // Where the first dot at the top-left goes. The board can be dragged miles
  // away, but a grid looks the same after every whole cell, so only the
  // leftover distance matters. That leftover is what makes the dots appear to
  // slide as you drag, without us ever painting off-screen dots.
  const firstVisibleDotScreenX = positiveRemainder(cameraOffsetX, DOT_GRID_CELL_SIZE) * zoomLevel;
  const firstVisibleDotScreenY = positiveRemainder(cameraOffsetY, DOT_GRID_CELL_SIZE) * zoomLevel;

  // Dot size on screen. Never smaller than the minimum so the grid stays
  // visible when zoomed out, and grows gently as you zoom in.
  const dotRadiusOnScreen = Math.max(MIN_DOT_RADIUS_ON_SCREEN, zoomLevel);

  // Start one new shape. We add every dot to this single shape and paint it in
  // one go at the end, which is far faster than painting thousands of dots one by one.
  canvasContext.beginPath();

  // Walk left to right, one column of dots at a time, until we pass the right edge.
  for (
    let dotScreenX = firstVisibleDotScreenX;
    dotScreenX <= canvasCssWidth;
    dotScreenX += dotSpacingOnScreen
  ) {
    // Walk top to bottom down this column until we pass the bottom edge.
    for (
      let dotScreenY = firstVisibleDotScreenY;
      dotScreenY <= canvasCssHeight;
      dotScreenY += dotSpacingOnScreen
    ) {
      // Lift the pen and put it at the right edge of where this circle begins.
      // Skipping this would draw stray lines linking each dot to the previous one.
      canvasContext.moveTo(dotScreenX + dotRadiusOnScreen, dotScreenY);
      // Trace a full circle (0 to 2 times pi radians is one complete turn) around the dot's centre.
      canvasContext.arc(dotScreenX, dotScreenY, dotRadiusOnScreen, 0, Math.PI * 2);
    }
  }

  // Fill in every circle we traced, all in one go.
  canvasContext.fill();
}

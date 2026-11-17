import { useRef } from "react";
import { useBoardCamera } from "./useBoardCamera";
import { useBoardKeyboardZoom } from "./useBoardKeyboardZoom";
import { useBoardPointerAndWheelControls } from "./useBoardPointerAndWheelControls";
import { useCanvasResolutionSync } from "./useCanvasResolutionSync";

// The whole board screen.
export function Board() {
  // Handles on the three real page elements, filled in by React once they exist.
  // We need them to draw on the canvas, listen for touches, and move the items layer.
  const dotGridCanvasRef = useRef<HTMLCanvasElement>(null);
  const boardViewportRef = useRef<HTMLDivElement>(null);
  const boardItemsStageRef = useRef<HTMLElement>(null);

  // The camera: remembers where we are looking and gives us the moves.
  const {
    redrawDotGridAndSyncItemsStage,
    shiftCameraByScreenDistance,
    zoomByMultiplierTowardScreenPoint,
    zoomByMultiplierTowardCanvasCenter,
    resetCamera,
  } = useBoardCamera({ dotGridCanvasRef, boardItemsStageRef });

  // Keeps the canvas sharp on retina and phone screens and repaints on resize.
  useCanvasResolutionSync(dotGridCanvasRef, redrawDotGridAndSyncItemsStage);

  // Keyboard shortcuts for zooming in, zooming out and resetting.
  useBoardKeyboardZoom({ zoomByMultiplierTowardCanvasCenter, resetCamera });

  // Dragging, pinching, trackpad scrolling and wheel zooming.
  useBoardPointerAndWheelControls({
    boardViewportRef,
    shiftCameraByScreenDistance,
    zoomByMultiplierTowardScreenPoint,
    redrawDotGridAndSyncItemsStage,
  });

  return (
    // The outer box: full window, nothing spills out.
    <main className="relative h-screen w-screen touch-none overflow-hidden select-none">
      {/* The viewport: the box that listens for all the dragging and pinching. */}
      <div ref={boardViewportRef} className="relative size-full">
        {/* The background dots. Purely decoration, so screen readers skip it. */}
        <canvas ref={dotGridCanvasRef} className="pointer-events-none size-full" />

        {/* The layer where sticky notes and connectors will live. It moves and
            zooms together with the dots. The label tells screen readers what it holds. */}
        <section
          ref={boardItemsStageRef}
          aria-label="Board items"
          className="pointer-events-none absolute top-0 left-0 origin-top-left"
        />
      </div>
    </main>
  );
}

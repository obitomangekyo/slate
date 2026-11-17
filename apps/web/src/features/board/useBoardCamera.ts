// ############################################################################
// JOB: the "camera". It remembers where we are looking and how zoomed in we
// are, and offers the moves: shift sideways, zoom toward a spot, reset, repaint.
// It does NOT listen to any mouse or keyboard, other files call its moves.
// ############################################################################

import { type RefObject, useCallback, useRef } from "react";
import { clampToRange } from "@/lib/clampToRange";
import { DEFAULT_ZOOM_LEVEL, MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL } from "./constants";
import { paintDotGrid } from "./paintDotGrid";

// The two screen elements the camera needs to keep in sync.
type UseBoardCameraOptions = {
  // The canvas that shows the dots.
  dotGridCanvasRef: RefObject<HTMLCanvasElement | null>;
  // The layer that will hold sticky notes and cards.
  boardItemsStageRef: RefObject<HTMLElement | null>;
};

// Sets up the camera and hands back the moves other files can use.
export function useBoardCamera({ dotGridCanvasRef, boardItemsStageRef }: UseBoardCameraOptions) {
  // useRef is a small storage box React keeps between renders. Unlike normal
  // React state, changing what is inside does NOT make React redo the whole
  // component. That is what we want: we repaint the canvas by hand many times
  // a second and do not want React doing extra work each time.

  // How far the board has been dragged sideways, in board units.
  const cameraOffsetX = useRef(0);
  // How far the board has been dragged up or down, in board units.
  const cameraOffsetY = useRef(0);
  // How zoomed in we are right now.
  const zoomLevel = useRef(DEFAULT_ZOOM_LEVEL);

  // Repaints the dots and moves the items layer to match the camera.
  // useCallback keeps this function the same object between renders, so the
  // effects that depend on it do not tear down and rebuild for no reason.
  const redrawDotGridAndSyncItemsStage = useCallback(() => {
    // Grab the real canvas element. It may not exist yet, so bail if missing.
    const dotGridCanvas = dotGridCanvasRef.current;
    if (!dotGridCanvas) return;

    // Paint the dots for the current camera position and zoom.
    paintDotGrid({
      dotGridCanvas,
      cameraOffsetX: cameraOffsetX.current,
      cameraOffsetY: cameraOffsetY.current,
      zoomLevel: zoomLevel.current,
    });

    // Grab the layer that will hold sticky notes and cards.
    const boardItemsStage = boardItemsStageRef.current;
    if (boardItemsStage) {
      // Convert board units to real screen pixels by multiplying with the zoom.
      const stageTranslationScreenX = cameraOffsetX.current * zoomLevel.current;
      const stageTranslationScreenY = cameraOffsetY.current * zoomLevel.current;
      // Slide and scale the whole layer in one go using the graphics card
      // (translate3d forces that), so items glide in step with the dots.
      boardItemsStage.style.transform = `translate3d(${stageTranslationScreenX}px, ${stageTranslationScreenY}px, 0) scale(${zoomLevel.current})`;
    }
  }, [dotGridCanvasRef, boardItemsStageRef]);

  // Moves the camera by a distance measured in screen pixels.
  // It does NOT repaint. The caller repaints afterwards, which lets a caller
  // combine several moves (like shifting AND zooming) into a single repaint.
  const shiftCameraByScreenDistance = useCallback(
    (screenDistanceX: number, screenDistanceY: number) => {
      // Divide by zoom because when zoomed in, one screen pixel covers less of the board.
      cameraOffsetX.current += screenDistanceX / zoomLevel.current;
      cameraOffsetY.current += screenDistanceY / zoomLevel.current;
    },
    [],
  );

  // Zooms in or out while keeping one spot on the screen glued in place, like
  // pinching a map on a phone: whatever is under your fingers stays under them.
  // The multiplier is relative: 2 doubles the current zoom, 0.5 halves it.
  const zoomByMultiplierTowardScreenPoint = useCallback(
    (zoomMultiplier: number, focalPointScreenX: number, focalPointScreenY: number) => {
      // The zoom we would like, before checking the limits.
      const requestedZoomLevel = zoomLevel.current * zoomMultiplier;
      // The zoom we are allowed to have, never past the min or max.
      const clampedZoomLevel = clampToRange(requestedZoomLevel, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
      // Already at the limit (or nothing changed), so there is nothing to do.
      if (clampedZoomLevel === zoomLevel.current) return;

      // Shift the camera so the board position under the focal point before the
      // zoom is still under it after the zoom. This is what stops the board from
      // appearing to jump away from your cursor.
      cameraOffsetX.current =
        focalPointScreenX / clampedZoomLevel -
        (focalPointScreenX / zoomLevel.current - cameraOffsetX.current);
      cameraOffsetY.current =
        focalPointScreenY / clampedZoomLevel -
        (focalPointScreenY / zoomLevel.current - cameraOffsetY.current);

      // Now actually store the new zoom.
      zoomLevel.current = clampedZoomLevel;

      // Show the result.
      redrawDotGridAndSyncItemsStage();
    },
    [redrawDotGridAndSyncItemsStage],
  );

  // Zooms toward the exact middle of the board. Used by the keyboard shortcuts,
  // since a keypress has no cursor position to zoom toward.
  const zoomByMultiplierTowardCanvasCenter = useCallback(
    (zoomMultiplier: number) => {
      // Need the real canvas to know where its middle is.
      const dotGridCanvas = dotGridCanvasRef.current;
      if (!dotGridCanvas) return;

      // Half the width and half the height is the middle point.
      zoomByMultiplierTowardScreenPoint(
        zoomMultiplier,
        dotGridCanvas.clientWidth / 2,
        dotGridCanvas.clientHeight / 2,
      );
    },
    [dotGridCanvasRef, zoomByMultiplierTowardScreenPoint],
  );

  // Puts the camera back to the starting view: normal size, looking at the origin.
  const resetCamera = useCallback(() => {
    zoomLevel.current = DEFAULT_ZOOM_LEVEL;
    cameraOffsetX.current = 0;
    cameraOffsetY.current = 0;
    redrawDotGridAndSyncItemsStage();
  }, [redrawDotGridAndSyncItemsStage]);

  // The moves other files are allowed to use. The raw camera numbers stay
  // private to this file, so nothing else can change them behind its back.
  return {
    redrawDotGridAndSyncItemsStage,
    shiftCameraByScreenDistance,
    zoomByMultiplierTowardScreenPoint,
    zoomByMultiplierTowardCanvasCenter,
    resetCamera,
  };
}

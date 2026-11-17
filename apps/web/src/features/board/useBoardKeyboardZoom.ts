// ############################################################################
// JOB: keyboard shortcuts for zooming. Only listens to the keys, then asks the
// camera to do the actual zooming.
// ############################################################################

import { useHotkeys } from "@tanstack/react-hotkeys";
import { KEYBOARD_ZOOM_STEP_MULTIPLIER } from "./constants";

// The camera moves this file is allowed to ask for.
type UseBoardKeyboardZoomOptions = {
  // Zoom toward the middle of the board by a multiplier.
  zoomByMultiplierTowardCanvasCenter: (zoomMultiplier: number) => void;
  // Go back to the starting view.
  resetCamera: () => void;
};

// Registers the three zoom shortcuts. "Mod" means the Command key on Mac and
// the Ctrl key on Windows and Linux.
export function useBoardKeyboardZoom({
  zoomByMultiplierTowardCanvasCenter,
  resetCamera,
}: UseBoardKeyboardZoomOptions): void {
  useHotkeys([
    {
      // Mod and the plus key (the = key, so no Shift is needed): zoom in.
      hotkey: "Mod+=",
      // Zoom in by one step, toward the middle of the board.
      callback: () => zoomByMultiplierTowardCanvasCenter(KEYBOARD_ZOOM_STEP_MULTIPLIER),
      // Stop the browser from zooming the whole page itself.
      options: { preventDefault: true },
    },
    {
      // Mod and the minus key: zoom out.
      hotkey: "Mod+-",
      // Zoom out by one step. Dividing is the same as multiplying by the flip side
      // of the step, so zooming in then out lands you back where you started.
      callback: () => zoomByMultiplierTowardCanvasCenter(1 / KEYBOARD_ZOOM_STEP_MULTIPLIER),
      // Stop the browser from zooming the whole page itself.
      options: { preventDefault: true },
    },
    {
      // Mod and zero: back to the starting view (100% zoom, at the origin).
      hotkey: "Mod+0",
      // Reset the camera.
      callback: resetCamera,
      // Stop the browser from resetting its own page zoom.
      options: { preventDefault: true },
    },
  ]);
}

// ############################################################################
// JOB: listens to every way a person can move the board with a mouse, finger,
// pen or trackpad, and turns each into a camera move.
// ############################################################################

import { type RefObject, useEffect } from "react";
import { WHEEL_ZOOM_SENSITIVITY } from "./constants";

// The code the browser uses for the left mouse button.
const LEFT_MOUSE_BUTTON = 0;
// The code the browser uses for the middle mouse button (clicking the scroll wheel).
const MIDDLE_MOUSE_BUTTON = 1;

// A spot on the screen, in pixels from the top-left corner of the window.
type PointerPosition = { x: number; y: number };

// What this file needs from the outside.
type UseBoardPointerAndWheelControlsOptions = {
  // The box that listens for all the touching and scrolling.
  boardViewportRef: RefObject<HTMLDivElement | null>;
  // Moves the camera without repainting.
  shiftCameraByScreenDistance: (screenDistanceX: number, screenDistanceY: number) => void;
  // Zooms by a multiplier, keeping the given screen spot glued in place.
  zoomByMultiplierTowardScreenPoint: (
    zoomMultiplier: number,
    focalPointScreenX: number,
    focalPointScreenY: number,
  ) => void;
  // Repaints the dots and the items layer.
  redrawDotGridAndSyncItemsStage: () => void;
};

// Wires up dragging, two-finger pinching, trackpad scrolling and wheel zooming.
export function useBoardPointerAndWheelControls({
  boardViewportRef,
  shiftCameraByScreenDistance,
  zoomByMultiplierTowardScreenPoint,
  redrawDotGridAndSyncItemsStage,
}: UseBoardPointerAndWheelControlsOptions) {
  // useEffect (not useLayoutEffect): all this does is attach listeners. It never
  // measures or changes anything the person sees, so there is no reason to
  // hold up the first paint for it.
  useEffect(() => {
    // Grab the real box. If it does not exist yet, there is nothing to listen to.
    const boardViewport = boardViewportRef.current;
    if (!boardViewport) return;

    // A notebook of every finger or mouse button currently pressed down, keyed
    // by the ID the browser gives each one, with the last spot we saw it at.
    // A mouse drag is 1 entry. A two-finger pinch is 2 entries.
    const activePointerPositionsById = new Map<number, PointerPosition>();

    // Runs when a finger, pen or mouse button goes down.
    const handlePointerDown = (event: PointerEvent) => {
      // With a mouse, only the left and middle buttons should drag the board.
      // Right-click is left alone (it opens the browser's context menu).
      if (
        event.pointerType === "mouse" &&
        event.button !== LEFT_MOUSE_BUTTON &&
        event.button !== MIDDLE_MOUSE_BUTTON
      ) {
        return;
      }

      // "Capture" the pointer: keep sending us its movements even if it slides
      // outside the box, so dragging does not break at the edges.
      boardViewport.setPointerCapture(event.pointerId);
      // Write this finger into the notebook with its starting spot.
      activePointerPositionsById.set(event.pointerId, { x: event.clientX, y: event.clientY });
    };

    // Runs every time a pressed-down finger, pen or mouse moves.
    const handlePointerMove = (event: PointerEvent) => {
      // Look up where this pointer was last time. Not in the notebook means it
      // is just hovering (nothing pressed), so ignore it.
      const previousPointerPosition = activePointerPositionsById.get(event.pointerId);
      if (!previousPointerPosition) return;

      if (activePointerPositionsById.size === 1) {
        // ONE POINTER DOWN (mouse drag or one finger): drag the board.

        // How far it travelled since the last movement event.
        const dragDeltaX = event.clientX - previousPointerPosition.x;
        const dragDeltaY = event.clientY - previousPointerPosition.y;

        // Remember the new spot for next time.
        activePointerPositionsById.set(event.pointerId, { x: event.clientX, y: event.clientY });

        // Move the camera by that distance, then show it.
        shiftCameraByScreenDistance(dragDeltaX, dragDeltaY);
        redrawDotGridAndSyncItemsStage();
      } else if (activePointerPositionsById.size === 2) {
        // TWO POINTERS DOWN (two fingers): drag AND pinch-zoom at the same time.

        // Pull the notebook entries out as a list so we can find the other finger.
        const activePointerEntries = Array.from(activePointerPositionsById.entries());
        // The other finger is whichever one is NOT the finger that just moved.
        const otherPointerEntry = activePointerEntries.find(
          ([pointerId]) => pointerId !== event.pointerId,
        );
        if (!otherPointerEntry) return;

        // Only its position matters, so skip the ID with the empty slot before the comma.
        const [, otherPointerPosition] = otherPointerEntry;

        // How far apart the fingers were before this movement.
        const previousPinchDistance = Math.hypot(
          previousPointerPosition.x - otherPointerPosition.x,
          previousPointerPosition.y - otherPointerPosition.y,
        );
        // How far apart they are now.
        const currentPinchDistance = Math.hypot(
          event.clientX - otherPointerPosition.x,
          event.clientY - otherPointerPosition.y,
        );

        // The point exactly halfway between the two fingers, before the movement.
        const previousPinchMidpointX = (previousPointerPosition.x + otherPointerPosition.x) / 2;
        const previousPinchMidpointY = (previousPointerPosition.y + otherPointerPosition.y) / 2;
        // The same halfway point, now.
        const currentPinchMidpointX = (event.clientX + otherPointerPosition.x) / 2;
        const currentPinchMidpointY = (event.clientY + otherPointerPosition.y) / 2;

        // Remember the moved finger's new spot for next time.
        activePointerPositionsById.set(event.pointerId, { x: event.clientX, y: event.clientY });

        // If the halfway point slid across the screen, drag the board by that
        // much, as if the pair of fingers were one big finger.
        shiftCameraByScreenDistance(
          currentPinchMidpointX - previousPinchMidpointX,
          currentPinchMidpointY - previousPinchMidpointY,
        );

        // Guard against dividing by zero if both fingers were on the exact same spot.
        if (previousPinchDistance > 0) {
          // Fingers 10% further apart means zoom in 10%. 10% closer means zoom out 10%.
          const pinchDistanceRatio = currentPinchDistance / previousPinchDistance;
          // Zoom, keeping the halfway point glued in place under the fingers.
          // (This also repaints, so the drag above gets shown too.)
          zoomByMultiplierTowardScreenPoint(
            pinchDistanceRatio,
            currentPinchMidpointX,
            currentPinchMidpointY,
          );
        } else {
          // No zoom is possible, so just repaint to show the drag.
          redrawDotGridAndSyncItemsStage();
        }
      }
    };

    // Runs when a finger lifts, a mouse button is released, or the browser
    // cancels the touch (for example an incoming call interrupts it).
    const handlePointerRelease = (event: PointerEvent) => {
      // Cross this finger out of the notebook.
      activePointerPositionsById.delete(event.pointerId);
      // Stop capturing it, if we still are.
      if (boardViewport.hasPointerCapture(event.pointerId)) {
        boardViewport.releasePointerCapture(event.pointerId);
      }
    };

    // Runs on mouse wheel turns and trackpad two-finger scrolls and pinches.
    const handleWheelPanOrZoom = (event: WheelEvent) => {
      // Stop the browser from doing its normal thing (scrolling or zooming the whole page).
      event.preventDefault();

      // Holding Ctrl or Cmd with the wheel means zoom. Browsers also report a
      // trackpad pinch this same way, so one rule covers both.
      if (event.ctrlKey || event.metaKey) {
        // Turn the scroll amount into a smooth zoom multiplier. The exponent
        // makes zooming feel even whether you zoom in or out.
        const wheelZoomMultiplier = Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY);
        // Zoom toward the cursor.
        zoomByMultiplierTowardScreenPoint(wheelZoomMultiplier, event.clientX, event.clientY);
      } else {
        // Plain scrolling moves the board. The minus signs make the board follow
        // your fingers like a sheet of paper, instead of moving the opposite way.
        shiftCameraByScreenDistance(-event.deltaX, -event.deltaY);
        redrawDotGridAndSyncItemsStage();
      }
    };

    // Start listening for each kind of event.
    boardViewport.addEventListener("pointerdown", handlePointerDown);
    boardViewport.addEventListener("pointermove", handlePointerMove);
    boardViewport.addEventListener("pointerup", handlePointerRelease);
    boardViewport.addEventListener("pointercancel", handlePointerRelease);
    // `passive: false` is the browser's permission slip to call preventDefault
    // on wheel events. Without it, the browser would ignore our attempt to
    // block page zooming and scrolling.
    boardViewport.addEventListener("wheel", handleWheelPanOrZoom, { passive: false });

    // Cleanup: stop listening for everything when this component goes away.
    return () => {
      boardViewport.removeEventListener("pointerdown", handlePointerDown);
      boardViewport.removeEventListener("pointermove", handlePointerMove);
      boardViewport.removeEventListener("pointerup", handlePointerRelease);
      boardViewport.removeEventListener("pointercancel", handlePointerRelease);
      boardViewport.removeEventListener("wheel", handleWheelPanOrZoom);
    };
  }, [
    boardViewportRef,
    shiftCameraByScreenDistance,
    zoomByMultiplierTowardScreenPoint,
    redrawDotGridAndSyncItemsStage,
  ]);
}

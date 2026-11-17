// How small the board is allowed to shrink. 0.1 means 10% of normal size.
// Stops people from zooming out until everything is an invisible speck.
export const MIN_ZOOM_LEVEL = 0.1;

// How big the board is allowed to grow. 10 means 10 times normal size.
// Stops people from zooming into a single giant pixel.
export const MAX_ZOOM_LEVEL = 10;

// The zoom the board starts at, and goes back to on reset. 1 means normal size (100%).
export const DEFAULT_ZOOM_LEVEL = 1;

// Gap between neighbouring background dots, measured in "board units".
// Board units are the board's own measuring system: they equal screen pixels
// when zoom is 100%, and stretch or shrink as you zoom.
export const DOT_GRID_CELL_SIZE = 32;

// Smallest a dot is ever drawn, in screen pixels. Without this, dots would
// shrink to nothing when you zoom out and the grid would vanish.
export const MIN_DOT_RADIUS_ON_SCREEN = 1;

// Colour of the dots: 25% of the page's current text colour, the rest see-through.
// Because it follows the text colour, it works in light and dark mode automatically.
export const DOT_GRID_DOT_COLOR = "color-mix(in oklab, currentColor 25%, transparent)";

// How much one press of the zoom-in or zoom-out shortcut changes the zoom.
// 1.1 means 10% bigger per press (or 10% smaller when zooming out).
export const KEYBOARD_ZOOM_STEP_MULTIPLIER = 1.1;

// How strongly the mouse wheel (or trackpad pinch) zooms. Bigger number means
// faster zooming for the same flick of the wheel.
export const WHEEL_ZOOM_SENSITIVITY = 0.05;

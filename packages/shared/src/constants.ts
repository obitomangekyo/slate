// These values are saved with notes, so keep them identical in the API and web app.
export const NODE_TONES = ["paper", "mineral", "clay", "citron"] as const;
// Roles decide whether a collaborator can only view a slate or also edit it.
export const COLLABORATOR_ROLES = ["editor", "viewer"] as const;
export type CollaboratorRole = (typeof COLLABORATOR_ROLES)[number];

// Note size is shared so the browser and API apply the same starting size.
export const DEFAULT_NOTE_DIMENSIONS = {
  width: 240,
  height: 160,
} as const;

// Notes cannot be resized below this size in either client or stored data.
export const MIN_NOTE_DIMENSIONS = {
  width: 160,
  height: 110,
} as const;

// Text limits are enforced at both the form and API boundaries.
export const MAX_NOTE_CONTENT_LENGTH = 2000;
export const MAX_EDGE_LABEL_LENGTH = 120;
export const MAX_SLATE_TITLE_LENGTH = 100;

// Choose cursor colors from this shared palette to keep them legible on the board.
export const CURSOR_COLORS = [
  "#36584F", // Deep mineral
  "#CE684B", // Clay
  "#54776E", // Mineral
  "#8C5A3C", // Umber
  "#4A6B7C", // Slate blue-grey
  "#7A6F3B", // Olive ochre
  "#18262B", // Ink
  "#65716D", // Muted
  "#D2D27A", // Citron
  "#6D8C83", // Mineral sage
  "#A95E46", // Terracotta
  "#3F5E73", // Ink blue
  "#73556F", // Muted plum
  "#9A7A3A", // Ochre
] as const;

// Keep these limits in the shared package so forms and API validation agree.
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_USER_NAME_LENGTH = 60;

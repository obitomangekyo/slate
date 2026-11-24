// ############################################################################
// JOB: a tiny general-purpose math helper. Lives in `lib` (not in the board
// folder) because nothing about it is board-specific, any feature can reuse it.
// ############################################################################

// Forces a number to stay between a floor and a ceiling.
// Examples: clampToRange(15, 0, 10) gives 10. clampToRange(-3, 0, 10) gives 0.
// clampToRange(5, 0, 10) gives 5 (already inside, so untouched).
export function clampToRange(value: number, minimum: number, maximum: number) {
  // Math.max(value, minimum) lifts the number up to the floor if it sits below it.
  // Math.min(that, maximum) then pushes it down to the ceiling if it sits above it.
  return Math.min(Math.max(value, minimum), maximum);
}

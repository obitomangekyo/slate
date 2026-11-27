type Props = {
  score?: number;
  label?: string;
};

// Keep the drawing measurements together so the five segments stay evenly spaced.
const RING = {
  size: 20,
  segmentCount: 5,
  radiusRatio: 0.41,
  strokeRatio: 0.1,
  firstDashCenterDegrees: 234,
  dashGapDegrees: 18,
} as const;

const SEGMENT_COUNT = RING.segmentCount;
const SEGMENT_KEYS = ["first", "second", "third", "fourth", "fifth"] as const;
const CENTER = RING.size / 2;
const RADIUS = RING.size * RING.radiusRatio;
const STROKE_WIDTH = RING.size * RING.strokeRatio;
const RING_STYLE = { width: `${RING.size}px`, height: `${RING.size}px` };

function pointOnRing(angleDegrees: number): [number, number] {
  // SVG positions use radians, so convert the human-readable angle before drawing.
  const radians = (angleDegrees * Math.PI) / 180;
  return [CENTER + RADIUS * Math.cos(radians), CENTER + RADIUS * Math.sin(radians)];
}

function segmentPath(index: number) {
  // Each segment is an arc centered on its place in the circle with a small visible gap.
  const dashSpacing = 360 / SEGMENT_COUNT;
  const dashCenter = RING.firstDashCenterDegrees - index * dashSpacing;
  const dashLength = dashSpacing - RING.dashGapDegrees;
  const startAngle = dashCenter + dashLength / 2;
  const endAngle = dashCenter - dashLength / 2;
  const [startX, startY] = pointOnRing(startAngle);
  const [endX, endY] = pointOnRing(endAngle);

  return `M ${startX} ${startY} A ${RADIUS} ${RADIUS} 0 0 0 ${endX} ${endY}`;
}

function colorForScore(score?: number) {
  // Match the ring color to the same five-level score shown beside the password field.
  if (score === undefined) return "var(--color-line)";
  if (score <= 1) return "var(--color-clay)";
  if (score === 2) return "var(--color-citron)";
  if (score === 3) return "var(--color-mineral)";
  return "var(--color-mineral-dark)";
}

function PasswordStrengthRing({ score, label }: Props) {
  // A score of zero still fills one segment; no score leaves the whole ring empty.
  const activeSegments = score === undefined ? 0 : score + 1;
  const color = colorForScore(score);

  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={RING_STYLE}>
      <meter
        aria-label={`Password strength: ${label ?? "not assessed"}`}
        className="sr-only"
        min={0}
        max={4}
        value={score ?? 0}
      />
      <svg
        aria-hidden="true"
        className="block"
        preserveAspectRatio="xMidYMid meet"
        viewBox={`0 0 ${RING.size} ${RING.size}`}
        width={RING.size}
        height={RING.size}
      >
        {SEGMENT_KEYS.slice(0, SEGMENT_COUNT).map((key, segment) => (
          <path
            key={key}
            d={segmentPath(segment)}
            fill="none"
            stroke={segment < activeSegments ? color : "var(--color-line)"}
            strokeLinecap="round"
            strokeWidth={STROKE_WIDTH}
          />
        ))}
      </svg>
    </span>
  );
}

export { PasswordStrengthRing };

/**
 * Phase 14S / 19 — VERA5 Radial Threat Instrument (presentation only).
 * SVG gauge for the Intel Feed score meter. Does not participate in scoring logic.
 */

export const RADIAL_THREAT_GEOMETRY = {
  /** Degrees of active sweep (horseshoe; gap at bottom). */
  sweepDeg: 240,
  /** Start angle from instrument 12-o'clock, clockwise (degrees). */
  startDeg: -120,
  viewBox: 100,
  cx: 50,
  cy: 50,
  /** Arc centerline radius in viewBox units. */
  radius: 41,
  /** Active / track stroke width (viewBox units ≈ 8–10px at standard size). */
  strokeWidth: 7.4,
  tickCount: 20,
  /** Distance from arc outer edge to tick inner end. */
  tickGap: 2.4,
  tickLength: 3.1,
  tickLengthMajor: 4.2,
  /** Radial length of the precision endpoint wedge. */
  endpointLength: 5.2,
  endpointHalfWidth: 1.15,
} as const;

export type RadialThreatInstrumentProps = {
  /** 0–100 scored value, or null when not scored / unavailable. */
  score: number | null;
  /** Decorative (meter sits under aria-labelled score card). */
  className?: string;
};

/** Instrument angle (0 = top, clockwise) → SVG cartesian. */
export function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

export function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startDeg: number,
  endDeg: number
): string {
  const start = polarToCartesian(cx, cy, radius, startDeg);
  const end = polarToCartesian(cx, cy, radius, endDeg);
  const delta = endDeg - startDeg;
  const largeArc = Math.abs(delta) > 180 ? 1 : 0;
  const sweep = delta >= 0 ? 1 : 0; /* 1 = clockwise in SVG */
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`;
}

/** Score 0–100 → absolute instrument angle along the sweep. */
export function scoreToAngleDeg(score: number): number {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    RADIAL_THREAT_GEOMETRY.startDeg +
    (RADIAL_THREAT_GEOMETRY.sweepDeg * clamped) / 100
  );
}

function buildTickAngles(count: number): number[] {
  if (count <= 1) return [RADIAL_THREAT_GEOMETRY.startDeg];
  const { startDeg, sweepDeg } = RADIAL_THREAT_GEOMETRY;
  return Array.from({ length: count }, (_, i) => startDeg + (sweepDeg * i) / (count - 1));
}

function endpointMarkerPoints(angleDeg: number): string {
  const { cx, cy, radius, strokeWidth, tickGap, endpointLength, endpointHalfWidth } =
    RADIAL_THREAT_GEOMETRY;
  const outerR = radius + strokeWidth / 2 + tickGap * 0.35;
  const tip = polarToCartesian(cx, cy, outerR + endpointLength, angleDeg);
  const baseL = polarToCartesian(cx, cy, outerR, angleDeg - endpointHalfWidth * 2.2);
  const baseR = polarToCartesian(cx, cy, outerR, angleDeg + endpointHalfWidth * 2.2);
  return `${tip.x},${tip.y} ${baseL.x},${baseL.y} ${baseR.x},${baseR.y}`;
}

/**
 * Proprietary radial threat meter: recessed track, severity arc, micro-ticks, endpoint.
 * Phase 19 — light→deep severity gradient on the active arc (CSS vars from score band).
 */
export function RadialThreatInstrument({
  score,
  className,
}: RadialThreatInstrumentProps) {
  const {
    viewBox,
    cx,
    cy,
    radius,
    strokeWidth,
    sweepDeg,
    startDeg,
    tickCount,
    tickGap,
    tickLength,
    tickLengthMajor,
  } = RADIAL_THREAT_GEOMETRY;

  const endDeg = startDeg + sweepDeg;
  const trackPath = describeArc(cx, cy, radius, startDeg, endDeg);
  const scored = score !== null;
  const activeScore = scored ? Math.max(0, Math.min(100, score)) : 0;
  const activeEndDeg = scoreToAngleDeg(activeScore);
  const activePath =
    activeScore > 0 ? describeArc(cx, cy, radius, startDeg, activeEndDeg) : null;
  const showEndpoint = scored && activeScore > 0;
  const tickAngles = buildTickAngles(tickCount);
  const activeTickLimit = scored ? activeEndDeg + 0.05 : startDeg - 1;

  const tickInnerR = radius + strokeWidth / 2 + tickGap;
  const originAngle = startDeg;
  const gradId = "vera5-radial-arc-grad";

  return (
    <svg
      className={className ?? "vera5-radial-threat-instrument"}
      viewBox={`0 0 ${viewBox} ${viewBox}`}
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id={gradId}
          gradientUnits="userSpaceOnUse"
          x1={polarToCartesian(cx, cy, radius, startDeg).x}
          y1={polarToCartesian(cx, cy, radius, startDeg).y}
          x2={
            polarToCartesian(
              cx,
              cy,
              radius,
              scored ? activeEndDeg : endDeg
            ).x
          }
          y2={
            polarToCartesian(
              cx,
              cy,
              radius,
              scored ? activeEndDeg : endDeg
            ).y
          }
        >
          <stop className="vera5-radial-threat-arc-stop--light" offset="0%" />
          <stop className="vera5-radial-threat-arc-stop--deep" offset="100%" />
        </linearGradient>
      </defs>

      {/* Layer: faint center well */}
      <circle
        className="vera5-radial-threat-well"
        cx={cx}
        cy={cy}
        r={radius - strokeWidth * 1.15}
      />

      {/* Layer: inactive track */}
      <path
        className="vera5-radial-threat-track"
        d={trackPath}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="butt"
      />
      {/* Faint inner edge for depth */}
      <path
        className="vera5-radial-threat-track-inner"
        d={describeArc(cx, cy, radius - strokeWidth * 0.42, startDeg, endDeg)}
        fill="none"
        strokeWidth={0.55}
        strokeLinecap="butt"
      />

      {/* Layer: severity halo (active portion only) */}
      {activePath ? (
        <path
          className="vera5-radial-threat-halo"
          d={activePath}
          fill="none"
          strokeWidth={strokeWidth + 4}
          strokeLinecap="butt"
        />
      ) : null}

      {/* Layer: active severity arc (light → deep gradient) */}
      {activePath ? (
        <path
          className="vera5-radial-threat-arc"
          d={activePath}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          pathLength={100}
        />
      ) : null}

      {/* Optional origin mark (neutral) */}
      <line
        className="vera5-radial-threat-origin"
        x1={polarToCartesian(cx, cy, tickInnerR, originAngle).x}
        y1={polarToCartesian(cx, cy, tickInnerR, originAngle).y}
        x2={
          polarToCartesian(cx, cy, tickInnerR + tickLength * 0.85, originAngle).x
        }
        y2={
          polarToCartesian(cx, cy, tickInnerR + tickLength * 0.85, originAngle).y
        }
      />

      {/* Layer: micro-ticks */}
      <g className="vera5-radial-threat-ticks">
        {tickAngles.map((angle, i) => {
          const major = i % 5 === 0;
          const len = major ? tickLengthMajor : tickLength;
          const inner = polarToCartesian(cx, cy, tickInnerR, angle);
          const outer = polarToCartesian(cx, cy, tickInnerR + len, angle);
          const active = scored && angle <= activeTickLimit;
          return (
            <line
              key={`tick-${i}`}
              className={
                active
                  ? "vera5-radial-threat-tick vera5-radial-threat-tick--active"
                  : "vera5-radial-threat-tick"
              }
              data-vera5-tick-major={major ? "true" : undefined}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
            />
          );
        })}
      </g>

      {/* Layer: precision endpoint */}
      {showEndpoint ? (
        <polygon
          className="vera5-radial-threat-endpoint"
          points={endpointMarkerPoints(activeEndDeg)}
        />
      ) : null}
    </svg>
  );
}

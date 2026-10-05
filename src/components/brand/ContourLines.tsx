/**
 * The brand's contour lines (the Procurepaddy board's navy tile): near-vertical lines that drift
 * together like a topographic map. Drawn, not an image — a few kilobytes of SVG that stays sharp at
 * any size and takes its colour from `currentColor`.
 *
 * Neighbouring lines share almost the same phase, so they bend together and never cross.
 */
const WIDTH = 600
const HEIGHT = 800
const LINES = 34

function line(i: number): string {
  const x0 = (i / (LINES - 1)) * WIDTH
  const points: string[] = []
  for (let y = -20; y <= HEIGHT + 20; y += 16) {
    const x =
      x0 +
      22 * Math.sin(y / 120 + i * 0.12) +
      10 * Math.sin(y / 47 + i * 0.05) +
      30 * Math.sin(y / 310 - i * 0.04)
    points.push(`${x.toFixed(1)} ${y}`)
  }
  return `M${points.join('L')}`
}

const PATH = Array.from({ length: LINES }, (_, i) => line(i)).join('')

export function ContourLines({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className={`pointer-events-none ${className}`}
    >
      <path d={PATH} fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
    </svg>
  )
}

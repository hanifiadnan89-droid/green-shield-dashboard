// Generates a 2× wide seamlessly-looping sine wave path.
// cycles must be an even integer so the wave at x=0 and x=totalW/2 are identical,
// enabling a perfect translateX(-totalW/2) CSS/SVG loop with zero discontinuity.
function genSparkPath(totalW, h, cycles, amp, phase) {
  const midY = h / 2;
  const steps = 96;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * totalW;
    const t = (i / steps) * cycles * 2 * Math.PI + phase;
    // slight second harmonic for organic feel; 2×cycles is also even → still seamless
    const y = midY - amp * Math.sin(t) - amp * 0.2 * Math.sin(2 * t + 0.5);
    pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

// Each path spans 0→192 (2× the 96-wide viewBox). The SVG clips to 96 wide,
// and <animateTransform> scrolls from 0 to -96 SVG units, then loops instantly.
export const SPARKLINES = {
  total:   genSparkPath(192, 36, 2, 6.5, 0),
  sent:    genSparkPath(192, 36, 2, 4.0, Math.PI * 0.7),
  replies: genSparkPath(192, 36, 2, 7.0, Math.PI * 1.3),
  errors:  genSparkPath(192, 36, 2, 8.0, Math.PI * 0.4),
  sold:    genSparkPath(192, 36, 2, 5.5, Math.PI * 0.9),
};

export const SPARK_DURATIONS = { total: 5.5, sent: 7, replies: 4, errors: 5, sold: 6.5 };

export function parseCubicBeziers(d) {
  const segs = [];
  let cx = 0, cy = 0;
  const tokens = d.replace(/,/g, ' ').trim().split(/\s+/);
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i++];
    if (tok === 'M') {
      cx = parseFloat(tokens[i++]);
      cy = parseFloat(tokens[i++]);
    } else if (tok === 'C') {
      while (i < tokens.length && tokens[i] !== 'C' && tokens[i] !== 'M') {
        const cx1 = parseFloat(tokens[i++]), cy1 = parseFloat(tokens[i++]);
        const cx2 = parseFloat(tokens[i++]), cy2 = parseFloat(tokens[i++]);
        const x1  = parseFloat(tokens[i++]), y1  = parseFloat(tokens[i++]);
        segs.push({ x0: cx, y0: cy, cx1, cy1, cx2, cy2, x1, y1 });
        cx = x1; cy = y1;
      }
    }
  }
  return segs;
}

export function evalCubic(t, { x0, y0, cx1, cy1, cx2, cy2, x1, y1 }) {
  const u = 1 - t;
  return {
    x: u*u*u*x0 + 3*u*u*t*cx1 + 3*u*t*t*cx2 + t*t*t*x1,
    y: u*u*u*y0 + 3*u*u*t*cy1 + 3*u*t*t*cy2 + t*t*t*y1,
  };
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

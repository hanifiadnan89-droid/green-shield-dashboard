import { hexToRgb } from './bezierUtils.js';

// 12 streams: 6 incoming (left→orb) + 6 outgoing (orb→right)
// viewBox 0 0 1080 480 — orb center ≈ (520, 240), radius ≈ 95
export const STREAM_DEFS = [
  // ── INCOMING ──────────────────────────────────────────────────────────────
  { id: 'in-g1',  color: '#22C55E', lighter: '#86EFAC', glow: '#22C55E', glowW: 26, mainW: 3.5, hlW: 1.6, particles: 3, dur: 3.8,
    path: 'M 0 128 C 120 122, 258 148, 355 175 C 400 190, 422 205, 430 218' },
  { id: 'in-g2',  color: '#16A34A', lighter: '#4ADE80', glow: '#16A34A', glowW: 16, mainW: 2.4, hlW: 1.1, particles: 2, dur: 4.5,
    path: 'M 0 158 C 120 153, 258 170, 355 194 C 400 207, 422 218, 430 230' },
  { id: 'in-b1',  color: '#60A5FA', lighter: '#BAE6FD', glow: '#3B82F6', glowW: 22, mainW: 3.0, hlW: 1.5, particles: 2, dur: 4.9,
    path: 'M 0 248 C 155 244, 298 244, 415 245 C 422 245, 427 246, 432 247' },
  { id: 'in-b2',  color: '#3B82F6', lighter: '#93C5FD', glow: '#2563EB', glowW: 13, mainW: 1.9, hlW: 0.9, particles: 1, dur: 5.7,
    path: 'M 0 262 C 155 258, 298 258, 415 259 C 422 259, 427 260, 432 261' },
  { id: 'in-o1',  color: '#FBBF24', lighter: '#FDE68A', glow: '#F59E0B', glowW: 22, mainW: 3.2, hlW: 1.4, particles: 2, dur: 5.3,
    path: 'M 0 325 C 112 320, 248 302, 345 284 C 388 275, 414 268, 430 264' },
  { id: 'in-o2',  color: '#D97706', lighter: '#FCD34D', glow: '#D97706', glowW: 13, mainW: 2.0, hlW: 0.9, particles: 1, dur: 6.3,
    path: 'M 0 344 C 112 339, 248 318, 345 300 C 388 290, 414 282, 430 278' },
  // ── OUTGOING — each path ends at its exact card-center y (x≈800 = card icon area) ──
  // Card center y estimates in SVG units (viewBox 480, ps-main ~500px):
  // Total=88  Sent=170  Replies=252  Errors=334  Sold=416
  { id: 'out-t1', color: '#22C55E', lighter: '#86EFAC', glow: '#22C55E', glowW: 24, mainW: 3.5, hlW: 1.6, particles: 3, dur: 3.8,
    path: 'M 612 220 C 658 148, 722 94, 800 53' },
  { id: 'out-t2', color: '#16A34A', lighter: '#4ADE80', glow: '#16A34A', glowW: 15, mainW: 2.4, hlW: 1.1, particles: 2, dur: 4.5,
    path: 'M 614 234 C 658 162, 722 110, 800 67' },
  { id: 'out-b',  color: '#60A5FA', lighter: '#BAE6FD', glow: '#3B82F6', glowW: 20, mainW: 3.0, hlW: 1.4, particles: 2, dur: 4.7,
    path: 'M 610 244 C 652 190, 716 158, 800 135' },
  { id: 'out-r',  color: '#34D399', lighter: '#6EE7B7', glow: '#10B981', glowW: 16, mainW: 2.5, hlW: 1.2, particles: 2, dur: 5.1,
    path: 'M 612 260 C 652 226, 716 218, 800 215' },
  { id: 'out-e',  color: '#F87171', lighter: '#FECACA', glow: '#EF4444', glowW: 16, mainW: 2.8, hlW: 1.2, particles: 2, dur: 5.5,
    path: 'M 608 272 C 648 264, 712 283, 800 292' },
  { id: 'out-p',  color: '#C084FC', lighter: '#E9D5FF', glow: '#9333EA', glowW: 18, mainW: 2.8, hlW: 1.3, particles: 3, dur: 6.1,
    path: 'M 604 282 C 638 298, 694 344, 800 370' },
];

export const STREAM_RGB = STREAM_DEFS.map(s => hexToRgb(s.lighter));

/**
 * Render typed initials as a PNG data URL for PDF embedding.
 */
export function renderInitialsToPngDataUrl(text, {
  width = 480,
  height = 96,
  fontSize = 42,
} = {}) {
  const value = String(text ?? '').trim().toUpperCase();
  if (!value) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#111827';
  ctx.font = `600 ${fontSize}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(value, width / 2, height / 2 + 2);

  return canvas.toDataURL('image/png');
}

export function normalizeInitialsInput(value) {
  return String(value ?? '')
    .replace(/[^a-zA-Z.\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, 6);
}

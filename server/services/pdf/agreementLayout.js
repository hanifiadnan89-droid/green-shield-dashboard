import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { rgb } from 'pdf-lib';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Green Shield section header bar (#148A43). */
export const HEADER_GREEN = rgb(20 / 255, 138 / 255, 67 / 255);
/** Logo gray tone (#58595B). */
export const LOGO_GRAY = rgb(88 / 255, 89 / 255, 91 / 255);
export const TAG_RED = rgb(185 / 255, 28 / 255, 28 / 255);
export const TAG_RED_FILL = rgb(254 / 255, 242 / 255, 242 / 255);
export const TAG_GRAY_FILL = rgb(243 / 255, 244 / 255, 246 / 255);
export const TITLE_BUBBLE_FILL = rgb(240 / 255, 253 / 255, 244 / 255);

/** Dark red service-month marker in calendar tiles. */
export const SERVICE_MARKER_RED = rgb(139 / 255, 26 / 255, 26 / 255);

/** Rounded bubble panel corner radius. */
export const BUBBLE_RADIUS = 8;
export const HEADER_BAR_H = 14;
/** Padding between green header bar and section body content. */
export const BODY_TOP_PAD = 10;

export const LABEL_SIZE = 7 * 1.15;
export const VALUE_SIZE = 7.5;
export const LABEL_VALUE_GAP = 6;
export const FIELD_SPACING = 8;
export const LABEL_UNDERLINE_OFFSET = 1.5;

/** Pest section label tag pill styling. */
export const LABEL_TAG_SIZE = 6.5;
export const LABEL_TAG_PAD_H = 5;
export const LABEL_TAG_HEIGHT = 12;
export const LABEL_TAG_RADIUS = 3;

export const AGREEMENT_COLORS = {
  headerBg: HEADER_GREEN,
  accent: rgb(22 / 255, 163 / 255, 74 / 255),
  border: rgb(220 / 255, 231 / 255, 219 / 255),
  text: rgb(15 / 255, 23 / 255, 42 / 255),
  muted: rgb(100 / 255, 116 / 255, 139 / 255),
  white: rgb(1, 1, 1),
  tileBg: rgb(248 / 255, 251 / 255, 247 / 255),
};

export const DEFAULT_LOGO_CANDIDATE_PATHS = [
  join(__dirname, '..', '..', 'assets', 'green-shield-logo.png'),
  join(__dirname, '..', '..', '..', 'assets', 'logos', 'green-shield-logo.png'),
];

/**
 * @param {number} pageHeight
 * @param {number} yTop
 * @param {number} [height]
 */
export function yFromTop(pageHeight, yTop, height = 0) {
  return pageHeight - yTop - height;
}

/**
 * @param {number} panelBottom PDF y of panel bottom edge
 * @param {number} panelHeight
 * @param {number} [headerBarH]
 * @param {number} [bodyTopPad]
 */
export function bodyStartY(panelBottom, panelHeight, headerBarH = HEADER_BAR_H, bodyTopPad = BODY_TOP_PAD) {
  return panelBottom + panelHeight - headerBarH - bodyTopPad;
}

export function truncateText(text, font, size, maxWidth) {
  let value = String(text ?? '');
  while (value.length > 1 && font.widthOfTextAtSize(value, size) > maxWidth) {
    value = value.slice(0, -1);
  }
  return value;
}

/**
 * Local-coordinate SVG paths for pdf-lib drawSvgPath.
 * Anchor (x, y) is the top-left corner; local +y extends downward in PDF space.
 */
function roundedRectLocalPath(w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  return [
    `M ${r} 0`,
    `L ${w - r} 0`,
    `Q ${w} 0 ${w} ${r}`,
    `L ${w} ${h - r}`,
    `Q ${w} ${h} ${w - r} ${h}`,
    `L ${r} ${h}`,
    `Q 0 ${h} 0 ${h - r}`,
    `L 0 ${r}`,
    `Q 0 0 ${r} 0`,
    'Z',
  ].join(' ');
}

function roundedHeaderLocalPath(w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  return [
    `M ${r} 0`,
    `L ${w - r} 0`,
    `Q ${w} 0 ${w} ${r}`,
    `L ${w} ${h}`,
    `L 0 ${h}`,
    `L 0 ${r}`,
    `Q 0 0 ${r} 0`,
    'Z',
  ].join(' ');
}

export function drawSvgRoundedRect(page, {
  x,
  y,
  w,
  h,
  radius = BUBBLE_RADIUS,
  fill,
  border,
  borderWidth = 0.75,
  colors = AGREEMENT_COLORS,
}) {
  page.drawSvgPath(roundedRectLocalPath(w, h, radius), {
    x,
    y: y + h,
    color: fill,
    borderColor: border,
    borderWidth,
  });
}

export function drawRoundedSection(page, {
  x,
  y,
  w,
  h,
  fill = AGREEMENT_COLORS.white,
  border = AGREEMENT_COLORS.border,
  borderWidth = 0.75,
  colors = AGREEMENT_COLORS,
}) {
  drawSvgRoundedRect(page, { x, y, w, h, fill, border, borderWidth, colors });
}

export function drawSectionHeader(page, text, {
  x,
  y,
  w,
  h = HEADER_BAR_H,
  font,
  colors = AGREEMENT_COLORS,
}) {
  const headerY = y;

  page.drawSvgPath(roundedHeaderLocalPath(w, h, BUBBLE_RADIUS), {
    x,
    y: headerY,
    color: colors.headerBg,
    borderWidth: 0,
  });

  const size = 7.5;
  const textWidth = font.widthOfTextAtSize(text, size);

  page.drawText(text, {
    x: x + Math.max(6, (w - textWidth) / 2),
    y: headerY - h + (h - size) / 2 + 0.5,
    size,
    font,
    color: colors.white,
  });
}

export function drawBubblePanel(page, { x, y, w, h, title, font, colors = AGREEMENT_COLORS }) {
  drawRoundedSection(page, { x, y, w, h, colors });

  drawSectionHeader(page, title, {
    x,
    y: y + h,
    w,
    h: HEADER_BAR_H,
    font,
    colors,
  });
}

export function drawUnderlinedLabel(page, {
  x,
  y,
  text,
  size = LABEL_SIZE,
  font,
  color = AGREEMENT_COLORS.text,
  thickness = 0.5,
}) {
  const labelText = String(text);
  page.drawText(labelText, { x, y, size, font, color });
  const labelWidth = font.widthOfTextAtSize(labelText, size);
  page.drawLine({
    start: { x, y: y - LABEL_UNDERLINE_OFFSET },
    end: { x: x + labelWidth, y: y - LABEL_UNDERLINE_OFFSET },
    thickness,
    color,
  });
  return labelWidth;
}

/**
 * Draw a label with the value clearly below it. Returns the next y position for stacking.
 */
export function drawStackedField(page, {
  x,
  y,
  label,
  value,
  width,
  labelSize = LABEL_SIZE,
  valueSize = VALUE_SIZE,
  gap = LABEL_VALUE_GAP,
  fieldSpacing = FIELD_SPACING,
  labelColor = AGREEMENT_COLORS.text,
  valueColor = AGREEMENT_COLORS.text,
  font,
  boldFont,
  labelFont,
  valueFont,
  colors = AGREEMENT_COLORS,
}) {
  const labelF = labelFont ?? boldFont ?? font;
  const valueF = valueFont ?? font;
  drawUnderlinedLabel(page, {
    x,
    y,
    text: label,
    size: labelSize,
    font: labelF,
    color: labelColor,
  });
  const valueY = y - gap;
  const text = String(value ?? '').trim();
  if (text) {
    const clipped = truncateText(text, valueF, valueSize, width - 2);
    page.drawText(clipped, { x, y: valueY, size: valueSize, font: valueF, color: valueColor });
  }
  return valueY - valueSize - fieldSpacing;
}

export function drawStackedFields(page, {
  x,
  y,
  width,
  fields,
  font,
  boldFont,
  gap = LABEL_VALUE_GAP,
  fieldSpacing = FIELD_SPACING,
  valueSize = VALUE_SIZE,
}) {
  let fieldY = y;
  for (const field of fields) {
    fieldY = drawStackedField(page, {
      x,
      y: fieldY,
      label: field.label,
      value: field.value,
      width,
      gap: field.gap ?? gap,
      fieldSpacing: field.fieldSpacing ?? fieldSpacing,
      valueSize: field.valueSize ?? valueSize,
      font,
      boldFont,
    });
  }
  return fieldY;
}

export function drawTwoColumnAddressBlock(page, {
  x,
  y,
  width,
  leftFields,
  rightFields,
  font,
  boldFont,
  columnGap = 8,
  spacing,
}) {
  const colW = (width - columnGap) / 2;
  const leftX = x;
  const rightX = x + colW + columnGap;
  const leftEnd = drawStackedFields(page, {
    x: leftX,
    y,
    width: colW,
    fields: leftFields,
    font,
    boldFont,
    ...spacing,
  });
  const rightEnd = drawStackedFields(page, {
    x: rightX,
    y,
    width: colW,
    fields: rightFields,
    font,
    boldFont,
    ...spacing,
  });
  return Math.min(leftEnd, rightEnd);
}

export function drawLabelBubble(page, text, { x, y, boldFont, variant = 'gray', colors = AGREEMENT_COLORS }) {
  const size = LABEL_TAG_SIZE;
  const textWidth = boldFont.widthOfTextAtSize(text, size);
  const bubbleW = textWidth + LABEL_TAG_PAD_H * 2;
  const bubbleH = LABEL_TAG_HEIGHT;
  const styles = {
    red: { fill: TAG_RED_FILL, border: TAG_RED, text: TAG_RED },
    gray: { fill: TAG_GRAY_FILL, border: LOGO_GRAY, text: LOGO_GRAY },
    green: { fill: TITLE_BUBBLE_FILL, border: HEADER_GREEN, text: HEADER_GREEN },
  };
  const style = styles[variant] ?? styles.gray;
  const bubbleBottom = y - bubbleH;
  drawSvgRoundedRect(page, {
    x,
    y: bubbleBottom,
    w: bubbleW,
    h: bubbleH,
    radius: LABEL_TAG_RADIUS,
    fill: style.fill,
    border: style.border,
    borderWidth: 0.6,
    colors,
  });
  page.drawText(text, {
    x: x + LABEL_TAG_PAD_H,
    y: bubbleBottom + (bubbleH - size) / 2 + 0.5,
    size,
    font: boldFont,
    color: style.text,
  });
  return bubbleH;
}

export function drawChecklistGroup(page, {
  x,
  y,
  width,
  title,
  titleVariant = 'gray',
  items,
  itemGap = 8.5,
  font,
  boldFont,
  isChecked = () => true,
  colors = AGREEMENT_COLORS,
}) {
  const bubbleH = drawLabelBubble(page, title, { x, y, boldFont, variant: titleVariant, colors });
  let itemY = y - bubbleH - 5;
  for (const item of items) {
    drawCheckItem(page, item, {
      x,
      y: itemY,
      font: boldFont,
      checked: isChecked(item),
      labelSize: 6.5,
      maxWidth: width - 10,
      colors,
    });
    itemY -= itemGap;
  }
  return itemY;
}

export function drawPriceRows(page, {
  x,
  y,
  width,
  rows,
  rowHeight = 14,
  labelSize = LABEL_SIZE,
  valueSize = VALUE_SIZE,
  font,
  boldFont,
  colors = AGREEMENT_COLORS,
}) {
  let rowY = y;
  for (const row of rows) {
    const isTotal = /sub total|recurring total/i.test(row.label);
    const rowFont = isTotal ? boldFont : font;
    drawUnderlinedLabel(page, {
      x,
      y: rowY,
      text: row.label,
      size: labelSize,
      font: boldFont,
      color: colors.text,
    });
    const value = String(row.value ?? '').trim();
    if (value) {
      const clipped = truncateText(value, rowFont, valueSize, width * 0.45);
      const valueWidth = rowFont.widthOfTextAtSize(clipped, valueSize);
      page.drawText(clipped, {
        x: x + width - valueWidth,
        y: rowY,
        size: valueSize,
        font: rowFont,
        color: colors.text,
      });
    }
    rowY -= rowHeight;
  }
  return rowY;
}

export function drawSignatureField(page, {
  x,
  y,
  label,
  value,
  width,
  font,
  boldFont,
  colors = AGREEMENT_COLORS,
}) {
  const labelF = boldFont ?? font;
  drawUnderlinedLabel(page, {
    x,
    y,
    text: label,
    size: LABEL_SIZE,
    font: labelF,
    color: colors.text,
  });
  const valueY = y - 12;
  const text = String(value ?? '').trim();
  if (text) {
    const clipped = truncateText(text, font, VALUE_SIZE, width - 4);
    page.drawText(clipped, { x, y: valueY, size: VALUE_SIZE, font, color: colors.text });
  }
  const lineY = valueY - 6;
  page.drawLine({
    start: { x, y: lineY },
    end: { x: x + width, y: lineY },
    thickness: 0.5,
    color: colors.border,
  });
  return lineY - 4;
}

export function drawValue(page, value, {
  x,
  y,
  w,
  font,
  size = VALUE_SIZE,
  align = 'left',
  colors = AGREEMENT_COLORS,
}) {
  const text = String(value ?? '').trim();
  if (!text) return;
  const clipped = truncateText(text, font, size, w - 4);
  const textWidth = font.widthOfTextAtSize(clipped, size);
  const drawX = align === 'right' ? x + w - textWidth - 2 : x + 2;
  page.drawText(clipped, { x: drawX, y, size, font, color: colors.text });
}

export function drawWrappedText(page, text, {
  x,
  y,
  w,
  font,
  size = 6.5,
  lineHeight = 8,
  color = AGREEMENT_COLORS.text,
}) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= w - 4) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  let cy = y;
  for (const line of lines) {
    page.drawText(line, { x: x + 2, y: cy, size, font, color });
    cy -= lineHeight;
  }
  return cy;
}

/**
 * @param {object} [tileStyle]
 * @param {number} [tileStyle.monthSize]
 * @param {number} [tileStyle.paySize]
 * @param {number} [tileStyle.paySizeLong]
 * @param {import('pdf-lib').RGB} [tileStyle.serviceMarkerColor]
 */
export function drawPaymentTile(page, monthLabel, paymentText, {
  x,
  y,
  w,
  h,
  font,
  fontBold,
  colors = AGREEMENT_COLORS,
  tileStyle = {},
}) {
  const monthSize = tileStyle.monthSize ?? 6.5 * 1.1;
  const paySize = tileStyle.paySize ?? 6 * 1.1;
  const paySizeLong = tileStyle.paySizeLong ?? 5.5 * 1.1;
  const serviceMarkerColor = tileStyle.serviceMarkerColor ?? SERVICE_MARKER_RED;

  page.drawRectangle({ x, y, width: w, height: h, color: colors.tileBg, borderColor: colors.border, borderWidth: 0.5 });
  const resolvedPaySize = paymentText.length > 10 ? paySizeLong : paySize;
  const monthWidth = fontBold.widthOfTextAtSize(monthLabel, monthSize);
  page.drawText(monthLabel, {
    x: x + (w - monthWidth) / 2,
    y: y + h - monthSize - 3,
    size: monthSize,
    font: fontBold,
    color: colors.text,
  });
  if (paymentText) {
    const clipped = truncateText(paymentText, font, resolvedPaySize, w - 4);
    const parts = clipped.split(/(\(S\))/);
    const totalWidth = parts.reduce((sum, part) => sum + font.widthOfTextAtSize(part, resolvedPaySize), 0);
    let payX = x + (w - totalWidth) / 2;
    for (const part of parts) {
      if (!part) continue;
      page.drawText(part, {
        x: payX,
        y: y + 3,
        size: resolvedPaySize,
        font,
        color: part === '(S)' ? serviceMarkerColor : colors.accent,
      });
      payX += font.widthOfTextAtSize(part, resolvedPaySize);
    }
  }
}

export function drawCheckItem(page, label, {
  x,
  y,
  font,
  checked = true,
  labelSize = 6.5,
  maxWidth,
  colors = AGREEMENT_COLORS,
}) {
  const box = 6;
  page.drawRectangle({
    x,
    y,
    width: box,
    height: box,
    borderColor: colors.accent,
    borderWidth: 0.75,
    color: checked ? colors.accent : colors.white,
  });
  if (checked) {
    page.drawLine({ start: { x: x + 1.2, y: y + 2.8 }, end: { x: x + 2.6, y: y + 1.4 }, thickness: 0.8, color: colors.white });
    page.drawLine({ start: { x: x + 2.6, y: y + 1.4 }, end: { x: x + 4.8, y: y + 4.8 }, thickness: 0.8, color: colors.white });
  }
  const labelText = maxWidth
    ? truncateText(label, font, labelSize, maxWidth - box - 4)
    : String(label);
  page.drawText(labelText, { x: x + box + 4, y: y + 0.5, size: labelSize, font, color: colors.text });
}

function detectImageKind(bytes) {
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) return 'jpg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'png';
  return null;
}

export function drawShieldLogoFallback(page, x, y, size, fontBold, colors = AGREEMENT_COLORS) {
  const cx = x + size / 2;
  const top = y + size;
  page.drawRectangle({ x: cx - size * 0.34, y: y + size * 0.12, width: size * 0.68, height: size * 0.72, color: colors.accent, borderWidth: 0 });
  page.drawLine({ start: { x: cx - size * 0.34, y: top - size * 0.12 }, end: { x: cx, y: y }, thickness: 1.2, color: colors.accent });
  page.drawLine({ start: { x: cx + size * 0.34, y: top - size * 0.12 }, end: { x: cx, y: y }, thickness: 1.2, color: colors.accent });
  page.drawText('GS', {
    x: cx - size * 0.14,
    y: y + size * 0.28,
    size: size * 0.28,
    font: fontBold,
    color: colors.white,
  });
}

export async function drawCompanyLogo(pdfDoc, page, {
  x,
  y,
  maxWidth,
  maxHeight,
  fontBold,
  logoPaths = DEFAULT_LOGO_CANDIDATE_PATHS,
  colors = AGREEMENT_COLORS,
  logPrefix = '[agreement-pdf]',
}) {
  for (const logoPath of logoPaths) {
    if (!existsSync(logoPath)) continue;
    try {
      const bytes = readFileSync(logoPath);
      const kind = detectImageKind(bytes);
      const image = kind === 'jpg'
        ? await pdfDoc.embedJpg(bytes)
        : kind === 'png'
          ? await pdfDoc.embedPng(bytes)
          : null;
      if (!image) continue;

      const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
      const drawW = image.width * scale;
      const drawH = image.height * scale;
      const drawX = x;
      const drawY = y + (maxHeight - drawH) / 2;
      page.drawImage(image, { x: drawX, y: drawY, width: drawW, height: drawH });
      return true;
    } catch (err) {
      console.warn(`${logPrefix} logo embed failed:`, logoPath, err.message);
    }
  }
  drawShieldLogoFallback(page, x, y, Math.min(maxWidth, maxHeight), fontBold, colors);
  return false;
}

/** Short upside-down staple: horizontal top with brief vertical drops at each end. */
export function drawInvertedBracket(page, { left, top, right, drop, color = LOGO_GRAY, thickness = 0.6 }) {
  const bottom = top - drop;
  page.drawLine({ start: { x: left, y: top }, end: { x: right, y: top }, thickness, color });
  page.drawLine({ start: { x: left, y: top }, end: { x: left, y: bottom }, thickness, color });
  page.drawLine({ start: { x: right, y: top }, end: { x: right, y: bottom }, thickness, color });
}

export function drawPestChecklistColumn(page, {
  x,
  width,
  items,
  startY,
  itemGap,
  font,
  isChecked = () => true,
  colors = AGREEMENT_COLORS,
}) {
  const labelSize = 6.5;
  let itemY = startY;
  for (const item of items) {
    drawCheckItem(page, item, {
      x,
      y: itemY,
      font,
      checked: isChecked(item),
      labelSize,
      maxWidth: width - 10,
      colors,
    });
    itemY -= itemGap;
  }
}

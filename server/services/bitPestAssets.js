import { promises as fs } from 'fs';
import { join } from 'path';
import { PDFBool, PDFName, rgb } from 'pdf-lib';
import {
  drawRitCheckbox,
  RIT_PEST_HEADING_SIZE,
  RIT_PEST_LABEL_SIZE,
  RIT_PEST_CHECKBOX_SIZE,
  RIT_PEST_ASSETS_DIR,
} from './ritPestAssets.js';
import {
  BIT_ADDON_PESTS,
  BIT_INCLUDED_PESTS_COL_A,
  BIT_INCLUDED_PESTS_COL_B,
  BIT_INCLUDED_PESTS_COL_C,
} from './bedBugInsectTriannualAgreementContent.js';
import { AGREEMENT_COLORS, drawUnderlinedLabel, truncateText } from './pdf/agreementLayout.js';

const TAG_RED = rgb(185 / 255, 28 / 255, 28 / 255);
const BED_BUG_VECTOR = rgb(0, 0, 0);
const SHADOW = rgb(115 / 255, 115 / 255, 115 / 255);
/** Row icon draw size (pt). Source PNGs are 96px wide for sharp downscaling. */
const BIT_ROW_ICON_PT = 22 * 1.15 * 0.98;
const BIT_INCLUDED_ROW_STEP = BIT_ROW_ICON_PT + 5;
const BIT_ADDON_ROW_STEP = BIT_ROW_ICON_PT + 7;
const BIT_INCLUDED_SHIFT_FRACTION = 0.75;
const BIT_ADDON_SHIFT_FRACTION = 0.70;
const BIT_ROW_BOTTOM_MARGIN_FRACTION = 0.30;

/**
 * Place pest rows lower in the covered-pests body toward the bottom
 * while keeping icons below the section header and margin above the bottom.
 */
function computeBitPestColumnStartY(bodyTopY, bodyBottomY, rowCount, rowStep, {
  headerInset = 8,
  topClearanceExtra = 0,
  shiftFraction = BIT_INCLUDED_SHIFT_FRACTION,
  maxRowY,
} = {}) {
  const bodyH = Math.max(1, bodyTopY - bodyBottomY);
  const blockSpan = (rowCount - 1) * rowStep;
  const currentStart = bodyTopY - headerInset;
  const headerClearStart = bodyTopY - BIT_ROW_ICON_PT - topClearanceExtra - 4;
  const bottomAlignedStart = bodyBottomY + bodyH * BIT_ROW_BOTTOM_MARGIN_FRACTION + blockSpan;
  const targetStart = Math.min(headerClearStart, bottomAlignedStart);
  let startY = currentStart - shiftFraction * (currentStart - targetStart);
  if (maxRowY !== undefined) startY = Math.min(startY, maxRowY);
  return startY;
}

async function readOptionalPng(path) {
  try {
    return await fs.readFile(path);
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

function enableImageInterpolation(pdfDoc, image) {
  try {
    const imageDict = pdfDoc.context.lookup(image.ref);
    if (imageDict?.set) {
      imageDict.set(PDFName.of('Interpolate'), PDFBool.True);
    }
  } catch {
    // non-fatal
  }
  return image;
}

async function embedPng(pdfDoc, buffer) {
  if (!buffer) return null;
  return enableImageInterpolation(pdfDoc, await pdfDoc.embedPng(buffer));
}

function measureImageFit(image, maxWidth, maxHeight) {
  if (!image) return { width: 0, height: 0 };
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  return {
    width: image.width * scale,
    height: image.height * scale,
  };
}

function drawSoftShadow(page, { x, y, width, height, opacity = 0.16 }) {
  const centerX = x + width / 2;
  const layers = [
    { widthScale: 1, heightScale: 1, opacityScale: 0.32, yOffset: 0 },
    { widthScale: 0.76, heightScale: 0.72, opacityScale: 0.44, yOffset: 0.25 },
    { widthScale: 0.48, heightScale: 0.46, opacityScale: 0.42, yOffset: 0.5 },
  ];

  for (const layer of layers) {
    page.drawEllipse({
      x: centerX,
      y: y + layer.yOffset,
      xScale: (width * layer.widthScale) / 2,
      yScale: (height * layer.heightScale) / 2,
      color: SHADOW,
      opacity: opacity * layer.opacityScale,
    });
  }
}

function drawImageFit(page, image, { x, y, width, height, shadow = false, shadowScale = 0.68 }) {
  if (!image) return;
  const dims = measureImageFit(image, width, height);
  const drawX = x + (width - dims.width) / 2;
  const drawY = y + (height - dims.height) / 2;

  if (shadow) {
    drawSoftShadow(page, {
      x: drawX + dims.width * (1 - shadowScale) / 2,
      y: drawY + Math.max(1.2, dims.height * 0.035),
      width: dims.width * shadowScale,
      height: Math.max(3.2, dims.height * 0.11),
      opacity: 0.22,
    });
  }

  page.drawImage(image, {
    x: drawX,
    y: drawY,
    width: dims.width,
    height: dims.height,
  });
}

function collectBitRowAssetKeys() {
  const keys = new Set();
  for (const item of [
    ...BIT_INCLUDED_PESTS_COL_A,
    ...BIT_INCLUDED_PESTS_COL_B,
    ...BIT_INCLUDED_PESTS_COL_C,
    ...BIT_ADDON_PESTS,
  ]) {
    keys.add(item.assetKey);
  }
  return keys;
}

function getBitRowImage(pestImages, assetKey) {
  if (!assetKey) return null;
  return pestImages.row?.[assetKey] ?? pestImages.large?.[assetKey] ?? null;
}

const ROW_ICON_ALIASES = {
  'silver-fish': ['silver-fish', 'silverfish'],
};

async function readRowIconBuffer(key) {
  const candidates = ROW_ICON_ALIASES[key] ?? [key];
  for (const candidate of candidates) {
    const smallBuffer = await readOptionalPng(join(RIT_PEST_ASSETS_DIR, 'small', `${candidate}.png`));
    if (smallBuffer) return smallBuffer;
  }
  for (const candidate of candidates) {
    const largeBuffer = await readOptionalPng(join(RIT_PEST_ASSETS_DIR, 'large', `${candidate}.png`));
    if (largeBuffer) return largeBuffer;
  }
  return null;
}

/** Embed row icons (96px small PNGs) + full-res bedbug hero. */
export async function embedBitPestImages(pdfDoc) {
  const large = {};
  const row = {};

  for (const key of collectBitRowAssetKeys()) {
    const buffer = await readRowIconBuffer(key);
    const embedded = await embedPng(pdfDoc, buffer);
    if (embedded) row[key] = embedded;
  }

  const bedbugBuffer = await readOptionalPng(join(RIT_PEST_ASSETS_DIR, 'large', 'bedbug.png'));
  const bedbugImage = await embedPng(pdfDoc, bedbugBuffer);
  if (bedbugImage) large.bedbug = bedbugImage;

  return {
    large,
    small: row,
    row,
    bedBugKey: large.bedbug ? 'bedbug' : null,
  };
}

function drawBitPestRow(page, {
  x,
  y,
  width,
  label,
  font,
  boldFont,
  assetKey,
  pestImages,
  checked = true,
  colors = AGREEMENT_COLORS,
}) {
  const box = RIT_PEST_CHECKBOX_SIZE;
  drawRitCheckbox(page, x, y, box, checked, colors);

  let textX = x + box + 4;
  const img = getBitRowImage(pestImages, assetKey);
  if (img) {
    drawImageFit(page, img, {
      x: textX,
      y: y - 8,
      width: BIT_ROW_ICON_PT,
      height: BIT_ROW_ICON_PT,
      shadow: true,
      shadowScale: 0.52,
    });
    textX += BIT_ROW_ICON_PT + 4;
  }

  const labelFont = boldFont ?? font;
  const labelText = truncateText(label, labelFont, RIT_PEST_LABEL_SIZE, width - (textX - x) - 1);
  page.drawText(labelText, {
    x: textX,
    y: y + 0.35,
    size: RIT_PEST_LABEL_SIZE,
    font: labelFont,
    color: colors.text,
  });
}

function drawVectorBedBugHero(page, { x, y, width, height }) {
  const cx = x + width / 2;
  const cy = y + height * 0.42;
  const scale = Math.min(width, height) / 14;
  const T = 0.35 * scale;

  page.drawEllipse({ x: cx, y: cy, xScale: 3.2 * scale, yScale: 2.0 * scale, color: BED_BUG_VECTOR });
  page.drawLine({
    start: { x: cx - 2.5 * scale, y: cy + 0.7 * scale },
    end: { x: cx + 2.5 * scale, y: cy + 0.7 * scale },
    thickness: 0.3 * scale,
    color: rgb(1, 1, 1),
  });
  page.drawLine({
    start: { x: cx - 2.5 * scale, y: cy - 0.7 * scale },
    end: { x: cx + 2.5 * scale, y: cy - 0.7 * scale },
    thickness: 0.3 * scale,
    color: rgb(1, 1, 1),
  });
  for (const [sx, sy, ex, ey] of [
    [-3.2, 0.8, -4.8, 1.6], [-3.2, 0, -4.8, 0], [-3.2, -0.8, -4.8, -1.6],
    [3.2, 0.8, 4.8, 1.6], [3.2, 0, 4.8, 0], [3.2, -0.8, 4.8, -1.6],
  ]) {
    page.drawLine({
      start: { x: cx + sx * scale, y: cy + sy * scale },
      end: { x: cx + ex * scale, y: cy + ey * scale },
      thickness: T,
      color: BED_BUG_VECTOR,
    });
  }
}

export function drawBitMainPestColumn(page, {
  x,
  width,
  bodyTopY,
  bodyBottomY,
  pestImages,
  boldFont,
  colors = AGREEMENT_COLORS,
}) {
  const titleY = bodyTopY - 12;
  const titleSize = RIT_PEST_HEADING_SIZE;
  const titleText = 'Bed Bugs';
  const titleW = boldFont.widthOfTextAtSize(titleText, titleSize);
  const titleX = x + (width - titleW) / 2;

  drawUnderlinedLabel(page, {
    x: titleX,
    y: titleY,
    text: titleText,
    size: titleSize,
    font: boldFont,
    color: TAG_RED,
  });

  const imageBoxW = width - 6;
  const imageBoxH = Math.min(62, (bodyTopY - bodyBottomY) * 0.58);
  const imageBoxX = x + (width - imageBoxW) / 2;
  const imageBoxY = titleY - 14 - imageBoxH;

  if (pestImages.bedBugKey && pestImages.large[pestImages.bedBugKey]) {
    drawImageFit(page, pestImages.large[pestImages.bedBugKey], {
      x: imageBoxX,
      y: imageBoxY,
      width: imageBoxW,
      height: imageBoxH,
      shadow: true,
      shadowScale: 0.78,
    });
  } else {
    drawVectorBedBugHero(page, {
      x: imageBoxX,
      y: imageBoxY,
      width: imageBoxW,
      height: imageBoxH,
    });
  }
}

function drawColumnDivider(page, x, bodyTopY, bodyBottomY, colors) {
  page.drawLine({
    start: { x, y: bodyBottomY + 1 },
    end: { x, y: bodyTopY - 1 },
    thickness: 0.35,
    color: colors.border,
  });
}

export function drawBitIncludedPestColumn(page, {
  x,
  width,
  bodyTopY,
  bodyBottomY,
  items,
  pestImages,
  font,
  boldFont,
  colors = AGREEMENT_COLORS,
  showLeftDivider = true,
}) {
  if (showLeftDivider) drawColumnDivider(page, x - 3, bodyTopY, bodyBottomY, colors);

  const rowX = x + 2;
  const rowW = width - 4;
  const rowY = computeBitPestColumnStartY(bodyTopY, bodyBottomY, items.length, BIT_INCLUDED_ROW_STEP, {
    shiftFraction: BIT_INCLUDED_SHIFT_FRACTION,
  });

  let cursorY = rowY;
  for (const item of items) {
    drawBitPestRow(page, {
      x: rowX,
      y: cursorY,
      width: rowW,
      label: item.label,
      font,
      boldFont,
      assetKey: item.assetKey,
      pestImages,
      checked: true,
      colors,
    });
    cursorY -= BIT_INCLUDED_ROW_STEP;
  }
}

export function drawBitAddonsColumn(page, {
  x,
  width,
  bodyTopY,
  bodyBottomY,
  items,
  pestImages,
  font,
  boldFont,
  colors = AGREEMENT_COLORS,
}) {
  drawColumnDivider(page, x - 3, bodyTopY, bodyBottomY, colors);

  const rowX = x + 8;
  const rowW = width - 16;

  const labelSize = RIT_PEST_HEADING_SIZE;
  const labelText = 'Add-ons';
  const labelW = boldFont.widthOfTextAtSize(labelText, labelSize);
  const labelX = x + (width - labelW) / 2;
  const labelY = bodyTopY - 12;
  drawUnderlinedLabel(page, {
    x: labelX,
    y: labelY,
    text: labelText,
    size: labelSize,
    font: boldFont,
    color: TAG_RED,
  });

  const maxRowY = labelY - labelSize - 10;
  const rowY = computeBitPestColumnStartY(
    bodyTopY,
    bodyBottomY,
    items.length,
    BIT_ADDON_ROW_STEP,
    {
      shiftFraction: BIT_ADDON_SHIFT_FRACTION,
      maxRowY,
    },
  );

  let cursorY = rowY;
  for (const item of items) {
    drawBitPestRow(page, {
      x: rowX,
      y: cursorY,
      width: rowW,
      label: item.label,
      font,
      boldFont,
      assetKey: item.assetKey,
      pestImages,
      checked: false,
      colors,
    });
    cursorY -= BIT_ADDON_ROW_STEP;
  }
}

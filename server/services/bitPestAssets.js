import { promises as fs } from 'fs';
import { join } from 'path';
import { rgb } from 'pdf-lib';
import {
  drawRitCheckbox,
  drawRitPestRow,
  RIT_PEST_HEADING_SIZE,
  RIT_PEST_LABEL_SIZE,
  RIT_PEST_CHECKBOX_SIZE,
  RIT_PEST_ROW_GAP,
  RIT_PEST_SMALL_IMAGE_WIDTH,
  RIT_PEST_ASSETS_DIR,
} from './ritPestAssets.js';
import {
  BIT_ADDON_PESTS,
  BIT_INCLUDED_PESTS_COL_A,
  BIT_INCLUDED_PESTS_COL_B,
  BIT_INCLUDED_PESTS_COL_C,
} from './bedBugInsectTriannualAgreementContent.js';
import { AGREEMENT_COLORS, drawUnderlinedLabel } from './pdf/agreementLayout.js';

const TAG_RED = rgb(185 / 255, 28 / 255, 28 / 255);
const BED_BUG_VECTOR = rgb(0, 0, 0);
const SHADOW = rgb(115 / 255, 115 / 255, 115 / 255);

async function readOptionalPng(path) {
  try {
    return await fs.readFile(path);
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
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
  return pestImages.small?.[assetKey] ?? pestImages.large?.[assetKey] ?? null;
}

/** Embed only the pest PNGs used by the BIT layout (small row icons + large bedbug hero). */
export async function embedBitPestImages(pdfDoc) {
  const large = {};
  const small = {};

  for (const key of collectBitRowAssetKeys()) {
    const smallBuffer = await readOptionalPng(join(RIT_PEST_ASSETS_DIR, 'small', `${key}.png`));
    if (smallBuffer) {
      small[key] = await pdfDoc.embedPng(smallBuffer);
      continue;
    }
    const largeBuffer = await readOptionalPng(join(RIT_PEST_ASSETS_DIR, 'large', `${key}.png`));
    if (largeBuffer) {
      large[key] = await pdfDoc.embedPng(largeBuffer);
    }
  }

  const bedbugBuffer = await readOptionalPng(join(RIT_PEST_ASSETS_DIR, 'large', 'bedbug.png'));
  if (bedbugBuffer) {
    large.bedbug = await pdfDoc.embedPng(bedbugBuffer);
  }

  return {
    large,
    small,
    bedBugKey: large.bedbug ? 'bedbug' : null,
  };
}

function drawBitPestRow(page, options) {
  const { assetKey, pestImages, ...rest } = options;
  const img = getBitRowImage(pestImages, assetKey);
  drawRitPestRow(page, {
    ...rest,
    assetKey,
    pestImages: {
      ...pestImages,
      large: img ? { [assetKey]: img } : {},
      small: img ? { [assetKey]: img } : {},
    },
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
  font,
  boldFont,
  colors = AGREEMENT_COLORS,
}) {
  const titleY = bodyTopY - 16;
  drawUnderlinedLabel(page, {
    x: x + 2,
    y: titleY,
    text: 'Main pest',
    size: RIT_PEST_HEADING_SIZE,
    font: boldFont,
    color: TAG_RED,
  });

  const imageBoxW = width - 10;
  const imageBoxH = Math.min(52, (bodyTopY - bodyBottomY) * 0.48);
  const imageBoxX = x + (width - imageBoxW) / 2;
  const imageBoxY = bodyBottomY + 38;

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

  const rowY = bodyBottomY + 24;
  const box = RIT_PEST_CHECKBOX_SIZE;
  const label = 'Bed Bugs';
  const labelW = font.widthOfTextAtSize(label, RIT_PEST_LABEL_SIZE);
  const rowX = x + (width - box - 4 - labelW) / 2;
  drawRitCheckbox(page, rowX, rowY, box, true, colors);
  page.drawText(label, {
    x: rowX + box + 4,
    y: rowY + 0.35,
    size: RIT_PEST_LABEL_SIZE,
    font: boldFont,
    color: colors.text,
  });
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
  colors = AGREEMENT_COLORS,
  showLeftDivider = true,
}) {
  if (showLeftDivider) drawColumnDivider(page, x - 3, bodyTopY, bodyBottomY, colors);

  const rowStep = RIT_PEST_CHECKBOX_SIZE + RIT_PEST_ROW_GAP;
  const rowX = x + 2;
  const rowW = width - 4;
  let rowY = bodyTopY - 28;

  for (const item of items) {
    drawBitPestRow(page, {
      x: rowX,
      y: rowY,
      width: rowW,
      label: item.label,
      font,
      assetKey: item.assetKey,
      pestImages,
      checked: true,
      colors,
    });
    rowY -= rowStep;
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

  drawUnderlinedLabel(page, {
    x: x + 4,
    y: bodyTopY - 16,
    text: 'Add-ons',
    size: RIT_PEST_HEADING_SIZE,
    font: boldFont,
    color: TAG_RED,
  });

  const rowStep = 28;
  let rowY = bodyTopY - 42;
  const rowX = x + 8;
  const rowW = width - 16;

  for (const item of items) {
    drawBitPestRow(page, {
      x: rowX,
      y: rowY,
      width: rowW,
      label: item.label,
      font,
      assetKey: item.assetKey,
      pestImages,
      checked: false,
      colors,
    });
    rowY -= rowStep;
  }
}

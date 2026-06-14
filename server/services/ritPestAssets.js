import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { rgb } from 'pdf-lib';
import { truncateText, AGREEMENT_COLORS } from './pdf/agreementLayout.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const RIT_PEST_ASSETS_DIR = join(__dirname, '..', '..', 'assets', 'pests');

// Final RIT pest panel layout: title -> hero image -> covered rows.
// Images are drawn from the largest available embedded asset and scaled down
// into fixed boxes. This avoids stretching low-res thumbnails and keeps the
// section locked to the approved reference layout.
export const RIT_PEST_LARGE_IMAGE_WIDTH = 88;
export const RIT_PEST_SMALL_IMAGE_WIDTH = 17;
export const RIT_PEST_LARGE_MAX_HEIGHT = 48;
export const RIT_PEST_ROW_GAP = 6.4;
export const RIT_PEST_HEADING_SIZE = 7.6;
export const RIT_PEST_LABEL_SIZE = 6.25;
export const RIT_PEST_CHECKBOX_SIZE = 7;

const ADDON_X_RED = rgb(185 / 255, 28 / 255, 28 / 255);
const SHADOW = rgb(115 / 255, 115 / 255, 115 / 255);

async function readOptionalPng(path) {
  try {
    return await fs.readFile(path);
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function embedRitPestImages(pdfDoc) {
  const manifestPath = join(RIT_PEST_ASSETS_DIR, 'manifest.json');
  const manifestRaw = await fs.readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestRaw);
  const large = {};
  const small = {};

  for (const key of manifest.files) {
    const largeBuffer = await readOptionalPng(join(RIT_PEST_ASSETS_DIR, 'large', `${key}.png`));
    const smallBuffer = await readOptionalPng(join(RIT_PEST_ASSETS_DIR, 'small', `${key}.png`));
    if (largeBuffer) large[key] = await pdfDoc.embedPng(largeBuffer);
    if (smallBuffer) small[key] = await pdfDoc.embedPng(smallBuffer);
  }

  return { large, small, manifest };
}

export function drawEmbeddedPestImage(page, image, { x, y, width }) {
  if (!image) return 0;
  const height = (image.height / image.width) * width;
  page.drawImage(image, { x, y, width, height });
  return height;
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
  page.drawEllipse({
    x: x + width / 2,
    y,
    xScale: width / 2,
    yScale: height / 2,
    color: SHADOW,
    opacity,
  });
}

function drawImageFit(page, image, { x, y, width, height, shadow = false, shadowScale = 0.68 }) {
  if (!image) return;
  const dims = measureImageFit(image, width, height);
  const drawX = x + (width - dims.width) / 2;
  const drawY = y + (height - dims.height) / 2;

  if (shadow) {
    drawSoftShadow(page, {
      x: drawX + dims.width * (1 - shadowScale) / 2,
      y: drawY + Math.max(1.5, dims.height * 0.04),
      width: dims.width * shadowScale,
      height: Math.max(3.4, dims.height * 0.12),
      opacity: 0.16,
    });
  }

  page.drawImage(image, {
    x: drawX,
    y: drawY,
    width: dims.width,
    height: dims.height,
  });
}

export function measureLargePestImage(image, targetWidth, maxHeight) {
  let width = targetWidth;
  let height = (image.height / image.width) * width;
  if (height > maxHeight) {
    height = maxHeight;
    width = (image.width / image.height) * height;
  }
  return { width, height };
}

export function drawRitCheckbox(page, x, y, box, checked, colors = AGREEMENT_COLORS) {
  if (!checked) {
    drawRitXMark(page, x + 0.5, y + 0.5, box - 1, ADDON_X_RED);
    return;
  }

  page.drawLine({
    start: { x: x + 1.0, y: y + 3.0 },
    end: { x: x + 2.6, y: y + 1.3 },
    thickness: 1.1,
    color: colors.accent,
  });
  page.drawLine({
    start: { x: x + 2.6, y: y + 1.3 },
    end: { x: x + 6.2, y: y + 6.1 },
    thickness: 1.1,
    color: colors.accent,
  });
}

export function drawRitXMark(page, x, y, size, color = ADDON_X_RED) {
  page.drawLine({
    start: { x, y },
    end: { x: x + size, y: y + size },
    thickness: 1.05,
    color,
  });
  page.drawLine({
    start: { x, y: y + size },
    end: { x: x + size, y },
    thickness: 1.05,
    color,
  });
}

function getBestRowImage(pestImages, assetKey) {
  if (!assetKey) return null;
  return pestImages.large?.[assetKey] ?? pestImages.small?.[assetKey] ?? null;
}

export function drawRitPestRow(page, {
  x,
  y,
  width,
  label,
  font,
  assetKey,
  pestImages,
  checked = true,
  labelSize = RIT_PEST_LABEL_SIZE,
  colors = AGREEMENT_COLORS,
  showSmallIcon = true,
}) {
  const box = RIT_PEST_CHECKBOX_SIZE;
  drawRitCheckbox(page, x, y, box, checked, colors);

  let textX = x + box + 4;
  if (showSmallIcon) {
    const img = getBestRowImage(pestImages, assetKey);
    if (img) {
      drawImageFit(page, img, {
        x: textX,
        y: y - 4.2,
        width: RIT_PEST_SMALL_IMAGE_WIDTH,
        height: RIT_PEST_SMALL_IMAGE_WIDTH,
        shadow: true,
        shadowScale: 0.52,
      });
      textX += RIT_PEST_SMALL_IMAGE_WIDTH + 4;
    }
  }

  const labelText = truncateText(label, font, labelSize, width - (textX - x) - 1);
  page.drawText(labelText, {
    x: textX,
    y: y + 0.35,
    size: labelSize,
    font,
    color: colors.text,
  });
}

export function computeRitLargeImageWidth(colWidth) {
  return Math.max(64, Math.min(RIT_PEST_LARGE_IMAGE_WIDTH, colWidth - 16));
}

function drawColumnDivider(page, x, bodyTopY, bodyBottomY, colors) {
  page.drawLine({
    start: { x: x - 3, y: bodyBottomY + 1 },
    end: { x: x - 3, y: bodyTopY - 1 },
    thickness: 0.35,
    color: colors.border,
  });
}

function drawSubtleRule(page, x, y, width, colors) {
  page.drawLine({
    start: { x, y },
    end: { x: x + width, y },
    thickness: 0.35,
    color: colors.border,
  });
}

function drawColumnTitle(page, { text, x, width, y, font, size, color, underline = false }) {
  const titleWidth = font.widthOfTextAtSize(text, size);
  const titleX = x + Math.max(0, (width - titleWidth) / 2);
  page.drawText(text, { x: titleX, y, size, font, color });
  if (underline) {
    page.drawLine({
      start: { x: titleX, y: y - 1.5 },
      end: { x: titleX + titleWidth, y: y - 1.5 },
      thickness: 0.5,
      color,
    });
  }
}

export function drawRitPestColumn(page, {
  x,
  width,
  bodyTopY,
  bodyBottomY,
  items,
  headerColor,
  font,
  boldFont,
  pestImages,
  colors = AGREEMENT_COLORS,
}) {
  const header = items[0];
  const pests = items.slice(1);
  if (header !== 'Mice') drawColumnDivider(page, x, bodyTopY, bodyBottomY, colors);

  const largeKey = pestImages.manifest.headers[header] ?? pestImages.manifest.rows[header] ?? null;
  const bodyH = bodyTopY - bodyBottomY;

  const titleY = bodyTopY - 16;
  drawColumnTitle(page, {
    text: header,
    x,
    width,
    y: titleY,
    font: boldFont,
    size: RIT_PEST_HEADING_SIZE,
    color: headerColor,
  });

  const imageBoxW = Math.min(width - 14, computeRitLargeImageWidth(width));
  const imageBoxH = Math.min(RIT_PEST_LARGE_MAX_HEIGHT, Math.max(40, bodyH * 0.43));
  const imageBoxX = x + (width - imageBoxW) / 2;
  const imageBoxY = bodyBottomY + 48;
  if (largeKey && pestImages.large[largeKey]) {
    drawImageFit(page, pestImages.large[largeKey], {
      x: imageBoxX,
      y: imageBoxY,
      width: imageBoxW,
      height: imageBoxH,
      shadow: true,
      shadowScale: 0.76,
    });
  }

  const ruleY = bodyBottomY + 42;
  drawSubtleRule(page, x + 5, ruleY, width - 10, colors);

  const rowX = x + 12;
  const rowW = width - 18;
  const rowStep = RIT_PEST_CHECKBOX_SIZE + RIT_PEST_ROW_GAP;
  let rowY = bodyBottomY + 30;

  for (const pest of pests) {
    drawRitPestRow(page, {
      x: rowX,
      y: rowY,
      width: rowW,
      label: pest,
      font,
      assetKey: getRitPestAssetKey(pestImages, pest),
      pestImages,
      colors,
    });
    rowY -= rowStep;
  }
}

export function drawRitAddonsColumn(page, {
  x,
  width,
  bodyTopY,
  bodyBottomY,
  headerColor,
  font,
  boldFont,
  pestImages,
  colors = AGREEMENT_COLORS,
}) {
  drawColumnDivider(page, x, bodyTopY, bodyBottomY, colors);

  drawColumnTitle(page, {
    text: 'Add-ons',
    x,
    width,
    y: bodyTopY - 16,
    font: boldFont,
    size: RIT_PEST_HEADING_SIZE,
    color: headerColor,
    underline: true,
  });

  const rows = [
    { label: 'Tick', assetKey: 'tick' },
    { label: 'Mosquito', assetKey: pestImages.manifest.addonSecondary ?? 'mosquito' },
  ];
  const rowX = x + Math.max(22, width * 0.24);
  const rowW = width - (rowX - x) - 10;
  let rowY = bodyBottomY + 68;

  for (const row of rows) {
    drawRitPestRow(page, {
      x: rowX,
      y: rowY,
      width: rowW,
      label: row.label,
      font,
      assetKey: row.assetKey,
      pestImages,
      checked: false,
      labelSize: RIT_PEST_LABEL_SIZE,
      colors,
      showSmallIcon: true,
    });
    rowY -= 30;
  }
}

export function getRitPestAssetKey(pestImages, label) {
  return pestImages.manifest.rows[label] ?? null;
}

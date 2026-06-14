import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { rgb } from 'pdf-lib';
import { truncateText, AGREEMENT_COLORS } from './pdf/agreementLayout.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const RIT_PEST_ASSETS_DIR = join(__dirname, '..', '..', 'assets', 'pests');

// Compact stacked layout: heading above the animal, animal above the pest rows.
// Row icons use the higher-resolution large assets when available and are
// scaled down into a fitted box to reduce pixelation in the rendered PDF.
export const RIT_PEST_LARGE_IMAGE_WIDTH = 64;
export const RIT_PEST_SMALL_IMAGE_WIDTH = 15;
export const RIT_PEST_LARGE_MAX_HEIGHT = 38;
export const RIT_PEST_IMAGE_TEXT_GAP = 3;
export const RIT_PEST_ROW_GAP = 5.2;
export const RIT_PEST_HEADING_GAP = 4;
export const RIT_PEST_HEADING_SIZE = 7.2;
export const RIT_PEST_LABEL_SIZE = 5.75;
export const RIT_PEST_CHECKBOX_SIZE = 6.5;

const ADDON_X_RED = rgb(185 / 255, 28 / 255, 28 / 255);

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

function drawImageFit(page, image, { x, y, width, height }) {
  if (!image) return;
  const dims = measureImageFit(image, width, height);
  page.drawImage(image, {
    x: x + (width - dims.width) / 2,
    y: y + (height - dims.height) / 2,
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
    drawRitXMark(page, x + 0.4, y + 0.4, box - 0.8, ADDON_X_RED);
    return;
  }

  page.drawLine({
    start: { x: x + 1.0, y: y + 3.0 },
    end: { x: x + 2.6, y: y + 1.3 },
    thickness: 1.05,
    color: colors.accent,
  });
  page.drawLine({
    start: { x: x + 2.6, y: y + 1.3 },
    end: { x: x + 6.0, y: y + 5.8 },
    thickness: 1.05,
    color: colors.accent,
  });
}

export function drawRitXMark(page, x, y, size, color = ADDON_X_RED) {
  page.drawLine({
    start: { x, y },
    end: { x: x + size, y: y + size },
    thickness: 1,
    color,
  });
  page.drawLine({
    start: { x, y: y + size },
    end: { x: x + size, y },
    thickness: 1,
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

  let textX = x + box + 3;
  if (showSmallIcon) {
    const img = getBestRowImage(pestImages, assetKey);
    if (img) {
      drawImageFit(page, img, {
        x: textX,
        y: y - 3,
        width: RIT_PEST_SMALL_IMAGE_WIDTH,
        height: RIT_PEST_SMALL_IMAGE_WIDTH,
      });
      textX += RIT_PEST_SMALL_IMAGE_WIDTH + 3.2;
    }
  }

  const labelText = truncateText(label, font, labelSize, width - (textX - x) - 1);
  page.drawText(labelText, {
    x: textX,
    y: y + 0.4,
    size: labelSize,
    font,
    color: colors.text,
  });
}

export function computeRitLargeImageWidth(colWidth) {
  return Math.max(52, Math.min(RIT_PEST_LARGE_IMAGE_WIDTH, colWidth - 22));
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
  const headerSize = RIT_PEST_HEADING_SIZE;
  const headerWidth = boldFont.widthOfTextAtSize(header, headerSize);
  const headerX = x + Math.max(0, (width - headerWidth) / 2);
  const headerY = bodyTopY - 16;

  page.drawText(header, {
    x: headerX,
    y: headerY,
    size: headerSize,
    font: boldFont,
    color: headerColor,
  });

  const imageBoxW = Math.min(width - 18, RIT_PEST_LARGE_IMAGE_WIDTH + 12);
  const imageBoxH = RIT_PEST_LARGE_MAX_HEIGHT;
  const imageBoxX = x + (width - imageBoxW) / 2;
  const imageBoxY = bodyTopY - 56;
  if (largeKey && pestImages.large[largeKey]) {
    drawImageFit(page, pestImages.large[largeKey], {
      x: imageBoxX,
      y: imageBoxY,
      width: imageBoxW,
      height: imageBoxH,
    });
  }

  const ruleY = bodyTopY - 60;
  drawSubtleRule(page, x + 4, ruleY, width - 8, colors);

  const rowX = x + 10;
  const rowW = width - 16;
  let rowY = bodyTopY - 70;
  const rowStep = RIT_PEST_CHECKBOX_SIZE + RIT_PEST_ROW_GAP;

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

  const headerText = 'Add-ons';
  const headerSize = RIT_PEST_HEADING_SIZE;
  const headerWidth = boldFont.widthOfTextAtSize(headerText, headerSize);
  const headerX = x + Math.max(0, (width - headerWidth) / 2);
  const headerY = bodyTopY - 16;

  page.drawText(headerText, {
    x: headerX,
    y: headerY,
    size: headerSize,
    font: boldFont,
    color: headerColor,
  });
  page.drawLine({
    start: { x: headerX, y: headerY - 1.5 },
    end: { x: headerX + headerWidth, y: headerY - 1.5 },
    thickness: 0.5,
    color: headerColor,
  });

  const rows = [
    { label: 'Ticks', assetKey: 'tick' },
    { label: 'Mosquitoes', assetKey: pestImages.manifest.addonSecondary ?? 'mosquito' },
  ];
  const rowX = x + Math.max(20, width * 0.25);
  const rowW = width - (rowX - x) - 8;
  let rowY = bodyTopY - 45;
  const rowStep = 22;

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
    rowY -= rowStep;
  }
}

export function getRitPestAssetKey(pestImages, label) {
  return pestImages.manifest.rows[label] ?? null;
}

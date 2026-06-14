import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { truncateText, AGREEMENT_COLORS } from './pdf/agreementLayout.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const RIT_PEST_ASSETS_DIR = join(__dirname, '..', '..', 'assets', 'pests');

// Keep the animal cutouts visible while giving the pest rows enough text space.
// Row icons are rendered from the high-resolution large assets when available
// and scaled down in the PDF, which produces a cleaner result than enlarging
// the small thumbnails.
export const RIT_PEST_LARGE_IMAGE_WIDTH = 56;
export const RIT_PEST_SMALL_IMAGE_WIDTH = 18;
export const RIT_PEST_LARGE_MAX_HEIGHT = 60;
export const RIT_PEST_IMAGE_TEXT_GAP = 4;
export const RIT_PEST_ROW_GAP = 8.3;
export const RIT_PEST_HEADING_GAP = 5;
export const RIT_PEST_HEADING_SIZE = 7.3;
export const RIT_PEST_LABEL_SIZE = 6.1;
export const RIT_PEST_CHECKBOX_SIZE = 7;

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
    drawRitXMark(page, x + 0.3, y + 0.3, box - 0.6, colors.danger ?? colors.red ?? colors.accent);
    return;
  }

  page.drawLine({
    start: { x: x + 1.1, y: y + 3.2 },
    end: { x: x + 2.8, y: y + 1.4 },
    thickness: 1.1,
    color: colors.accent,
  });
  page.drawLine({
    start: { x: x + 2.8, y: y + 1.4 },
    end: { x: x + 6.2, y: y + 6.1 },
    thickness: 1.1,
    color: colors.accent,
  });
}

export function drawRitXMark(page, x, y, size, color) {
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

  let textX = x + box + 3.5;
  if (showSmallIcon) {
    const img = getBestRowImage(pestImages, assetKey);
    if (img) {
      const imgW = RIT_PEST_SMALL_IMAGE_WIDTH;
      const imgH = (img.height / img.width) * imgW;
      drawEmbeddedPestImage(page, img, {
        x: textX,
        y: y + (box - imgH) / 2,
        width: imgW,
      });
      textX += imgW + 3.2;
    }
  }

  const labelText = truncateText(label, font, labelSize, width - (textX - x) - 1);
  page.drawText(labelText, {
    x: textX,
    y: y + 0.5,
    size: labelSize,
    font,
    color: colors.text,
  });
}

export function computeRitLargeImageWidth(colWidth) {
  return Math.max(48, Math.min(RIT_PEST_LARGE_IMAGE_WIDTH, colWidth * 0.42));
}

function drawColumnDivider(page, x, bodyTopY, bodyBottomY, colors) {
  page.drawLine({
    start: { x: x - 3, y: bodyBottomY + 1 },
    end: { x: x - 3, y: bodyTopY - 1 },
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
  const largeImageWidth = computeRitLargeImageWidth(width);
  const animalX = x + 5;
  const animalTopY = bodyTopY - 30;

  const headerWidth = boldFont.widthOfTextAtSize(header, RIT_PEST_HEADING_SIZE);
  const headerX = animalX + Math.max(0, (largeImageWidth - headerWidth) / 2);
  page.drawText(header, {
    x: headerX,
    y: bodyTopY - 18,
    size: RIT_PEST_HEADING_SIZE,
    font: boldFont,
    color: headerColor,
  });

  if (largeKey && pestImages.large[largeKey]) {
    const img = pestImages.large[largeKey];
    const { width: imgW, height: imgH } = measureLargePestImage(
      img,
      largeImageWidth,
      RIT_PEST_LARGE_MAX_HEIGHT,
    );
    drawEmbeddedPestImage(page, img, {
      x: animalX + (largeImageWidth - imgW) / 2,
      y: animalTopY - imgH,
      width: imgW,
    });
  }

  const rowX = x + largeImageWidth + RIT_PEST_IMAGE_TEXT_GAP + 5;
  const rowW = width - (rowX - x) - 1;
  let rowY = bodyTopY - 43;

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
    rowY -= RIT_PEST_ROW_GAP + RIT_PEST_CHECKBOX_SIZE;
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
  const headerWidth = boldFont.widthOfTextAtSize(headerText, RIT_PEST_HEADING_SIZE);
  const headerX = x + Math.max(0, (width - headerWidth) / 2);
  const headerY = bodyTopY - 18;
  page.drawText(headerText, {
    x: headerX,
    y: headerY,
    size: RIT_PEST_HEADING_SIZE,
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
  const rowX = x + Math.max(10, width * 0.28);
  const rowW = width - (rowX - x) - 3;
  let rowY = bodyTopY - 48;

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
    rowY -= RIT_PEST_ROW_GAP + RIT_PEST_CHECKBOX_SIZE + 4;
  }
}

export function getRitPestAssetKey(pestImages, label) {
  return pestImages.manifest.rows[label] ?? null;
}

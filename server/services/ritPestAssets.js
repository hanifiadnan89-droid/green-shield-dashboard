import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { truncateText, AGREEMENT_COLORS } from './pdf/agreementLayout.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const RIT_PEST_ASSETS_DIR = join(__dirname, '..', '..', 'assets', 'pests');
export const RIT_PEST_LARGE_IMAGE_WIDTH = 72;
export const RIT_PEST_SMALL_IMAGE_WIDTH = 22;
export const RIT_PEST_LARGE_MAX_HEIGHT = 80;
export const RIT_PEST_IMAGE_TEXT_GAP = 6;
export const RIT_PEST_ROW_GAP = 8;
export const RIT_PEST_HEADING_GAP = 5;
export const RIT_PEST_HEADING_SIZE = 7;
export const RIT_PEST_LABEL_SIZE = 6.5;
export const RIT_PEST_CHECKBOX_SIZE = 6;

/**
 * @typedef {object} RitPestImageBundle
 * @property {Record<string, import('pdf-lib').PDFImage>} large
 * @property {Record<string, import('pdf-lib').PDFImage>} small
 * @property {object} manifest
 */

/**
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @returns {Promise<RitPestImageBundle>}
 */
export async function embedRitPestImages(pdfDoc) {
  const manifestPath = join(RIT_PEST_ASSETS_DIR, 'manifest.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`RIT pest manifest not found at ${manifestPath}`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const large = {};
  const small = {};

  for (const key of manifest.files) {
    const largePath = join(RIT_PEST_ASSETS_DIR, 'large', `${key}.png`);
    const smallPath = join(RIT_PEST_ASSETS_DIR, 'small', `${key}.png`);
    if (existsSync(largePath)) {
      large[key] = await pdfDoc.embedPng(readFileSync(largePath));
    }
    if (existsSync(smallPath)) {
      small[key] = await pdfDoc.embedPng(readFileSync(smallPath));
    }
  }

  return { large, small, manifest };
}

/**
 * @param {import('pdf-lib').PDFPage} page
 * @param {import('pdf-lib').PDFImage | undefined} image
 * @param {{ x: number, y: number, width: number }} opts
 */
export function drawEmbeddedPestImage(page, image, { x, y, width }) {
  if (!image) return 0;
  const height = (image.height / image.width) * width;
  page.drawImage(image, { x, y, width, height });
  return height;
}

/**
 * @param {import('pdf-lib').PDFImage} image
 * @param {number} targetWidth
 * @param {number} maxHeight
 */
export function measureLargePestImage(image, targetWidth, maxHeight) {
  let width = targetWidth;
  let height = (image.height / image.width) * width;
  if (height > maxHeight) {
    height = maxHeight;
    width = (image.width / image.height) * height;
  }
  return { width, height };
}

/**
 * @param {import('pdf-lib').PDFPage} page
 * @param {number} x
 * @param {number} y
 * @param {number} box
 * @param {boolean} checked
 * @param {object} colors
 */
export function drawRitCheckbox(page, x, y, box, checked, colors = AGREEMENT_COLORS) {
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
    page.drawLine({
      start: { x: x + 1.2, y: y + 2.8 },
      end: { x: x + 2.6, y: y + 1.4 },
      thickness: 0.8,
      color: colors.white,
    });
    page.drawLine({
      start: { x: x + 2.6, y: y + 1.4 },
      end: { x: x + 4.8, y: y + 4.8 },
      thickness: 0.8,
      color: colors.white,
    });
  }
}

/**
 * @param {import('pdf-lib').PDFPage} page
 * @param {object} opts
 */
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
  if (showSmallIcon && assetKey && pestImages.small[assetKey]) {
    const img = pestImages.small[assetKey];
    const imgW = RIT_PEST_SMALL_IMAGE_WIDTH;
    const imgH = (img.height / img.width) * imgW;
    drawEmbeddedPestImage(page, img, {
      x: textX,
      y: y + (box - imgH) / 2,
      width: imgW,
    });
    textX += imgW + 3;
  }

  const labelText = truncateText(label, font, labelSize, width - (textX - x) - 2);
  page.drawText(labelText, {
    x: textX,
    y: y + 0.5,
    size: labelSize,
    font,
    color: colors.text,
  });
}

/**
 * Fit the large pest image within the column while preserving row text space.
 * @param {number} colWidth
 * @param {number} minTextWidth
 */
export function computeRitLargeImageWidth(colWidth, minTextWidth = 52, showSmallIcon = true) {
  const smallIconW = showSmallIcon ? RIT_PEST_SMALL_IMAGE_WIDTH + 3 : 0;
  const rowOverhead = RIT_PEST_CHECKBOX_SIZE + 4 + smallIconW + 2;
  const neededTextBlock = rowOverhead + minTextWidth;
  const available = colWidth - RIT_PEST_IMAGE_TEXT_GAP - neededTextBlock;
  return Math.max(42, Math.min(RIT_PEST_LARGE_IMAGE_WIDTH, available));
}

/**
 * Draw one included-pest column: large animal image left, red heading + pest rows right.
 * @param {import('pdf-lib').PDFPage} page
 * @param {object} opts
 */
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
  const largeKey = pestImages.manifest.headers[header] ?? pestImages.manifest.rows[header] ?? null;

  const imageX = x;
  const maxPestLabelW = pests.reduce(
    (max, pest) => Math.max(max, font.widthOfTextAtSize(pest, RIT_PEST_LABEL_SIZE)),
    0,
  );
  const largeImageWidth = computeRitLargeImageWidth(width, maxPestLabelW + 2);
  const textBlockX = imageX + largeImageWidth + RIT_PEST_IMAGE_TEXT_GAP;
  const textBlockW = width - largeImageWidth - RIT_PEST_IMAGE_TEXT_GAP;

  const box = RIT_PEST_CHECKBOX_SIZE;
  const headingSize = RIT_PEST_HEADING_SIZE;
  const pestsBlockH = pests.length * box + Math.max(0, pests.length - 1) * RIT_PEST_ROW_GAP;
  const contentH = headingSize + RIT_PEST_HEADING_GAP + pestsBlockH;
  const contentTopY = bodyTopY - (bodyTopY - bodyBottomY - contentH) / 2;

  if (largeKey && pestImages.large[largeKey]) {
    const img = pestImages.large[largeKey];
    const { width: imgW, height: imgH } = measureLargePestImage(
      img,
      largeImageWidth,
      RIT_PEST_LARGE_MAX_HEIGHT,
    );
    const bodyMidY = (bodyTopY + bodyBottomY) / 2;
    drawEmbeddedPestImage(page, img, {
      x: imageX,
      y: bodyMidY - imgH / 2,
      width: imgW,
    });
  }

  const headerText = header;
  const headerWidth = boldFont.widthOfTextAtSize(headerText, headingSize);
  const headerX = textBlockX + Math.max(0, (textBlockW - headerWidth) / 2);
  page.drawText(headerText, {
    x: headerX,
    y: contentTopY - headingSize,
    size: headingSize,
    font: boldFont,
    color: headerColor,
  });

  let rowY = contentTopY - headingSize - RIT_PEST_HEADING_GAP;
  for (const pest of pests) {
    rowY -= box;
    drawRitPestRow(page, {
      x: textBlockX,
      y: rowY,
      width: textBlockW,
      label: pest,
      font,
      assetKey: getRitPestAssetKey(pestImages, pest),
      pestImages,
      colors,
    });
    rowY -= RIT_PEST_ROW_GAP;
  }
}

/**
 * Draw the Add-ons column: large tick left, underlined heading, optional pest row, mosquito accent.
 * @param {import('pdf-lib').PDFPage} page
 * @param {object} opts
 */
export function drawRitAddonsColumn(page, {
  x,
  width,
  bodyTopY,
  bodyBottomY,
  addonLabel,
  headerColor,
  font,
  boldFont,
  pestImages,
  colors = AGREEMENT_COLORS,
}) {
  const imageX = x;
  const addonLabelW = font.widthOfTextAtSize(addonLabel, RIT_PEST_LABEL_SIZE);
  const largeImageWidth = computeRitLargeImageWidth(width, addonLabelW + 2, false);
  const textBlockX = imageX + largeImageWidth + RIT_PEST_IMAGE_TEXT_GAP;
  const textBlockW = width - largeImageWidth - RIT_PEST_IMAGE_TEXT_GAP;

  const box = RIT_PEST_CHECKBOX_SIZE;
  const headingSize = RIT_PEST_HEADING_SIZE;
  const labelSize = RIT_PEST_LABEL_SIZE;
  const addonGap = RIT_PEST_ROW_GAP + 2;
  const mosquitoKey = pestImages.manifest.addonSecondary ?? 'mosquito';
  const mosquitoH = pestImages.small[mosquitoKey]
    ? (pestImages.small[mosquitoKey].height / pestImages.small[mosquitoKey].width) * RIT_PEST_SMALL_IMAGE_WIDTH
    : 0;
  const contentH = headingSize + RIT_PEST_HEADING_GAP + addonGap + box + (mosquitoH > 0 ? mosquitoH + 2 : 0);
  const contentTopY = bodyTopY - (bodyTopY - bodyBottomY - contentH) / 2;

  const largeKey = pestImages.manifest.headers['Add-ons'] ?? 'tick';
  if (largeKey && pestImages.large[largeKey]) {
    const img = pestImages.large[largeKey];
    const { width: imgW, height: imgH } = measureLargePestImage(
      img,
      largeImageWidth,
      RIT_PEST_LARGE_MAX_HEIGHT,
    );
    const bodyMidY = (bodyTopY + bodyBottomY) / 2;
    drawEmbeddedPestImage(page, img, {
      x: imageX,
      y: bodyMidY - imgH / 2,
      width: imgW,
    });
  }

  const headerText = 'Add-ons';
  const headerWidth = boldFont.widthOfTextAtSize(headerText, headingSize);
  const headerX = textBlockX + Math.max(0, (textBlockW - headerWidth) / 2);
  const headerY = contentTopY - headingSize;
  page.drawText(headerText, {
    x: headerX,
    y: headerY,
    size: headingSize,
    font: boldFont,
    color: headerColor,
  });
  page.drawLine({
    start: { x: headerX, y: headerY - 1.5 },
    end: { x: headerX + headerWidth, y: headerY - 1.5 },
    thickness: 0.5,
    color: headerColor,
  });

  const addonRowY = headerY - RIT_PEST_HEADING_GAP - addonGap - box;
  drawRitPestRow(page, {
    x: textBlockX,
    y: addonRowY,
    width: textBlockW,
    label: addonLabel,
    font,
    assetKey: getRitPestAssetKey(pestImages, addonLabel),
    pestImages,
    checked: false,
    labelSize,
    colors,
    showSmallIcon: false,
  });

  if (pestImages.small[mosquitoKey]) {
    const img = pestImages.small[mosquitoKey];
    const imgW = RIT_PEST_SMALL_IMAGE_WIDTH;
    const imgH = (img.height / img.width) * imgW;
    drawEmbeddedPestImage(page, img, {
      x: textBlockX + box + 4,
      y: addonRowY - imgH - 2,
      width: imgW,
    });
  }
}

export function getRitPestAssetKey(pestImages, label) {
  return pestImages.manifest.rows[label] ?? null;
}

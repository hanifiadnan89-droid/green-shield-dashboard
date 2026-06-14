import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { truncateText, AGREEMENT_COLORS } from './pdf/agreementLayout.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const RIT_PEST_ASSETS_DIR = join(__dirname, '..', '..', 'assets', 'pests');
export const RIT_PEST_HEADER_IMAGE_WIDTH = 48;
export const RIT_PEST_SMALL_IMAGE_WIDTH = 14;
export const RIT_PEST_HEADER_MAX_HEIGHT = 40;

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
 * @param {import('pdf-lib').PDFPage} page
 * @param {object} opts
 */
export function drawRitPestImageRow(page, {
  imageX,
  y,
  width,
  label,
  font,
  checked = true,
  labelColor,
  labelSize = 6.5,
  assetKey,
  pestImages,
  isHeaderRow = false,
  underline = false,
  colors = AGREEMENT_COLORS,
}) {
  const box = 6;
  const contentX = imageX + RIT_PEST_HEADER_IMAGE_WIDTH + 4;
  const checkboxX = contentX;

  if (isHeaderRow && assetKey && pestImages.large[assetKey]) {
    const img = pestImages.large[assetKey];
    let imgW = RIT_PEST_HEADER_IMAGE_WIDTH;
    let imgH = (img.height / img.width) * imgW;
    if (imgH > RIT_PEST_HEADER_MAX_HEIGHT) {
      imgH = RIT_PEST_HEADER_MAX_HEIGHT;
      imgW = (img.width / img.height) * imgH;
    }
    drawEmbeddedPestImage(page, img, {
      x: imageX,
      y: y + box - imgH + 1,
      width: imgW,
    });
  }

  if (checked !== null) {
    page.drawRectangle({
      x: checkboxX,
      y,
      width: box,
      height: box,
      borderColor: colors.accent,
      borderWidth: 0.75,
      color: checked ? colors.accent : colors.white,
    });
    if (checked) {
      page.drawLine({ start: { x: checkboxX + 1.2, y: y + 2.8 }, end: { x: checkboxX + 2.6, y: y + 1.4 }, thickness: 0.8, color: colors.white });
      page.drawLine({ start: { x: checkboxX + 2.6, y: y + 1.4 }, end: { x: checkboxX + 4.8, y: y + 4.8 }, thickness: 0.8, color: colors.white });
    }
  }

  let textX = checkboxX + box + 4;
  if (!isHeaderRow && assetKey && pestImages.small[assetKey]) {
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

  const labelText = truncateText(label, font, labelSize, width - (textX - imageX) - 2);
  if (underline) {
    page.drawText(labelText, { x: textX, y: y + 0.5, size: labelSize, font, color: labelColor ?? colors.text });
    const labelWidth = font.widthOfTextAtSize(labelText, labelSize);
    page.drawLine({
      start: { x: textX, y: y + 0.5 - 1.5 },
      end: { x: textX + labelWidth, y: y + 0.5 - 1.5 },
      thickness: 0.5,
      color: labelColor ?? colors.text,
    });
  } else {
    page.drawText(labelText, {
      x: textX,
      y: y + 0.5,
      size: labelSize,
      font,
      color: labelColor ?? colors.text,
    });
  }
}

/**
 * @param {import('pdf-lib').PDFPage} page
 * @param {object} opts
 */
export function drawRitAddonRow(page, {
  imageX,
  y,
  width,
  label,
  font,
  pestImages,
  labelSize = 6.5,
  labelColor,
  colors = AGREEMENT_COLORS,
}) {
  const box = 6;
  const checkboxX = imageX;

  page.drawRectangle({
    x: checkboxX,
    y,
    width: box,
    height: box,
    borderColor: colors.accent,
    borderWidth: 0.75,
    color: colors.white,
  });

  let textX = checkboxX + box + 4;
  const tickKey = pestImages.manifest.rows[label] ?? 'tick';
  if (pestImages.small[tickKey]) {
    const img = pestImages.small[tickKey];
    const imgW = RIT_PEST_SMALL_IMAGE_WIDTH;
    const imgH = (img.height / img.width) * imgW;
    drawEmbeddedPestImage(page, img, {
      x: textX,
      y: y + (box - imgH) / 2,
      width: imgW,
    });
    textX += imgW + 3;
  }

  const labelText = truncateText(label, font, labelSize, width - (textX - imageX) - 2);
  page.drawText(labelText, {
    x: textX,
    y: y + 0.5,
    size: labelSize,
    font,
    color: labelColor ?? colors.text,
  });

  const mosquitoKey = pestImages.manifest.addonSecondary ?? 'mosquito';
  if (pestImages.small[mosquitoKey]) {
    const img = pestImages.small[mosquitoKey];
    const imgW = RIT_PEST_SMALL_IMAGE_WIDTH;
    const imgH = (img.height / img.width) * imgW;
    drawEmbeddedPestImage(page, img, {
      x: textX,
      y: y - imgH - 1,
      width: imgW,
    });
  }
}

export function getRitPestAssetKey(pestImages, label) {
  return pestImages.manifest.rows[label] ?? null;
}

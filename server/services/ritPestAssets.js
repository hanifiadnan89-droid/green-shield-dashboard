import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { truncateText, AGREEMENT_COLORS } from './pdf/agreementLayout.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const RIT_PEST_ASSETS_DIR = join(__dirname, '..', '..', 'assets', 'pests');

// Tuned against the approved reference image: smaller large cutout boxes bring
// the pest rows left, while larger row icons/text make the section read like
// the target instead of looking like small icons pasted onto a form.
export const RIT_PEST_LARGE_IMAGE_WIDTH = 68;
export const RIT_PEST_SMALL_IMAGE_WIDTH = 22;
export const RIT_PEST_LARGE_MAX_HEIGHT = 74;
export const RIT_PEST_IMAGE_TEXT_GAP = 4;
export const RIT_PEST_ROW_GAP = 8.4;
export const RIT_PEST_HEADING_GAP = 5;
export const RIT_PEST_HEADING_SIZE = 7.4;
export const RIT_PEST_LABEL_SIZE = 7;
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
    page.drawRectangle({
      x,
      y: y + 0.2,
      width: box - 1,
      height: box - 1,
      borderColor: colors.accent,
      borderWidth: 0.8,
      color: colors.white,
    });
    return;
  }

  // Target reference uses simple green checkmarks, not filled square boxes.
  page.drawLine({
    start: { x: x + 1.1, y: y + 3.2 },
    end: { x: x + 2.8, y: y + 1.4 },
    thickness: 1.15,
    color: colors.accent,
  });
  page.drawLine({
    start: { x: x + 2.8, y: y + 1.4 },
    end: { x: x + 6.2, y: y + 6.1 },
    thickness: 1.15,
    color: colors.accent,
  });
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
  if (showSmallIcon && assetKey && pestImages.small[assetKey]) {
    const img = pestImages.small[assetKey];
    const imgW = RIT_PEST_SMALL_IMAGE_WIDTH;
    const imgH = (img.height / img.width) * imgW;
    drawEmbeddedPestImage(page, img, {
      x: textX,
      y: y + (box - imgH) / 2,
      width: imgW,
    });
    textX += imgW + 4;
  }

  const labelText = truncateText(label, font, labelSize, width - (textX - x) - 1.5);
  page.drawText(labelText, {
    x: textX,
    y: y + 0.4,
    size: labelSize,
    font,
    color: colors.text,
  });
}

export function computeRitLargeImageWidth(colWidth, minTextWidth = 50, showSmallIcon = true) {
  const smallIconW = showSmallIcon ? RIT_PEST_SMALL_IMAGE_WIDTH + 4 : 0;
  const rowOverhead = RIT_PEST_CHECKBOX_SIZE + 4 + smallIconW + 1.5;
  const desired = Math.min(
    RIT_PEST_LARGE_IMAGE_WIDTH,
    Math.max(54, colWidth * (showSmallIcon ? 0.36 : 0.42)),
  );
  const maxByText = colWidth - RIT_PEST_IMAGE_TEXT_GAP - rowOverhead - minTextWidth;
  return Math.max(50, Math.min(desired, maxByText));
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
  const maxPestLabelW = pests.reduce(
    (max, pest) => Math.max(max, font.widthOfTextAtSize(pest, RIT_PEST_LABEL_SIZE)),
    0,
  );
  const largeImageWidth = computeRitLargeImageWidth(width, maxPestLabelW + 1.5);
  const textBlockX = x + largeImageWidth + RIT_PEST_IMAGE_TEXT_GAP;
  const textBlockW = width - largeImageWidth - RIT_PEST_IMAGE_TEXT_GAP;

  const box = RIT_PEST_CHECKBOX_SIZE;
  const headingSize = RIT_PEST_HEADING_SIZE;
  const pestsBlockH = pests.length * box + Math.max(0, pests.length - 1) * RIT_PEST_ROW_GAP;
  const contentH = headingSize + RIT_PEST_HEADING_GAP + pestsBlockH;
  const contentTopY = bodyTopY - (bodyTopY - bodyBottomY - contentH) / 2 + 1;

  if (largeKey && pestImages.large[largeKey]) {
    const img = pestImages.large[largeKey];
    const { width: imgW, height: imgH } = measureLargePestImage(
      img,
      largeImageWidth,
      RIT_PEST_LARGE_MAX_HEIGHT,
    );
    const bodyMidY = (bodyTopY + bodyBottomY) / 2;
    drawEmbeddedPestImage(page, img, {
      x,
      y: bodyMidY - imgH / 2,
      width: imgW,
    });
  }

  const headerWidth = boldFont.widthOfTextAtSize(header, headingSize);
  const headerX = textBlockX + Math.max(0, (textBlockW - headerWidth) / 2);
  page.drawText(header, {
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
  drawColumnDivider(page, x, bodyTopY, bodyBottomY, colors);

  const addonLabelW = font.widthOfTextAtSize(addonLabel, RIT_PEST_LABEL_SIZE);
  const largeImageWidth = computeRitLargeImageWidth(width, addonLabelW + 1.5, false);
  const textBlockX = x + largeImageWidth + RIT_PEST_IMAGE_TEXT_GAP;
  const textBlockW = width - largeImageWidth - RIT_PEST_IMAGE_TEXT_GAP;

  const box = RIT_PEST_CHECKBOX_SIZE;
  const headingSize = RIT_PEST_HEADING_SIZE;
  const labelSize = RIT_PEST_LABEL_SIZE;
  const addonGap = RIT_PEST_ROW_GAP + 2.5;
  const mosquitoKey = pestImages.manifest.addonSecondary ?? 'mosquito';
  const mosquitoW = RIT_PEST_SMALL_IMAGE_WIDTH + 4;
  const mosquitoH = pestImages.small[mosquitoKey]
    ? (pestImages.small[mosquitoKey].height / pestImages.small[mosquitoKey].width) * mosquitoW
    : 0;
  const contentH = headingSize + RIT_PEST_HEADING_GAP + addonGap + box + (mosquitoH > 0 ? mosquitoH + 1.5 : 0);
  const contentTopY = bodyTopY - (bodyTopY - bodyBottomY - contentH) / 2 + 1;

  const largeKey = pestImages.manifest.headers['Add-ons'] ?? 'tick';
  if (largeKey && pestImages.large[largeKey]) {
    const img = pestImages.large[largeKey];
    const { width: imgW, height: imgH } = measureLargePestImage(img, Math.min(largeImageWidth, 48), 60);
    const bodyMidY = (bodyTopY + bodyBottomY) / 2;
    drawEmbeddedPestImage(page, img, {
      x,
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
    const imgH = (img.height / img.width) * mosquitoW;
    drawEmbeddedPestImage(page, img, {
      x: textBlockX + box + 6,
      y: addonRowY - imgH - 1.5,
      width: mosquitoW,
    });
  }
}

export function getRitPestAssetKey(pestImages, label) {
  return pestImages.manifest.rows[label] ?? null;
}

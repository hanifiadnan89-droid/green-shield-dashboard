import { promises as fs } from 'fs';
import { join } from 'path';
import { PDFBool, PDFName, rgb } from 'pdf-lib';
import {
  drawRitCheckbox,
  RIT_PEST_ASSETS_DIR,
  RIT_PEST_CHECKBOX_SIZE,
  RIT_PEST_HEADING_SIZE,
} from './ritPestAssets.js';
import {
  AGREEMENT_COLORS,
  drawUnderlinedLabel,
  TAG_RED,
  truncateText,
} from './pdf/agreementLayout.js';

const CHECKLIST_LABEL_SIZE = 6.5;
const CHECKLIST_ROW_STEP = 11;
const SHADOW = rgb(115 / 255, 115 / 255, 115 / 255);

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

function measureImageFit(image, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  return {
    width: image.width * scale,
    height: image.height * scale,
  };
}

function drawSoftShadow(page, { x, y, width, height, opacity = 0.16 }) {
  const centerX = x + width / 2;
  page.drawEllipse({
    x: centerX,
    y,
    xScale: width / 2,
    yScale: Math.max(3.2, height * 0.11) / 2,
    color: SHADOW,
    opacity,
  });
}

function drawImageFit(page, image, { x, y, width, height, shadow = false }) {
  if (!image) return;
  const dims = measureImageFit(image, width, height);
  const drawX = x + (width - dims.width) / 2;
  const drawY = y + (height - dims.height) / 2;
  if (shadow) {
    drawSoftShadow(page, {
      x: drawX + dims.width * 0.1,
      y: drawY + Math.max(1.2, dims.height * 0.035),
      width: dims.width * 0.8,
      height: Math.max(3.2, dims.height * 0.11),
    });
  }
  page.drawImage(image, {
    x: drawX,
    y: drawY,
    width: dims.width,
    height: dims.height,
  });
}

/** Embed large tick and mosquito hero images for the TMM covered-pests section. */
export async function embedTmmPestImages(pdfDoc) {
  const large = {};
  for (const key of ['tick', 'mosquito']) {
    const buffer = await readOptionalPng(join(RIT_PEST_ASSETS_DIR, 'large', `${key}.png`));
    if (buffer) {
      large[key] = enableImageInterpolation(pdfDoc, await pdfDoc.embedPng(buffer));
    }
  }
  return { large };
}

function drawChecklistRow(page, { x, y, width, label, font, colors }) {
  const box = RIT_PEST_CHECKBOX_SIZE;
  drawRitCheckbox(page, x, y, box, true, colors);
  const text = truncateText(label, font, CHECKLIST_LABEL_SIZE, width - box - 6);
  page.drawText(text, {
    x: x + box + 4,
    y: y + 0.35,
    size: CHECKLIST_LABEL_SIZE,
    font,
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

export function drawTmmCoverageColumn(page, {
  x,
  width,
  bodyTopY,
  bodyBottomY,
  title,
  assetKey,
  coverageItems,
  pestImages,
  font,
  boldFont,
  colors = AGREEMENT_COLORS,
  showLeftDivider = false,
}) {
  if (showLeftDivider) drawColumnDivider(page, x - 3, bodyTopY, bodyBottomY, colors);

  const titleSize = RIT_PEST_HEADING_SIZE;
  const titleW = boldFont.widthOfTextAtSize(title, titleSize);
  const titleX = x + (width - titleW) / 2;
  const titleY = bodyTopY - 14;
  drawUnderlinedLabel(page, {
    x: titleX,
    y: titleY,
    text: title,
    size: titleSize,
    font: boldFont,
    color: TAG_RED,
  });

  const bodyH = bodyTopY - bodyBottomY;
  const imageBoxW = width - 24;
  const imageBoxH = Math.min(72, bodyH * 0.48);
  const imageBoxX = x + (width - imageBoxW) / 2;
  const imageBoxY = bodyBottomY + bodyH * 0.34;
  const image = pestImages.large?.[assetKey];
  if (image) {
    drawImageFit(page, image, {
      x: imageBoxX,
      y: imageBoxY,
      width: imageBoxW,
      height: imageBoxH,
      shadow: true,
    });
  }

  const checklistBlockH = (coverageItems.length - 1) * CHECKLIST_ROW_STEP;
  const checklistStartY = bodyBottomY + 16 + checklistBlockH;
  const rowX = x + 14;
  const rowW = width - 28;
  let rowY = checklistStartY;
  for (const item of coverageItems) {
    drawChecklistRow(page, {
      x: rowX,
      y: rowY,
      width: rowW,
      label: item,
      font,
      colors,
    });
    rowY -= CHECKLIST_ROW_STEP;
  }
}

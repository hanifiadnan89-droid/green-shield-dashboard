import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PDFBool, PDFName, rgb } from 'pdf-lib';
import { AGREEMENT_COLORS } from './pdf/agreementLayout.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMM_PEST_ASSETS_DIR = join(__dirname, '..', '..', 'assets', 'pests', 'tmm');

const SHADOW = rgb(115 / 255, 115 / 255, 115 / 255);

/** Small inset below the green section header before hero images. */
const IMAGE_TOP_PAD = 4;
const IMAGE_BOTTOM_PAD = 8;

/**
 * Per-pest fit tuning so a tall tick and wide mosquito feel visually balanced
 * inside the same column width (dominant dimension scaled to the image zone).
 */
const TMM_HERO_FIT = {
  tick: { dominant: 'height', ratio: 0.98 },
  mosquito: { dominant: 'height', ratio: 0.98 },
};

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

function measureTmmHeroFit(image, assetKey, zoneW, zoneH) {
  const fit = TMM_HERO_FIT[assetKey] ?? { dominant: 'height', ratio: 0.9 };
  let width;
  let height;

  if (fit.dominant === 'width') {
    width = zoneW * fit.ratio;
    height = (width / image.width) * image.height;
    if (height > zoneH) {
      height = zoneH;
      width = (height / image.height) * image.width;
    }
  } else {
    height = zoneH * fit.ratio;
    width = (height / image.height) * image.width;
    if (width > zoneW) {
      width = zoneW;
      height = (width / image.width) * image.height;
    }
  }

  return { width, height };
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

function drawImageFit(page, image, { x, y, width, height, shadow = false, dims: presetDims = null }) {
  if (!image) return;
  const dims = presetDims ?? measureImageFit(image, width, height);
  const drawX = x + (width - dims.width) / 2;
  const drawY = y + (height - dims.height) / 2;
  if (shadow) {
    drawSoftShadow(page, {
      x: drawX + dims.width * 0.1,
      y: drawY + Math.max(1.2, dims.height * 0.035),
      width: dims.width * 0.8,
      height: Math.max(3.2, dims.height * 0.11),
      opacity: 0.14,
    });
  }
  page.drawImage(image, {
    x: drawX,
    y: drawY,
    width: dims.width,
    height: dims.height,
  });
}

/** Embed white-background TMM hero PNGs (pre-cleaned assets, not runtime processed). */
export async function embedTmmPestImages(pdfDoc) {
  const large = {};
  for (const key of ['tick', 'mosquito']) {
    const buffer = await readOptionalPng(join(TMM_PEST_ASSETS_DIR, `${key}-hero.png`));
    if (buffer) {
      large[key] = enableImageInterpolation(pdfDoc, await pdfDoc.embedPng(buffer));
    }
  }
  return { large };
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
  assetKey,
  pestImages,
  showLeftDivider = false,
  colors = AGREEMENT_COLORS,
}) {
  if (showLeftDivider) drawColumnDivider(page, x - 3, bodyTopY, bodyBottomY, colors);

  const imageZoneTop = bodyTopY - IMAGE_TOP_PAD;
  const imageZoneBottom = bodyBottomY + IMAGE_BOTTOM_PAD;
  const imageZoneH = Math.max(52, imageZoneTop - imageZoneBottom);
  const imageZoneW = width - 24;
  const imageBoxX = x + (width - imageZoneW) / 2;
  const imageBoxY = imageZoneBottom;
  const image = pestImages.large?.[assetKey];
  if (!image) return;

  const heroDims = measureTmmHeroFit(image, assetKey, imageZoneW, imageZoneH);
  drawImageFit(page, image, {
    x: imageBoxX,
    y: imageBoxY,
    width: imageZoneW,
    height: imageZoneH,
    dims: heroDims,
    shadow: true,
  });
}

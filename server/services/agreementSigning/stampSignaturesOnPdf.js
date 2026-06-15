import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/** Landscape letter signature row — matches vector agreement layout proportions. */
const PAGE_W = 792;
const MARGIN_X = 36;
const SECTION_PAD = 8;
const FIELD_GAP = 14;
const FIELD_W = (PAGE_W - MARGIN_X * 2 - SECTION_PAD * 2 - FIELD_GAP * 2) / 3;
const SIG_TOP_Y = 22;
const IMAGE_HEIGHT = 20;

/**
 * Stamp customer initials, signature, and date onto a flattened agreement PDF.
 * Used for legacy AcroForm templates that do not have a vector signing builder.
 */
export async function stampSignaturesOnPdf(pdfBytes, {
  initialsPng,
  signaturePng,
  signatureDate,
}) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const page = pdfDoc.getPage(0);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const initialsImage = initialsPng ? await pdfDoc.embedPng(initialsPng) : null;
  const signatureImage = signaturePng ? await pdfDoc.embedPng(signaturePng) : null;

  const fields = [
    { image: initialsImage },
    { image: signatureImage },
    { date: signatureDate },
  ];

  fields.forEach((field, index) => {
    const fieldX = MARGIN_X + SECTION_PAD + index * (FIELD_W + FIELD_GAP);

    if (field.image) {
      page.drawImage(field.image, {
        x: fieldX + 2,
        y: SIG_TOP_Y,
        width: FIELD_W - 4,
        height: IMAGE_HEIGHT,
      });
    }

    if (field.date) {
      page.drawText(String(field.date), {
        x: fieldX + 2,
        y: SIG_TOP_Y + 4,
        size: 9,
        font,
        color: rgb(0.13, 0.13, 0.13),
      });
    }
  });

  return pdfDoc.save();
}

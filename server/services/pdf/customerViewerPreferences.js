import { PDFName } from 'pdf-lib';

/**
 * Landscape agreements default to "fit whole page" in many viewers (~40% of a
 * portrait screen). Set OpenAction + viewer prefs so the PDF opens with the
 * page height filling the window (typically ~80–90% of the viewport).
 *
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @param {{ pageIndex?: number }} [options]
 */
export function applyCustomerFriendlyViewerPreferences(pdfDoc, { pageIndex = 0 } = {}) {
  const page = pdfDoc.getPages()[pageIndex];
  if (!page) return;

  const catalog = pdfDoc.catalog;
  const { context } = pdfDoc;

  catalog.set(
    PDFName.of('OpenAction'),
    context.obj([page.ref, PDFName.of('FitV')]),
  );

  const prefs = catalog.getOrCreateViewerPreferences();
  prefs.setFitWindow(true);
  prefs.setCenterWindow(true);
}

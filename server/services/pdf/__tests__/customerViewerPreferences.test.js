import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName } from 'pdf-lib';
import { applyCustomerFriendlyViewerPreferences } from '../customerViewerPreferences.js';

describe('applyCustomerFriendlyViewerPreferences', () => {
  it('embeds FitV OpenAction and viewer preferences', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([792, 612]);
    applyCustomerFriendlyViewerPreferences(pdfDoc);

    const bytes = await pdfDoc.save();
    const reloaded = await PDFDocument.load(bytes);
    const openAction = reloaded.catalog.get(PDFName.of('OpenAction'));
    const prefs = reloaded.catalog.getViewerPreferences();

    expect(openAction).toBeTruthy();
    expect(String(openAction)).toContain('/FitV');
    expect(prefs?.getFitWindow()).toBe(true);
    expect(prefs?.getCenterWindow()).toBe(true);
  });
});

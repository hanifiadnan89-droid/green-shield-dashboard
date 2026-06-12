import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildInsectQuarterlyAgreementPdf } from '../services/insectQuarterlyAgreementPdf.js';
import { buildQuotePdf } from '../routes/documents.js';
import { listQuoteDocuments } from '../services/quoteDocumentsList.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', '..', 'tmp', 'iq-comparison');
const quotesDir = join(__dirname, '..', '..', 'assets', 'quotes');

const samplePayload = {
  lead: { name: 'Jane Doe', email: 'jane@example.com', phone: '207-555-0100' },
  address: { street: '123 Main St', cityState: 'Saco, ME 04072' },
  pricing: { initial: '749', discounted: '150', recurring: '65' },
  agreementStartDate: '2026-06-15',
  serviceType: 'insect_quarterly',
};

const listed = await listQuoteDocuments(quotesDir);
const iqEntry = listed.find((entry) => entry.serviceType === 'insect_quarterly');
if (!iqEntry) throw new Error('insect_quarterly template not found');

mkdirSync(outDir, { recursive: true });

const { outBytes: vectorBytes } = await buildInsectQuarterlyAgreementPdf(samplePayload);
const vectorPath = join(outDir, 'insect-quarterly-vector.pdf');
writeFileSync(vectorPath, vectorBytes);
console.log('Wrote vector PDF:', vectorPath, vectorBytes.length, 'bytes');

const previousFlag = process.env.INSECT_QUARTERLY_VECTOR_PDF;
delete process.env.INSECT_QUARTERLY_VECTOR_PDF;

const { outBytes: legacyBytes } = await buildQuotePdf({
  index: iqEntry.index,
  ...samplePayload,
});
const legacyPath = join(outDir, 'insect-quarterly-legacy.pdf');
writeFileSync(legacyPath, legacyBytes);
console.log('Wrote legacy PDF:', legacyPath, legacyBytes.length, 'bytes');

if (previousFlag === undefined) delete process.env.INSECT_QUARTERLY_VECTOR_PDF;
else process.env.INSECT_QUARTERLY_VECTOR_PDF = previousFlag;

console.log('\nRender PNG previews with:');
console.log(`  PLAYWRIGHT_BROWSERS_PATH=0 node server/scripts/render-pdf-preview.mjs ${legacyPath} ${join(outDir, 'insect-quarterly-legacy.png')}`);
console.log(`  PLAYWRIGHT_BROWSERS_PATH=0 node server/scripts/render-pdf-preview.mjs ${vectorPath} ${join(outDir, 'insect-quarterly-vector.png')}`);

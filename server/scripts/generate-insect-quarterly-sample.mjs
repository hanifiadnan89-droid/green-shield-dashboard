import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildInsectQuarterlyAgreementPdf } from '../services/insectQuarterlyAgreementPdf.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', '..', 'tmp');

const samplePayload = {
  lead: { name: 'Jane Doe', email: 'jane@example.com', phone: '207-555-0100' },
  address: { street: '123 Main St', cityState: 'Saco, ME 04072' },
  pricing: { initial: '749', discounted: '150', recurring: '65' },
  agreementStartDate: '2026-06-15',
};

const { outBytes } = await buildInsectQuarterlyAgreementPdf(samplePayload);

mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'insect-quarterly-vector.pdf');
writeFileSync(outPath, outBytes);
console.log('Wrote', outPath, outBytes.length, 'bytes');

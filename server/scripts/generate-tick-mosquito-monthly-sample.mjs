import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildTickMosquitoMonthlyAgreementPdf } from '../services/tickMosquitoMonthlyAgreementPdf.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', '..', 'tmp');

const samplePayload = {
  lead: { name: 'Jane Doe', email: 'jane@example.com', phone: '207-555-0100' },
  address: { street: '123 Greenway Drive', cityState: 'Saco, ME 04072' },
  pricing: { initial: '75', discounted: '0', recurring: '75' },
  agreementStartDate: '2026-06-15',
  cardLastFour: '4242',
};

const { outBytes } = await buildTickMosquitoMonthlyAgreementPdf(samplePayload);

mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'tick-mosquito-monthly-vector.pdf');
writeFileSync(outPath, outBytes);
console.log('Wrote', outPath, outBytes.length, 'bytes');

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildBedBugInsectTriannualAgreementPdf } from '../services/bedBugInsectTriannualAgreementPdf.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', '..', 'tmp');

const samplePayload = {
  lead: { name: 'Jane Doe', email: 'jane@example.com', phone: '207-555-0100' },
  address: { street: '123 Main St', cityState: 'Saco, ME 04072' },
  pricing: { initial: '749', discounted: '150', recurring: '123' },
  agreementStartDate: '2026-06-14',
  bedBugAgreement: { agreementDate: '2026-06-14', customerInitials: '', customerSignatureName: 'Adnan' },
};

const { outBytes } = await buildBedBugInsectTriannualAgreementPdf(samplePayload);

mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'bed-bug-insect-triannual-vector.pdf');
writeFileSync(outPath, outBytes);
console.log('Wrote', outPath, outBytes.length, 'bytes');

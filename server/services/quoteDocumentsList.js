import { readdir, stat } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import { BED_BUG_TEMPLATE_FILENAME } from './bedBugAgreementContent.js';

const readdirAsync = promisify(readdir);
const statAsync = promisify(stat);

const SUPPORTED_EXTS = new Set(['.pdf', '.png', '.jpg', '.jpeg']);

/** Never list duplicate Bed Bug templates in the dashboard selector. */
export const HIDDEN_QUOTE_TEMPLATES = new Set([
  'Bed Bug Agreement.pdf',
]);

const SERVICE_AGREEMENTS_FILE = 'Service Agreements.pdf';

const SERVICE_TYPE_PAGE = {
  commercial_bimonthly:    0,
  commercial_monthly:      1,
  insect_quarterly:        2,
  rodent_insect_triannual: 3,
  tick_mosquito_monthly:   4,
};

const SERVICE_DISPLAY = {
  commercial_bimonthly:    'Commercial Bi-Monthly Agreement',
  commercial_monthly:      'Commercial Monthly Agreement',
  insect_quarterly:        'Insect Quarterly Agreement',
  rodent_insect_triannual: 'Rodent & Insect Triannual Agreement',
  tick_mosquito_monthly:   'Tick & Mosquito Monthly Agreement',
};

function ext(name) {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i).toLowerCase();
}

export async function listQuoteDocuments(dir) {
  try {
    const files = await readdirAsync(dir);
    const results = [];
    let si = 0;
    for (let i = 0; i < files.length; i++) {
      const name = files[i];
      if (HIDDEN_QUOTE_TEMPLATES.has(name)) continue;
      const extension = ext(name);
      if (!SUPPORTED_EXTS.has(extension)) continue;
      const info = await statAsync(join(dir, name));
      const idx = si++;

      if (name === SERVICE_AGREEMENTS_FILE) {
        for (const [serviceType] of Object.entries(SERVICE_TYPE_PAGE)) {
          results.push({
            key:         `${idx}_${serviceType}`,
            index:       idx,
            name:        SERVICE_DISPLAY[serviceType],
            serviceType,
            type:        'pdf',
            size:        info.size,
            modified:    info.mtime,
          });
        }
      } else {
        results.push({
          key:      String(idx),
          index:    idx,
          name,
          type:     extension === '.pdf' ? 'pdf' : 'image',
          size:     info.size,
          modified: info.mtime,
        });
      }
    }
    return results;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export { BED_BUG_TEMPLATE_FILENAME };

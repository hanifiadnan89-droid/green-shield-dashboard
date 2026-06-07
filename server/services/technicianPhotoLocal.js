import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  TECHNICIAN_PHOTO_BY_NAME,
  TECHNICIAN_DISPLAY_NAMES,
} from '../../client/src/data/technicianPhotoManifest.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_TECHNICIANS_DIR = path.resolve(__dirname, '../../client/public/technicians');

/**
 * Build catalog from bundled public/technicians assets (source of truth).
 */
export function buildLocalTechnicianPhotoCatalog() {
  const byName = {};
  const missingFiles = [];

  for (const name of TECHNICIAN_DISPLAY_NAMES) {
    const urlPath = TECHNICIAN_PHOTO_BY_NAME[name];
    const filename = urlPath.replace(/^\/technicians\//, '');
    const filePath = path.join(PUBLIC_TECHNICIANS_DIR, filename);
    if (existsSync(filePath)) {
      byName[name] = urlPath;
    } else {
      byName[name] = null;
      missingFiles.push(name);
    }
  }

  return {
    source: 'local-bundled',
    technicians: TECHNICIAN_DISPLAY_NAMES,
    byName,
    unmatched: missingFiles,
  };
}

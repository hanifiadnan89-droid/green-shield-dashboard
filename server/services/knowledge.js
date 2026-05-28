import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = path.resolve(__dirname, '../../knowledge/knowledge');

let cachedKnowledge = null;

export function loadKnowledge() {
  if (cachedKnowledge) return cachedKnowledge;

  const files = readdirSync(KNOWLEDGE_DIR)
    .filter(f => f.endsWith('.md'))
    .sort();

  const sections = files.map(file => {
    const content = readFileSync(path.join(KNOWLEDGE_DIR, file), 'utf-8');
    return `=== ${file} ===\n${content.trim()}`;
  });

  cachedKnowledge = sections.join('\n\n');
  return cachedKnowledge;
}

// Call this if knowledge files change at runtime (dev only)
export function clearKnowledgeCache() {
  cachedKnowledge = null;
}

import OpenAI from 'openai';

const MODEL = 'text-embedding-3-small'; // 1536 dims, $0.02/1M tokens

let openai = null;

function getClient() {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set. Add it to server/.env to enable semantic retrieval.');
    }
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

/**
 * Generate a single embedding vector for a text string.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function generateEmbedding(text) {
  const input = text.trim().slice(0, 8000);
  const response = await getClient().embeddings.create({ model: MODEL, input });
  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in a single API call.
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
export async function generateEmbeddingsBatch(texts) {
  const inputs = texts.map((t) => t.trim().slice(0, 8000));
  const response = await getClient().embeddings.create({ model: MODEL, input: inputs });
  // OpenAI returns embeddings in the same order as input
  return response.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/**
 * Cosine similarity between two equal-length vectors.
 * Returns a value in [-1, 1]; higher = more similar.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
export function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

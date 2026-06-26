import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PNG } from 'pngjs';

const mockAnthropicCreate = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: class MockAnthropic {
    constructor() {
      this.messages = { create: mockAnthropicCreate };
    }
  },
}));

const ORIGINAL_ENV = { ...process.env };

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gs-kb-extraction-'));
}

async function writeTextPdf(filePath, text) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText(text, {
    x: 72,
    y: 700,
    font,
    size: 14,
    color: rgb(0, 0, 0),
    maxWidth: 468,
  });
  fs.writeFileSync(filePath, Buffer.from(await doc.save()));
}

async function writeImageOnlyPdf(filePath) {
  const doc = await PDFDocument.create();
  const png = new PNG({ width: 24, height: 24 });
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) << 2;
      png.data[idx] = 30;
      png.data[idx + 1] = 90;
      png.data[idx + 2] = 60;
      png.data[idx + 3] = 255;
    }
  }
  const embeddedImage = await doc.embedPng(PNG.sync.write(png));
  const page = doc.addPage([300, 200]);
  page.drawImage(embeddedImage, { x: 50, y: 40, width: 200, height: 120 });
  fs.writeFileSync(filePath, Buffer.from(await doc.save()));
}

describe('knowledgeBase extractionService', () => {
  let tempDir;
  let mod;

  beforeEach(async () => {
    tempDir = makeTempDir();
    process.env = { ...ORIGINAL_ENV };
    mockAnthropicCreate.mockReset();
    mod = await import('../extractionService.js');
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
    if (tempDir && fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('extracts selectable text from standard PDFs with pdf-parse v2', async () => {
    const filePath = path.join(tempDir, 'text.pdf');
    const expected = 'Green Shield selectable PDF extraction should preserve this standard business text.';
    await writeTextPdf(filePath, expected);

    const result = await mod.extractPdf(filePath);

    expect(result.text).toContain('Green Shield selectable PDF extraction');
    expect(result.wordCount).toBeGreaterThan(8);
    expect(result.metadata.pages).toBe(1);
    expect(result.metadata.error).toBeUndefined();
  });

  it('falls back to OCR for PDFs without selectable text when Anthropic is configured', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockAnthropicCreate.mockResolvedValue({
      content: [{ text: 'TYPE: Scanned sales note\n---\nScanned PDF OCR text for Green Shield.' }],
    });
    const filePath = path.join(tempDir, 'scanned.pdf');
    await writeImageOnlyPdf(filePath);

    const result = await mod.extractPdf(filePath);

    expect(result.text).toContain('Scanned PDF OCR text');
    expect(result.wordCount).toBeGreaterThan(5);
    expect(result.metadata.ocr).toBe(true);
    expect(result.metadata.pdfOcr).toBe(true);
    expect(result.metadata.pagesOcrAttempted).toBe(1);
    expect(mockAnthropicCreate).toHaveBeenCalledTimes(1);
    const content = mockAnthropicCreate.mock.calls[0][0].messages[0].content;
    expect(content.some((part) => part.type === 'image' && part.source.media_type === 'image/png')).toBe(true);
  });

  it('preserves error details for malformed PDFs', async () => {
    const filePath = path.join(tempDir, 'malformed.pdf');
    fs.writeFileSync(filePath, Buffer.from('%PDF-1.4\nthis is not a valid pdf body\n'));

    const result = await mod.extractPdf(filePath);

    expect(result.wordCount).toBe(0);
    expect(result.text).toMatch(/^\[PDF extraction failed:/);
    expect(result.metadata.error).toBeTruthy();
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('does not regress plain text, markdown, and csv extraction dispatch', async () => {
    const txtPath = path.join(tempDir, 'note.txt');
    const mdPath = path.join(tempDir, 'playbook.md');
    const csvPath = path.join(tempDir, 'pricing.csv');
    fs.writeFileSync(txtPath, 'Green Shield plain text knowledge survives extraction.');
    fs.writeFileSync(mdPath, '# Sales Playbook\n\nUse value framing.');
    fs.writeFileSync(csvPath, 'service,price\nInitial Service,199\nRecurring,69\n');

    await expect(mod.extractContent(txtPath, 'text/plain', 'note.txt')).resolves.toMatchObject({
      text: 'Green Shield plain text knowledge survives extraction.',
    });
    await expect(mod.extractContent(mdPath, 'text/markdown', 'playbook.md')).resolves.toMatchObject({
      wordCount: 6,
    });
    const csv = await mod.extractContent(csvPath, 'text/csv', 'pricing.csv');
    expect(csv.text).toContain('Initial Service');
    expect(csv.text).toContain('Recurring');
  });
});

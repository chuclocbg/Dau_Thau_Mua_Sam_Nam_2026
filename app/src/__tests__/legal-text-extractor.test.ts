/**
 * LegalTextExtractor tests
 *
 * Groups (13 × 3 = 39):
 *   LTE-01  extractText — passthrough and line-ending normalization
 *   LTE-02  extractText — whitespace normalization
 *   LTE-03  extractHtml — strips HTML tags
 *   LTE-04  extractHtml — preserves text content
 *   LTE-05  extractHtml — handles nested and block elements
 *   LTE-06  extractHtml — collapses whitespace
 *   LTE-07  extractHtml — handles empty and whitespace-only input
 *   LTE-08  extractDocx — rejects invalid buffer
 *   LTE-09  extractDocx — extracts text from minimal valid DOCX
 *   LTE-10  extractDocx — handles Vietnamese text in XML
 *   LTE-11  detectFormat — from file extension
 *   LTE-12  detectFormat — from MIME type
 *   LTE-13  extractByFormat — dispatches correctly
 */

import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import {
  extractText,
  extractHtml,
  extractDocx,
  detectFormat,
  extractByFormat,
} from '../agents/LegalTextExtractor';

// ─── DOCX fixture builder ─────────────────────────────────────────────────────

async function makeDocxBuffer(content: string): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p ><w:r><w:t>${content}</w:t></w:r></w:p>
</w:body>
</w:document>`;
  zip.file('word/document.xml', xml);
  zip.file('[Content_Types].xml', `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>`);
  const blob = await zip.generateAsync({ type: 'arraybuffer' });
  return blob;
}

// ─── LTE-01: extractText — passthrough ───────────────────────────────────────

describe('LTE-01 extractText passes through plain text unchanged', () => {
  it('returns the same string content', () => {
    const { text } = extractText('Điều 1. Phạm vi điều chỉnh');
    expect(text).toBe('Điều 1. Phạm vi điều chỉnh');
  });
  it('format is TEXT', () => {
    expect(extractText('hello').format).toBe('TEXT');
  });
  it('pages is 0', () => {
    expect(extractText('hello').pages).toBe(0);
  });
});

// ─── LTE-02: extractText — line ending normalization ─────────────────────────

describe('LTE-02 extractText normalises line endings', () => {
  it('converts CRLF to LF', () => {
    expect(extractText('line1\r\nline2').text).toBe('line1\nline2');
  });
  it('converts bare CR to LF', () => {
    expect(extractText('line1\rline2').text).toBe('line1\nline2');
  });
  it('trims leading and trailing whitespace', () => {
    expect(extractText('  \n  hello  \n  ').text).toBe('hello');
  });
});

// ─── LTE-03: extractHtml — strips HTML tags ───────────────────────────────────

describe('LTE-03 extractHtml strips all HTML tags', () => {
  it('strips <p> tags', () => {
    expect(extractHtml('<p>Điều 1</p>').text).toContain('Điều 1');
    expect(extractHtml('<p>Điều 1</p>').text).not.toContain('<p>');
  });
  it('strips <span> tags', () => {
    const { text } = extractHtml('<span class="bold">Nghị định</span>');
    expect(text).toBe('Nghị định');
  });
  it('strips nested tags and returns only text', () => {
    const { text } = extractHtml('<div><h1>LUẬT</h1><p>nội dung</p></div>');
    expect(text).not.toContain('<');
    expect(text).not.toContain('>');
  });
});

// ─── LTE-04: extractHtml — preserves text content ────────────────────────────

describe('LTE-04 extractHtml preserves text content from HTML', () => {
  it('preserves Vietnamese text', () => {
    const { text } = extractHtml('<p>Quốc hội nước Cộng hòa xã hội chủ nghĩa Việt Nam</p>');
    expect(text).toContain('Quốc hội');
  });
  it('format is HTML', () => {
    expect(extractHtml('<p>test</p>').format).toBe('HTML');
  });
  it('preserves content order across paragraphs', () => {
    const { text } = extractHtml('<p>Điều 1</p><p>Điều 2</p>');
    expect(text.indexOf('Điều 1')).toBeLessThan(text.indexOf('Điều 2'));
  });
});

// ─── LTE-05: extractHtml — handles nested block elements ─────────────────────

describe('LTE-05 extractHtml handles nested and block HTML elements', () => {
  it('table cells produce separate text segments', () => {
    const { text } = extractHtml('<table><tr><td>A</td><td>B</td></tr></table>');
    expect(text).toContain('A');
    expect(text).toContain('B');
  });
  it('h1/h2 content is preserved', () => {
    const { text } = extractHtml('<h1>CHƯƠNG I</h1><h2>QUY ĐỊNH CHUNG</h2>');
    expect(text).toContain('CHƯƠNG I');
    expect(text).toContain('QUY ĐỊNH CHUNG');
  });
  it('list items preserve content', () => {
    const { text } = extractHtml('<ul><li>khoản 1</li><li>khoản 2</li></ul>');
    expect(text).toContain('khoản 1');
    expect(text).toContain('khoản 2');
  });
});

// ─── LTE-06: extractHtml — collapses whitespace ───────────────────────────────

describe('LTE-06 extractHtml collapses multiple spaces', () => {
  it('multiple spaces collapse to one', () => {
    const { text } = extractHtml('<p>Điều    1.   Phạm vi</p>');
    expect(text).not.toMatch(/  /);
  });
  it('does not produce more than 2 consecutive newlines', () => {
    const { text } = extractHtml('<p>A</p><p></p><p></p><p>B</p>');
    expect(text).not.toMatch(/\n{3,}/);
  });
  it('result is trimmed', () => {
    const { text } = extractHtml('   <p>Nội dung</p>   ');
    expect(text).toBe('Nội dung');
  });
});

// ─── LTE-07: extractHtml — empty input ───────────────────────────────────────

describe('LTE-07 extractHtml handles empty and whitespace-only input', () => {
  it('empty string returns empty text', () => {
    expect(extractHtml('').text).toBe('');
  });
  it('whitespace-only returns empty text', () => {
    expect(extractHtml('   ').text).toBe('');
  });
  it('HTML with no text content returns empty', () => {
    expect(extractHtml('<div><span></span></div>').text).toBe('');
  });
});

// ─── LTE-08: extractDocx — rejects invalid buffer ────────────────────────────

describe('LTE-08 extractDocx rejects invalid buffers', () => {
  it('rejects empty ArrayBuffer', async () => {
    await expect(extractDocx(new ArrayBuffer(0))).rejects.toThrow();
  });
  it('rejects random bytes that are not a ZIP', async () => {
    const buf = new Uint8Array([0xff, 0xfe, 0xfd, 0xfc]).buffer;
    await expect(extractDocx(buf)).rejects.toThrow();
  });
  it('throws Error (not string)', async () => {
    try {
      await extractDocx(new ArrayBuffer(0));
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });
});

// ─── LTE-09: extractDocx — extracts text from valid DOCX ─────────────────────

describe('LTE-09 extractDocx extracts text from a minimal valid DOCX', () => {
  it('extracts "Hello World" from single-paragraph DOCX', async () => {
    const buf = await makeDocxBuffer('Hello World');
    const { text } = await extractDocx(buf);
    expect(text).toContain('Hello World');
  });
  it('format is DOCX', async () => {
    const buf = await makeDocxBuffer('test');
    expect((await extractDocx(buf)).format).toBe('DOCX');
  });
  it('text is not empty for non-empty DOCX', async () => {
    const buf = await makeDocxBuffer('Nội dung điều khoản');
    const { text } = await extractDocx(buf);
    expect(text.length).toBeGreaterThan(0);
  });
});

// ─── LTE-10: extractDocx — Vietnamese text ───────────────────────────────────

describe('LTE-10 extractDocx preserves Vietnamese text in DOCX', () => {
  it('preserves "Điều 1. Phạm vi điều chỉnh"', async () => {
    const buf = await makeDocxBuffer('Điều 1. Phạm vi điều chỉnh');
    const { text } = await extractDocx(buf);
    expect(text).toContain('Điều 1');
  });
  it('preserves "Nghị định số 214/2025/NĐ-CP"', async () => {
    const buf = await makeDocxBuffer('Nghị định số 214/2025/NĐ-CP');
    const { text } = await extractDocx(buf);
    expect(text).toContain('214/2025');
  });
  it('strips XML tags from around Vietnamese text', async () => {
    const buf = await makeDocxBuffer('Quốc hội');
    const { text } = await extractDocx(buf);
    expect(text).not.toContain('<w:');
  });
});

// ─── LTE-11: detectFormat — from file extension ───────────────────────────────

describe('LTE-11 detectFormat infers format from file extension', () => {
  it('.docx → DOCX', () => {
    expect(detectFormat('document.docx')).toBe('DOCX');
  });
  it('.pdf → PDF', () => {
    expect(detectFormat('luat22.pdf')).toBe('PDF');
  });
  it('.html → HTML', () => {
    expect(detectFormat('index.html')).toBe('HTML');
  });
});

// ─── LTE-12: detectFormat — from MIME type ────────────────────────────────────

describe('LTE-12 detectFormat infers format from MIME type', () => {
  it('application/pdf → PDF', () => {
    expect(detectFormat('application/pdf')).toBe('PDF');
  });
  it('text/html → HTML', () => {
    expect(detectFormat('text/html')).toBe('HTML');
  });
  it('unknown MIME → TEXT', () => {
    expect(detectFormat('application/octet-stream')).toBe('TEXT');
  });
});

// ─── LTE-13: extractByFormat — dispatches correctly ──────────────────────────

describe('LTE-13 extractByFormat dispatches to the correct extractor', () => {
  it('TEXT format returns extractText result', async () => {
    const { format } = await extractByFormat('Điều 1', 'TEXT');
    expect(format).toBe('TEXT');
  });
  it('HTML format returns extractHtml result', async () => {
    const { format } = await extractByFormat('<p>text</p>', 'HTML');
    expect(format).toBe('HTML');
  });
  it('PDF format returns TEXT result (pre-extracted text path)', async () => {
    const { text } = await extractByFormat('Điều 1 nội dung', 'PDF');
    expect(text).toContain('Điều 1');
  });
});

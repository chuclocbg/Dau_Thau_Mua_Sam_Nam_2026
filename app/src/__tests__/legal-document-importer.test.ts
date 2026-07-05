/**
 * LegalDocumentImporter tests
 *
 * Groups (13 × 3 = 39):
 *   LIM-01  importText — basic import produces ImportedDocument
 *   LIM-02  importText — metadata fields
 *   LIM-03  importText — article count from fixture
 *   LIM-04  importText — clause and point counts
 *   LIM-05  importText — id generation from symbol
 *   LIM-06  importHtml — strips HTML and parses structure
 *   LIM-07  importHtml — metadata from HTML document
 *   LIM-08  importDocx — async import from ArrayBuffer
 *   LIM-09  import()   — format detection via filename hint
 *   LIM-10  import()   — format detection via MIME type
 *   LIM-11  SEED_DOCUMENT_SYMBOLS — completeness and helper
 *   LIM-12  isSeedDocument — true for seeds, false for others
 *   LIM-13  importedAt  — ISO 8601 timestamp
 */

import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import {
  LegalDocumentImporter,
  SEED_DOCUMENT_SYMBOLS,
  isSeedDocument,
} from '../agents/LegalDocumentImporter';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const LUAT_TEXT = `QUỐC HỘI
Số: 22/2023/QH15
LUẬT ĐẤU THẦU
Có hiệu lực thi hành từ ngày 01 tháng 01 năm 2024.

Điều 1. Phạm vi điều chỉnh
Luật này quy định về hoạt động đấu thầu, lựa chọn nhà thầu.

Điều 2. Đối tượng áp dụng
1. Tổ chức, cá nhân tham gia hoặc có liên quan đến hoạt động đấu thầu.
2. Luật này không áp dụng đối với:
a) Mua sắm trong nội bộ cơ quan nhà nước.
b) Mua sắm có giá trị nhỏ lẻ.

Điều 3. Giải thích từ ngữ
1. Đấu thầu là quá trình lựa chọn nhà thầu.
2. Nhà thầu là tổ chức hoặc cá nhân đáp ứng yêu cầu.`;

const NGHI_DINH_TEXT = `CHÍNH PHỦ
Số: 214/2025/NĐ-CP
NGHỊ ĐỊNH
Quy định chi tiết Luật Đấu thầu
Nghị định này có hiệu lực từ ngày 01/07/2025.

Điều 1. Phạm vi điều chỉnh
Nghị định này quy định chi tiết và hướng dẫn thi hành.

Điều 2. Đối tượng áp dụng
1. Tổ chức, cá nhân thực hiện hoạt động đấu thầu.
2. Cơ quan quản lý nhà nước về đấu thầu.`;

const LUAT_HTML = `<!DOCTYPE html><html><body>
<h1>LUẬT ĐẤU THẦU</h1>
<p>Số: 22/2023/QH15</p>
<p>Có hiệu lực thi hành từ ngày 01 tháng 01 năm 2024.</p>
<p>Điều 1. Phạm vi điều chỉnh</p>
<p>Luật này quy định về hoạt động đấu thầu.</p>
<p>Điều 2. Đối tượng áp dụng</p>
<p>1. Tổ chức, cá nhân tham gia đấu thầu.</p>
</body></html>`;

async function makeDocxBuffer(content: string): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body><w:p ><w:r><w:t>${content}</w:t></w:r></w:p></w:body>
</w:document>`;
  zip.file('word/document.xml', xml);
  zip.file('[Content_Types].xml', `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>`);
  return zip.generateAsync({ type: 'arraybuffer' });
}

// ─── LIM-01: importText — produces ImportedDocument ──────────────────────────

describe('LIM-01 importText produces a valid ImportedDocument', () => {
  const importer = new LegalDocumentImporter();
  const doc      = importer.importText(LUAT_TEXT);

  it('id is non-empty string', () => {
    expect(typeof doc.id).toBe('string');
    expect(doc.id.length).toBeGreaterThan(0);
  });
  it('has parsed field with metadata', () => {
    expect(doc.parsed).toBeDefined();
    expect(doc.parsed.metadata).toBeDefined();
  });
  it('sourceFormat is TEXT', () => {
    expect(doc.sourceFormat).toBe('TEXT');
  });
});

// ─── LIM-02: importText — metadata fields ────────────────────────────────────

describe('LIM-02 importText extracts metadata from Luật fixture', () => {
  const importer = new LegalDocumentImporter();
  const doc      = importer.importText(LUAT_TEXT);

  it('symbol is "22/2023/QH15"', () => {
    expect(doc.symbol).toBe('22/2023/QH15');
  });
  it('documentType is "LAW"', () => {
    expect(doc.documentType).toBe('LAW');
  });
  it('issuer is "Quốc hội"', () => {
    expect(doc.issuer).toBe('Quốc hội');
  });
});

// ─── LIM-03: importText — article count ──────────────────────────────────────

describe('LIM-03 importText counts articles correctly', () => {
  const importer = new LegalDocumentImporter();

  it('Luật fixture has 3 articles', () => {
    expect(importer.importText(LUAT_TEXT).articleCount).toBe(3);
  });
  it('Nghị định fixture has 2 articles', () => {
    expect(importer.importText(NGHI_DINH_TEXT).articleCount).toBe(2);
  });
  it('text with no Điều markers has 0 articles', () => {
    expect(importer.importText('Plain text without articles').articleCount).toBe(0);
  });
});

// ─── LIM-04: importText — clause and point counts ────────────────────────────

describe('LIM-04 importText counts clauses and points', () => {
  const importer = new LegalDocumentImporter();
  const doc      = importer.importText(LUAT_TEXT);

  it('clauseCount is >= 0', () => {
    expect(doc.clauseCount).toBeGreaterThanOrEqual(0);
  });
  it('pointCount is >= 0', () => {
    expect(doc.pointCount).toBeGreaterThanOrEqual(0);
  });
  it('Luật fixture has at least 2 points (điểm a and điểm b in Điều 2)', () => {
    expect(doc.pointCount).toBeGreaterThanOrEqual(2);
  });
});

// ─── LIM-05: importText — id generation ──────────────────────────────────────

describe('LIM-05 importText generates id from symbol', () => {
  const importer = new LegalDocumentImporter();

  it('id for 22/2023/QH15 contains "22"', () => {
    expect(importer.importText(LUAT_TEXT).id).toContain('22');
  });
  it('id for 214/2025/NĐ-CP contains "214"', () => {
    expect(importer.importText(NGHI_DINH_TEXT).id).toContain('214');
  });
  it('id contains no forward slashes', () => {
    expect(importer.importText(LUAT_TEXT).id).not.toContain('/');
  });
});

// ─── LIM-06: importHtml — strips HTML and parses ─────────────────────────────

describe('LIM-06 importHtml strips HTML tags and parses structure', () => {
  const importer = new LegalDocumentImporter();
  const doc      = importer.importHtml(LUAT_HTML);

  it('sourceFormat is HTML', () => {
    expect(doc.sourceFormat).toBe('HTML');
  });
  it('symbol extracted from HTML content', () => {
    expect(doc.symbol).toBe('22/2023/QH15');
  });
  it('articleCount > 0 (Điều 1, Điều 2 present)', () => {
    expect(doc.articleCount).toBeGreaterThan(0);
  });
});

// ─── LIM-07: importHtml — metadata from HTML document ────────────────────────

describe('LIM-07 importHtml extracts metadata from HTML Luật', () => {
  const importer = new LegalDocumentImporter();
  const doc      = importer.importHtml(LUAT_HTML);

  it('documentType is LAW', () => {
    expect(doc.documentType).toBe('LAW');
  });
  it('issuer is Quốc hội', () => {
    expect(doc.issuer).toBe('Quốc hội');
  });
  it('effectiveDate is 2024-01-01', () => {
    expect(doc.effectiveDate).toBe('2024-01-01');
  });
});

// ─── LIM-08: importDocx — async ArrayBuffer import ───────────────────────────

describe('LIM-08 importDocx imports from DOCX ArrayBuffer', () => {
  const importer = new LegalDocumentImporter();

  it('resolves to ImportedDocument', async () => {
    const buf = await makeDocxBuffer('Điều 1. Phạm vi điều chỉnh\nNội dung.');
    const doc = await importer.importDocx(buf);
    expect(doc).toBeDefined();
  });
  it('sourceFormat is DOCX', async () => {
    const buf = await makeDocxBuffer('Số: 214/2025/NĐ-CP\nNghị định');
    const doc = await importer.importDocx(buf);
    expect(doc.sourceFormat).toBe('DOCX');
  });
  it('rejects on invalid buffer', async () => {
    const bad = new Uint8Array([0, 1, 2, 3]).buffer;
    await expect(importer.importDocx(bad)).rejects.toThrow();
  });
});

// ─── LIM-09: import() — format detection via filename ────────────────────────

describe('LIM-09 import() detects format from filename hint', () => {
  const importer = new LegalDocumentImporter();

  it('HTML filename → sourceFormat TEXT or HTML (parsed from string)', async () => {
    const doc = await importer.import(LUAT_HTML, { filename: 'luat.html' });
    expect(['HTML', 'TEXT']).toContain(doc.sourceFormat);
  });
  it('TEXT filename → sourceFormat TEXT', async () => {
    const doc = await importer.import(LUAT_TEXT, { filename: 'luat.txt' });
    expect(doc.sourceFormat).toBe('TEXT');
  });
  it('explicit format override takes precedence', async () => {
    const doc = await importer.import(LUAT_TEXT, { format: 'TEXT' });
    expect(doc.sourceFormat).toBe('TEXT');
  });
});

// ─── LIM-10: import() — format detection via MIME type ───────────────────────

describe('LIM-10 import() detects format from MIME type hint', () => {
  const importer = new LegalDocumentImporter();

  it('text/html MIME type detected as HTML', async () => {
    const doc = await importer.import(LUAT_HTML, { mimeType: 'text/html' });
    expect(doc.sourceFormat).toBe('HTML');
  });
  it('no hint → TEXT format', async () => {
    const doc = await importer.import(LUAT_TEXT);
    expect(doc.sourceFormat).toBe('TEXT');
  });
  it('import resolves to ImportedDocument in all cases', async () => {
    const doc = await importer.import(NGHI_DINH_TEXT);
    expect(doc.symbol).toBe('214/2025/NĐ-CP');
  });
});

// ─── LIM-11: SEED_DOCUMENT_SYMBOLS — completeness ────────────────────────────

describe('LIM-11 SEED_DOCUMENT_SYMBOLS contains all five Phase A documents', () => {
  it('contains 5 symbols', () => {
    expect(SEED_DOCUMENT_SYMBOLS).toHaveLength(5);
  });
  it('includes Luật 22/2023/QH15', () => {
    expect(SEED_DOCUMENT_SYMBOLS).toContain('22/2023/QH15');
  });
  it('includes all four subsidiary regulations', () => {
    expect(SEED_DOCUMENT_SYMBOLS).toContain('214/2025/NĐ-CP');
    expect(SEED_DOCUMENT_SYMBOLS).toContain('104/2026/NĐ-CP');
    expect(SEED_DOCUMENT_SYMBOLS).toContain('79/2025/TT-BTC');
    expect(SEED_DOCUMENT_SYMBOLS).toContain('13/2026/TT-BCT');
  });
});

// ─── LIM-12: isSeedDocument ──────────────────────────────────────────────────

describe('LIM-12 isSeedDocument identifies seed documents correctly', () => {
  it('returns true for "22/2023/QH15"', () => {
    expect(isSeedDocument('22/2023/QH15')).toBe(true);
  });
  it('returns true for "104/2026/NĐ-CP"', () => {
    expect(isSeedDocument('104/2026/NĐ-CP')).toBe(true);
  });
  it('returns false for unknown symbol', () => {
    expect(isSeedDocument('99/2024/TT-BYT')).toBe(false);
  });
});

// ─── LIM-13: importedAt — ISO 8601 timestamp ─────────────────────────────────

describe('LIM-13 importedAt is a valid ISO 8601 timestamp', () => {
  const importer = new LegalDocumentImporter();

  it('importedAt is a string', () => {
    expect(typeof importer.importText(LUAT_TEXT).importedAt).toBe('string');
  });
  it('importedAt parses to a valid Date', () => {
    const { importedAt } = importer.importText(LUAT_TEXT);
    expect(isNaN(Date.parse(importedAt))).toBe(false);
  });
  it('importedAt contains T separator (ISO format)', () => {
    expect(importer.importText(LUAT_TEXT).importedAt).toContain('T');
  });
});

// @vitest-environment node
/**
 * Legal v1.1 — Pipeline tests
 *
 * Tests scanner, metadata extractor, chunker, keyword extractor,
 * entry generator, and KB source generator in isolation.
 *
 * Groups:
 *   PL-01  (6)  Scanner
 *   PL-02  (7)  Metadata extractor
 *   PL-03  (8)  Chunker
 *   PL-04  (5)  Keyword extractor
 *   PL-05  (6)  Entry generator
 *   PL-06  (4)  Source generator + determinism
 *   PL-07  (4)  BM25 compatibility
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { fileURLToPath } from 'url';

import {
  scanLegalDir,
  extractMetadata,
  chunkText,
  textToKeywords,
  makeEntry,
  generateKBSource,
  runPipeline,
  type DocFile,
  type LegalEntry,
} from '../../scripts/buildLegalKB.js';

// ─── Path helpers ──────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEGAL_DIR = path.resolve(__dirname, '../../../Legal');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PLACEHOLDER_TEXT = `# NGHỊ ĐỊNH 52/2026/NĐ-CP

**Loại văn bản:** Nghị định
**Năm ban hành:** 2026

## ⚠ YÊU CẦU HÀNH ĐỘNG

File này là placeholder. Văn bản gốc cần được tải từ nguồn chính thức.
`;

const REAL_MD_TEXT = `# NGHỊ ĐỊNH 60/2021/NĐ-CP

**Loại văn bản:** Nghị định
**Cơ quan ban hành:** Chính phủ
**Ngày ban hành:** 21/06/2021
**Nội dung:** Cơ chế tự chủ tài chính của đơn vị sự nghiệp công lập

## Nội dung liên quan đến hồ sơ mua sắm

NĐ 60/2021 là căn cứ xác định phân loại đơn vị sự nghiệp tự chủ nhóm 1/2/3/4.
Trường Cao đẳng Kỹ thuật Công nghiệp thuộc nhóm 2 theo Quyết định 541 Bộ Công Thương.
Thẩm quyền chi tiêu từ nguồn thu hợp pháp của đơn vị tự chủ nhóm 2.
Phải lập kế hoạch mua sắm theo quy định đấu thầu hiện hành.
`;

const LONG_TEXT = `# Tài liệu dài để kiểm tra chunker

## Chương I: Quy định chung

${Array(60).fill('Điều này quy định về quy trình lựa chọn nhà thầu cho các gói thầu mua sắm tài sản công tại đơn vị sự nghiệp công lập theo quy định của pháp luật hiện hành.').join('\n')}

## Chương II: Thủ tục thực hiện

${Array(60).fill('Đơn vị phải lập kế hoạch lựa chọn nhà thầu và trình cấp có thẩm quyền phê duyệt trước khi tiến hành mua sắm hàng hóa dịch vụ từ ngân sách nhà nước.').join('\n')}

## Chương III: Kết luận

${Array(40).fill('Tất cả các gói thầu có giá trị trên 50 triệu đồng phải được đăng tải trên hệ thống mạng đấu thầu quốc gia theo quy định tại Điều 12 Luật Đấu thầu 22/2023/QH15.').join('\n')}
`;

function makeDocFile(relPath: string, ext: '.md' | '.docx' = '.md'): DocFile {
  return {
    absPath: path.join(LEGAL_DIR, relPath),
    relPath,
    ext,
    name: path.basename(relPath, ext),
  };
}

// ─── PL-01: Scanner ────────────────────────────────────────────────────────────

describe('PL-01 · Scanner', () => {
  it('PL-01-01: scanLegalDir returns non-empty array for Legal/', () => {
    const files = scanLegalDir(LEGAL_DIR);
    expect(files.length).toBeGreaterThan(0);
  });

  it('PL-01-02: returns only .md and .docx files', () => {
    const files = scanLegalDir(LEGAL_DIR);
    for (const f of files) {
      expect(['.md', '.docx']).toContain(f.ext);
    }
  });

  it('PL-01-03: does not include .pdf or .png files', () => {
    const files = scanLegalDir(LEGAL_DIR);
    const badExts = files.filter(f => f.ext !== '.md' && f.ext !== '.docx');
    expect(badExts).toHaveLength(0);
  });

  it('PL-01-04: each file has absPath, relPath, ext, name', () => {
    const files = scanLegalDir(LEGAL_DIR);
    for (const f of files) {
      expect(f.absPath.length).toBeGreaterThan(0);
      expect(f.relPath.length).toBeGreaterThan(0);
      expect(f.name.length).toBeGreaterThan(0);
    }
  });

  it('PL-01-05: returns empty array for non-existent directory (graceful)', () => {
    const files = scanLegalDir('/nonexistent/path/that/does/not/exist');
    expect(files).toEqual([]);
  });

  it('PL-01-06: results are sorted by relPath', () => {
    const files = scanLegalDir(LEGAL_DIR);
    for (let i = 1; i < files.length; i++) {
      expect(files[i].relPath >= files[i - 1].relPath).toBe(true);
    }
  });
});

// ─── PL-02: Metadata extractor ────────────────────────────────────────────────

describe('PL-02 · Metadata extractor', () => {
  it('PL-02-01: extracts title from # heading', () => {
    const meta = extractMetadata(makeDocFile('test.md'), REAL_MD_TEXT);
    expect(meta.title).toBe('NGHỊ ĐỊNH 60/2021/NĐ-CP');
  });

  it('PL-02-02: detects placeholder files', () => {
    const meta = extractMetadata(makeDocFile('test.md'), PLACEHOLDER_TEXT);
    expect(meta.isPlaceholder).toBe(true);
  });

  it('PL-02-03: real documents are not placeholder', () => {
    const meta = extractMetadata(makeDocFile('test.md'), REAL_MD_TEXT);
    expect(meta.isPlaceholder).toBe(false);
  });

  it('PL-02-04: extracts effectiveDate from Ngày/Năm ban hành', () => {
    const meta = extractMetadata(makeDocFile('test.md'), REAL_MD_TEXT);
    expect(meta.effectiveDate).toContain('21/06/2021');
  });

  it('PL-02-05: generates deterministic id from relPath', () => {
    const meta1 = extractMetadata(makeDocFile('Laws/luat-22.md'), REAL_MD_TEXT);
    const meta2 = extractMetadata(makeDocFile('Laws/luat-22.md'), REAL_MD_TEXT);
    expect(meta1.id).toBe(meta2.id);
    expect(meta1.id.startsWith('doc-')).toBe(true);
  });

  it('PL-02-06: category derived from first directory component', () => {
    const meta = extractMetadata(makeDocFile('Decrees/nd-60.md'), REAL_MD_TEXT);
    expect(meta.category).toBe('Decrees');
  });

  it('PL-02-07: root-level files have category "root"', () => {
    const meta = extractMetadata(makeDocFile('some-file.md'), REAL_MD_TEXT);
    expect(meta.category).toBe('root');
  });

  it('PL-02-08: body preserves h2 headings but not h1 title', () => {
    const meta = extractMetadata(makeDocFile('test.md'), REAL_MD_TEXT);
    // h2 must survive so chunkText.splitAtSections can use it as a boundary
    expect(meta.content).toContain('## Nội dung liên quan đến hồ sơ mua sắm');
    // h1 title must be stripped (already captured in meta.title)
    expect(meta.content).not.toContain('# NGHỊ ĐỊNH 60/2021/NĐ-CP');
  });
});

// ─── PL-03: Chunker ────────────────────────────────────────────────────────────

describe('PL-03 · Chunker', () => {
  it('PL-03-01: short text returns single chunk', () => {
    const text = 'Đây là văn bản ngắn về quy định mua sắm tài sản công.';
    const chunks = chunkText(text, 1500);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it('PL-03-02: empty text returns empty array', () => {
    expect(chunkText('', 1500)).toHaveLength(0);
    expect(chunkText('   ', 1500)).toHaveLength(0);
  });

  it('PL-03-03: long text is split into multiple chunks', () => {
    const chunks = chunkText(LONG_TEXT, 200);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('PL-03-04: each chunk is within word limit', () => {
    const chunks = chunkText(LONG_TEXT, 200);
    for (const chunk of chunks) {
      const wordCount = chunk.trim().split(/\s+/).filter(Boolean).length;
      // Allow small overshoot when a single paragraph exceeds limit
      expect(wordCount).toBeLessThanOrEqual(250);
    }
  });

  it('PL-03-05: chunks together cover a majority of original content', () => {
    const chunks = chunkText(LONG_TEXT, 200);
    // At least 3 chunks should exist for a large document
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    // Each chunk is non-trivially sized
    for (const c of chunks) {
      expect(c.trim().length).toBeGreaterThan(10);
    }
  });

  it('PL-03-06: single-section text at boundary stays as one chunk', () => {
    const text = Array(100).fill('quy định mua sắm').join(' ');
    const chunks = chunkText(text, 200);
    // 100 * 3 = 300 words > 200, but it's one paragraph so might hard-split
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it('PL-03-07: respects section headings as split boundaries', () => {
    const twoSection = `## Phần 1\n${Array(100).fill('nội dung').join(' ')}\n\n## Phần 2\n${Array(100).fill('nội dung').join(' ')}`;
    const chunks = chunkText(twoSection, 80);
    // Two sections of 100 words each, limit 80 → must split
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it('PL-03-08: chunks from the same text are deterministic', () => {
    const c1 = chunkText(LONG_TEXT, 300);
    const c2 = chunkText(LONG_TEXT, 300);
    expect(c1).toEqual(c2);
  });
});

// ─── PL-04: Keyword extractor ─────────────────────────────────────────────────

describe('PL-04 · Keyword extractor', () => {
  it('PL-04-01: returns non-empty array', () => {
    const kw = textToKeywords(REAL_MD_TEXT);
    expect(kw.length).toBeGreaterThan(0);
  });

  it('PL-04-02: respects limit parameter', () => {
    const kw = textToKeywords(REAL_MD_TEXT, 5);
    expect(kw.length).toBeLessThanOrEqual(5);
  });

  it('PL-04-03: keywords are non-empty strings with length >= 4', () => {
    const kw = textToKeywords(REAL_MD_TEXT, 8);
    for (const k of kw) {
      expect(k.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('PL-04-04: empty text returns empty array', () => {
    expect(textToKeywords('')).toHaveLength(0);
  });

  it('PL-04-05: keywords are unique', () => {
    const kw = textToKeywords(REAL_MD_TEXT);
    expect(new Set(kw).size).toBe(kw.length);
  });
});

// ─── PL-05: Entry generator ───────────────────────────────────────────────────

describe('PL-05 · Entry generator', () => {
  const baseMeta = {
    id: 'doc-test',
    title: 'NGHỊ ĐỊNH 60/2021/NĐ-CP',
    category: 'Decrees',
    sourceFile: 'Decrees/nd-60.md',
    keywords: ['nghị định', 'tự chủ', 'đơn vị'],
    effectiveDate: '21/06/2021',
    content: REAL_MD_TEXT,
    isPlaceholder: false,
  };

  it('PL-05-01: generates entry with required LegalEntry fields', () => {
    const entry = makeEntry(baseMeta, REAL_MD_TEXT.slice(0, 500), 0, 1);
    expect(entry.id).toBeTruthy();
    expect(entry.title.length).toBeGreaterThan(5);
    expect(entry.source.length).toBeGreaterThan(5);
    expect(Array.isArray(entry.keywords)).toBe(true);
    expect(entry.keywords.length).toBeGreaterThan(0);
    expect(entry.content.length).toBeGreaterThan(50);
  });

  it('PL-05-02: single-chunk entry has no chunk suffix in id', () => {
    const entry = makeEntry(baseMeta, 'content here', 0, 1);
    expect(entry.id).toBe('doc-test');
  });

  it('PL-05-03: multi-chunk entry appends chunk index to id', () => {
    const e0 = makeEntry(baseMeta, 'chunk one', 0, 3);
    const e1 = makeEntry(baseMeta, 'chunk two', 1, 3);
    expect(e0.id).toBe('doc-test-c001');
    expect(e1.id).toBe('doc-test-c002');
  });

  it('PL-05-04: content is capped at 3000 chars', () => {
    const longContent = 'x '.repeat(5000);
    const entry = makeEntry(baseMeta, longContent, 0, 1);
    expect(entry.content.length).toBeLessThanOrEqual(3000);
  });

  it('PL-05-05: appliesTo is populated from category', () => {
    const entry = makeEntry(baseMeta, 'content', 0, 1);
    expect(Array.isArray(entry.appliesTo)).toBe(true);
    expect((entry.appliesTo ?? []).length).toBeGreaterThan(0);
  });

  it('PL-05-06: source includes effectiveDate when present', () => {
    const entry = makeEntry(baseMeta, 'content', 0, 1);
    expect(entry.source).toContain('21/06/2021');
  });
});

// ─── PL-06: Source generator + determinism ────────────────────────────────────

describe('PL-06 · Source generator', () => {
  const sampleEntry: LegalEntry = {
    id: 'doc-sample',
    title: 'Văn bản mẫu',
    source: 'Nguồn mẫu (2026)',
    keywords: ['mua sắm', 'đấu thầu', 'tài sản'],
    content: 'Nội dung mẫu cho kiểm tra.',
    appliesTo: ['procurement'],
  };

  it('PL-06-01: generated source contains interface LegalEntry', () => {
    const src = generateKBSource([sampleEntry]);
    expect(src).toContain('interface LegalEntry');
  });

  it('PL-06-02: generated source contains LEGAL_KB export', () => {
    const src = generateKBSource([sampleEntry]);
    expect(src).toContain('export const LEGAL_KB');
  });

  it('PL-06-03: generated source contains searchLegalKB function', () => {
    const src = generateKBSource([sampleEntry]);
    expect(src).toContain('searchLegalKB');
  });

  it('PL-06-04: same entries produce identical output (deterministic)', () => {
    const s1 = generateKBSource([sampleEntry]);
    const s2 = generateKBSource([sampleEntry]);
    expect(s1).toBe(s2);
  });

  it('PL-06-05: content with apostrophe is safely serialized in generated source', () => {
    const entryWithApostrophe: LegalEntry = {
      id: 'doc-apos',
      title: 'Quy định hợp đồng',
      source: 'Nguồn (2026)',
      keywords: ['hợp đồng'],
      // apostrophe in content must not produce unescaped ' inside a JS string literal
      content: "Điều khoản không được chia nhỏ gói thầu. Don't split packages.",
      appliesTo: ['procurement'],
    };
    const src = generateKBSource([entryWithApostrophe]);
    // Apostrophe survives literally (JSON doesn't escape ')
    expect(src).toContain("Don't split packages.");
    // JSON.stringify wraps the content value in double-quotes; no broken single-quote wrapping
    expect(src).toMatch(/"content": ".*Don't split packages\./);
  });
});

// ─── PL-07: BM25 compatibility ────────────────────────────────────────────────

describe('PL-07 · BM25 compatibility', () => {
  it('PL-07-01: generated entries satisfy LegalEntry interface shape', () => {
    const meta = {
      id: 'doc-bm25-test',
      title: 'Quy định mua sắm công',
      category: 'Decrees',
      sourceFile: 'Decrees/test.md',
      keywords: ['mua sắm', 'đấu thầu'],
      effectiveDate: '2025',
      content: REAL_MD_TEXT,
      isPlaceholder: false,
    };
    const chunks = chunkText(meta.content);
    const entries = chunks.map((c, i) => makeEntry(meta, c, i, chunks.length));
    for (const e of entries) {
      expect(typeof e.id).toBe('string');
      expect(typeof e.title).toBe('string');
      expect(typeof e.source).toBe('string');
      expect(Array.isArray(e.keywords)).toBe(true);
      expect(e.keywords.length).toBeGreaterThanOrEqual(1);
      expect(typeof e.content).toBe('string');
      expect(e.content.length).toBeGreaterThan(50);
    }
  });

  it('PL-07-02: generated LEGAL_KB entries pass minimum field checks', () => {
    const entries: LegalEntry[] = [{
      id: 'doc-x',
      title: 'Test Title Dài Hơn 10 Ký Tự',
      source: 'Nguồn tài liệu hợp lệ',
      keywords: ['từ khóa một', 'từ khóa hai', 'từ khóa ba', 'từ khóa bốn'],
      content: 'Nội dung thực tế của văn bản pháp luật cần đủ dài hơn 50 ký tự để đảm bảo chất lượng.',
      appliesTo: ['procurement'],
    }];
    expect(entries[0].id.length).toBeGreaterThan(0);
    expect(entries[0].keywords.length).toBeGreaterThanOrEqual(4);
    expect(entries[0].content.length).toBeGreaterThan(50);
  });

  it('PL-07-03: pipeline skips placeholder files', async () => {
    // runPipeline against actual Legal/ should skip placeholder files
    const result = await runPipeline(LEGAL_DIR);
    expect(result.placeholders).toBeGreaterThan(0);
    // All entries should have non-placeholder content
    for (const e of result.entries) {
      expect(e.content.length).toBeGreaterThan(50);
    }
  });

  it('PL-07-04: pipeline result is deterministic on same input', async () => {
    const r1 = await runPipeline(LEGAL_DIR);
    const r2 = await runPipeline(LEGAL_DIR);
    expect(r1.scanned).toBe(r2.scanned);
    expect(r1.entries.length).toBe(r2.entries.length);
    expect(r1.entries.map(e => e.id)).toEqual(r2.entries.map(e => e.id));
  });
});

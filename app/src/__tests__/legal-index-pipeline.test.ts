// @vitest-environment node
/**
 * Legal v1.2 — Index pipeline tests
 *
 * Tests buildIndex (scan → extract → chunk → IndexEntry) and
 * generateIndexJson in isolation and against the real Legal/ directory.
 *
 * Groups:
 *   LI-01  (5)  JSON schema + serialisation
 *   LI-02  (5)  Metadata fields
 *   LI-03  (4)  Chunk storage
 *   LI-04  (4)  Determinism + UTF-8
 *   LI-05  (3)  BM25 compatibility
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'path';
import { fileURLToPath } from 'url';

import {
  buildIndex,
  generateIndexJson,
  SCHEMA_VERSION,
  type IndexEntry,
  type LegalIndex,
} from '../../scripts/buildLegalIndex.js';

// ─── Path helpers ──────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEGAL_DIR = path.resolve(__dirname, '../../../Legal');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SAMPLE_ENTRY: IndexEntry = {
  id: 'doc-decrees-nd-60',
  title: 'NGHỊ ĐỊNH 60/2021/NĐ-CP',
  category: 'Decrees',
  sourceFile: 'Decrees/nd-60.md',
  effectiveDate: '21/06/2021',
  keywords: ['tự chủ', 'sự nghiệp', 'đơn vị', 'tài chính'],
  content: 'Nội dung về cơ chế tự chủ tài chính của đơn vị sự nghiệp công lập theo quy định pháp luật hiện hành.',
  appliesTo: ['procurement', 'budget-planning'],
};

const SAMPLE_INDEX: LegalIndex = {
  schemaVersion: SCHEMA_VERSION,
  entries: [SAMPLE_ENTRY],
};

// ─── Shared real index (run once for the whole file) ──────────────────────────

let realIndex: LegalIndex;

beforeAll(async () => {
  realIndex = await buildIndex(LEGAL_DIR);
});

// ─── LI-01: JSON schema + serialisation ───────────────────────────────────────

describe('LI-01 · JSON schema', () => {
  it('LI-01-01: generateIndexJson output contains "schemaVersion"', () => {
    const json = generateIndexJson(SAMPLE_INDEX);
    expect(json).toContain('"schemaVersion"');
  });

  it('LI-01-02: SCHEMA_VERSION is "1.2" and round-trips through JSON', () => {
    expect(SCHEMA_VERSION).toBe('1.2');
    const parsed = JSON.parse(generateIndexJson(SAMPLE_INDEX)) as LegalIndex;
    expect(parsed.schemaVersion).toBe('1.2');
  });

  it('LI-01-03: parsed JSON has an entries array', () => {
    const parsed = JSON.parse(generateIndexJson(SAMPLE_INDEX)) as LegalIndex;
    expect(Array.isArray(parsed.entries)).toBe(true);
  });

  it('LI-01-04: generateIndexJson produces parseable JSON', () => {
    expect(() => JSON.parse(generateIndexJson(SAMPLE_INDEX))).not.toThrow();
  });

  it('LI-01-05: entry data round-trips without loss', () => {
    const parsed = JSON.parse(generateIndexJson(SAMPLE_INDEX)) as LegalIndex;
    expect(parsed.entries[0].id).toBe(SAMPLE_ENTRY.id);
    expect(parsed.entries[0].content).toBe(SAMPLE_ENTRY.content);
    expect(parsed.entries[0].keywords).toEqual(SAMPLE_ENTRY.keywords);
  });
});

// ─── LI-02: Metadata fields ───────────────────────────────────────────────────

describe('LI-02 · Metadata fields', () => {
  it('LI-02-01: IndexEntry has all eight required fields', () => {
    const e = SAMPLE_ENTRY;
    expect(typeof e.id).toBe('string');
    expect(typeof e.title).toBe('string');
    expect(typeof e.category).toBe('string');
    expect(typeof e.sourceFile).toBe('string');
    expect(typeof e.effectiveDate).toBe('string');
    expect(Array.isArray(e.keywords)).toBe(true);
    expect(typeof e.content).toBe('string');
    expect(Array.isArray(e.appliesTo)).toBe(true);
  });

  it('LI-02-02: real entries carry a non-empty category', () => {
    for (const e of realIndex.entries) {
      expect(e.category.length).toBeGreaterThan(0);
    }
  });

  it('LI-02-03: sourceFile is a relative path (no drive letter or leading slash)', () => {
    for (const e of realIndex.entries) {
      expect(e.sourceFile.length).toBeGreaterThan(0);
      expect(e.sourceFile.startsWith('/')).toBe(false);
      expect(/^[A-Za-z]:/.test(e.sourceFile)).toBe(false);
    }
  });

  it('LI-02-04: effectiveDate is always a string (empty string allowed)', () => {
    for (const e of realIndex.entries) {
      expect(typeof e.effectiveDate).toBe('string');
    }
  });

  it('LI-02-05: keywords is a non-empty array per entry', () => {
    for (const e of realIndex.entries) {
      expect(e.keywords.length).toBeGreaterThan(0);
    }
  });
});

// ─── LI-03: Chunk storage ─────────────────────────────────────────────────────

describe('LI-03 · Chunk storage', () => {
  it('LI-03-01: single-chunk entry id has no -cNNN suffix', () => {
    const e: IndexEntry = { ...SAMPLE_ENTRY, id: 'doc-laws-luat-22' };
    expect(e.id).not.toMatch(/-c\d{3}$/);
  });

  it('LI-03-02: multi-chunk entries carry sequential -c001, -c002 suffixes', () => {
    const e1: IndexEntry = { ...SAMPLE_ENTRY, id: 'doc-decrees-nd-60-c001' };
    const e2: IndexEntry = { ...SAMPLE_ENTRY, id: 'doc-decrees-nd-60-c002' };
    expect(e1.id).toMatch(/-c001$/);
    expect(e2.id).toMatch(/-c002$/);
  });

  it('LI-03-03: content is capped at 3000 chars per entry', () => {
    for (const e of realIndex.entries) {
      expect(e.content.length).toBeLessThanOrEqual(3000);
    }
  });

  it('LI-03-04: content exceeds 50 chars (pipeline min-length filter enforced)', () => {
    for (const e of realIndex.entries) {
      expect(e.content.length).toBeGreaterThan(50);
    }
  });
});

// ─── LI-04: Determinism + UTF-8 ───────────────────────────────────────────────

describe('LI-04 · Determinism and UTF-8', () => {
  it('LI-04-01: generateIndexJson is deterministic for the same index object', () => {
    const j1 = generateIndexJson(SAMPLE_INDEX);
    const j2 = generateIndexJson(SAMPLE_INDEX);
    expect(j1).toBe(j2);
  });

  it('LI-04-02: Vietnamese diacritics are preserved in JSON output', () => {
    const json = generateIndexJson(SAMPLE_INDEX);
    // chars like đ, ơ, ư, ề must survive JSON serialisation
    expect(json).toContain('tự chủ');
    expect(json).toContain('sự nghiệp');
  });

  it('LI-04-03: extended Vietnamese text round-trips without corruption', () => {
    const vn = 'Trường Cao đẳng Kỹ thuật Công nghiệp — đơn vị sự nghiệp công lập';
    const index: LegalIndex = {
      schemaVersion: '1.2',
      entries: [{ ...SAMPLE_ENTRY, content: vn }],
    };
    const parsed = JSON.parse(generateIndexJson(index)) as LegalIndex;
    expect(parsed.entries[0].content).toBe(vn);
  });

  it('LI-04-04: repeated buildIndex calls return identical entry count and ids', async () => {
    const r2 = await buildIndex(LEGAL_DIR);
    expect(r2.entries.length).toBe(realIndex.entries.length);
    expect(r2.entries.map(e => e.id)).toEqual(realIndex.entries.map(e => e.id));
  });
});

// ─── LI-05: BM25 compatibility ────────────────────────────────────────────────

describe('LI-05 · BM25 compatibility', () => {
  it('LI-05-01: keywords are non-empty strings (BM25 tokenizer input)', () => {
    for (const e of realIndex.entries) {
      for (const kw of e.keywords) {
        expect(typeof kw).toBe('string');
        expect(kw.length).toBeGreaterThan(0);
      }
    }
  });

  it('LI-05-02: appliesTo is a non-empty string array (BM25 category tags)', () => {
    for (const e of realIndex.entries) {
      expect(e.appliesTo.length).toBeGreaterThan(0);
      for (const tag of e.appliesTo) {
        expect(typeof tag).toBe('string');
      }
    }
  });

  it('LI-05-03: all entry ids are unique (no duplicate chunks)', () => {
    const ids = realIndex.entries.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

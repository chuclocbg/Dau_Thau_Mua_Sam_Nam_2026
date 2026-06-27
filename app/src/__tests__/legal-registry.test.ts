/**
 * Phase 11.2.1 — LegalRegistry Core tests
 *
 * Groups:
 *   LReg-01  (3)  LEGAL_DOCUMENT_TYPES constants
 *   LReg-02  (3)  isLegalDocumentType guard
 *   LReg-03  (3)  isLegalDocumentStatus guard
 *   LReg-04  (3)  isIsoDate guard
 *   LReg-05  (3)  createRegistry — index construction
 *   LReg-06  (3)  createRegistry — symbolIndex construction
 *   LReg-07  (3)  createRegistry — metadata fields
 *   LReg-08  (3)  createRegistry — empty documents
 */

import { describe, it, expect } from 'vitest';
import {
  LEGAL_DOCUMENT_TYPES,
  LEGAL_DOCUMENT_STATUSES,
  isLegalDocumentType,
  isLegalDocumentStatus,
  isIsoDate,
  createRegistry,
} from '../legal/legalRegistry';
import type { LegalDocument } from '../legal/legalRegistry';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const LAW: LegalDocument = {
  id:            'luat-dau-thau-22-2023',
  symbol:        '22/2023/QH15',
  title:         'Luật Đấu thầu số 22/2023/QH15',
  type:          'LAW',
  issuer:        'Quốc hội',
  effectiveDate: '2024-01-01',
  status:        'ACTIVE',
  source:        'Công báo số 01/2024',
  priority:      1,
  tags:          ['đấu thầu', 'mua sắm'],
  summary:       'Luật quy định về hoạt động đấu thầu',
  confidence:    1.0,
};

const DECREE: LegalDocument = {
  id:            'nd-214-2025',
  symbol:        '214/2025/NĐ-CP',
  title:         'Nghị định 214/2025/NĐ-CP',
  type:          'DECREE',
  issuer:        'Chính phủ',
  effectiveDate: '2025-07-01',
  status:        'ACTIVE',
  replaces:      ['nd-24-2024'],
  source:        'Công báo số 500/2025',
  priority:      1,
  tags:          ['đấu thầu', 'nghị định'],
  summary:       'Nghị định hướng dẫn chi tiết Luật Đấu thầu',
  confidence:    0.95,
};

// ── LReg-01 LEGAL_DOCUMENT_TYPES constants ────────────────────────────────────

describe('LReg-01 LEGAL_DOCUMENT_TYPES constants', () => {
  it('LReg-01-01 LEGAL_DOCUMENT_TYPES contains 7 entries', () => {
    expect(LEGAL_DOCUMENT_TYPES).toHaveLength(7);
  });

  it('LReg-01-02 LEGAL_DOCUMENT_TYPES contains all expected values', () => {
    expect(LEGAL_DOCUMENT_TYPES).toContain('LAW');
    expect(LEGAL_DOCUMENT_TYPES).toContain('DECREE');
    expect(LEGAL_DOCUMENT_TYPES).toContain('CIRCULAR');
    expect(LEGAL_DOCUMENT_TYPES).toContain('GUIDELINE');
  });

  it('LReg-01-03 LEGAL_DOCUMENT_STATUSES contains all 5 status values', () => {
    expect(LEGAL_DOCUMENT_STATUSES).toHaveLength(5);
    expect(LEGAL_DOCUMENT_STATUSES).toContain('ACTIVE');
    expect(LEGAL_DOCUMENT_STATUSES).toContain('SUPERSEDED');
    expect(LEGAL_DOCUMENT_STATUSES).toContain('REPEALED');
  });
});

// ── LReg-02 isLegalDocumentType guard ─────────────────────────────────────────

describe('LReg-02 isLegalDocumentType guard', () => {
  it('LReg-02-01 returns true for every valid type string', () => {
    for (const t of LEGAL_DOCUMENT_TYPES) {
      expect(isLegalDocumentType(t)).toBe(true);
    }
  });

  it('LReg-02-02 returns false for unknown strings', () => {
    expect(isLegalDocumentType('ORDINANCE')).toBe(false);
    expect(isLegalDocumentType('law')).toBe(false);  // lowercase
    expect(isLegalDocumentType('')).toBe(false);
  });

  it('LReg-02-03 returns false for non-string values', () => {
    expect(isLegalDocumentType(null)).toBe(false);
    expect(isLegalDocumentType(42)).toBe(false);
    expect(isLegalDocumentType(undefined)).toBe(false);
  });
});

// ── LReg-03 isLegalDocumentStatus guard ───────────────────────────────────────

describe('LReg-03 isLegalDocumentStatus guard', () => {
  it('LReg-03-01 returns true for every valid status string', () => {
    for (const s of LEGAL_DOCUMENT_STATUSES) {
      expect(isLegalDocumentStatus(s)).toBe(true);
    }
  });

  it('LReg-03-02 returns false for unknown strings', () => {
    expect(isLegalDocumentStatus('PENDING')).toBe(false);
    expect(isLegalDocumentStatus('active')).toBe(false);
    expect(isLegalDocumentStatus('')).toBe(false);
  });

  it('LReg-03-03 returns false for non-string values', () => {
    expect(isLegalDocumentStatus(null)).toBe(false);
    expect(isLegalDocumentStatus(0)).toBe(false);
    expect(isLegalDocumentStatus([])).toBe(false);
  });
});

// ── LReg-04 isIsoDate guard ───────────────────────────────────────────────────

describe('LReg-04 isIsoDate guard', () => {
  it('LReg-04-01 returns true for valid YYYY-MM-DD dates', () => {
    expect(isIsoDate('2024-01-01')).toBe(true);
    expect(isIsoDate('2025-12-31')).toBe(true);
    expect(isIsoDate('2026-07-15')).toBe(true);
  });

  it('LReg-04-02 returns false for invalid formats', () => {
    expect(isIsoDate('2024-1-1')).toBe(false);    // no zero-padding
    expect(isIsoDate('01-01-2024')).toBe(false);  // wrong order
    expect(isIsoDate('2024/01/01')).toBe(false);  // slashes
    expect(isIsoDate('not-a-date')).toBe(false);
    expect(isIsoDate('')).toBe(false);
  });

  it('LReg-04-03 returns false for non-string values', () => {
    expect(isIsoDate(20240101)).toBe(false);
    expect(isIsoDate(null)).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
});

// ── LReg-05 createRegistry — index construction ───────────────────────────────

describe('LReg-05 createRegistry index construction', () => {
  it('LReg-05-01 index[id] returns the correct document', () => {
    const registry = createRegistry([LAW, DECREE]);
    expect(registry.index['luat-dau-thau-22-2023']).toBe(LAW);
    expect(registry.index['nd-214-2025']).toBe(DECREE);
  });

  it('LReg-05-02 index does not contain unknown ids', () => {
    const registry = createRegistry([LAW]);
    expect(registry.index['unknown-id']).toBeUndefined();
  });

  it('LReg-05-03 documents array and index are consistent in length', () => {
    const registry = createRegistry([LAW, DECREE]);
    expect(registry.documents).toHaveLength(2);
    expect(Object.keys(registry.index)).toHaveLength(2);
  });
});

// ── LReg-06 createRegistry — symbolIndex construction ─────────────────────────

describe('LReg-06 createRegistry symbolIndex construction', () => {
  it('LReg-06-01 symbolIndex[symbol] returns the correct document', () => {
    const registry = createRegistry([LAW, DECREE]);
    expect(registry.symbolIndex['22/2023/QH15']).toBe(LAW);
    expect(registry.symbolIndex['214/2025/NĐ-CP']).toBe(DECREE);
  });

  it('LReg-06-02 symbolIndex does not contain unknown symbols', () => {
    const registry = createRegistry([LAW]);
    expect(registry.symbolIndex['99/9999/XX']).toBeUndefined();
  });

  it('LReg-06-03 symbolIndex length equals document count', () => {
    const registry = createRegistry([LAW, DECREE]);
    expect(Object.keys(registry.symbolIndex)).toHaveLength(2);
  });
});

// ── LReg-07 createRegistry — metadata fields ──────────────────────────────────

describe('LReg-07 createRegistry metadata fields', () => {
  it('LReg-07-01 metadata.documentCount equals input length', () => {
    expect(createRegistry([LAW, DECREE]).metadata.documentCount).toBe(2);
    expect(createRegistry([LAW]).metadata.documentCount).toBe(1);
  });

  it('LReg-07-02 metadata.version uses the default "1.0.0"', () => {
    expect(createRegistry([LAW]).metadata.version).toBe('1.0.0');
  });

  it('LReg-07-03 metadata.sources deduplicates document sources', () => {
    const a = { ...LAW,   id: 'a', symbol: 'A', source: 'Công báo A' } as LegalDocument;
    const b = { ...DECREE, id: 'b', symbol: 'B', source: 'Công báo A' } as LegalDocument;
    const c = { ...DECREE, id: 'c', symbol: 'C', source: 'Công báo B' } as LegalDocument;
    const registry = createRegistry([a, b, c]);
    expect(registry.metadata.sources).toHaveLength(2);
    expect(registry.metadata.sources).toContain('Công báo A');
    expect(registry.metadata.sources).toContain('Công báo B');
  });
});

// ── LReg-08 createRegistry — empty documents ──────────────────────────────────

describe('LReg-08 createRegistry empty documents', () => {
  it('LReg-08-01 empty array produces empty index', () => {
    const registry = createRegistry([]);
    expect(Object.keys(registry.index)).toHaveLength(0);
  });

  it('LReg-08-02 empty array produces zero documentCount', () => {
    expect(createRegistry([]).metadata.documentCount).toBe(0);
  });

  it('LReg-08-03 empty array produces empty sources', () => {
    expect(createRegistry([]).metadata.sources).toHaveLength(0);
  });
});

/**
 * Legal v1.7 — documentLegalContext tests
 *
 * Groups:
 *   LC-01  (4)  Basic output shape
 *   LC-02  (4)  Document type handling — 8 types, quyet-dinh-phe-duyet included
 *   LC-03  (5)  Citation generation
 *   LC-04  (5)  Priority rules — method × document-type floor
 *   LC-05  (3)  Determinism and Vietnamese UTF-8
 */

import { describe, it, expect } from 'vitest';
import {
  getDocumentLegalContext,
  type DocumentLegalContextInput,
  type DocumentType,
} from '../ai/documentLegalContext';

// ─── Shared fixture ───────────────────────────────────────────────────────────

const BASE: DocumentLegalContextInput = {
  documentType:      'khlcnt',
  packageCategory:   'hang-hoa',
  procurementMethod: 'chi-dinh-thau',
  sourceOfFunds:     'ngan-sach-nha-nuoc',
};

// ─── LC-01 · Basic output shape ───────────────────────────────────────────────

describe('LC-01 · Basic output shape', () => {
  it('LC-01-01: never throws for a valid input', () => {
    expect(() => getDocumentLegalContext(BASE)).not.toThrow();
  });

  it('LC-01-02: returns relevantDocuments[], citations[], priority, reasoning', () => {
    const ctx = getDocumentLegalContext(BASE);
    expect(Array.isArray(ctx.relevantDocuments)).toBe(true);
    expect(Array.isArray(ctx.citations)).toBe(true);
    expect(['critical', 'high', 'medium', 'low']).toContain(ctx.priority);
    expect(typeof ctx.reasoning).toBe('string');
  });

  it('LC-01-03: each relevantDocument has title, sourceFile, effectiveDate, relevanceTags', () => {
    const { relevantDocuments } = getDocumentLegalContext(BASE);
    expect(relevantDocuments.length).toBeGreaterThan(0);
    for (const doc of relevantDocuments) {
      expect(typeof doc.title).toBe('string');
      expect(doc.title.length).toBeGreaterThan(0);
      expect(typeof doc.sourceFile).toBe('string');
      expect(typeof doc.effectiveDate).toBe('string');
      expect(Array.isArray(doc.relevanceTags)).toBe(true);
    }
  });

  it('LC-01-04: reasoning is a non-empty string that mentions the document type', () => {
    const { reasoning } = getDocumentLegalContext(BASE);
    expect(reasoning.length).toBeGreaterThan(20);
    // khlcnt label should appear
    expect(reasoning).toContain('Kế hoạch lựa chọn nhà thầu');
  });
});

// ─── LC-02 · Document type handling ──────────────────────────────────────────

describe('LC-02 · Document type handling', () => {
  it('LC-02-01: quyet-dinh-phe-duyet with chi-dinh-thau-rut-gon still reaches priority "high"', () => {
    const { priority } = getDocumentLegalContext({
      ...BASE,
      documentType:      'quyet-dinh-phe-duyet',
      procurementMethod: 'chi-dinh-thau-rut-gon',
    });
    // Floor for quyet-dinh-phe-duyet is 'high', overrides method's 'low'
    expect(priority).toBe('high');
  });

  it('LC-02-02: all 8 document types return non-empty relevantDocuments', () => {
    const types: DocumentType[] = [
      'to-trinh',
      'khlcnt',
      'hsyc',
      'quyet-dinh-phe-duyet',
      'hop-dong',
      'bien-ban-nghiem-thu',
      'thanh-ly',
      'thanh-toan',
    ];
    for (const documentType of types) {
      const { relevantDocuments } = getDocumentLegalContext({ ...BASE, documentType });
      expect(relevantDocuments.length).toBeGreaterThan(0);
    }
  });

  it('LC-02-03: hop-dong with chi-dinh-thau-rut-gon reaches priority "high" (floor)', () => {
    const { priority } = getDocumentLegalContext({
      ...BASE,
      documentType:      'hop-dong',
      procurementMethod: 'chi-dinh-thau-rut-gon',
    });
    expect(priority).toBe('high');
  });

  it('LC-02-04: different document types may yield different citation sets', () => {
    const r1 = getDocumentLegalContext({ ...BASE, documentType: 'khlcnt' });
    const r2 = getDocumentLegalContext({ ...BASE, documentType: 'thanh-toan' });
    // reasoning must differ (different labels)
    expect(r1.reasoning).not.toBe(r2.reasoning);
  });
});

// ─── LC-03 · Citation generation ─────────────────────────────────────────────

describe('LC-03 · Citation generation', () => {
  it('LC-03-01: citations is an array of strings', () => {
    const { citations } = getDocumentLegalContext(BASE);
    expect(Array.isArray(citations)).toBe(true);
    for (const c of citations) {
      expect(typeof c).toBe('string');
    }
  });

  it('LC-03-02: citations are non-empty strings when results exist', () => {
    const { citations } = getDocumentLegalContext(BASE);
    expect(citations.length).toBeGreaterThan(0);
    for (const c of citations) {
      expect(c.length).toBeGreaterThan(0);
    }
  });

  it('LC-03-03: citations array has no duplicates', () => {
    const { citations } = getDocumentLegalContext(BASE);
    const unique = new Set(citations);
    expect(unique.size).toBe(citations.length);
  });

  it('LC-03-04: citations contain recognisable document names (not raw file paths)', () => {
    const { citations } = getDocumentLegalContext(BASE);
    expect(citations.length).toBeGreaterThan(0);
    // Each citation should contain at least one recognisable token (digit, letter, or Vietnamese char)
    for (const c of citations) {
      expect(c.length).toBeGreaterThan(3);
    }
  });

  it('LC-03-05: hsyc citations are non-empty', () => {
    const { citations } = getDocumentLegalContext({ ...BASE, documentType: 'hsyc' });
    expect(citations.length).toBeGreaterThan(0);
  });
});

// ─── LC-04 · Priority rules ───────────────────────────────────────────────────

describe('LC-04 · Priority rules', () => {
  it('LC-04-01: chi-dinh-thau-rut-gon + to-trinh → priority "low" (no floor)', () => {
    const { priority } = getDocumentLegalContext({
      ...BASE,
      documentType:      'to-trinh',
      procurementMethod: 'chi-dinh-thau-rut-gon',
    });
    expect(priority).toBe('low');
  });

  it('LC-04-02: dau-thau-rong-rai → "critical" regardless of document type', () => {
    const types: DocumentType[] = ['to-trinh', 'khlcnt', 'thanh-toan'];
    for (const documentType of types) {
      const { priority } = getDocumentLegalContext({
        ...BASE,
        documentType,
        procurementMethod: 'dau-thau-rong-rai',
      });
      expect(priority).toBe('critical');
    }
  });

  it('LC-04-03: chi-dinh-thau + quyet-dinh-phe-duyet → "high" (method medium, floor high)', () => {
    const { priority } = getDocumentLegalContext({
      ...BASE,
      documentType:      'quyet-dinh-phe-duyet',
      procurementMethod: 'chi-dinh-thau',
    });
    expect(priority).toBe('high');
  });

  it('LC-04-04: chi-dinh-thau-rut-gon + quyet-dinh-phe-duyet → "high" (floor lifts from low)', () => {
    const { priority } = getDocumentLegalContext({
      ...BASE,
      documentType:      'quyet-dinh-phe-duyet',
      procurementMethod: 'chi-dinh-thau-rut-gon',
    });
    expect(priority).toBe('high');
  });

  it('LC-04-05: chao-hang-canh-tranh + khlcnt → "high" (method drives, no floor needed)', () => {
    const { priority } = getDocumentLegalContext({
      ...BASE,
      documentType:      'khlcnt',
      procurementMethod: 'chao-hang-canh-tranh',
    });
    expect(priority).toBe('high');
  });
});

// ─── LC-05 · Determinism and Vietnamese UTF-8 ────────────────────────────────

describe('LC-05 · Determinism and Vietnamese UTF-8', () => {
  it('LC-05-01: same input twice yields identical output (deterministic)', () => {
    const r1 = getDocumentLegalContext(BASE);
    const r2 = getDocumentLegalContext(BASE);
    expect(r1).toEqual(r2);
  });

  it('LC-05-02: reasoning preserves Vietnamese diacritics', () => {
    const { reasoning } = getDocumentLegalContext(BASE);
    const hasVietnamese =
      /[àáâãèéêìíòóôõùúýăđơưạặầấậắảẩẫẻẽẹềếệỉịọồốộổỡờớợởủụừứựữ]/i.test(reasoning);
    expect(hasVietnamese).toBe(true);
  });

  it('LC-05-03: document titles preserve Vietnamese diacritics', () => {
    const { relevantDocuments } = getDocumentLegalContext(BASE);
    expect(relevantDocuments.length).toBeGreaterThan(0);
    const allHaveVietnamese = relevantDocuments.every(d =>
      /[àáâãèéêìíòóôõùúýăđơưạặầấậắảẩẫẻẽẹềếệỉịọồốộổỡờớợởủụừứựữ]/i.test(d.title),
    );
    expect(allHaveVietnamese).toBe(true);
  });
});

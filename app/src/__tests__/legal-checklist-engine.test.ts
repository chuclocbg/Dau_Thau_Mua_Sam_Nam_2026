/**
 * Legal v1.8 — legalChecklistEngine tests
 *
 * Groups:
 *   CH-01  (4)  Basic output shape
 *   CH-02  (5)  Prerequisite logic — required / present / missing
 *   CH-03  (4)  Completion score
 *   CH-04  (5)  Warning generation
 *   CH-05  (3)  Determinism and Vietnamese UTF-8
 */

import { describe, it, expect } from 'vitest';
import {
  buildChecklist,
  type ChecklistInput,
  type ChecklistDocType,
} from '../ai/legalChecklistEngine';

// ─── Shared fixture ───────────────────────────────────────────────────────────

const BASE: ChecklistInput = {
  documentType:      'khlcnt',
  packageCategory:   'hang-hoa',
  procurementMethod: 'chi-dinh-thau',
  sourceOfFunds:     'ngan-sach-nha-nuoc',
  existingDocuments: [],
};

// All prerequisites for hop-dong
const HOP_DONG_PREREQS: ChecklistDocType[] = [
  'to-trinh', 'khlcnt', 'hsyc', 'quyet-dinh-phe-duyet',
];

// ─── CH-01 · Basic output shape ───────────────────────────────────────────────

describe('CH-01 · Basic output shape', () => {
  it('CH-01-01: never throws for a valid input', () => {
    expect(() => buildChecklist(BASE)).not.toThrow();
  });

  it('CH-01-02: returns requiredDocuments, presentDocuments, missingDocuments, warnings, completionScore', () => {
    const result = buildChecklist(BASE);
    expect(Array.isArray(result.requiredDocuments)).toBe(true);
    expect(Array.isArray(result.presentDocuments)).toBe(true);
    expect(Array.isArray(result.missingDocuments)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(typeof result.completionScore).toBe('number');
  });

  it('CH-01-03: completionScore is an integer in [0, 100]', () => {
    const { completionScore } = buildChecklist(BASE);
    expect(completionScore).toBeGreaterThanOrEqual(0);
    expect(completionScore).toBeLessThanOrEqual(100);
    expect(Number.isInteger(completionScore)).toBe(true);
  });

  it('CH-01-04: presentDocuments is a subset of requiredDocuments (by docType)', () => {
    const result = buildChecklist({
      ...BASE,
      documentType:      'hop-dong',
      existingDocuments: ['to-trinh', 'khlcnt'],
    });
    const required = new Set(result.requiredDocuments.map(r => r.docType));
    for (const p of result.presentDocuments) {
      expect(required.has(p)).toBe(true);
    }
  });
});

// ─── CH-02 · Prerequisite logic ───────────────────────────────────────────────

describe('CH-02 · Prerequisite logic', () => {
  it('CH-02-01: to-trinh has no prerequisites — requiredDocuments is empty, score 100', () => {
    const { requiredDocuments, completionScore } = buildChecklist({
      ...BASE,
      documentType: 'to-trinh',
    });
    expect(requiredDocuments).toHaveLength(0);
    expect(completionScore).toBe(100);
  });

  it('CH-02-02: hop-dong with no existing docs → 4 required, all missing, score 0', () => {
    const { requiredDocuments, missingDocuments, completionScore } = buildChecklist({
      ...BASE,
      documentType:      'hop-dong',
      existingDocuments: [],
    });
    expect(requiredDocuments).toHaveLength(4);
    expect(missingDocuments).toHaveLength(4);
    expect(completionScore).toBe(0);
  });

  it('CH-02-03: hop-dong with all 4 prerequisites → score 100, missingDocuments empty', () => {
    const { missingDocuments, completionScore } = buildChecklist({
      ...BASE,
      documentType:      'hop-dong',
      existingDocuments: HOP_DONG_PREREQS,
    });
    expect(missingDocuments).toHaveLength(0);
    expect(completionScore).toBe(100);
  });

  it('CH-02-04: bien-ban-ban-giao requires exactly hop-dong and bien-ban-nghiem-thu', () => {
    const { requiredDocuments } = buildChecklist({
      ...BASE,
      documentType: 'bien-ban-ban-giao',
    });
    const types = requiredDocuments.map(r => r.docType);
    expect(types).toContain('hop-dong');
    expect(types).toContain('bien-ban-nghiem-thu');
    expect(types).toHaveLength(2);
  });

  it('CH-02-05: thanh-ly requires 4 prerequisites', () => {
    const { requiredDocuments } = buildChecklist({
      ...BASE,
      documentType: 'thanh-ly',
    });
    expect(requiredDocuments).toHaveLength(4);
    const types = requiredDocuments.map(r => r.docType);
    expect(types).toContain('hop-dong');
    expect(types).toContain('bien-ban-nghiem-thu');
    expect(types).toContain('bien-ban-ban-giao');
    expect(types).toContain('thanh-toan');
  });
});

// ─── CH-03 · Completion score ─────────────────────────────────────────────────

describe('CH-03 · Completion score', () => {
  it('CH-03-01: no prerequisites (to-trinh) → completionScore 100', () => {
    const { completionScore } = buildChecklist({ ...BASE, documentType: 'to-trinh' });
    expect(completionScore).toBe(100);
  });

  it('CH-03-02: all prerequisites missing → completionScore 0', () => {
    const { completionScore } = buildChecklist({
      ...BASE,
      documentType:      'hop-dong',
      existingDocuments: [],
    });
    expect(completionScore).toBe(0);
  });

  it('CH-03-03: all prerequisites present → completionScore 100', () => {
    const { completionScore } = buildChecklist({
      ...BASE,
      documentType:      'hop-dong',
      existingDocuments: HOP_DONG_PREREQS,
    });
    expect(completionScore).toBe(100);
  });

  it('CH-03-04: partial completion → score strictly between 0 and 100', () => {
    // hop-dong needs 4 prereqs; provide 2 → score = 50
    const { completionScore } = buildChecklist({
      ...BASE,
      documentType:      'hop-dong',
      existingDocuments: ['to-trinh', 'khlcnt'],
    });
    expect(completionScore).toBeGreaterThan(0);
    expect(completionScore).toBeLessThan(100);
    expect(completionScore).toBe(50);
  });
});

// ─── CH-04 · Warning generation ───────────────────────────────────────────────

describe('CH-04 · Warning generation', () => {
  it('CH-04-01: missing mandatory docs produce [CRITICAL] warnings', () => {
    const { warnings } = buildChecklist({
      ...BASE,
      documentType:      'hop-dong',
      existingDocuments: [],
    });
    const criticals = warnings.filter(w => w.startsWith('[CRITICAL]'));
    expect(criticals.length).toBeGreaterThan(0);
    // First missing prerequisite is to-trinh
    expect(criticals[0]).toContain('Tờ trình');
  });

  it('CH-04-02: dau-thau-rong-rai generates [HIGH] portal-publication warning', () => {
    const { warnings } = buildChecklist({
      ...BASE,
      procurementMethod: 'dau-thau-rong-rai',
      existingDocuments: [],
    });
    const high = warnings.find(w => w.startsWith('[HIGH]') && w.includes('Hệ thống mạng đấu thầu'));
    expect(high).toBeDefined();
  });

  it('CH-04-03: ngan-sach-nha-nuoc generates [MEDIUM] budget approval warning', () => {
    const { warnings } = buildChecklist({
      ...BASE,
      documentType:      'hop-dong',
      sourceOfFunds:     'ngan-sach-nha-nuoc',
      existingDocuments: HOP_DONG_PREREQS,   // no missing docs
    });
    const medium = warnings.find(w => w.startsWith('[MEDIUM]') && w.includes('ngân sách nhà nước'));
    expect(medium).toBeDefined();
  });

  it('CH-04-04: when all prerequisites are present, no [CRITICAL] warnings for missing docs', () => {
    const { warnings } = buildChecklist({
      ...BASE,
      documentType:      'hop-dong',
      sourceOfFunds:     'ngan-sach-nha-nuoc',
      existingDocuments: HOP_DONG_PREREQS,
    });
    const criticals = warnings.filter(w => w.startsWith('[CRITICAL]'));
    expect(criticals).toHaveLength(0);
  });

  it('CH-04-05: warnings is always an array — never throws even for edge cases', () => {
    expect(() => buildChecklist({ ...BASE, existingDocuments: [] })).not.toThrow();
    expect(Array.isArray(buildChecklist({ ...BASE, existingDocuments: [] }).warnings)).toBe(true);
    expect(() =>
      buildChecklist({ ...BASE, documentType: 'to-trinh', existingDocuments: [] }),
    ).not.toThrow();
  });
});

// ─── CH-05 · Determinism and Vietnamese UTF-8 ────────────────────────────────

describe('CH-05 · Determinism and Vietnamese UTF-8', () => {
  it('CH-05-01: same input yields identical output (deterministic)', () => {
    const r1 = buildChecklist({ ...BASE, documentType: 'hop-dong' });
    const r2 = buildChecklist({ ...BASE, documentType: 'hop-dong' });
    expect(r1).toEqual(r2);
  });

  it('CH-05-02: warnings preserve Vietnamese diacritics', () => {
    const { warnings } = buildChecklist({
      ...BASE,
      documentType:      'hop-dong',
      existingDocuments: [],
    });
    expect(warnings.length).toBeGreaterThan(0);
    const hasVietnamese = warnings.some(w =>
      /[àáâãèéêìíòóôõùúýăđơưạặầấậắảẩẫẻẽẹềếệỉịọồốộổỡờớợởủụừứựữ]/i.test(w),
    );
    expect(hasVietnamese).toBe(true);
  });

  it('CH-05-03: requiredDocument labels preserve Vietnamese diacritics', () => {
    const { requiredDocuments } = buildChecklist({
      ...BASE,
      documentType: 'bien-ban-ban-giao',
    });
    expect(requiredDocuments.length).toBeGreaterThan(0);
    for (const doc of requiredDocuments) {
      const hasVietnamese =
        /[àáâãèéêìíòóôõùúýăđơưạặầấậắảẩẫẻẽẹềếệỉịọồốộổỡờớợởủụừứựữ]/i.test(doc.label);
      expect(hasVietnamese).toBe(true);
    }
  });
});

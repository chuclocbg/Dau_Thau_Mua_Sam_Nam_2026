/**
 * Legal v1.6 — legalApplicabilityEngine tests
 *
 * Groups:
 *   AE-01  (4)  Basic output shape
 *   AE-02  (5)  Priority rules — one per procurement method
 *   AE-03  (5)  Workflow coverage — all 7 doc types return results
 *   AE-04  (4)  Fund source and document structure
 *   AE-05  (3)  Determinism and Vietnamese UTF-8
 */

import { describe, it, expect } from 'vitest';
import {
  determineApplicability,
  type ApplicabilityInput,
  type WorkflowDocType,
} from '../ai/legalApplicabilityEngine';

// ─── Shared fixture ───────────────────────────────────────────────────────────

const BASE: ApplicabilityInput = {
  packageCategory:   'hang-hoa',
  workflowDocType:   'khlcnt',
  procurementMethod: 'chi-dinh-thau',
  fundSource:        'ngan-sach-nha-nuoc',
};

// ─── AE-01 · Basic output shape ───────────────────────────────────────────────

describe('AE-01 · Basic output shape', () => {
  it('AE-01-01: never throws for any valid input', () => {
    expect(() => determineApplicability(BASE)).not.toThrow();
  });

  it('AE-01-02: returns applicableDocuments[], priority, and reason', () => {
    const result = determineApplicability(BASE);
    expect(result).toHaveProperty('applicableDocuments');
    expect(result).toHaveProperty('priority');
    expect(result).toHaveProperty('reason');
    expect(Array.isArray(result.applicableDocuments)).toBe(true);
    expect(typeof result.priority).toBe('string');
    expect(typeof result.reason).toBe('string');
  });

  it('AE-01-03: each ApplicableDocument has id, title, sourceFile, effectiveDate, relevanceTags', () => {
    const { applicableDocuments } = determineApplicability(BASE);
    expect(applicableDocuments.length).toBeGreaterThan(0);
    for (const doc of applicableDocuments) {
      expect(typeof doc.id).toBe('string');
      expect(doc.id.length).toBeGreaterThan(0);
      expect(typeof doc.title).toBe('string');
      expect(doc.title.length).toBeGreaterThan(0);
      expect(typeof doc.sourceFile).toBe('string');
      expect(typeof doc.effectiveDate).toBe('string');
      expect(Array.isArray(doc.relevanceTags)).toBe(true);
    }
  });

  it('AE-01-04: reason is a non-empty Vietnamese string mentioning the workflow', () => {
    const result = determineApplicability(BASE);
    expect(result.reason.length).toBeGreaterThan(10);
    // Should mention the Vietnamese label for khlcnt
    expect(result.reason).toContain('Kế hoạch lựa chọn nhà thầu');
  });
});

// ─── AE-02 · Priority rules ───────────────────────────────────────────────────

describe('AE-02 · Priority rules', () => {
  const input = (method: ApplicabilityInput['procurementMethod']) =>
    ({ ...BASE, procurementMethod: method });

  it('AE-02-01: dau-thau-rong-rai → priority "critical"', () => {
    expect(determineApplicability(input('dau-thau-rong-rai')).priority).toBe('critical');
  });

  it('AE-02-02: chao-hang-canh-tranh → priority "high"', () => {
    expect(determineApplicability(input('chao-hang-canh-tranh')).priority).toBe('high');
  });

  it('AE-02-03: mua-sam-truc-tiep → priority "high"', () => {
    expect(determineApplicability(input('mua-sam-truc-tiep')).priority).toBe('high');
  });

  it('AE-02-04: chi-dinh-thau → priority "medium"', () => {
    expect(determineApplicability(input('chi-dinh-thau')).priority).toBe('medium');
  });

  it('AE-02-05: chi-dinh-thau-rut-gon → priority "low"', () => {
    expect(determineApplicability(input('chi-dinh-thau-rut-gon')).priority).toBe('low');
  });
});

// ─── AE-03 · Workflow coverage ───────────────────────────────────────────────

describe('AE-03 · Workflow coverage', () => {
  it('AE-03-01: khlcnt includes at least one law or decree', () => {
    const { applicableDocuments } = determineApplicability({
      ...BASE,
      workflowDocType: 'khlcnt',
    });
    expect(applicableDocuments.length).toBeGreaterThan(0);
    const hasLawOrDecree = applicableDocuments.some(d =>
      d.relevanceTags.includes('law') || d.relevanceTags.includes('decree'),
    );
    expect(hasLawOrDecree).toBe(true);
  });

  it('AE-03-02: hsyc with dich-vu-tu-van returns non-empty applicable documents', () => {
    const { applicableDocuments } = determineApplicability({
      ...BASE,
      workflowDocType:  'hsyc',
      packageCategory:  'dich-vu-tu-van',
    });
    expect(applicableDocuments.length).toBeGreaterThan(0);
  });

  it('AE-03-03: thanh-toan returns at least one decree or circular', () => {
    const { applicableDocuments } = determineApplicability({
      ...BASE,
      workflowDocType: 'thanh-toan',
      fundSource:      'ngan-sach-nha-nuoc',
    });
    expect(applicableDocuments.length).toBeGreaterThan(0);
    const hasDecreeOrCircular = applicableDocuments.some(d =>
      d.relevanceTags.includes('decree') || d.relevanceTags.includes('circular'),
    );
    expect(hasDecreeOrCircular).toBe(true);
  });

  it('AE-03-04: bien-ban-nghiem-thu returns non-empty applicable documents', () => {
    const { applicableDocuments } = determineApplicability({
      ...BASE,
      workflowDocType: 'bien-ban-nghiem-thu',
    });
    expect(applicableDocuments.length).toBeGreaterThan(0);
  });

  it('AE-03-05: all 7 workflow types return at least 1 applicable document', () => {
    const workflows: WorkflowDocType[] = [
      'to-trinh',
      'khlcnt',
      'hsyc',
      'hop-dong',
      'bien-ban-nghiem-thu',
      'thanh-ly',
      'thanh-toan',
    ];
    for (const w of workflows) {
      const { applicableDocuments } = determineApplicability({
        ...BASE,
        workflowDocType: w,
      });
      expect(applicableDocuments.length).toBeGreaterThan(0);
    }
  });
});

// ─── AE-04 · Fund source and document structure ───────────────────────────────

describe('AE-04 · Fund source and document structure', () => {
  it('AE-04-01: ngan-sach-nha-nuoc returns applicable documents', () => {
    const { applicableDocuments } = determineApplicability({
      ...BASE,
      fundSource: 'ngan-sach-nha-nuoc',
    });
    expect(applicableDocuments.length).toBeGreaterThan(0);
  });

  it('AE-04-02: von-su-nghiep returns applicable documents', () => {
    const { applicableDocuments } = determineApplicability({
      ...BASE,
      workflowDocType: 'thanh-toan',
      fundSource:      'von-su-nghiep',
    });
    expect(applicableDocuments.length).toBeGreaterThan(0);
  });

  it('AE-04-03: each document has at least one relevanceTag', () => {
    const { applicableDocuments } = determineApplicability({
      ...BASE,
      workflowDocType: 'hop-dong',
    });
    for (const doc of applicableDocuments) {
      expect(doc.relevanceTags.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('AE-04-04: different fund sources yield different reason strings', () => {
    const r1 = determineApplicability({ ...BASE, fundSource: 'ngan-sach-nha-nuoc' });
    const r2 = determineApplicability({ ...BASE, fundSource: 'von-su-nghiep' });
    expect(r1.reason).not.toBe(r2.reason);
  });
});

// ─── AE-05 · Determinism and Vietnamese UTF-8 ────────────────────────────────

describe('AE-05 · Determinism and Vietnamese UTF-8', () => {
  it('AE-05-01: same input twice yields identical results (deterministic)', () => {
    const r1 = determineApplicability(BASE);
    const r2 = determineApplicability(BASE);
    expect(r1).toEqual(r2);
  });

  it('AE-05-02: reason preserves Vietnamese diacritics', () => {
    const { reason } = determineApplicability(BASE);
    const hasVietnamese = /[àáâãèéêìíòóôõùúýăđơưạặầấậắảẩẫẻẽẹềếệỉịọồốộổỡờớợởủụừứựữ]/i.test(reason);
    expect(hasVietnamese).toBe(true);
  });

  it('AE-05-03: titles in applicableDocuments preserve Vietnamese diacritics', () => {
    const { applicableDocuments } = determineApplicability(BASE);
    expect(applicableDocuments.length).toBeGreaterThan(0);
    const allHaveVietnamese = applicableDocuments.every(d =>
      /[àáâãèéêìíòóôõùúýăđơưạặầấậắảẩẫẻẽẹềếệỉịọồốộổỡờớợởủụừứựữ]/i.test(d.title),
    );
    expect(allHaveVietnamese).toBe(true);
  });
});

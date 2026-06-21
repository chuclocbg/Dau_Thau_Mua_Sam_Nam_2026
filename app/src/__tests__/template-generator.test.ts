/**
 * Legal v3.4 — Template Generator tests
 * TG-01..TG-21 × 3 = 63 tests
 */

import { describe, it, expect } from 'vitest';
import { generateTemplates } from '../ai/templateGenerator';
import type { TemplateGeneratorInput } from '../ai/templateGenerator';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hasVietnamese = (s: string) => !/^[\x00-\x7F]*$/.test(s);

const BRAND_TOKENS = [
  'panasonic','canon','brother','epson','hp ','dell','lenovo','samsung',
  'apple','microsoft','cisco','merck','thiên long','double a',
];
const hasBrand = (s: string) =>
  BRAND_TOKENS.some(b => s.toLowerCase().includes(b));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ALL_DOCS = [
  'to-trinh','khlcnt','hsyc','quyet-dinh-phe-duyet',
  'dang-tai','mo-thau','danh-gia','thuong-thao',
  'hop-dong','bien-ban-ban-giao','thanh-ly',
];

const BASE: TemplateGeneratorInput = {
  procurementMethod: 'dau-thau-rong-rai',
  fundingSource:     'ngan-sach-nha-nuoc',
  packageValue:      100_000_000,
  existingDocuments: [],
  contractType:      'tron-goi',
  durationDays:      180,
};

// ─── TG-01: output structure ──────────────────────────────────────────────────

describe('TG-01: output structure', () => {
  it('TG-01-01 returns an object with templates array', () => {
    const out = generateTemplates(BASE);
    expect(out).toHaveProperty('templates');
    expect(Array.isArray(out.templates)).toBe(true);
  });

  it('TG-01-02 templates array has exactly 11 items', () => {
    const out = generateTemplates(BASE);
    expect(out.templates).toHaveLength(11);
  });

  it('TG-01-03 each item has all required fields', () => {
    const out = generateTemplates(BASE);
    for (const t of out.templates) {
      expect(typeof t.docType).toBe('string');
      expect(typeof t.required).toBe('boolean');
      expect(typeof t.present).toBe('boolean');
      expect(['COMPLETE','MISSING','OPTIONAL']).toContain(t.status);
      expect(typeof t.title).toBe('string');
      expect(typeof t.description).toBe('string');
      expect(Array.isArray(t.legalBasis)).toBe(true);
    }
  });
});

// ─── TG-02: lifecycle order ───────────────────────────────────────────────────

describe('TG-02: lifecycle order', () => {
  it('TG-02-01 first stage is to-trinh', () => {
    expect(generateTemplates(BASE).templates[0].docType).toBe('to-trinh');
  });

  it('TG-02-02 stage 5 (index 4) is dang-tai', () => {
    expect(generateTemplates(BASE).templates[4].docType).toBe('dang-tai');
  });

  it('TG-02-03 last stage is thanh-ly', () => {
    const templates = generateTemplates(BASE).templates;
    expect(templates[templates.length - 1].docType).toBe('thanh-ly');
  });
});

// ─── TG-03: stage docType values ─────────────────────────────────────────────

describe('TG-03: stage docType values', () => {
  const EXPECTED_ORDER = [
    'to-trinh','khlcnt','hsyc','quyet-dinh-phe-duyet',
    'dang-tai','mo-thau','danh-gia','thuong-thao',
    'hop-dong','bien-ban-ban-giao','thanh-ly',
  ];

  it('TG-03-01 docType sequence matches the 11-stage spec', () => {
    const types = generateTemplates(BASE).templates.map(t => t.docType);
    expect(types).toEqual(EXPECTED_ORDER);
  });

  it('TG-03-02 no duplicate docTypes', () => {
    const types = generateTemplates(BASE).templates.map(t => t.docType);
    expect(new Set(types).size).toBe(11);
  });

  it('TG-03-03 hop-dong is at index 8', () => {
    expect(generateTemplates(BASE).templates[8].docType).toBe('hop-dong');
  });
});

// ─── TG-04: dau-thau-rong-rai — all 11 required ──────────────────────────────

describe('TG-04: dau-thau-rong-rai required stages', () => {
  it('TG-04-01 all 11 templates are required', () => {
    const out = generateTemplates(BASE);
    expect(out.templates.every(t => t.required)).toBe(true);
  });

  it('TG-04-02 no OPTIONAL templates', () => {
    const out = generateTemplates(BASE);
    expect(out.templates.filter(t => t.status === 'OPTIONAL')).toHaveLength(0);
  });

  it('TG-04-03 all templates MISSING when existingDocuments empty', () => {
    const out = generateTemplates(BASE);
    expect(out.templates.every(t => t.status === 'MISSING')).toBe(true);
  });
});

// ─── TG-05: chi-dinh-thau required stages ────────────────────────────────────

describe('TG-05: chi-dinh-thau required stages', () => {
  const input: TemplateGeneratorInput = {
    ...BASE, procurementMethod: 'chi-dinh-thau', existingDocuments: [],
  };

  it('TG-05-01 khlcnt is OPTIONAL', () => {
    const t = generateTemplates(input).templates.find(x => x.docType === 'khlcnt')!;
    expect(t.status).toBe('OPTIONAL');
    expect(t.required).toBe(false);
  });

  it('TG-05-02 hsyc is OPTIONAL', () => {
    const t = generateTemplates(input).templates.find(x => x.docType === 'hsyc')!;
    expect(t.required).toBe(false);
  });

  it('TG-05-03 quyet-dinh-phe-duyet is MISSING (required + absent)', () => {
    const t = generateTemplates(input).templates.find(
      x => x.docType === 'quyet-dinh-phe-duyet',
    )!;
    expect(t.required).toBe(true);
    expect(t.status).toBe('MISSING');
  });
});

// ─── TG-06: chi-dinh-thau-rut-gon required stages ────────────────────────────

describe('TG-06: chi-dinh-thau-rut-gon required stages', () => {
  const input: TemplateGeneratorInput = {
    ...BASE, procurementMethod: 'chi-dinh-thau-rut-gon', existingDocuments: [],
  };

  it('TG-06-01 exactly 4 required stages', () => {
    const out = generateTemplates(input);
    expect(out.templates.filter(t => t.required)).toHaveLength(4);
  });

  it('TG-06-02 quyet-dinh-phe-duyet is OPTIONAL', () => {
    const t = generateTemplates(input).templates.find(
      x => x.docType === 'quyet-dinh-phe-duyet',
    )!;
    expect(t.required).toBe(false);
  });

  it('TG-06-03 to-trinh is required', () => {
    const t = generateTemplates(input).templates.find(x => x.docType === 'to-trinh')!;
    expect(t.required).toBe(true);
    expect(t.status).toBe('MISSING');
  });
});

// ─── TG-07: chao-hang-canh-tranh required stages ─────────────────────────────

describe('TG-07: chao-hang-canh-tranh required stages', () => {
  const input: TemplateGeneratorInput = {
    ...BASE, procurementMethod: 'chao-hang-canh-tranh', existingDocuments: [],
  };

  it('TG-07-01 exactly 9 required stages', () => {
    expect(generateTemplates(input).templates.filter(t => t.required)).toHaveLength(9);
  });

  it('TG-07-02 mo-thau is OPTIONAL', () => {
    const t = generateTemplates(input).templates.find(x => x.docType === 'mo-thau')!;
    expect(t.required).toBe(false);
  });

  it('TG-07-03 dang-tai is required', () => {
    const t = generateTemplates(input).templates.find(x => x.docType === 'dang-tai')!;
    expect(t.required).toBe(true);
  });
});

// ─── TG-08: mua-sam-truc-tiep required stages ────────────────────────────────

describe('TG-08: mua-sam-truc-tiep required stages', () => {
  const input: TemplateGeneratorInput = {
    ...BASE, procurementMethod: 'mua-sam-truc-tiep', existingDocuments: [],
  };

  it('TG-08-01 exactly 7 required stages', () => {
    expect(generateTemplates(input).templates.filter(t => t.required)).toHaveLength(7);
  });

  it('TG-08-02 process stages are OPTIONAL', () => {
    const out = generateTemplates(input);
    for (const dt of ['dang-tai','mo-thau','danh-gia','thuong-thao']) {
      const t = out.templates.find(x => x.docType === dt)!;
      expect(t.required).toBe(false);
    }
  });

  it('TG-08-03 khlcnt is required', () => {
    const t = generateTemplates(input).templates.find(x => x.docType === 'khlcnt')!;
    expect(t.required).toBe(true);
  });
});

// ─── TG-09: COMPLETE status ───────────────────────────────────────────────────

describe('TG-09: COMPLETE status when required + present', () => {
  it('TG-09-01 to-trinh COMPLETE when in existingDocuments', () => {
    const out = generateTemplates({ ...BASE, existingDocuments: ['to-trinh'] });
    expect(out.templates[0].status).toBe('COMPLETE');
  });

  it('TG-09-02 hop-dong COMPLETE when in existingDocuments', () => {
    const out = generateTemplates({ ...BASE, existingDocuments: ['hop-dong'] });
    const t = out.templates.find(x => x.docType === 'hop-dong')!;
    expect(t.status).toBe('COMPLETE');
    expect(t.present).toBe(true);
  });

  it('TG-09-03 multiple docs COMPLETE when all present', () => {
    const out = generateTemplates({ ...BASE, existingDocuments: ALL_DOCS });
    expect(out.templates.every(t => t.status === 'COMPLETE')).toBe(true);
  });
});

// ─── TG-10: MISSING status ────────────────────────────────────────────────────

describe('TG-10: MISSING status when required + absent', () => {
  it('TG-10-01 to-trinh MISSING when not in existingDocuments', () => {
    expect(generateTemplates(BASE).templates[0].status).toBe('MISSING');
  });

  it('TG-10-02 khlcnt MISSING for dau-thau with empty docs', () => {
    const t = generateTemplates(BASE).templates.find(x => x.docType === 'khlcnt')!;
    expect(t.status).toBe('MISSING');
  });

  it('TG-10-03 thanh-ly MISSING when required and absent', () => {
    const t = generateTemplates(BASE).templates.find(x => x.docType === 'thanh-ly')!;
    expect(t.status).toBe('MISSING');
    expect(t.present).toBe(false);
  });
});

// ─── TG-11: OPTIONAL status ───────────────────────────────────────────────────

describe('TG-11: OPTIONAL status when not required', () => {
  it('TG-11-01 chi-dinh-thau khlcnt OPTIONAL even when present', () => {
    const out = generateTemplates({
      ...BASE, procurementMethod: 'chi-dinh-thau', existingDocuments: ['khlcnt'],
    });
    const t = out.templates.find(x => x.docType === 'khlcnt')!;
    expect(t.status).toBe('OPTIONAL');
    expect(t.present).toBe(true);
  });

  it('TG-11-02 rut-gon quyet-dinh-phe-duyet OPTIONAL', () => {
    const out = generateTemplates({
      ...BASE, procurementMethod: 'chi-dinh-thau-rut-gon', existingDocuments: [],
    });
    const t = out.templates.find(x => x.docType === 'quyet-dinh-phe-duyet')!;
    expect(t.status).toBe('OPTIONAL');
  });

  it('TG-11-03 mua-sam-truc-tiep dang-tai OPTIONAL', () => {
    const out = generateTemplates({
      ...BASE, procurementMethod: 'mua-sam-truc-tiep', existingDocuments: [],
    });
    const t = out.templates.find(x => x.docType === 'dang-tai')!;
    expect(t.status).toBe('OPTIONAL');
  });
});

// ─── TG-12: required flag accuracy ───────────────────────────────────────────

describe('TG-12: required flag per method', () => {
  it('TG-12-01 chi-dinh-thau: khlcnt.required=false', () => {
    const out = generateTemplates({ ...BASE, procurementMethod: 'chi-dinh-thau' });
    expect(out.templates.find(t => t.docType === 'khlcnt')!.required).toBe(false);
  });

  it('TG-12-02 dau-thau-rong-rai: khlcnt.required=true', () => {
    expect(generateTemplates(BASE).templates.find(t => t.docType === 'khlcnt')!.required).toBe(true);
  });

  it('TG-12-03 chi-dinh-thau-rut-gon: mo-thau.required=false', () => {
    const out = generateTemplates({ ...BASE, procurementMethod: 'chi-dinh-thau-rut-gon' });
    expect(out.templates.find(t => t.docType === 'mo-thau')!.required).toBe(false);
  });
});

// ─── TG-13: present flag ─────────────────────────────────────────────────────

describe('TG-13: present flag from existingDocuments', () => {
  it('TG-13-01 present=true when docType in existingDocuments', () => {
    const out = generateTemplates({ ...BASE, existingDocuments: ['hop-dong'] });
    expect(out.templates.find(t => t.docType === 'hop-dong')!.present).toBe(true);
  });

  it('TG-13-02 present=false when docType not in existingDocuments', () => {
    const out = generateTemplates({ ...BASE, existingDocuments: ['hop-dong'] });
    expect(out.templates.find(t => t.docType === 'khlcnt')!.present).toBe(false);
  });

  it('TG-13-03 present=true for OPTIONAL stage when it is in existingDocuments', () => {
    const out = generateTemplates({
      ...BASE,
      procurementMethod: 'chi-dinh-thau',
      existingDocuments: ['khlcnt'],
    });
    const t = out.templates.find(x => x.docType === 'khlcnt')!;
    expect(t.present).toBe(true);
    expect(t.status).toBe('OPTIONAL');
  });
});

// ─── TG-14: title is Vietnamese non-empty ────────────────────────────────────

describe('TG-14: title is Vietnamese non-empty', () => {
  it('TG-14-01 all titles are non-empty', () => {
    const out = generateTemplates(BASE);
    expect(out.templates.every(t => t.title.length > 0)).toBe(true);
  });

  it('TG-14-02 to-trinh title contains Vietnamese characters', () => {
    const t = generateTemplates(BASE).templates[0];
    expect(hasVietnamese(t.title)).toBe(true);
  });

  it('TG-14-03 all titles contain Vietnamese characters', () => {
    const out = generateTemplates(BASE);
    expect(out.templates.every(t => hasVietnamese(t.title))).toBe(true);
  });
});

// ─── TG-15: description is Vietnamese non-empty ──────────────────────────────

describe('TG-15: description is Vietnamese non-empty', () => {
  it('TG-15-01 all descriptions are non-empty', () => {
    const out = generateTemplates(BASE);
    expect(out.templates.every(t => t.description.length > 0)).toBe(true);
  });

  it('TG-15-02 description differs from title', () => {
    const out = generateTemplates(BASE);
    expect(out.templates.every(t => t.description !== t.title)).toBe(true);
  });

  it('TG-15-03 all descriptions contain Vietnamese characters', () => {
    const out = generateTemplates(BASE);
    expect(out.templates.every(t => hasVietnamese(t.description))).toBe(true);
  });
});

// ─── TG-16: legalBasis for DocumentType stages ───────────────────────────────

describe('TG-16: legalBasis non-empty for DocumentType-mapped stages', () => {
  it('TG-16-01 to-trinh has non-empty legalBasis', () => {
    const t = generateTemplates(BASE).templates.find(x => x.docType === 'to-trinh')!;
    expect(t.legalBasis.length).toBeGreaterThan(0);
  });

  it('TG-16-02 khlcnt legalBasis contains strings', () => {
    const t = generateTemplates(BASE).templates.find(x => x.docType === 'khlcnt')!;
    expect(t.legalBasis.every(s => typeof s === 'string' && s.length > 0)).toBe(true);
  });

  it('TG-16-03 hop-dong has non-empty legalBasis', () => {
    const t = generateTemplates(BASE).templates.find(x => x.docType === 'hop-dong')!;
    expect(t.legalBasis.length).toBeGreaterThan(0);
  });
});

// ─── TG-17: legalBasis for process stages ────────────────────────────────────

describe('TG-17: legalBasis non-empty for process stages', () => {
  it('TG-17-01 dang-tai has non-empty legalBasis', () => {
    const t = generateTemplates(BASE).templates.find(x => x.docType === 'dang-tai')!;
    expect(t.legalBasis.length).toBeGreaterThan(0);
  });

  it('TG-17-02 mo-thau has non-empty legalBasis', () => {
    const t = generateTemplates(BASE).templates.find(x => x.docType === 'mo-thau')!;
    expect(t.legalBasis.length).toBeGreaterThan(0);
  });

  it('TG-17-03 danh-gia legalBasis strings are non-empty', () => {
    const t = generateTemplates(BASE).templates.find(x => x.docType === 'danh-gia')!;
    expect(t.legalBasis.every(s => s.length > 0)).toBe(true);
  });
});

// ─── TG-18: legalBasis for bien-ban-ban-giao ─────────────────────────────────

describe('TG-18: legalBasis for bien-ban-ban-giao', () => {
  it('TG-18-01 bien-ban-ban-giao has non-empty legalBasis', () => {
    const t = generateTemplates(BASE).templates.find(x => x.docType === 'bien-ban-ban-giao')!;
    expect(t.legalBasis.length).toBeGreaterThan(0);
  });

  it('TG-18-02 legalBasis references asset management regulation', () => {
    const t = generateTemplates(BASE).templates.find(x => x.docType === 'bien-ban-ban-giao')!;
    const joined = t.legalBasis.join(' ');
    expect(joined).toMatch(/tài sản|Tài sản|186/);
  });

  it('TG-18-03 legalBasis strings are non-empty', () => {
    const t = generateTemplates(BASE).templates.find(x => x.docType === 'bien-ban-ban-giao')!;
    expect(t.legalBasis.every(s => s.length > 0)).toBe(true);
  });
});

// ─── TG-19: no brand names ───────────────────────────────────────────────────

describe('TG-19: no brand names in output', () => {
  it('TG-19-01 no brand tokens in titles', () => {
    const out = generateTemplates(BASE);
    expect(out.templates.every(t => !hasBrand(t.title))).toBe(true);
  });

  it('TG-19-02 no brand tokens in descriptions', () => {
    const out = generateTemplates(BASE);
    expect(out.templates.every(t => !hasBrand(t.description))).toBe(true);
  });

  it('TG-19-03 no brand tokens in legalBasis strings', () => {
    const out = generateTemplates(BASE);
    const allBasis = out.templates.flatMap(t => t.legalBasis);
    expect(allBasis.every(s => !hasBrand(s))).toBe(true);
  });
});

// ─── TG-20: full dossier — all COMPLETE ──────────────────────────────────────

describe('TG-20: full dossier — dau-thau with all docs present', () => {
  const out = generateTemplates({ ...BASE, existingDocuments: ALL_DOCS });

  it('TG-20-01 all 11 templates are COMPLETE', () => {
    expect(out.templates.every(t => t.status === 'COMPLETE')).toBe(true);
  });

  it('TG-20-02 all templates have present=true', () => {
    expect(out.templates.every(t => t.present)).toBe(true);
  });

  it('TG-20-03 chi-dinh with all docs: OPTIONAL stages stay OPTIONAL', () => {
    const out2 = generateTemplates({
      ...BASE,
      procurementMethod: 'chi-dinh-thau',
      existingDocuments: ALL_DOCS,
    });
    const optional = out2.templates.filter(t => !t.required);
    expect(optional.every(t => t.status === 'OPTIONAL')).toBe(true);
  });
});

// ─── TG-21: mixed scenarios ───────────────────────────────────────────────────

describe('TG-21: mixed / edge scenarios', () => {
  it('TG-21-01 partial docs: correct COMPLETE and MISSING counts for dau-thau', () => {
    const existing = ['to-trinh','khlcnt','hop-dong'];
    const out = generateTemplates({ ...BASE, existingDocuments: existing });
    const complete = out.templates.filter(t => t.status === 'COMPLETE');
    const missing  = out.templates.filter(t => t.status === 'MISSING');
    expect(complete).toHaveLength(3);
    expect(missing).toHaveLength(8);
  });

  it('TG-21-02 chi-dinh-thau-rut-gon with required docs present: 4 COMPLETE 7 OPTIONAL', () => {
    const out = generateTemplates({
      ...BASE,
      procurementMethod: 'chi-dinh-thau-rut-gon',
      existingDocuments: ['to-trinh','hop-dong','bien-ban-ban-giao','thanh-ly'],
    });
    expect(out.templates.filter(t => t.status === 'COMPLETE')).toHaveLength(4);
    expect(out.templates.filter(t => t.status === 'OPTIONAL')).toHaveLength(7);
  });

  it('TG-21-03 unknown docs in existingDocuments are ignored', () => {
    const out = generateTemplates({
      ...BASE,
      existingDocuments: ['unknown-doc','not-a-stage'],
    });
    expect(out.templates).toHaveLength(11);
    expect(out.templates.every(t => !t.present)).toBe(true);
  });
});

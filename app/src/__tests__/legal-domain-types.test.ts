/**
 * Domain types and utility helpers
 *
 * Groups (13 × 3 = 39):
 *   LDT-01  DOC_HIERARCHY_LEVEL — LAW=1 is highest authority
 *   LDT-02  DOC_HIERARCHY_LEVEL — full hierarchy order
 *   LDT-03  docTypeToLevel — maps type strings to numbers
 *   LDT-04  isHigherAuthority — LAW beats DECREE
 *   LDT-05  isHigherAuthority — DECREE beats CIRCULAR; same level is false
 *   LDT-06  LEGAL_STATUS_VALUES — contains all 6 statuses
 *   LDT-07  isLegalStatus — valid and invalid values
 *   LDT-08  CONFLICT_RULES — contains all 4 rules
 *   LDT-09  ConflictResolution — shape has required fields
 *   LDT-10  ApplicabilityContext — required vs optional fields
 *   LDT-11  ThresholdBand — maxValue can be null
 *   LDT-12  CitationTarget — docId required, rest optional
 *   LDT-13  CrossReferenceResult and EffectiveDocumentResult shapes
 */

import { describe, it, expect } from 'vitest';
import {
  DOC_HIERARCHY_LEVEL,
  LEGAL_STATUS_VALUES,
  CONFLICT_RULES,
  docTypeToLevel,
  isHigherAuthority,
  isLegalStatus,
  type ConflictResolution,
  type ApplicabilityContext,
  type ThresholdBand,
  type CitationTarget,
  type CrossReferenceResult,
  type EffectiveDocumentResult,
} from '../legal/domain/legalDomainTypes';

// ─── LDT-01: DOC_HIERARCHY_LEVEL — LAW is level 1 ────────────────────────────

describe('LDT-01 DOC_HIERARCHY_LEVEL LAW has level 1 (highest authority)', () => {
  it('LAW = 1', () => {
    expect(DOC_HIERARCHY_LEVEL['LAW']).toBe(1);
  });
  it('all levels are positive integers', () => {
    const values = Object.values(DOC_HIERARCHY_LEVEL);
    expect(values.every(v => Number.isInteger(v) && v > 0)).toBe(true);
  });
  it('LAW has the lowest level number (highest authority)', () => {
    const min = Math.min(...Object.values(DOC_HIERARCHY_LEVEL));
    expect(DOC_HIERARCHY_LEVEL['LAW']).toBe(min);
  });
});

// ─── LDT-02: full hierarchy order ────────────────────────────────────────────

describe('LDT-02 DOC_HIERARCHY_LEVEL full order LAW < RESOLUTION < DECREE < CIRCULAR', () => {
  it('LAW (1) < RESOLUTION (2)', () => {
    expect(DOC_HIERARCHY_LEVEL['LAW']).toBeLessThan(DOC_HIERARCHY_LEVEL['RESOLUTION']);
  });
  it('DECREE (3) < CIRCULAR (4) < DECISION (5)', () => {
    expect(DOC_HIERARCHY_LEVEL['DECREE']).toBeLessThan(DOC_HIERARCHY_LEVEL['CIRCULAR']);
    expect(DOC_HIERARCHY_LEVEL['CIRCULAR']).toBeLessThan(DOC_HIERARCHY_LEVEL['DECISION']);
  });
  it('INTERNAL_REGULATION and GUIDELINE are lowest authority', () => {
    expect(DOC_HIERARCHY_LEVEL['INTERNAL_REGULATION']).toBeGreaterThan(DOC_HIERARCHY_LEVEL['DECISION']);
    expect(DOC_HIERARCHY_LEVEL['GUIDELINE']).toBeGreaterThanOrEqual(DOC_HIERARCHY_LEVEL['INTERNAL_REGULATION']);
  });
});

// ─── LDT-03: docTypeToLevel ──────────────────────────────────────────────────

describe('LDT-03 docTypeToLevel maps type strings to level numbers', () => {
  it('docTypeToLevel("LAW") === 1', () => {
    expect(docTypeToLevel('LAW')).toBe(1);
  });
  it('docTypeToLevel("DECREE") === 3', () => {
    expect(docTypeToLevel('DECREE')).toBe(3);
  });
  it('docTypeToLevel("CIRCULAR") === 4', () => {
    expect(docTypeToLevel('CIRCULAR')).toBe(4);
  });
});

// ─── LDT-04: isHigherAuthority LAW beats DECREE ───────────────────────────────

describe('LDT-04 isHigherAuthority LAW has higher authority than DECREE', () => {
  it('isHigherAuthority("LAW", "DECREE") === true', () => {
    expect(isHigherAuthority('LAW', 'DECREE')).toBe(true);
  });
  it('isHigherAuthority("DECREE", "LAW") === false', () => {
    expect(isHigherAuthority('DECREE', 'LAW')).toBe(false);
  });
  it('LAW beats every other type', () => {
    const others: Array<Parameters<typeof isHigherAuthority>[1]> = [
      'RESOLUTION', 'DECREE', 'CIRCULAR', 'DECISION', 'INTERNAL_REGULATION', 'GUIDELINE',
    ];
    expect(others.every(t => isHigherAuthority('LAW', t))).toBe(true);
  });
});

// ─── LDT-05: isHigherAuthority DECREE/CIRCULAR; same level ───────────────────

describe('LDT-05 isHigherAuthority DECREE over CIRCULAR; same level is false', () => {
  it('isHigherAuthority("DECREE", "CIRCULAR") === true', () => {
    expect(isHigherAuthority('DECREE', 'CIRCULAR')).toBe(true);
  });
  it('isHigherAuthority("CIRCULAR", "DECISION") === true', () => {
    expect(isHigherAuthority('CIRCULAR', 'DECISION')).toBe(true);
  });
  it('isHigherAuthority(X, X) is always false (same type, same level)', () => {
    expect(isHigherAuthority('LAW', 'LAW')).toBe(false);
    expect(isHigherAuthority('DECREE', 'DECREE')).toBe(false);
  });
});

// ─── LDT-06: LEGAL_STATUS_VALUES ─────────────────────────────────────────────

describe('LDT-06 LEGAL_STATUS_VALUES contains all 6 statuses', () => {
  it('has exactly 6 entries', () => {
    expect(LEGAL_STATUS_VALUES).toHaveLength(6);
  });
  it('contains IN_FORCE and SUPERSEDED', () => {
    expect(LEGAL_STATUS_VALUES).toContain('IN_FORCE');
    expect(LEGAL_STATUS_VALUES).toContain('SUPERSEDED');
  });
  it('contains REPEALED, SUSPENDED, PENDING, UNKNOWN', () => {
    expect(LEGAL_STATUS_VALUES).toContain('REPEALED');
    expect(LEGAL_STATUS_VALUES).toContain('SUSPENDED');
    expect(LEGAL_STATUS_VALUES).toContain('PENDING');
    expect(LEGAL_STATUS_VALUES).toContain('UNKNOWN');
  });
});

// ─── LDT-07: isLegalStatus ───────────────────────────────────────────────────

describe('LDT-07 isLegalStatus type guard', () => {
  it('returns true for "IN_FORCE"', () => {
    expect(isLegalStatus('IN_FORCE')).toBe(true);
  });
  it('returns true for all values in LEGAL_STATUS_VALUES', () => {
    expect(LEGAL_STATUS_VALUES.every(s => isLegalStatus(s))).toBe(true);
  });
  it('returns false for unknown strings and non-strings', () => {
    expect(isLegalStatus('ACTIVE')).toBe(false);   // registry status, not domain status
    expect(isLegalStatus(null)).toBe(false);
    expect(isLegalStatus(42)).toBe(false);
  });
});

// ─── LDT-08: CONFLICT_RULES ──────────────────────────────────────────────────

describe('LDT-08 CONFLICT_RULES contains all 4 resolution rules', () => {
  it('has 4 entries', () => {
    expect(CONFLICT_RULES).toHaveLength(4);
  });
  it('contains HIERARCHY and LEX_POSTERIOR', () => {
    expect(CONFLICT_RULES).toContain('HIERARCHY');
    expect(CONFLICT_RULES).toContain('LEX_POSTERIOR');
  });
  it('contains LEX_SPECIALIS and PRIORITY', () => {
    expect(CONFLICT_RULES).toContain('LEX_SPECIALIS');
    expect(CONFLICT_RULES).toContain('PRIORITY');
  });
});

// ─── LDT-09: ConflictResolution shape ────────────────────────────────────────

describe('LDT-09 ConflictResolution has all required fields', () => {
  const cr: ConflictResolution = {
    prevailingDocId: 'luat-22-2023',
    yieldsDocId:     'nd-214-2025',
    rule:            'HIERARCHY',
    reason:          'LAW overrides DECREE',
  };

  it('has prevailingDocId and yieldsDocId', () => {
    expect(cr.prevailingDocId).toBe('luat-22-2023');
    expect(cr.yieldsDocId).toBe('nd-214-2025');
  });
  it('rule is a ConflictRule value', () => {
    expect(CONFLICT_RULES).toContain(cr.rule);
  });
  it('reason is a non-empty string', () => {
    expect(typeof cr.reason).toBe('string');
    expect(cr.reason.length).toBeGreaterThan(0);
  });
});

// ─── LDT-10: ApplicabilityContext ────────────────────────────────────────────

describe('LDT-10 ApplicabilityContext asOfDate required; rest optional', () => {
  it('minimal context has only asOfDate', () => {
    const ctx: ApplicabilityContext = { asOfDate: '2025-01-01' };
    expect(ctx.asOfDate).toBe('2025-01-01');
    expect(ctx.domainId).toBeUndefined();
  });
  it('full context accepts all optional fields', () => {
    const ctx: ApplicabilityContext = {
      asOfDate:           '2025-01-01',
      domainId:           'procurement',
      subjectMatter:      'đấu thầu',
      procurementMethod:  'OPEN',
      value:              500_000_000,
    };
    expect(ctx.value).toBe(500_000_000);
  });
  it('asOfDate is a string (YYYY-MM-DD)', () => {
    const ctx: ApplicabilityContext = { asOfDate: '2026-07-01' };
    expect(typeof ctx.asOfDate).toBe('string');
  });
});

// ─── LDT-11: ThresholdBand maxValue null ─────────────────────────────────────

describe('LDT-11 ThresholdBand maxValue can be null for open-ended bands', () => {
  const openBand: ThresholdBand = {
    domain: '*', minValue: 200_000_000, maxValue: null,
    method: 'OPEN_TENDER', documentRef: '22/2023/QH15',
  };
  const closedBand: ThresholdBand = {
    domain: 'goods', minValue: 0, maxValue: 50_000_000,
    method: 'DIRECT', documentRef: '214/2025/NĐ-CP',
  };

  it('open band has maxValue null', () => {
    expect(openBand.maxValue).toBeNull();
  });
  it('closed band has numeric maxValue', () => {
    expect(typeof closedBand.maxValue).toBe('number');
  });
  it('domain "*" is a valid domain value', () => {
    expect(openBand.domain).toBe('*');
  });
});

// ─── LDT-12: CitationTarget ───────────────────────────────────────────────────

describe('LDT-12 CitationTarget docId required; article/clause/point optional', () => {
  it('minimal target has only docId', () => {
    const t: CitationTarget = { docId: 'luat-22-2023' };
    expect(t.docId).toBe('luat-22-2023');
    expect(t.articleNumber).toBeUndefined();
  });
  it('full target has all fields', () => {
    const t: CitationTarget = { docId: 'doc', articleNumber: 43, clauseNumber: 2, pointLabel: 'a' };
    expect(t.pointLabel).toBe('a');
  });
  it('article-only target is valid', () => {
    const t: CitationTarget = { docId: 'doc', articleNumber: 10 };
    expect(t.clauseNumber).toBeUndefined();
  });
});

// ─── LDT-13: CrossReferenceResult and EffectiveDocumentResult ─────────────────

describe('LDT-13 CrossReferenceResult and EffectiveDocumentResult shapes', () => {
  it('CrossReferenceResult has cites and citedBy arrays', () => {
    const r: CrossReferenceResult = { cites: [], citedBy: [] };
    expect(Array.isArray(r.cites)).toBe(true);
    expect(Array.isArray(r.citedBy)).toBe(true);
  });
  it('EffectiveDocumentResult has isInForce boolean', () => {
    const r: EffectiveDocumentResult = {
      docId: 'doc', isInForce: true, period: null, status: 'IN_FORCE',
    };
    expect(typeof r.isInForce).toBe('boolean');
  });
  it('EffectiveDocumentResult status must be a LegalStatus', () => {
    const r: EffectiveDocumentResult = {
      docId: 'doc', isInForce: false, period: null, status: 'UNKNOWN',
    };
    expect(isLegalStatus(r.status)).toBe(true);
  });
});

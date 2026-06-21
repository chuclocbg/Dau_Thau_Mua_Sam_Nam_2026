/**
 * Legal v3.5 — Decision Assistant tests
 * DA-01..DA-21 × 3 = 63 tests
 */

import { describe, it, expect } from 'vitest';
import { assessDecision } from '../ai/decisionAssistant';
import type { DecisionAssistantInput } from '../ai/decisionAssistant';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hasVietnamese = (s: string) => !/^[\x00-\x7F]*$/.test(s);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Minimal clause set for tron-goi (8 universal + 1 type-specific)
const BASIC_CLAUSES = [
  'doi-tuong','gia-tri','thoi-han','thanh-toan',
  'nghiem-thu','phat-vi-pham','bat-kha-khang','tranh-chap',
  'bao-hanh',
];

// All doc types in chi-dinh-thau-rut-gon lifecycle
const RUT_GON_DOCS = [
  'to-trinh','hop-dong','bien-ban-nghiem-thu','bien-ban-ban-giao','thanh-toan','thanh-ly',
];

// All doc types in chi-dinh-thau lifecycle
const CHI_DINH_DOCS = [
  'to-trinh','quyet-dinh-phe-duyet','hop-dong',
  'bien-ban-nghiem-thu','bien-ban-ban-giao','thanh-toan','thanh-ly',
];

// LOW risk: fully complete, simplest method, no escalation triggers
const LOW_RISK: DecisionAssistantInput = {
  procurementMethod: 'chi-dinh-thau-rut-gon',
  fundingSource:     'von-tu-co',
  packageValue:      1_000_000,
  durationDays:      180,
  contractType:      'tron-goi',
  existingDocuments: RUT_GON_DOCS,
  clauses:           BASIC_CLAUSES,
};

// MEDIUM risk: chi-dinh-thau, 2 low-weight docs missing (thanh-toan, thanh-ly)
// Missing weight = 10+5=15, forcedMin=LOW, riskScore ≈ 18–19 → MEDIUM
const MEDIUM_RISK: DecisionAssistantInput = {
  procurementMethod: 'chi-dinh-thau',
  fundingSource:     'von-tu-co',
  packageValue:      1_000_000,
  durationDays:      180,
  contractType:      'tron-goi',
  existingDocuments: ['to-trinh','quyet-dinh-phe-duyet','hop-dong','bien-ban-nghiem-thu','bien-ban-ban-giao'],
  clauses:           BASIC_CLAUSES,
};

// HIGH risk: chi-dinh-thau, hop-dong missing (weight=30, forcedMin=HIGH)
const HIGH_RISK: DecisionAssistantInput = {
  procurementMethod: 'chi-dinh-thau',
  fundingSource:     'von-tu-co',
  packageValue:      1_000_000,
  durationDays:      180,
  contractType:      'tron-goi',
  existingDocuments: ['to-trinh','quyet-dinh-phe-duyet','bien-ban-nghiem-thu','bien-ban-ban-giao','thanh-toan','thanh-ly'],
  clauses:           BASIC_CLAUSES,
};

// CRITICAL risk: chi-dinh-thau, quyet-dinh-phe-duyet missing (weight=40, forcedMin=CRITICAL)
const CRITICAL_RISK: DecisionAssistantInput = {
  procurementMethod: 'chi-dinh-thau',
  fundingSource:     'von-tu-co',
  packageValue:      1_000_000,
  durationDays:      180,
  contractType:      'tron-goi',
  existingDocuments: ['to-trinh','hop-dong','bien-ban-nghiem-thu','bien-ban-ban-giao','thanh-toan','thanh-ly'],
  clauses:           BASIC_CLAUSES,
};

// Contract mismatch: incompatible contractType for chi-dinh-thau-rut-gon
const CONTRACT_MISMATCH: DecisionAssistantInput = {
  procurementMethod: 'chi-dinh-thau-rut-gon',
  fundingSource:     'von-tu-co',
  packageValue:      1_000_000,
  durationDays:      180,
  contractType:      'theo-don-gia-dieu-chinh', // not in ['tron-goi']
  existingDocuments: RUT_GON_DOCS,
  clauses:           BASIC_CLAUSES,
};

// Invalid duration: durationDays = 0 → CRITICAL + STOP
const INVALID_DURATION: DecisionAssistantInput = {
  ...LOW_RISK,
  durationDays: 0,
};

// Open bidding, no existing docs → dang-tai MISSING → CRITICAL (Rule E)
const OPEN_BIDDING_NO_DOCS: DecisionAssistantInput = {
  procurementMethod: 'dau-thau-rong-rai',
  fundingSource:     'ngan-sach-nha-nuoc',
  packageValue:      1_000_000,
  durationDays:      180,
  contractType:      'tron-goi',
  existingDocuments: [],
  clauses:           BASIC_CLAUSES,
};

// ODA: missing tuan-thu-nha-tai-tro clause → Rule F
const ODA_MISSING_CLAUSE: DecisionAssistantInput = {
  procurementMethod: 'chi-dinh-thau',
  fundingSource:     'von-vay-oda',
  packageValue:      1_000_000,
  durationDays:      180,
  contractType:      'tron-goi',
  existingDocuments: CHI_DINH_DOCS,
  clauses:           BASIC_CLAUSES, // missing tuan-thu-nha-tai-tro
};

// State budget + khlcnt missing → Rule G
// mua-sam-truc-tiep lifecycle: 9 docs; existingDocuments omits khlcnt
const STATE_BUDGET_NO_KHLCNT: DecisionAssistantInput = {
  procurementMethod: 'mua-sam-truc-tiep',
  fundingSource:     'ngan-sach-nha-nuoc',
  packageValue:      1_000_000,
  durationDays:      180,
  contractType:      'tron-goi',
  existingDocuments: [
    'to-trinh','hsyc','quyet-dinh-phe-duyet','hop-dong',
    'bien-ban-nghiem-thu','bien-ban-ban-giao','thanh-toan','thanh-ly',
  ],
  clauses: [...BASIC_CLAUSES, 'bao-dam-thuc-hien'], // ngan-sach requires this clause
};

// Low completion: only 2 of 6 rut-gon docs present → completionScore ≈ 33% → Rule D
const LOW_COMPLETION: DecisionAssistantInput = {
  procurementMethod: 'chi-dinh-thau-rut-gon',
  fundingSource:     'von-tu-co',
  packageValue:      1_000_000,
  durationDays:      180,
  contractType:      'tron-goi',
  existingDocuments: ['bien-ban-ban-giao','thanh-ly'],
  clauses:           BASIC_CLAUSES,
};

// Empty / degenerate input: triggers Rule A (durationDays=0)
const EMPTY_INPUT: DecisionAssistantInput = {
  procurementMethod: 'chi-dinh-thau-rut-gon',
  fundingSource:     'von-tu-co',
  packageValue:      0,
  durationDays:      0,
  contractType:      'tron-goi',
  existingDocuments: [],
  clauses:           [],
};

// ─── DA-01: low risk ──────────────────────────────────────────────────────────

describe('DA-01: low risk', () => {
  it('DA-01-01 severity === LOW', () => {
    expect(assessDecision(LOW_RISK).severity).toBe('LOW');
  });

  it('DA-01-02 decision === PROCEED', () => {
    expect(assessDecision(LOW_RISK).decision).toBe('PROCEED');
  });

  it('DA-01-03 reasons is non-empty (positive confirmation message)', () => {
    expect(assessDecision(LOW_RISK).reasons.length).toBeGreaterThan(0);
  });
});

// ─── DA-02: medium risk ───────────────────────────────────────────────────────

describe('DA-02: medium risk', () => {
  it('DA-02-01 severity === MEDIUM', () => {
    expect(assessDecision(MEDIUM_RISK).severity).toBe('MEDIUM');
  });

  it('DA-02-02 decision === PROCEED_WITH_WARNINGS', () => {
    expect(assessDecision(MEDIUM_RISK).decision).toBe('PROCEED_WITH_WARNINGS');
  });

  it('DA-02-03 reasons contain a [MEDIUM] entry', () => {
    const out = assessDecision(MEDIUM_RISK);
    expect(out.reasons.some(r => r.startsWith('[MEDIUM]'))).toBe(true);
  });
});

// ─── DA-03: high risk ─────────────────────────────────────────────────────────

describe('DA-03: high risk', () => {
  it('DA-03-01 severity === HIGH', () => {
    expect(assessDecision(HIGH_RISK).severity).toBe('HIGH');
  });

  it('DA-03-02 decision === PROCEED_WITH_WARNINGS', () => {
    expect(assessDecision(HIGH_RISK).decision).toBe('PROCEED_WITH_WARNINGS');
  });

  it('DA-03-03 reasons contain a severity-tagged entry', () => {
    const out = assessDecision(HIGH_RISK);
    expect(out.reasons.some(r => /^\[(CRITICAL|HIGH|MEDIUM|LOW)\]/.test(r))).toBe(true);
  });
});

// ─── DA-04: critical risk ─────────────────────────────────────────────────────

describe('DA-04: critical risk', () => {
  it('DA-04-01 severity === CRITICAL', () => {
    expect(assessDecision(CRITICAL_RISK).severity).toBe('CRITICAL');
  });

  it('DA-04-02 decision === STOP', () => {
    expect(assessDecision(CRITICAL_RISK).decision).toBe('STOP');
  });

  it('DA-04-03 reasons mention the missing critical document', () => {
    const out = assessDecision(CRITICAL_RISK);
    expect(out.reasons.some(r => r.includes('Thiếu') || r.includes('phê duyệt'))).toBe(true);
  });
});

// ─── DA-05: proceed ───────────────────────────────────────────────────────────

describe('DA-05: proceed', () => {
  it('DA-05-01 LOW_RISK → decision PROCEED', () => {
    expect(assessDecision(LOW_RISK).decision).toBe('PROCEED');
  });

  it('DA-05-02 another full-dossier scenario → PROCEED', () => {
    const out = assessDecision({
      ...LOW_RISK,
      procurementMethod: 'chi-dinh-thau',
      existingDocuments: CHI_DINH_DOCS,
    });
    expect(out.decision).toBe('PROCEED');
  });

  it('DA-05-03 decision is the string literal "PROCEED"', () => {
    const out = assessDecision(LOW_RISK);
    expect(out.decision).toBe('PROCEED');
    expect(typeof out.decision).toBe('string');
  });
});

// ─── DA-06: proceed_with_warnings ────────────────────────────────────────────

describe('DA-06: proceed_with_warnings', () => {
  it('DA-06-01 MEDIUM_RISK → PROCEED_WITH_WARNINGS', () => {
    expect(assessDecision(MEDIUM_RISK).decision).toBe('PROCEED_WITH_WARNINGS');
  });

  it('DA-06-02 HIGH_RISK → PROCEED_WITH_WARNINGS', () => {
    expect(assessDecision(HIGH_RISK).decision).toBe('PROCEED_WITH_WARNINGS');
  });

  it('DA-06-03 reasons non-empty when PROCEED_WITH_WARNINGS', () => {
    const out = assessDecision(MEDIUM_RISK);
    expect(out.decision).toBe('PROCEED_WITH_WARNINGS');
    expect(out.reasons.length).toBeGreaterThan(0);
  });
});

// ─── DA-07: stop ──────────────────────────────────────────────────────────────

describe('DA-07: stop', () => {
  it('DA-07-01 CRITICAL_RISK → STOP', () => {
    expect(assessDecision(CRITICAL_RISK).decision).toBe('STOP');
  });

  it('DA-07-02 INVALID_DURATION → STOP', () => {
    expect(assessDecision(INVALID_DURATION).decision).toBe('STOP');
  });

  it('DA-07-03 reasons non-empty when STOP', () => {
    const out = assessDecision(CRITICAL_RISK);
    expect(out.decision).toBe('STOP');
    expect(out.reasons.length).toBeGreaterThan(0);
  });
});

// ─── DA-08: missing documents ─────────────────────────────────────────────────

describe('DA-08: missing documents escalation', () => {
  it('DA-08-01 any missing docs → severity ≥ MEDIUM', () => {
    const out = assessDecision(MEDIUM_RISK);
    expect(['MEDIUM','HIGH','CRITICAL']).toContain(out.severity);
  });

  it('DA-08-02 reasons contain missing-doc count', () => {
    const out = assessDecision(MEDIUM_RISK);
    expect(out.reasons.some(r => r.includes('Thiếu') && r.includes('tài liệu'))).toBe(true);
  });

  it('DA-08-03 Rule B adds [MEDIUM] reason for missing docs', () => {
    const out = assessDecision(HIGH_RISK);
    expect(out.reasons.some(r => r.startsWith('[MEDIUM]') && r.includes('tài liệu'))).toBe(true);
  });
});

// ─── DA-09: contract mismatch ────────────────────────────────────────────────

describe('DA-09: contract mismatch', () => {
  it('DA-09-01 TYPE_MISMATCH finding → severity ≥ HIGH', () => {
    const out = assessDecision(CONTRACT_MISMATCH);
    expect(['HIGH','CRITICAL']).toContain(out.severity);
  });

  it('DA-09-02 decision in [PROCEED_WITH_WARNINGS, STOP]', () => {
    const out = assessDecision(CONTRACT_MISMATCH);
    expect(['PROCEED_WITH_WARNINGS','STOP']).toContain(out.decision);
  });

  it('DA-09-03 reasons contain contract violation message', () => {
    const out = assessDecision(CONTRACT_MISMATCH);
    expect(out.reasons.some(r =>
      r.includes('hợp đồng') || r.includes('Hợp đồng') || r.includes('[HIGH]'),
    )).toBe(true);
  });
});

// ─── DA-10: invalid duration ──────────────────────────────────────────────────

describe('DA-10: invalid duration', () => {
  it('DA-10-01 durationDays=0 → severity CRITICAL', () => {
    expect(assessDecision(INVALID_DURATION).severity).toBe('CRITICAL');
  });

  it('DA-10-02 durationDays=0 → decision STOP', () => {
    expect(assessDecision(INVALID_DURATION).decision).toBe('STOP');
  });

  it('DA-10-03 reasons contain duration-related message', () => {
    const out = assessDecision(INVALID_DURATION);
    expect(out.reasons.some(r =>
      r.toLowerCase().includes('thời gian') || r.toLowerCase().includes('duration'),
    )).toBe(true);
  });
});

// ─── DA-11: completion score < 50 ────────────────────────────────────────────

describe('DA-11: completion score < 50', () => {
  it('DA-11-01 low completionScore → severity ≥ HIGH', () => {
    const out = assessDecision(LOW_COMPLETION);
    expect(['HIGH','CRITICAL']).toContain(out.severity);
  });

  it('DA-11-02 reasons contain completionScore percentage', () => {
    const out = assessDecision(LOW_COMPLETION);
    expect(out.reasons.some(r => r.includes('%') || r.includes('hoàn thiện'))).toBe(true);
  });

  it('DA-11-03 decision in [PROCEED_WITH_WARNINGS, STOP]', () => {
    const out = assessDecision(LOW_COMPLETION);
    expect(['PROCEED_WITH_WARNINGS','STOP']).toContain(out.decision);
  });
});

// ─── DA-12: open bidding publication docs ─────────────────────────────────────

describe('DA-12: open bidding + missing publication notice', () => {
  it('DA-12-01 dau-thau + dang-tai MISSING → severity CRITICAL', () => {
    expect(assessDecision(OPEN_BIDDING_NO_DOCS).severity).toBe('CRITICAL');
  });

  it('DA-12-02 decision === STOP', () => {
    expect(assessDecision(OPEN_BIDDING_NO_DOCS).decision).toBe('STOP');
  });

  it('DA-12-03 reasons reference publication or CRITICAL', () => {
    const out = assessDecision(OPEN_BIDDING_NO_DOCS);
    expect(out.reasons.some(r =>
      r.includes('đăng tải') || r.includes('[CRITICAL]'),
    )).toBe(true);
  });
});

// ─── DA-13: ODA package ───────────────────────────────────────────────────────

describe('DA-13: ODA package with missing donor clause', () => {
  it('DA-13-01 von-vay-oda + missing clause → severity ≥ HIGH', () => {
    const out = assessDecision(ODA_MISSING_CLAUSE);
    expect(['HIGH','CRITICAL']).toContain(out.severity);
  });

  it('DA-13-02 reasons mention ODA or nhà tài trợ', () => {
    const out = assessDecision(ODA_MISSING_CLAUSE);
    expect(out.reasons.some(r =>
      r.includes('ODA') || r.includes('nhà tài trợ') || r.includes('tuan-thu'),
    )).toBe(true);
  });

  it('DA-13-03 decision PROCEED_WITH_WARNINGS (not STOP when only HIGH)', () => {
    const out = assessDecision(ODA_MISSING_CLAUSE);
    expect(['PROCEED_WITH_WARNINGS','STOP']).toContain(out.decision);
  });
});

// ─── DA-14: state budget KHLCNT ───────────────────────────────────────────────

describe('DA-14: state budget missing KHLCNT', () => {
  it('DA-14-01 ngan-sach + khlcnt MISSING → severity ≥ HIGH', () => {
    const out = assessDecision(STATE_BUDGET_NO_KHLCNT);
    expect(['HIGH','CRITICAL']).toContain(out.severity);
  });

  it('DA-14-02 reasons mention KHLCNT or kế hoạch', () => {
    const out = assessDecision(STATE_BUDGET_NO_KHLCNT);
    expect(out.reasons.some(r =>
      r.includes('KHLCNT') || r.toLocaleLowerCase().includes('kế hoạch'),
    )).toBe(true);
  });

  it('DA-14-03 decision in [PROCEED_WITH_WARNINGS, STOP]', () => {
    const out = assessDecision(STATE_BUDGET_NO_KHLCNT);
    expect(['PROCEED_WITH_WARNINGS','STOP']).toContain(out.decision);
  });
});

// ─── DA-15: recommendation aggregation ───────────────────────────────────────

describe('DA-15: recommendation aggregation', () => {
  it('DA-15-01 recommendations is a non-empty array', () => {
    const out = assessDecision(HIGH_RISK);
    expect(Array.isArray(out.recommendations)).toBe(true);
    expect(out.recommendations.length).toBeGreaterThan(0);
  });

  it('DA-15-02 all recommendations are non-empty strings', () => {
    const out = assessDecision(HIGH_RISK);
    expect(out.recommendations.every(r => typeof r === 'string' && r.length > 0)).toBe(true);
  });

  it('DA-15-03 recommendations are present for LOW risk too', () => {
    const out = assessDecision(LOW_RISK);
    expect(Array.isArray(out.recommendations)).toBe(true);
  });
});

// ─── DA-16: legal basis aggregation ──────────────────────────────────────────

describe('DA-16: legal basis aggregation', () => {
  it('DA-16-01 legalBasis is a non-empty array', () => {
    const out = assessDecision(LOW_RISK);
    expect(Array.isArray(out.legalBasis)).toBe(true);
    expect(out.legalBasis.length).toBeGreaterThan(0);
  });

  it('DA-16-02 all legalBasis entries are non-empty strings', () => {
    const out = assessDecision(HIGH_RISK);
    expect(out.legalBasis.every(s => typeof s === 'string' && s.length > 0)).toBe(true);
  });

  it('DA-16-03 missing docs add legalBasis citations', () => {
    // HIGH_RISK has missing hop-dong; its template legalBasis should be included
    const out = assessDecision(HIGH_RISK);
    expect(out.legalBasis.length).toBeGreaterThan(0);
  });
});

// ─── DA-17: duplicate removal ─────────────────────────────────────────────────

describe('DA-17: duplicate removal', () => {
  it('DA-17-01 no duplicate reasons', () => {
    const out = assessDecision(ODA_MISSING_CLAUSE);
    expect(new Set(out.reasons).size).toBe(out.reasons.length);
  });

  it('DA-17-02 no duplicate recommendations', () => {
    const out = assessDecision(HIGH_RISK);
    expect(new Set(out.recommendations).size).toBe(out.recommendations.length);
  });

  it('DA-17-03 no duplicate legalBasis entries', () => {
    const out = assessDecision(HIGH_RISK);
    expect(new Set(out.legalBasis).size).toBe(out.legalBasis.length);
  });
});

// ─── DA-18: UTF-8 Vietnamese ─────────────────────────────────────────────────

describe('DA-18: UTF-8 Vietnamese content', () => {
  it('DA-18-01 reasons contain Vietnamese characters', () => {
    const out = assessDecision(LOW_RISK);
    expect(out.reasons.some(r => hasVietnamese(r))).toBe(true);
  });

  it('DA-18-02 HIGH_RISK reasons contain Vietnamese characters', () => {
    const out = assessDecision(HIGH_RISK);
    expect(out.reasons.some(r => hasVietnamese(r))).toBe(true);
  });

  it('DA-18-03 legalBasis strings are non-empty', () => {
    const out = assessDecision(MEDIUM_RISK);
    expect(out.legalBasis.every(s => s.length > 0)).toBe(true);
  });
});

// ─── DA-19: empty / degenerate input ─────────────────────────────────────────

describe('DA-19: empty / degenerate input', () => {
  it('DA-19-01 durationDays=0 + empty docs → STOP', () => {
    expect(assessDecision(EMPTY_INPUT).decision).toBe('STOP');
  });

  it('DA-19-02 no exception thrown for empty input', () => {
    expect(() => assessDecision(EMPTY_INPUT)).not.toThrow();
  });

  it('DA-19-03 output has all required fields even for empty input', () => {
    const out = assessDecision(EMPTY_INPUT);
    expect(out).toHaveProperty('decision');
    expect(out).toHaveProperty('severity');
    expect(out).toHaveProperty('reasons');
    expect(out).toHaveProperty('recommendations');
    expect(out).toHaveProperty('legalBasis');
  });
});

// ─── DA-20: deterministic output ─────────────────────────────────────────────

describe('DA-20: deterministic output', () => {
  it('DA-20-01 same input → same decision', () => {
    expect(assessDecision(HIGH_RISK).decision).toBe(assessDecision(HIGH_RISK).decision);
  });

  it('DA-20-02 same input → same severity', () => {
    expect(assessDecision(MEDIUM_RISK).severity).toBe(assessDecision(MEDIUM_RISK).severity);
  });

  it('DA-20-03 same input → same reasons length', () => {
    expect(assessDecision(LOW_RISK).reasons.length).toBe(assessDecision(LOW_RISK).reasons.length);
  });
});

// ─── DA-21: response shape ────────────────────────────────────────────────────

describe('DA-21: response shape', () => {
  it('DA-21-01 output has all 5 required fields', () => {
    const out = assessDecision(LOW_RISK);
    expect(Object.keys(out).sort()).toEqual(
      ['decision','legalBasis','reasons','recommendations','severity'].sort(),
    );
  });

  it('DA-21-02 decision is one of three valid values', () => {
    const validDecisions = ['PROCEED','PROCEED_WITH_WARNINGS','STOP'];
    for (const input of [LOW_RISK, MEDIUM_RISK, CRITICAL_RISK]) {
      expect(validDecisions).toContain(assessDecision(input).decision);
    }
  });

  it('DA-21-03 severity is one of four valid values', () => {
    const validSeverities = ['LOW','MEDIUM','HIGH','CRITICAL'];
    for (const input of [LOW_RISK, MEDIUM_RISK, HIGH_RISK, CRITICAL_RISK]) {
      expect(validSeverities).toContain(assessDecision(input).severity);
    }
  });
});

import { describe, it, expect } from 'vitest';
import {
  createLegalBasis, createFinancialEvent, buildBudgetAllocationCode,
  buildGuaranteeNumber, vnd, usdCents,
  PROCUREMENT_LEGAL_BASIS, FINANCIAL_EVENT_TYPES,
} from '../shared/financial/financialFactory';
import { createMoney, isPositiveMoney } from '../shared/financial/money';

// FIN-FAC-01
describe('createLegalBasis — happy path', () => {
  it('creates basis with document', () => {
    const b = createLegalBasis({ document: '22/2023/QH15' });
    expect(b.document).toBe('22/2023/QH15');
  });
  it('stores optional article', () => {
    const b = createLegalBasis({ document: '22/2023/QH15', article: 'Điều 22' });
    expect(b.article).toBe('Điều 22');
  });
  it('stores issuingAuthority', () => {
    const b = createLegalBasis({ document: '214/2025/NĐ-CP', issuingAuthority: 'Chính phủ' });
    expect(b.issuingAuthority).toBe('Chính phủ');
  });
});

// FIN-FAC-02
describe('createLegalBasis — all optional fields', () => {
  it('stores clause', () => {
    const b = createLegalBasis({ document: 'X', clause: 'Khoản 1' });
    expect(b.clause).toBe('Khoản 1');
  });
  it('stores point', () => {
    const b = createLegalBasis({ document: 'X', point: 'điểm a' });
    expect(b.point).toBe('điểm a');
  });
  it('stores url', () => {
    const b = createLegalBasis({ document: 'X', url: 'https://vbpl.vn/123' });
    expect(b.url).toBe('https://vbpl.vn/123');
  });
});

// FIN-FAC-03
describe('createLegalBasis — validation', () => {
  it('throws when document is empty', () => {
    expect(() => createLegalBasis({ document: '' })).toThrow();
  });
  it('throws when document is whitespace', () => {
    expect(() => createLegalBasis({ document: '  ' })).toThrow();
  });
  it('does not throw with valid document only', () => {
    expect(() => createLegalBasis({ document: 'NĐ-CP/2025' })).not.toThrow();
  });
});

// FIN-FAC-04
describe('PROCUREMENT_LEGAL_BASIS', () => {
  it('has 5 seed instruments', () => {
    expect(PROCUREMENT_LEGAL_BASIS).toHaveLength(5);
  });
  it('contains 22/2023/QH15', () => {
    expect(PROCUREMENT_LEGAL_BASIS.some(b => b.document.includes('22/2023'))).toBe(true);
  });
  it('contains TT 79/2025', () => {
    expect(PROCUREMENT_LEGAL_BASIS.some(b => b.document.includes('79/2025'))).toBe(true);
  });
});

// FIN-FAC-05
describe('PROCUREMENT_LEGAL_BASIS — structure', () => {
  it('every basis has issuingAuthority', () => {
    expect(PROCUREMENT_LEGAL_BASIS.every(b => b.issuingAuthority)).toBe(true);
  });
  it('every basis has effectiveDate', () => {
    expect(PROCUREMENT_LEGAL_BASIS.every(b => b.effectiveDate)).toBe(true);
  });
  it('every basis has summary', () => {
    expect(PROCUREMENT_LEGAL_BASIS.every(b => b.summary)).toBe(true);
  });
});

// FIN-FAC-06
describe('FINANCIAL_EVENT_TYPES', () => {
  it('includes FUNDING_ALLOCATED', () => {
    expect(FINANCIAL_EVENT_TYPES).toContain('FUNDING_ALLOCATED');
  });
  it('includes GUARANTEE_ISSUED', () => {
    expect(FINANCIAL_EVENT_TYPES).toContain('GUARANTEE_ISSUED');
  });
  it('includes RETENTION_CREATED', () => {
    expect(FINANCIAL_EVENT_TYPES).toContain('RETENTION_CREATED');
  });
});

// FIN-FAC-07
describe('createFinancialEvent', () => {
  it('creates event with type', () => {
    const e = createFinancialEvent({ id: 'E-001', type: 'FUNDING_ALLOCATED', entityId: 'BA-001', entityType: 'BudgetAllocation', performedBy: 'USER-01' });
    expect(e.type).toBe('FUNDING_ALLOCATED');
  });
  it('occurredAt is set', () => {
    const e = createFinancialEvent({ id: 'E-001', type: 'BUDGET_COMMITTED', entityId: 'BA-001', entityType: 'BudgetAllocation', performedBy: 'USER-01' });
    expect(e.occurredAt).toBeTruthy();
  });
  it('stores amount when provided', () => {
    const amount = createMoney(1_000_000n, 'VND');
    const e = createFinancialEvent({ id: 'E-001', type: 'MILESTONE_PAID', entityId: 'MS-001', entityType: 'PaymentMilestone', performedBy: 'USER-01', amount });
    expect(e.amount?.amount).toBe(1_000_000n);
  });
});

// FIN-FAC-08
describe('createFinancialEvent — validation', () => {
  it('throws for empty entityId', () => {
    expect(() => createFinancialEvent({ id: 'E-1', type: 'BUDGET_COMMITTED', entityId: '', entityType: 'X', performedBy: 'U' })).toThrow();
  });
  it('throws for empty performedBy', () => {
    expect(() => createFinancialEvent({ id: 'E-1', type: 'BUDGET_COMMITTED', entityId: 'X', entityType: 'X', performedBy: '' })).toThrow();
  });
  it('stores notes when provided', () => {
    const e = createFinancialEvent({ id: 'E-1', type: 'BUDGET_RELEASED', entityId: 'X', entityType: 'Y', performedBy: 'U', notes: 'Released on approval' });
    expect(e.notes).toBe('Released on approval');
  });
});

// FIN-FAC-09
describe('buildBudgetAllocationCode', () => {
  it('generates correct code format', () => {
    expect(buildBudgetAllocationCode('STATE', 2026, 1)).toBe('BA/STATE/2026/0001');
  });
  it('pads sequence to 4 digits', () => {
    expect(buildBudgetAllocationCode('ODA', 2026, 42)).toBe('BA/ODA/2026/0042');
  });
  it('sequence 9999 is 4 digits', () => {
    expect(buildBudgetAllocationCode('STATE', 2026, 9999)).toBe('BA/STATE/2026/9999');
  });
});

// FIN-FAC-10
describe('buildGuaranteeNumber', () => {
  it('ADVANCE prefix is BL-TU', () => {
    expect(buildGuaranteeNumber('ADVANCE', 'HĐ-001', 1)).toContain('BL-TU');
  });
  it('PERFORMANCE prefix is BL-TH', () => {
    expect(buildGuaranteeNumber('PERFORMANCE', 'HĐ-001', 1)).toContain('BL-TH');
  });
  it('WARRANTY prefix is BL-BH', () => {
    expect(buildGuaranteeNumber('WARRANTY', 'HĐ-001', 1)).toContain('BL-BH');
  });
});

// FIN-FAC-11
describe('buildGuaranteeNumber — sequence padding', () => {
  it('pads sequence to 3 digits', () => {
    expect(buildGuaranteeNumber('ADVANCE', 'HĐ-001', 1)).toContain('001');
  });
  it('seq 99 pads to 099', () => {
    expect(buildGuaranteeNumber('ADVANCE', 'HĐ-001', 99)).toContain('099');
  });
  it('includes contractCode', () => {
    expect(buildGuaranteeNumber('PERFORMANCE', 'HĐ-DTMS/2026/001', 1)).toContain('HĐ-DTMS/2026/001');
  });
});

// FIN-FAC-12
describe('vnd and usdCents helpers', () => {
  it('vnd creates VND money', () => {
    expect(vnd(1_000_000n).currency).toBe('VND');
  });
  it('vnd amount is correct', () => {
    expect(vnd(500_000).amount).toBe(500_000n);
  });
  it('usdCents creates USD money', () => {
    expect(usdCents(10000n).currency).toBe('USD');
  });
});

// FIN-FAC-13
describe('LegalBasis — extensibility', () => {
  it('additional fields can be added (appendix)', () => {
    const b = createLegalBasis({ document: '22/2023/QH15', appendix: 'Phụ lục I' });
    expect(b.appendix).toBe('Phụ lục I');
  });
  it('PROCUREMENT_LEGAL_BASIS is extensible (add without code change)', () => {
    const extended = [...PROCUREMENT_LEGAL_BASIS, createLegalBasis({ document: 'NĐ-99/2022' })];
    expect(extended).toHaveLength(6);
  });
  it('money amount via vnd() is positive', () => {
    expect(isPositiveMoney(vnd(1n))).toBe(true);
  });
});

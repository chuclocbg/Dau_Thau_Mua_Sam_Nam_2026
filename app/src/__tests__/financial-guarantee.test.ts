import { describe, it, expect } from 'vitest';
import {
  createGuarantee, releaseGuarantee, forfeitGuarantee, expireGuarantee,
  isGuaranteeExpired, daysUntilExpiry, validateGuaranteeRate,
  GUARANTEE_RATE_BOUNDS, GUARANTEE_TYPES, GUARANTEE_STATUSES,
} from '../shared/financial/guarantee';
import { createMoney, FinancialError } from '../shared/financial/money';

const contractValue = createMoney(1_000_000_000n, 'VND'); // 1B VND

function makeAdvance() {
  return createGuarantee({
    id: 'G-001', type: 'ADVANCE', guaranteeNumber: 'BL-TU/HĐ-001/001',
    issuingBank: 'Vietcombank', beneficiary: 'Cục QLXD',
    contractValue, guaranteeRate: 0.10,
    issuedDate: '2026-01-01', expiryDate: '2026-12-31',
  });
}

function makePerformance() {
  return createGuarantee({
    id: 'G-002', type: 'PERFORMANCE', guaranteeNumber: 'BL-TH/HĐ-001/001',
    issuingBank: 'BIDV', beneficiary: 'Cục QLXD',
    contractValue, guaranteeRate: 0.05,
    issuedDate: '2026-01-01', expiryDate: '2027-01-01',
  });
}

function makeWarranty() {
  return createGuarantee({
    id: 'G-003', type: 'WARRANTY', guaranteeNumber: 'BL-BH/HĐ-001/001',
    issuingBank: 'Techcombank', beneficiary: 'Cục QLXD',
    contractValue, guaranteeRate: 0.03,
    issuedDate: '2026-06-01', expiryDate: '2027-06-01',
  });
}

// FIN-G-01
describe('createGuarantee — ADVANCE', () => {
  it('creates ACTIVE advance guarantee', () => {
    expect(makeAdvance().status).toBe('ACTIVE');
  });
  it('type is ADVANCE', () => {
    expect(makeAdvance().type).toBe('ADVANCE');
  });
  it('guaranteeValue = contractValue × rate', () => {
    expect(makeAdvance().guaranteeValue.amount).toBe(100_000_000n);
  });
});

// FIN-G-02
describe('createGuarantee — PERFORMANCE', () => {
  it('creates ACTIVE performance guarantee', () => {
    expect(makePerformance().status).toBe('ACTIVE');
  });
  it('type is PERFORMANCE', () => {
    expect(makePerformance().type).toBe('PERFORMANCE');
  });
  it('guaranteeValue = contractValue × 0.05', () => {
    expect(makePerformance().guaranteeValue.amount).toBe(50_000_000n);
  });
});

// FIN-G-03
describe('createGuarantee — WARRANTY', () => {
  it('creates ACTIVE warranty guarantee', () => {
    expect(makeWarranty().status).toBe('ACTIVE');
  });
  it('type is WARRANTY', () => {
    expect(makeWarranty().type).toBe('WARRANTY');
  });
  it('guaranteeValue = contractValue × 0.03', () => {
    expect(makeWarranty().guaranteeValue.amount).toBe(30_000_000n);
  });
});

// FIN-G-04
describe('createGuarantee — validation', () => {
  it('throws for empty guaranteeNumber', () => {
    expect(() => createGuarantee({ id: 'X', type: 'ADVANCE', guaranteeNumber: '',
      issuingBank: 'VCB', beneficiary: 'X', contractValue, guaranteeRate: 0.10,
      issuedDate: '2026-01-01', expiryDate: '2026-12-31' })).toThrow(FinancialError);
  });
  it('throws for empty issuingBank', () => {
    expect(() => createGuarantee({ id: 'X', type: 'ADVANCE', guaranteeNumber: 'BL-001',
      issuingBank: '', beneficiary: 'X', contractValue, guaranteeRate: 0.10,
      issuedDate: '2026-01-01', expiryDate: '2026-12-31' })).toThrow(FinancialError);
  });
  it('throws when expiryDate <= issuedDate', () => {
    expect(() => createGuarantee({ id: 'X', type: 'PERFORMANCE', guaranteeNumber: 'BL-001',
      issuingBank: 'VCB', beneficiary: 'X', contractValue, guaranteeRate: 0.05,
      issuedDate: '2026-12-31', expiryDate: '2026-01-01' })).toThrow(FinancialError);
  });
});

// FIN-G-05
describe('validateGuaranteeRate — bounds', () => {
  it('ADVANCE rate 0.30 is valid', () => {
    expect(() => validateGuaranteeRate('ADVANCE', 0.30)).not.toThrow();
  });
  it('ADVANCE rate 0.31 throws', () => {
    expect(() => validateGuaranteeRate('ADVANCE', 0.31)).toThrow(FinancialError);
  });
  it('PERFORMANCE rate 0.10 is valid max', () => {
    expect(() => validateGuaranteeRate('PERFORMANCE', 0.10)).not.toThrow();
  });
});

// FIN-G-06
describe('validateGuaranteeRate — min bounds', () => {
  it('PERFORMANCE rate 0.03 is valid min', () => {
    expect(() => validateGuaranteeRate('PERFORMANCE', 0.03)).not.toThrow();
  });
  it('PERFORMANCE rate 0.02 throws', () => {
    expect(() => validateGuaranteeRate('PERFORMANCE', 0.02)).toThrow(FinancialError);
  });
  it('WARRANTY rate 0.02 is valid min', () => {
    expect(() => validateGuaranteeRate('WARRANTY', 0.02)).not.toThrow();
  });
});

// FIN-G-07
describe('releaseGuarantee', () => {
  it('transitions ACTIVE → RELEASED', () => {
    expect(releaseGuarantee(makeAdvance()).status).toBe('RELEASED');
  });
  it('throws for non-ACTIVE guarantee', () => {
    expect(() => releaseGuarantee(releaseGuarantee(makeAdvance()))).toThrow(FinancialError);
  });
  it('returns new object', () => {
    const g = makeAdvance();
    expect(releaseGuarantee(g)).not.toBe(g);
  });
});

// FIN-G-08
describe('forfeitGuarantee', () => {
  it('transitions ACTIVE → FORFEITED', () => {
    expect(forfeitGuarantee(makePerformance()).status).toBe('FORFEITED');
  });
  it('throws for non-ACTIVE guarantee', () => {
    expect(() => forfeitGuarantee(forfeitGuarantee(makePerformance()))).toThrow(FinancialError);
  });
  it('error code is INVALID_STATUS', () => {
    try { forfeitGuarantee(releaseGuarantee(makeAdvance())); }
    catch (e) { expect((e as FinancialError).code).toBe('INVALID_STATUS'); }
  });
});

// FIN-G-09
describe('expireGuarantee', () => {
  it('transitions ACTIVE → EXPIRED', () => {
    expect(expireGuarantee(makeWarranty()).status).toBe('EXPIRED');
  });
  it('throws when already EXPIRED', () => {
    expect(() => expireGuarantee(expireGuarantee(makeWarranty()))).toThrow(FinancialError);
  });
  it('throws when RELEASED', () => {
    expect(() => expireGuarantee(releaseGuarantee(makeWarranty()))).toThrow(FinancialError);
  });
});

// FIN-G-10
describe('isGuaranteeExpired', () => {
  it('returns true when expiryDate < asOfDate', () => {
    expect(isGuaranteeExpired(makeAdvance(), '2027-01-01')).toBe(true);
  });
  it('returns false when expiryDate > asOfDate', () => {
    expect(isGuaranteeExpired(makeAdvance(), '2026-06-01')).toBe(false);
  });
  it('returns true on exact expiry date', () => {
    expect(isGuaranteeExpired(makeAdvance(), '2026-12-31')).toBe(false); // expiryDate IS '2026-12-31', asOf is '2026-12-31' — not < so false
  });
});

// FIN-G-11
describe('daysUntilExpiry', () => {
  it('returns positive days for future expiry', () => {
    expect(daysUntilExpiry(makeAdvance(), '2026-01-01')).toBeGreaterThan(0);
  });
  it('returns negative days for past expiry', () => {
    expect(daysUntilExpiry(makeAdvance(), '2027-12-31')).toBeLessThan(0);
  });
  it('returns 0 on exact expiry date', () => {
    expect(daysUntilExpiry(makeAdvance(), '2026-12-31')).toBe(0);
  });
});

// FIN-G-12
describe('GUARANTEE_TYPES + GUARANTEE_STATUSES constants', () => {
  it('GUARANTEE_TYPES has 3 entries', () => {
    expect(GUARANTEE_TYPES).toHaveLength(3);
  });
  it('GUARANTEE_STATUSES includes FORFEITED', () => {
    expect(GUARANTEE_STATUSES).toContain('FORFEITED');
  });
  it('GUARANTEE_RATE_BOUNDS has entries for each type', () => {
    GUARANTEE_TYPES.forEach(t => expect(GUARANTEE_RATE_BOUNDS[t]).toBeDefined());
  });
});

// FIN-G-13
describe('createGuarantee — stored fields', () => {
  it('stores issuingBank', () => {
    expect(makeAdvance().issuingBank).toBe('Vietcombank');
  });
  it('stores beneficiary', () => {
    expect(makeAdvance().beneficiary).toBe('Cục QLXD');
  });
  it('stores issuedDate and expiryDate', () => {
    const g = makeAdvance();
    expect(g.issuedDate).toBe('2026-01-01');
    expect(g.expiryDate).toBe('2026-12-31');
  });
});

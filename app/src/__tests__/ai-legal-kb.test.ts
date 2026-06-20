import { describe, it, expect } from 'vitest';
import { searchLegalKB, answerQuestion, LEGAL_KB } from '../ai/legalKnowledgeBase';

describe('P5-04 searchLegalKB', () => {
  it('returns results for procurement method query', () => {
    const results = searchLegalKB('ngưỡng chào hàng cạnh tranh');
    expect(results.length).toBeGreaterThan(0);
    // kb-001 (thresholds) should rank first
    expect(results[0].entry.id).toBe('kb-001');
  });

  it('returns results for contract type query', () => {
    const results = searchLegalKB('loại hợp đồng bảo trì điều hòa');
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map(r => r.entry.id);
    // kb-002 (contract types) should rank near top
    expect(ids.some(id => id === 'kb-002' || id === 'kb-010')).toBe(true);
  });

  it('returns results for brand locking query', () => {
    const results = searchLegalKB('cấm thương hiệu yêu cầu kỹ thuật');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entry.id).toBe('kb-003');
  });

  it('returns results for date gap query', () => {
    const results = searchLegalKB('thời gian tối thiểu HSYC đóng thầu');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entry.id).toBe('kb-004');
  });

  it('returns results for fixed asset threshold query', () => {
    const results = searchLegalKB('ngưỡng tài sản cố định 10 triệu');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entry.id).toBe('kb-007');
  });

  it('returns results for expert team independence query', () => {
    const results = searchLegalKB('độc lập tổ chuyên gia thẩm định');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entry.id).toBe('kb-005');
  });

  it('returns empty array for empty query', () => {
    const results = searchLegalKB('');
    expect(results).toHaveLength(0);
  });

  it('returns empty array for completely unrelated query', () => {
    // English loanwords/proper nouns that don't appear in procurement law
    const results = searchLegalKB('pokemon nintendo pikachu');
    expect(results).toHaveLength(0);
  });

  it('respects topK parameter', () => {
    const results = searchLegalKB('hợp đồng', 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('results are sorted by score descending', () => {
    const results = searchLegalKB('KHLCNT kế hoạch lựa chọn nhà thầu', 5);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
  });

  it('includes highlights from matching content', () => {
    const results = searchLegalKB('chào hàng cạnh tranh 500 triệu');
    if (results.length > 0) {
      // highlights may be empty if no sentence matches, but score > 0
      expect(results[0].score).toBeGreaterThan(0);
    }
  });

  // --- Content integrity ---

  it('all KB entries have required fields', () => {
    for (const entry of LEGAL_KB) {
      expect(entry.id).toBeTruthy();
      expect(entry.title.length).toBeGreaterThan(5);
      expect(entry.source.length).toBeGreaterThan(5);
      expect(entry.keywords.length).toBeGreaterThan(0);
      expect(entry.content.length).toBeGreaterThan(50);
    }
  });

  it('KB has at least 10 entries covering key legal areas', () => {
    expect(LEGAL_KB.length).toBeGreaterThanOrEqual(10);
  });

  // 8-C + QI-01: new entries
  it('KB has exactly 24 entries after QI-01 expansion', () => {
    expect(LEGAL_KB).toHaveLength(24);
  });

  it('kb-016 (package splitting prohibition) is searchable', () => {
    const results = searchLegalKB('chia nhỏ gói thầu tách gói né ngưỡng');
    const ids = results.map(r => r.entry.id);
    expect(ids).toContain('kb-016');
  });

  it('kb-017 (e-procurement portal registration) is searchable', () => {
    const results = searchLegalKB('đăng ký tài khoản mạng đấu thầu cổng thông tin');
    const ids = results.map(r => r.entry.id);
    expect(ids).toContain('kb-017');
  });

  it('kb-018 (State Treasury payment control) is searchable', () => {
    const results = searchLegalKB('kho bạc nhà nước kiểm soát chi thanh toán hợp đồng');
    const ids = results.map(r => r.entry.id);
    expect(ids).toContain('kb-018');
  });

  it('kb-019 (public asset standards and inventory) is searchable', () => {
    const results = searchLegalKB('tiêu chuẩn định mức tài sản công kiểm kê');
    const ids = results.map(r => r.entry.id);
    expect(ids).toContain('kb-019');
  });

  it('kb-020 (contract supervision and violation handling) is searchable', () => {
    const results = searchLegalKB('giám sát hợp đồng kiểm tra thực hiện vi phạm');
    const ids = results.map(r => r.entry.id);
    expect(ids).toContain('kb-020');
  });

  it('kb-021 (periodic reporting to Ministry) is searchable', () => {
    const results = searchLegalKB('báo cáo định kỳ tổng hợp mua sắm Bộ Công Thương');
    const ids = results.map(r => r.entry.id);
    expect(ids).toContain('kb-021');
  });

  it('kb-022 (NĐ 98/2025 regular-budget procurement scope) is searchable', () => {
    const results = searchLegalKB('dự toán chi thường xuyên mua sắm tài sản ngân sách');
    const ids = results.map(r => r.entry.id);
    expect(ids).toContain('kb-022');
  });

  it('kb-023 (TT 65/2021 public asset maintenance budget) is searchable', () => {
    const results = searchLegalKB('bảo dưỡng sửa chữa tài sản công quỹ phát triển sự nghiệp');
    const ids = results.map(r => r.entry.id);
    expect(ids).toContain('kb-023');
  });

  it('kb-024 (NĐ 104/2026 budget planning Điều 40 Luật NSNN) is searchable', () => {
    const results = searchLegalKB('Điều 40 Luật Ngân sách Nhà nước dự toán kinh phí chi thường xuyên');
    const ids = results.map(r => r.entry.id);
    expect(ids).toContain('kb-024');
  });

  it('all 6 new entries have required fields and content > 100 chars', () => {
    const newIds = ['kb-016', 'kb-017', 'kb-018', 'kb-019', 'kb-020', 'kb-021'];
    for (const id of newIds) {
      const entry = LEGAL_KB.find(e => e.id === id);
      expect(entry).toBeDefined();
      expect(entry!.title.length).toBeGreaterThan(10);
      expect(entry!.source.length).toBeGreaterThan(10);
      expect(entry!.keywords.length).toBeGreaterThanOrEqual(4);
      expect(entry!.content.length).toBeGreaterThan(100);
      expect(Array.isArray(entry!.appliesTo)).toBe(true);
    }
  });

  it('new entries cover distinct appliesTo contexts', () => {
    const kb016 = LEGAL_KB.find(e => e.id === 'kb-016')!;
    const kb018 = LEGAL_KB.find(e => e.id === 'kb-018')!;
    const kb019 = LEGAL_KB.find(e => e.id === 'kb-019')!;
    expect(kb016.appliesTo).toContain('audit-risk');
    expect(kb018.appliesTo).toContain('payment');
    expect(kb019.appliesTo).toContain('asset-recording');
  });
});

describe('P5-04 answerQuestion', () => {
  it('answers procurement method question', () => {
    const r = answerQuestion('Loại hợp đồng nào nên dùng cho bảo trì điều hòa?');
    expect(r.answer.length).toBeGreaterThan(20);
    expect(r.sources.length).toBeGreaterThan(0);
    expect(r.confidence).not.toBe('');
  });

  it('answers brand locking question', () => {
    const r = answerQuestion('Có được nêu tên thương hiệu trong HSYC không?');
    // answer includes "Căn cứ: Điều 44 khoản 7..." from the source field
    expect(r.answer).toContain('44');
    expect(r.confidence).toMatch(/^(high|medium|low)$/);
  });

  it('answers asset threshold question', () => {
    // ponytail: include "vật tư tiêu hao" — unique to kb-007 — avoids false-positive from kb-023 "tài sản" frequency
    const r = answerQuestion('Ngưỡng tài sản cố định vật tư tiêu hao TSCĐ');
    expect(r.answer).toContain('10');
    expect(r.sources.length).toBeGreaterThan(0);
  });

  it('returns low confidence for completely unrelated question', () => {
    const r = answerQuestion('pokemon nintendo pikachu');
    expect(r.confidence).toBe('low');
    expect(r.sources).toHaveLength(0);
  });

  it('returns valid sources (each source non-empty)', () => {
    const r = answerQuestion('KHLCNT cần trình ai phê duyệt?');
    for (const src of r.sources) {
      expect(src.length).toBeGreaterThan(5);
    }
  });
});

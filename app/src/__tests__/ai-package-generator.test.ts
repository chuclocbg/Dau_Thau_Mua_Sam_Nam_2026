import { describe, it, expect } from 'vitest';
import { generatePackageSuggestion } from '../ai/packageGenerator';

describe('P5-01 generatePackageSuggestion', () => {
  // --- Category detection ---

  it('detects computers (Vietnamese) → goods_fixed_asset + lump_sum', () => {
    const s = generatePackageSuggestion('20 máy tính để bàn phục vụ thực hành');
    expect(s.packageType).toBe('goods_fixed_asset');
    expect(s.contractType).toBe('lump_sum');
    expect(s.confidence).not.toBe('low');
    expect(s.detectedCategory).toContain('Máy tính');
  });

  it('detects computers (English) → goods_fixed_asset', () => {
    const s = generatePackageSuggestion('20 desktop computers for practical training');
    expect(s.packageType).toBe('goods_fixed_asset');
  });

  it('detects AC maintenance → service + unit_price', () => {
    const s = generatePackageSuggestion('bảo trì 80 điều hòa không khí phòng học');
    expect(s.packageType).toBe('service');
    expect(s.contractType).toBe('unit_price');
  });

  it('detects chemicals → goods_consumable', () => {
    const s = generatePackageSuggestion('hóa chất thí nghiệm cho phòng thực hành hóa');
    expect(s.packageType).toBe('goods_consumable');
    expect(s.contractType).toBe('lump_sum');
  });

  it('detects stationery → goods_consumable', () => {
    const s = generatePackageSuggestion('văn phòng phẩm cho học kỳ 1');
    expect(s.packageType).toBe('goods_consumable');
  });

  it('detects lab equipment → goods_fixed_asset', () => {
    const s = generatePackageSuggestion('mua thiết bị thí nghiệm phòng thực hành cơ khí');
    expect(s.packageType).toBe('goods_fixed_asset');
    expect(s.estimatedTotal).toBeGreaterThan(0);
  });

  it('detects new AC purchase (not maintenance) → goods_fixed_asset', () => {
    const s = generatePackageSuggestion('5 điều hòa không khí cho phòng học mới');
    expect(s.packageType).toBe('goods_fixed_asset');
    expect(s.contractType).toBe('lump_sum');
  });

  it('detects networking equipment → goods_fixed_asset', () => {
    const s = generatePackageSuggestion('2 switch mạng 24 cổng cho phòng thực hành');
    expect(s.packageType).toBe('goods_fixed_asset');
  });

  it('detects software license → service', () => {
    const s = generatePackageSuggestion('mua bản quyền phần mềm thiết kế đồ họa');
    expect(s.packageType).toBe('service');
  });

  // --- Quantity extraction ---

  it('extracts quantity from text', () => {
    const s = generatePackageSuggestion('15 máy tính xách tay laptop');
    // estimated = 15 × 20_000_000 = 300_000_000
    expect(s.estimatedTotal).toBe(15 * 20_000_000);
  });

  it('defaults to quantity 1 when no number found', () => {
    const s = generatePackageSuggestion('máy in laser');
    expect(s.estimatedTotal).toBe(1 * 8_000_000);
  });

  // --- Procurement method hints ---

  it('suggests DIRECT_50 for small value', () => {
    // 1 × 150_000 (stationery) = 150_000 < 50M
    const s = generatePackageSuggestion('văn phòng phẩm');
    expect(s.procurementMethodHint).toContain('DIRECT_50');
  });

  it('suggests COMPETITIVE_SHOPPING for mid-range value', () => {
    // 20 × 20_000_000 = 400_000_000: DIRECT_SELECTION_SIMPLIFIED
    // Need to reach 500M–5B: 30 × 20M = 600M
    const s = generatePackageSuggestion('30 máy tính để bàn');
    expect(s.procurementMethodHint).toContain('COMPETITIVE_SHOPPING');
  });

  it('suggests OPEN_BIDDING for large value', () => {
    // 300 × 20_000_000 = 6_000_000_000 > 5B
    const s = generatePackageSuggestion('300 máy tính để bàn');
    expect(s.procurementMethodHint).toContain('OPEN_BIDDING');
  });

  // --- Funding source inference ---

  it('defaults to autonomy_fund for training equipment', () => {
    const s = generatePackageSuggestion('5 điều hòa không khí');
    expect(s.fundingSource).toBe('autonomy_fund');
  });

  it('detects state_budget keyword', () => {
    const s = generatePackageSuggestion('mua thiết bị từ ngân sách nhà nước');
    expect(s.fundingSource).toBe('state_budget');
  });

  // --- Audit notes ---

  it('adds CRITICAL note for >5B packages', () => {
    const s = generatePackageSuggestion('300 máy tính để bàn');
    const hasCritical = s.notes.some(n => n.includes('[CRITICAL]'));
    expect(hasCritical).toBe(true);
  });

  it('adds HIGH note for 500M–5B packages', () => {
    // 30 × 20M = 600M → [HIGH]
    const s = generatePackageSuggestion('30 máy tính để bàn');
    const hasHigh = s.notes.some(n => n.includes('[HIGH]'));
    expect(hasHigh).toBe(true);
  });

  it('adds unit_price note for service packages', () => {
    const s = generatePackageSuggestion('bảo trì điều hòa');
    const hasNote = s.notes.some(n => n.includes('unit_price') || n.includes('đơn giá'));
    expect(hasNote).toBe(true);
  });

  // --- Confidence levels ---

  it('returns high confidence for specific multi-keyword match', () => {
    const s = generatePackageSuggestion('bảo trì bảo dưỡng điều hòa không khí nạp gas');
    expect(s.confidence).toBe('high');
  });

  it('returns low confidence for empty input', () => {
    const s = generatePackageSuggestion('');
    expect(s.confidence).toBe('low');
    expect(s.packageName).toBe('');
  });

  it('returns low confidence for unknown input', () => {
    const s = generatePackageSuggestion('xyzzy không rõ loại hàng');
    expect(s.confidence).toBe('low');
  });

  // --- Package name generation ---

  it('generates a valid non-empty packageName', () => {
    const s = generatePackageSuggestion('10 máy tính để bàn');
    expect(s.packageName.length).toBeGreaterThan(0);
    expect(s.packageName).toContain('10');
  });

  it('generates packageCode with budget year', () => {
    const s = generatePackageSuggestion('5 máy chiếu', 2027);
    expect(s.packageCode).toContain('2027');
  });

  // --- Contract duration ---

  it('sets sensible default duration for computers', () => {
    const s = generatePackageSuggestion('máy tính');
    expect(s.contractDurationDays).toBeGreaterThan(0);
  });

  it('sets longer duration for service contracts', () => {
    const sSvc = generatePackageSuggestion('dịch vụ vệ sinh môi trường');
    const sGoods = generatePackageSuggestion('máy in');
    expect(sSvc.contractDurationDays).toBeGreaterThan(sGoods.contractDurationDays);
  });
});

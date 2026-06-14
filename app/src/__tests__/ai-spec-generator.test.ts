import { describe, it, expect } from 'vitest';
import { generateItemSpec, detectBrandLocking } from '../ai/specGenerator';

describe('P5-02 generateItemSpec', () => {
  // --- Template matching ---

  it('generates spec for desktop computer', () => {
    const r = generateItemSpec('Máy tính để bàn');
    expect(r.specs.length).toBeGreaterThan(50);
    expect(r.specs).toContain('CPU');
    expect(r.specs).toContain('RAM');
    expect(r.specs).toContain('SSD');
  });

  it('generates spec for laptop', () => {
    const r = generateItemSpec('Máy tính xách tay laptop');
    expect(r.specs).toContain('RAM');
    expect(r.specs.toLowerCase()).toContain('pin');
  });

  it('generates spec for projector', () => {
    const r = generateItemSpec('Máy chiếu giảng dạy');
    expect(r.specs).toContain('Lumen');
  });

  it('generates spec for network switch', () => {
    const r = generateItemSpec('Switch mạng 24 cổng');
    expect(r.specs).toContain('Gbps');
  });

  it('generates spec for chemicals', () => {
    const r = generateItemSpec('Hóa chất thí nghiệm');
    expect(r.specs).toContain('COA');
  });

  it('generates spec for stationery', () => {
    const r = generateItemSpec('Giấy in A4 văn phòng phẩm');
    expect(r.specs).toContain('gsm');
  });

  it('generates spec for air conditioner', () => {
    const r = generateItemSpec('Điều hòa không khí');
    expect(r.specs).toContain('BTU');
  });

  it('returns generic spec for unknown item', () => {
    const r = generateItemSpec('Dụng cụ đặc biệt không xác định loại');
    expect(r.specs.length).toBeGreaterThan(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  // --- Brand detection in item name ---

  it('detects NVIDIA brand in item name', () => {
    const r = generateItemSpec('Card đồ họa NVIDIA GTX 1650');
    expect(r.detectedBrands.length).toBeGreaterThan(0);
    expect(r.warnings.some(w => w.includes('[HIGH]'))).toBe(true);
    expect(r.warnings.some(w => w.includes('Điều 44'))).toBe(true);
  });

  it('detects Panasonic brand in existing specs', () => {
    const r = generateItemSpec('Điều hòa', 'Lốc nén chính hãng Panasonic Nhật Bản');
    expect(r.detectedBrands).toContain('Panasonic');
    expect(r.warnings.some(w => w.includes('[HIGH]'))).toBe(true);
  });

  it('detects Merck brand in chemical specs', () => {
    const r = generateItemSpec('Hóa chất', 'sản xuất bởi Merck (Đức) hoặc Sigma-Aldrich');
    expect(r.detectedBrands.length).toBeGreaterThan(0);
  });

  it('detects Double A brand in stationery', () => {
    const r = generateItemSpec('Giấy in Double A 70 gsm');
    expect(r.detectedBrands.length).toBeGreaterThan(0);
  });

  it('detects GTX (product code) in spec', () => {
    const r = generateItemSpec('Card đồ họa', 'GTX 1650 hoặc tương đương');
    expect(r.detectedBrands.length).toBeGreaterThan(0);
  });

  // --- Clean spec has no brand warnings ---

  it('clean spec — no brand warning', () => {
    const r = generateItemSpec('Máy tính để bàn', 'CPU ≥4 nhân, RAM ≥8 GB, SSD ≥256 GB');
    expect(r.detectedBrands.length).toBe(0);
    expect(r.warnings.every(w => !w.includes('[HIGH]'))).toBe(true);
  });

  // --- Equivalent-or-better clause ---

  it('generated spec contains equivalent-or-better clause', () => {
    const r = generateItemSpec('Máy tính để bàn');
    const hasEquiv =
      r.specs.includes('tương đương') ||
      r.specs.includes('equivalent or better') ||
      r.specs.includes('equivalent');
    expect(hasEquiv).toBe(true);
  });
});

describe('P5-02 detectBrandLocking', () => {
  it('returns empty array for clean specs', () => {
    const brands = detectBrandLocking('CPU ≥4 nhân, RAM ≥8 GB, bảo hành 24 tháng');
    expect(brands).toEqual([]);
  });

  it('detects HP brand', () => {
    const brands = detectBrandLocking('Máy in HP LaserJet');
    expect(brands.length).toBeGreaterThan(0);
  });

  it('detects Cisco brand', () => {
    const brands = detectBrandLocking('Switch Cisco Catalyst 2960');
    expect(brands.length).toBeGreaterThan(0);
  });
});

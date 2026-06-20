/**
 * P5-03: AI Legal Reviewer
 *
 * Rule-based scanner that detects audit risks in a ProcurementPackage.
 * Severity tags: [CRITICAL] / [HIGH] / [MEDIUM] / [LOW] per CLAUDE.md.
 *
 * Never fabricates legal references.
 * Reuses validateDateGaps() from utils.ts.
 */

import type { ProcurementPackage } from '../demoData';
import { validateDateGaps } from '../utils';
import { detectBrandLocking } from './specGenerator';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface LegalFinding {
  severity: Severity;
  code: string;       // e.g. LR-001
  category: string;   // e.g. 'brand-locking'
  field?: string;     // which field triggered this
  message: string;
  legalBasis: string; // legal citation
  recommendation: string;
}

export interface LegalReviewResult {
  findings: LegalFinding[];
  hasCritical: boolean;
  hasHigh: boolean;
  summary: string;
}

// ─── Individual check functions ───────────────────────────────────────────────

function checkBrandLocking(pkg: ProcurementPackage): LegalFinding[] {
  const findings: LegalFinding[] = [];
  for (const item of pkg.items) {
    const brands = detectBrandLocking(`${item.name} ${item.specs}`);
    if (brands.length > 0) {
      findings.push({
        severity: 'HIGH',
        code: 'LR-001',
        category: 'brand-locking',
        field: `items[${item.id}].specs`,
        message: `Mặt hàng "${item.name}" có tên thương hiệu trong yêu cầu kỹ thuật: ${brands.join(', ')}.`,
        legalBasis: 'Điều 44 khoản 7 Luật Đấu thầu 22/2023/QH15 — cấm hạn chế cạnh tranh bằng thương hiệu cụ thể.',
        recommendation: 'Thay bằng tiêu chí chức năng và ngưỡng tối thiểu. Dùng AI Spec Generator để gợi ý.',
      });
    }
  }
  return findings;
}

function checkContractType(pkg: ProcurementPackage): LegalFinding[] {
  const findings: LegalFinding[] = [];

  // Service packages with variable volume should not use lump_sum
  if (
    (pkg.packageType === 'service' || pkg.packageType === 'mixed') &&
    pkg.contractType === 'lump_sum'
  ) {
    findings.push({
      severity: 'HIGH',
      code: 'LR-002',
      category: 'contract-type',
      field: 'contractType',
      message: `Gói dịch vụ (packageType="${pkg.packageType}") đang dùng hợp đồng trọn gói (lump_sum). Nếu khối lượng dịch vụ không xác định được trước, hợp đồng trọn gói không phù hợp.`,
      legalBasis: 'Điều 62 Luật Đấu thầu 22/2023/QH15 — hợp đồng trọn gói chỉ áp dụng khi đã xác định rõ toàn bộ khối lượng công việc.',
      recommendation: 'Cân nhắc chuyển sang hợp đồng đơn giá (unit_price) nếu khối lượng biến động (ví dụ: bảo trì theo thực tế phát sinh).',
    });
  }

  // Goods packages should not use unit_price (unusual — warn at LOW)
  if (
    pkg.packageType === 'goods_fixed_asset' &&
    pkg.contractType === 'unit_price'
  ) {
    findings.push({
      severity: 'LOW',
      code: 'LR-003',
      category: 'contract-type',
      field: 'contractType',
      message: `Gói hàng hóa (goods_fixed_asset) dùng hợp đồng đơn giá. Hàng hóa mua sắm theo số lượng xác định thường dùng hợp đồng trọn gói.`,
      legalBasis: 'Điều 62 Luật Đấu thầu 22/2023/QH15.',
      recommendation: 'Kiểm tra lại có đúng là hàng hóa có số lượng biến động không. Nếu không, chuyển sang lump_sum.',
    });
  }

  return findings;
}

function checkMissingWarranty(pkg: ProcurementPackage): LegalFinding[] {
  const findings: LegalFinding[] = [];

  if (
    (pkg.packageType === 'goods_fixed_asset' || pkg.packageType === 'mixed') &&
    (!pkg.warrantyMonths || pkg.warrantyMonths <= 0)
  ) {
    findings.push({
      severity: 'MEDIUM',
      code: 'LR-004',
      category: 'missing-clause',
      field: 'warrantyMonths',
      message: 'Gói hàng hóa tài sản cố định chưa có điều khoản thời hạn bảo hành (warrantyMonths = 0 hoặc trống).',
      legalBasis: 'Điều 62 Luật Đấu thầu 22/2023/QH15 — hợp đồng phải quy định rõ bảo hành, bảo trì.',
      recommendation: 'Điền thời hạn bảo hành tối thiểu (ví dụ: 12 tháng cho thiết bị điện tử, 24 tháng cho máy móc lớn) trong field warrantyMonths.',
    });
  }

  return findings;
}

function checkDateGaps(pkg: ProcurementPackage): LegalFinding[] {
  const gapWarnings = validateDateGaps(pkg);
  return gapWarnings.map(msg => ({
    severity: 'HIGH' as Severity,
    code: 'LR-005',
    category: 'date-gap',
    message: msg,
    legalBasis: 'Điều 81 Nghị định 214/2025/NĐ-CP — khoảng cách thời gian tối thiểu giữa các bước quy trình LCNT.',
    recommendation: 'Điều chỉnh ngày tháng đảm bảo khoảng cách tối thiểu theo quy định.',
  }));
}

function checkPublicationObligations(pkg: ProcurementPackage): LegalFinding[] {
  const findings: LegalFinding[] = [];
  const methodTotal = pkg.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  // Packages ≥50M must publish KHLCNT on national e-procurement system (Điều 12 Luật ĐT 22/2023)
  if (methodTotal >= 50_000_000) {
    const hasPublishDate = (pkg as Record<string, unknown>)['datePublishKhlcnt'] as string | undefined;
    if (!hasPublishDate) {
      findings.push({
        severity: 'MEDIUM',
        code: 'LR-006',
        category: 'publication',
        message: 'Gói thầu có giá trị ≥50 triệu đồng: chưa ghi nhận ngày đăng tải KHLCNT lên hệ thống mạng đấu thầu quốc gia.',
        legalBasis: 'Điều 12 Luật Đấu thầu 22/2023/QH15; Thông tư 79/2025/TT-BTC — nghĩa vụ đăng tải thông tin.',
        recommendation: 'Điền ngày đăng tải vào field datePublishKhlcnt sau khi hoàn thành đăng tải.',
      });
    }
  }

  return findings;
}

function checkPackageValueVsMethod(pkg: ProcurementPackage): LegalFinding[] {
  const findings: LegalFinding[] = [];
  const total = pkg.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  // Import getProcurementMethod logic inline to avoid circular dependency
  let expectedCode: string;
  if (total <= 50_000_000) expectedCode = 'DIRECT_50';
  else if (total <= 500_000_000) expectedCode = 'DIRECT_SELECTION_SIMPLIFIED';
  else if (total <= 5_000_000_000) expectedCode = 'COMPETITIVE_SHOPPING';
  else expectedCode = 'OPEN_BIDDING';

  // If package name mentions a procurement method that contradicts value
  const nameLower = pkg.packageName.toLowerCase();
  const isOpenBiddingKeyword = nameLower.includes('đấu thầu rộng rãi');
  const isCompetitiveKeyword = nameLower.includes('chào hàng cạnh tranh');

  if (isOpenBiddingKeyword && expectedCode !== 'OPEN_BIDDING') {
    findings.push({
      severity: 'CRITICAL',
      code: 'LR-007',
      category: 'method-mismatch',
      field: 'packageName',
      message: `Tên gói thầu đề cập "đấu thầu rộng rãi" nhưng tổng giá trị ước tính (${total.toLocaleString('vi-VN')} VND) chưa đạt ngưỡng ĐTRR (>5 tỷ VND).`,
      legalBasis: 'Nghị định 214/2025/NĐ-CP về ngưỡng lựa chọn nhà thầu.',
      recommendation: 'Kiểm tra lại tổng giá trị và phương thức LCNT trước khi phê duyệt KHLCNT.',
    });
  }

  if (isCompetitiveKeyword && (expectedCode === 'DIRECT_50' || expectedCode === 'DIRECT_SELECTION_SIMPLIFIED')) {
    findings.push({
      severity: 'CRITICAL',
      code: 'LR-008',
      category: 'method-mismatch',
      field: 'packageName',
      message: `Tên gói thầu đề cập "chào hàng cạnh tranh" nhưng tổng giá trị ước tính (${total.toLocaleString('vi-VN')} VND) thấp hơn ngưỡng CHCT (500 triệu VND).`,
      legalBasis: 'Nghị định 214/2025/NĐ-CP Điều 24 về ngưỡng chào hàng cạnh tranh.',
      recommendation: 'Điều chỉnh phương thức LCNT cho phù hợp với giá trị thực tế.',
    });
  }

  return findings;
}

function checkMissingSupplierData(pkg: ProcurementPackage): LegalFinding[] {
  const findings: LegalFinding[] = [];
  const total = pkg.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  // For packages that need competitive shopping (≥500M), require 3 suppliers
  if (total >= 500_000_000) {
    if (!pkg.supplier2Name?.trim() || !pkg.supplier3Name?.trim()) {
      findings.push({
        severity: 'HIGH',
        code: 'LR-009',
        category: 'missing-data',
        field: 'supplier2Name / supplier3Name',
        message: 'Gói thầu cần chào hàng cạnh tranh (≥500 triệu) nhưng chưa đủ 3 nhà cung cấp báo giá.',
        legalBasis: 'Điều 24 Nghị định 214/2025/NĐ-CP — chào hàng cạnh tranh yêu cầu ít nhất 3 hồ sơ đề xuất.',
        recommendation: 'Điền đầy đủ thông tin 3 nhà cung cấp: tên, địa chỉ và báo giá.',
      });
    }
  }

  return findings;
}

function checkAssetRecording(pkg: ProcurementPackage): LegalFinding[] {
  const findings: LegalFinding[] = [];

  if (pkg.packageType === 'goods_fixed_asset' || pkg.packageType === 'mixed') {
    if (!pkg.dateAssetIncrease) {
      findings.push({
        severity: 'LOW',
        code: 'LR-010',
        category: 'asset-recording',
        field: 'dateAssetIncrease',
        message: 'Gói hàng hóa tài sản cố định chưa có ngày ghi tăng tài sản (dateAssetIncrease).',
        legalBasis: 'Thông tư 45/2018/TT-BTC về ghi tăng tài sản cố định vào sổ theo dõi.',
        recommendation: 'Điền ngày ghi tăng tài sản sau khi nghiệm thu và bàn giao cho đơn vị kế toán.',
      });
    }
  }

  return findings;
}

// ─── Main reviewer ─────────────────────────────────────────────────────────────

export function reviewPackage(pkg: ProcurementPackage): LegalReviewResult {
  const all: LegalFinding[] = [
    ...checkBrandLocking(pkg),
    ...checkContractType(pkg),
    ...checkMissingWarranty(pkg),
    ...checkDateGaps(pkg),
    ...checkPublicationObligations(pkg),
    ...checkPackageValueVsMethod(pkg),
    ...checkMissingSupplierData(pkg),
    ...checkAssetRecording(pkg),
  ];

  // Sort by severity: CRITICAL → HIGH → MEDIUM → LOW
  const severityOrder: Record<Severity, number> = {
    CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3,
  };
  all.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const hasCritical = all.some(f => f.severity === 'CRITICAL');
  const hasHigh = all.some(f => f.severity === 'HIGH');

  let summary: string;
  if (all.length === 0) {
    summary = 'Không phát hiện rủi ro pháp lý. Hồ sơ có thể xuất.';
  } else if (hasCritical) {
    const n = all.filter(f => f.severity === 'CRITICAL').length;
    summary = `[CRITICAL] Phát hiện ${n} vấn đề nghiêm trọng — KHÔNG nên xuất hồ sơ trước khi khắc phục.`;
  } else if (hasHigh) {
    const n = all.filter(f => f.severity === 'HIGH').length;
    summary = `[HIGH] Phát hiện ${n} vấn đề cần xử lý trước khi nộp hồ sơ thật.`;
  } else {
    summary = `Phát hiện ${all.length} gợi ý cải thiện (mức MEDIUM / LOW). Có thể xuất với lưu ý.`;
  }

  return { findings: all, hasCritical, hasHigh, summary };
}

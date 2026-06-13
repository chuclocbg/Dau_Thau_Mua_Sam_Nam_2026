import { ProcurementPackage } from './demoData';

// Returns gap-related audit warnings for a package's date sequence.
// Exported so tests can verify gap rules without rendering React.
export const validateDateGaps = (pkg: ProcurementPackage): string[] => {
  const errors: string[] = [];
  const daysBetween = (a: string, b: string): number =>
    Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

  // HSYC issued → bid close: ≥7 calendar days ≈ 5 working days (NĐ 214/2025 Art. 81)
  if (pkg.dateDocIssue && pkg.dateBidClose) {
    const gap = daysBetween(pkg.dateDocIssue, pkg.dateBidClose);
    if (gap < 7) {
      errors.push(
        `[⚠ AUDIT RISK] Phát hành HSYC (${pkg.dateDocIssue}) → Đóng thầu (${pkg.dateBidClose}) chỉ cách ${gap} ngày lịch. Yêu cầu tối thiểu ≥7 ngày lịch (≈5 ngày làm việc) theo Điều 81 NĐ 214/2025/NĐ-CP.`
      );
    }
  }

  // Evaluate and appraise must be on different days (independence requirement)
  if (pkg.dateEvaluate && pkg.dateAppraise) {
    const gap = daysBetween(pkg.dateEvaluate, pkg.dateAppraise);
    if (gap < 1) {
      errors.push(
        `[⚠ AUDIT RISK] Đánh giá hồ sơ (${pkg.dateEvaluate}) và Thẩm định kết quả (${pkg.dateAppraise}) cùng ngày — thiếu tính độc lập thẩm định theo Điều 16 khoản 7 Luật ĐT 22/2023.`
      );
    }
  }

  // Appraise and result-approve must be on different days
  if (pkg.dateAppraise && pkg.dateResultApprove) {
    const gap = daysBetween(pkg.dateAppraise, pkg.dateResultApprove);
    if (gap < 1) {
      errors.push(
        `[⚠ AUDIT RISK] Thẩm định kết quả (${pkg.dateAppraise}) và Phê duyệt kết quả (${pkg.dateResultApprove}) cùng ngày — thiếu khoảng cách tối thiểu giữa thẩm định và phê duyệt.`
      );
    }
  }

  // Delivery must not be after acceptance
  if (pkg.dateDelivery && pkg.dateAcceptance) {
    const gap = daysBetween(pkg.dateDelivery, pkg.dateAcceptance);
    if (gap < 0) {
      errors.push(
        `[⚠ AUDIT RISK] Ngày nghiệm thu (${pkg.dateAcceptance}) trước ngày bàn giao (${pkg.dateDelivery}) — vi phạm trật tự thủ tục.`
      );
    }
  }

  return errors;
};

// Returns validation errors before ZIP export.
// Exported so tests can verify without triggering the ZIP download side-effect.
export const validatePackageBeforeExport = (pkg: ProcurementPackage): string[] => {
  const errors: string[] = [];

  if (!pkg.packageName?.trim())
    errors.push('Thiếu tên gói thầu (packageName).');
  if (!pkg.packageCode?.trim())
    errors.push('Thiếu mã gói thầu (packageCode).');
  if (!pkg.items || pkg.items.length === 0)
    errors.push('Gói thầu chưa có mặt hàng nào.');

  for (const item of pkg.items ?? []) {
    if (!item.name?.trim())
      errors.push(`Mặt hàng ID "${item.id}" thiếu tên.`);
    if (item.quantity <= 0)
      errors.push(`Mặt hàng "${item.name || item.id}" có số lượng không hợp lệ (${item.quantity}).`);
    if (item.supplier1Price <= 0)
      errors.push(`Mặt hàng "${item.name || item.id}" thiếu báo giá nhà cung cấp 1.`);
  }

  if (!pkg.supplier1Name?.trim())
    errors.push('Thiếu tên nhà cung cấp 1 (supplier1Name).');
  if (!pkg.dateProposal)
    errors.push('Thiếu ngày tờ trình đề nghị (dateProposal).');
  if (!pkg.dateContractSign)
    errors.push('Thiếu ngày ký hợp đồng (dateContractSign).');

  return errors;
};

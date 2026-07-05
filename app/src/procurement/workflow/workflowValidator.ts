/**
 * Workflow validator — all business rule checks before state transitions.
 *
 * Hard blocks (ValidationResult.errors):
 *   - Illegal transition (not the immediate next state)
 *   - Cancelled or completed workflow
 *   - Missing required documents for the current state
 *   - Approval authority insufficient for estimated value (APPROVAL → CONTRACT_SIGNED)
 *
 * Warnings (ValidationResult.warnings):
 *   - Procurement method does not match value tier
 */

import type { WorkflowContext, WorkflowStateId } from './workflowContext';
import { isAllowedTransition, canRollback, canCancel } from './workflowTransition';
import { STATES } from './workflowState';

export interface ValidationResult {
  readonly valid:    boolean;
  readonly errors:   readonly string[];
  readonly warnings: readonly string[];
}

// Approval authority maximum value (from NĐ 214/2025 Điều 76)
const AUTHORITY_VALUE_LIMITS: Readonly<Record<string, number>> = {
  UNIT_HEAD:    5_000_000_000,        // < 5 tỷ
  MINISTER:     50_000_000_000,       // < 50 tỷ
  PRIME_MINISTER: Number.MAX_SAFE_INTEGER,
};

// Threshold above which DIRECT_PROCUREMENT is not appropriate for GOODS (NĐ 214 Điều 56)
const DIRECT_PROCUREMENT_MAX = 200_000_000;

// ─── Public validators ────────────────────────────────────────────────────────

export function validateTransition(
  ctx:         WorkflowContext,
  targetState: WorkflowStateId,
): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (ctx.status === 'CANCELLED') {
    errors.push('Không thể tiếp tục quy trình đã bị hủy');
    return { valid: false, errors, warnings };
  }
  if (ctx.status === 'COMPLETED') {
    errors.push('Quy trình đã hoàn thành, không thể chuyển bước');
    return { valid: false, errors, warnings };
  }

  if (!isAllowedTransition(ctx.currentState, targetState)) {
    errors.push(
      `Chuyển trạng thái từ ${ctx.currentState} sang ${targetState} không hợp lệ. ` +
      `Chỉ cho phép chuyển tuần tự theo quy trình.`,
    );
  }

  // Required documents for the current state must be uploaded before advancing
  const missingDocs = validateDocuments(ctx);
  if (missingDocs.length > 0) {
    errors.push(`Thiếu tài liệu bắt buộc trước khi chuyển bước: ${missingDocs.join(', ')}`);
  }

  // Approval authority check: only at APPROVAL → CONTRACT_SIGNED
  if (ctx.currentState === 'APPROVAL' && targetState === 'CONTRACT_SIGNED') {
    if (!validateApprovalAuthority(ctx)) {
      errors.push(
        `Giá trị gói thầu ${ctx.estimatedValue.toLocaleString()} VNĐ vượt thẩm quyền phê duyệt ` +
        `của ${ctx.approvalAuthority} (NĐ 214/2025 Điều 76)`,
      );
    }
  }

  // Warning: method tier mismatch
  const methodWarnings = validateMethodMatchesThreshold(ctx);
  warnings.push(...methodWarnings.warnings);

  return { valid: errors.length === 0, errors, warnings };
}

export function validateRollback(ctx: WorkflowContext): ValidationResult {
  const errors: string[] = [];
  if (ctx.status === 'CANCELLED') {
    errors.push('Không thể hoàn tác quy trình đã bị hủy');
  } else if (!canRollback(ctx.currentState)) {
    errors.push(`Không thể hoàn tác từ trạng thái ${ctx.currentState} (đây là bước đầu tiên)`);
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}

export function validateCancel(ctx: WorkflowContext): ValidationResult {
  const errors: string[] = [];
  if (ctx.status === 'CANCELLED') {
    errors.push('Quy trình đã bị hủy');
  } else if (!canCancel(ctx.currentState)) {
    errors.push('Không thể hủy quy trình đã hoàn thành');
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}

export function validateDocuments(ctx: WorkflowContext): readonly string[] {
  const stateDef = STATES[ctx.currentState];
  return stateDef.requiredDocuments.filter(
    docId => !ctx.documents.some(d => d.id === docId && d.uploaded),
  );
}

export function validateApprovalAuthority(ctx: WorkflowContext): boolean {
  const limit = AUTHORITY_VALUE_LIMITS[ctx.approvalAuthority];
  if (limit === undefined) return true;
  return ctx.estimatedValue < limit;
}

export function validateMethodMatchesThreshold(ctx: WorkflowContext): ValidationResult {
  const warnings: string[] = [];
  if (ctx.procurementMethod === 'DIRECT_PROCUREMENT' &&
      ctx.estimatedValue > DIRECT_PROCUREMENT_MAX) {
    warnings.push(
      `Phương thức mua sắm trực tiếp thường không áp dụng cho gói thầu hàng hóa ` +
      `vượt ${DIRECT_PROCUREMENT_MAX.toLocaleString()} VNĐ (TT 79/2025/TT-BTC)`,
    );
  }
  return { valid: true, errors: [], warnings };
}

export function getBlockingErrors(ctx: WorkflowContext): readonly string[] {
  const errors: string[] = [];
  if (!validateApprovalAuthority(ctx)) {
    errors.push(
      `Giá trị gói thầu vượt thẩm quyền phê duyệt của ${ctx.approvalAuthority}`,
    );
  }
  const missing = validateDocuments(ctx);
  if (missing.length > 0) {
    errors.push(`Thiếu tài liệu bắt buộc: ${missing.join(', ')}`);
  }
  return errors;
}

export function getWarnings(ctx: WorkflowContext): readonly string[] {
  return validateMethodMatchesThreshold(ctx).warnings;
}

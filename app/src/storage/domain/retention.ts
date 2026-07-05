import type { RetentionPolicy, LegalHold, AttachmentDocumentType } from '../types/storageTypes.ts'
import { StorageError } from '../types/storageTypes.ts'

// ── Default minimum retention per document type (days) ────────────────────────
// Luật Lưu trữ 2011 + Nghị định 01/2013/NĐ-CP + domain-specific regulations.
// These are the MINIMUM defaults. A stored RetentionPolicy may override with a longer period.

export const DEFAULT_RETENTION_DAYS: Record<AttachmentDocumentType, number> = {
  DECISION:          3650,   // 10 years — government decisions
  TENDER_DOCUMENTS:  1825,   // 5 years  — procurement law minimum
  BID_SUBMISSION:    1825,   // 5 years
  EVALUATION_REPORT: 1825,   // 5 years
  CONTRACT:          3650,   // 10 years — contract law
  ACCEPTANCE:        3650,   // 10 years
  INVOICE:           3650,   // 10 years — tax law
  PAYMENT_EVIDENCE:  3650,   // 10 years
  AUDIT_EVIDENCE:    3650,   // 10 years — audit law
  LEGAL_DOCUMENT:    3650,   // 10 years
  GENERAL:           1825,   // 5 years  — baseline
}

// ── Retention checks ──────────────────────────────────────────────────────────

export function calculateRetentionExpiry(uploadedAt: string, retentionDays: number): string {
  const ms = new Date(uploadedAt).getTime() + retentionDays * 86_400_000
  return new Date(ms).toISOString()
}

export function isRetentionExpired(uploadedAt: string, retentionDays: number, asOf: string): boolean {
  const expiry = calculateRetentionExpiry(uploadedAt, retentionDays)
  return asOf >= expiry
}

export function getEffectiveRetentionDays(
  documentType: AttachmentDocumentType,
  policy?: RetentionPolicy,
): number {
  const policyDays = policy?.isActive ? policy.retentionDays : 0
  const defaultDays = DEFAULT_RETENTION_DAYS[documentType]
  return Math.max(policyDays, defaultDays)
}

// ── Legal hold checks ─────────────────────────────────────────────────────────

export function isHoldActive(hold: LegalHold): boolean {
  return hold.releasedAt === undefined
}

/**
 * Returns true if any of the provided holds is currently active.
 * An active hold prevents any deletion regardless of retention policy.
 */
export function hasActiveLegalHold(holds: readonly LegalHold[]): boolean {
  return holds.some(isHoldActive)
}

// ── Deletion eligibility ──────────────────────────────────────────────────────

export interface CanDeleteResult {
  readonly allowed: boolean
  readonly reason: string
}

export function canDelete(
  uploadedAt: string,
  documentType: AttachmentDocumentType,
  asOf: string,
  policy?: RetentionPolicy,
  holds?: readonly LegalHold[],
): CanDeleteResult {
  if (holds && hasActiveLegalHold(holds)) {
    return { allowed: false, reason: 'Object is under legal hold' }
  }
  const days = getEffectiveRetentionDays(documentType, policy)
  if (!isRetentionExpired(uploadedAt, days, asOf)) {
    const expiry = calculateRetentionExpiry(uploadedAt, days)
    return { allowed: false, reason: `Retention period active until ${expiry}` }
  }
  return { allowed: true, reason: 'Retention period expired; no active legal hold' }
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateRetentionPolicyValues(retentionDays: number, documentType: AttachmentDocumentType): void {
  if (retentionDays < 1 || !Number.isInteger(retentionDays)) {
    throw new StorageError('VALIDATION_FAILED', 'retentionDays', 'retentionDays must be a positive integer')
  }
  const minimum = DEFAULT_RETENTION_DAYS[documentType]
  if (retentionDays < minimum) {
    throw new StorageError(
      'VALIDATION_FAILED',
      'retentionDays',
      `retentionDays (${retentionDays}) is below the legal minimum for ${documentType} (${minimum} days)`,
    )
  }
}

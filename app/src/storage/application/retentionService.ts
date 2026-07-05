import type { AuthContext } from '../../auth/index.ts'
import type { LegalHold, RetentionPolicy, AttachmentDocumentType } from '../types/storageTypes.ts'
import { StorageError } from '../types/storageTypes.ts'
import type { StorageRepositories } from '../infrastructure/storageRepositories.ts'
import type { StorageAuditEvent } from '../types/auditTypes.ts'
import type { LegalBasis } from '../../shared/financial/financialFactory.ts'
import {
  canDelete, validateRetentionPolicyValues, getEffectiveRetentionDays,
  isHoldActive, calculateRetentionExpiry,
} from '../domain/retention.ts'
import { validateRetentionPolicy } from '../validation/storageValidation.ts'
import { buildRetentionPolicy, buildLegalHold } from './storageFactory.ts'

// ── RetentionService ──────────────────────────────────────────────────────────

export class RetentionService {
  constructor(private readonly repos: StorageRepositories) {}

  // ── Retention policy management ─────────────────────────────────────────────

  async applyRetentionPolicy(
    documentType: AttachmentDocumentType,
    retentionDays: number,
    legalBasis: readonly LegalBasis[],
    auth: AuthContext,
  ): Promise<RetentionPolicy> {
    validateRetentionPolicyValues(retentionDays, documentType)

    const params = buildRetentionPolicy(documentType, retentionDays, legalBasis)
    validateRetentionPolicy(params)

    // Deactivate existing active policy for this document type
    const existing = await this.repos.retentionPolicies.findByDocumentType(documentType)
    if (existing) {
      await this.repos.retentionPolicies.update(existing.id, { isActive: false })
    }

    const policy = await this.repos.retentionPolicies.create(params)

    await this.audit({
      eventType: 'RETENTION_POLICY_APPLIED',
      objectKey: '',
      userId: auth.userId,
      outcome: 'SUCCESS',
      occurredAt: new Date().toISOString(),
      metadata: { documentType, retentionDays: String(retentionDays) },
    })

    return policy
  }

  async getRetentionPolicy(documentType: AttachmentDocumentType): Promise<RetentionPolicy | null> {
    return this.repos.retentionPolicies.findByDocumentType(documentType)
  }

  async listActivePolicies(): Promise<readonly RetentionPolicy[]> {
    return this.repos.retentionPolicies.findActive()
  }

  // ── Legal hold management ───────────────────────────────────────────────────

  async applyLegalHold(params: {
    readonly objectId?: string
    readonly moduleType?: string
    readonly moduleId?: string
    readonly reason: string
    readonly legalBasis: readonly LegalBasis[]
    readonly auth: AuthContext
  }): Promise<LegalHold> {
    if (!params.objectId && !params.moduleType) {
      throw new StorageError('VALIDATION_FAILED', 'objectId', 'Legal hold must target an objectId or moduleType')
    }
    if (params.legalBasis.length === 0) {
      throw new StorageError('VALIDATION_FAILED', 'legalBasis', 'Legal hold must include at least one legal basis')
    }

    const now = new Date().toISOString()
    const holdParams = buildLegalHold({
      objectId: params.objectId,
      moduleType: params.moduleType,
      moduleId: params.moduleId,
      reason: params.reason,
      legalBasis: params.legalBasis,
      placedBy: params.auth.userId,
      placedAt: now,
    })

    const hold = await this.repos.legalHolds.create(holdParams)

    await this.audit({
      eventType: 'LEGAL_HOLD_PLACED',
      objectKey: '',
      objectId: params.objectId,
      moduleType: params.moduleType,
      moduleId: params.moduleId,
      userId: params.auth.userId,
      outcome: 'SUCCESS',
      occurredAt: now,
      metadata: { reason: params.reason },
    })

    return hold
  }

  async releaseLegalHold(holdId: string, auth: AuthContext): Promise<LegalHold> {
    const hold = await this.repos.legalHolds.findById(holdId)
    if (!hold) throw new StorageError('OBJECT_NOT_FOUND', 'holdId', `Legal hold not found: ${holdId}`)

    if (!isHoldActive(hold)) {
      throw new StorageError('VALIDATION_FAILED', 'holdId', 'Legal hold is already released')
    }

    const now = new Date().toISOString()
    const released = await this.repos.legalHolds.release(holdId, auth.userId, now)

    await this.audit({
      eventType: 'LEGAL_HOLD_RELEASED',
      objectKey: '',
      objectId: hold.objectId,
      moduleType: hold.moduleType,
      moduleId: hold.moduleId,
      userId: auth.userId,
      outcome: 'SUCCESS',
      occurredAt: now,
      metadata: { holdId },
    })

    return released
  }

  async getActiveHoldsForObject(objectId: string): Promise<readonly LegalHold[]> {
    return this.repos.legalHolds.findActiveByObjectId(objectId)
  }

  async getActiveHoldsForModule(moduleType: string, moduleId: string): Promise<readonly LegalHold[]> {
    return this.repos.legalHolds.findActiveByModule(moduleType, moduleId)
  }

  // ── Deletion eligibility check ──────────────────────────────────────────────

  async canPurge(params: {
    readonly objectId: string
    readonly uploadedAt: string
    readonly documentType: AttachmentDocumentType
  }): Promise<{ allowed: boolean; reason?: string; expiresAt?: string }> {
    const [policy, holds] = await Promise.all([
      this.repos.retentionPolicies.findByDocumentType(params.documentType),
      this.repos.legalHolds.findActiveByObjectId(params.objectId),
    ])

    const asOf = new Date().toISOString()
    const result = canDelete(params.uploadedAt, params.documentType, asOf, policy ?? undefined, holds)

    if (!result.allowed) {
      const effectiveDays = getEffectiveRetentionDays(params.documentType, policy ?? undefined)
      const expiresAt = calculateRetentionExpiry(params.uploadedAt, effectiveDays)
      return { allowed: false, reason: result.reason, expiresAt: new Date(expiresAt).toISOString() }
    }

    return { allowed: true }
  }

  // ── Audit helper ────────────────────────────────────────────────────────────

  private async audit(event: Omit<StorageAuditEvent, 'id' | 'createdAt'>): Promise<void> {
    await this.repos.auditEvents.append(event)
  }
}

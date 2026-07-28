import { describe, it, expect, beforeEach } from 'vitest'
import { RetentionService } from '../storage/application/retentionService.ts'
import { buildMemoryStorageRepositories } from '../storage/infrastructure/memoryStorageRepositories.ts'
import { StorageError } from '../storage/types/storageTypes.ts'
import type { AuthContext } from '../auth/index.ts'
import type { LegalBasis } from '../shared/financial/financialFactory.ts'

const auth: AuthContext = Object.freeze({
  userId: 'user-1',
  sessionId: 'sess-1',
  providerId: 'local',
  roles: [],
  effectivePermissions: [],
  delegations: [],
  approvalHierarchies: [],
  issuedAt: '2024-01-01T00:00:00Z',
  expiresAt: '2099-01-01T00:00:00Z',
  username: 'user-1',
  email: 'user-1@example.com',
  displayName: 'Test User',
  departmentId: 'dept-1',
  activeDelegations: [],
  metadata: {},
})

const legalBasis: readonly LegalBasis[] = [
  { document: 'LTA-2011', article: '10', summary: 'Archive law' },
]

let service: RetentionService

beforeEach(() => {
  service = new RetentionService(buildMemoryStorageRepositories())
})

describe('applyRetentionPolicy', () => {
  it('creates a new policy', async () => {
    const policy = await service.applyRetentionPolicy('CONTRACT', 3650, legalBasis, auth)
    expect(policy.id).toBeTruthy()
    expect(policy.documentType).toBe('CONTRACT')
    expect(policy.retentionDays).toBe(3650)
    expect(policy.isActive).toBe(true)
  })

  it('deactivates existing policy for same document type', async () => {
    await service.applyRetentionPolicy('CONTRACT', 3650, legalBasis, auth)
    await service.applyRetentionPolicy('CONTRACT', 7300, legalBasis, auth)  // 20 years

    const found = await service.getRetentionPolicy('CONTRACT')
    expect(found?.retentionDays).toBe(7300)
  })

  it('throws for zero retention days', async () => {
    await expect(service.applyRetentionPolicy('CONTRACT', 0, legalBasis, auth)).rejects.toThrow(StorageError)
  })

  it('throws for negative retention days', async () => {
    await expect(service.applyRetentionPolicy('CONTRACT', -1, legalBasis, auth)).rejects.toThrow(StorageError)
  })
})

describe('getRetentionPolicy', () => {
  it('returns null when no policy exists', async () => {
    expect(await service.getRetentionPolicy('INVOICE')).toBeNull()
  })

  it('returns the active policy', async () => {
    await service.applyRetentionPolicy('INVOICE', 3650, legalBasis, auth)
    const policy = await service.getRetentionPolicy('INVOICE')
    expect(policy?.retentionDays).toBe(3650)
  })
})

describe('listActivePolicies', () => {
  it('returns all active policies', async () => {
    await service.applyRetentionPolicy('CONTRACT', 3650, legalBasis, auth)
    await service.applyRetentionPolicy('INVOICE', 3650, legalBasis, auth)
    const policies = await service.listActivePolicies()
    expect(policies.length).toBeGreaterThanOrEqual(2)
    expect(policies.every(p => p.isActive)).toBe(true)
  })
})

describe('applyLegalHold', () => {
  it('creates a legal hold on a specific object', async () => {
    const hold = await service.applyLegalHold({
      objectId: 'obj-1',
      reason: 'Audit investigation',
      legalBasis,
      auth,
    })
    expect(hold.id).toBeTruthy()
    expect(hold.objectId).toBe('obj-1')
    expect(hold.releasedAt).toBeUndefined()
  })

  it('creates a module-level hold', async () => {
    const hold = await service.applyLegalHold({
      moduleType: 'CONTRACT',
      moduleId: 'c-1',
      reason: 'Regulatory audit',
      legalBasis,
      auth,
    })
    expect(hold.moduleType).toBe('CONTRACT')
    expect(hold.moduleId).toBe('c-1')
  })

  it('throws when neither objectId nor moduleType provided', async () => {
    await expect(service.applyLegalHold({
      reason: 'Missing target',
      legalBasis,
      auth,
    })).rejects.toThrow(StorageError)
  })

  it('throws for empty legalBasis', async () => {
    await expect(service.applyLegalHold({
      objectId: 'obj-1',
      reason: 'No basis',
      legalBasis: [],
      auth,
    })).rejects.toThrow(StorageError)
  })
})

describe('releaseLegalHold', () => {
  it('releases an active hold', async () => {
    const hold = await service.applyLegalHold({
      objectId: 'obj-1',
      reason: 'Audit',
      legalBasis,
      auth,
    })
    const released = await service.releaseLegalHold(hold.id, auth)
    expect(released.releasedBy).toBe('user-1')
    expect(released.releasedAt).toBeTruthy()
  })

  it('throws for already-released hold', async () => {
    const hold = await service.applyLegalHold({
      objectId: 'obj-1',
      reason: 'Audit',
      legalBasis,
      auth,
    })
    await service.releaseLegalHold(hold.id, auth)
    await expect(service.releaseLegalHold(hold.id, auth)).rejects.toThrow(StorageError)
  })

  it('throws for non-existent hold', async () => {
    await expect(service.releaseLegalHold('no-such', auth)).rejects.toThrow(StorageError)
  })
})

describe('getActiveHoldsForObject', () => {
  it('returns active holds for an object', async () => {
    await service.applyLegalHold({ objectId: 'obj-1', reason: 'Audit', legalBasis, auth })
    const holds = await service.getActiveHoldsForObject('obj-1')
    expect(holds).toHaveLength(1)
  })

  it('excludes released holds', async () => {
    const hold = await service.applyLegalHold({ objectId: 'obj-1', reason: 'Audit', legalBasis, auth })
    await service.releaseLegalHold(hold.id, auth)
    const holds = await service.getActiveHoldsForObject('obj-1')
    expect(holds).toHaveLength(0)
  })
})

describe('getActiveHoldsForModule', () => {
  it('returns active module-level holds', async () => {
    await service.applyLegalHold({
      moduleType: 'CONTRACT', moduleId: 'c-1', reason: 'Audit', legalBasis, auth,
    })
    const holds = await service.getActiveHoldsForModule('CONTRACT', 'c-1')
    expect(holds).toHaveLength(1)
  })
})

describe('canPurge', () => {
  it('returns allowed=true for expired retention with no holds', async () => {
    const result = await service.canPurge({
      objectId: 'obj-old',
      uploadedAt: '2010-01-01T00:00:00Z',
      documentType: 'GENERAL',
    })
    expect(result.allowed).toBe(true)
  })

  it('returns allowed=false for active retention', async () => {
    const result = await service.canPurge({
      objectId: 'obj-new',
      uploadedAt: '2024-01-01T00:00:00Z',
      documentType: 'CONTRACT',
    })
    expect(result.allowed).toBe(false)
    expect(result.expiresAt).toBeTruthy()
  })

  it('returns allowed=false when object has active legal hold', async () => {
    const hold = await service.applyLegalHold({
      objectId: 'obj-held',
      reason: 'Active investigation',
      legalBasis,
      auth,
    })
    const result = await service.canPurge({
      objectId: 'obj-held',
      uploadedAt: '2010-01-01T00:00:00Z',
      documentType: 'GENERAL',
    })
    expect(result.allowed).toBe(false)
    void hold
  })
})

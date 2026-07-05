import { describe, it, expect, beforeEach } from 'vitest'
import type { MasterDataRepositories } from '../masterdata/masterdataRepository.ts'
import { MemoryMasterDataRepository } from '../masterdata/memoryMasterData.ts'
import type { ApprovalAuthority, Department } from '../masterdata/masterdataTypes.ts'
import {
  getApprovalAuthorities, getApprovalAuthorityByLevel,
  getDepartment, resolveValueApprovalLevel,
} from '../auth/integration/authIntegration.ts'

// ── Minimal MasterDataRepositories mock ───────────────────────────────────────

function buildTestRepos(): MasterDataRepositories {
  return {
    departments: new MemoryMasterDataRepository<Department>(),
    employees: new MemoryMasterDataRepository(),
    approvalAuthorities: new MemoryMasterDataRepository<ApprovalAuthority>(),
    fundSources: new MemoryMasterDataRepository(),
    budgetYears: new MemoryMasterDataRepository(),
    vendors: new MemoryMasterDataRepository(),
    procurementCategories: new MemoryMasterDataRepository(),
    packageTypes: new MemoryMasterDataRepository(),
    procurementMethods: new MemoryMasterDataRepository(),
    documentTemplates: new MemoryMasterDataRepository(),
  }
}

const makeAuthority = (code: string, level: number, maxValue: number) => ({
  code, name: `Level ${level}`, level, maxValue,
  isActive: true, isArchived: false,
})

const makeDept = (code: string, name: string) => ({
  code, name, level: 1, isActive: true, isArchived: false,
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getApprovalAuthorities', () => {
  let repos: MasterDataRepositories

  beforeEach(() => { repos = buildTestRepos() })

  it('returns all active approval authorities', async () => {
    await repos.approvalAuthorities.create(makeAuthority('UNIT_HEAD', 1, 2_000_000_000))
    await repos.approvalAuthorities.create(makeAuthority('DEPT_HEAD', 2, 500_000_000))
    const result = await getApprovalAuthorities(repos)
    expect(result).toHaveLength(2)
  })

  it('returns empty array when no authorities', async () => {
    const result = await getApprovalAuthorities(repos)
    expect(result).toHaveLength(0)
  })
})

describe('getApprovalAuthorityByLevel', () => {
  let repos: MasterDataRepositories

  beforeEach(async () => {
    repos = buildTestRepos()
    await repos.approvalAuthorities.create(makeAuthority('UNIT_HEAD', 1, 2_000_000_000))
    await repos.approvalAuthorities.create(makeAuthority('DEPT_HEAD', 2, 500_000_000))
  })

  it('returns authority for matching level', async () => {
    const result = await getApprovalAuthorityByLevel(1, repos)
    expect(result?.level).toBe(1)
    expect(result?.code).toBe('UNIT_HEAD')
  })

  it('returns null for non-existent level', async () => {
    expect(await getApprovalAuthorityByLevel(99, repos)).toBeNull()
  })
})

describe('getDepartment', () => {
  let repos: MasterDataRepositories

  beforeEach(() => { repos = buildTestRepos() })

  it('returns department by id', async () => {
    const dept = await repos.departments.create(makeDept('IT', 'IT Department'))
    const result = await getDepartment(dept.id, repos)
    expect(result?.id).toBe(dept.id)
    expect(result?.name).toBe('IT Department')
  })

  it('returns null for nonexistent department', async () => {
    expect(await getDepartment('nonexistent', repos)).toBeNull()
  })
})

describe('resolveValueApprovalLevel', () => {
  let repos: MasterDataRepositories

  beforeEach(async () => {
    repos = buildTestRepos()
    // Level 4 = smallest authority (e.g. officer) can approve up to 500M
    await repos.approvalAuthorities.create(makeAuthority('OFFICER', 4, 500_000_000))
    // Level 2 = mid authority can approve up to 5B
    await repos.approvalAuthorities.create(makeAuthority('DEPT_HEAD', 2, 5_000_000_000))
    // Level 1 = top authority, no practical limit set at 50B
    await repos.approvalAuthorities.create(makeAuthority('UNIT_HEAD', 1, 50_000_000_000))
  })

  it('resolves to lowest authority level that covers the value', async () => {
    // 300M < 500M → level 4 officer can handle
    const level = await resolveValueApprovalLevel(300_000_000n, repos)
    expect(level).toBe(4)
  })

  it('resolves to higher authority for larger value', async () => {
    // 1B > 500M but < 5B → dept head (level 2)
    const level = await resolveValueApprovalLevel(1_000_000_000n, repos)
    expect(level).toBe(2)
  })

  it('resolves to unit head for very large value', async () => {
    // 10B < 50B → unit head (level 1)
    const level = await resolveValueApprovalLevel(10_000_000_000n, repos)
    expect(level).toBe(1)
  })

  it('returns null when value exceeds all authority thresholds', async () => {
    const level = await resolveValueApprovalLevel(100_000_000_000n, repos)
    expect(level).toBeNull()
  })

  it('converts bigint correctly (bigint 500M matches exactly maxValue 500M)', async () => {
    const level = await resolveValueApprovalLevel(500_000_000n, repos)
    expect(level).toBe(4)
  })

  it('returns null with empty authorities', async () => {
    const emptyRepos = buildTestRepos()
    expect(await resolveValueApprovalLevel(1n, emptyRepos)).toBeNull()
  })
})

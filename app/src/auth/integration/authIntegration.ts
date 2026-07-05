/**
 * Integration bridge between auth module and masterdata module.
 * This is the ONLY file in src/auth/ that imports from src/masterdata/.
 * All cross-module communication goes through here.
 */

import type { MasterDataRepositories } from '../../masterdata/masterdataRepository.ts'
import type { ApprovalAuthority, Department } from '../../masterdata/masterdataTypes.ts'

// ── Public bridge API ─────────────────────────────────────────────────────────

export async function getApprovalAuthorities(
  repos: MasterDataRepositories,
): Promise<readonly ApprovalAuthority[]> {
  return repos.approvalAuthorities.findActive()
}

export async function getApprovalAuthorityByLevel(
  level: number,
  repos: MasterDataRepositories,
): Promise<ApprovalAuthority | null> {
  const all = await repos.approvalAuthorities.findActive()
  return all.find(a => a.level === level) ?? null
}

export async function getDepartment(
  departmentId: string,
  repos: MasterDataRepositories,
): Promise<Department | null> {
  return repos.departments.findById(departmentId)
}

/**
 * Given a VNĐ amount (bigint from the auth domain), resolve the minimum
 * authority level required to approve it.
 * Returns null when no authority covers the value (amount exceeds all thresholds).
 *
 * Note: ApprovalAuthority.maxValue is stored as number (masterdata convention).
 * The conversion is intentional and safe for VNĐ values up to Number.MAX_SAFE_INTEGER
 * (≈ 9 quadrillion VNĐ), which far exceeds any realistic procurement value.
 */
export async function resolveValueApprovalLevel(
  valueVnd: bigint,
  repos: MasterDataRepositories,
): Promise<number | null> {
  const all = await repos.approvalAuthorities.findActive()
  // Sort ascending by level (higher level = lower authority = handles smaller values first)
  const sorted = all.slice().sort((a, b) => b.level - a.level)

  for (const auth of sorted) {
    if (valueVnd <= BigInt(auth.maxValue)) return auth.level
  }
  return null
}

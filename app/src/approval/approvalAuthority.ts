import type { ApprovalAuthority } from '../masterdata/masterdataTypes';
import type { IMasterDataRepository } from '../masterdata/masterdataRepository';
import { ApprovalError } from './approvalTypes';

// Authority resolution: find most-junior authority (highest level number) whose maxValue >= estimatedValue.
// Level 1 = most senior (e.g. Prime Minister); higher number = less senior.

export async function resolveAuthorityForValue(
  estimatedValue: number,
  repo:           IMasterDataRepository<ApprovalAuthority>,
): Promise<ApprovalAuthority | null> {
  const chain = await getAuthorityChain(estimatedValue, repo);
  return chain.length > 0 ? chain[chain.length - 1]! : null;
}

export async function getAuthorityChain(
  estimatedValue: number,
  repo:           IMasterDataRepository<ApprovalAuthority>,
): Promise<readonly ApprovalAuthority[]> {
  const all = await repo.findActive();
  return all
    .filter(a => a.maxValue >= estimatedValue)
    .sort((a, b) => a.level - b.level);
}

export async function validateAuthorityPermission(
  authorityCode:  string,
  estimatedValue: number,
  repo:           IMasterDataRepository<ApprovalAuthority>,
): Promise<void> {
  const authority = await repo.findByCode(authorityCode);
  if (!authority || !authority.isActive || authority.isArchived) {
    throw new ApprovalError('UNKNOWN_AUTHORITY', 'assignedAuthorityCode', `Authority not found or inactive: ${authorityCode}`);
  }
  if (authority.maxValue < estimatedValue) {
    throw new ApprovalError(
      'AUTHORITY_INSUFFICIENT',
      'estimatedValue',
      `Authority ${authorityCode} (limit ${authority.maxValue} VNĐ) cannot approve ${estimatedValue} VNĐ`,
    );
  }
}

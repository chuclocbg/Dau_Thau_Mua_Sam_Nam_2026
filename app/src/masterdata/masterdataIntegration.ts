/**
 * Integration bridge between master data repositories and the Workflow Engine.
 *
 * The Workflow Engine is frozen. This module provides async master-data-aware
 * alternatives to the hardcoded constants in workflowValidator.ts:
 *   - resolveApprovalAuthorityLimit   replaces AUTHORITY_VALUE_LIMITS map
 *   - validateApprovalAuthorityFromMasterData  replaces validateApprovalAuthority()
 *   - resolveDocumentTemplatesForState  maps workflow states to document templates
 *   - buildWorkflowParamsFromMasterData validates codes before createWorkflow()
 *
 * No imports from workflowEngine.ts or workflowValidator.ts — no circular deps.
 */

import type {
  ApprovalAuthority, PackageType, ProcurementMethod, DocumentTemplate,
} from './masterdataTypes';
import type { IMasterDataRepository, MasterDataRepositories } from './masterdataRepository';

// ─── Authority limit lookup ───────────────────────────────────────────────────

export async function resolveApprovalAuthorityLimit(
  authorityCode: string,
  repo:          IMasterDataRepository<ApprovalAuthority>,
): Promise<number> {
  const authority = await repo.findByCode(authorityCode);
  if (!authority || !authority.isActive || authority.isArchived) return 0;
  return authority.maxValue;
}

export async function validateApprovalAuthorityFromMasterData(
  ctx:  { estimatedValue: number; approvalAuthority: string },
  repo: IMasterDataRepository<ApprovalAuthority>,
): Promise<boolean> {
  const limit = await resolveApprovalAuthorityLimit(ctx.approvalAuthority, repo);
  return limit > 0 && ctx.estimatedValue < limit;
}

// ─── Package type / method resolution ────────────────────────────────────────

export async function resolvePackageTypeFromMasterData(
  code: string,
  repo: IMasterDataRepository<PackageType>,
): Promise<PackageType | null> {
  const pt = await repo.findByCode(code);
  return pt?.isActive && !pt.isArchived ? pt : null;
}

export async function resolveProcurementMethodFromMasterData(
  code: string,
  repo: IMasterDataRepository<ProcurementMethod>,
): Promise<ProcurementMethod | null> {
  const method = await repo.findByCode(code);
  return method?.isActive && !method.isArchived ? method : null;
}

// ─── Document template resolution ────────────────────────────────────────────

export async function resolveDocumentTemplatesForState(
  stateId: string,
  repo:    IMasterDataRepository<DocumentTemplate>,
): Promise<readonly DocumentTemplate[]> {
  const active = await repo.findActive();
  return active.filter(t => t.applicableStates.includes(stateId));
}

// ─── Workflow param builder ───────────────────────────────────────────────────

export interface WorkflowCreationParams {
  readonly packageId:          string;
  readonly packageType:        string;
  readonly estimatedValue:     number;
  readonly procurementMethod:  string;
  readonly approvalAuthority:  string;
  readonly performedBy:        string;
}

/**
 * Resolves and validates all master data codes before calling createWorkflow().
 * Throws if any code is unknown or inactive.
 */
export async function buildWorkflowParamsFromMasterData(
  input: {
    packageId:             string;
    packageTypeCode:       string;
    estimatedValue:        number;
    procurementMethodCode: string;
    approvalAuthorityCode: string;
    performedBy:           string;
  },
  repos: Pick<MasterDataRepositories, 'packageTypes' | 'procurementMethods' | 'approvalAuthorities'>,
): Promise<WorkflowCreationParams> {
  const [packageType, procMethod, authority] = await Promise.all([
    repos.packageTypes.findByCode(input.packageTypeCode),
    repos.procurementMethods.findByCode(input.procurementMethodCode),
    repos.approvalAuthorities.findByCode(input.approvalAuthorityCode),
  ]);

  if (!packageType?.isActive || packageType.isArchived)
    throw new Error(`Package type not found or inactive: ${input.packageTypeCode}`);
  if (!procMethod?.isActive || procMethod.isArchived)
    throw new Error(`Procurement method not found or inactive: ${input.procurementMethodCode}`);
  if (!authority?.isActive || authority.isArchived)
    throw new Error(`Approval authority not found or inactive: ${input.approvalAuthorityCode}`);

  return {
    packageId:         input.packageId,
    packageType:       packageType.code,
    estimatedValue:    input.estimatedValue,
    procurementMethod: procMethod.code,
    approvalAuthority: authority.code,
    performedBy:       input.performedBy,
  };
}

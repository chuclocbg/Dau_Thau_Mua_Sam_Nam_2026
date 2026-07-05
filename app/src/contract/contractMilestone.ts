import type { ContractRepositories } from './contractRepositories';
import type { ContractMilestone, AddMilestoneParams } from './contractTypes';
import { ContractError } from './contractTypes';
import { validateMilestoneParams } from './contractValidation';
import { recordContractEvent } from './contractHistory';

export async function addMilestone(
  contractId: string,
  params:     AddMilestoneParams,
  createdBy:  string,
  repos:      ContractRepositories,
): Promise<ContractMilestone> {
  const result = validateMilestoneParams(params);
  if (!result.valid) throw new ContractError('INVALID_MILESTONE', 'milestone', result.errors.join('; '));

  const contract = await repos.contracts.findById(contractId);
  if (!contract) throw new ContractError('NOT_FOUND', 'contractId', `Contract not found: ${contractId}`);

  const milestone = await repos.milestones.create({
    contractId,
    milestoneCode: params.milestoneCode,
    title:         params.title,
    description:   params.description,
    plannedDate:   params.plannedDate,
    plannedValue:  params.plannedValue,
    status:        'PENDING',
  } as Omit<ContractMilestone, 'id' | 'createdAt' | 'updatedAt'>);

  await recordContractEvent(contractId, 'NOTE_ADDED', createdBy, repos.history, {
    notes: `Milestone added: ${params.title}`,
  });
  return milestone;
}

export async function markMilestoneReached(
  milestoneId: string,
  actualDate:  string,
  actualValue: number,
  verifiedBy:  string,
  repos:       ContractRepositories,
): Promise<ContractMilestone> {
  const milestone = await repos.milestones.findById(milestoneId);
  if (!milestone) throw new ContractError('NOT_FOUND', 'milestoneId', `Milestone not found: ${milestoneId}`);
  if (milestone.status !== 'PENDING' && milestone.status !== 'DELAYED') {
    throw new ContractError('INVALID_STATUS', 'status', `Cannot reach milestone with status: ${milestone.status}`);
  }

  const updated = await repos.milestones.update(milestoneId, {
    status:      'REACHED',
    actualDate,
    actualValue,
    verifiedBy,
  });

  await recordContractEvent(milestone.contractId, 'MILESTONE_REACHED', verifiedBy, repos.history, {
    notes: `Milestone reached: ${milestone.title}`,
  });
  return updated;
}

export async function markMilestoneDelayed(
  milestoneId: string,
  reportedBy:  string,
  repos:       ContractRepositories,
): Promise<ContractMilestone> {
  const milestone = await repos.milestones.findById(milestoneId);
  if (!milestone) throw new ContractError('NOT_FOUND', 'milestoneId', `Milestone not found: ${milestoneId}`);
  if (milestone.status !== 'PENDING') {
    throw new ContractError('INVALID_STATUS', 'status', `Cannot mark delayed a milestone with status: ${milestone.status}`);
  }

  const updated = await repos.milestones.update(milestoneId, { status: 'DELAYED' });
  await recordContractEvent(milestone.contractId, 'MILESTONE_DELAYED', reportedBy, repos.history, {
    notes: `Milestone delayed: ${milestone.title}`,
  });
  return updated;
}

export async function getMilestones(
  contractId: string,
  repos:      ContractRepositories,
): Promise<readonly ContractMilestone[]> {
  return repos.milestones.findByContractId(contractId);
}

export async function calculateCompletionPercent(
  contractId: string,
  repos:      ContractRepositories,
): Promise<number> {
  const milestones = await repos.milestones.findByContractId(contractId);
  if (milestones.length === 0) return 0;
  const totalPlanned = milestones.reduce((s, m) => s + m.plannedValue, 0);
  if (totalPlanned === 0) return 0;
  const reachedValue = milestones
    .filter(m => m.status === 'REACHED')
    .reduce((s, m) => s + (m.actualValue ?? m.plannedValue), 0);
  return Math.min(100, Math.round((reachedValue / totalPlanned) * 100));
}

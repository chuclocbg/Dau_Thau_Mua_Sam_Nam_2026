import type { AcceptanceCommittee, AcceptanceMember, FormCommitteeParams, AddMemberParams } from './acceptanceTypes';
import { AcceptanceError } from './acceptanceTypes';
import { validateFormCommitteeParams, validateMemberParams, validateAcceptanceStatusTransition } from './acceptanceValidation';
import { recordAcceptanceEvent } from './acceptanceHistory';
import type { AcceptanceRepositories } from './acceptanceRepositories';

export async function formCommittee(
  requestId: string,
  params:    FormCommitteeParams,
  formedBy:  string,
  repos:     AcceptanceRepositories,
): Promise<AcceptanceCommittee> {
  const result = validateFormCommitteeParams(params);
  if (!result.valid) throw new AcceptanceError('INVALID_COMMITTEE', 'committee', result.errors.join('; '));

  const request = await repos.requests.findById(requestId);
  if (!request) throw new AcceptanceError('NOT_FOUND', 'requestId', `Request not found: ${requestId}`);

  // Check duplicate before status so COMMITTEE_EXISTS is the correct error code
  const existing = await repos.committees.findByRequestId(requestId);
  if (existing) throw new AcceptanceError('COMMITTEE_EXISTS', 'requestId', `Committee already formed for request: ${requestId}`);

  validateAcceptanceStatusTransition(request.status, ['DRAFT'], 'status');

  const committee = await repos.committees.create({
    requestId,
    committeeCode:    params.committeeCode,
    establishedBy:    params.establishedBy,
    establishedAt:    new Date().toISOString(),
    decisionReference: params.decisionReference,
    notes:            params.notes,
  } as Omit<AcceptanceCommittee, 'id' | 'createdAt' | 'updatedAt'>);

  await repos.requests.update(requestId, { status: 'COMMITTEE_FORMED' });
  await recordAcceptanceEvent(requestId, 'COMMITTEE_FORMED', formedBy, repos.history, {
    fromStatus: 'DRAFT', toStatus: 'COMMITTEE_FORMED',
    notes: `Committee ${params.committeeCode} formed`,
  });
  return committee;
}

export async function addMember(
  requestId:   string,
  committeeId: string,
  params:      AddMemberParams,
  addedBy:     string,
  repos:       AcceptanceRepositories,
): Promise<AcceptanceMember> {
  const result = validateMemberParams(params);
  if (!result.valid) throw new AcceptanceError('INVALID_MEMBER', 'member', result.errors.join('; '));

  const committee = await repos.committees.findById(committeeId);
  if (!committee) throw new AcceptanceError('NOT_FOUND', 'committeeId', `Committee not found: ${committeeId}`);

  // Prevent duplicate memberCode in the same committee
  const existing = await repos.members.findByCommitteeId(committeeId);
  if (existing.some(m => m.memberCode === params.memberCode && m.isActive)) {
    throw new AcceptanceError('DUPLICATE_MEMBER', 'memberCode', `Member already in committee: ${params.memberCode}`);
  }

  const member = await repos.members.create({
    committeeId,
    requestId,
    memberCode:   params.memberCode,
    memberName:   params.memberName,
    role:         params.role,
    organization: params.organization,
    isActive:     true,
  } as Omit<AcceptanceMember, 'id' | 'createdAt' | 'updatedAt'>);

  await recordAcceptanceEvent(requestId, 'MEMBER_ADDED', addedBy, repos.history, {
    notes: `${params.role} ${params.memberName} (${params.memberCode}) added`,
  });
  return member;
}

export async function removeMember(
  memberId:    string,
  removedBy:   string,
  repos:       AcceptanceRepositories,
): Promise<AcceptanceMember> {
  const member = await repos.members.findById(memberId);
  if (!member) throw new AcceptanceError('NOT_FOUND', 'memberId', `Member not found: ${memberId}`);
  if (!member.isActive) throw new AcceptanceError('ALREADY_REMOVED', 'memberId', `Member already removed: ${memberId}`);

  const updated = await repos.members.update(memberId, { isActive: false });
  await recordAcceptanceEvent(member.requestId, 'MEMBER_REMOVED', removedBy, repos.history, {
    notes: `${member.role} ${member.memberName} (${member.memberCode}) removed`,
  });
  return updated;
}

export async function getCommitteeMembers(
  committeeId: string,
  repos:       AcceptanceRepositories,
): Promise<readonly AcceptanceMember[]> {
  return repos.members.findActiveByCommitteeId(committeeId);
}

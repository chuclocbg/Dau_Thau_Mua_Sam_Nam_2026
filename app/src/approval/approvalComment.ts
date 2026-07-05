import type { IApprovalCommentRepository } from './approvalRepositories';
import type { ApprovalComment, AddCommentParams } from './approvalTypes';
import { validateCommentContent } from './approvalValidation';

export async function addComment(
  requestId: string,
  params:    AddCommentParams,
  addedBy:   string,
  repo:      IApprovalCommentRepository,
): Promise<ApprovalComment> {
  validateCommentContent(params.content);
  return repo.create({
    requestId,
    content:    params.content.trim(),
    authorCode: params.authorCode || addedBy,
    isInternal: params.isInternal ?? false,
  } as Omit<ApprovalComment, 'id' | 'createdAt' | 'updatedAt'>);
}

export async function getComments(
  requestId:    string,
  repo:         IApprovalCommentRepository,
  includeInternal = false,
): Promise<readonly ApprovalComment[]> {
  const all = await repo.findByRequestId(requestId);
  return includeInternal ? all : all.filter(c => !c.isInternal);
}

export async function countComments(
  requestId: string,
  repo:      IApprovalCommentRepository,
): Promise<number> {
  return repo.countByRequestId(requestId);
}

import type { IApprovalAttachmentRepository } from './approvalRepositories';
import type { ApprovalAttachment, AddAttachmentParams, ApprovalValidationResult } from './approvalTypes';
import { validateAttachmentParams } from './approvalValidation';
import { ApprovalError } from './approvalTypes';

export async function addAttachment(
  requestId:  string,
  params:     AddAttachmentParams,
  uploadedBy: string,
  repo:       IApprovalAttachmentRepository,
): Promise<ApprovalAttachment> {
  const result = validateAttachmentParams(params);
  if (!result.valid) throw new ApprovalError('INVALID_ATTACHMENT', 'attachment', result.errors.join('; '));
  return repo.create({
    requestId,
    fileName:     params.fileName.trim(),
    fileType:     params.fileType.trim(),
    fileSize:     params.fileSize,
    uploadedBy,
    documentType: params.documentType,
  } as Omit<ApprovalAttachment, 'id' | 'createdAt' | 'updatedAt'>);
}

export async function getAttachments(
  requestId: string,
  repo:      IApprovalAttachmentRepository,
): Promise<readonly ApprovalAttachment[]> {
  return repo.findByRequestId(requestId);
}

export async function getTotalAttachmentSize(
  requestId: string,
  repo:      IApprovalAttachmentRepository,
): Promise<number> {
  const attachments = await repo.findByRequestId(requestId);
  return attachments.reduce((sum, a) => sum + a.fileSize, 0);
}

export function validateAttachmentParamsPublic(params: AddAttachmentParams): ApprovalValidationResult {
  return validateAttachmentParams(params);
}

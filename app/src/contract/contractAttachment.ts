import type { ContractRepositories } from './contractRepositories';
import type { ContractAttachment, AddAttachmentParams } from './contractTypes';
import { ContractError } from './contractTypes';
import { validateAttachmentParams } from './contractValidation';
import { recordContractEvent } from './contractHistory';

export async function addAttachment(
  contractId:  string,
  params:      AddAttachmentParams,
  uploadedBy:  string,
  repos:       ContractRepositories,
): Promise<ContractAttachment> {
  const result = validateAttachmentParams(params);
  if (!result.valid) throw new ContractError('INVALID_ATTACHMENT', 'attachment', result.errors.join('; '));

  const contract = await repos.contracts.findById(contractId);
  if (!contract) throw new ContractError('NOT_FOUND', 'contractId', `Contract not found: ${contractId}`);

  const attachment = await repos.attachments.create({
    contractId,
    fileName:     params.fileName.trim(),
    fileType:     params.fileType.trim(),
    fileSize:     params.fileSize,
    uploadedBy,
    documentType: params.documentType,
  } as Omit<ContractAttachment, 'id' | 'createdAt' | 'updatedAt'>);

  await recordContractEvent(contractId, 'ATTACHMENT_ADDED', uploadedBy, repos.history, {
    notes: `Attachment added: ${params.fileName}`,
  });
  return attachment;
}

export async function getAttachments(
  contractId: string,
  repos:      ContractRepositories,
): Promise<readonly ContractAttachment[]> {
  return repos.attachments.findByContractId(contractId);
}

export async function getTotalAttachmentSize(
  contractId: string,
  repos:      ContractRepositories,
): Promise<number> {
  const attachments = await repos.attachments.findByContractId(contractId);
  return attachments.reduce((sum, a) => sum + a.fileSize, 0);
}

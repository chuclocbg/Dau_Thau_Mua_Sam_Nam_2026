import type { IAttachmentReferenceRepository } from '../storage/infrastructure/storageRepositories.ts'
import type { AttachmentReference, AttachmentDocumentType } from '../storage/types/storageTypes.ts'
import { buildAttachmentReference } from '../storage/application/storageFactory.ts'

// ── Session Attachments — Phase X.11 Attachment persistence ───────────────────
// Reuses the pre-existing, module-agnostic Storage attachment-reference infrastructure
// (src/storage/, predates Phase X, already used by package/contract/acceptance/approval with
// their own moduleType values) rather than inventing a new attachment concept. A conversation
// session is simply one more moduleType value ('CONVERSATION_SESSION') pointing at
// moduleId = sessionId. This module only supplies that convention; it never touches file bytes,
// upload mechanics, or the Storage module's own repositories/types.

export const CONVERSATION_SESSION_MODULE_TYPE = 'CONVERSATION_SESSION'

export interface AttachFileToSessionParams {
  readonly sessionId: string
  readonly objectId: string
  readonly documentType?: AttachmentDocumentType
  readonly filename: string
  readonly mimeType: string
  readonly sizeBytes: bigint
  readonly checksum: string
  readonly versionId: string
  readonly uploadedBy: string
  readonly uploadedAt: string
}

export async function attachFileToSession(
  repository: IAttachmentReferenceRepository,
  params: AttachFileToSessionParams,
): Promise<AttachmentReference> {
  const reference = buildAttachmentReference({
    objectId: params.objectId,
    moduleType: CONVERSATION_SESSION_MODULE_TYPE,
    moduleId: params.sessionId,
    documentType: params.documentType ?? 'GENERAL',
    filename: params.filename,
    mimeType: params.mimeType,
    sizeBytes: params.sizeBytes,
    checksum: params.checksum,
    versionId: params.versionId,
    uploadedBy: params.uploadedBy,
    uploadedAt: params.uploadedAt,
  })
  return repository.create(reference)
}

export async function listSessionAttachments(
  repository: IAttachmentReferenceRepository,
  sessionId: string,
): Promise<readonly AttachmentReference[]> {
  return repository.findByModule(CONVERSATION_SESSION_MODULE_TYPE, sessionId)
}

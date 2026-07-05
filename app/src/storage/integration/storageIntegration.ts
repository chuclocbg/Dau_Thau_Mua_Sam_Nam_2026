/**
 * storageIntegration.ts — the ONLY file in src/storage/ that may import from other modules.
 * Frozen modules (contracts, payments, etc.) must NOT import storage directly.
 * They store only the attachmentReferenceId string on their entity.
 */

import type { Department } from '../../masterdata/masterdataTypes.ts'
import type { MasterDataRepositories } from '../../masterdata/masterdataRepository.ts'
import type { AttachmentReference } from '../types/storageTypes.ts'
import type { StorageRepositories } from '../infrastructure/storageRepositories.ts'

// ── Department resolution ─────────────────────────────────────────────────────

/** Resolve the department responsible for a stored attachment's owning module. */
export async function resolveDepartmentForAttachment(
  attachmentId: string,
  storageRepos: StorageRepositories,
  masterdata: MasterDataRepositories,
): Promise<Department | null> {
  const ref = await storageRepos.attachmentReferences.findById(attachmentId)
  if (!ref) return null

  // moduleType may equal a department code or may be used to find the owning dept
  const depts = await masterdata.departments.findAll()
  return depts.find(d => d.code === ref.moduleType) ?? null
}

// ── Attachment reference lookup (called by frozen modules via id string) ───────

/** Load a single attachment reference by ID. Called by frozen modules that store only the string ID. */
export async function resolveAttachmentReference(
  attachmentId: string,
  storageRepos: StorageRepositories,
): Promise<AttachmentReference | null> {
  return storageRepos.attachmentReferences.findById(attachmentId)
}

/** Load all active attachment references for a business entity. */
export async function resolveAttachmentsForModule(
  moduleType: string,
  moduleId: string,
  storageRepos: StorageRepositories,
): Promise<readonly AttachmentReference[]> {
  return storageRepos.attachmentReferences.findActive(moduleType, moduleId)
}

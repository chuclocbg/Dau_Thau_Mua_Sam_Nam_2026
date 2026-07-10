/**
 * Phase X.11 — unit tests for attachFileToSession/listSessionAttachments (Attachment
 * persistence), exercised against a real MemoryAttachmentReferenceRepository (pre-existing
 * Storage module, unmodified) rather than a mock.
 */

import { describe, it, expect } from 'vitest'
import { attachFileToSession, listSessionAttachments, CONVERSATION_SESSION_MODULE_TYPE } from '../runtime/sessionAttachments.ts'
import { buildMemoryStorageRepositories } from '../storage/infrastructure/memoryStorageRepositories.ts'

function fileParams(sessionId: string, filename: string) {
  return {
    sessionId, objectId: crypto.randomUUID(), filename, mimeType: 'application/pdf',
    sizeBytes: 1024n, checksum: 'abc123', versionId: 'v1', uploadedBy: 'user-1',
    uploadedAt: new Date().toISOString(),
  }
}

describe('attachFileToSession', () => {
  it('creates an AttachmentReference scoped to CONVERSATION_SESSION/sessionId', async () => {
    const repo = buildMemoryStorageRepositories().attachmentReferences
    const ref = await attachFileToSession(repo, fileParams('session-1', 'a.pdf'))
    expect(ref.moduleType).toBe(CONVERSATION_SESSION_MODULE_TYPE)
    expect(ref.moduleId).toBe('session-1')
    expect(ref.documentType).toBe('GENERAL')
    expect(ref.isActive).toBe(true)
  })

  it('honors an explicit documentType override', async () => {
    const repo = buildMemoryStorageRepositories().attachmentReferences
    const ref = await attachFileToSession(repo, { ...fileParams('session-1', 'b.pdf'), documentType: 'LEGAL_DOCUMENT' })
    expect(ref.documentType).toBe('LEGAL_DOCUMENT')
  })
})

describe('listSessionAttachments', () => {
  it('returns only attachments for the given session, not other sessions or other module types', async () => {
    const repo = buildMemoryStorageRepositories().attachmentReferences
    await attachFileToSession(repo, fileParams('session-1', 'a.pdf'))
    await attachFileToSession(repo, fileParams('session-1', 'b.pdf'))
    await attachFileToSession(repo, fileParams('session-2', 'c.pdf'))

    const results = await listSessionAttachments(repo, 'session-1')
    expect(results).toHaveLength(2)
    expect(results.every(r => r.moduleId === 'session-1')).toBe(true)
  })

  it('returns an empty array for a session with no attachments', async () => {
    const repo = buildMemoryStorageRepositories().attachmentReferences
    expect(await listSessionAttachments(repo, 'no-attachments')).toEqual([])
  })
})

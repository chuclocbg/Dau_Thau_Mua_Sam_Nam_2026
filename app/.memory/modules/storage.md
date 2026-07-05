# Module: Storage & Attachment Service

**Status:** IN PROGRESS — Phase K
**Location:** `src/storage/`
**Tests:** ~350 (target)

---

## Purpose

Manages file uploads and attachments for any entity in the system.
Pluggable storage backends (local, S3, Azure). Pluggable virus scanning.
Every attachment is versioned and has a retention policy with LegalBasis.

---

## Planned Public API

```typescript
Attachment {
  id, entityType: string, entityId: string,
  filename, originalName, mimeType,
  size: bigint,                    // bytes
  hash: string,                    // SHA-256 hex
  storageKey: string,              // internal key, never exposed
  currentVersion: number,
  scanStatus: ScanStatus,
  retentionMonths: number,
  retentionBasis: LegalBasis,
  uploadedBy: string,              // userId
  uploadedAt, deletedAt?
}

// Upload flow: receive → validate MIME → SHA-256 → store → scan → record
// Versioning: re-uploading to same attachmentId creates new AttachmentVersion

// IStorageAdapter interface
store(key, content, meta): Promise<void>
retrieve(key): Promise<Buffer>
exists(key): Promise<boolean>
delete(key): Promise<void>
// Implementations: LocalFileStorageAdapter, S3StorageAdapter, AzureBlobAdapter

// IVirusScanAdapter interface
scan(content): Promise<ScanResult>
// Implementations: PassthroughScanAdapter, ClamAvScanAdapter, CloudScanAdapter
```

---

## Supported MIME Types

PDF, DOCX, XLSX, ZIP, PNG, JPG, SVG

---

## Retention Policy

Minimum 5 years (Luật lưu trữ). Stored as `LegalBasis` per attachment.
Physical deletion deferred until retention period expires (soft delete via `deletedAt`).

---

## Dependencies

- `src/auth/` — uploads attributed to `userId`
- `src/shared/financial/financialTypes.ts` (LegalBasis)

---

## Design Reference

Full type definitions: `.memory/infra-architecture.md`

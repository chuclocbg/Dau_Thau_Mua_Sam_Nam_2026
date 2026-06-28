/**
 * Phase 19 — Case Model
 *
 * GovernanceCase is the carrier type that every capability operates on.
 * It wraps a GovernanceContext with lifecycle metadata: status, timeline,
 * attachments, audit log, and domain-specific metadata.
 *
 * Exports:
 *   CaseId           — string alias (semantically typed)
 *   CaseStatus       — DRAFT → OPEN → UNDER_REVIEW → PENDING_APPROVAL → APPROVED | REJECTED → CLOSED → ARCHIVED
 *   CasePriority     — CRITICAL | HIGH | MEDIUM | LOW
 *   CaseTimeline     — createdAt, updatedAt, submittedAt?, closedAt?, deadline?
 *   CaseAttachment   — uploaded file descriptor
 *   CaseAuditLog     — single audit event
 *   CaseMetadata     — domain, category, priority, tags, customFields
 *   GovernanceCase   — the complete case object
 *   CASE_STATUSES    — runtime frozen list of all 8 statuses
 *   CASE_PRIORITIES  — runtime frozen list of all 4 priorities
 *   createCaseMetadata()
 *   createCaseTimeline()
 *   createCaseAttachment()
 *   createCaseAuditLog()
 *   createCase()
 *   addAuditEntry()   — returns a new case (immutable update)
 *   transitionCase()  — returns a new case with updated status + audit entry
 *
 * Pure. No I/O. No side effects. No any. No React. No browser globals.
 */

import type { GovernanceContext } from '../application/governanceContext';

// ─── Enumerations ─────────────────────────────────────────────────────────────

export type CaseId = string;

export type CaseStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'CLOSED'
  | 'ARCHIVED';

export type CasePriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export const CASE_STATUSES: readonly CaseStatus[] = Object.freeze([
  'DRAFT', 'OPEN', 'UNDER_REVIEW', 'PENDING_APPROVAL',
  'APPROVED', 'REJECTED', 'CLOSED', 'ARCHIVED',
] as const);

export const CASE_PRIORITIES: readonly CasePriority[] = Object.freeze([
  'CRITICAL', 'HIGH', 'MEDIUM', 'LOW',
] as const);

// ─── CaseTimeline ─────────────────────────────────────────────────────────────

export interface CaseTimeline {
  readonly createdAt:    string;     // ISO-8601
  readonly updatedAt:    string;     // ISO-8601
  readonly submittedAt?: string;     // ISO-8601
  readonly closedAt?:    string;     // ISO-8601
  readonly deadline?:    string;     // ISO-8601
}

export function createCaseTimeline(params: {
  readonly createdAt:    string;
  readonly updatedAt:    string;
  readonly submittedAt?: string;
  readonly closedAt?:    string;
  readonly deadline?:    string;
}): CaseTimeline {
  return {
    createdAt:   params.createdAt,
    updatedAt:   params.updatedAt,
    submittedAt: params.submittedAt,
    closedAt:    params.closedAt,
    deadline:    params.deadline,
  };
}

// ─── CaseAttachment ───────────────────────────────────────────────────────────

export interface CaseAttachment {
  readonly id:         string;
  readonly name:       string;
  readonly mimeType:   string;
  readonly sizeBytes:  number;
  readonly uploadedAt: string;   // ISO-8601
  readonly uploadedBy: string;   // actor id
}

export function createCaseAttachment(params: {
  readonly id:         string;
  readonly name:       string;
  readonly mimeType:   string;
  readonly sizeBytes:  number;
  readonly uploadedAt: string;
  readonly uploadedBy: string;
}): CaseAttachment {
  return { ...params };
}

// ─── CaseAuditLog ─────────────────────────────────────────────────────────────

export interface CaseAuditLog {
  readonly id:        string;
  readonly caseId:    CaseId;
  readonly action:    string;
  readonly actor:     string;     // actor id
  readonly timestamp: string;     // ISO-8601
  readonly details:   Readonly<Record<string, string>>;
}

export function createCaseAuditLog(params: {
  readonly id:        string;
  readonly caseId:    CaseId;
  readonly action:    string;
  readonly actor:     string;
  readonly timestamp: string;
  readonly details?:  Record<string, string>;
}): CaseAuditLog {
  return {
    id:        params.id,
    caseId:    params.caseId,
    action:    params.action,
    actor:     params.actor,
    timestamp: params.timestamp,
    details:   Object.freeze({ ...(params.details ?? {}) }),
  };
}

// ─── CaseMetadata ─────────────────────────────────────────────────────────────

export interface CaseMetadata {
  readonly domain:       string;          // PROCUREMENT | ASSETS | HR | AUDIT | LEGAL | FINANCE
  readonly category:     string;
  readonly priority:     CasePriority;
  readonly tags:         readonly string[];
  readonly customFields: Readonly<Record<string, string>>;
}

export function createCaseMetadata(params: {
  readonly domain:        string;
  readonly category:      string;
  readonly priority?:     CasePriority;
  readonly tags?:         readonly string[];
  readonly customFields?: Record<string, string>;
}): CaseMetadata {
  return {
    domain:       params.domain,
    category:     params.category,
    priority:     params.priority     ?? 'MEDIUM',
    tags:         Object.freeze([...(params.tags         ?? [])]),
    customFields: Object.freeze({ ...(params.customFields ?? {}) }),
  };
}

// ─── GovernanceCase ───────────────────────────────────────────────────────────

export interface GovernanceCase {
  readonly id:          CaseId;
  readonly title:       string;
  readonly description: string;
  readonly status:      CaseStatus;
  readonly context:     GovernanceContext;
  readonly metadata:    CaseMetadata;
  readonly timeline:    CaseTimeline;
  readonly attachments: readonly CaseAttachment[];
  readonly auditLog:    readonly CaseAuditLog[];
  readonly version:     number;
}

export function createCase(params: {
  readonly id:           CaseId;
  readonly title:        string;
  readonly description?: string;
  readonly status?:      CaseStatus;
  readonly context:      GovernanceContext;
  readonly metadata:     CaseMetadata;
  readonly timeline:     CaseTimeline;
  readonly attachments?: readonly CaseAttachment[];
  readonly auditLog?:    readonly CaseAuditLog[];
  readonly version?:     number;
}): GovernanceCase {
  return {
    id:          params.id,
    title:       params.title,
    description: params.description ?? '',
    status:      params.status      ?? 'DRAFT',
    context:     params.context,
    metadata:    params.metadata,
    timeline:    params.timeline,
    attachments: Object.freeze([...(params.attachments ?? [])]),
    auditLog:    Object.freeze([...(params.auditLog    ?? [])]),
    version:     params.version ?? 1,
  };
}

// ─── Immutable update helpers ─────────────────────────────────────────────────

/** Returns a new GovernanceCase with the audit entry appended. */
export function addAuditEntry(
  governanceCase: GovernanceCase,
  entry:          CaseAuditLog,
): GovernanceCase {
  return {
    ...governanceCase,
    auditLog: Object.freeze([...governanceCase.auditLog, entry]),
    timeline: { ...governanceCase.timeline, updatedAt: entry.timestamp },
    version:  governanceCase.version + 1,
  };
}

/**
 * Returns a new GovernanceCase with the status set to newStatus.
 * Automatically appends a STATUS_CHANGED audit log entry.
 */
export function transitionCase(
  governanceCase: GovernanceCase,
  newStatus:      CaseStatus,
  actor:          string,
  timestamp?:     string,
): GovernanceCase {
  const ts = timestamp ?? new Date().toISOString();
  const entry = createCaseAuditLog({
    id:        `${governanceCase.id}-audit-${governanceCase.auditLog.length + 1}`,
    caseId:    governanceCase.id,
    action:    'STATUS_CHANGED',
    actor,
    timestamp: ts,
    details:   { from: governanceCase.status, to: newStatus },
  });
  return {
    ...governanceCase,
    status:   newStatus,
    auditLog: Object.freeze([...governanceCase.auditLog, entry]),
    timeline: {
      ...governanceCase.timeline,
      updatedAt: ts,
      closedAt:  newStatus === 'CLOSED' || newStatus === 'ARCHIVED' ? ts : governanceCase.timeline.closedAt,
    },
    version: governanceCase.version + 1,
  };
}

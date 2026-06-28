/**
 * Phase 19 — Case Model tests
 *
 * Groups (13 × 3 = 39):
 *   CM-01  (3)  createCase — id, title, status, version
 *   CM-02  (3)  createCase — attachments and auditLog are frozen
 *   CM-03  (3)  createCaseMetadata — domain, category, priority
 *   CM-04  (3)  createCaseMetadata — frozen tags and customFields
 *   CM-05  (3)  createCaseTimeline — createdAt, updatedAt, optional fields
 *   CM-06  (3)  createCaseAttachment — all fields preserved
 *   CM-07  (3)  createCaseAuditLog — id, caseId, action, actor, details
 *   CM-08  (3)  addAuditEntry — returns new case with appended entry
 *   CM-09  (3)  addAuditEntry — original case unchanged (version preserved)
 *   CM-10  (3)  transitionCase — status changes to newStatus
 *   CM-11  (3)  transitionCase — audit log grows; version increments
 *   CM-12  (3)  CASE_STATUSES — has 8 values and includes all expected statuses
 *   CM-13  (3)  CASE_PRIORITIES — has 4 values; createCase defaults
 */

import { describe, it, expect } from 'vitest';
import { generateGovernanceContext } from '../application/governanceContext';
import {
  CASE_STATUSES,
  CASE_PRIORITIES,
  createCase,
  createCaseAttachment,
  createCaseAuditLog,
  createCaseMetadata,
  createCaseTimeline,
  addAuditEntry,
  transitionCase,
} from '../cases/caseModel';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const CTX = generateGovernanceContext({
  actor:       { id: 'u-cm', role: 'UNIT_HEAD' },
  currentDate: '2024-06-01',
  requestId:   'req-cm-001',
});

const TIMELINE = createCaseTimeline({ createdAt: '2024-06-01T08:00:00Z', updatedAt: '2024-06-01T08:00:00Z' });
const META     = createCaseMetadata({ domain: 'ASSETS', category: 'EQUIPMENT', priority: 'HIGH' });

const BASE_CASE = createCase({
  id:       'case-001',
  title:    'Asset Registration: Server Equipment',
  context:  CTX,
  metadata: META,
  timeline: TIMELINE,
});

const ATTACHMENT = createCaseAttachment({
  id:         'att-001',
  name:       'Invoice.pdf',
  mimeType:   'application/pdf',
  sizeBytes:  102400,
  uploadedAt: '2024-06-01T09:00:00Z',
  uploadedBy: 'u-cm',
});

const AUDIT_ENTRY = createCaseAuditLog({
  id:        'log-001',
  caseId:    'case-001',
  action:    'SUBMITTED',
  actor:     'u-cm',
  timestamp: '2024-06-01T10:00:00Z',
  details:   { reason: 'Initial submission' },
});

// ─── CM-01: createCase — shape ────────────────────────────────────────────────

describe('CM-01 createCase id, title, status, version', () => {
  it('id is set', () => {
    expect(BASE_CASE.id).toBe('case-001');
  });
  it('title is set', () => {
    expect(BASE_CASE.title).toBe('Asset Registration: Server Equipment');
  });
  it('status defaults to DRAFT; version defaults to 1', () => {
    expect(BASE_CASE.status).toBe('DRAFT');
    expect(BASE_CASE.version).toBe(1);
  });
});

// ─── CM-02: createCase — frozen arrays ───────────────────────────────────────

describe('CM-02 createCase attachments and auditLog are frozen', () => {
  it('attachments is frozen', () => {
    expect(Object.isFrozen(BASE_CASE.attachments)).toBe(true);
  });
  it('auditLog is frozen', () => {
    expect(Object.isFrozen(BASE_CASE.auditLog)).toBe(true);
  });
  it('attachments and auditLog default to empty', () => {
    expect(BASE_CASE.attachments).toHaveLength(0);
    expect(BASE_CASE.auditLog).toHaveLength(0);
  });
});

// ─── CM-03: createCaseMetadata — shape ───────────────────────────────────────

describe('CM-03 createCaseMetadata domain, category, priority', () => {
  it('domain is set', () => {
    expect(META.domain).toBe('ASSETS');
  });
  it('category is set', () => {
    expect(META.category).toBe('EQUIPMENT');
  });
  it('priority is set', () => {
    expect(META.priority).toBe('HIGH');
  });
});

// ─── CM-04: createCaseMetadata — frozen collections ─────────────────────────

describe('CM-04 createCaseMetadata frozen tags and customFields', () => {
  it('tags is frozen', () => {
    expect(Object.isFrozen(META.tags)).toBe(true);
  });
  it('customFields is frozen', () => {
    expect(Object.isFrozen(META.customFields)).toBe(true);
  });
  it('priority defaults to MEDIUM when omitted', () => {
    const m = createCaseMetadata({ domain: 'ASSETS', category: 'LAND' });
    expect(m.priority).toBe('MEDIUM');
  });
});

// ─── CM-05: createCaseTimeline — shape ───────────────────────────────────────

describe('CM-05 createCaseTimeline createdAt, updatedAt, optional fields', () => {
  it('createdAt is set', () => {
    expect(TIMELINE.createdAt).toBe('2024-06-01T08:00:00Z');
  });
  it('updatedAt is set', () => {
    expect(TIMELINE.updatedAt).toBe('2024-06-01T08:00:00Z');
  });
  it('optional fields are undefined when omitted', () => {
    expect(TIMELINE.submittedAt).toBeUndefined();
    expect(TIMELINE.closedAt).toBeUndefined();
    expect(TIMELINE.deadline).toBeUndefined();
  });
});

// ─── CM-06: createCaseAttachment — shape ─────────────────────────────────────

describe('CM-06 createCaseAttachment all fields preserved', () => {
  it('id and name are set', () => {
    expect(ATTACHMENT.id).toBe('att-001');
    expect(ATTACHMENT.name).toBe('Invoice.pdf');
  });
  it('mimeType and sizeBytes are set', () => {
    expect(ATTACHMENT.mimeType).toBe('application/pdf');
    expect(ATTACHMENT.sizeBytes).toBe(102400);
  });
  it('uploadedAt and uploadedBy are set', () => {
    expect(ATTACHMENT.uploadedAt).toBe('2024-06-01T09:00:00Z');
    expect(ATTACHMENT.uploadedBy).toBe('u-cm');
  });
});

// ─── CM-07: createCaseAuditLog — shape ───────────────────────────────────────

describe('CM-07 createCaseAuditLog id, caseId, action, actor, details', () => {
  it('id, caseId, action are set', () => {
    expect(AUDIT_ENTRY.id).toBe('log-001');
    expect(AUDIT_ENTRY.caseId).toBe('case-001');
    expect(AUDIT_ENTRY.action).toBe('SUBMITTED');
  });
  it('actor and timestamp are set', () => {
    expect(AUDIT_ENTRY.actor).toBe('u-cm');
    expect(AUDIT_ENTRY.timestamp).toBe('2024-06-01T10:00:00Z');
  });
  it('details are frozen and preserved', () => {
    expect(Object.isFrozen(AUDIT_ENTRY.details)).toBe(true);
    expect(AUDIT_ENTRY.details['reason']).toBe('Initial submission');
  });
});

// ─── CM-08: addAuditEntry — appends to new case ───────────────────────────────

describe('CM-08 addAuditEntry returns new case with appended entry', () => {
  const updated = addAuditEntry(BASE_CASE, AUDIT_ENTRY);
  it('new case has one audit log entry', () => {
    expect(updated.auditLog).toHaveLength(1);
  });
  it('appended entry matches the provided entry', () => {
    expect(updated.auditLog[0]?.action).toBe('SUBMITTED');
  });
  it('version is incremented by 1', () => {
    expect(updated.version).toBe(BASE_CASE.version + 1);
  });
});

// ─── CM-09: addAuditEntry — original case unchanged ─────────────────────────

describe('CM-09 addAuditEntry original case version is preserved', () => {
  const updated = addAuditEntry(BASE_CASE, AUDIT_ENTRY);
  it('original case auditLog is still empty', () => {
    expect(BASE_CASE.auditLog).toHaveLength(0);
  });
  it('original case version is still 1', () => {
    expect(BASE_CASE.version).toBe(1);
  });
  it('updated timeline.updatedAt matches entry timestamp', () => {
    expect(updated.timeline.updatedAt).toBe(AUDIT_ENTRY.timestamp);
  });
});

// ─── CM-10: transitionCase — status changes ──────────────────────────────────

describe('CM-10 transitionCase status changes to newStatus', () => {
  const reviewed = transitionCase(BASE_CASE, 'UNDER_REVIEW', 'u-cm', '2024-06-02T08:00:00Z');
  it('new status is UNDER_REVIEW', () => {
    expect(reviewed.status).toBe('UNDER_REVIEW');
  });
  it('original status is still DRAFT', () => {
    expect(BASE_CASE.status).toBe('DRAFT');
  });
  it('transitionCase to CLOSED sets closedAt', () => {
    const closed = transitionCase(BASE_CASE, 'CLOSED', 'u-cm', '2024-06-03T08:00:00Z');
    expect(closed.timeline.closedAt).toBe('2024-06-03T08:00:00Z');
  });
});

// ─── CM-11: transitionCase — audit log and version ───────────────────────────

describe('CM-11 transitionCase audit log grows; version increments', () => {
  const reviewed = transitionCase(BASE_CASE, 'OPEN', 'u-cm', '2024-06-02T08:00:00Z');
  it('audit log has one STATUS_CHANGED entry', () => {
    expect(reviewed.auditLog).toHaveLength(1);
    expect(reviewed.auditLog[0]?.action).toBe('STATUS_CHANGED');
  });
  it('audit log entry details contain from and to fields', () => {
    expect(reviewed.auditLog[0]?.details['from']).toBe('DRAFT');
    expect(reviewed.auditLog[0]?.details['to']).toBe('OPEN');
  });
  it('version increments by 1', () => {
    expect(reviewed.version).toBe(2);
  });
});

// ─── CM-12: CASE_STATUSES ────────────────────────────────────────────────────

describe('CM-12 CASE_STATUSES has 8 values and is complete', () => {
  it('has exactly 8 status values', () => {
    expect(CASE_STATUSES).toHaveLength(8);
  });
  it('includes DRAFT, PENDING_APPROVAL, APPROVED, REJECTED', () => {
    expect([...CASE_STATUSES]).toContain('DRAFT');
    expect([...CASE_STATUSES]).toContain('PENDING_APPROVAL');
    expect([...CASE_STATUSES]).toContain('APPROVED');
    expect([...CASE_STATUSES]).toContain('REJECTED');
  });
  it('is frozen', () => {
    expect(Object.isFrozen(CASE_STATUSES)).toBe(true);
  });
});

// ─── CM-13: CASE_PRIORITIES and createCase defaults ──────────────────────────

describe('CM-13 CASE_PRIORITIES has 4 values; createCase defaults', () => {
  it('CASE_PRIORITIES has 4 values', () => {
    expect(CASE_PRIORITIES).toHaveLength(4);
  });
  it('CASE_PRIORITIES is frozen', () => {
    expect(Object.isFrozen(CASE_PRIORITIES)).toBe(true);
  });
  it('createCase defaults description to empty string', () => {
    expect(BASE_CASE.description).toBe('');
  });
});

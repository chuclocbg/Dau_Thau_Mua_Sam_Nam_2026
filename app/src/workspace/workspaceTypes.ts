/**
 * Phase 21 — Governance Workspace & Session Layer: Types
 *
 * The Workspace & Session Layer is the execution environment for every
 * capability.  Every capability call now executes inside a GovernanceSession,
 * and every GovernanceSession lives inside a GovernanceWorkspace.
 *
 * Workspace coordinates:
 *   Intent Resolution  → resolve user intent to capability domain
 *   Capability Routing → route to the registered capability
 *   Reasoning          → capability calls ReasoningEngine
 *   Workflow           → capability calls WorkflowOrchestrator
 *   Document Generation→ results stored in WorkspaceDocuments
 *   Multi-Agent        → (future) dispatched via WorkspaceEvents
 *
 * Value types (all immutable snapshots):
 *   SessionStatus        — ACTIVE | CLOSED | SUSPENDED
 *   WorkspaceStatus      — ACTIVE | CLOSED | ARCHIVED
 *   TaskStatus           — PENDING | IN_PROGRESS | COMPLETED | CANCELLED
 *   ApprovalStatus       — PENDING | APPROVED | REJECTED | CANCELLED
 *   WorkspaceEventType   — 11-value enum covering all lifecycle events
 *   ConversationMessage  — single message in a conversation turn
 *   ConversationContext  — ordered message history + resolved intents
 *   SessionMemory        — cached decisions + facts for a session
 *   ActiveCase           — currently active case within a session
 *   WorkspaceTimeline    — ordered event log for a workspace
 *   WorkspaceTask        — a trackable unit of work
 *   WorkspaceDocument    — a generated or uploaded document
 *   WorkspaceApproval    — an approval request with status
 *   GovernanceSession    — a user session within a workspace
 *   GovernanceWorkspace  — the top-level coordination container
 *
 * Factories: createWorkspace, createSession, createConversationContext,
 *   createSessionMemory, createActiveCase, createWorkspaceEvent,
 *   createWorkspaceTask, createWorkspaceDocument, createWorkspaceApproval
 *
 * Pure. No I/O. No side effects. No any. No React. No browser globals.
 */

import type { Actor }             from '../legal/workflowOrchestrator';
import type { GovernanceCase }    from '../cases/caseModel';
import type { GovernanceDecision }from '../reasoning/decisionModel';

// ─── Enumerations ─────────────────────────────────────────────────────────────

export type SessionStatus   = 'ACTIVE' | 'CLOSED' | 'SUSPENDED';
export type WorkspaceStatus = 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
export type TaskStatus      = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type ApprovalStatus  = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type WorkspaceEventType =
  | 'SESSION_CREATED'
  | 'SESSION_CLOSED'
  | 'CASE_ACTIVATED'
  | 'CASE_RESOLVED'
  | 'TASK_CREATED'
  | 'TASK_COMPLETED'
  | 'DOCUMENT_ADDED'
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_GRANTED'
  | 'APPROVAL_REJECTED'
  | 'CAPABILITY_EXECUTED';

export const WORKSPACE_EVENT_TYPES: readonly WorkspaceEventType[] = Object.freeze([
  'SESSION_CREATED', 'SESSION_CLOSED', 'CASE_ACTIVATED', 'CASE_RESOLVED',
  'TASK_CREATED', 'TASK_COMPLETED', 'DOCUMENT_ADDED', 'APPROVAL_REQUESTED',
  'APPROVAL_GRANTED', 'APPROVAL_REJECTED', 'CAPABILITY_EXECUTED',
] as const);

// ─── ConversationContext ──────────────────────────────────────────────────────

export interface ConversationMessage {
  readonly id:        string;
  readonly role:      'USER' | 'ASSISTANT' | 'SYSTEM';
  readonly content:   string;
  readonly timestamp: string;
}

export interface ConversationContext {
  readonly sessionId:       string;
  readonly turnId:          number;
  readonly messages:        readonly ConversationMessage[];
  readonly resolvedIntents: readonly string[];
}

export function createConversationContext(params: {
  readonly sessionId:        string;
  readonly turnId?:          number;
  readonly messages?:        readonly ConversationMessage[];
  readonly resolvedIntents?: readonly string[];
}): ConversationContext {
  return {
    sessionId:       params.sessionId,
    turnId:          params.turnId          ?? 0,
    messages:        Object.freeze([...(params.messages        ?? [])]),
    resolvedIntents: Object.freeze([...(params.resolvedIntents ?? [])]),
  };
}

// ─── SessionMemory ────────────────────────────────────────────────────────────

export interface SessionMemory {
  readonly sessionId:       string;
  readonly cachedDecisions: Readonly<Record<string, GovernanceDecision>>;
  readonly facts:           Readonly<Record<string, string>>;
}

export function createSessionMemory(params: {
  readonly sessionId:        string;
  readonly cachedDecisions?: Record<string, GovernanceDecision>;
  readonly facts?:           Record<string, string>;
}): SessionMemory {
  return {
    sessionId:       params.sessionId,
    cachedDecisions: Object.freeze({ ...(params.cachedDecisions ?? {}) }),
    facts:           Object.freeze({ ...(params.facts           ?? {}) }),
  };
}

// ─── ActiveCase ───────────────────────────────────────────────────────────────

export interface ActiveCase {
  readonly sessionId:      string;
  readonly governanceCase: GovernanceCase;
  readonly capability:     string;    // domain: PROCUREMENT | ASSETS | LEGAL | ...
  readonly activatedAt:    string;
}

export function createActiveCase(params: {
  readonly sessionId:      string;
  readonly governanceCase: GovernanceCase;
  readonly capability:     string;
  readonly activatedAt:    string;
}): ActiveCase {
  return { ...params };
}

// ─── WorkspaceTimeline ────────────────────────────────────────────────────────

export interface WorkspaceEvent {
  readonly id:          string;
  readonly workspaceId: string;
  readonly type:        WorkspaceEventType;
  readonly actor:       string;           // actor id
  readonly timestamp:   string;
  readonly payload:     Readonly<Record<string, string>>;
}

export interface WorkspaceTimeline {
  readonly workspaceId: string;
  readonly events:      readonly WorkspaceEvent[];
}

export function createWorkspaceEvent(params: {
  readonly id:          string;
  readonly workspaceId: string;
  readonly type:        WorkspaceEventType;
  readonly actor:       string;
  readonly timestamp:   string;
  readonly payload?:    Record<string, string>;
}): WorkspaceEvent {
  return {
    id:          params.id,
    workspaceId: params.workspaceId,
    type:        params.type,
    actor:       params.actor,
    timestamp:   params.timestamp,
    payload:     Object.freeze({ ...(params.payload ?? {}) }),
  };
}

// ─── WorkspaceTask ────────────────────────────────────────────────────────────

export interface WorkspaceTask {
  readonly id:          string;
  readonly workspaceId: string;
  readonly title:       string;
  readonly description: string;
  readonly status:      TaskStatus;
  readonly assignedTo:  string;
  readonly caseId?:     string;
  readonly dueDate?:    string;
  readonly createdAt:   string;
  readonly completedAt?: string;
}

export function createWorkspaceTask(params: {
  readonly id:           string;
  readonly workspaceId:  string;
  readonly title:        string;
  readonly description?: string;
  readonly status?:      TaskStatus;
  readonly assignedTo:   string;
  readonly caseId?:      string;
  readonly dueDate?:     string;
  readonly createdAt:    string;
  readonly completedAt?: string;
}): WorkspaceTask {
  return {
    id:          params.id,
    workspaceId: params.workspaceId,
    title:       params.title,
    description: params.description ?? '',
    status:      params.status      ?? 'PENDING',
    assignedTo:  params.assignedTo,
    caseId:      params.caseId,
    dueDate:     params.dueDate,
    createdAt:   params.createdAt,
    completedAt: params.completedAt,
  };
}

// ─── WorkspaceDocument ────────────────────────────────────────────────────────

export interface WorkspaceDocument {
  readonly id:          string;
  readonly workspaceId: string;
  readonly title:       string;
  readonly type:        string;
  readonly content:     string;
  readonly caseId?:     string;
  readonly generatedAt: string;
  readonly generatedBy: string;    // capability domain or actor id
}

export function createWorkspaceDocument(params: {
  readonly id:          string;
  readonly workspaceId: string;
  readonly title:       string;
  readonly type:        string;
  readonly content:     string;
  readonly caseId?:     string;
  readonly generatedAt: string;
  readonly generatedBy: string;
}): WorkspaceDocument {
  return { ...params };
}

// ─── WorkspaceApproval ────────────────────────────────────────────────────────

export interface WorkspaceApproval {
  readonly id:          string;
  readonly workspaceId: string;
  readonly caseId:      string;
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly approver:    string;
  readonly status:      ApprovalStatus;
  readonly decidedAt?:  string;
  readonly reason?:     string;
}

export function createWorkspaceApproval(params: {
  readonly id:          string;
  readonly workspaceId: string;
  readonly caseId:      string;
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly approver:    string;
  readonly status?:     ApprovalStatus;
  readonly decidedAt?:  string;
  readonly reason?:     string;
}): WorkspaceApproval {
  return {
    ...params,
    status: params.status ?? 'PENDING',
  };
}

// ─── GovernanceSession ────────────────────────────────────────────────────────

export interface GovernanceSession {
  readonly id:           string;
  readonly workspaceId:  string;
  readonly actor:        Actor;
  readonly startedAt:    string;
  readonly closedAt?:    string;
  readonly status:       SessionStatus;
  readonly activeCase?:  ActiveCase;
  readonly memory:       SessionMemory;
  readonly conversation: ConversationContext;
}

export function createSession(params: {
  readonly id:          string;
  readonly workspaceId: string;
  readonly actor:       Actor;
  readonly startedAt:   string;
  readonly closedAt?:   string;
  readonly status?:     SessionStatus;
  readonly activeCase?: ActiveCase;
  readonly memory?:     SessionMemory;
  readonly conversation?: ConversationContext;
}): GovernanceSession {
  return {
    id:           params.id,
    workspaceId:  params.workspaceId,
    actor:        params.actor,
    startedAt:    params.startedAt,
    closedAt:     params.closedAt,
    status:       params.status       ?? 'ACTIVE',
    activeCase:   params.activeCase,
    memory:       params.memory       ?? createSessionMemory({ sessionId: params.id }),
    conversation: params.conversation ?? createConversationContext({ sessionId: params.id }),
  };
}

// ─── GovernanceWorkspace ──────────────────────────────────────────────────────

export interface GovernanceWorkspace {
  readonly id:          string;
  readonly name:        string;
  readonly description: string;
  readonly status:      WorkspaceStatus;
  readonly sessions:    readonly GovernanceSession[];
  readonly timeline:    WorkspaceTimeline;
  readonly tasks:       readonly WorkspaceTask[];
  readonly documents:   readonly WorkspaceDocument[];
  readonly approvals:   readonly WorkspaceApproval[];
  readonly createdAt:   string;
  readonly updatedAt:   string;
}

export function createWorkspace(params: {
  readonly id:           string;
  readonly name:         string;
  readonly description?: string;
  readonly status?:      WorkspaceStatus;
  readonly sessions?:    readonly GovernanceSession[];
  readonly tasks?:       readonly WorkspaceTask[];
  readonly documents?:   readonly WorkspaceDocument[];
  readonly approvals?:   readonly WorkspaceApproval[];
  readonly timeline?:    WorkspaceTimeline;
  readonly createdAt:    string;
  readonly updatedAt?:   string;
}): GovernanceWorkspace {
  return {
    id:          params.id,
    name:        params.name,
    description: params.description ?? '',
    status:      params.status      ?? 'ACTIVE',
    sessions:    Object.freeze([...(params.sessions  ?? [])]),
    timeline:    params.timeline    ?? { workspaceId: params.id, events: Object.freeze([]) },
    tasks:       Object.freeze([...(params.tasks     ?? [])]),
    documents:   Object.freeze([...(params.documents ?? [])]),
    approvals:   Object.freeze([...(params.approvals ?? [])]),
    createdAt:   params.createdAt,
    updatedAt:   params.updatedAt ?? params.createdAt,
  };
}

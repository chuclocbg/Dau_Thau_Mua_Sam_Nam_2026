/**
 * Phase 21 — Governance Workspace & Session Layer: Session Manager
 *
 * WorkspaceSessionManager is the stateful coordinator for a single
 * GovernanceWorkspace.  It manages sessions, activates cases, caches
 * decisions, and tracks tasks, documents, approvals, and events.
 *
 * Capabilities no longer receive raw GovernanceContext.  They receive
 * a GovernanceSession (session context) + a GovernanceCase (domain input).
 *
 * Execution flow:
 *   1. buildWorkspaceSessionManager(name)     → WorkspaceSessionManager
 *   2. manager.createSession(actor)           → GovernanceSession
 *   3. manager.activateCase(sessionId, case)  → ActiveCase
 *   4. capability.execute(session, case)      → domain output
 *   5. manager.cacheDecision(sessionId, ...)  → void (stores in session memory)
 *   6. manager.addTask / addDocument / ...    → void (workspace-level tracking)
 *   7. manager.getWorkspace()                 → GovernanceWorkspace (snapshot)
 *
 * Public APIs (all stateful, return immutable snapshots):
 *   createSession(actor, id?)
 *   closeSession(sessionId)
 *   activateCase(sessionId, governanceCase, capability)
 *   cacheDecision(sessionId, caseId, decision)
 *   getCachedDecision(sessionId, caseId)
 *   addTask(task)
 *   addDocument(doc)
 *   requestApproval(approval)
 *   resolveApproval(approvalId, status, actor, reason?)
 *   addEvent(event)
 *   getWorkspace()
 *   getSession(sessionId)
 *   getActiveCase(sessionId)
 *   buildWorkspaceSessionManager(name, workspaceId?)  — factory
 *
 * The WorkspaceSessionManager holds mutable internal state.
 * getWorkspace() and getSession() return frozen immutable snapshots.
 *
 * No business logic. Pure orchestration. No UI. No HTTP. No React.
 * Pure. No side effects outside this class. No any. No browser globals.
 */

import type { Actor }              from '../legal/workflowOrchestrator';
import type { GovernanceCase }     from '../cases/caseModel';
import type { GovernanceDecision } from '../reasoning/decisionModel';
import {
  createSession,
  createSessionMemory,
  createConversationContext,
  createActiveCase,
  type ActiveCase,
  type GovernanceSession,
  type GovernanceWorkspace,
  type SessionStatus,
  type WorkspaceApproval,
  type WorkspaceDocument,
  type WorkspaceEvent,
  type WorkspaceTask,
} from './workspaceTypes';

// ─── Internal mutable session record ─────────────────────────────────────────

interface InternalSession {
  readonly id:          string;
  readonly workspaceId: string;
  readonly actor:       Actor;
  readonly startedAt:   string;
  closedAt?:            string;
  status:               SessionStatus;
  activeCase?:          ActiveCase;
  decisions:            Map<string, GovernanceDecision>;  // keyed by caseId
  facts:                Record<string, string>;
  messages:             Array<{ id: string; role: 'USER' | 'ASSISTANT' | 'SYSTEM'; content: string; timestamp: string }>;
  turnId:               number;
  resolvedIntents:      string[];
}

// ─── WorkspaceSessionManager ──────────────────────────────────────────────────

export class WorkspaceSessionManager {
  private readonly sessions:   Map<string, InternalSession> = new Map();
  private readonly tasks:      WorkspaceTask[]              = [];
  private readonly documents:  WorkspaceDocument[]          = [];
  private readonly approvals:  Map<string, WorkspaceApproval> = new Map();
  private readonly events:     WorkspaceEvent[]             = [];
  private sessionCounter       = 0;
  private workspaceUpdatedAt:  string;

  constructor(
    private readonly workspaceId:   string,
    private readonly workspaceName: string,
    private readonly workspaceDescription: string,
    private readonly workspaceCreatedAt:   string,
  ) {
    this.workspaceUpdatedAt = workspaceCreatedAt;
  }

  // ── Session lifecycle ────────────────────────────────────────────────────

  createSession(actor: Actor, id?: string): GovernanceSession {
    const sessionId  = id ?? `${this.workspaceId}-s${++this.sessionCounter}`;
    const startedAt  = new Date().toISOString();
    const internal: InternalSession = {
      id:          sessionId,
      workspaceId: this.workspaceId,
      actor,
      startedAt,
      status:      'ACTIVE',
      decisions:   new Map(),
      facts:       {},
      messages:    [],
      turnId:      0,
      resolvedIntents: [],
    };
    this.sessions.set(sessionId, internal);
    this.workspaceUpdatedAt = startedAt;
    return this.toSession(internal);
  }

  closeSession(sessionId: string): void {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    s.status   = 'CLOSED';
    s.closedAt = new Date().toISOString();
    this.workspaceUpdatedAt = s.closedAt;
  }

  // ── Case activation ──────────────────────────────────────────────────────

  activateCase(
    sessionId:      string,
    governanceCase: GovernanceCase,
    capability:     string,
  ): ActiveCase {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error(`Session '${sessionId}' not found.`);
    const active = createActiveCase({
      sessionId,
      governanceCase,
      capability,
      activatedAt: new Date().toISOString(),
    });
    s.activeCase = active;
    this.workspaceUpdatedAt = active.activatedAt;
    return active;
  }

  // ── Decision cache ───────────────────────────────────────────────────────

  cacheDecision(
    sessionId:  string,
    caseId:     string,
    decision:   GovernanceDecision,
  ): void {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error(`Session '${sessionId}' not found.`);
    s.decisions.set(caseId, decision);
    this.workspaceUpdatedAt = new Date().toISOString();
  }

  getCachedDecision(sessionId: string, caseId: string): GovernanceDecision | undefined {
    return this.sessions.get(sessionId)?.decisions.get(caseId);
  }

  // ── Workspace-level tracking ─────────────────────────────────────────────

  addTask(task: WorkspaceTask): void {
    this.tasks.push(task);
    this.workspaceUpdatedAt = new Date().toISOString();
  }

  addDocument(doc: WorkspaceDocument): void {
    this.documents.push(doc);
    this.workspaceUpdatedAt = new Date().toISOString();
  }

  requestApproval(approval: WorkspaceApproval): void {
    this.approvals.set(approval.id, approval);
    this.workspaceUpdatedAt = new Date().toISOString();
  }

  resolveApproval(
    approvalId: string,
    status:     'APPROVED' | 'REJECTED',
    actor:      string,
    reason?:    string,
  ): void {
    const existing = this.approvals.get(approvalId);
    if (!existing) throw new Error(`Approval '${approvalId}' not found.`);
    const decidedAt = new Date().toISOString();
    this.approvals.set(approvalId, { ...existing, status, decidedAt, reason });
    this.workspaceUpdatedAt = decidedAt;
  }

  addEvent(event: WorkspaceEvent): void {
    this.events.push(event);
    this.workspaceUpdatedAt = new Date().toISOString();
  }

  // ── Snapshot queries ─────────────────────────────────────────────────────

  getSession(sessionId: string): GovernanceSession | undefined {
    const s = this.sessions.get(sessionId);
    return s ? this.toSession(s) : undefined;
  }

  getActiveCase(sessionId: string): ActiveCase | undefined {
    return this.sessions.get(sessionId)?.activeCase;
  }

  getWorkspace(): GovernanceWorkspace {
    const sessionSnapshots = [...this.sessions.values()].map(s => this.toSession(s));
    return {
      id:          this.workspaceId,
      name:        this.workspaceName,
      description: this.workspaceDescription,
      status:      'ACTIVE',
      sessions:    Object.freeze(sessionSnapshots),
      timeline:    { workspaceId: this.workspaceId, events: Object.freeze([...this.events]) },
      tasks:       Object.freeze([...this.tasks]),
      documents:   Object.freeze([...this.documents]),
      approvals:   Object.freeze([...this.approvals.values()]),
      createdAt:   this.workspaceCreatedAt,
      updatedAt:   this.workspaceUpdatedAt,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private toSession(s: InternalSession): GovernanceSession {
    return createSession({
      id:          s.id,
      workspaceId: s.workspaceId,
      actor:       s.actor,
      startedAt:   s.startedAt,
      closedAt:    s.closedAt,
      status:      s.status,
      activeCase:  s.activeCase,
      memory:      createSessionMemory({
        sessionId:       s.id,
        cachedDecisions: Object.fromEntries(s.decisions),
        facts:           { ...s.facts },
      }),
      conversation: createConversationContext({
        sessionId:       s.id,
        turnId:          s.turnId,
        messages:        [...s.messages],
        resolvedIntents: [...s.resolvedIntents],
      }),
    });
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function buildWorkspaceSessionManager(
  name:         string,
  workspaceId?: string,
  description?: string,
): WorkspaceSessionManager {
  const id        = workspaceId ?? `ws-${Date.now()}`;
  const createdAt = new Date().toISOString();
  return new WorkspaceSessionManager(id, name, description ?? '', createdAt);
}

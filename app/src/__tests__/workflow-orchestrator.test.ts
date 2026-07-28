/**
 * Phase 12 — Workflow Orchestrator tests
 *
 * Groups (13 × 3 = 39):
 *   WO-01  (3)  createWorkflow — registration
 *   WO-02  (3)  startWorkflow — instance creation
 *   WO-03  (3)  transition — successful state change
 *   WO-04  (3)  transition — guard failure blocks transition
 *   WO-05  (3)  transition — invalid trigger or inactive instance
 *   WO-06  (3)  rollback — reverts to previous state
 *   WO-07  (3)  suspend/resume lifecycle
 *   WO-08  (3)  cancel — terminal cancellation
 *   WO-09  (3)  getHistory — append-only audit trail
 *   WO-10  (3)  getCurrentState — state definition lookup
 *   WO-11  (3)  getPendingApprovals — approval step query
 *   WO-12  (3)  event publishing
 *   WO-13  (3)  factory + terminal state status mapping
 */

import { describe, it, expect, vi } from 'vitest';
import { createConfig }              from '../legal/governanceConfig';
import { createInMemoryRepository }  from '../legal/configRepository';
import { buildConfigResolver }       from '../legal/configResolver';
import { buildGovernanceRuleEngine } from '../legal/governanceRuleEngine';
import { createGovernanceEventBus }  from '../legal/governanceEvents';
import {
  WorkflowOrchestrator,
  buildWorkflowOrchestrator,
} from '../legal/workflowOrchestrator';
import type { GovernanceConfig }                    from '../legal/governanceConfig';
import type { WorkflowDefinition, Actor }           from '../legal/workflowOrchestrator';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DATE = '2024-06-01';

const AUTH_UNIT = createConfig({
  id: 'auth-unit', type: 'AUTHORITY_MATRIX', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-auth',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['auth'],
  metadata: { role: 'UNIT_HEAD', maxAmount: '50000000' },
});

const ACTOR: Actor      = { id: 'u-001', role: 'UNIT_HEAD', name: 'Test User' };
const DIRECTOR: Actor   = { id: 'u-002', role: 'DIRECTOR' };

// ─── Workflow definitions ─────────────────────────────────────────────────────

/** Two-state, no-guard workflow */
const SIMPLE_DEF: WorkflowDefinition = {
  id: 'simple', name: 'Simple',
  initialState: 'DRAFT',
  states: [
    { id: 'DRAFT', name: 'Draft',  type: 'INITIAL' },
    { id: 'DONE',  name: 'Done',   type: 'FINAL' },
  ],
  transitions: [
    { id: 't1', from: 'DRAFT', to: 'DONE', trigger: 'complete' },
  ],
};

/** Multi-state workflow with APPROVAL state and AUTHORITY_CHECK guard */
const APPROVAL_DEF: WorkflowDefinition = {
  id: 'approval', name: 'Approval Workflow',
  initialState: 'DRAFT',
  states: [
    { id: 'DRAFT',    name: 'Draft',    type: 'INITIAL' },
    { id: 'REVIEW',   name: 'Review',   type: 'APPROVAL',
      approvalStep: { id: 'as-001', role: 'UNIT_HEAD', requiredCount: 1 } },
    { id: 'APPROVED', name: 'Approved', type: 'FINAL' },
    { id: 'REJECTED', name: 'Rejected', type: 'CANCELLED' },
  ],
  transitions: [
    { id: 't-sub', from: 'DRAFT',   to: 'REVIEW',   trigger: 'submit' },
    { id: 't-app', from: 'REVIEW',  to: 'APPROVED', trigger: 'approve',
      guards: [{ type: 'AUTHORITY_CHECK' }] },
    { id: 't-rej', from: 'REVIEW',  to: 'REJECTED', trigger: 'reject' },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOrchestrator(configs: GovernanceConfig[] = []) {
  const repo        = createInMemoryRepository(configs);
  const resolver    = buildConfigResolver(repo);
  const ruleEngine  = buildGovernanceRuleEngine(resolver);
  const eventBus    = createGovernanceEventBus();
  const orchestrator = buildWorkflowOrchestrator(ruleEngine, eventBus);
  return { orchestrator, eventBus };
}

/** Start a fresh orchestrator with a registered definition and an active instance. */
function startedInstance(
  def: WorkflowDefinition,
  configs: GovernanceConfig[] = [],
  ctx: Record<string, string> = {},
) {
  const { orchestrator, eventBus } = makeOrchestrator(configs);
  orchestrator.createWorkflow(def);
  const instance = orchestrator.startWorkflow(def.id, `inst-${def.id}`, ACTOR, ctx);
  return { orchestrator, eventBus, instance };
}

// ── WO-01 createWorkflow ──────────────────────────────────────────────────────

describe('WO-01 createWorkflow', () => {
  it('WO-01-01 registered definition is accessible via getCurrentState', () => {
    const { orchestrator } = makeOrchestrator();
    orchestrator.createWorkflow(SIMPLE_DEF);
    orchestrator.startWorkflow('simple', 'i1', ACTOR);
    expect(orchestrator.getCurrentState('i1')?.id).toBe('DRAFT');
  });

  it('WO-01-02 registering the same definition id twice throws', () => {
    const { orchestrator } = makeOrchestrator();
    orchestrator.createWorkflow(SIMPLE_DEF);
    expect(() => orchestrator.createWorkflow(SIMPLE_DEF)).toThrow();
  });

  it('WO-01-03 startWorkflow throws when definition not registered', () => {
    const { orchestrator } = makeOrchestrator();
    expect(() => orchestrator.startWorkflow('ghost', 'i1', ACTOR)).toThrow();
  });
});

// ── WO-02 startWorkflow ───────────────────────────────────────────────────────

describe('WO-02 startWorkflow', () => {
  it('WO-02-01 instance starts in the definition initialState', () => {
    const { instance } = startedInstance(SIMPLE_DEF);
    expect(instance.currentState).toBe('DRAFT');
    expect(instance.definitionId).toBe('simple');
  });

  it('WO-02-02 instance status is ACTIVE', () => {
    const { instance } = startedInstance(SIMPLE_DEF);
    expect(instance.status).toBe('ACTIVE');
  });

  it('WO-02-03 instance has exactly one history entry on start', () => {
    const { instance } = startedInstance(SIMPLE_DEF);
    expect(instance.history).toHaveLength(1);
    expect(instance.history[0]!.outcome).toBe('SUCCESS');
    expect(instance.history[0]!.fromState).toBeNull();
    expect(instance.history[0]!.toState).toBe('DRAFT');
  });
});

// ── WO-03 transition success ──────────────────────────────────────────────────

describe('WO-03 transition success', () => {
  it('WO-03-01 successful transition updates currentState', () => {
    const { orchestrator } = startedInstance(SIMPLE_DEF);
    const result = orchestrator.transition(`inst-simple`, 'complete', ACTOR);
    expect(result.ok).toBe(true);
    expect(result.instance?.currentState).toBe('DONE');
  });

  it('WO-03-02 history grows by one entry on each transition', () => {
    const { orchestrator } = startedInstance(SIMPLE_DEF);
    orchestrator.transition('inst-simple', 'complete', ACTOR);
    expect(orchestrator.getHistory('inst-simple')).toHaveLength(2);
  });

  it('WO-03-03 history entry records correct fromState, toState, and trigger', () => {
    const { orchestrator } = startedInstance(SIMPLE_DEF);
    orchestrator.transition('inst-simple', 'complete', ACTOR);
    const last = orchestrator.getHistory('inst-simple').at(-1)!;
    expect(last.fromState).toBe('DRAFT');
    expect(last.toState).toBe('DONE');
    expect(last.trigger).toBe('complete');
    expect(last.outcome).toBe('SUCCESS');
  });
});

// ── WO-04 guard failure ───────────────────────────────────────────────────────

describe('WO-04 transition guard failure', () => {
  it('WO-04-01 AUTHORITY_CHECK guard with 100M (> 50M limit) returns ok:false', () => {
    // AUTH_UNIT allows UNIT_HEAD up to 50M; context has 100M → REJECTED → guard fails
    const { orchestrator } = startedInstance(APPROVAL_DEF, [AUTH_UNIT], {
      asOfDate: DATE, actorRole: 'UNIT_HEAD', amount: '100000000',
    });
    orchestrator.transition('inst-approval', 'submit', ACTOR);
    const result = orchestrator.transition('inst-approval', 'approve', ACTOR);
    expect(result.ok).toBe(false);
  });

  it('WO-04-02 instance state is unchanged after guard failure', () => {
    const { orchestrator } = startedInstance(APPROVAL_DEF, [AUTH_UNIT], {
      asOfDate: DATE, actorRole: 'UNIT_HEAD', amount: '100000000',
    });
    orchestrator.transition('inst-approval', 'submit', ACTOR);
    orchestrator.transition('inst-approval', 'approve', ACTOR);
    expect(orchestrator.getCurrentState('inst-approval')?.id).toBe('REVIEW');
  });

  it('WO-04-03 TransitionResult.guardResult is populated on guard failure', () => {
    const { orchestrator } = startedInstance(APPROVAL_DEF, [AUTH_UNIT], {
      asOfDate: DATE, actorRole: 'UNIT_HEAD', amount: '100000000',
    });
    orchestrator.transition('inst-approval', 'submit', ACTOR);
    const result = orchestrator.transition('inst-approval', 'approve', ACTOR);
    expect(result.guardResult?.verdict).toBe('REJECTED');
  });
});

// ── WO-05 invalid trigger / inactive instance ─────────────────────────────────

describe('WO-05 invalid trigger or inactive instance', () => {
  it('WO-05-01 unknown trigger returns ok:false', () => {
    const { orchestrator } = startedInstance(SIMPLE_DEF);
    expect(orchestrator.transition('inst-simple', 'ghost-trigger', ACTOR).ok).toBe(false);
  });

  it('WO-05-02 transition on non-existent instance returns ok:false without throwing', () => {
    const { orchestrator } = makeOrchestrator();
    expect(orchestrator.transition('no-such-id', 'complete', ACTOR).ok).toBe(false);
  });

  it('WO-05-03 transition on a CANCELLED instance returns ok:false', () => {
    const { orchestrator } = startedInstance(SIMPLE_DEF);
    orchestrator.cancel('inst-simple', ACTOR, 'test');
    expect(orchestrator.transition('inst-simple', 'complete', ACTOR).ok).toBe(false);
  });
});

// ── WO-06 rollback ────────────────────────────────────────────────────────────

describe('WO-06 rollback', () => {
  it('WO-06-01 rollback reverts currentState to the previous state', () => {
    const { orchestrator } = startedInstance(APPROVAL_DEF);
    orchestrator.transition('inst-approval', 'submit', ACTOR);  // DRAFT → REVIEW
    orchestrator.rollback('inst-approval', ACTOR);               // → DRAFT
    expect(orchestrator.getCurrentState('inst-approval')?.id).toBe('DRAFT');
  });

  it('WO-06-02 rollback at the initial state returns ok:false', () => {
    const { orchestrator } = startedInstance(APPROVAL_DEF);
    // Still in DRAFT (no transitions yet)
    expect(orchestrator.rollback('inst-approval', ACTOR).ok).toBe(false);
  });

  it('WO-06-03 rollback history entry has outcome ROLLED_BACK', () => {
    const { orchestrator } = startedInstance(APPROVAL_DEF);
    orchestrator.transition('inst-approval', 'submit', ACTOR);
    orchestrator.rollback('inst-approval', ACTOR);
    const last = orchestrator.getHistory('inst-approval').at(-1)!;
    expect(last.outcome).toBe('ROLLED_BACK');
    expect(last.toState).toBe('DRAFT');
  });
});

// ── WO-07 suspend / resume ────────────────────────────────────────────────────

describe('WO-07 suspend and resume', () => {
  it('WO-07-01 resumed instance status returns to ACTIVE', () => {
    const { orchestrator } = startedInstance(SIMPLE_DEF);
    orchestrator.suspend('inst-simple', ACTOR);
    const result = orchestrator.resume('inst-simple', ACTOR);
    expect(result.ok).toBe(true);
    expect(result.instance?.status).toBe('ACTIVE');
  });

  it('WO-07-02 resuming a non-SUSPENDED instance returns ok:false', () => {
    const { orchestrator } = startedInstance(SIMPLE_DEF);
    // Instance is ACTIVE, not SUSPENDED
    expect(orchestrator.resume('inst-simple', ACTOR).ok).toBe(false);
  });

  it('WO-07-03 resume adds a RESUMED history entry', () => {
    const { orchestrator } = startedInstance(SIMPLE_DEF);
    orchestrator.suspend('inst-simple', ACTOR);
    orchestrator.resume('inst-simple', ACTOR);
    const last = orchestrator.getHistory('inst-simple').at(-1)!;
    expect(last.outcome).toBe('RESUMED');
    expect(last.toState).toBe('DRAFT');  // state unchanged
  });
});

// ── WO-08 cancel ──────────────────────────────────────────────────────────────

describe('WO-08 cancel', () => {
  it('WO-08-01 cancel an ACTIVE instance → status CANCELLED', () => {
    const { orchestrator } = startedInstance(SIMPLE_DEF);
    const result = orchestrator.cancel('inst-simple', ACTOR, 'User requested cancellation');
    expect(result.ok).toBe(true);
    expect(result.instance?.status).toBe('CANCELLED');
  });

  it('WO-08-02 cancelling a COMPLETED instance returns ok:false', () => {
    const { orchestrator } = startedInstance(SIMPLE_DEF);
    orchestrator.transition('inst-simple', 'complete', ACTOR);  // → DONE (FINAL → COMPLETED)
    expect(orchestrator.cancel('inst-simple', ACTOR, 'late cancel').ok).toBe(false);
  });

  it('WO-08-03 cancel adds a CANCELLED history entry with the reason', () => {
    const { orchestrator } = startedInstance(SIMPLE_DEF);
    orchestrator.cancel('inst-simple', ACTOR, 'withdrawn by requester');
    const last = orchestrator.getHistory('inst-simple').at(-1)!;
    expect(last.outcome).toBe('CANCELLED');
    expect(last.reason).toContain('withdrawn by requester');
  });
});

// ── WO-09 getHistory ──────────────────────────────────────────────────────────

describe('WO-09 getHistory', () => {
  it('WO-09-01 getHistory returns entries in chronological order', () => {
    const { orchestrator } = startedInstance(APPROVAL_DEF);
    orchestrator.transition('inst-approval', 'submit', ACTOR);
    const hist = orchestrator.getHistory('inst-approval');
    expect(hist[0]!.toState).toBe('DRAFT');
    expect(hist[1]!.toState).toBe('REVIEW');
  });

  it('WO-09-02 getHistory for unknown instanceId returns empty array', () => {
    const { orchestrator } = makeOrchestrator();
    expect(orchestrator.getHistory('no-such')).toHaveLength(0);
  });

  it('WO-09-03 history length grows with each operation', () => {
    const { orchestrator } = startedInstance(APPROVAL_DEF);
    expect(orchestrator.getHistory('inst-approval')).toHaveLength(1); // start
    orchestrator.transition('inst-approval', 'submit', ACTOR);
    expect(orchestrator.getHistory('inst-approval')).toHaveLength(2);
    orchestrator.rollback('inst-approval', ACTOR);
    expect(orchestrator.getHistory('inst-approval')).toHaveLength(3);
  });
});

// ── WO-10 getCurrentState ─────────────────────────────────────────────────────

describe('WO-10 getCurrentState', () => {
  it('WO-10-01 getCurrentState returns the WorkflowStateDefinition for the current state', () => {
    const { orchestrator } = startedInstance(SIMPLE_DEF);
    const state = orchestrator.getCurrentState('inst-simple');
    expect(state?.id).toBe('DRAFT');
    expect(state?.type).toBe('INITIAL');
  });

  it('WO-10-02 getCurrentState returns undefined for an unknown instanceId', () => {
    const { orchestrator } = makeOrchestrator();
    expect(orchestrator.getCurrentState('ghost')).toBeUndefined();
  });

  it('WO-10-03 getCurrentState reflects the state after a transition', () => {
    const { orchestrator } = startedInstance(APPROVAL_DEF);
    orchestrator.transition('inst-approval', 'submit', ACTOR);
    expect(orchestrator.getCurrentState('inst-approval')?.id).toBe('REVIEW');
    expect(orchestrator.getCurrentState('inst-approval')?.type).toBe('APPROVAL');
  });
});

// ── WO-11 getPendingApprovals ─────────────────────────────────────────────────

describe('WO-11 getPendingApprovals', () => {
  it('WO-11-01 returns the ApprovalStep when in an APPROVAL state', () => {
    const { orchestrator } = startedInstance(APPROVAL_DEF);
    orchestrator.transition('inst-approval', 'submit', ACTOR);  // → REVIEW
    const approvals = orchestrator.getPendingApprovals('inst-approval');
    expect(approvals).toHaveLength(1);
    expect(approvals[0]!.role).toBe('UNIT_HEAD');
  });

  it('WO-11-02 returns empty array for a non-APPROVAL state (INITIAL)', () => {
    const { orchestrator } = startedInstance(SIMPLE_DEF);
    expect(orchestrator.getPendingApprovals('inst-simple')).toHaveLength(0);
  });

  it('WO-11-03 returns empty array for an unknown instanceId', () => {
    const { orchestrator } = makeOrchestrator();
    expect(orchestrator.getPendingApprovals('ghost')).toHaveLength(0);
  });
});

// ── WO-12 event publishing ────────────────────────────────────────────────────

describe('WO-12 event publishing', () => {
  it('WO-12-01 startWorkflow publishes a ConfigurationUpdated event', () => {
    const { orchestrator, eventBus } = makeOrchestrator();
    const handler = vi.fn();
    eventBus.subscribe('ConfigurationUpdated', handler);
    orchestrator.createWorkflow(SIMPLE_DEF);
    orchestrator.startWorkflow('simple', 'ev-01', ACTOR);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('WO-12-02 successful transition publishes a ConfigurationUpdated event', () => {
    const { orchestrator, eventBus } = makeOrchestrator();
    const handler = vi.fn();
    orchestrator.createWorkflow(SIMPLE_DEF);
    orchestrator.startWorkflow('simple', 'ev-02', ACTOR);
    eventBus.subscribe('ConfigurationUpdated', handler);
    orchestrator.transition('ev-02', 'complete', ACTOR);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('WO-12-03 cancel publishes a ConfigurationInvalidated event', () => {
    const { orchestrator, eventBus } = makeOrchestrator();
    orchestrator.createWorkflow(SIMPLE_DEF);
    orchestrator.startWorkflow('simple', 'ev-03', ACTOR);
    const handler = vi.fn();
    eventBus.subscribe('ConfigurationInvalidated', handler);
    orchestrator.cancel('ev-03', ACTOR, 'test cancellation');
    expect(handler).toHaveBeenCalledOnce();
  });
});

// ── WO-13 factory + terminal state mapping ────────────────────────────────────

describe('WO-13 factory and terminal status', () => {
  it('WO-13-01 buildWorkflowOrchestrator returns a WorkflowOrchestrator', () => {
    const { orchestrator } = makeOrchestrator();
    expect(orchestrator).toBeInstanceOf(WorkflowOrchestrator);
  });

  it('WO-13-02 transition to FINAL state → instance status COMPLETED', () => {
    const { orchestrator } = startedInstance(SIMPLE_DEF);
    const result = orchestrator.transition('inst-simple', 'complete', ACTOR);
    expect(result.instance?.status).toBe('COMPLETED');
    expect(result.instance?.completedAt).toBeDefined();
  });

  it('WO-13-03 transition to CANCELLED state → instance status CANCELLED', () => {
    // Use APPROVAL_DEF: REVIEW --reject--> REJECTED (CANCELLED state type)
    const { orchestrator } = startedInstance(APPROVAL_DEF);
    orchestrator.transition('inst-approval', 'submit', ACTOR);
    const result = orchestrator.transition('inst-approval', 'reject', DIRECTOR);
    expect(result.instance?.status).toBe('CANCELLED');
    expect(result.instance?.completedAt).toBeDefined();
  });
});

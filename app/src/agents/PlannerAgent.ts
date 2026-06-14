/**
 * P6-01B: PlannerAgent.ts — schema declarations + class stub.
 *
 * Algorithms were implemented in P6-01C as separate modules.
 * They are re-exported here so consumers can import everything
 * from a single entry point ('../agents/PlannerAgent').
 *
 * Class body (state machine) will be filled in P6-01D.
 */

import type { AgentId, AgentMessage, IAgent } from './types';
import type { AgentRegistry }                 from './AgentRegistry';
import type { AISuggestion }                  from '../ai/packageGenerator';
import type { LegalFinding }                  from '../ai/legalReviewer';
import type { WorkflowResult }                from '../ai/workflowOrchestrator';

// P6-01C types — imported locally for use in interfaces below, then re-exported
import type { AuthorityCheck }                             from './validateAuthority';
import type { Quarter, CalendarEntry, ProcurementCalendar } from './buildCalendar';

export type { AuthorityCheck };
export type { Quarter, CalendarEntry, ProcurementCalendar };

// P6-01C functions — re-exported as unified public API
export { validateAuthority }                                    from './validateAuthority';
export { assignQuarter, getProcurementLeadTime, buildCalendar } from './buildCalendar';
export { parseGoalIntoItems, detectPackageSplitting, generateTraceId } from './detectPackageSplitting';

// ─── PlannerInput ─────────────────────────────────────────────────────────────

export interface PlannerInput {
  /** Vietnamese natural-language procurement goal to parse. */
  naturalLanguageGoal: string;
  budgetYear: number;
  totalBudget?: number;
  existingPackages?: AISuggestion[];
  deepAnalysis?: boolean;
  requestedBy?: string;
}

// ─── SplitWarningPayload ──────────────────────────────────────────────────────

/** Payload carried by a broadcast 'event' when split-detection fires. */
export interface SplitWarningPayload {
  category: string;
  packages: AISuggestion[];
  /** LegalFinding.legalBasis is string (single citation), not string[]. */
  finding: LegalFinding;
}

// ─── PlannerState ─────────────────────────────────────────────────────────────

export type PlannerState =
  | 'idle'
  | 'parsing-goal'
  | 'detecting-split'
  | 'validating-authority'
  | 'building-calendar'
  | 'composing-response';

// ─── PlannerStateEvent ────────────────────────────────────────────────────────

/** Emitted to the registry on every state transition. */
export interface PlannerStateEvent {
  previousState: PlannerState;
  nextState:     PlannerState;
  timestamp:     number;
  detail?:       string;
}

// ─── PlannerOutput ────────────────────────────────────────────────────────────

export interface PlannerOutput {
  packages:          AISuggestion[];
  splitWarnings:     LegalFinding[];
  authorityChecks:   AuthorityCheck[];
  calendar:          ProcurementCalendar;
  totalEstimated:    number;
  /** -1 when PlannerInput.totalBudget was not provided. */
  budgetUtilization: number;
  /** ≥ 1 legal citation; always includes the KHLCNT foundation reference. */
  legalBasis:        string[];
  confidence:        'high' | 'medium' | 'low';
  warnings:          string[];
  /** Only present when PlannerInput.deepAnalysis === true. */
  workflowResults?:  WorkflowResult[];
}

// ─── PlannerAgent class stub ──────────────────────────────────────────────────

export class PlannerAgent implements IAgent {
  readonly id   = 'planner' as const;
  readonly name = 'Procurement Planner Agent';

  constructor(_registry: AgentRegistry) {}

  async process(_msg: AgentMessage): Promise<AgentMessage> {
    throw new Error('PlannerAgent.process() not yet implemented — complete P6-01D first');
  }

  getCapabilities(): string[] {
    return [
      'annual-procurement-planning',
      'package-split-detection',
      'authority-validation',
      'procurement-calendar',
    ];
  }
}

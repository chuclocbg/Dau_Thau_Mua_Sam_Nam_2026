/**
 * P6-01D: PlannerAgent — full class implementation.
 *
 * State machine:
 *   idle → parsing-goal → detecting-split → validating-authority
 *        → building-calendar → composing-response → idle
 *
 * P5 deep-analysis integration (buildMinimalProcurementPackage, runWorkflow)
 * is deferred to P6-01E.
 */

// ─── Type-only imports ────────────────────────────────────────────────────────

import type { AgentId, AgentMessage, IAgent }               from './types';
import type { AgentRegistry }                               from './AgentRegistry';
import type { AISuggestion }                                from '../ai/packageGenerator';
import type { LegalFinding }                                from '../ai/legalReviewer';
import type { WorkflowResult }                              from '../ai/workflowOrchestrator';
import type { AuthorityCheck }                              from './validateAuthority';
import type { Quarter, CalendarEntry, ProcurementCalendar } from './buildCalendar';

// ─── Runtime imports — P6-01C algorithms (used in class body) ─────────────────

import { generateTraceId, parseGoalIntoItems, detectPackageSplitting } from './detectPackageSplitting';
import { validateAuthority }                                            from './validateAuthority';
import { assignQuarter, getProcurementLeadTime, buildCalendar }        from './buildCalendar';

// ─── Runtime import — P5 function called in process() ─────────────────────────

import { generatePackageSuggestion }                                    from '../ai/packageGenerator';

// ─── Re-export types (P6-01C) as unified public API ──────────────────────────

export type { AuthorityCheck };
export type { Quarter, CalendarEntry, ProcurementCalendar };

// ─── Re-export functions (P6-01C) as unified public API ──────────────────────

export { generateTraceId, parseGoalIntoItems, detectPackageSplitting };
export { validateAuthority };
export { assignQuarter, getProcurementLeadTime, buildCalendar };

// ─── PlannerInput ─────────────────────────────────────────────────────────────

export interface PlannerInput {
  /** Vietnamese natural-language procurement goal to parse into packages. */
  naturalLanguageGoal: string;
  budgetYear:          number;
  totalBudget?:        number;
  existingPackages?:   AISuggestion[];
  deepAnalysis?:       boolean;
  requestedBy?:        string;
}

// ─── SplitWarningPayload ──────────────────────────────────────────────────────

/** Payload broadcast when detectPackageSplitting fires a CRITICAL finding. */
export interface SplitWarningPayload {
  category: string;
  packages: AISuggestion[];
  /** LegalFinding.legalBasis is string (single citation), not string[]. */
  finding:  LegalFinding;
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

/** Emitted to the registry trace on every state transition. */
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
  /** ≥ 1 citation; always includes the KHLCNT foundation reference. */
  legalBasis:        string[];
  confidence:        'high' | 'medium' | 'low';
  warnings:          string[];
  /** Only present when PlannerInput.deepAnalysis === true (wired in P6-01E). */
  workflowResults?:  WorkflowResult[];
}

// ─── PlannerAgent ─────────────────────────────────────────────────────────────

export class PlannerAgent implements IAgent {
  readonly id   = 'planner' as const;
  readonly name = 'Procurement Planner Agent';

  private state:          PlannerState  = 'idle';
  private currentTraceId: string | null = null;
  private readonly registry: AgentRegistry;

  constructor(registry: AgentRegistry) {
    this.registry = registry;
  }

  getCapabilities(): string[] {
    return [
      'annual-procurement-planning',
      'package-split-detection',
      'authority-validation',
      'procurement-calendar',
    ];
  }

  // ── D-02: emit + transition ─────────────────────────────────────────────────

  private emit(partial: Omit<AgentMessage, 'traceId' | 'from' | 'timestamp'>): void {
    const msg: AgentMessage = {
      traceId:   this.currentTraceId!,
      from:      'planner',
      timestamp: Date.now(),
      ...partial,
    };
    this.registry.log(msg);
    if (msg.to === 'broadcast') {
      this.registry.notifySubscribers(msg.type, msg);
    }
  }

  private transition(next: PlannerState, detail?: string): void {
    const event: PlannerStateEvent = {
      previousState: this.state,
      nextState:     next,
      timestamp:     Date.now(),
      detail,
    };
    this.emit({ to: 'planner', type: 'event', payload: event });
    this.state = next;
  }

  // ── D-03: buildErrorResponse + buildResponse ────────────────────────────────

  private buildErrorResponse(
    code:    string,
    message: string,
    inState: PlannerState,
    to:      AgentId | 'user' = 'user',
  ): AgentMessage {
    const traceId = this.currentTraceId ?? generateTraceId(); // save BEFORE reset
    this.state          = 'idle';
    this.currentTraceId = null;
    return {
      traceId,
      from:      'planner',
      to,
      type:      'error',
      payload:   { code, message, state: inState },
      timestamp: Date.now(),
    };
  }

  private buildResponse(to: AgentId | 'user', output: PlannerOutput): AgentMessage {
    return {
      traceId:    this.currentTraceId!,
      from:       'planner',
      to,
      type:       'response',
      payload:    output,
      timestamp:  Date.now(),
      legalBasis: output.legalBasis,
    };
  }

  // ── D-04: collectAllLegalBasis ──────────────────────────────────────────────

  private collectAllLegalBasis(
    splitWarnings:   LegalFinding[],
    authorityChecks: AuthorityCheck[],
  ): string[] {
    const citations = new Set<string>();
    citations.add('Điều 38-41 Luật Đấu thầu 22/2023/QH15 — lập và phê duyệt KHLCNT');
    for (const finding of splitWarnings) {
      citations.add(finding.legalBasis); // string (single citation)
    }
    for (const check of authorityChecks) {
      for (const basis of check.legalBasis) { // string[]
        citations.add(basis);
      }
    }
    return [...citations];
  }

  // ── D-05: determineConfidence ───────────────────────────────────────────────

  private determineConfidence(packages: AISuggestion[]): 'high' | 'medium' | 'low' {
    if (packages.some(p => p.confidence === 'low'))   return 'low';
    if (packages.every(p => p.confidence === 'high')) return 'high';
    return 'medium';
  }

  // ── D-06 + D-07: process ───────────────────────────────────────────────────

  async process(msg: AgentMessage): Promise<AgentMessage> {
    const traceId    = msg.traceId;
    const callerFrom = msg.from;
    this.currentTraceId = traceId;
    this.registry.log(msg);

    const input = msg.payload as PlannerInput;

    if (!input?.naturalLanguageGoal?.trim()) {
      return this.buildErrorResponse(
        'PLANNER_EMPTY_INPUT',
        'naturalLanguageGoal không được rỗng',
        'idle',
        callerFrom,
      );
    }

    try {
      // ── PARSING_GOAL
      this.transition('parsing-goal', 'Bắt đầu phân tích mục tiêu');
      const items = parseGoalIntoItems(input.naturalLanguageGoal);
      if (items.length === 0) {
        return this.buildErrorResponse(
          'PLANNER_NO_ITEMS',
          'Không tách được item từ mục tiêu',
          'parsing-goal',
          callerFrom,
        );
      }
      const packages = items.map(item =>
        generatePackageSuggestion(item, input.budgetYear),
      );

      // ── DETECTING_SPLIT
      this.transition('detecting-split');
      const splitWarnings = detectPackageSplitting(packages, input.existingPackages ?? []);
      if (splitWarnings.length > 0) {
        const broadcastPayload: SplitWarningPayload = {
          category: splitWarnings[0].field ?? splitWarnings[0].category,
          packages,
          finding:  splitWarnings[0],
        };
        this.emit({ to: 'broadcast', type: 'event', payload: broadcastPayload });
      }

      // ── VALIDATING_AUTHORITY
      this.transition('validating-authority');
      const authorityChecks = packages.map(pkg => validateAuthority(pkg));

      // ── BUILDING_CALENDAR
      this.transition('building-calendar');
      const calendar = buildCalendar(packages, input.budgetYear);

      // ── COMPOSING_RESPONSE
      this.transition('composing-response');
      const totalEstimated    = packages.reduce((s, p) => s + p.estimatedTotal, 0);
      const budgetUtilization = input.totalBudget
        ? totalEstimated / input.totalBudget
        : -1;
      const legalBasis = this.collectAllLegalBasis(splitWarnings, authorityChecks);
      const confidence = this.determineConfidence(packages);

      const output: PlannerOutput = {
        packages,
        splitWarnings,
        authorityChecks,
        calendar,
        totalEstimated,
        budgetUtilization,
        legalBasis,
        confidence,
        warnings: [],
      };

      const response = this.buildResponse(callerFrom, output);
      this.registry.log(response);
      this.state          = 'idle';
      this.currentTraceId = null;
      return response;

    } catch (err) {
      return this.buildErrorResponse(
        'PLANNER_INTERNAL_ERROR',
        String(err),
        this.state,
        callerFrom,
      );
    }
  }
}

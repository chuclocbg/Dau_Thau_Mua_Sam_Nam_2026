/**
 * P6-01E: PlannerAgent — P5 integration (buildMinimalProcurementPackage + deep analysis).
 *
 * State machine:
 *   idle → parsing-goal → detecting-split → validating-authority
 *        → [deep-analysis?] → building-calendar → composing-response → idle
 */

// ─── Type-only imports ────────────────────────────────────────────────────────

import type { AgentId, AgentMessage, IAgent }               from './types';
import type { AgentRegistry }                               from './AgentRegistry';
import type { AISuggestion }                                from '../ai/packageGenerator';
import type { LegalFinding }                                from '../ai/legalReviewer';
import type { WorkflowResult }                              from '../ai/workflowOrchestrator';
import type { AuthorityCheck }                              from './validateAuthority';
import type { Quarter, CalendarEntry, ProcurementCalendar } from './buildCalendar';
import type { ProcurementPackage }                          from '../demoData';

// ─── Runtime imports — P6-01C algorithms (used in class body) ─────────────────

import { generateTraceId, parseGoalIntoItems, detectPackageSplitting } from './detectPackageSplitting';
import { validateAuthority }                                            from './validateAuthority';
import { assignQuarter, getProcurementLeadTime, buildCalendar }        from './buildCalendar';

// ─── Runtime imports — P5 functions ───────────────────────────────────────────

import { generatePackageSuggestion }                                    from '../ai/packageGenerator';
import { reviewPackage }                                                from '../ai/legalReviewer';
import { runWorkflow }                                                  from '../ai/workflowOrchestrator';

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

// ─── PEOPLE_PLACEHOLDERS (E-02) ───────────────────────────────────────────────
// All 17 fields use [bracket] format per CLAUDE.md demo data rules.
// No real names, departments, suppliers, or tax codes.

const PEOPLE_PLACEHOLDERS = {
  rectorName:             '[Tên Hiệu trưởng]',
  departmentName:         '[Tên đơn vị đề xuất]',
  departmentCode:         '[Mã phòng]',
  expertTeamLeader:       '[Tổ trưởng tổ chuyên gia]',
  expertTeamMember1:      '[Thành viên tổ chuyên gia]',
  expertTeamMember2:      '[Thành viên tổ chuyên gia]',
  appraisalLeader:        '[Tổ trưởng thẩm định độc lập]',
  appraisalMember:        '[Thành viên thẩm định độc lập]',
  supplier1Name:          '[Nhà cung cấp số 1]',
  supplier1Address:       '[Địa chỉ nhà cung cấp 1]',
  supplier1TaxCode:       '[Mã số thuế]',
  supplier1Representative:'[Người đại diện]',
  supplier1Position:      '[Chức vụ]',
  supplier2Name:          '[Nhà cung cấp số 2]',
  supplier2Address:       '[Địa chỉ nhà cung cấp 2]',
  supplier3Name:          '[Nhà cung cấp số 3]',
  supplier3Address:       '[Địa chỉ nhà cung cấp 3]',
} as const;

// ─── buildMinimalProcurementPackage (E-03) ─────────────────────────────────────
// Builds the smallest valid ProcurementPackage from an AISuggestion for use in
// deep analysis (P5 reviewPackage / runWorkflow). All dates are blank; only 1
// item is created. TypeScript enforces all required ProcurementPackage fields.

export function buildMinimalProcurementPackage(
  suggestion: AISuggestion,
  budgetYear: number,
): ProcurementPackage {
  return {
    id:              `planner-preview-${suggestion.packageCode}`,
    packageName:     suggestion.packageName,
    packageCode:     suggestion.packageCode,
    fundingSource:   suggestion.fundingSource,
    fundingSourceName: suggestion.fundingSourceName,
    budgetYear,
    ...PEOPLE_PLACEHOLDERS,
    // All date fields blank — preview only, not a confirmed dossier
    dateProposal:        '',
    dateSurvey:          '',
    dateQuotes:          '',
    dateCompare:         '',
    dateKhlcnt:          '',
    dateKhlcntApprove:   '',
    dateExpertEstablish: '',
    dateDocIssue:        '',
    dateBidClose:        '',
    dateEvaluate:        '',
    dateAppraise:        '',
    dateResultProposal:  '',
    dateResultApprove:   '',
    dateContractSign:    '',
    dateDelivery:        '',
    dateAcceptance:      '',
    dateLiquidation:     '',
    dateAssetIncrease:   '',
    contractDurationDays: suggestion.contractDurationDays,
    contractType:        suggestion.contractType,
    packageType:         suggestion.packageType,
    warrantyMonths:      suggestion.packageType === 'goods_fixed_asset' ? 12 : 0,
    items: [{
      id:             `planner-item-${suggestion.packageCode}`,
      name:           suggestion.packageName,
      unit:           'Bộ',
      quantity:       1,
      unitPrice:      suggestion.estimatedTotal,
      specs:          '',
      supplier1Price: 0,
      supplier2Price: 0,
      supplier3Price: 0,
    }],
  };
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

      // ── DEEP ANALYSIS (E-04, optional)
      let workflowResults: WorkflowResult[] | undefined;
      if (input.deepAnalysis) {
        workflowResults = packages.map(pkg =>
          runWorkflow(pkg.packageName, input.budgetYear),
        );
      }

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
        workflowResults,
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

/**
 * 8-I: PlannerBridge — routes AiAssistantPanel through PlannerAgent (P6-01)
 * with automatic fallback to workflowOrchestrator.ts (P5-05).
 *
 * Migration path:
 *   Phase 5: AiAssistantPanel → runWorkflow()        → P5 pipeline (synchronous)
 *   Phase 8-I: AiAssistantPanel → runPlannerWorkflow() → PlannerAgent (P6-01)
 *                                                        ↓ on any error
 *                                                       runWorkflow() fallback
 *
 * What PlannerAgent (P6-01) adds vs runWorkflow() (P5-05):
 *   - splitWarnings[] with [CRITICAL] detection (Điều 44 khoản 6 Luật ĐT 22/2023)
 *   - authorityChecks[] with tier validation (rector_direct / rector_with_khlcnt / ministry)
 *   - procurementCalendar with quarter-based scheduling
 *   - confidence scoring (high / medium / low)
 *   - Audit trace: every step recorded in AgentRegistry with traceId
 *
 * What remains from workflowOrchestrator.ts after migration:
 *   - WorkflowResult — still the data contract consumed by AiAssistantPanel UI
 *   - WORKFLOW_DOCUMENT_IDS / WORKFLOW_DOCUMENT_NAMES — document selection unchanged
 *   - runWorkflow() — called as the fallback path (no circular dependency)
 *   - buildTimeline() / buildStarterItem() — internal to workflowOrchestrator,
 *     called by PlannerAgent through deepAnalysis → runWorkflow()
 *
 * Fallback triggers (all set source = 'workflow-fallback'):
 *   • Empty / whitespace-only naturalLanguageGoal (guard before agent call)
 *   • PlannerAgent.process() returns type: 'error'
 *   • Any uncaught exception inside PlannerAgent
 *
 * Never throws — runPlannerWorkflow always resolves.
 */

import { AgentRegistry }    from '../agents/AgentRegistry';
import { PlannerAgent }     from '../agents/PlannerAgent';
import { generateTraceId }  from '../agents/detectPackageSplitting';
import {
  runWorkflow,
  WorkflowResult,
  WorkflowStep,
} from './workflowOrchestrator';
import type { PlannerInput, PlannerOutput } from '../agents/PlannerAgent';
import type { AgentMessage }                from '../agents/types';

// ─── Public constants ─────────────────────────────────────────────────────────

export const PLANNER_BRIDGE_VERSION = '8-I';

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * Extends WorkflowResult with P6-01 PlannerAgent data.
 * Fully backward-compatible — all existing WorkflowResult fields are preserved.
 */
export interface PlannerBridgeResult extends WorkflowResult {
  /** PlannerOutput from P6-01 on success; null on fallback. */
  plannerOutput: PlannerOutput | null;
  /** UUID audit trace identifier logged in AgentRegistry. */
  traceId:       string;
  /**
   * 'planner-agent'    — P6-01 ran successfully, workflowResults[0] used as base.
   * 'workflow-fallback' — agent failed or input was empty; P5 runWorkflow() used.
   */
  source:        'planner-agent' | 'workflow-fallback';
}

/** Optional config injected mainly in tests to share a pre-built AgentRegistry. */
export interface PlannerBridgeConfig {
  registry?: AgentRegistry;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Builds the P6-01 step timeline from a PlannerOutput.
 * These steps are prepended to the base WorkflowResult.steps by
 * mapPlannerOutputToWorkflowResult() to give the UI a full picture.
 */
export function buildPlannerSteps(plannerOutput: PlannerOutput): WorkflowStep[] {
  const splitFlagged     = plannerOutput.splitWarnings.length > 0;
  const authorityFlagged = plannerOutput.authorityChecks.some(c => c.ministerialApproval);

  return [
    {
      step:    1,
      label:   'Phân tích mục tiêu (P6-01 PlannerAgent)',
      status:  'done',
      message: `Nhận dạng ${plannerOutput.packages.length} gói thầu — độ tin cậy: ${plannerOutput.confidence}`,
    },
    {
      step:    2,
      label:   'Kiểm tra chia nhỏ gói thầu',
      status:  splitFlagged ? 'error' : 'done',
      message: splitFlagged
        ? `[CRITICAL] Phát hiện ${plannerOutput.splitWarnings.length} cảnh báo chia nhỏ gói thầu`
        : 'Không phát hiện chia nhỏ gói thầu vi phạm ngưỡng',
    },
    {
      step:    3,
      label:   'Xác minh thẩm quyền phê duyệt',
      status:  authorityFlagged ? 'error' : 'done',
      message: authorityFlagged
        ? 'Một hoặc nhiều gói thầu cần phê duyệt của Bộ Công Thương'
        : 'Thẩm quyền phê duyệt phù hợp với giá trị gói thầu',
    },
    {
      step:    4,
      label:   'Phân tích sâu — lập hồ sơ mẫu (deepAnalysis)',
      status:  plannerOutput.workflowResults ? 'done' : 'pending',
      message: plannerOutput.workflowResults
        ? `Đã tạo ${plannerOutput.workflowResults.length} hồ sơ mẫu từ P5 pipeline`
        : 'Chưa chạy phân tích sâu',
    },
    {
      step:    5,
      label:   'Lên lịch mua sắm theo quý',
      status:  'done',
      message: `Kế hoạch ${plannerOutput.calendar.entries.length} gói thầu — tổng ước tính: ${plannerOutput.totalEstimated.toLocaleString('vi-VN')} VND`,
    },
  ];
}

/**
 * Merges base WorkflowResult warnings with PlannerAgent-specific warnings.
 * Deduplicates — a warning already in baseWarnings is not appended twice.
 */
export function augmentWarnings(
  baseWarnings:  string[],
  plannerOutput: PlannerOutput | null,
): string[] {
  if (!plannerOutput) return baseWarnings;

  const extra: string[] = [];

  for (const w of plannerOutput.splitWarnings) {
    extra.push(`[${w.severity}] ${w.message}`);
  }
  for (const check of plannerOutput.authorityChecks) {
    if (check.ministerialApproval) {
      extra.push(`[HIGH] Thẩm quyền: ${check.approvalAuthority}`);
    }
  }

  const seen = new Set(baseWarnings);
  return [...baseWarnings, ...extra.filter(e => !seen.has(e))];
}

/**
 * Maps a successful PlannerOutput (with deepAnalysis workflowResults) to a
 * PlannerBridgeResult by merging:
 *   - P6-01 steps (split check, authority, calendar) prepended to P5 steps
 *   - PlannerAgent warnings appended to P5 warnings (deduped)
 *   - plannerOutput and traceId stamped onto the base WorkflowResult
 *
 * Throws if workflowResults[0] is absent (caller must set deepAnalysis: true).
 */
export function mapPlannerOutputToWorkflowResult(
  plannerOutput: PlannerOutput,
  traceId:       string,
): PlannerBridgeResult {
  const baseWorkflow = plannerOutput.workflowResults?.[0];
  if (!baseWorkflow) {
    throw new Error(
      'PlannerBridge: plannerOutput.workflowResults[0] missing — deepAnalysis must be true',
    );
  }

  const plannerSteps = buildPlannerSteps(plannerOutput);
  const steps: WorkflowStep[] = [
    ...plannerSteps,
    // Renumber base steps so they follow planner steps sequentially
    ...baseWorkflow.steps.map(s => ({
      ...s,
      step: s.step + plannerSteps.length,
    })),
  ];

  const warnings = augmentWarnings(baseWorkflow.warnings, plannerOutput);

  return {
    ...baseWorkflow,
    steps,
    warnings,
    plannerOutput,
    traceId,
    source: 'planner-agent',
  };
}

// ─── Core async function ──────────────────────────────────────────────────────

/**
 * Runs the P6-01 PlannerAgent workflow, falling back to P5 runWorkflow() on
 * any failure.  Always resolves; never throws.
 *
 * @param naturalLanguageGoal - Vietnamese NL procurement request.
 * @param budgetYear          - Fiscal year (default: current year).
 * @param today               - Date override for deterministic tests.
 * @param config              - Optional: inject a shared AgentRegistry.
 */
export async function runPlannerWorkflow(
  naturalLanguageGoal: string,
  budgetYear = new Date().getFullYear(),
  today?: Date,
  config?: PlannerBridgeConfig,
): Promise<PlannerBridgeResult> {
  const traceId = generateTraceId();

  // Guard: empty input → immediate fallback (no agent call)
  if (!naturalLanguageGoal.trim()) {
    const base = runWorkflow(naturalLanguageGoal, budgetYear, today);
    return { ...base, plannerOutput: null, traceId, source: 'workflow-fallback' };
  }

  try {
    const registry = config?.registry ?? new AgentRegistry();
    const planner  = new PlannerAgent(registry);
    registry.register(planner);

    const requestMsg: AgentMessage = {
      traceId,
      from:      'user',
      to:        'planner',
      type:      'request',
      payload:   {
        naturalLanguageGoal,
        budgetYear,
        deepAnalysis: true,
      } as PlannerInput,
      timestamp: Date.now(),
    };

    const response = await planner.process(requestMsg);

    if (response.type !== 'response') {
      // PlannerAgent returned an error → P5 fallback
      const base = runWorkflow(naturalLanguageGoal, budgetYear, today);
      return { ...base, plannerOutput: null, traceId, source: 'workflow-fallback' };
    }

    const plannerOutput = response.payload as PlannerOutput;
    return mapPlannerOutputToWorkflowResult(plannerOutput, traceId);

  } catch {
    // Any unexpected exception → P5 fallback
    const base = runWorkflow(naturalLanguageGoal, budgetYear, today);
    return { ...base, plannerOutput: null, traceId, source: 'workflow-fallback' };
  }
}

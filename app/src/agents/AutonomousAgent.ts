/**
 * P6-06A: AutonomousAgent — schema and class skeleton.
 *
 * State machine:
 *   idle
 *     ↓ run(goal)
 *   planning        [PlannerAgent]        → ambiguous goal      → ask-user
 *     ↓
 *   specifying      [SpecificationAgent]  → brand lock detected  → specifying (loop ≤3)
 *     ↓
 *   legal-review    [LegalReviewerAgent]  → CRITICAL finding     → ask-user | specifying
 *     ↓
 *   risk-assessment [RiskAgent]           → risk CRITICAL        → ask-user
 *     ↓
 *   ready-for-export                      → user confirms
 *     ↓
 *   exporting       → ZIP generation
 *     ↓
 *   done
 *
 *   ask-user  → (user answers) → resume from prior state
 *   error     → terminal; session preserved for export
 *
 * Mandatory pause points (ASK_USER):
 *   1. LCNT method cannot be determined unambiguously
 *   2. Package-splitting risk detected [CRITICAL]
 *   3. Audit risk CRITICAL with no available mitigation
 *   4. LLM output requests a legal citation not in LEGAL_KB
 *
 * Retry limits:
 *   - SpecificationAgent brand-lock loop: max 3 iterations, then ask-user
 *   - Every retry is written to AgentSession.messageLog
 *
 * Milestones:
 *   P6-06A — types, constants, class skeleton           (this file)
 *   P6-06B — emit(), transition(), buildErrorResponse(),
 *             buildResponse(), collectLegalBasis()
 *   P6-06C — pure orchestration helpers:
 *             runPlanning(), runSpecifying(), runLegalReview(),
 *             runRiskAssessment(), buildSessionSummary()
 *   P6-06D — process() — main entry point:
 *             routes action to run() / pause() / resume() / getStatus() / exportSession()
 */

// ─── Type-only imports ────────────────────────────────────────────────────────

import type { AgentId, AgentMessage, IAgent } from './types';
import type { AgentRegistry }                  from './AgentRegistry';
import type { ProcurementPackage }             from '../demoData';
import type { PlannerOutput }                  from './PlannerAgent';
import type { DossierReviewOutput }            from './LegalReviewerAgent';
import type { RiskOutput }                     from './RiskAgent';

// ─── Runtime imports ──────────────────────────────────────────────────────────

import { generateTraceId } from './detectPackageSplitting';

// ─── WorkflowState ────────────────────────────────────────────────────────────

/** Every valid state the AutonomousAgent state machine can occupy. */
export type WorkflowState =
  | 'idle'
  | 'planning'
  | 'specifying'
  | 'legal-review'
  | 'risk-assessment'
  | 'ask-user'
  | 'ready-for-export'
  | 'exporting'
  | 'done'
  | 'error';

// ─── AutonomousStateEvent ─────────────────────────────────────────────────────

/** Emitted to the registry trace on every state-machine transition. */
export interface AutonomousStateEvent {
  previousState: WorkflowState;
  nextState:     WorkflowState;
  timestamp:     number;
  detail?:       string;
}

// ─── UserQuestion / UserAnswer ────────────────────────────────────────────────

/**
 * Pause payload emitted when the orchestrator needs human input before it
 * can proceed.  Stored in AgentSession.pendingQuestion until resume() is called.
 */
export interface UserQuestion {
  questionId:    string;
  agentId:       AgentId;
  question:      string;
  /** When present the UI should present these as radio / chip options. */
  options?:      string[];
  required:      boolean;
  /** Excerpt of legal text that explains why this decision is needed. */
  legalContext?: string;
}

/** Payload passed to resume() after the user answers a pending question. */
export interface UserAnswer {
  questionId: string;
  answer:     string;
}

// ─── AgentSession ─────────────────────────────────────────────────────────────

/**
 * Mutable session object that accumulates state across the full
 * idle → done workflow.  Preserved even after error for audit export.
 */
export interface AgentSession {
  /** UUID v4 — primary audit identifier for this workflow run. */
  sessionId:        string;
  state:            WorkflowState;
  /** Natural-language procurement goal supplied by the user. */
  goal:             string;
  /** Package being assembled — populated after planning completes. */
  pkg?:             ProcurementPackage;
  /** Output from PlannerAgent (P6-01). */
  plannerOutput?:   PlannerOutput;
  /** Output from LegalReviewerAgent (P6-03). */
  dossierReview?:   DossierReviewOutput;
  /** Output from RiskAgent (P6-04). */
  riskOutput?:      RiskOutput;
  /** Full ordered trace of every AgentMessage exchanged during the session. */
  messageLog:       AgentMessage[];
  /** Set when state = 'ask-user'; cleared when resume() is called. */
  pendingQuestion?: UserQuestion;
  startedAt:        number;
  completedAt?:     number;
  /** Number of specification-loop retries consumed so far (max 3). */
  specRetries:      number;
}

// ─── AutonomousInput ──────────────────────────────────────────────────────────

/**
 * Command payload sent to AutonomousAgent.process().
 * One message can carry exactly one action.
 */
export interface AutonomousInput {
  /**
   * run     — start a new workflow (requires goal)
   * pause   — suspend current workflow
   * resume  — continue after user answered pendingQuestion (requires userAnswer)
   * status  — return current AgentSession without side-effects
   * export  — serialise and return the full session for archiving
   */
  action:       'run' | 'pause' | 'resume' | 'status' | 'export';
  /** Required when action='run'. */
  goal?:        string;
  /** Optional budget hint (VND) when action='run'. */
  totalBudget?: number;
  /** Optional budget year when action='run'. */
  budgetYear?:  number;
  /** Required when action='resume'. */
  userAnswer?:  UserAnswer;
}

// ─── AutonomousOutput ─────────────────────────────────────────────────────────

export interface AutonomousOutput {
  /** Snapshot of the session at the time of the response. */
  session:      AgentSession;
  /** One-sentence Vietnamese summary of what this step accomplished. */
  summary:      string;
  /** All legal citations consumed or produced during this step. */
  legalBasis:   string[];
}

// ─── Legal basis constants ────────────────────────────────────────────────────

/**
 * Base citations always included in AutonomousAgent responses.
 * Covers planning, thresholds, brand-locking, transparency, and competition.
 */
export const AUTONOMOUS_LEGAL_BASIS: readonly string[] = [
  'Điều 38-41 Luật Đấu thầu 22/2023/QH15 — lập và phê duyệt kế hoạch lựa chọn nhà thầu',
  'Nghị định 214/2025/NĐ-CP Điều 24 — ngưỡng và phương thức lựa chọn nhà thầu',
  'Điều 44 khoản 7 Luật Đấu thầu 22/2023/QH15 — không khóa thương hiệu, không hạn chế xuất xứ',
  'Điều 12 Luật Đấu thầu 22/2023/QH15 — nghĩa vụ công khai thông tin trong đấu thầu',
  'Khoản 1 Điều 10 Luật Đấu thầu 22/2023/QH15 — nguyên tắc cạnh tranh, công bằng, minh bạch',
];

// ─── AutonomousAgent ──────────────────────────────────────────────────────────

export class AutonomousAgent implements IAgent {
  readonly id   = 'autonomous' as const;
  readonly name = 'Autonomous Procurement Agent';

  private state:          WorkflowState   = 'idle';
  private currentTraceId: string | null   = null;
  private session:        AgentSession | null = null;
  private readonly registry: AgentRegistry;

  constructor(registry: AgentRegistry) {
    this.registry = registry;
  }

  getCapabilities(): string[] {
    return [
      'autonomous-procurement-workflow',
      'multi-agent-orchestration',
      'state-machine-management',
      'user-interaction-pause-resume',
      'session-management',
      'audit-trail-export',
      'specification-retry-loop',
    ];
  }

  // ── P6-06B: emit(), transition(), buildErrorResponse(), buildResponse(),
  //            collectLegalBasis() — added in P6-06B.

  // ── P6-06C: runPlanning(), runSpecifying(), runLegalReview(),
  //            runRiskAssessment(), buildSessionSummary() — added in P6-06C.

  // ── P6-06D: process() full implementation (run / pause / resume / status / export)
  //            — replaces the stub below in P6-06D.

  async process(_msg: AgentMessage): Promise<AgentMessage> {
    const traceId = _msg.traceId || generateTraceId();
    this.state          = 'idle';
    this.currentTraceId = null;
    return {
      traceId,
      from:      'autonomous',
      to:        _msg.from as AgentId | 'user',
      type:      'error',
      payload:   {
        code:    'NOT_IMPLEMENTED',
        message: 'P6-06D: process() not yet implemented',
        state:   'idle' satisfies WorkflowState,
      },
      timestamp: Date.now(),
    };
  }
}

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
 *   P6-06B — pure orchestration helpers:
 *             runPlanning(), runSpecifying(), runLegalReview(),
 *             runRiskAssessment(), buildSessionSummary()
 *   P6-06C — class methods: emit(), transition(), buildErrorResponse(),
 *             buildResponse(), collectLegalBasis()
 *   P6-06D — process() — main entry point:
 *             routes action to run() / pause() / resume() / getStatus() / exportSession()
 */

// ─── Type-only imports ────────────────────────────────────────────────────────

import type { AgentId, AgentMessage, IAgent }      from './types';
import type { AgentRegistry }                        from './AgentRegistry';
import type { ProcurementPackage }                   from '../demoData';
import type { PlannerInput, PlannerOutput }          from './PlannerAgent';
import type { SpecInput, SpecOutput }                from './SpecificationAgent';
import type { DossierReviewInput, DossierReviewOutput } from './LegalReviewerAgent';
import type { RiskInput, RiskOutput }                from './RiskAgent';

// ─── Runtime imports ──────────────────────────────────────────────────────────

import { generateTraceId, }                         from './detectPackageSplitting';
import { buildMinimalProcurementPackage }           from './PlannerAgent';

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
  /** Optional total budget (VND) supplied at run() time. */
  totalBudget?:     number;
  /** Fiscal year supplied at run() time; defaults to current year. */
  budgetYear?:      number;
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

// ─── P6-06B: Pure orchestration helpers ──────────────────────────────────────

/**
 * Calls PlannerAgent and returns the session enriched with plannerOutput.
 * Appends both the outgoing request and the agent response to messageLog.
 */
export async function runPlanning(
  session:  AgentSession,
  registry: AgentRegistry,
  traceId:  string,
): Promise<AgentSession> {
  const plannerInput: PlannerInput = {
    naturalLanguageGoal: session.goal,
    budgetYear:          session.budgetYear ?? new Date().getFullYear(),
    totalBudget:         session.totalBudget,
  };
  const request: AgentMessage = {
    traceId,
    from:      'autonomous',
    to:        'planner',
    type:      'request',
    payload:   plannerInput,
    timestamp: Date.now(),
  };
  const response      = await registry.process(request);
  const plannerOutput = response.payload as PlannerOutput;
  return {
    ...session,
    plannerOutput,
    messageLog: [...session.messageLog, request, response],
  };
}

/**
 * Builds a minimal ProcurementPackage from the first planner suggestion,
 * calls SpecificationAgent to populate specs, and increments specRetries
 * if brand warnings were detected.
 */
export async function runSpecifying(
  session:  AgentSession,
  registry: AgentRegistry,
  traceId:  string,
): Promise<AgentSession> {
  const packages = session.plannerOutput?.packages;
  if (!packages?.length) {
    throw new Error('runSpecifying: plannerOutput.packages is empty — run planning first');
  }
  const budgetYear = session.budgetYear ?? new Date().getFullYear();
  // Reuse PlannerAgent helper — never duplicate package-assembly logic.
  const pkg = buildMinimalProcurementPackage(packages[0], budgetYear);

  const specInput: SpecInput = {
    itemName:           pkg.items[0].name,
    packageType:        pkg.packageType ?? 'goods_consumable',
    estimatedUnitPrice: pkg.items[0].unitPrice,
  };
  const request: AgentMessage = {
    traceId,
    from:      'autonomous',
    to:        'specification',
    type:      'request',
    payload:   specInput,
    timestamp: Date.now(),
  };
  const response   = await registry.process(request);
  const specOutput = response.payload as SpecOutput;

  const updatedPkg: typeof pkg = {
    ...pkg,
    items: [{ ...pkg.items[0], specs: specOutput.specs }],
  };
  return {
    ...session,
    pkg:         updatedPkg,
    specRetries: session.specRetries + (specOutput.brandWarnings.length > 0 ? 1 : 0),
    messageLog:  [...session.messageLog, request, response],
  };
}

/**
 * Calls LegalReviewerAgent with all 28 dossier documents.
 * Derives methodCode from plannerOutput to avoid duplicating threshold logic.
 */
export async function runLegalReview(
  session:  AgentSession,
  registry: AgentRegistry,
  traceId:  string,
): Promise<AgentSession> {
  if (!session.pkg) {
    throw new Error('runLegalReview: session.pkg is required — run specifying first');
  }
  const methodCode  = session.plannerOutput?.packages?.[0]?.procurementMethodHint
    ?? 'DIRECT_SELECTION_SIMPLIFIED';
  const documentIds = Array.from({ length: 28 }, (_, i) => i + 1);

  const reviewInput: DossierReviewInput = {
    pkg: session.pkg,
    documentIds,
    methodCode,
  };
  const request: AgentMessage = {
    traceId,
    from:      'autonomous',
    to:        'legal-reviewer',
    type:      'request',
    payload:   reviewInput,
    timestamp: Date.now(),
  };
  const response      = await registry.process(request);
  const dossierReview = response.payload as DossierReviewOutput;
  return {
    ...session,
    dossierReview,
    messageLog: [...session.messageLog, request, response],
  };
}

/**
 * Calls RiskAgent with the assembled package, dossier review, and planner output.
 */
export async function runRiskAssessment(
  session:  AgentSession,
  registry: AgentRegistry,
  traceId:  string,
): Promise<AgentSession> {
  if (!session.pkg || !session.dossierReview) {
    throw new Error(
      'runRiskAssessment: session.pkg and session.dossierReview are required',
    );
  }
  const riskInput: RiskInput = {
    pkg:           session.pkg,
    dossierReview: session.dossierReview,
    plannerOutput: session.plannerOutput,
  };
  const request: AgentMessage = {
    traceId,
    from:      'autonomous',
    to:        'risk',
    type:      'request',
    payload:   riskInput,
    timestamp: Date.now(),
  };
  const response  = await registry.process(request);
  const riskOutput = response.payload as RiskOutput;
  return {
    ...session,
    riskOutput,
    messageLog: [...session.messageLog, request, response],
  };
}

/** Returns a one-sentence Vietnamese description of the current session state. */
export function buildSessionSummary(session: AgentSession): string {
  switch (session.state) {
    case 'idle':             return 'Phiên làm việc chưa được khởi động.';
    case 'planning':         return 'Đang phân tích mục tiêu mua sắm và lập kế hoạch gói thầu.';
    case 'specifying':       return 'Đang xây dựng yêu cầu kỹ thuật cho gói thầu.';
    case 'legal-review':     return 'Đang kiểm tra tính pháp lý của hồ sơ mua sắm.';
    case 'risk-assessment':  return 'Đang đánh giá rủi ro kiểm toán và rủi ro pháp lý.';
    case 'ask-user':         return 'Cần thêm thông tin từ người dùng để tiếp tục.';
    case 'ready-for-export': return 'Hồ sơ mua sắm đã sẵn sàng để xuất và lưu trữ.';
    case 'exporting':        return 'Đang tạo và đóng gói hồ sơ mua sắm để xuất.';
    case 'done':             return 'Phiên làm việc đã hoàn tất thành công.';
    case 'error':            return 'Phiên làm việc kết thúc do lỗi; hồ sơ được lưu để kiểm tra.';
  }
}

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

  // ── emit + transition ────────────────────────────────────────────────────────

  private emit(partial: Omit<AgentMessage, 'traceId' | 'from' | 'timestamp'>): void {
    const msg: AgentMessage = {
      traceId:   this.currentTraceId!,
      from:      'autonomous',
      timestamp: Date.now(),
      ...partial,
    };
    this.registry.log(msg);
    if (msg.to === 'broadcast') {
      this.registry.notifySubscribers(msg.type, msg);
    }
  }

  private transition(next: WorkflowState, detail?: string): void {
    const event: AutonomousStateEvent = {
      previousState: this.state,
      nextState:     next,
      timestamp:     Date.now(),
      detail,
    };
    this.emit({ to: 'autonomous', type: 'event', payload: event });
    this.state = next;
    if (this.session) {
      this.session = { ...this.session, state: next };
    }
  }

  // ── buildErrorResponse + buildResponse ────────────────────────────────────────

  private buildErrorResponse(
    code:    string,
    message: string,
    inState: WorkflowState,
    to:      AgentId | 'user' = 'user',
  ): AgentMessage {
    const traceId = this.currentTraceId ?? generateTraceId(); // save BEFORE reset
    if (this.session) {
      this.session = { ...this.session, state: 'error', completedAt: Date.now() };
    }
    this.state          = 'idle';
    this.currentTraceId = null;
    return {
      traceId,
      from:      'autonomous',
      to,
      type:      'error',
      payload:   { code, message, state: inState },
      timestamp: Date.now(),
    };
  }

  private buildResponse(to: AgentId | 'user', session: AgentSession): AgentMessage {
    const legalBasis = this.collectLegalBasis(session);
    const output: AutonomousOutput = {
      session,
      summary:    buildSessionSummary(session),
      legalBasis,
    };
    return {
      traceId:    this.currentTraceId!,
      from:       'autonomous',
      to,
      type:       'response',
      payload:    output,
      timestamp:  Date.now(),
      legalBasis,
    };
  }

  // ── collectLegalBasis ────────────────────────────────────────────────────────

  private collectLegalBasis(session: AgentSession): string[] {
    const citations = new Set<string>(AUTONOMOUS_LEGAL_BASIS);
    for (const s of session.plannerOutput?.legalBasis ?? []) {
      citations.add(s);
    }
    for (const s of session.dossierReview?.legalBasis ?? []) {
      citations.add(s);
    }
    // LegalFinding.legalBasis is a single string citation
    for (const f of session.dossierReview?.findings ?? []) {
      if (f.legalBasis) citations.add(f.legalBasis);
    }
    for (const s of session.riskOutput?.legalBasis ?? []) {
      citations.add(s);
    }
    return [...citations];
  }

  // ── Action handlers ───────────────────────────────────────────────────────────

  private async runWorkflow(
    input: AutonomousInput,
    to:    AgentId | 'user',
  ): Promise<AgentMessage> {
    if (this.state !== 'idle') {
      return this.buildErrorResponse(
        'AUTONOMOUS_ALREADY_RUNNING',
        `Cannot start a new workflow while in state '${this.state}'`,
        this.state,
        to,
      );
    }
    if (!input.goal?.trim()) {
      return this.buildErrorResponse(
        'AUTONOMOUS_MISSING_GOAL',
        'AutonomousInput.goal is required for action=run',
        this.state,
        to,
      );
    }

    this.session = {
      sessionId:   generateTraceId(),
      state:       'idle',
      goal:        input.goal.trim(),
      messageLog:  [],
      startedAt:   Date.now(),
      specRetries: 0,
      totalBudget: input.totalBudget,
      budgetYear:  input.budgetYear,
    };

    this.transition('planning', input.goal.slice(0, 60));
    this.session = await runPlanning(this.session, this.registry, this.currentTraceId!);

    this.transition('specifying');
    this.session = await runSpecifying(this.session, this.registry, this.currentTraceId!);

    this.transition('legal-review');
    this.session = await runLegalReview(this.session, this.registry, this.currentTraceId!);

    this.transition('risk-assessment');
    this.session = await runRiskAssessment(this.session, this.registry, this.currentTraceId!);

    this.transition('ready-for-export');
    this.session = { ...this.session, completedAt: Date.now() };

    const response = this.buildResponse(to, this.session);
    this.registry.log(response);
    this.state          = 'idle';
    this.currentTraceId = null;
    return response;
  }

  private pauseWorkflow(to: AgentId | 'user'): AgentMessage {
    if (!this.session ||
        this.session.state === 'idle' ||
        this.session.state === 'done'  ||
        this.session.state === 'error') {
      return this.buildErrorResponse(
        'AUTONOMOUS_CANNOT_PAUSE',
        `Cannot pause: session is in state '${this.session?.state ?? 'no-session'}'`,
        this.state,
        to,
      );
    }
    const pendingQuestion: UserQuestion = {
      questionId:   generateTraceId(),
      agentId:      'autonomous',
      question:     'Phiên làm việc đã tạm dừng. Vui lòng xác nhận để tiếp tục hoặc cung cấp thông tin bổ sung.',
      required:     true,
      legalContext: 'Theo yêu cầu của người dùng — tạm dừng để xem xét thủ công.',
    };
    this.transition('ask-user', 'Tạm dừng theo yêu cầu người dùng');
    this.session = { ...this.session, pendingQuestion };

    const response = this.buildResponse(to, this.session);
    this.registry.log(response);
    this.state          = 'idle';
    this.currentTraceId = null;
    return response;
  }

  private resumeWorkflow(input: AutonomousInput, to: AgentId | 'user'): AgentMessage {
    if (!this.session || this.session.state !== 'ask-user') {
      return this.buildErrorResponse(
        'AUTONOMOUS_NOT_PAUSED',
        `Cannot resume: session is in state '${this.session?.state ?? 'no-session'}'`,
        this.state,
        to,
      );
    }
    if (!input.userAnswer) {
      return this.buildErrorResponse(
        'AUTONOMOUS_MISSING_ANSWER',
        'AutonomousInput.userAnswer is required for action=resume',
        this.state,
        to,
      );
    }
    if (this.session.pendingQuestion &&
        input.userAnswer.questionId !== this.session.pendingQuestion.questionId) {
      return this.buildErrorResponse(
        'AUTONOMOUS_ANSWER_MISMATCH',
        'userAnswer.questionId does not match pendingQuestion.questionId',
        this.state,
        to,
      );
    }
    this.session = { ...this.session, pendingQuestion: undefined };
    this.transition(
      'ready-for-export',
      `Tiếp tục sau câu trả lời: ${input.userAnswer.answer.slice(0, 40)}`,
    );

    const response = this.buildResponse(to, this.session);
    this.registry.log(response);
    this.state          = 'idle';
    this.currentTraceId = null;
    return response;
  }

  private getStatus(to: AgentId | 'user'): AgentMessage {
    if (!this.session) {
      return this.buildErrorResponse(
        'AUTONOMOUS_NO_SESSION',
        'No active session — call action=run first',
        this.state,
        to,
      );
    }
    const response = this.buildResponse(to, this.session);
    this.registry.log(response);
    this.state          = 'idle';
    this.currentTraceId = null;
    return response;
  }

  private exportSession(to: AgentId | 'user'): AgentMessage {
    if (!this.session) {
      return this.buildErrorResponse(
        'AUTONOMOUS_NO_SESSION',
        'No active session — call action=run first',
        this.state,
        to,
      );
    }
    const response = this.buildResponse(to, this.session);
    this.registry.log(response);
    this.state          = 'idle';
    this.currentTraceId = null;
    return response;
  }

  // ── process ───────────────────────────────────────────────────────────────────

  async process(msg: AgentMessage): Promise<AgentMessage> {
    const traceId    = msg.traceId;
    const callerFrom = msg.from;
    this.currentTraceId = traceId;
    this.registry.log(msg);

    const input = msg.payload as AutonomousInput | undefined;

    if (!input?.action) {
      return this.buildErrorResponse(
        'AUTONOMOUS_MISSING_ACTION',
        'AutonomousInput.action is required',
        this.state,
        callerFrom,
      );
    }

    try {
      switch (input.action) {
        case 'run':    return await this.runWorkflow(input, callerFrom);
        case 'pause':  return this.pauseWorkflow(callerFrom);
        case 'resume': return this.resumeWorkflow(input, callerFrom);
        case 'status': return this.getStatus(callerFrom);
        case 'export': return this.exportSession(callerFrom);
      }
    } catch (err) {
      return this.buildErrorResponse(
        'AUTONOMOUS_INTERNAL_ERROR',
        String(err),
        this.state,
        callerFrom,
      );
    }
  }
}

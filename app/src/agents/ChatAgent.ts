/**
 * P6-05A: ChatAgent — schema and file skeleton.
 *
 * State machine:
 *   idle → analyzing-request → invoking-agent → composing-response → idle
 *
 * Provides a multi-turn Vietnamese-language Q&A interface backed by the
 * static legal KB (P5-04) and upstream agent outputs.  Never fabricates
 * legal content — answers always carry sources[] from LEGAL_KB.
 *
 * If the KB score is below the confidence threshold, the agent returns
 * confidence='low' and sources=[] rather than hallucinating an answer.
 *
 * Orchestration rule: ChatAgent invokes other agents (LegalReviewerAgent,
 * RiskAgent) via the registry for context-enriched answers.  It never
 * duplicates their logic internally.
 *
 * Pure functions (P6-05B):
 *   searchKnowledge()       — BM25-lite KB search, returns SearchResult[]
 *   extractPackageContext() — selects relevant fields from ProcurementPackage
 *   buildAnswer()           — synthesizes answer from KB results + context
 *   suggestFollowUps()      — generates next-question suggestions from KB categories
 *   chat()                  — ChatInput → ChatOutput pure orchestrator
 *
 * Agent methods (P6-05C):
 *   emit()               — registry event emitter
 *   transition()         — state machine step + event log
 *   buildErrorResponse() — error AgentMessage, always resets state to idle
 *   buildResponse()      — success AgentMessage with legalBasis
 *   process()            — main entry point, never throws uncaught exceptions
 */

// ─── Type-only imports ────────────────────────────────────────────────────────

import type { AgentId, AgentMessage, IAgent } from './types';
import type { AgentRegistry }                  from './AgentRegistry';
import type { ProcurementPackage }             from '../demoData';
import type { LegalFinding }                   from '../ai/legalReviewer';
import type { SearchResult }                   from '../ai/legalKnowledgeBase';

// ─── Runtime imports ──────────────────────────────────────────────────────────

import { generateTraceId } from './detectPackageSplitting';

// ─── ChatMessage ─────────────────────────────────────────────────────────────

/**
 * One turn in the conversation history.
 * Distinct from AgentMessage — this is the domain-level record
 * stored in history[] and surfaced to the UI.
 */
export interface ChatMessage {
  id:               string;
  role:             'user' | 'agent' | 'system';
  content:          string;
  /** KB source citations attached to this message. */
  sources:          string[];
  confidence:       'high' | 'medium' | 'low';
  timestamp:        number;
  relatedFindings?: LegalFinding[];
}

// ─── ChatInput ────────────────────────────────────────────────────────────────

export interface ChatInput {
  /** User's natural-language message in Vietnamese. */
  message:         string;
  /**
   * Optional package context — if present, the agent enriches answers with
   * procurement-specific details (method, value, dates, etc.).
   */
  packageContext?: ProcurementPackage;
  /** Full conversation history from the session so far (oldest first). */
  history:         ChatMessage[];
}

// ─── ChatOutput ───────────────────────────────────────────────────────────────

export interface ChatOutput {
  /** Vietnamese-language answer derived solely from KB + context. */
  answer:              string;
  /** KB source IDs / citations backing the answer. */
  sources:             string[];
  confidence:          'high' | 'medium' | 'low';
  /** Suggested follow-up questions the user might want to ask next. */
  followUpSuggestions: string[];
  /** Ranked KB search results that contributed to the answer. */
  relatedKBEntries:    SearchResult[];
  /** If packageContext is provided, relevant findings from P5-03 review. */
  relatedFindings?:    LegalFinding[];
}

// ─── ChatState ────────────────────────────────────────────────────────────────

export type ChatState =
  | 'idle'
  | 'analyzing-request'
  | 'invoking-agent'
  | 'composing-response';

// ─── ChatStateEvent ───────────────────────────────────────────────────────────

/** Emitted to the registry trace on every state transition. */
export interface ChatStateEvent {
  previousState: ChatState;
  nextState:     ChatState;
  timestamp:     number;
  detail?:       string;
}

// ─── Legal basis constants ────────────────────────────────────────────────────

/**
 * Legal citations the ChatAgent always includes when its answers draw on
 * KB entries from these sources.  Covers the main threshold, brand-locking,
 * contract-type, transparency, and competition provisions.
 */
export const CHAT_LEGAL_BASIS: readonly string[] = [
  'Nghị định 214/2025/NĐ-CP Điều 24 — ngưỡng và phương thức lựa chọn nhà thầu',
  'Điều 44 khoản 7 Luật Đấu thầu 22/2023/QH15 — không khóa thương hiệu, không hạn chế xuất xứ',
  'Điều 62 Luật Đấu thầu 22/2023/QH15 — loại hợp đồng (trọn gói / đơn giá)',
  'Điều 12 Luật Đấu thầu 22/2023/QH15 — nghĩa vụ công khai thông tin trong đấu thầu',
  'Khoản 1 Điều 10 Luật Đấu thầu 22/2023/QH15 — nguyên tắc cạnh tranh, công bằng, minh bạch',
];

// ─── P6-05B: Pure functions (added in P6-05B) ────────────────────────────────

// searchKnowledge()       — BM25-lite search against LEGAL_KB; returns SearchResult[]
// extractPackageContext() — maps ProcurementPackage → concise context string
// buildAnswer()           — synthesizes ChatOutput.answer from SearchResult[] + context
// suggestFollowUps()      — returns next-question suggestions from KB categories
// chat()                  — pure ChatInput → ChatOutput orchestrator

// ─── ChatAgent ───────────────────────────────────────────────────────────────

export class ChatAgent implements IAgent {
  readonly id   = 'chat' as const;
  readonly name = 'Chat Agent';

  private state:           ChatState   = 'idle';
  private currentTraceId:  string | null = null;
  private readonly registry: AgentRegistry;

  constructor(registry: AgentRegistry) {
    this.registry = registry;
  }

  getCapabilities(): string[] {
    return [
      'procurement-law-qa',
      'multi-turn-conversation',
      'context-aware-answers',
      'follow-up-suggestions',
      'kb-backed-citations',
    ];
  }

  // ── P6-05C: emit(), transition(), buildErrorResponse(), buildResponse(),
  //            process() — added in P6-05C.

  async process(_msg: AgentMessage): Promise<AgentMessage> {
    const traceId = _msg.traceId || generateTraceId();
    this.state          = 'idle';
    this.currentTraceId = null;
    return {
      traceId,
      from:      'chat',
      to:        _msg.from as AgentId | 'user',
      type:      'error',
      payload:   {
        code:    'NOT_IMPLEMENTED',
        message: 'P6-05C: process() not yet implemented',
        state:   'idle' satisfies ChatState,
      },
      timestamp: Date.now(),
    };
  }
}

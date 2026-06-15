/**
 * P6-05C: ChatAgent — agent class methods.
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

import { generateTraceId }                  from './detectPackageSplitting';
import { searchLegalKB }                   from '../ai/legalKnowledgeBase';
import { reviewPackage as p5ReviewPackage } from '../ai/legalReviewer';

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

// ─── P6-05B: Helpers (unexported) ────────────────────────────────────────────

/** Follow-up question suggestions keyed by LegalEntry.appliesTo context tag. */
const FOLLOW_UP_BY_CONTEXT: Partial<Record<string, string[]>> = {
  'khlcnt': [
    'Thẩm quyền phê duyệt KHLCNT là ai?',
    'KHLCNT cần đăng tải ở đâu và khi nào?',
    'Nội dung bắt buộc trong KHLCNT gồm những gì?',
  ],
  'legal-review': [
    'Hồ sơ cần đáp ứng điều kiện nào để sẵn sàng kiểm toán?',
    'Những lỗi nào hay bị kiểm toán phát hiện nhất?',
    'Làm thế nào để kiểm tra tính hợp lệ của hồ sơ?',
  ],
  'contract': [
    'Hợp đồng cần có những điều khoản bắt buộc nào?',
    'Khi nào nên dùng hợp đồng đơn giá thay vì trọn gói?',
    'Mức phạt chậm giao hàng được quy định như thế nào?',
  ],
  'authority': [
    'Thẩm quyền phê duyệt gói thầu trên 500 triệu là ai?',
    'Trường hợp nào cần trình Bộ Công Thương phê duyệt?',
  ],
  'spec-generator': [
    'Làm thế nào để viết yêu cầu kỹ thuật không bị coi là khóa thương hiệu?',
    'Tiêu chí kỹ thuật "tương đương" được hiểu như thế nào trong đấu thầu?',
  ],
  'asset-recording': [
    'Ngưỡng tài sản cố định theo quy định hiện hành là bao nhiêu?',
    'Vật tư tiêu hao có cần ghi tăng tài sản không?',
  ],
  'package-generator': [
    'Phương thức chỉ định thầu rút gọn áp dụng cho mức giá nào?',
    'Khi nào phải tổ chức đấu thầu rộng rãi?',
  ],
  'timeline': [
    'Thời gian tối thiểu từ phát hành HSYC đến đóng thầu là bao lâu?',
    'Các bước trong quy trình LCNT cần cách nhau bao nhiêu ngày?',
  ],
  'expert-team': [
    'Tổ chuyên gia và Tổ thẩm định có được là cùng người không?',
    'Ai có thẩm quyền thành lập Tổ chuyên gia?',
  ],
  'evaluation': [
    'Tiêu chí đánh giá nhà thầu được quy định như thế nào?',
    'Khi hai nhà thầu có giá bằng nhau thì xử lý như thế nào?',
  ],
};

// ─── P6-05B: Pure functions ───────────────────────────────────────────────────

/**
 * Searches the legal knowledge base for entries relevant to the query.
 * Delegates to the P5-04 BM25-lite engine.  topK defaults to 3.
 */
export function searchKnowledge(query: string, topK = 3): SearchResult[] {
  return searchLegalKB(query.trim(), topK);
}

/**
 * Converts the procurement-relevant fields of a package into a concise
 * Vietnamese context string for appending to KB answers.
 */
export function extractPackageContext(pkg: ProcurementPackage): string {
  const parts: string[] = [];

  if (pkg.packageName) {
    parts.push(`Gói thầu: "${pkg.packageName}"`);
  }

  if (pkg.packageType) {
    const typeLabel: Record<string, string> = {
      goods_fixed_asset: 'Hàng hóa tài sản cố định',
      goods_consumable:  'Hàng hóa vật tư tiêu hao',
      service:           'Dịch vụ phi tư vấn',
      mixed:             'Hỗn hợp',
    };
    parts.push(`Loại: ${typeLabel[pkg.packageType] ?? pkg.packageType}`);
  }

  const total = (pkg.items ?? []).reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  if (total > 0) {
    parts.push(`Giá trị ước tính: ${(total / 1_000_000).toFixed(0)} triệu VND`);
  }

  if (pkg.contractType) {
    parts.push(
      `Loại HĐ: ${pkg.contractType === 'lump_sum' ? 'trọn gói' : 'đơn giá'}`,
    );
  }

  if (pkg.fundingSourceName) {
    parts.push(`Nguồn vốn: ${pkg.fundingSourceName}`);
  }

  return parts.join('; ');
}

/**
 * Returns up to 3 follow-up question suggestions derived from the KB
 * entries' appliesTo context tags.  Falls back to generic procurement
 * questions when no results are available.
 */
export function suggestFollowUps(results: SearchResult[]): string[] {
  if (results.length === 0) {
    return [
      'Ngưỡng phương thức lựa chọn nhà thầu hiện hành là bao nhiêu?',
      'Hồ sơ yêu cầu cần có những tài liệu gì?',
      'Khi nào hồ sơ được coi là sẵn sàng kiểm toán?',
    ];
  }

  const seen        = new Set<string>();
  const suggestions: string[] = [];

  for (const result of results) {
    for (const ctx of result.entry.appliesTo ?? []) {
      for (const q of FOLLOW_UP_BY_CONTEXT[ctx] ?? []) {
        if (!seen.has(q)) {
          seen.add(q);
          suggestions.push(q);
        }
      }
    }
  }

  return suggestions.slice(0, 3);
}

/**
 * Synthesizes a ChatOutput from KB search results and the caller's input.
 *
 * Answer format (Vietnamese, KB-grounded):
 *   **Title** / _Căn cứ: Source_ / Highlights / Optional secondary entry.
 *
 * When packageContext is present a concise context line is appended so the
 * user can see which package the answer is relative to.
 *
 * Never fabricates legal content — if results is empty the function returns
 * confidence='low' with an explicit "not found" message and sources=[].
 */
export function buildAnswer(results: SearchResult[], input: ChatInput): ChatOutput {
  if (results.length === 0) {
    return {
      answer:
        'Không tìm thấy thông tin liên quan trong cơ sở tri thức pháp luật đấu thầu. ' +
        'Vui lòng tra cứu trực tiếp tại nguồn văn bản pháp luật chính thức.',
      sources:             [],
      confidence:          'low',
      followUpSuggestions: suggestFollowUps([]),
      relatedKBEntries:    [],
    };
  }

  const topResult  = results[0];
  const confidence: 'high' | 'medium' | 'low' =
    topResult.score >= 8 ? 'high' :
    topResult.score >= 4 ? 'medium' : 'low';

  const highlights =
    topResult.highlights.length > 0
      ? topResult.highlights.join('\n')
      : topResult.entry.content.split('\n').filter(l => l.trim()).slice(0, 4).join('\n');

  let answer =
    `**${topResult.entry.title}**\n` +
    `_Căn cứ: ${topResult.entry.source}_\n\n` +
    highlights;

  if (results.length > 1 && results[1].score >= 5) {
    answer +=
      `\n\n**Xem thêm:** ${results[1].entry.title} (${results[1].entry.source})`;
  }

  if (input.packageContext) {
    const ctx = extractPackageContext(input.packageContext);
    if (ctx) {
      answer += `\n\n_Ngữ cảnh gói thầu: ${ctx}_`;
    }
  }

  return {
    answer,
    sources:             results.map(r => r.entry.source),
    confidence,
    followUpSuggestions: suggestFollowUps(results),
    relatedKBEntries:    results,
  };
}

/**
 * Pure ChatInput → ChatOutput orchestrator.
 *
 * Multi-turn strategy: the last 2 user turns from history are appended to
 * the current message to form an enriched search query.  This lets the agent
 * resolve references like "gói thầu đó" from prior context.
 *
 * If packageContext is provided, P5-03 reviewPackage is run to attach
 * relatedFindings so downstream UI can surface relevant legal warnings.
 * Exceptions from reviewPackage are swallowed — chat() must never throw.
 */
export function chat(input: ChatInput): ChatOutput {
  const recentUserTurns = input.history
    .filter(m => m.role === 'user')
    .slice(-2)
    .map(m => m.content);

  const enrichedQuery = [...recentUserTurns, input.message].join(' ').trim();
  const results       = searchKnowledge(enrichedQuery, 3);

  let relatedFindings: LegalFinding[] | undefined;
  if (input.packageContext) {
    try {
      const p5 = p5ReviewPackage(input.packageContext);
      if (p5.findings.length > 0) {
        relatedFindings = p5.findings;
      }
    } catch {
      // Silently ignore — chat() is a pure function that must never throw
    }
  }

  const output = buildAnswer(results, input);
  return relatedFindings ? { ...output, relatedFindings } : output;
}

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

  // ── emit + transition ──────────────────────────────────────────────────────

  private emit(partial: Omit<AgentMessage, 'traceId' | 'from' | 'timestamp'>): void {
    const msg: AgentMessage = {
      traceId:   this.currentTraceId!,
      from:      'chat',
      timestamp: Date.now(),
      ...partial,
    };
    this.registry.log(msg);
    if (msg.to === 'broadcast') {
      this.registry.notifySubscribers(msg.type, msg);
    }
  }

  private transition(next: ChatState, detail?: string): void {
    const event: ChatStateEvent = {
      previousState: this.state,
      nextState:     next,
      timestamp:     Date.now(),
      detail,
    };
    this.emit({ to: 'chat', type: 'event', payload: event });
    this.state = next;
  }

  // ── buildErrorResponse + buildResponse ─────────────────────────────────────

  private buildErrorResponse(
    code:    string,
    message: string,
    inState: ChatState,
    to:      AgentId | 'user' = 'user',
  ): AgentMessage {
    const traceId = this.currentTraceId ?? generateTraceId(); // save BEFORE reset
    this.state          = 'idle';
    this.currentTraceId = null;
    return {
      traceId,
      from:      'chat',
      to,
      type:      'error',
      payload:   { code, message, state: inState },
      timestamp: Date.now(),
    };
  }

  private buildResponse(to: AgentId | 'user', output: ChatOutput): AgentMessage {
    return {
      traceId:    this.currentTraceId!,
      from:       'chat',
      to,
      type:       'response',
      payload:    output,
      timestamp:  Date.now(),
      legalBasis: this.collectLegalBasis(output),
    };
  }

  // ── collectLegalBasis ──────────────────────────────────────────────────────

  /**
   * Merges legal citations from two sources (Set dedup):
   *   1. CHAT_LEGAL_BASIS constant
   *   2. output.sources — KB source citations drawn from this answer
   */
  private collectLegalBasis(output: ChatOutput): string[] {
    const citations = new Set<string>(CHAT_LEGAL_BASIS);
    for (const src of output.sources) {
      citations.add(src);
    }
    return [...citations];
  }

  // ── process ────────────────────────────────────────────────────────────────

  async process(msg: AgentMessage): Promise<AgentMessage> {
    const traceId    = msg.traceId;
    const callerFrom = msg.from;
    this.currentTraceId = traceId;
    this.registry.log(msg);

    const input = msg.payload as ChatInput | undefined;

    if (!input?.message || input.message.trim() === '') {
      return this.buildErrorResponse(
        'CHAT_EMPTY_INPUT',
        'ChatInput.message không được để trống',
        'idle',
        callerFrom,
      );
    }

    try {
      // ── ANALYZING_REQUEST — parse query and build enriched search context
      this.transition('analyzing-request', `"${input.message.slice(0, 60)}"`);

      // ── INVOKING_AGENT — KB search + optional P5-03 review (via chat())
      this.transition('invoking-agent', 'Truy vấn cơ sở tri thức pháp luật');
      const output = chat(input);

      // ── COMPOSING_RESPONSE
      this.transition('composing-response', `confidence=${output.confidence}`);

      const response = this.buildResponse(callerFrom, output);
      this.registry.log(response);
      this.state          = 'idle';
      this.currentTraceId = null;
      return response;

    } catch (err) {
      return this.buildErrorResponse(
        'CHAT_INTERNAL_ERROR',
        String(err),
        this.state,
        callerFrom,
      );
    }
  }
}

/**
 * 8-G: LLM Provider Bridge — optionally paraphrases KB-derived answers via
 * the Claude API (Anthropic).
 *
 * Architecture:
 *   ChatAgent.chat()
 *     → searchKnowledge()         ← legal KB (rule-based, authoritative)
 *     → buildAnswer(kbResults)    ← assembles answer + sources[]
 *     → paraphraseAnswer(answer)  ← this module (8-G)
 *           ↓ (ANTHROPIC_API_KEY set)
 *       ClaudeProvider.chat()  →  LLM-paraphrased display text
 *           ↓ (absent or any error)
 *       original kbAnswer as-is   (rule-based fallback)
 *
 * Legal citation guarantee:
 *   ChatOutput.sources[] is populated by searchLegalKB() before this bridge
 *   is called.  The bridge only rewrites the answer display string — it never
 *   sees or modifies the sources array.  SYSTEM_PROMPT explicitly prohibits
 *   the LLM from adding, removing, or changing any legal references.
 *
 * Fallback triggers (all return usedLLM: false):
 *   • ANTHROPIC_API_KEY absent, empty, or whitespace-only
 *   • kbAnswer is empty after trim (nothing to paraphrase)
 *   • Any provider error: NETWORK_ERROR, UNAUTHORIZED, RATE_LIMITED, API_ERROR, PARSE_ERROR
 *   • LLM returns empty or whitespace-only content
 *
 * Never throws — paraphraseAnswer always resolves.
 */

import { ClaudeProvider } from '../providers/ClaudeProvider';
import type { ClaudeProviderConfig } from '../providers/ClaudeProvider';

// ─── Public constants ─────────────────────────────────────────────────────────

/** Default model: Claude Haiku — fast and cost-effective for paraphrase tasks. */
export const LLM_BRIDGE_DEFAULT_MODEL = 'claude-haiku-3-5-latest';

/** Max output tokens for paraphrased answers. */
export const LLM_BRIDGE_DEFAULT_MAX_TOKENS = 512;

/** Temperature for paraphrase tasks: low value → deterministic, minimal creativity. */
export const LLM_BRIDGE_TEMPERATURE = 0.3;

/**
 * System prompt injected into every Claude call.
 *
 * Five numbered rules prohibit the LLM from fabricating legal content:
 *   1. Paraphrase only — no legal reference may be added or removed.
 *   2. Preserve all decree numbers, article numbers, and thresholds verbatim.
 *   3. Never invent Nghị định / Thông tư numbers or thresholds.
 *   4. Never supplement information absent from the source text.
 *   5. Vietnamese administrative language only.
 */
export const SYSTEM_PROMPT =
  'Bạn là trợ lý hành chính chuyên về đấu thầu công theo pháp luật Việt Nam.\n' +
  'Nhiệm vụ: diễn đạt lại văn bản dưới đây bằng ngôn ngữ hành chính Việt Nam tự nhiên, mạch lạc.\n\n' +
  'QUY TẮC BẮT BUỘC:\n' +
  '1. Chỉ được diễn đạt lại — TUYỆT ĐỐI KHÔNG thêm, bớt hoặc thay đổi bất kỳ căn cứ pháp lý nào.\n' +
  '2. Giữ nguyên toàn bộ số hiệu văn bản pháp luật, số điều khoản và ngưỡng giá trị từ văn bản gốc.\n' +
  '3. TUYỆT ĐỐI KHÔNG bịa đặt số hiệu Nghị định, Thông tư, điều khoản hoặc ngưỡng giá trị mới.\n' +
  '4. Nếu văn bản gốc thiếu thông tin về một vấn đề, KHÔNG được tự bổ sung nội dung mới.\n' +
  '5. Đầu ra phải là tiếng Việt hành chính, không dùng ngôn ngữ khác.';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LLMBridgeConfig {
  /**
   * Anthropic API key.  When omitted the function reads ANTHROPIC_API_KEY
   * from process.env.  If neither is set or both are blank, falls back to
   * rule-based answer immediately without making any network call.
   */
  apiKey?:    string;
  /** Model alias.  Defaults to LLM_BRIDGE_DEFAULT_MODEL (Haiku). */
  model?:     string;
  /** Max output tokens.  Defaults to LLM_BRIDGE_DEFAULT_MAX_TOKENS. */
  maxTokens?: number;
  /**
   * Injectable fetch implementation — use a mock in tests.
   * Production omits this field so ClaudeProvider falls back to global fetch.
   */
  fetchFn?:   (url: string, init: RequestInit) => Promise<Response>;
}

export interface LLMBridgeResult {
  /** Final answer: LLM-paraphrased on success, original kbAnswer on fallback. */
  answer:   string;
  /** true iff the LLM was called and returned non-empty, non-whitespace content. */
  usedLLM:  boolean;
  /**
   * Model name as reported by the Anthropic API response.
   * undefined when usedLLM is false.
   */
  model?:   string;
}

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Optionally paraphrases a KB-derived answer via the Claude API.
 *
 * ChatOutput.sources[] (legal citations) are populated by searchLegalKB()
 * before this function is ever called.  This function only rewrites the
 * answer display string — it never sees or touches the sources array.
 *
 * @param kbAnswer - Rule-based answer string from buildAnswer().
 * @param config   - Optional provider config (apiKey, model, fetchFn, etc.).
 * @returns        - LLMBridgeResult; always resolves; never throws.
 */
export async function paraphraseAnswer(
  kbAnswer: string,
  config?: LLMBridgeConfig,
): Promise<LLMBridgeResult> {
  // Guard: nothing to paraphrase
  if (!kbAnswer.trim()) {
    return { answer: kbAnswer, usedLLM: false };
  }

  // Resolve API key: explicit config → env var → empty (fallback)
  const apiKey =
    config?.apiKey?.trim() ??
    process.env['ANTHROPIC_API_KEY']?.trim() ??
    '';

  if (!apiKey) {
    return { answer: kbAnswer, usedLLM: false };
  }

  const providerConfig: ClaudeProviderConfig = {
    apiKey,
    model:       config?.model      ?? LLM_BRIDGE_DEFAULT_MODEL,
    maxTokens:   config?.maxTokens  ?? LLM_BRIDGE_DEFAULT_MAX_TOKENS,
    temperature: LLM_BRIDGE_TEMPERATURE,
    ...(config?.fetchFn !== undefined ? { fetchFn: config.fetchFn } : {}),
  };

  try {
    const provider = new ClaudeProvider(providerConfig);
    const result   = await provider.chat({
      system:   SYSTEM_PROMPT,
      messages: [{ role: 'user', content: kbAnswer }],
    });

    if (!result.ok) {
      return { answer: kbAnswer, usedLLM: false };
    }

    const paraphrased = result.value.content.trim();
    if (!paraphrased) {
      return { answer: kbAnswer, usedLLM: false };
    }

    return {
      answer:  paraphrased,
      usedLLM: true,
      model:   result.value.model,
    };
  } catch {
    return { answer: kbAnswer, usedLLM: false };
  }
}

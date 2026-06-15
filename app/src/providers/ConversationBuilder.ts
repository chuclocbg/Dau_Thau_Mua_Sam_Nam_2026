/**
 * P6-10M: ConversationBuilder — fluent builder that assembles a complete
 * conversation payload ready to send to any supported LLM provider.
 *
 * Responsibilities:
 *   - System prompt: static string or rendered from PromptTemplateManager.
 *   - History injection: from ConversationMemory or a raw MemoryMessage[].
 *   - User message: static string or rendered from PromptTemplateManager.
 *   - Provider-specific formatting:
 *       openai  → system becomes first { role:'system' } message in the array.
 *       claude  → messages are user/assistant only; system is a top-level field.
 *       gemini  → messages are user/assistant only; system becomes systemInstruction.
 *       generic → ProviderManagerRequest-compatible shape (system as separate field).
 *
 * buildConversation():
 *   - Never throws.
 *   - Returns { ok: false, error } when inputs are invalid (missing user message,
 *     template not found, required variables missing).
 *   - Returns { ok: true, conversation } on success.
 *   - All returned objects are independent copies; mutations do not affect the builder.
 *
 * The builder is stateful and reusable: call reset() to clear configuration.
 * All setters return `this` for chaining.
 */

import type { ConversationMemory }   from './ConversationMemory';
import type { MemoryMessage }         from './ConversationMemory';
import { PromptTemplateManager }      from './PromptTemplateManager';

// ─── Provider-specific formatted shapes ──────────────────────────────────────

/** OpenAI: system prepended as first message with role 'system'. */
export interface OpenAIFormattedConversation {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
}

/** Claude: messages are user/assistant only; system is a top-level field. */
export interface ClaudeFormattedConversation {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  system?:  string;
}

/** Gemini wire format: messages are user/assistant only; system becomes systemInstruction. */
export interface GeminiFormattedConversation {
  messages:            Array<{ role: 'user' | 'assistant'; content: string }>;
  systemInstruction?:  string;
}

// ─── Built conversation ───────────────────────────────────────────────────────

export interface BuiltConversation {
  /** Resolved system prompt, or undefined when none was set. */
  system?: string;
  /**
   * Assembled conversation turns (history + user message).
   * Does not include the system prompt as a message; use the provider-specific
   * formats below when you need it embedded in the messages array (OpenAI).
   */
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** OpenAI-specific: system becomes the first { role:'system' } message. */
  openai: OpenAIFormattedConversation;
  /** Claude-specific: user/assistant messages + optional top-level system field. */
  claude: ClaudeFormattedConversation;
  /** Gemini wire format: user/assistant messages + optional systemInstruction field. */
  gemini: GeminiFormattedConversation;
  /**
   * ProviderManager-compatible shape — pass directly to ProviderManager.chat()
   * or ProviderManager.stream().
   */
  providerManagerRequest: {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    system?:  string;
  };
}

// ─── Result ───────────────────────────────────────────────────────────────────

export type ConversationBuildResult =
  | { ok: true;  conversation: BuiltConversation }
  | { ok: false; error: ConversationBuildError };

export interface ConversationBuildError {
  /** Machine-readable error code. */
  code: ConversationBuildErrorCode;
  /** Human-readable description. */
  message: string;
  /**
   * Names of required template variables that were not supplied.
   * Present only when code is SYSTEM_TEMPLATE_RENDER_FAILED or
   * USER_TEMPLATE_RENDER_FAILED.
   */
  missingVariables?: string[];
}

export type ConversationBuildErrorCode =
  | 'NO_USER_MESSAGE'                // neither setUserMessage nor setUserTemplate called
  | 'NO_TEMPLATE_MANAGER'            // template used but no PromptTemplateManager set
  | 'SYSTEM_TEMPLATE_NOT_FOUND'      // system template id not registered in manager
  | 'SYSTEM_TEMPLATE_RENDER_FAILED'  // system template has missing required variables
  | 'USER_TEMPLATE_NOT_FOUND'        // user template id not registered in manager
  | 'USER_TEMPLATE_RENDER_FAILED';   // user template has missing required variables

// ─── Builder options ──────────────────────────────────────────────────────────

export interface ConversationBuilderOptions {
  /** PromptTemplateManager instance. Required only when template methods are called. */
  templateManager?: PromptTemplateManager;
}

// ─── Internal template reference ─────────────────────────────────────────────

interface TemplateRef {
  templateId: string;
  variables?: Record<string, string>;
}

// ─── ConversationBuilder ──────────────────────────────────────────────────────

export class ConversationBuilder {
  private _templateManager?: PromptTemplateManager;
  private _system?:          string;
  private _systemTemplate?:  TemplateRef;
  private _history:          MemoryMessage[];
  private _userMessage?:     string;
  private _userTemplate?:    TemplateRef;

  constructor(options?: ConversationBuilderOptions) {
    this._templateManager = options?.templateManager;
    this._history = [];
  }

  /**
   * Sets the PromptTemplateManager used for system/user template rendering.
   * Replaces any previously set manager.
   */
  setTemplateManager(manager: PromptTemplateManager): this {
    this._templateManager = manager;
    return this;
  }

  /**
   * Sets a static system prompt.
   * Overwrites any previous setSystem or setSystemTemplate call.
   */
  setSystem(prompt: string): this {
    this._system         = prompt;
    this._systemTemplate = undefined;
    return this;
  }

  /**
   * Schedules a template render for the system prompt.
   * The template is not rendered until buildConversation() is called.
   * Overwrites any previous setSystem or setSystemTemplate call.
   */
  setSystemTemplate(templateId: string, variables?: Record<string, string>): this {
    this._systemTemplate = { templateId, variables: variables ? { ...variables } : undefined };
    this._system         = undefined;
    return this;
  }

  /**
   * Replaces the current history with a copy of the provided source.
   *   - ConversationMemory: calls getMessages() for a snapshot.
   *   - MemoryMessage[]:    shallow-copies each element.
   * Call multiple times to replace (not append) the history.
   */
  injectHistory(source: ConversationMemory | MemoryMessage[]): this {
    if (Array.isArray(source)) {
      this._history = source.map(m => ({ ...m }));
    } else {
      this._history = source.getMessages();
    }
    return this;
  }

  /**
   * Sets the user message to be appended after history.
   * Overwrites any previous setUserMessage or setUserTemplate call.
   */
  setUserMessage(content: string): this {
    this._userMessage  = content;
    this._userTemplate = undefined;
    return this;
  }

  /**
   * Schedules a template render for the user message.
   * The template is not rendered until buildConversation() is called.
   * Overwrites any previous setUserMessage or setUserTemplate call.
   */
  setUserTemplate(templateId: string, variables?: Record<string, string>): this {
    this._userTemplate = { templateId, variables: variables ? { ...variables } : undefined };
    this._userMessage  = undefined;
    return this;
  }

  /**
   * Assembles the conversation and returns independent copies in all formats.
   *
   * Steps:
   *   1. Resolve system prompt (static → template → none).
   *   2. Resolve user message (static → template; required).
   *   3. Build messages = [...history, { role:'user', content: userMsg }].
   *   4. Return all provider-specific formatted shapes plus the raw result.
   *
   * Never throws.
   */
  buildConversation(): ConversationBuildResult {
    // ── 1. Resolve system prompt ───────────────────────────────────────────────
    let resolvedSystem: string | undefined;

    if (this._system !== undefined) {
      resolvedSystem = this._system;
    } else if (this._systemTemplate !== undefined) {
      const mgr = this._templateManager;
      if (!mgr) {
        return buildErr('NO_TEMPLATE_MANAGER',
          'A PromptTemplateManager must be set before using system templates.');
      }
      const ref = this._systemTemplate;
      const tmpl = mgr.getTemplate(ref.templateId);
      if (!tmpl) {
        return buildErr('SYSTEM_TEMPLATE_NOT_FOUND',
          `System template '${ref.templateId}' is not registered in the PromptTemplateManager.`);
      }
      const rendered = mgr.render(ref.templateId, { variables: ref.variables });
      if (!rendered.ok) {
        return buildErr('SYSTEM_TEMPLATE_RENDER_FAILED',
          `System template '${ref.templateId}' is missing required variables: ${rendered.missingVariables.join(', ')}.`,
          rendered.missingVariables);
      }
      resolvedSystem = rendered.rendered;
    }
    // else: no system prompt

    // ── 2. Resolve user message ────────────────────────────────────────────────
    let resolvedUser: string;

    if (this._userMessage !== undefined) {
      resolvedUser = this._userMessage;
    } else if (this._userTemplate !== undefined) {
      const mgr = this._templateManager;
      if (!mgr) {
        return buildErr('NO_TEMPLATE_MANAGER',
          'A PromptTemplateManager must be set before using user templates.');
      }
      const ref = this._userTemplate;
      const tmpl = mgr.getTemplate(ref.templateId);
      if (!tmpl) {
        return buildErr('USER_TEMPLATE_NOT_FOUND',
          `User template '${ref.templateId}' is not registered in the PromptTemplateManager.`);
      }
      const rendered = mgr.render(ref.templateId, { variables: ref.variables });
      if (!rendered.ok) {
        return buildErr('USER_TEMPLATE_RENDER_FAILED',
          `User template '${ref.templateId}' is missing required variables: ${rendered.missingVariables.join(', ')}.`,
          rendered.missingVariables);
      }
      resolvedUser = rendered.rendered;
    } else {
      return buildErr('NO_USER_MESSAGE',
        'A user message is required. Call setUserMessage() or setUserTemplate() before buildConversation().');
    }

    // ── 3. Assemble messages ───────────────────────────────────────────────────
    const historySnapshot = this._history.map(m => ({ ...m }));
    const userTurn: { role: 'user' | 'assistant'; content: string } =
      { role: 'user', content: resolvedUser };
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> =
      [...historySnapshot, userTurn];

    // ── 4. Build provider-specific formats ─────────────────────────────────────
    const openai: OpenAIFormattedConversation = {
      messages: resolvedSystem
        ? [{ role: 'system', content: resolvedSystem }, ...messages.map(m => ({ ...m }))]
        : messages.map(m => ({ ...m })),
    };

    const claude: ClaudeFormattedConversation = {
      messages: messages.map(m => ({ ...m })),
      ...(resolvedSystem !== undefined ? { system: resolvedSystem } : {}),
    };

    const gemini: GeminiFormattedConversation = {
      messages: messages.map(m => ({ ...m })),
      ...(resolvedSystem !== undefined ? { systemInstruction: resolvedSystem } : {}),
    };

    const providerManagerRequest = {
      messages: messages.map(m => ({ ...m })),
      ...(resolvedSystem !== undefined ? { system: resolvedSystem } : {}),
    };

    const conversation: BuiltConversation = {
      ...(resolvedSystem !== undefined ? { system: resolvedSystem } : {}),
      messages: messages.map(m => ({ ...m })),
      openai,
      claude,
      gemini,
      providerManagerRequest,
    };

    return { ok: true, conversation };
  }

  /**
   * Clears all configuration (system, history, user message, template manager).
   * Returns `this` for chaining a fresh build sequence.
   */
  reset(): this {
    this._system         = undefined;
    this._systemTemplate = undefined;
    this._history        = [];
    this._userMessage    = undefined;
    this._userTemplate   = undefined;
    this._templateManager = undefined;
    return this;
  }
}

// ─── Internal helper ──────────────────────────────────────────────────────────

function buildErr(
  code:              ConversationBuildErrorCode,
  message:           string,
  missingVariables?: string[],
): ConversationBuildResult {
  const error: ConversationBuildError = { code, message };
  if (missingVariables !== undefined) error.missingVariables = [...missingVariables];
  return { ok: false, error };
}

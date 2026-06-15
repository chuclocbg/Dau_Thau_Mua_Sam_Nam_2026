/**
 * P6-10A / P6-10B / P6-10C / P6-10D / P6-10F: Providers barrel — public API for LLM provider adapters.
 *
 * Import from this path rather than directly from individual provider modules
 * so that future adapters (AzureOpenAIProvider, etc.) can be added here
 * without changing call sites.
 *
 * ModelInfo is shared across all providers; it is defined once in OpenAIProvider
 * and re-exported here as the canonical source.
 */

export {
  OpenAIProvider,

  // Config
  type OpenAIProviderConfig,

  // Request / Response
  type OpenAIChatMessage,
  type OpenAIChatRequest,
  type OpenAIChatResponse,

  // Error types
  type OpenAIErrorCode,
  type OpenAIProviderError,
  type OpenAIResult,

  // Shared model info (used by all providers)
  type ModelInfo,
} from './OpenAIProvider';

export {
  ClaudeProvider,

  // Config
  type ClaudeProviderConfig,

  // Request / Response
  type ClaudeChatMessage,
  type ClaudeChatRequest,
  type ClaudeChatResponse,

  // Error types
  type ClaudeErrorCode,
  type ClaudeProviderError,
  type ClaudeResult,
} from './ClaudeProvider';

export {
  GeminiProvider,

  // Config
  type GeminiProviderConfig,

  // Request / Response
  type GeminiChatMessage,
  type GeminiChatRequest,
  type GeminiChatResponse,

  // Error types
  type GeminiErrorCode,
  type GeminiProviderError,
  type GeminiResult,
} from './GeminiProvider';

export {
  ProviderRegistry,

  // Identity
  type ProviderId,
  type ProviderType,

  // Common interface
  type ILLMProvider,

  // Registry entry + options
  type ProviderEntry,
  type RegisterOptions,

  // Error types
  type RegistryErrorCode,
  type RegistryError,
  type RegistryResult,
} from './ProviderRegistry';

export {
  loadOpenAIConfigFromEnv,
  loadClaudeConfigFromEnv,
  loadGeminiConfigFromEnv,
} from './env';

/**
 * P6-10A: Providers barrel — public API for LLM provider adapters.
 *
 * Import from this path rather than directly from individual provider modules
 * so that future adapters (AnthropicProvider, AzureOpenAIProvider, etc.) can
 * be added here without changing call sites.
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

  // Model info
  type ModelInfo,
} from './OpenAIProvider';

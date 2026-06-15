/**
 * P6-10A / P6-10B / P6-10C / P6-10D / P6-10F / P6-10H / P6-10I: Providers barrel — public API for LLM provider adapters.
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

export {
  ProviderManager,

  // Config
  type ProviderManagerConfig,

  // Request / Response
  type ProviderManagerMessage,
  type ProviderManagerRequest,
  type ProviderManagerResponse,

  // Error types
  type ProviderManagerErrorCode,
  type ProviderManagerError,
  type ProviderManagerResult,
} from './ProviderManager';

export {
  ConversationMemory,
  type MemoryMessage,
  type MemoryOptions,
} from './ConversationMemory';

export {
  RetryPolicy,
  type RetryOptions,
  type FallbackOptions,
  type RetryResult,
} from './RetryPolicy';

export {
  ModelManager,
  type ModelCapability,
  type ModelMetadata,
  type ModelSelectionOptions,
  type ModelSelectionResult,
} from './ModelManager';

export {
  PromptTemplateManager,
  type PromptTemplate,
  type PromptVariable,
  type PromptRenderOptions,
  type PromptRenderResult,
} from './PromptTemplateManager';

export {
  ToolExecutor,
  type ToolExecutionOptions,
  type ToolExecutionResult,
  type ToolExecutionError,
  type ToolExecutionErrorCode,
} from './ToolExecutor';

export {
  ToolRegistry,
  type ToolDefinition,
  type ToolParameter,
  type ToolCall,
  type ToolResult,
  type ToolRegistryError,
  type ToolRegistryErrorCode,
  type ToolRegistryResult,
} from './ToolRegistry';

export {
  AgentRuntime,
  type AgentRuntimeOptions,
  type AgentRuntimeResult,
  type AgentRuntimeError,
  type AgentRuntimeErrorCode,
} from './AgentRuntime';

export {
  ConversationBuilder,
  type ConversationBuilderOptions,
  type ConversationBuildResult,
  type ConversationBuildError,
  type ConversationBuildErrorCode,
  type BuiltConversation,
  type OpenAIFormattedConversation,
  type ClaudeFormattedConversation,
  type GeminiFormattedConversation,
} from './ConversationBuilder';

export {
  // Streaming types
  type StreamEventType,
  type StreamChunk,
  type StreamResponse,
  type StreamingProvider,

  // Streaming utility
  readSseLines,
} from './StreamingTypes';

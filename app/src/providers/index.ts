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
  MemoryStore,
  type MemorySnapshot,
  type MemoryStoreOptions,
  type MemoryStoreResult,
  type MemoryStoreError,
  type MemoryStoreErrorCode,
} from './MemoryStore';

export {
  SessionManager,
  type SessionState,
  type SessionInfo,
  type SessionOptions,
  type SessionResult,
  type SessionError,
  type SessionErrorCode,
} from './SessionManager';

export {
  Planner,
  type PlannerOptions,
  type PlanStep,
  type PlanResult,
  type PlannerError,
  type PlannerErrorCode,
} from './Planner';

export {
  AgentRuntime,
  type AgentRuntimeOptions,
  type AgentRuntimeResult,
  type AgentRuntimeError,
  type AgentRuntimeErrorCode,
} from './AgentRuntime';

export {
  WorkflowEngine,
  type WorkflowStep,
  type WorkflowDefinition,
  type WorkflowExecution,
  type WorkflowOptions,
  type WorkflowResult,
  type WorkflowError,
  type WorkflowErrorCode,
} from './WorkflowEngine';

export {
  ToolCallingAgent,
  type ToolCall,
  type ToolCallResult,
  type ToolCallOptions,
  type ToolCallingResult,
  type ToolCallingError,
  type ToolCallingErrorCode,
} from './ToolCallingAgent';

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
  ApiServer,
  type ApiRoute,
  type ApiRequest,
  type ApiResponse,
  type ApiServerOptions,
  type ApiServerResult,
  type ApiServerError,
  type ApiServerErrorCode,
} from './ApiServer';

export {
  MultiAgentCoordinator,
  type AgentDefinition,
  type AgentTask,
  type AgentExecution,
  type AgentCoordinatorOptions,
  type AgentCoordinatorResult,
  type AgentCoordinatorError,
  type AgentCoordinatorErrorCode,
} from './MultiAgentCoordinator';

export {
  // Streaming types
  type StreamEventType,
  type StreamChunk,
  type StreamResponse,
  type StreamingProvider,

  // Streaming utility
  readSseLines,
} from './StreamingTypes';

export {
  Logger,
  type LogLevel,
  type LogEntry,
  type LoggerOptions,
  type LoggerResult,
  type LoggerError,
  type LoggerErrorCode,
} from './Logger';

export {
  EventBus,
  type EventListener,
  type EventPayload,
  type SubscriptionToken,
  type PublishResult,
  type EventBusResult,
  type EventBusError,
  type EventBusErrorCode,
} from './EventBus';

export {
  CacheStore,
  type CacheResult,
  type CacheError,
  type CacheErrorCode,
} from './CacheStore';

export {
  ConfigStore,
  type ConfigResult,
  type ConfigError,
  type ConfigErrorCode,
} from './ConfigStore';

export {
  MetricsCollector,
  type MetricEntry,
  type MetricsResult,
  type MetricsError,
  type MetricsErrorCode,
} from './MetricsCollector';

export {
  StateStore,
  type StateSnapshot,
  type StateResult,
  type StateError,
  type StateErrorCode,
} from './StateStore';

export {
  TaskQueue,
  type TaskQueueResult,
  type TaskQueueError,
  type TaskQueueErrorCode,
} from './TaskQueue';

export {
  ResourcePool,
  type ResourcePoolOptions,
  type ResourcePoolResult,
  type ResourcePoolError,
  type ResourcePoolErrorCode,
} from './ResourcePool';

export {
  RetryManager,
  type RetryManagerOptions,
  type RetryAttempt,
  type RetryManagerResult,
  type RetryManagerError,
  type RetryManagerErrorCode,
} from './RetryManager';

export {
  RestClient,
  type RestClientFetch,
  type RestClientOptions,
  type RequestOptions,
  type RestResponse,
  type RestClientResult,
  type RestClientError,
  type RestClientErrorCode,
} from './RestClient';

export {
  RateLimiter,
  type RateLimiterOptions,
  type RateLimiterResult,
  type RateLimiterError,
  type RateLimiterErrorCode,
} from './RateLimiter';

export {
  HttpInterceptor,
  type HttpRequest,
  type HttpResponse,
  type HttpInterceptorEntry,
  type HttpInterceptorResult,
  type HttpHandler,
  type RequestInterceptorFn,
  type ResponseInterceptorFn,
  type HttpInterceptorError,
  type HttpInterceptorErrorCode,
} from './HttpInterceptor';

export {
  WebSocketClient,
  type ConnectionStatus,
  type WebSocketCloseEvent,
  type MessageHandler,
  type OpenHandler,
  type CloseHandler,
  type ErrorHandler,
  type WebSocketTransport,
  type WebSocketFactory,
  type WebSocketClientOptions,
  type WebSocketClientResult,
  type WebSocketClientError,
  type WebSocketClientErrorCode,
} from './WebSocketClient';

export {
  Scheduler,
  type SchedulerJob,
  type ScheduledJob,
  type SchedulerResult,
  type SchedulerError,
  type SchedulerErrorCode,
} from './Scheduler';

export {
  Pipeline,
  type PipelineStage,
  type PipelineStageEntry,
  type PipelineResult,
  type PipelineError,
  type PipelineErrorCode,
} from './Pipeline';

export {
  MiddlewareChain,
  type MiddlewareFn,
  type MiddlewareContext,
  type MiddlewareEntry,
  type MiddlewareResult,
  type MiddlewareError,
  type MiddlewareErrorCode,
} from './MiddlewareChain';

export {
  HookManager,
  type HookFn,
  type HookEntry,
  type HookResult,
  type HookError,
  type HookErrorCode,
} from './HookManager';

export {
  PluginManager,
  type PluginInfo,
  type PluginResult,
  type PluginError,
  type PluginErrorCode,
} from './PluginManager';

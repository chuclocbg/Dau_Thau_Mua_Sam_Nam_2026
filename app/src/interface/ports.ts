/**
 * Phase 14 — Governance Interface Layer: Port Definitions
 *
 * In Hexagonal (Ports & Adapters) Architecture, PRIMARY ports define the
 * contracts that INBOUND adapters must satisfy to communicate with the
 * Application Layer. No adapter may skip this contract to call the Kernel.
 *
 * Five port contracts are defined here:
 *
 *   GovernanceApiPort  — RESTful HTTP adapters (implemented: restAdapter.ts)
 *   GovernanceMcpPort  — MCP Server tool adapters (future Phase 14.x)
 *   GovernanceCliPort  — CLI command adapters (future Phase 14.x)
 *   GovernanceChatPort — AI Chat adapters (future Phase 14.x)
 *   GovernanceSdkPort  — TypeScript SDK clients (future Phase 14.x)
 *
 * Shared vocabulary types used by all ports:
 *
 *   HttpRequest         — minimal shape of an inbound HTTP request (Fastify-compatible)
 *   HttpResponse<T>     — HTTP status + GovernanceResult body
 *   PortRequest<TBody>  — port-level request envelope (actor + body + routing metadata)
 *
 * Pure types. No I/O. No side effects. No any. No React. No browser globals.
 */

import type { GovernanceResult }  from '../application/governanceContext';
import type { WorkflowInstance }  from '../legal/workflowOrchestrator';
import type { LegalDocument }     from '../legal/legalRegistry';
import type { GovernanceConfig }  from '../legal/governanceConfig';
import type { RuleResult }        from '../legal/governanceRuleEngine';
import type { ImpactReport }      from '../legal/governanceImpactEngine';
import type {
  ProcurementService,
  ProcurementStatus,
} from '../application/procurementService';
import type { LegalService }            from '../application/legalService';
import type { WorkflowService }         from '../application/workflowService';
import type { AuditService }            from '../application/auditService';
import type {
  DashboardService,
  DashboardSummary,
  LegalSummary,
} from '../application/dashboardService';
import type { ConfigurationService }    from '../application/configurationService';

// ─── Shared HTTP vocabulary ────────────────────────────────────────────────────

/**
 * Minimal inbound HTTP request shape.
 * Both the real Fastify FastifyRequest and test plain objects satisfy this.
 */
export interface HttpRequest {
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body:    unknown;
  readonly params:  Record<string, string>;
  readonly query:   Record<string, string | string[] | undefined>;
}

/**
 * HTTP response envelope returned by every REST adapter handler.
 * httpStatus derives from GovernanceResult.status via responseMapper.
 */
export interface HttpResponse<TData = unknown> {
  readonly httpStatus: number;
  readonly body:       GovernanceResult<TData>;
}

// ─── GovernanceApiPort — REST / HTTP ─────────────────────────────────────────

/**
 * Contract for all HTTP/REST adapters.
 * Each method accepts an HttpRequest and returns an HttpResponse.
 * Adapter implementations may be Fastify, Express, Hono, etc.
 */
export interface GovernanceApiPort {
  startProcurement(req: HttpRequest):     Promise<HttpResponse<WorkflowInstance>>;
  reviewProcurement(req: HttpRequest):    Promise<HttpResponse<WorkflowInstance>>;
  getProcurementStatus(req: HttpRequest): Promise<HttpResponse<ProcurementStatus>>;
  resolveApplicableLaw(req: HttpRequest): Promise<HttpResponse<readonly LegalDocument[]>>;
  searchLaw(req: HttpRequest):            Promise<HttpResponse<readonly LegalDocument[]>>;
  startWorkflow(req: HttpRequest):        Promise<HttpResponse<WorkflowInstance>>;
  advanceWorkflow(req: HttpRequest):      Promise<HttpResponse<WorkflowInstance>>;
  getWorkflowHistory(req: HttpRequest):   Promise<HttpResponse<unknown>>;
  reviewCompliance(req: HttpRequest):     Promise<HttpResponse<RuleResult>>;
  getAuditRules(req: HttpRequest):        Promise<HttpResponse<readonly GovernanceConfig[]>>;
  getGovernanceDashboard(req: HttpRequest): Promise<HttpResponse<DashboardSummary>>;
  resolveConfiguration(req: HttpRequest): Promise<HttpResponse<readonly GovernanceConfig[]>>;
  generateGovernanceContext(req: HttpRequest): Promise<HttpResponse<unknown>>;
}

// ─── GovernanceMcpPort — MCP Server (future) ─────────────────────────────────

/** A single MCP tool definition, following the MCP protocol schema. */
export interface McpTool {
  readonly name:        string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>; // JSON Schema object
}

/** Result returned from MCP tool execution. */
export interface McpCallResult {
  readonly content:  readonly { readonly type: 'text'; readonly text: string }[];
  readonly isError?: boolean;
}

/**
 * Contract for MCP Server adapters.
 * Each governance capability becomes a named MCP tool.
 * Implementation: future Phase 14.x.
 */
export interface GovernanceMcpPort {
  /** All tools this MCP server exposes. */
  readonly tools: readonly McpTool[];
  /** Execute a tool by name with caller-supplied arguments. */
  callTool(name: string, args: Readonly<Record<string, unknown>>): Promise<McpCallResult>;
}

// ─── GovernanceCliPort — CLI Commands (future) ───────────────────────────────

/** Descriptor for a single CLI argument. */
export interface CliArg {
  readonly name:     string;
  readonly type:     'string' | 'number' | 'boolean';
  readonly required: boolean;
  readonly help:     string;
}

/** Descriptor for a single CLI command. */
export interface CliCommand {
  readonly name:        string;
  readonly description: string;
  readonly args:        readonly CliArg[];
}

/**
 * Contract for CLI adapters.
 * Commands map 1-to-1 with Application Service operations.
 * Implementation: future Phase 14.x.
 */
export interface GovernanceCliPort {
  /** All commands this CLI exposes. */
  readonly commands: readonly CliCommand[];
  /** Execute a command by name; returns formatted text output (YAML/JSON/table). */
  execute(command: string, args: Readonly<Record<string, unknown>>): Promise<string>;
}

// ─── GovernanceChatPort — AI Chat Integration (future) ───────────────────────

/** A single message in a chat conversation. */
export interface ChatMessage {
  readonly role:    'user' | 'assistant';
  readonly content: string;
}

/** Structured response from the governance chat agent. */
export interface ChatResponse {
  readonly answer:     string;
  readonly sources:    readonly string[];
  readonly confidence: 'high' | 'medium' | 'low';
  readonly followUps:  readonly string[];
}

/**
 * Contract for AI Chat adapters that use governance knowledge.
 * Implementation: future Phase 14.x.
 */
export interface GovernanceChatPort {
  /** Answer a natural-language question using governance knowledge. */
  answer(
    message:     string,
    history:     readonly ChatMessage[],
    currentDate: string,
  ): Promise<ChatResponse>;

  /** Search governance knowledge base by keyword. */
  search(keyword: string, currentDate: string): Promise<readonly string[]>;
}

// ─── GovernanceSdkPort — TypeScript SDK (future) ─────────────────────────────

/**
 * Contract for the TypeScript SDK, intended for direct programmatic use
 * from server-side TypeScript applications that embed the governance system.
 *
 * Unlike the HTTP or CLI adapters, the SDK exposes the application services
 * directly (typed, not serialised). No serialisation overhead.
 * Implementation: future Phase 14.x.
 */
export interface GovernanceSdkPort {
  readonly procurement:   ProcurementService;
  readonly legal:         LegalService;
  readonly workflow:      WorkflowService;
  readonly audit:         AuditService;
  readonly dashboard:     DashboardService;
  readonly configuration: ConfigurationService;
}

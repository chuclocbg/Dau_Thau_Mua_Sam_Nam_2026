/**
 * Phase 18 — Capability Framework: Types and Contracts
 *
 * Defines the universal contracts used by every business capability
 * (Procurement, Assets, HR, Audit, Legal, Finance, …).
 *
 * The framework is domain-agnostic.  All business logic lives inside
 * individual capabilities, not here.
 *
 * Exports:
 *   CapabilityStatus    — SUCCESS | FAILED | PENDING | NOT_FOUND
 *   KNOWN_DOMAINS       — the six supported governance domains
 *   CapabilityMetadata  — static description of a capability
 *   CapabilityRequest   — input envelope (domain + context)
 *   CapabilityResult<T> — output envelope
 *   ValidationResult    — pass/fail from Capability.validate()
 *   CapabilityContext   — enriched execution context (built by the executor)
 *   Capability          — the interface every capability must implement
 *   CapabilityHooks     — optional lifecycle observers
 *   createCapabilityMetadata()
 *   createCapabilityRequest()
 *   createCapabilityResult()
 *   createCapabilityContext()
 *
 * Pure. No I/O. No side effects. No any. No React. No browser globals.
 */

import type { GovernanceContext } from '../application/governanceContext';

// ─── Enumerations ─────────────────────────────────────────────────────────────

export type CapabilityStatus = 'SUCCESS' | 'FAILED' | 'PENDING' | 'NOT_FOUND';

/** Runtime constant of all supported governance domains. */
export const KNOWN_DOMAINS = Object.freeze([
  'PROCUREMENT', 'ASSETS', 'HR', 'AUDIT', 'LEGAL', 'FINANCE',
] as const);

export type KnownDomain = typeof KNOWN_DOMAINS[number];

// ─── CapabilityMetadata ───────────────────────────────────────────────────────

/** Static description of a capability — domain, version, required inputs. */
export interface CapabilityMetadata {
  readonly id:          string;
  readonly name:        string;
  readonly domain:      string;          // matches a KnownDomain or any custom string
  readonly version:     string;
  readonly description: string;
  readonly inputSchema: readonly string[];   // context field names this capability reads
  readonly tags:        readonly string[];
}

export function createCapabilityMetadata(params: {
  readonly id:           string;
  readonly name:         string;
  readonly domain:       string;
  readonly version:      string;
  readonly description:  string;
  readonly inputSchema?: readonly string[];
  readonly tags?:        readonly string[];
}): CapabilityMetadata {
  return {
    id:          params.id,
    name:        params.name,
    domain:      params.domain,
    version:     params.version,
    description: params.description,
    inputSchema: Object.freeze([...(params.inputSchema ?? [])]),
    tags:        Object.freeze([...(params.tags        ?? [])]),
  };
}

// ─── CapabilityRequest ────────────────────────────────────────────────────────

/** Input envelope for every capability execution. */
export interface CapabilityRequest {
  readonly domain:      string;
  readonly operation?:  string;        // optional sub-operation (e.g. 'analyze', 'decide')
  readonly context:     GovernanceContext;
  readonly metadata:    Readonly<Record<string, string>>;
}

export function createCapabilityRequest(params: {
  readonly domain:     string;
  readonly context:    GovernanceContext;
  readonly operation?: string;
  readonly metadata?:  Record<string, string>;
}): CapabilityRequest {
  return {
    domain:    params.domain,
    operation: params.operation,
    context:   params.context,
    metadata:  Object.freeze({ ...(params.metadata ?? {}) }),
  };
}

// ─── CapabilityResult ─────────────────────────────────────────────────────────

/** Standardised output envelope returned by every capability execution. */
export interface CapabilityResult<T = unknown> {
  readonly status:        CapabilityStatus;
  readonly data?:         T;
  readonly domain:        string;
  readonly capabilityId:  string;
  readonly messages:      readonly string[];
  readonly errors:        readonly string[];
  readonly executedAt:    string;     // ISO-8601 timestamp
  readonly traceId?:      string;
}

export function createCapabilityResult<T = unknown>(params: {
  readonly status:        CapabilityStatus;
  readonly data?:         T;
  readonly domain:        string;
  readonly capabilityId:  string;
  readonly messages?:     readonly string[];
  readonly errors?:       readonly string[];
  readonly traceId?:      string;
}): CapabilityResult<T> {
  return {
    status:       params.status,
    data:         params.data,
    domain:       params.domain,
    capabilityId: params.capabilityId,
    messages:     Object.freeze([...(params.messages ?? [])]),
    errors:       Object.freeze([...(params.errors   ?? [])]),
    executedAt:   new Date().toISOString(),
    traceId:      params.traceId,
  };
}

// ─── ValidationResult ─────────────────────────────────────────────────────────

export interface ValidationResult {
  readonly valid:    boolean;
  readonly messages: readonly string[];
}

// ─── CapabilityContext ────────────────────────────────────────────────────────

/** Enriched execution context built by the executor before the capability runs. */
export interface CapabilityContext {
  readonly request:   CapabilityRequest;
  readonly metadata:  CapabilityMetadata;
  readonly startedAt: string;   // ISO-8601 timestamp (non-deterministic)
  readonly traceId:   string;
}

export function createCapabilityContext(
  request:  CapabilityRequest,
  metadata: CapabilityMetadata,
): CapabilityContext {
  return {
    request,
    metadata,
    startedAt: new Date().toISOString(),
    traceId:   request.context.traceId ?? request.context.requestId,
  };
}

// ─── Capability ───────────────────────────────────────────────────────────────

/**
 * The interface every business capability must implement.
 *
 * execute() is the single entry point; it receives the GovernanceContext and
 * returns domain-specific output.  The framework does not inspect the output —
 * it wraps it into a CapabilityResult<unknown>.
 *
 * validate() is optional.  If present and returns valid=false, the executor
 * short-circuits and returns a FAILED result before calling execute().
 */
export interface Capability {
  readonly metadata: CapabilityMetadata;
  execute(input: GovernanceContext):            unknown;
  validate?(input: GovernanceContext):          ValidationResult;
}

// ─── CapabilityHooks ─────────────────────────────────────────────────────────

/**
 * Optional lifecycle observers.  Each hook receives the execution context
 * (and result where available) as read-only arguments.
 * Hooks must not throw; errors in hooks are silently swallowed by the executor.
 */
export interface CapabilityHooks {
  readonly beforeValidation?: (ctx: CapabilityContext) => void;
  readonly afterValidation?:  (ctx: CapabilityContext, result: ValidationResult) => void;
  readonly beforeExecution?:  (ctx: CapabilityContext) => void;
  readonly afterExecution?:   (ctx: CapabilityContext, result: CapabilityResult<unknown>) => void;
  readonly onError?:          (ctx: CapabilityContext, error: unknown) => void;
}

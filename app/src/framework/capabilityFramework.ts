/**
 * Phase 18 — Capability Framework: Registry, Router, Executor
 *
 * Three classes that together form the Capability Framework:
 *
 *   CapabilityRegistry  — stores and looks up capabilities by domain
 *   CapabilityRouter    — routes a CapabilityRequest to the right capability
 *   CapabilityExecutor  — runs the full lifecycle with optional hooks
 *
 * CapabilityLifecycle (inside executeCapability):
 *   1. resolveCapability    → NOT_FOUND if missing
 *   2. createCapabilityContext
 *   3. beforeValidation hook
 *   4. validate()            → FAILED if invalid
 *   5. afterValidation hook
 *   6. beforeExecution hook
 *   7. execute()             → domain output
 *   8. afterExecution hook
 *   9. CapabilityResult<T>   → SUCCESS
 *   (catch) onError hook    → FAILED
 *
 * The framework never contains business logic.  Business logic belongs only
 * inside individual capabilities.
 *
 * Public APIs:
 *   CapabilityRegistry.registerCapability()
 *   CapabilityRegistry.resolveCapability()
 *   CapabilityRegistry.listCapabilities()
 *   CapabilityRouter.routeRequest()
 *   CapabilityExecutor.executeCapability()
 *   buildCapabilityFramework()
 *
 * Pure. No I/O. No side effects. No any. No React. No browser globals.
 */

import type { GovernanceContext } from '../application/governanceContext';
import {
  createCapabilityContext,
  createCapabilityResult,
  type Capability,
  type CapabilityHooks,
  type CapabilityMetadata,
  type CapabilityRequest,
  type CapabilityResult,
  type ValidationResult,
} from './capabilityTypes';

// ─── CapabilityRegistry ───────────────────────────────────────────────────────

export class CapabilityRegistry {
  // ponytail: keyed by domain string; one registration per domain
  private readonly map = new Map<string, Capability>();

  registerCapability(capability: Capability): void {
    this.map.set(capability.metadata.domain, capability);
  }

  resolveCapability(domain: string): Capability | undefined {
    return this.map.get(domain);
  }

  listCapabilities(): readonly CapabilityMetadata[] {
    return Object.freeze([...this.map.values()].map(c => c.metadata));
  }
}

// ─── CapabilityRouter ─────────────────────────────────────────────────────────

export class CapabilityRouter {
  constructor(private readonly registry: CapabilityRegistry) {}

  routeRequest(request: CapabilityRequest): Capability | undefined {
    return this.registry.resolveCapability(request.domain);
  }
}

// ─── CapabilityExecutor ───────────────────────────────────────────────────────

export class CapabilityExecutor {
  constructor(
    private readonly registry: CapabilityRegistry,
    private readonly hooks?:   CapabilityHooks,
  ) {}

  executeCapability<T = unknown>(request: CapabilityRequest): CapabilityResult<T> {
    const cap = this.registry.resolveCapability(request.domain);

    if (!cap) {
      return createCapabilityResult<T>({
        status:       'NOT_FOUND',
        domain:       request.domain,
        capabilityId: '',
        errors:       [`No capability registered for domain '${request.domain}'.`],
      });
    }

    const ctx = createCapabilityContext(request, cap.metadata);

    // ── 1. Validation ─────────────────────────────────────────────────────────
    safeCall(() => this.hooks?.beforeValidation?.(ctx));

    const validation: ValidationResult = cap.validate
      ? cap.validate(request.context as GovernanceContext)
      : { valid: true, messages: [] };

    safeCall(() => this.hooks?.afterValidation?.(ctx, validation));

    if (!validation.valid) {
      const result = createCapabilityResult<T>({
        status:       'FAILED',
        domain:       request.domain,
        capabilityId: cap.metadata.id,
        errors:       [...validation.messages],
        traceId:      ctx.traceId,
      });
      safeCall(() => this.hooks?.afterExecution?.(ctx, result));
      return result;
    }

    // ── 2. Execution ──────────────────────────────────────────────────────────
    safeCall(() => this.hooks?.beforeExecution?.(ctx));

    try {
      const data   = cap.execute(request.context as GovernanceContext) as T;
      const result = createCapabilityResult<T>({
        status:       'SUCCESS',
        data,
        domain:       request.domain,
        capabilityId: cap.metadata.id,
        traceId:      ctx.traceId,
      });
      safeCall(() => this.hooks?.afterExecution?.(ctx, result));
      return result;
    } catch (err) {
      safeCall(() => this.hooks?.onError?.(ctx, err));
      return createCapabilityResult<T>({
        status:       'FAILED',
        domain:       request.domain,
        capabilityId: cap.metadata.id,
        errors:       [err instanceof Error ? err.message : 'Unknown execution error.'],
        traceId:      ctx.traceId,
      });
    }
  }
}

// ─── CapabilityFramework ──────────────────────────────────────────────────────

export interface CapabilityFramework {
  readonly registry: CapabilityRegistry;
  readonly router:   CapabilityRouter;
  readonly executor: CapabilityExecutor;
}

export function buildCapabilityFramework(hooks?: CapabilityHooks): CapabilityFramework {
  const registry = new CapabilityRegistry();
  const router   = new CapabilityRouter(registry);
  const executor = new CapabilityExecutor(registry, hooks);
  return { registry, router, executor };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Swallow hook errors — hooks are observers and must not affect capability output. */
function safeCall(fn: () => void): void {
  try { fn(); } catch { /* intentionally empty */ }
}

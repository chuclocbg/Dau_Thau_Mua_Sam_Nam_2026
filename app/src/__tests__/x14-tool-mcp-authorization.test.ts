/**
 * Phase X.14 — unit tests for withToolAuthorization() (Tool authorization) and
 * authorizeMcpToolCall() (MCP authorization hooks).
 */

import { describe, it, expect } from 'vitest'
import { withToolAuthorization } from '../identity/application/toolAuthorization.ts'
import { authorizeMcpToolCall } from '../identity/application/mcpAuthorization.ts'
import { buildAnonymousContext, buildServiceContext, buildSystemContext } from '../identity/application/authenticationContext.ts'
import type { ToolDecider } from '../reasoning/domain/toolCallingTypes.ts'

const alwaysInvoke: ToolDecider = () => ({ shouldInvoke: true, call: { toolName: 't', args: {} }, reason: 'test wants to invoke' })
const neverInvoke: ToolDecider = () => ({ shouldInvoke: false, reason: 'inner decider declines' })

describe('withToolAuthorization', () => {
  it('passes an inner decline through unchanged (never even reaches the authorization check)', () => {
    const wrapped = withToolAuthorization(buildAnonymousContext(), neverInvoke)
    const decision = wrapped(undefined as never, undefined as never)
    expect(decision.shouldInvoke).toBe(false)
    expect(decision.reason).toBe('inner decider declines')
  })

  it('denies an inner invocation when the principal lacks tool:invoke -- ANONYMOUS has none', () => {
    const wrapped = withToolAuthorization(buildAnonymousContext(), alwaysInvoke)
    const decision = wrapped(undefined as never, undefined as never)
    expect(decision.shouldInvoke).toBe(false)
    expect(decision.reason).toMatch(/Tool invocation denied/)
  })

  it('allows an inner invocation through when the principal holds tool:invoke -- SERVICE does', () => {
    const wrapped = withToolAuthorization(buildServiceContext('svc'), alwaysInvoke)
    const decision = wrapped(undefined as never, undefined as never)
    expect(decision.shouldInvoke).toBe(true)
    expect(decision.call).toEqual({ toolName: 't', args: {} })
  })
})

describe('authorizeMcpToolCall', () => {
  it('denies ANONYMOUS by default -- no MCP permission is pre-granted', () => {
    const decision = authorizeMcpToolCall(buildAnonymousContext(), 'search-legal-docs')
    expect(decision.allowed).toBe(false)
  })

  it('denies SERVICE too -- SERVICE\'s tool:invoke is for the local tool registry, not per-named MCP tools', () => {
    const decision = authorizeMcpToolCall(buildServiceContext('svc'), 'search-legal-docs')
    expect(decision.allowed).toBe(false)
  })

  it('allows SYSTEM via its wildcard resource/action permission', () => {
    const decision = authorizeMcpToolCall(buildSystemContext(), 'search-legal-docs')
    expect(decision.allowed).toBe(true)
  })

  it('is scoped per tool name -- the resource string includes the tool name', () => {
    const decision = authorizeMcpToolCall(buildSystemContext(), 'my-tool')
    expect(decision.resource).toBe('mcp:my-tool')
  })
})

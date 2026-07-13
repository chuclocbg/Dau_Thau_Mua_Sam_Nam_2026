/**
 * Phase X.14 — integration test for buildRouteAuthorizationHook() (Route authorization), proven
 * against a real, throwaway Fastify instance (never the frozen src/server/httpServer.ts) via
 * Fastify's own inject(), the same pattern http-server-integration.test.ts (X.9.1) uses.
 */

import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import { buildRouteAuthorizationHook } from '../identity/application/routeAuthorization.ts'
import { buildAnonymousContext, buildServiceContext } from '../identity/application/authenticationContext.ts'

function buildTestServer(resolvePrincipal: Parameters<typeof buildRouteAuthorizationHook>[1]) {
  const server = Fastify({ logger: false })
  server.post(
    '/test/protected',
    { preHandler: buildRouteAuthorizationHook({ resource: 'tool', action: 'invoke', scope: 'OWN' }, resolvePrincipal) },
    async () => ({ ok: true }),
  )
  return server
}

describe('buildRouteAuthorizationHook', () => {
  it('returns 403 when the resolved principal lacks the required permission', async () => {
    const server = buildTestServer(() => buildAnonymousContext())
    const res = await server.inject({ method: 'POST', url: '/test/protected' })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('FORBIDDEN')
  })

  it('allows the request through when the resolved principal holds the required permission', async () => {
    const server = buildTestServer(() => buildServiceContext('svc'))
    const res = await server.inject({ method: 'POST', url: '/test/protected' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
  })

  it('defaults to anonymous when no resolver is supplied -- matching today\'s actual, unauthenticated behavior', async () => {
    const server = Fastify({ logger: false })
    server.post(
      '/test/default',
      { preHandler: buildRouteAuthorizationHook({ resource: 'conversation', action: 'ask', scope: 'OWN' }) },
      async () => ({ ok: true }),
    )
    const res = await server.inject({ method: 'POST', url: '/test/default' })
    expect(res.statusCode).toBe(200) // ANONYMOUS is granted conversation:ask:OWN by default
  })

  it('can resolve a principal from the request itself (e.g. a header)', async () => {
    const server = buildTestServer((req) => {
      const header = req.headers['x-principal'] as string | undefined
      return header === 'service' ? buildServiceContext('svc') : buildAnonymousContext()
    })

    const denied = await server.inject({ method: 'POST', url: '/test/protected' })
    expect(denied.statusCode).toBe(403)

    const allowed = await server.inject({ method: 'POST', url: '/test/protected', headers: { 'x-principal': 'service' } })
    expect(allowed.statusCode).toBe(200)
  })
})

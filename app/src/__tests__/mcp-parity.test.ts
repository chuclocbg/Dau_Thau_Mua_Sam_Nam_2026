import { describe, it, expect, vi } from 'vitest'
import { MCPClient } from '../mcp/application/mcpClient.ts'
import { RetryPolicy } from '../providers/RetryPolicy.ts'
import { RestClient } from '../providers/RestClient.ts'
import { HttpMCPTransport } from '../mcp/infrastructure/httpMCPTransport.ts'
import type { MCPTransport } from '../mcp/domain/mcpTypes.ts'

// ── Parity — Phase X.7 ──────────────────────────────────────────────────────
// Proves MCPClient genuinely delegates backoff timing to RetryPolicy.prototype.sleep() (not
// reimplemented), and that HttpMCPTransport genuinely delegates the network call to
// RestClient.post() (not a second hand-written fetch wrapper).

describe('MCPClient — delegates to RetryPolicy.sleep() for backoff (not reimplemented)', () => {
  it('sleeps exactly maxAttempts-1 times between failing attempts, with correct indices', async () => {
    const sleepSpy = vi.spyOn(RetryPolicy.prototype, 'sleep')
    const transport: MCPTransport = {
      connect: async () => {},
      disconnect: async () => {},
      request: async () => { throw new Error('conn reset') },
    }
    const client = new MCPClient(transport, { retry: { maxAttempts: 3, retryDelayMs: 0 } })
    await client.connect()
    await client.callTool('flaky', {})

    expect(sleepSpy).toHaveBeenCalledTimes(2)
    expect(sleepSpy).toHaveBeenNthCalledWith(1, 0)
    expect(sleepSpy).toHaveBeenNthCalledWith(2, 1)
    sleepSpy.mockRestore()
  })
})

describe('HttpMCPTransport — delegates to RestClient.post() (not reimplemented)', () => {
  it('calls RestClient.post() with a JSON-RPC-shaped body against the configured endpoint', async () => {
    const restClient = new RestClient()
    const postSpy = vi.spyOn(restClient, 'post').mockResolvedValue({
      ok: true, value: { status: 200, headers: {}, body: { result: { tools: [] } } },
    })
    const transport = new HttpMCPTransport('https://mcp.example.test/rpc', restClient)

    await transport.request({ method: 'tools/list' })

    expect(postSpy).toHaveBeenCalledTimes(1)
    const [url, body] = postSpy.mock.calls[0]!
    expect(url).toBe('https://mcp.example.test/rpc')
    expect(body).toMatchObject({ jsonrpc: '2.0', method: 'tools/list', params: {} })
    postSpy.mockRestore()
  })

  it('throws when RestClient.post() fails, letting MCPClient classify it as TRANSPORT_ERROR', async () => {
    const restClient = new RestClient()
    vi.spyOn(restClient, 'post').mockResolvedValue({
      ok: false, error: { code: 'NETWORK_ERROR', message: 'dns failure' },
    })
    const transport = new HttpMCPTransport('https://mcp.example.test/rpc', restClient)

    await expect(transport.request({ method: 'tools/list' })).rejects.toThrow(/dns failure/)
  })
})

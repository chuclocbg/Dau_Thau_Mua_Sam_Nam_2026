import { describe, it, expect } from 'vitest'
import { MCPClient } from '../mcp/application/mcpClient.ts'
import type { MCPRequest, MCPTransport } from '../mcp/domain/mcpTypes.ts'

function fakeTransport(overrides: Partial<MCPTransport> = {}): MCPTransport {
  return {
    connect: async () => {},
    disconnect: async () => {},
    request: async () => ({ result: {} }),
    ...overrides,
  }
}

describe('MCPClient — connection lifecycle', () => {
  it('starts DISCONNECTED, transitions to CONNECTED after connect()', async () => {
    const client = new MCPClient(fakeTransport())
    expect(client.getStatus()).toBe('DISCONNECTED')
    const result = await client.connect()
    expect(result.ok).toBe(true)
    expect(client.getStatus()).toBe('CONNECTED')
  })

  it('connect() fails with CONNECTION_FAILED when the transport throws', async () => {
    const client = new MCPClient(fakeTransport({ connect: async () => { throw new Error('refused') } }))
    const result = await client.connect()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CONNECTION_FAILED')
    expect(client.getStatus()).toBe('DISCONNECTED')
  })

  it('connect() fails when already connected', async () => {
    const client = new MCPClient(fakeTransport())
    await client.connect()
    const second = await client.connect()
    expect(second.ok).toBe(false)
  })

  it('disconnect() returns to DISCONNECTED', async () => {
    const client = new MCPClient(fakeTransport())
    await client.connect()
    const result = await client.disconnect()
    expect(result.ok).toBe(true)
    expect(client.getStatus()).toBe('DISCONNECTED')
  })

  it('disconnect() fails with NOT_CONNECTED when already disconnected', async () => {
    const client = new MCPClient(fakeTransport())
    const result = await client.disconnect()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_CONNECTED')
  })
})

describe('MCPClient — capability discovery (listTools)', () => {
  it('fails with NOT_CONNECTED when not connected', async () => {
    const client = new MCPClient(fakeTransport())
    const result = await client.listTools()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_CONNECTED')
  })

  it('returns the tools array from a well-formed tools/list response', async () => {
    const tools = [{ name: 'echo', description: 'Echoes input', inputSchema: {}, required: [] }]
    const client = new MCPClient(fakeTransport({
      request: async (req: MCPRequest) => {
        expect(req.method).toBe('tools/list')
        return { result: { tools } }
      },
    }))
    await client.connect()
    const result = await client.listTools()
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toEqual(tools)
  })

  it('fails with PROTOCOL_ERROR when the response is missing a tools array', async () => {
    const client = new MCPClient(fakeTransport({ request: async () => ({ result: {} }) }))
    await client.connect()
    const result = await client.listTools()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('PROTOCOL_ERROR')
  })
})

describe('MCPClient — tool execution (callTool)', () => {
  it('fails with NOT_CONNECTED when not connected', async () => {
    const client = new MCPClient(fakeTransport())
    const result = await client.callTool('echo', {})
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_CONNECTED')
  })

  it('calls tools/call with name and arguments, returns the content on success', async () => {
    const client = new MCPClient(fakeTransport({
      request: async (req: MCPRequest) => {
        expect(req.method).toBe('tools/call')
        expect(req.params).toEqual({ name: 'echo', arguments: { a: 1 } })
        return { result: { content: 'hello' } }
      },
    }))
    await client.connect()
    const result = await client.callTool('echo', { a: 1 })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('hello')
  })

  it('fails with TOOL_CALL_FAILED when the response has isError:true', async () => {
    const client = new MCPClient(fakeTransport({
      request: async () => ({ result: { isError: true, content: 'boom' } }),
    }))
    await client.connect()
    const result = await client.callTool('echo', {})
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('TOOL_CALL_FAILED')
  })

  it('fails with PROTOCOL_ERROR when the raw response carries a JSON-RPC error', async () => {
    const client = new MCPClient(fakeTransport({
      request: async () => ({ error: { code: -32601, message: 'Method not found' } }),
    }))
    await client.connect()
    const result = await client.callTool('missing', {})
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('PROTOCOL_ERROR')
      expect(result.error.message).toContain('Method not found')
    }
  })
})

describe('MCPClient — timeout and retry', () => {
  it('surfaces a TIMEOUT failure when the transport hangs past requestTimeoutMs', async () => {
    const client = new MCPClient(
      fakeTransport({ request: () => new Promise(() => { /* never resolves */ }) }),
      { requestTimeoutMs: 5, retry: { maxAttempts: 1 } },
    )
    await client.connect()
    const result = await client.callTool('slow', {})
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('TIMEOUT')
  })

  it('retries a TRANSPORT_ERROR up to maxAttempts, then fails', async () => {
    let calls = 0
    const client = new MCPClient(
      fakeTransport({ request: async () => { calls++; throw new Error('conn reset') } }),
      { retry: { maxAttempts: 3, retryDelayMs: 0 } },
    )
    await client.connect()
    const result = await client.callTool('flaky', {})
    expect(calls).toBe(3)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('TRANSPORT_ERROR')
  })

  it('does not retry a PROTOCOL_ERROR (non-transient)', async () => {
    let calls = 0
    const client = new MCPClient(
      fakeTransport({ request: async () => { calls++; return { error: { code: -1, message: 'bad request' } } } }),
      { retry: { maxAttempts: 3, retryDelayMs: 0 } },
    )
    await client.connect()
    await client.callTool('echo', {})
    expect(calls).toBe(1)
  })

  it('stops retrying as soon as a request succeeds', async () => {
    let calls = 0
    const client = new MCPClient(
      fakeTransport({
        request: async () => {
          calls++
          if (calls < 2) throw new Error('conn reset')
          return { result: { content: 'ok' } }
        },
      }),
      { retry: { maxAttempts: 5, retryDelayMs: 0 } },
    )
    await client.connect()
    const result = await client.callTool('echo', {})
    expect(calls).toBe(2)
    expect(result.ok).toBe(true)
  })
})

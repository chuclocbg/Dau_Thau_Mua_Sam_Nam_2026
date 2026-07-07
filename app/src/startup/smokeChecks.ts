// ── Smoke Checks — Phase X.9.5 ──────────────────────────────────────────────────
// Black-box HTTP checks against a REAL, running deployment — never imports src/health/,
// src/api/, src/streaming/, or any reasoning-layer module. This is deliberate: a smoke test
// verifies the deployed artifact from outside, the same way an operator's curl would, not by
// calling the same in-process functions the server itself already calls (that would only prove
// the code still does what it does, not that a real request over a real socket reaches it).
// Every check exercises functionality already built and frozen in X.9.1-X.9.3 — no reasoning,
// formatting, Tool Calling, or health-check logic is duplicated here.

export interface SmokeCheckResult {
  readonly name: string
  readonly ok: boolean
  readonly detail?: string
}

async function runCheck(name: string, fn: () => Promise<void>): Promise<SmokeCheckResult> {
  try {
    await fn()
    return { name, ok: true }
  } catch (err) {
    return { name, ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}

export async function runSmokeChecks(baseUrl: string, fetchFn: typeof fetch = fetch): Promise<SmokeCheckResult[]> {
  const results: SmokeCheckResult[] = []

  results.push(await runCheck('GET /live', async () => {
    const res = await fetchFn(`${baseUrl}/live`)
    if (!res.ok) throw new Error(`unexpected status ${res.status}`)
    const body = await res.json() as { status?: unknown }
    if (body.status !== 'ok') throw new Error(`unexpected body: ${JSON.stringify(body)}`)
  }))

  results.push(await runCheck('GET /ready', async () => {
    const res = await fetchFn(`${baseUrl}/ready`)
    if (res.status !== 200 && res.status !== 503) throw new Error(`unexpected status ${res.status}`)
    const body = await res.json() as { ready?: unknown }
    if (typeof body.ready !== 'boolean') throw new Error(`missing 'ready' field: ${JSON.stringify(body)}`)
  }))

  results.push(await runCheck('GET /health', async () => {
    const res = await fetchFn(`${baseUrl}/health`)
    if (res.status !== 200 && res.status !== 503) throw new Error(`unexpected status ${res.status}`)
    const body = await res.json() as { status?: unknown }
    if (typeof body.status !== 'string') throw new Error(`missing 'status' field: ${JSON.stringify(body)}`)
  }))

  results.push(await runCheck('POST /api/v1/reasoning/answer', async () => {
    const res = await fetchFn(`${baseUrl}/api/v1/reasoning/answer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Smoke test: mức tạm ứng tối đa là bao nhiêu?' }),
    })
    if (!res.ok) throw new Error(`unexpected status ${res.status}`)
    const body = await res.json() as { ok?: unknown; data?: { response?: { markdown?: unknown } } }
    if (body.ok !== true) throw new Error(`unexpected body: ${JSON.stringify(body)}`)
    if (typeof body.data?.response?.markdown !== 'string') throw new Error('missing response.markdown')
  }))

  results.push(await runCheck('POST /api/v1/reasoning/batch', async () => {
    const res = await fetchFn(`${baseUrl}/api/v1/reasoning/batch`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: ['Smoke test question 1?', 'Smoke test question 2?'] }),
    })
    if (!res.ok) throw new Error(`unexpected status ${res.status}`)
    const body = await res.json() as { ok?: unknown; data?: { status?: unknown; outcomes?: unknown[] } }
    if (body.ok !== true) throw new Error(`unexpected body: ${JSON.stringify(body)}`)
    if (body.data?.status !== 'COMPLETED') throw new Error(`unexpected run status: ${String(body.data?.status)}`)
    if (!Array.isArray(body.data?.outcomes) || body.data.outcomes.length !== 2) throw new Error('unexpected outcomes length')
  }))

  results.push(await runCheck('POST /api/v1/reasoning/answer/stream (SSE)', async () => {
    const res = await fetchFn(`${baseUrl}/api/v1/reasoning/answer/stream`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Smoke test: mức tạm ứng tối đa là bao nhiêu?' }),
    })
    if (!res.ok) throw new Error(`unexpected status ${res.status}`)
    if (!(res.headers.get('content-type') ?? '').includes('text/event-stream')) {
      throw new Error(`unexpected content-type: ${res.headers.get('content-type')}`)
    }
    const text = await res.text()
    if (!text.includes('event: result')) throw new Error("missing 'event: result' frame")
  }))

  return results
}

export function allChecksPassed(results: readonly SmokeCheckResult[]): boolean {
  return results.every(r => r.ok)
}

export function formatSmokeCheckReport(results: readonly SmokeCheckResult[]): string {
  return results
    .map(r => `${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail !== undefined ? ` — ${r.detail}` : ''}`)
    .join('\n')
}

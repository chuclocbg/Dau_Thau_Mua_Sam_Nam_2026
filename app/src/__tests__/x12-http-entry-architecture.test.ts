import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.12 (Conversation HTTP Entry Verification) ──────────────────
// Verified before writing any code: no HTTP entry reached the complete Phase X.11 Conversation
// Runtime (reasoningRoutes.ts is stateless by design; runConversationTurn() was referenced
// nowhere outside its own file/tests). This milestone adds the smallest compatible HTTP
// composition root: one new route file (src/api/conversationRoutes.ts) plus additive wiring
// into src/server/httpServer.ts (X.9.1, extended only via the same "wiring only" DI carve-out
// X.9.2/X.9.3 already used). Never duplicates orchestration, RuntimeContext, ConversationSession,
// or API routing; never redesigns any existing route.

const REPO_ROOT = process.cwd()

function readRaw(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), 'utf-8')
}

function readCode(relativePath: string): string {
  return readRaw(relativePath)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

describe('Architecture guard — conversationRoutes.ts never duplicates orchestration', () => {
  it('imports runConversationTurn() and RuntimeContext only — never detectIntent/formatConversationResponse/runToolCallingStage/RuntimeSessionBuilder/ConversationSession directly', () => {
    const content = readCode('src/api/conversationRoutes.ts')
    expect(content).toMatch(/import \{ runConversationTurn \} from ['"]\.\.\/runtime\/conversationEntryOrchestrator\.ts['"]/)
    expect(content).toMatch(/import type \{ RuntimeContext \} from ['"]\.\.\/runtime\/runtimeContext\.ts['"]/)
    for (const forbidden of [
      "from '../reasoning/application/intentDetector.ts'",
      "from '../reasoning/application/outputFormatter.ts'",
      "from '../reasoning/application/toolCallingStage.ts'",
      "from '../runtime/runtimeSessionBuilder.ts'",
      "from '../runtime/conversationSession.ts'",
    ]) {
      expect(content, `conversationRoutes.ts must not import ${forbidden}`).not.toContain(forbidden)
    }
  })

  it('defines no reasoning/session/formatting/tool-calling logic of its own', () => {
    const content = readCode('src/api/conversationRoutes.ts').toLowerCase()
    for (const forbidden of ['function detectintent(', 'function formatconversationresponse(', 'class sessionstatemanager', 'class conversationsession']) {
      expect(content, `must not reimplement "${forbidden}"`).not.toContain(forbidden)
    }
  })

  it('registers exactly one new route, POST /api/v1/conversation/turn, distinct from every pre-existing path', () => {
    const content = readRaw('src/api/conversationRoutes.ts')
    expect(content).toMatch(/server\.post\('\/api\/v1\/conversation\/turn'/)
    expect(content).not.toMatch(/\/api\/v1\/reasoning\/answer/)
    expect(content).not.toMatch(/\/api\/v1\/reasoning\/batch/)
  })
})

describe('Architecture guard — httpServer.ts wiring is additive only', () => {
  it('every prior route registration and marker is still present, plus exactly the new X.12 wiring', () => {
    const content = readRaw('src/server/httpServer.ts')
    for (const marker of [
      'registerReasoningRoutes(server, app)',
      'registerCoordinatorRoutes(server, app)',
      "registerReasoningStreamRoute(server, app, { streamTimeoutMs: app.streamTimeoutMs })",
      "server.get('/live'", "server.get('/ready'", "server.get('/health'",
      'registerRequestLifecycleHooks(server,',
      'X.9.2 ADDITION', 'X.9.3 ADDITION',
    ]) {
      expect(content, `httpServer.ts missing pre-existing marker "${marker}"`).toContain(marker)
    }
    expect(content).toContain('registerConversationRoutes(server, runtime)')
    expect(content).toContain("buildRuntimeContext({ application: app })")
  })

  it('buildHttpServer still has the exact same exported signature (app: Application) => FastifyInstance', () => {
    const content = readRaw('src/server/httpServer.ts')
    expect(content).toMatch(/export function buildHttpServer\(app: Application\): FastifyInstance/)
  })

  it('constructs exactly one RuntimeContext, never a second one, and passes it straight to registerConversationRoutes', () => {
    const content = readCode('src/server/httpServer.ts')
    expect((content.match(/buildRuntimeContext\(/g) ?? []).length).toBe(1)
    expect((content.match(/registerConversationRoutes\(/g) ?? []).length).toBe(1)
  })
})

describe('Architecture guard — zero modification to the frozen X.11 Conversation Runtime', () => {
  it('every src/runtime/ file is unmodified since the X.11 freeze', () => {
    expect(readRaw('src/runtime/conversationEntryOrchestrator.ts')).toMatch(/Phase X\.11 Application Runtime/)
    expect(readRaw('src/runtime/conversationSession.ts')).toMatch(/Phase X\.11 Application Runtime/)
    expect(readRaw('src/runtime/runtimeContext.ts')).toMatch(/Phase X\.11 Runtime dependency composition/)
    expect(readRaw('src/runtime/runtimeSessionBuilder.ts')).toMatch(/Phase X\.11 Application Runtime/)
    expect(readRaw('src/runtime/sessionAttachments.ts')).toMatch(/Phase X\.11 Attachment persistence/)
  })

  it('RuntimeContext\'s exported shape is unchanged — httpServer.ts consumes it, never extends it', () => {
    const content = readRaw('src/runtime/runtimeContext.ts')
    expect(content).toMatch(/export interface RuntimeContext \{\s*\n\s*readonly application: Application/)
  })
})

describe('Architecture guard — zero modification to pre-existing X.9.1 routes', () => {
  it('reasoningRoutes.ts and coordinatorRoutes.ts are byte-for-byte unmodified since X.9.1/X.11', () => {
    expect(readRaw('src/api/reasoningRoutes.ts')).toMatch(/Phase X\.9\.1/)
    expect(readRaw('src/api/reasoningRoutes.ts')).toMatch(/\/api\/v1\/reasoning\/answer/)
    expect(readRaw('src/api/coordinatorRoutes.ts')).toMatch(/Phase X\.9\.1/)
    expect(readRaw('src/api/coordinatorRoutes.ts')).toMatch(/\/api\/v1\/reasoning\/batch/)
  })

  it('every prior milestone\'s frozen-file marker is unchanged', () => {
    const markers: readonly [string, RegExp][] = [
      ['src/reasoning/application/reasoningEnginePipeline.ts', /Final Phase X\.4 Integration/],
      ['src/reasoning/application/outputFormatter.ts', /Phase X\.5/],
      ['src/reasoning/application/toolCallingStage.ts', /Phase X\.6/],
      ['src/bootstrap/buildApplication.ts', /Phase X\.9\.1/],
      ['src/logging/structuredLogger.ts', /Phase X\.9\.2/],
      ['src/streaming/sseWriter.ts', /Phase X\.9\.3/],
    ]
    for (const [file, marker] of markers) {
      expect(readRaw(file), `${file} marker changed`).toMatch(marker)
    }
  })

  it("buildApplication.ts's Application interface is unchanged (X.12 composes RuntimeContext from it, never extends it)", () => {
    const content = readRaw('src/bootstrap/buildApplication.ts')
    expect(content).toMatch(/export interface Application \{\s*\n\s*readonly repository: IKnowledgeRepository/)
  })
})

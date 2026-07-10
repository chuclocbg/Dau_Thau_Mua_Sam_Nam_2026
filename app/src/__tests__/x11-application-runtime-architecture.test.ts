import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.11 (Application Runtime) ───────────────────
// X.3-X.10 are FROZEN. This milestone adds a new src/runtime/ directory plus small, additive
// extensions to Phase X.1's conversation/ module (not in the X.3-X.10 frozen list) and one new,
// additive Prisma model. Checks run against comment-stripped code.

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

function listTsFiles(dir: string): string[] {
  const entries = readdirSync(join(REPO_ROOT, dir))
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = join(REPO_ROOT, dir, entry)
    if (statSync(fullPath).isDirectory()) continue
    if (entry.endsWith('.ts')) files.push(join(dir, entry))
  }
  return files
}

const RUNTIME_FILES = listTsFiles('src/runtime')

describe('Architecture guard — Phase X.11 dependency direction', () => {
  it('src/runtime/ has the expected 5 files (no scope creep)', () => {
    expect(RUNTIME_FILES.map(f => f.split(/[\\/]/).pop()).sort()).toEqual([
      'conversationEntryOrchestrator.ts', 'conversationSession.ts', 'runtimeContext.ts',
      'runtimeSessionBuilder.ts', 'sessionAttachments.ts',
    ])
  })

  it('src/runtime/ imports nothing from src/mcp/ or src/multiagent/ (not needed for a single conversational turn)', () => {
    for (const file of RUNTIME_FILES) {
      const content = readCode(file)
      expect(content, `${file} must not import /mcp/`).not.toMatch(/from ['"].*\/mcp\//)
      expect(content, `${file} must not import /multiagent\//`).not.toMatch(/from ['"].*\/multiagent\//)
    }
  })

  it('src/runtime/ imports nothing from any business-domain module (procurement/legal/masterdata/approval/contract/acceptance/payment/auth/notification) -- storage is the sole, deliberate exception (Attachment persistence)', () => {
    const forbidden = ['/procurement/', '/legal/', '/masterdata/', '/approval/', '/contract/', '/acceptance/', '/payment/', '/auth/', '/notification/']
    for (const file of RUNTIME_FILES) {
      const content = readCode(file)
      for (const dir of forbidden) {
        expect(content, `${file} must not import ${dir}`).not.toMatch(new RegExp(`from ['"].*\\${dir}`))
      }
    }
  })

  it('only conversationEntryOrchestrator.ts imports from src/reasoning/, and only the already-public, already-frozen entry functions', () => {
    for (const file of RUNTIME_FILES) {
      const content = readCode(file)
      const importsReasoning = /from ['"].*\/reasoning\//.test(content)
      if (file.endsWith('conversationEntryOrchestrator.ts')) {
        expect(importsReasoning).toBe(true)
        expect(content).toMatch(/import \{ detectIntent \} from ['"]\.\.\/reasoning\/application\/intentDetector\.ts['"]/)
        expect(content).toMatch(/import \{ formatConversationResponse \} from ['"]\.\.\/reasoning\/application\/outputFormatter\.ts['"]/)
        expect(content).toMatch(/import \{ runToolCallingStage, neverInvokeTool \} from ['"]\.\.\/reasoning\/application\/toolCallingStage\.ts['"]/)
      } else {
        expect(importsReasoning, `${file} must not import src/reasoning/`).toBe(false)
      }
    }
  })

  it('conversationEntryOrchestrator.ts defines no reasoning/citation/confidence/scoring logic of its own', () => {
    const content = readCode('src/runtime/conversationEntryOrchestrator.ts').toLowerCase()
    for (const forbidden of ['class reasoningenginepipeline', 'function detectintent(', 'function formatconversationresponse(', 'function evaluaterules(', 'function resolveconflicts(']) {
      expect(content, `must not reimplement "${forbidden}"`).not.toContain(forbidden)
    }
  })

  it('sessionAttachments.ts reuses buildAttachmentReference() rather than constructing AttachmentReference object literals directly', () => {
    const content = readCode('src/runtime/sessionAttachments.ts')
    expect(content).toMatch(/from ['"]\.\.\/storage\/application\/storageFactory\.ts['"]/)
    expect(content).toMatch(/buildAttachmentReference\(/)
    expect(content).not.toMatch(/isActive:\s*true/)
  })

  it('prismaSessionRepository.ts reuses getPrismaClient()/mapPrismaRow() rather than a new client or new date-conversion logic', () => {
    const content = readCode('src/conversation/infrastructure/prismaSessionRepository.ts')
    expect(content).toMatch(/from ['"]\.\.\/\.\.\/persistence\/prismaClient\.ts['"]/)
    expect(content).toMatch(/from ['"]\.\.\/\.\.\/persistence\/decimalMapping\.ts['"]/)
    expect(content).not.toMatch(/new PrismaClient\(/)
    expect(content).not.toMatch(/toISOString\(\)/)
  })
})

describe('Architecture guard — src/conversation/ extensions are additive only', () => {
  it('sessionState.ts still has every pre-existing method/marker, plus the two new ones', () => {
    const content = readRaw('src/conversation/application/sessionState.ts')
    for (const marker of [
      'VALID_TRANSITIONS', 'recordActivity(advisorId?: string)', 'transitionTo(status: AdvisorySessionStatus)',
      'isDueForIdle(asOf: Date, idleMinutes: number)', 'isDueForArchive(asOf: Date, archiveMinutes: number)',
      'static fromState(state: AdvisorySessionState)', 'addAttachmentRef(attachmentId: string)',
    ]) {
      expect(content, `sessionState.ts missing "${marker}"`).toContain(marker)
    }
  })

  it('conversationMemory.ts still has every pre-existing method/marker, plus the new one', () => {
    const content = readRaw('src/conversation/application/conversationMemory.ts')
    for (const marker of [
      'pruneToTokenBudget(maxTokens: number)', 'groupIntoTurns(', 'append(message: AdvisoryConversationMessage)',
      'static fromHistory(history: AdvisoryConversationHistory)',
    ]) {
      expect(content, `conversationMemory.ts missing "${marker}"`).toContain(marker)
    }
  })

  it('conversationTypes.ts, conversationContext.ts, and memorySessionRepository.ts (Phase X.1) are completely unmodified', () => {
    expect(readRaw('src/conversation/domain/conversationTypes.ts')).toMatch(/NAMING NOTE/)
    expect(readRaw('src/conversation/application/conversationContext.ts')).toMatch(/Owns turn advancement only/)
    expect(readRaw('src/conversation/infrastructure/memorySessionRepository.ts')).toMatch(/a Prisma-backed implementation follows later/)
  })

  it("src/conversation/'s own pre-existing isolation guard (imports nothing from knowledge/reasoning/ai/mcp) still holds for the new prismaSessionRepository.ts file", () => {
    const content = readCode('src/conversation/infrastructure/prismaSessionRepository.ts')
    for (const pattern of [/from ['"].*\/knowledge\//, /from ['"].*\/reasoning\//, /from ['"].*\/ai\//, /from ['"].*\/mcp\//]) {
      expect(content).not.toMatch(pattern)
    }
  })
})

describe('Architecture guard — zero duplication of the Phase M1/X.10 persistence layer', () => {
  it('prisma.config.ts is unchanged from the X.10 freeze (schema/migrations/seed/datasource all present)', () => {
    const content = readRaw('prisma.config.ts')
    expect(content).toMatch(/schema:\s*'prisma\/schema\.prisma'/)
    expect(content).toMatch(/path:\s*'prisma\/migrations'/)
    expect(content).toMatch(/seed:\s*'tsx prisma\/seed\.ts'/)
    expect(content).toMatch(/url:\s*process\.env\.DATABASE_URL/)
  })

  it('every prior schema.prisma section marker is still present, plus exactly one new Phase X.11 section', () => {
    const content = readRaw('prisma/schema.prisma')
    for (const marker of [
      '// ─── Core entities', '// ─── Master Data Models (Phase C)', '// ─── Phase D: Procurement Package',
      '// ─── Phase J — Auth Module (Phase M1 production schema)', '// ─── Phase K — Storage Module (Phase M1 production schema)',
      '// ─── Phase I — Payment Module (Phase M1 production schema)',
      '// ─── Phase X.11 — Application Runtime: Conversation Session',
    ]) {
      expect(content, `schema.prisma missing "${marker}"`).toContain(marker)
    }
  })

  it('X.10 persistence files (prismaTransaction.ts, databaseConnectivity.ts, testDatabaseBootstrap.ts, seed.ts) are unmodified', () => {
    expect(readRaw('src/persistence/prismaTransaction.ts')).toMatch(/Phase X\.10/)
    expect(readRaw('src/persistence/databaseConnectivity.ts')).toMatch(/Phase X\.10/)
    expect(readRaw('src/persistence/testDatabaseBootstrap.ts')).toMatch(/Phase X\.10/)
    expect(readRaw('prisma/seed.ts')).toMatch(/Phase X\.10/)
  })

  it('prismaClient.ts and IBaseRepository.ts (the canonical Phase M1 singleton and repository contract) remain byte-for-byte unmodified', () => {
    expect(readRaw('src/persistence/prismaClient.ts')).toMatch(/let singleton: PrismaClient \| null = null/)
    expect(readRaw('src/shared/repository/IBaseRepository.ts')).toMatch(/findAll\(\): Promise<readonly T\[\]>/)
  })
})

describe('Architecture guard — zero frozen-file (X.3-X.10) modification this milestone', () => {
  it('every prior milestone\'s files still carry their own frozen-milestone markers', () => {
    const markers: readonly [string, RegExp][] = [
      ['src/reasoning/application/reasoningEnginePipeline.ts', /Final Phase X\.4 Integration/],
      ['src/reasoning/application/outputFormatter.ts', /Phase X\.5/],
      ['src/reasoning/application/toolCallingStage.ts', /Phase X\.6/],
      ['src/mcp/application/mcpClient.ts', /Phase X\.7/],
      ['src/multiagent/application/coordinatorAgent.ts', /Phase X\.8/],
      ['src/health/healthCheck.ts', /Phase X\.9\.1/],
      ['src/api/reasoningRoutes.ts', /Phase X\.9\.1/],
      ['src/server/main.ts', /Phase X\.9\.1/],
      ['src/logging/structuredLogger.ts', /Phase X\.9\.2/],
      ['src/streaming/sseWriter.ts', /Phase X\.9\.3/],
      ['src/cancellation/requestAbortSignal.ts', /Phase X\.9\.3/],
      ['src/bootstrap/buildApplication.ts', /Phase X\.9\.1/],
    ]
    for (const [file, marker] of markers) {
      expect(readRaw(file), `${file} marker changed`).toMatch(marker)
    }
  })

  it('the pre-existing provider-layer files remain untouched', () => {
    expect(readRaw('src/providers/RetryPolicy.ts')).toMatch(/P6-10J/)
  })

  it('buildApplication.ts\'s Application interface is unchanged (Runtime composes it wholesale, never extends its fields)', () => {
    const content = readRaw('src/bootstrap/buildApplication.ts')
    expect(content).toMatch(/export interface Application \{\s*\n\s*readonly repository: IKnowledgeRepository/)
  })
})

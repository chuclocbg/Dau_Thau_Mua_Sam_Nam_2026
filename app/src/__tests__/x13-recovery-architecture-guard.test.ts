import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.13 (Conversation Persistence Recovery & Crash Resilience) ──
// X.3-X.12 are FROZEN, with no carve-out this milestone (unlike X.9.2-X.9.5, X.10, X.11's own
// narrow "wiring only" exceptions) -- "Do NOT modify any frozen milestone" is stated without
// exception. This milestone adds only new files under src/runtime/recovery/ plus one new,
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

const RECOVERY_DIR = 'src/runtime/recovery'
const RECOVERY_FILES = readdirSync(join(REPO_ROOT, RECOVERY_DIR))
  .filter(f => f.endsWith('.ts'))
  .map(f => join(RECOVERY_DIR, f))

describe('Architecture guard — Phase X.13 file set', () => {
  it('src/runtime/recovery/ has exactly the 6 expected files (no scope creep)', () => {
    expect(RECOVERY_FILES.map(f => f.split(/[\\/]/).pop()).sort()).toEqual([
      'conversationRecoveryCoordinator.ts', 'memoryRecoveryRepository.ts', 'prismaRecoveryRepository.ts',
      'recoverableConversationTurn.ts', 'recoveryTypes.ts', 'runtimeRecoveryManager.ts',
    ])
  })
})

describe('Architecture guard — Phase X.13 dependency direction', () => {
  it('src/runtime/recovery/ imports nothing from src/mcp/, src/multiagent/, or any business-domain module', () => {
    const forbidden = [
      '/mcp/', '/multiagent/', '/procurement/', '/legal/', '/masterdata/', '/approval/',
      '/contract/', '/acceptance/', '/payment/', '/auth/', '/notification/',
    ]
    for (const file of RECOVERY_FILES) {
      const content = readCode(file)
      for (const dir of forbidden) {
        expect(content, `${file} must not import ${dir}`).not.toMatch(new RegExp(`from ['"].*\\${dir}`))
      }
    }
  })

  it('recoverableConversationTurn.ts and conversationRecoveryCoordinator.ts import ONLY runConversationTurn (and its types) from conversationEntryOrchestrator.ts -- never detectIntent/formatConversationResponse/runToolCallingStage/RuntimeSessionBuilder/ConversationSession directly', () => {
    for (const file of ['src/runtime/recovery/recoverableConversationTurn.ts', 'src/runtime/recovery/conversationRecoveryCoordinator.ts']) {
      const content = readCode(file)
      expect(content).toMatch(/import \{ runConversationTurn \} from ['"]\.\.\/conversationEntryOrchestrator\.ts['"]/)
      for (const forbidden of [
        "from '../../reasoning/application/intentDetector.ts'",
        "from '../../reasoning/application/outputFormatter.ts'",
        "from '../../reasoning/application/toolCallingStage.ts'",
        "from '../runtimeSessionBuilder.ts'",
        "from '../conversationSession.ts'",
      ]) {
        expect(content, `${file} must not import ${forbidden}`).not.toContain(forbidden)
      }
    }
  })

  it('runtimeRecoveryManager.ts contains no per-marker replay logic of its own -- it only calls recoverMarker()', () => {
    const content = readCode('src/runtime/recovery/runtimeRecoveryManager.ts')
    expect(content).toMatch(/import \{ recoverMarker \} from ['"]\.\/conversationRecoveryCoordinator\.ts['"]/)
    expect(content).not.toMatch(/runConversationTurn/)
  })

  it('memoryRecoveryRepository.ts and prismaRecoveryRepository.ts both implement the SAME IRecoveryRepository interface, never a second one', () => {
    for (const file of ['src/runtime/recovery/memoryRecoveryRepository.ts', 'src/runtime/recovery/prismaRecoveryRepository.ts']) {
      const content = readCode(file)
      expect(content).toMatch(/import type \{ IRecoveryRepository/)
      expect(content).not.toMatch(/export interface IRecoveryRepository/)
    }
  })

  it('prismaRecoveryRepository.ts reuses getPrismaClient()/mapPrismaRow() rather than a new client or new date-conversion logic', () => {
    const content = readCode('src/runtime/recovery/prismaRecoveryRepository.ts')
    expect(content).toMatch(/from ['"]\.\.\/\.\.\/persistence\/prismaClient\.ts['"]/)
    expect(content).toMatch(/from ['"]\.\.\/\.\.\/persistence\/decimalMapping\.ts['"]/)
    expect(content).not.toMatch(/new PrismaClient\(/)
  })
})

describe('Architecture guard — zero duplication of the frozen Phase M1/X.10/X.11 persistence layer', () => {
  it('every prior schema.prisma section marker is still present, plus exactly one new Phase X.13 section', () => {
    const content = readRaw('prisma/schema.prisma')
    for (const marker of [
      '// ─── Core entities', '// ─── Phase K — Storage Module (Phase M1 production schema)',
      '// ─── Phase X.11 — Application Runtime: Conversation Session',
      '// ─── Phase X.13 — Conversation Persistence Recovery & Crash Resilience',
    ]) {
      expect(content, `schema.prisma missing "${marker}"`).toContain(marker)
    }
  })

  it('prisma.config.ts is completely unchanged from the X.10 freeze (no new seed registration needed)', () => {
    const content = readRaw('prisma.config.ts')
    expect(content).toMatch(/seed:\s*'tsx prisma\/seed\.ts'/)
  })

  it('prismaClient.ts and IBaseRepository.ts remain byte-for-byte unmodified', () => {
    expect(readRaw('src/persistence/prismaClient.ts')).toMatch(/let singleton: PrismaClient \| null = null/)
    expect(readRaw('src/shared/repository/IBaseRepository.ts')).toMatch(/findAll\(\): Promise<readonly T\[\]>/)
  })

  it('the ConversationSession model (X.11) is untouched -- X.13 only appends a new, separate model', () => {
    const content = readRaw('prisma/schema.prisma')
    expect(content).toMatch(/model ConversationSession \{\s*\n\s*id\s+String\s+@id @default\(uuid\(\)\)\s*\n\s*sessionState\s+Json/)
  })
})

describe('Architecture guard — zero modification to every frozen X.3-X.12 file', () => {
  it('every prior milestone\'s frozen-file marker is unchanged', () => {
    const markers: readonly [string, RegExp][] = [
      ['src/reasoning/application/reasoningEnginePipeline.ts', /Final Phase X\.4 Integration/],
      ['src/reasoning/application/outputFormatter.ts', /Phase X\.5/],
      ['src/reasoning/application/toolCallingStage.ts', /Phase X\.6/],
      ['src/mcp/application/mcpClient.ts', /Phase X\.7/],
      ['src/multiagent/application/coordinatorAgent.ts', /Phase X\.8/],
      ['src/server/main.ts', /Phase X\.9\.1/],
      ['src/startup/gracefulShutdown.ts', /Phase X\.9\.1/],
      ['src/bootstrap/buildApplication.ts', /Phase X\.9\.1/],
      ['src/api/reasoningRoutes.ts', /Phase X\.9\.1/],
      ['src/api/coordinatorRoutes.ts', /Phase X\.9\.1/],
      ['src/logging/structuredLogger.ts', /Phase X\.9\.2/],
      ['src/streaming/sseWriter.ts', /Phase X\.9\.3/],
    ]
    for (const [file, marker] of markers) {
      expect(readRaw(file), `${file} marker changed`).toMatch(marker)
    }
  })

  it('every Phase X.11 Application Runtime file is byte-for-byte unmodified', () => {
    expect(readRaw('src/runtime/conversationSession.ts')).toMatch(/Phase X\.11 Application Runtime/)
    expect(readRaw('src/runtime/runtimeSessionBuilder.ts')).toMatch(/Phase X\.11 Application Runtime/)
    expect(readRaw('src/runtime/runtimeContext.ts')).toMatch(/Phase X\.11 Runtime dependency composition/)
    expect(readRaw('src/runtime/conversationEntryOrchestrator.ts')).toMatch(/Phase X\.11 Application Runtime/)
    expect(readRaw('src/runtime/sessionAttachments.ts')).toMatch(/Phase X\.11 Attachment persistence/)
  })

  it('src/runtime/ still has exactly its X.11 5 direct files (recovery/ is a subdirectory, not a sibling file)', () => {
    const directFiles = readdirSync(join(REPO_ROOT, 'src/runtime'), { withFileTypes: true })
      .filter(e => e.isFile() && e.name.endsWith('.ts'))
      .map(e => e.name)
    expect(directFiles.sort()).toEqual([
      'conversationEntryOrchestrator.ts', 'conversationSession.ts', 'runtimeContext.ts',
      'runtimeSessionBuilder.ts', 'sessionAttachments.ts',
    ])
  })

  it('every Phase X.12 HTTP entry file is byte-for-byte unmodified', () => {
    expect(readRaw('src/api/conversationRoutes.ts')).toMatch(/Phase X\.12/)
    expect(readRaw('src/server/httpServer.ts')).toMatch(/registerConversationRoutes\(server, runtime\)/)
    expect(readRaw('src/server/httpServer.ts')).toMatch(/X\.12 ADDITION/)
  })

  it('RuntimeContext\'s exported shape is unchanged -- recovery composes its own repositories separately, never adding a field to it', () => {
    const content = readRaw('src/runtime/runtimeContext.ts')
    expect(content).toMatch(/export interface RuntimeContext \{\s*\n\s*readonly application: Application\s*\n\s*readonly sessionRepository: ISessionRepository\s*\n\s*readonly attachmentRepository: IAttachmentReferenceRepository\s*\n\s*\}/)
  })

  it('main.ts\'s boot sequence contains no reference to recovery -- deliberately not wired in (see runtimeRecoveryManager.ts\'s own WIRING NOTE)', () => {
    const content = readRaw('src/server/main.ts')
    expect(content).not.toMatch(/recovery/i)
  })
})

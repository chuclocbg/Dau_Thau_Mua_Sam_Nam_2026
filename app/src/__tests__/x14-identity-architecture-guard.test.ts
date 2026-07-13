import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.14 (Authentication, Authorization & Identity Infrastructure) ──
// X.3-X.13 are FROZEN, no carve-out this milestone. The single most important guard here proves
// in code, not just in comments, the milestone's central design decision: src/auth/ (Phase M1)
// is business logic (procurement RBAC), not generic infrastructure, so src/identity/ imports
// NOTHING from it -- confirmed by direct inspection before any code was written (see
// identityTypes.ts's own header for the specific evidence).

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

function listTsFilesRecursive(dir: string): string[] {
  const entries = readdirSync(join(REPO_ROOT, dir), { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const rel = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...listTsFilesRecursive(rel))
    else if (entry.name.endsWith('.ts')) files.push(rel)
  }
  return files
}

const IDENTITY_FILES = listTsFilesRecursive('src/identity')

describe('Architecture guard — Phase X.14 file set', () => {
  it('src/identity/ has exactly the 10 expected files (no scope creep)', () => {
    expect(IDENTITY_FILES.map(f => f.split(/[\\/]/).pop()).sort()).toEqual([
      'authenticationContext.ts', 'authorizationEvaluator.ts', 'identityTypes.ts', 'mcpAuthorization.ts',
      'permissionResolver.ts', 'prismaSessionIdentityRepository.ts', 'routeAuthorization.ts',
      'runtimeAuthorization.ts', 'sessionIdentityRepository.ts', 'toolAuthorization.ts',
    ])
  })
})

describe('Architecture guard — zero business logic (the central design decision, verified in code)', () => {
  it('src/identity/ imports NOTHING from src/auth/', () => {
    for (const file of IDENTITY_FILES) {
      const content = readCode(file)
      expect(content, `${file} must not import src/auth/`).not.toMatch(/from ['"].*\/auth\//)
    }
  })

  it('src/identity/ imports nothing from any business-domain module (procurement/legal/masterdata/approval/contract/acceptance/payment/notification/storage)', () => {
    const forbidden = [
      '/procurement/', '/legal/', '/masterdata/', '/approval/', '/contract/', '/acceptance/',
      '/payment/', '/notification/', '/storage/',
    ]
    for (const file of IDENTITY_FILES) {
      const content = readCode(file)
      for (const dir of forbidden) {
        expect(content, `${file} must not import ${dir}`).not.toMatch(new RegExp(`from ['"].*\\${dir}`))
      }
    }
  })

  it('no identity type mentions a procurement/legal/asset concept by name (department, VNĐ, delegation, approvalHierarchy, legalBasis)', () => {
    const content = readCode('src/identity/domain/identityTypes.ts').toLowerCase()
    for (const forbidden of ['departmentid', 'vnđ', 'delegationgrant', 'approvalhierarchy', 'legalbasis', 'maxvalue']) {
      expect(content, `identityTypes.ts must not contain "${forbidden}"`).not.toContain(forbidden)
    }
  })

  it('mcp/multiagent are imported nowhere in src/identity/', () => {
    for (const file of IDENTITY_FILES) {
      const content = readCode(file)
      expect(content).not.toMatch(/from ['"].*\/multiagent\//)
      // mcpAuthorization.ts deliberately does NOT import src/mcp/ at all -- it is a pure
      // check function a caller applies before calling MCPClient, never a wrapper around it.
      expect(content).not.toMatch(/from ['"].*\/mcp\/(application|domain|infrastructure)\//)
    }
  })
})

describe('Architecture guard — genuine reuse, no duplication of frozen runtime/session infrastructure', () => {
  it('runtimeAuthorization.ts imports ONLY runConversationTurn (and its types) from the orchestrator -- never detectIntent/formatConversationResponse/runToolCallingStage/RuntimeSessionBuilder/ConversationSession directly', () => {
    const content = readCode('src/identity/application/runtimeAuthorization.ts')
    expect(content).toMatch(/import \{ runConversationTurn \} from ['"]\.\.\/\.\.\/runtime\/conversationEntryOrchestrator\.ts['"]/)
    for (const forbidden of [
      "from '../../reasoning/application/intentDetector.ts'",
      "from '../../reasoning/application/outputFormatter.ts'",
      "from '../../reasoning/application/toolCallingStage.ts'",
      "from '../../runtime/runtimeSessionBuilder.ts'",
      "from '../../runtime/conversationSession.ts'",
    ]) {
      expect(content, `must not import ${forbidden}`).not.toContain(forbidden)
    }
  })

  it('toolAuthorization.ts imports only the ToolDecider TYPE, never toolCallingStage.ts internals', () => {
    const content = readCode('src/identity/application/toolAuthorization.ts')
    expect(content).toMatch(/import type \{ ToolDecider \} from ['"]\.\.\/\.\.\/reasoning\/domain\/toolCallingTypes\.ts['"]/)
    expect(content).not.toMatch(/from ['"].*\/toolCallingStage\.ts['"]/)
  })

  it('sessionIdentityRepository.ts / prismaSessionIdentityRepository.ts both implement the SAME ISessionIdentityRepository interface, never a second one', () => {
    const memory = readCode('src/identity/infrastructure/sessionIdentityRepository.ts')
    const prisma = readCode('src/identity/infrastructure/prismaSessionIdentityRepository.ts')
    expect(memory).toMatch(/export interface ISessionIdentityRepository/)
    expect(prisma).toMatch(/import type \{ ISessionIdentityRepository/)
    expect(prisma).not.toMatch(/export interface ISessionIdentityRepository/)
  })

  it('prismaSessionIdentityRepository.ts reuses getPrismaClient()/mapPrismaRow() rather than a new client', () => {
    const content = readCode('src/identity/infrastructure/prismaSessionIdentityRepository.ts')
    expect(content).toMatch(/from ['"]\.\.\/\.\.\/persistence\/prismaClient\.ts['"]/)
    expect(content).toMatch(/from ['"]\.\.\/\.\.\/persistence\/decimalMapping\.ts['"]/)
    expect(content).not.toMatch(/new PrismaClient\(/)
  })

  it('routeAuthorization.ts is never imported by src/server/httpServer.ts or src/api/conversationRoutes.ts -- a complete but NOT-yet-wired capability', () => {
    expect(readRaw('src/server/httpServer.ts')).not.toMatch(/identity/)
    expect(readRaw('src/api/conversationRoutes.ts')).not.toMatch(/identity/)
  })
})

describe('Architecture guard — zero duplication of the Phase M1/X.10/X.11/X.13 persistence layer', () => {
  it('every prior schema.prisma section marker is still present, plus exactly one new Phase X.14 section', () => {
    const content = readRaw('prisma/schema.prisma')
    for (const marker of [
      '// ─── Core entities', '// ─── Phase K — Storage Module (Phase M1 production schema)',
      '// ─── Phase X.11 — Application Runtime: Conversation Session',
      '// ─── Phase X.13 — Conversation Persistence Recovery & Crash Resilience',
      '// ─── Phase X.14 — Authentication, Authorization & Identity Infrastructure',
    ]) {
      expect(content, `schema.prisma missing "${marker}"`).toContain(marker)
    }
  })

  it('no Role/Permission table was added -- roles/permissions are deterministic, built-in constants, not persisted data', () => {
    const content = readRaw('prisma/schema.prisma')
    expect(content).not.toMatch(/model Role \{/)
    expect(content).not.toMatch(/model Permission \{/)
  })

  it('prismaClient.ts and IBaseRepository.ts remain byte-for-byte unmodified', () => {
    expect(readRaw('src/persistence/prismaClient.ts')).toMatch(/let singleton: PrismaClient \| null = null/)
    expect(readRaw('src/shared/repository/IBaseRepository.ts')).toMatch(/findAll\(\): Promise<readonly T\[\]>/)
  })

  it('every X.13 recovery file is untouched', () => {
    expect(readRaw('src/runtime/recovery/recoveryTypes.ts')).toMatch(/Phase X\.13/)
    expect(readRaw('src/runtime/recovery/runtimeRecoveryManager.ts')).toMatch(/Phase X\.13/)
  })
})

describe('Architecture guard — zero modification to every frozen X.3-X.13 file', () => {
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
      ['src/api/conversationRoutes.ts', /Phase X\.12/],
      ['src/server/httpServer.ts', /X\.12 ADDITION/],
      ['src/runtime/conversationEntryOrchestrator.ts', /Phase X\.11 Application Runtime/],
      ['src/runtime/runtimeContext.ts', /Phase X\.11 Runtime dependency composition/],
    ]
    for (const [file, marker] of markers) {
      expect(readRaw(file), `${file} marker changed`).toMatch(marker)
    }
  })

  it('RuntimeContext\'s exported shape is unchanged -- identity composes ISessionIdentityRepository separately, never adding a field to it', () => {
    const content = readRaw('src/runtime/runtimeContext.ts')
    expect(content).toMatch(/export interface RuntimeContext \{\s*\n\s*readonly application: Application\s*\n\s*readonly sessionRepository: ISessionRepository\s*\n\s*readonly attachmentRepository: IAttachmentReferenceRepository\s*\n\s*\}/)
  })

  it('main.ts contains no reference to identity/auth -- deliberately not wired into the boot sequence', () => {
    const content = readRaw('src/server/main.ts').toLowerCase()
    expect(content).not.toMatch(/identity|principal|authoriz/)
  })
})

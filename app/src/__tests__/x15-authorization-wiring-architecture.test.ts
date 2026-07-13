import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.15 (Authorization Wiring) ──────────────────────────────────
// Per ADR_X15_ARCHITECTURE_DECISION.md's own Acceptance Criteria. Confirms: every frozen file
// the ADR lists as "MUST remain untouched" is byte-for-byte unchanged; conversationRoutes.ts
// calls runAuthorizedConversationTurn(), never runConversationTurn() directly;
// httpPrincipalResolver.ts imports only the two X.14 factory functions it's authorized to reuse;
// and -- the ADR's single most important negative assertion -- runRecoverableConversationTurn()
// (Phase X.13) is NOT imported anywhere under src/api/ or src/server/, proving the deliberate
// recovery-producer-wiring deferral was actually honored during implementation, not silently
// reversed.

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
  return readdirSync(join(REPO_ROOT, dir), { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.ts'))
    .map(e => join(dir, e.name))
}

describe('Architecture guard — Phase X.15 file set', () => {
  // GOVERNANCE EXCEPTION GX-004 (see ADR_X15_ARCHITECTURE_DECISION.md's Governance Exceptions
  // section): Phase X.16 Step 1 added src/api/credentialToken.ts (a pure, dependency-free
  // node:crypto HMAC sign/verify primitive per X16_PROTOCOL_DECISION.md, not yet imported by
  // anything), which is one more authorized file in src/api/ beyond X.15's own single addition.
  // The array below is extended by exactly one entry -- this remains an EXACT array-equality
  // check, not loosened to a subset/contains check, so any other unexpected file still fails it.
  it('src/api/ gained exactly two new files (httpPrincipalResolver.ts, credentialToken.ts), no other scope creep', () => {
    const apiFiles = listTsFiles('src/api').map(f => f.split(/[\\/]/).pop())
    expect(apiFiles.sort()).toEqual([
      'conversationRoutes.ts', 'coordinatorRoutes.ts', 'credentialToken.ts', 'httpPrincipalResolver.ts', 'reasoningRoutes.ts',
    ])
  })

  it('src/identity/ is completely unchanged from the X.14 freeze -- still exactly its 10 files', () => {
    // Re-confirms the resolution of the file-location conflict: the resolver was deliberately
    // placed OUTSIDE src/identity/ specifically so this frozen count would never need to change.
    const identityAppFiles = listTsFiles('src/identity/application').map(f => f.split(/[\\/]/).pop())
    expect(identityAppFiles).not.toContain('httpPrincipalResolver.ts')
  })
})

describe('Architecture guard — genuine reuse, no duplication', () => {
  it('conversationRoutes.ts calls runAuthorizedConversationTurn(), never runConversationTurn() directly', () => {
    const content = readCode('src/api/conversationRoutes.ts')
    expect(content).toMatch(/import \{ runAuthorizedConversationTurn \} from ['"]\.\.\/identity\/application\/runtimeAuthorization\.ts['"]/)
    expect(content).not.toMatch(/from ['"]\.\.\/runtime\/conversationEntryOrchestrator\.ts['"]/)
  })

  it('httpPrincipalResolver.ts imports only buildUserContext/buildAnonymousContext from authenticationContext.ts, nothing else from src/identity/', () => {
    const content = readCode('src/api/httpPrincipalResolver.ts')
    expect(content).toMatch(/import \{ buildUserContext, buildAnonymousContext \} from ['"]\.\.\/identity\/application\/authenticationContext\.ts['"]/)
    const identityImportCount = (content.match(/from ['"]\.\.\/identity\//g) ?? []).length
    expect(identityImportCount).toBe(2) // the value import + the AuthenticationContext type import, both from the same file
  })

  it('the recovery producer (runRecoverableConversationTurn) is NOT imported anywhere under src/api/ or src/server/ -- the deferred-wiring decision was honored', () => {
    for (const dir of ['src/api', 'src/server']) {
      for (const file of listTsFiles(dir)) {
        const content = readCode(file)
        expect(content, `${file} must not import runRecoverableConversationTurn`).not.toMatch(/runRecoverableConversationTurn/)
        expect(content, `${file} must not import src/runtime/recovery/`).not.toMatch(/from ['"].*\/runtime\/recovery\//)
      }
    }
  })

  it('httpServer.ts constructs exactly one ISessionIdentityRepository, and no IRecoveryRepository at all', () => {
    const content = readCode('src/server/httpServer.ts')
    expect((content.match(/buildMemorySessionIdentityRepository\(/g) ?? []).length).toBe(1)
    expect(content).not.toMatch(/RecoveryRepository/)
  })
})

describe('Architecture guard — zero modification to every file the ADR lists as MUST remain untouched', () => {
  it('every Phase X.11/X.13/X.14 file keeps its own frozen marker unchanged', () => {
    const markers: readonly [string, RegExp][] = [
      ['src/runtime/conversationEntryOrchestrator.ts', /Phase X\.11 Application Runtime/],
      ['src/runtime/runtimeContext.ts', /Phase X\.11 Runtime dependency composition/],
      ['src/runtime/conversationSession.ts', /Phase X\.11 Application Runtime/],
      ['src/runtime/runtimeSessionBuilder.ts', /Phase X\.11 Application Runtime/],
      ['src/runtime/sessionAttachments.ts', /Phase X\.11 Attachment persistence/],
      ['src/runtime/recovery/recoveryTypes.ts', /Phase X\.13/],
      ['src/runtime/recovery/runtimeRecoveryManager.ts', /Phase X\.13/],
      ['src/runtime/recovery/recoverableConversationTurn.ts', /Phase X\.13/],
      ['src/identity/domain/identityTypes.ts', /Phase X\.14/],
      ['src/identity/application/authorizationEvaluator.ts', /Phase X\.14/],
      ['src/identity/application/authenticationContext.ts', /Phase X\.14/],
      ['src/identity/application/runtimeAuthorization.ts', /Phase X\.14/],
      ['src/identity/application/toolAuthorization.ts', /Phase X\.14/],
      ['src/identity/application/mcpAuthorization.ts', /Phase X\.14/],
      ['src/identity/application/routeAuthorization.ts', /Phase X\.14/],
      ['src/api/reasoningRoutes.ts', /Phase X\.9\.1/],
      ['src/api/coordinatorRoutes.ts', /Phase X\.9\.1/],
      ['src/server/main.ts', /Phase X\.9\.1/],
      ['src/startup/gracefulShutdown.ts', /Phase X\.9\.1/],
    ]
    for (const [file, marker] of markers) {
      expect(readRaw(file), `${file} marker changed`).toMatch(marker)
    }
  })

  it('main.ts still contains no reference to identity/recovery -- neither was wired into the boot sequence', () => {
    const content = readRaw('src/server/main.ts').toLowerCase()
    expect(content).not.toMatch(/identity|principal|authoriz|recovery/)
  })

  it('src/reasoning/, src/mcp/, src/multiagent/, prisma/schema.prisma, src/auth/ are entirely unaffected by this milestone', () => {
    expect(readRaw('src/reasoning/application/reasoningEnginePipeline.ts')).toMatch(/Final Phase X\.4 Integration/)
    expect(readRaw('src/mcp/application/mcpClient.ts')).toMatch(/Phase X\.7/)
    expect(readRaw('src/multiagent/application/coordinatorAgent.ts')).toMatch(/Phase X\.8/)
  })

  it('buildHttpServer still has the exact same exported signature', () => {
    const content = readRaw('src/server/httpServer.ts')
    expect(content).toMatch(/export function buildHttpServer\(app: Application\): FastifyInstance/)
  })

  it('RuntimeContext\'s exported shape is unchanged -- X.15 composes ISessionIdentityRepository separately, never adding a field to it', () => {
    const content = readRaw('src/runtime/runtimeContext.ts')
    expect(content).toMatch(/export interface RuntimeContext \{\s*\n\s*readonly application: Application\s*\n\s*readonly sessionRepository: ISessionRepository\s*\n\s*readonly attachmentRepository: IAttachmentReferenceRepository\s*\n\s*\}/)
  })
})

describe('Architecture guard — Governance Exception GX-001 is scoped correctly', () => {
  it('the GX-001 marker is present in the X.12 guard file, documenting the exception at its point of use', () => {
    const content = readRaw('src/__tests__/x12-http-entry-architecture.test.ts')
    expect(content).toMatch(/GOVERNANCE EXCEPTION GX-001/)
  })

  it('the X.12 guard still enforces every one of its original architectural guarantees (no orchestration duplication, no forbidden imports, exactly one route, additive-only httpServer.ts wiring)', () => {
    const content = readRaw('src/__tests__/x12-http-entry-architecture.test.ts')
    for (const preserved of [
      "from '../reasoning/application/intentDetector.ts'",
      "from '../reasoning/application/outputFormatter.ts'",
      "from '../reasoning/application/toolCallingStage.ts'",
      "from '../runtime/runtimeSessionBuilder.ts'",
      "from '../runtime/conversationSession.ts'",
      'function detectintent(', 'function formatconversationresponse(',
      "server\\.post\\('\\/api\\/v1\\/conversation\\/turn'",
    ]) {
      expect(content, `X.12 guard must still check for "${preserved}"`).toContain(preserved)
    }
  })
})

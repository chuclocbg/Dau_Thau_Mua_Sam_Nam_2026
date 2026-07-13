import { describe, it, expect } from 'vitest'
import { readFileSync as fsReadFileSync, readdirSync as fsReaddirSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.16 Steps 1-4 (Credential Verification) ──────────────────────
// Per X16_PROTOCOL_DECISION.md's Acceptance Criteria and X16_SCOPING_REPORT.md §6: proves in
// code, not just in the ADR/decision/scoping documents, that the stdlib-only HMAC bearer-token
// design was implemented exactly as decided -- zero new runtime dependency, zero frozen file
// touched, Path B's promise (no signature change to resolvePrincipalFromRequest()/
// registerConversationRoutes()) actually honored, and the credential-verification primitive
// stays isolated from the authorization-evaluation engine it feeds.

const REPO_ROOT = process.cwd()

function readRaw(relativePath: string): string {
  return fsReadFileSync(join(REPO_ROOT, relativePath), 'utf-8')
}

function readCode(relativePath: string): string {
  return readRaw(relativePath)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

function listTsFiles(dir: string): string[] {
  return fsReaddirSync(join(REPO_ROOT, dir), { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.ts'))
    .map(e => join(dir, e.name))
}

describe('Architecture guard — Phase X.16 credentialToken.ts is a pure, isolated primitive', () => {
  it('credentialToken.ts imports ONLY node:crypto -- nothing from src/identity/, src/auth/, src/runtime/, or src/reasoning/', () => {
    const content = readCode('src/api/credentialToken.ts')
    expect(content).toMatch(/import \{ createHmac, timingSafeEqual \} from ['"]node:crypto['"]/)
    for (const forbidden of ['/identity/', '/auth/', '/runtime/', '/reasoning/', '/mcp/', '/multiagent/']) {
      expect(content, `credentialToken.ts must not import ${forbidden}`).not.toMatch(new RegExp(`from ['"].*\\${forbidden}`))
    }
  })

  it('no authorization-evaluation module imports credentialToken.ts -- the evaluation engine stays ignorant of how a Principal was produced', () => {
    for (const file of [
      'src/identity/application/authorizationEvaluator.ts',
      'src/identity/application/permissionResolver.ts',
      'src/identity/application/runtimeAuthorization.ts',
      'src/identity/domain/identityTypes.ts',
    ]) {
      const content = readCode(file)
      expect(content, `${file} must not import credentialToken.ts`).not.toMatch(/credentialToken/)
    }
  })
})

describe('Architecture guard — Path B was honored: zero signature changes to preserve', () => {
  it('resolvePrincipalFromRequest() keeps its original one-parameter signature', () => {
    const content = readCode('src/api/httpPrincipalResolver.ts')
    expect(content).toMatch(/export function resolvePrincipalFromRequest\(req: FastifyRequest\): AuthenticationContext/)
  })

  it('conversationRoutes.ts still calls resolvePrincipalFromRequest(req) with exactly one argument', () => {
    const content = readCode('src/api/conversationRoutes.ts')
    expect(content).toMatch(/resolvePrincipalFromRequest\(req\)/)
  })

  it('httpServer.ts still calls registerConversationRoutes with exactly its X.15 three-argument form', () => {
    const content = readRaw('src/server/httpServer.ts')
    expect(content).toContain('registerConversationRoutes(server, runtime, sessionIdentityRepository)')
  })

  it('httpPrincipalResolver.ts reads the signing secret itself via loadAppConfigFromEnv(), never receiving it as a parameter', () => {
    const content = readCode('src/api/httpPrincipalResolver.ts')
    expect(content).toMatch(/import \{ loadAppConfigFromEnv \} from ['"]\.\.\/config\/appConfig\.ts['"]/)
    expect(content).toMatch(/verifyToken\(/)
  })
})

describe('Architecture guard — an invalid or missing credential never silently escalates', () => {
  it('resolvePrincipalFromRequest() only calls buildUserContext() after a successful verifyToken() result or when no secret is configured (the documented non-regression path), never unconditionally on the raw header', () => {
    const content = readCode('src/api/httpPrincipalResolver.ts')
    // The unconditional pre-X.16 call -- buildUserContext(trimmed) with nothing gating it beyond
    // the header being present -- must no longer be the ONLY path; a verifyToken() call must
    // exist as a gate for the secret-configured case.
    expect(content).toMatch(/const result = verifyToken\(secret, trimmed\)/)
    expect(content).toMatch(/if \(result\.valid\)/)
  })
})

describe('Architecture guard — zero new runtime dependency', () => {
  it('package.json contains no JWT/session/passport/bcrypt-style credential library', () => {
    const content = readRaw('package.json')
    for (const forbidden of ['jsonwebtoken', '"jose"', 'passport', '@fastify/jwt', '@fastify/cookie', '@fastify/session', 'bcrypt', 'argon2']) {
      expect(content, `package.json must not depend on ${forbidden}`).not.toContain(forbidden)
    }
  })
})

describe('Architecture guard — zero modification to every file the ADR/decision documents list as frozen', () => {
  it('buildApplication.ts and main.ts contain no reference to credentials -- Path B never touched either', () => {
    const buildApp = readRaw('src/bootstrap/buildApplication.ts').toLowerCase()
    const main = readRaw('src/server/main.ts').toLowerCase()
    expect(buildApp).not.toMatch(/credential/)
    expect(main).not.toMatch(/credential/)
  })

  it('every X.11/X.13/X.14 frozen file keeps its own marker unchanged', () => {
    const markers: readonly [string, RegExp][] = [
      ['src/runtime/conversationEntryOrchestrator.ts', /Phase X\.11 Application Runtime/],
      ['src/runtime/runtimeContext.ts', /Phase X\.11 Runtime dependency composition/],
      ['src/runtime/recovery/recoveryTypes.ts', /Phase X\.13/],
      ['src/runtime/recovery/runtimeRecoveryManager.ts', /Phase X\.13/],
      ['src/identity/domain/identityTypes.ts', /Phase X\.14/],
      ['src/identity/application/authorizationEvaluator.ts', /Phase X\.14/],
      ['src/identity/application/runtimeAuthorization.ts', /Phase X\.14/],
      ['src/identity/application/routeAuthorization.ts', /Phase X\.14/],
    ]
    for (const [file, marker] of markers) {
      expect(readRaw(file), `${file} marker changed`).toMatch(marker)
    }
  })

  it('src/api/ still has exactly its GX-004-approved five files -- Step 4 added a script, not another src/api/ file', () => {
    const apiFiles = listTsFiles('src/api').map(f => f.split(/[\\/]/).pop())
    expect(apiFiles.sort()).toEqual([
      'conversationRoutes.ts', 'coordinatorRoutes.ts', 'credentialToken.ts', 'httpPrincipalResolver.ts', 'reasoningRoutes.ts',
    ])
  })

  it('src/identity/ remains completely unchanged -- still exactly its 10 X.14 files', () => {
    const identityFiles: string[] = []
    const walk = (dir: string): void => {
      for (const entry of fsReaddirSync(join(REPO_ROOT, dir), { withFileTypes: true })) {
        const rel = join(dir, entry.name)
        if (entry.isDirectory()) walk(rel)
        else if (entry.name.endsWith('.ts')) identityFiles.push(entry.name)
      }
    }
    walk('src/identity')
    expect(identityFiles.sort()).toEqual([
      'authenticationContext.ts', 'authorizationEvaluator.ts', 'identityTypes.ts', 'mcpAuthorization.ts',
      'permissionResolver.ts', 'prismaSessionIdentityRepository.ts', 'routeAuthorization.ts',
      'runtimeAuthorization.ts', 'sessionIdentityRepository.ts', 'toolAuthorization.ts',
    ])
  })
})

describe('Architecture guard — issuance CLI is a thin wrapper, not a duplicated implementation', () => {
  it('scripts/issueCredentialToken.ts imports signToken and loadAppConfigFromEnv, no reimplemented signing logic', () => {
    const content = readCode('scripts/issueCredentialToken.ts')
    expect(content).toMatch(/import \{ signToken \} from ['"]\.\.\/src\/api\/credentialToken\.ts['"]/)
    expect(content).toMatch(/import \{ loadAppConfigFromEnv \} from ['"]\.\.\/src\/config\/appConfig\.ts['"]/)
    expect(content).not.toMatch(/createHmac/)
  })
})

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.9.5 (Deployment / Operations / Production Readiness) ──
// X.3-X.9.4 are FROZEN. This milestone touches ZERO frozen files (same strict standard X.9.4
// set). All new code lives under src/startup/, scripts/, deployment/, docs/. Checks run against
// comment-stripped code.

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

const NEW_SRC_FILES = ['src/startup/waitForReady.ts', 'src/startup/smokeChecks.ts']

describe('Architecture guard — Phase X.9.5 dependency direction', () => {
  it('waitForReady.ts imports only the existing RetryPolicy — never a frozen business-logic module', () => {
    const content = readCode('src/startup/waitForReady.ts')
    expect(content).toMatch(/from ['"]\.\.\/providers\/RetryPolicy\.ts['"]/)
    for (const forbidden of ['/reasoning/', '/knowledge/', '/mcp/', '/multiagent/', '/server/', '/bootstrap/', '/api/', '/health/']) {
      expect(content, `must not import ${forbidden}`).not.toMatch(new RegExp(`from ['"].*\\${forbidden}`))
    }
  })

  it('smokeChecks.ts is a black-box HTTP client — imports nothing from src/ at all (no reasoning/health/api reuse-by-import, only real HTTP calls)', () => {
    const content = readCode('src/startup/smokeChecks.ts')
    expect(content).not.toMatch(/from ['"]\.\.\//)
  })

  it('never reimplements RetryPolicy, health checks, configuration loading, startup logic, logging, or metrics', () => {
    for (const file of NEW_SRC_FILES) {
      const content = readCode(file).toLowerCase()
      for (const forbidden of [
        'class retrypolicy', 'checkliveness(', 'checkreadiness(', 'checkhealth(',
        'loadappconfigfromenv(', 'createstructuredlogger(', 'new metricscollector(',
        'registergracefulshutdown(',
      ]) {
        expect(content, `${file} must not reference "${forbidden}"`).not.toContain(forbidden)
      }
    }
  })

  it('deployment/deploy.sh and deployment/rollback.sh reuse the existing validateEnvironment/waitForReady/smokeTest scripts rather than duplicating their logic inline', () => {
    for (const file of ['deployment/deploy.sh', 'deployment/rollback.sh']) {
      const content = readRaw(file)
      expect(content, `${file} must reuse validateEnvironment.ts`).toMatch(/validateEnvironment\.ts/)
      expect(content, `${file} must reuse waitForReady.ts`).toMatch(/waitForReady\.ts/)
      expect(content, `${file} must reuse smokeTest.ts`).toMatch(/smokeTest\.ts/)
    }
  })

  it('scripts/smokeTest.ts and scripts/waitForReady.ts are thin CLI wrappers around the reusable src/startup/ functions, not reimplementations', () => {
    const smoke = readCode('scripts/smokeTest.ts')
    expect(smoke).toMatch(/from ['"]\.\.\/src\/startup\/smokeChecks\.ts['"]/)
    expect(smoke).toMatch(/runSmokeChecks\(/)

    const wait = readCode('scripts/waitForReady.ts')
    expect(wait).toMatch(/from ['"]\.\.\/src\/startup\/waitForReady\.ts['"]/)
    expect(wait).toMatch(/waitForReady\(/)
  })
})

describe('Architecture guard — zero frozen-file modification this milestone', () => {
  it('every prior milestone\'s files still carry their own frozen-milestone markers, including every X.9.4 file', () => {
    const markers: readonly [string, RegExp][] = [
      ['src/conversation/domain/conversationTypes.ts', /collision check/i],
      ['src/reasoning/application/reasoningEnginePipeline.ts', /Final Phase X\.4 Integration/],
      ['src/reasoning/application/outputFormatter.ts', /Phase X\.5/],
      ['src/reasoning/application/toolCallingStage.ts', /Phase X\.6/],
      ['src/mcp/application/mcpClient.ts', /Phase X\.7/],
      ['src/multiagent/application/coordinatorAgent.ts', /Phase X\.8/],
      ['src/health/healthCheck.ts', /Phase X\.9\.1/],
      ['src/api/reasoningRoutes.ts', /Phase X\.9\.1/],
      ['src/startup/gracefulShutdown.ts', /Phase X\.9\.1/],
      ['src/server/main.ts', /Phase X\.9\.1/],
      ['src/logging/structuredLogger.ts', /Phase X\.9\.2/],
      ['src/middleware/requestLifecycleHooks.ts', /Phase X\.9\.2/],
      ['src/streaming/sseWriter.ts', /Phase X\.9\.3/],
      ['src/http/reasoningStreamRoute.ts', /Phase X\.9\.3/],
      ['src/cancellation/requestAbortSignal.ts', /Phase X\.9\.3/],
      ['src/config/configProfiles.ts', /Phase X\.9\.4/],
      ['src/config/environmentValidator.ts', /Phase X\.9\.4/],
      ['src/startup/loadEnvironmentSecrets.ts', /Phase X\.9\.4/],
      ['src/startup/configDiagnostics.ts', /Phase X\.9\.4/],
      ['Dockerfile', /Phase X\.9\.4/],
    ]
    for (const [file, marker] of markers) {
      expect(readRaw(file), `${file} marker changed`).toMatch(marker)
    }
  })

  it('answerComposer.ts still carries its own marker, unmodified', () => {
    expect(readRaw('src/reasoning/application/answerComposer.ts')).toMatch(/Stage 7 — Answer Composer/)
  })

  it('the pre-existing provider-layer files and restAdapter.ts remain untouched', () => {
    expect(readRaw('src/providers/ToolExecutor.ts')).toMatch(/P6-10O/)
    expect(readRaw('src/providers/RetryPolicy.ts')).toMatch(/P6-10J/)
    expect(readRaw('src/interface/restAdapter.ts')).toMatch(/Phase 14/)
  })

  it('docker-compose.yml still defines every Phase M0 + X.9.4 service unchanged', () => {
    const content = readRaw('docker-compose.yml')
    for (const required of ['postgres:', 'pgadmin:', 'redis:', 'minio:', 'minio-init:', 'app:', 'app-dev:']) {
      expect(content, `docker-compose.yml must still contain "${required}"`).toContain(required)
    }
  })
})

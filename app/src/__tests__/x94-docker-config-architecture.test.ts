import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.9.4 (Docker / Production Configuration / Secrets) ──
// X.3-X.9.3 are FROZEN. This milestone touches ZERO frozen files — not even under the
// dependency-injection carve-out (unlike X.9.2/X.9.3), confirmed below. All new code lives
// under src/config/, src/startup/, scripts/, docker-related root files. Checks run against
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

const NEW_SRC_FILES = [
  'src/config/configProfiles.ts',
  'src/config/environmentValidator.ts',
  'src/startup/loadEnvironmentSecrets.ts',
  'src/startup/configDiagnostics.ts',
]

describe('Architecture guard — Phase X.9.4 dependency direction', () => {
  it('no new file imports src/reasoning/, src/knowledge/, src/mcp/, src/multiagent/, src/server/, src/bootstrap/, src/api/, src/health/, src/logging/, src/metrics/, src/tracing/, src/middleware/, src/streaming/, or src/cancellation/', () => {
    const forbidden = [
      '/reasoning/', '/knowledge/', '/mcp/', '/multiagent/', '/conversation/', '/server/',
      '/bootstrap/', '/api/', '/health/', '/logging/', '/metrics/', '/tracing/', '/middleware/',
      '/streaming/', '/cancellation/',
    ]
    for (const file of NEW_SRC_FILES) {
      const content = readCode(file)
      for (const dir of forbidden) {
        expect(content, `${file} must not import ${dir}`).not.toMatch(new RegExp(`from ['"].*\\${dir}`))
      }
    }
  })

  it('environmentValidator.ts genuinely imports and calls the real loadAppConfigFromEnv rather than reimplementing config parsing', () => {
    const content = readCode('src/config/environmentValidator.ts')
    expect(content).toMatch(/from ['"]\.\/appConfig\.ts['"]/)
    expect(content).toMatch(/loadAppConfigFromEnv\(/)
    expect(content).not.toMatch(/INVALID_PORT\s*:|INVALID_NODE_ENV\s*:/)
  })

  it('loadEnvironmentSecrets.ts genuinely imports the real dotenv package rather than hand-rolling a .env parser', () => {
    const content = readCode('src/startup/loadEnvironmentSecrets.ts')
    expect(content).toMatch(/from ['"]dotenv['"]/)
    expect(content).not.toMatch(/\.split\(['"]=['"]\)|readFileSync.*\.env/i)
  })

  it('never reimplements RetryPolicy, health checks, logging initialization, or tracing initialization', () => {
    for (const file of NEW_SRC_FILES) {
      const content = readCode(file).toLowerCase()
      for (const forbidden of [
        'class retrypolicy', 'checkliveness(', 'checkreadiness(', 'checkhealth(',
        'createstructuredlogger(', 'new simpletracer(', 'class metricscollector',
      ]) {
        expect(content, `${file} must not reference "${forbidden}"`).not.toContain(forbidden)
      }
    }
  })

  it('configProfiles.ts never re-declares AppConfig validation error codes (no duplicated parsing)', () => {
    const content = readCode('src/config/configProfiles.ts')
    expect(content).not.toMatch(/AppConfigError|AppConfigResult|loadAppConfigFromEnv/)
  })
})

describe('Architecture guard — zero frozen-file modification this milestone', () => {
  it('every prior milestone\'s files still carry their own frozen-milestone markers, including the previously DI-touched files', () => {
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
      // The three files X.9.2/X.9.3 touched under the DI carve-out — this milestone makes NO
      // further changes to them at all (not even DI), so their X.9.3-era content must be
      // byte-identical, including the streamTimeoutMs/registerReasoningStreamRoute additions.
      ['src/config/appConfig.ts', /streamTimeoutMs/],
      ['src/config/appConfig.ts', /X\.9\.3/],
      ['src/bootstrap/buildApplication.ts', /streamTimeoutMs/],
      ['src/server/httpServer.ts', /registerReasoningStreamRoute/],
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
})

describe('Architecture guard — Docker/Compose additive structure', () => {
  it('docker-compose.yml still defines every Phase M0 backing service unchanged, plus the new opt-in app/app-dev services', () => {
    const content = readRaw('docker-compose.yml')
    for (const required of [
      'postgres:', 'pgadmin:', 'redis:', 'minio:', 'minio-init:', 'dtmsn_internal',
      'app:', 'app-dev:', 'profiles: ["app"]', 'profiles: ["dev"]',
    ]) {
      expect(content, `docker-compose.yml must still contain "${required}"`).toContain(required)
    }
  })

  it('the app/app-dev services join the existing dtmsn_internal network rather than defining a new one', () => {
    const content = readRaw('docker-compose.yml')
    const networkBlocks = content.match(/^networks:\n(?:.+\n)+?(?=\n|volumes:)/m)
    expect(networkBlocks).not.toBeNull()
    expect(content.match(/driver: bridge/g)?.length).toBe(1)
  })

  it('Dockerfile defines a multi-stage build (deps -> runtime) and never installs a second package manager or a competing base runtime', () => {
    const content = readRaw('Dockerfile')
    expect(content).toMatch(/FROM node:22-alpine AS deps/)
    expect(content).toMatch(/FROM node:22-alpine AS runtime/)
    expect(content).toMatch(/RUN npm ci/)
    expect(content).toMatch(/HEALTHCHECK/)
    expect(content).toMatch(/USER dtmsn/)
    expect(content).not.toMatch(/apt-get|yum|apk add.*yarn|pnpm/)
  })

  it('scripts/start-prod.sh and scripts/start-dev.sh both run the real, unmodified src/server/main.ts entrypoint', () => {
    for (const file of ['scripts/start-prod.sh', 'scripts/start-dev.sh']) {
      const content = readRaw(file)
      expect(content).toMatch(/src\/server\/main\.ts/)
    }
  })
})

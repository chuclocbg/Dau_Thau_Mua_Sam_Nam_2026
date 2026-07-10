import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.10 (Business Foundation — Prisma & Persistence) ──
// Per the user's explicit corrective instruction: the pre-existing Phase M1 Prisma layer
// (schema, client provider, repository interfaces/implementations, migrations) is the
// canonical persistence foundation and must NOT be duplicated. This milestone adds only four
// genuinely-missing pieces (transaction helper, database connectivity/bootstrap, test-database
// bootstrap, seed entrypoint) plus one additive line to prisma.config.ts. Everything else —
// Phase X.1-X.9 (frozen) and the Phase M1 Prisma layer itself — must remain byte-for-byte
// unmodified except that single planned line.

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

const NEW_FILES = [
  'src/persistence/prismaTransaction.ts',
  'src/persistence/databaseConnectivity.ts',
  'src/persistence/testDatabaseBootstrap.ts',
  'prisma/seed.ts',
]

describe('Architecture guard — Phase X.10 dependency direction', () => {
  it('no new file imports src/reasoning/, src/knowledge/, src/mcp/, src/multiagent/, src/conversation/, src/server/, src/bootstrap/, src/api/, src/health/, src/logging/, src/metrics/, src/tracing/, src/middleware/, src/streaming/, or src/cancellation/', () => {
    const forbidden = [
      '/reasoning/', '/knowledge/', '/mcp/', '/multiagent/', '/conversation/', '/server/',
      '/bootstrap/', '/api/', '/health/', '/logging/', '/metrics/', '/tracing/', '/middleware/',
      '/streaming/', '/cancellation/',
    ]
    for (const file of NEW_FILES) {
      const content = readCode(file)
      for (const dir of forbidden) {
        expect(content, `${file} must not import ${dir}`).not.toMatch(new RegExp(`from ['"].*\\${dir}`))
      }
    }
  })

  it('no new file imports any procurement/legal/business-domain module (this milestone is persistence infrastructure only)', () => {
    const forbidden = ['/procurement/', '/legal/', '/masterdata/', '/approval/', '/contract/', '/acceptance/', '/payment/', '/auth/', '/notification/']
    for (const file of NEW_FILES) {
      const content = readCode(file)
      for (const dir of forbidden) {
        expect(content, `${file} must not import ${dir}`).not.toMatch(new RegExp(`from ['"].*\\${dir}`))
      }
    }
  })
})

describe('Architecture guard — reuse, not duplication', () => {
  it('prismaTransaction.ts reuses getPrismaClient() and Prisma\'s own $transaction, defines no new client and no new transaction semantics', () => {
    const content = readCode('src/persistence/prismaTransaction.ts')
    expect(content).toMatch(/from ['"]\.\/prismaClient\.ts['"]/)
    expect(content).toMatch(/getPrismaClient\(\)\.\$transaction\(/)
    expect(content).not.toMatch(/new PrismaClient\(/)
  })

  it('databaseConnectivity.ts reuses getPrismaClient() and the existing RetryPolicy rather than reimplementing backoff', () => {
    const content = readCode('src/persistence/databaseConnectivity.ts')
    expect(content).toMatch(/from ['"]\.\/prismaClient\.ts['"]/)
    expect(content).toMatch(/from ['"]\.\.\/providers\/RetryPolicy\.ts['"]/)
    expect(content).not.toMatch(/class RetryPolicy/)
    expect(content).not.toMatch(/setTimeout/)
  })

  it('testDatabaseBootstrap.ts does not import or wrap getPrismaClient() (a test database is a separate connection, not the dev/prod singleton)', () => {
    const content = readCode('src/persistence/testDatabaseBootstrap.ts')
    expect(content).not.toMatch(/getPrismaClient/)
    expect(content).toMatch(/PrismaPg/)
  })

  it('prisma/seed.ts fabricates no business data — no procurement/legal/master-data model names, only a connectivity check', () => {
    const content = readCode('prisma/seed.ts').toLowerCase()
    for (const forbidden of ['procurementpackage', 'legaldocument', 'mdvendor', 'mddepartment', 'mdemployee', '.create(', '.createmany(']) {
      expect(content, `seed.ts must not contain "${forbidden}"`).not.toContain(forbidden)
    }
  })
})

describe('Architecture guard — zero duplication of the existing Phase M1 Prisma layer', () => {
  it('does not define a second Prisma schema, client singleton, or repository interface', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      expect(content, `${file} must not declare a second PrismaClient singleton`).not.toMatch(/let singleton/)
      expect(content, `${file} must not redeclare IBaseRepository`).not.toMatch(/interface IBaseRepository/)
    }
  })

  it('prisma.config.ts still declares the same schema/migrations path plus exactly one additive seed line', () => {
    const content = readRaw('prisma.config.ts')
    expect(content).toMatch(/schema:\s*'prisma\/schema\.prisma'/)
    expect(content).toMatch(/path:\s*'prisma\/migrations'/)
    expect(content).toMatch(/seed:\s*'tsx prisma\/seed\.ts'/)
    expect(content).toMatch(/url:\s*process\.env\.DATABASE_URL/)
  })

  it('prismaClient.ts (the canonical singleton provider) is unmodified', () => {
    const content = readRaw('src/persistence/prismaClient.ts')
    expect(content).toMatch(/let singleton: PrismaClient \| null = null/)
    expect(content).toMatch(/DATABASE_URL is not set/)
  })

  it('IBaseRepository.ts (the canonical repository contract) is unmodified', () => {
    expect(readRaw('src/shared/repository/IBaseRepository.ts')).toMatch(/findAll\(\): Promise<readonly T\[\]>/)
  })
})

describe('Architecture guard — zero frozen-file modification this milestone', () => {
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
    ]
    for (const [file, marker] of markers) {
      expect(readRaw(file), `${file} marker changed`).toMatch(marker)
    }
  })

  it('the pre-existing provider-layer files remain untouched', () => {
    expect(readRaw('src/providers/RetryPolicy.ts')).toMatch(/P6-10J/)
  })
})

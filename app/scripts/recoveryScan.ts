import { loadAppConfigFromEnv } from '../src/config/appConfig.ts'
import { buildApplication } from '../src/bootstrap/buildApplication.ts'
import { buildRuntimeContext } from '../src/runtime/runtimeContext.ts'
import { buildPrismaSessionRepository } from '../src/conversation/infrastructure/prismaSessionRepository.ts'
import { buildPrismaRecoveryRepository } from '../src/runtime/recovery/prismaRecoveryRepository.ts'
import { runStartupRecoveryScan } from '../src/runtime/recovery/runtimeRecoveryManager.ts'
import { disconnectPrismaClient } from '../src/persistence/prismaClient.ts'

// ── Recovery Scan CLI — Phase X.13 ──────────────────────────────────────────────
// npx tsx scripts/recoveryScan.ts — drains the recovery queue against the real, Prisma-backed
// session/recovery repositories (requires DATABASE_URL; a memory-backed scan would find nothing,
// since nothing survives the process that ran it). Intended to run once at deployment/startup
// time, before traffic is accepted — deliberately NOT wired into src/server/main.ts's own boot
// sequence (frozen, X.9.1; see src/runtime/recovery/runtimeRecoveryManager.ts's own WIRING NOTE).

async function main(): Promise<void> {
  const configResult = loadAppConfigFromEnv()
  if (!configResult.ok) {
    throw new Error(`invalid configuration: ${configResult.error.message}`)
  }

  const app = await buildApplication(configResult.value)
  const runtime = buildRuntimeContext({
    application: app,
    sessionRepository: buildPrismaSessionRepository(),
  })
  const recoveryRepository = buildPrismaRecoveryRepository()

  console.log('[recovery-scan] scanning for unfinished conversation turns...')
  const result = await runStartupRecoveryScan(recoveryRepository, runtime)
  console.log(
    `[recovery-scan] scanned=${result.scanned} recovered=${result.recovered} failed=${result.failed} alreadyResolved=${result.alreadyResolved}`,
  )
  if (result.failed > 0) process.exitCode = 1
}

main()
  .then(() => disconnectPrismaClient())
  .catch(async (err) => {
    console.error('[recovery-scan] failed:', err)
    await disconnectPrismaClient()
    process.exitCode = 1
  })

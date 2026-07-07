import { loadAppConfigFromEnv } from '../config/appConfig.ts'
import { buildApplication } from '../bootstrap/buildApplication.ts'
import { buildHttpServer } from './httpServer.ts'
import { registerGracefulShutdown } from '../startup/gracefulShutdown.ts'

// ── Process Entrypoint — Phase X.9.1 ───────────────────────────────────────────
// The ONLY file in this milestone that calls server.listen(). Guarded by the import.meta.url
// check below so importing buildHttpServer()/buildApplication() from a test never starts a real
// listener (mirrors restAdapter.ts's own test-via-inject() precedent) — main() only runs when
// this file is executed directly (`node src/server/main.js` after build, or via tsx in dev).

export async function main(): Promise<void> {
  const configResult = loadAppConfigFromEnv()
  if (!configResult.ok) {
    process.stderr.write(`Invalid configuration: ${configResult.error.message}\n`)
    process.exitCode = 1
    return
  }
  const config = configResult.value

  const app = await buildApplication(config)
  const server = buildHttpServer(app)

  await server.listen({ port: config.port, host: config.host })

  registerGracefulShutdown({
    server,
    timeoutMs: config.shutdownTimeoutMs,
    onShutdown: async () => {
      if (app.mcpClient !== undefined) await app.mcpClient.disconnect()
    },
  })
}

const isEntrypoint = typeof process !== 'undefined' && process.argv[1] !== undefined
  && import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`

if (isEntrypoint) {
  void main()
}

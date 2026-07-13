import { loadAppConfigFromEnv } from '../src/config/appConfig.ts'
import { signToken } from '../src/api/credentialToken.ts'

// ── Credential Token Issuance CLI — Phase X.16 Step 4 ───────────────────────────
// npx tsx scripts/issueCredentialToken.ts <subject> [ttlSeconds]
//
// Signs a bearer token for <subject> using CREDENTIAL_SIGNING_SECRET -- the same secret
// src/api/httpPrincipalResolver.ts verifies against (X16_PROTOCOL_DECISION.md, Option A). This
// is the "simplest correct issuance path" that decision document's own Required Implementation
// Impact section names: no separate issuance service, no new HTTP endpoint (an endpoint would
// need its own access control to avoid becoming a mint-any-identity hole -- well outside this
// step's minimal scope, and a security regression this design was written to avoid, not
// introduce). Run by an operator who already has access to the real signing secret; the printed
// token is then supplied by a caller as the x-client-id header value.
//
// Thin CLI wrapper only, matching the existing scripts/waitForReady.ts/smokeTest.ts convention
// (argv parsing + a call into already-tested src/ code) -- signToken()/loadAppConfigFromEnv()
// carry all the actual logic and are already unit-tested.

const subject = process.argv[2]
const ttlSecondsArg = process.argv[3]
const ttlSeconds = Number(ttlSecondsArg ?? 3600)

if (subject === undefined || subject.trim() === '') {
  process.stderr.write('[issue-credential-token] usage: npx tsx scripts/issueCredentialToken.ts <subject> [ttlSeconds]\n')
  process.exitCode = 1
} else if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
  process.stderr.write(`[issue-credential-token] ttlSeconds must be a positive integer; received: '${ttlSecondsArg}'.\n`)
  process.exitCode = 1
} else {
  const configResult = loadAppConfigFromEnv()
  if (!configResult.ok) {
    process.stderr.write(`[issue-credential-token] invalid configuration: ${configResult.error.message}\n`)
    process.exitCode = 1
  } else if (configResult.value.credentialSigningSecret === undefined) {
    process.stderr.write(
      '[issue-credential-token] CREDENTIAL_SIGNING_SECRET is not set -- credential verification ' +
      'is not enabled on this configuration, so a token issued here would never be trusted by ' +
      'httpPrincipalResolver.ts. Set CREDENTIAL_SIGNING_SECRET first.\n',
    )
    process.exitCode = 1
  } else {
    const token = signToken(configResult.value.credentialSigningSecret, subject.trim(), ttlSeconds)
    process.stdout.write(`${token}\n`)
  }
}

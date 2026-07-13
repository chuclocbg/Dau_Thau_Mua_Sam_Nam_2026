# Phase X.16 — Credential Verification — Report

**Date:** 2026-07-13
**Scope:** replace `httpPrincipalResolver.ts`'s unverified `x-client-id` signal (X.15) with a
real, stdlib-only HMAC bearer-token credential-verification mechanism, per
`X16_PROTOCOL_DECISION.md` (Option A). Zero new business logic beyond the credential primitive
and its issuance CLI; zero modification to any X.1–X.15 frozen file's own behavior; one governance
exception (GX-004) for a foreseeable, self-caused guard collision, applied under the same
discipline X.15 established for GX-001/002/003.

---

## What Was Decided First

Before any code was written, `X16_SCOPING_REPORT.md` and `X16_PROTOCOL_DECISION.md` evaluated four
credential protocols (stdlib-only HMAC bearer token, JWT, opaque session token, OIDC) against ten
dimensions each (existing architecture, dependency graph, production readiness, security, recovery
design, deployment complexity, maintenance cost, performance, rollback simplicity, repository
conventions). **Decision: Option A, stdlib-only HMAC bearer token.** JWT was rejected as
functionally equivalent but strictly more costly (a new dependency for zero benefit at this
platform's actual single-issuer, single-verifier scale). Session tokens were rejected as violating
the platform's own documented statelessness and compounding an already-flagged persistence gap
(Docker/Postgres never live-verified). OIDC was rejected outright — no evidence anywhere in the
repository of an external identity provider requirement. Full rationale: `X16_PROTOCOL_DECISION.md`.

---

## What Was Built

**Step 1 — Credential verification primitive** (`src/api/credentialToken.ts`): `signToken()`/
`verifyToken()`, HMAC-SHA256 via `node:crypto` only — zero new runtime dependency. Constant-time
signature comparison (`timingSafeEqual()`); mandatory, enforced token expiry; malformed/tampered/
expired tokens are indistinguishable from an absent one at the call site (never a thrown error).
13 unit tests.

**GX-004 (discovered during Step 1, resolved before continuing):** adding `credentialToken.ts` to
`src/api/` broke `x15-authorization-wiring-architecture.test.ts`'s own exhaustive `src/api/`
file-count assertion (a frozen X.15 guard). Root cause: the same class of problem as GX-001/002/003
(an exhaustive-snapshot assertion over something this project's own convention treats as
additively extensible) but with a distinct trigger (Phase X.16, not X.15's own wiring) and a
distinct assertion shape (file-count enumeration, not a call-site literal). Documented in full —
rationale, why it's a governance exception and not a bug, why it's not a layering violation, why
it doesn't weaken the security model, rollback implications — in
`ADR_X15_ARCHITECTURE_DECISION.md`'s Governance Exceptions section, alongside GX-001/002/003. Fix:
one filename appended to the expected array; the assertion remains exact array-equality, not
loosened to a subset check — still fails on any other unexpected file.

**Step 2 — Authorization wiring** (`src/api/httpPrincipalResolver.ts`, `src/config/appConfig.ts`):
a real design fork was surfaced and resolved explicitly before implementation — threading the
signing secret through `registerConversationRoutes()`'s parameters (mirroring X.15's own
`sessionIdentityRepository` precedent) would have required a second, foreseeable exact-argument-
count break in `x12-http-entry-architecture.test.ts`'s GX-001-fixed literal (needing a new GX-005)
and touching `src/bootstrap/buildApplication.ts` (frozen, X.9.1, not authorized by any X.16
document). **Path B was chosen instead:** `resolvePrincipalFromRequest(req)` keeps its exact
original one-parameter signature and reads the signing secret itself via `loadAppConfigFromEnv()`
— every existing call site (`conversationRoutes.ts`, `httpServer.ts`) is byte-for-byte unchanged,
avoiding GX-005 entirely and touching zero frozen files. Trust model: no secret configured →
`x-client-id` trusted directly, identical to the exact X.15 behavior (non-regression by design,
re-confirmed against both frozen X.15 test files, neither modified); secret configured →
`x-client-id`'s value must be a token `verifyToken()` accepts, or the request falls back to
anonymous. `credentialSigningSecret` added to `AppConfig` (optional, rejects values under 32
characters), loaded via `CREDENTIAL_SIGNING_SECRET`.

**Step 3 — Real-server integration tests** (`x16-credential-http-integration.test.ts`): exercised
against the real `buildHttpServer()`, never a throwaway instance. Proves: a valid token succeeds
and correctly binds its subject; the same token resumes its own session across two calls; a
*different* signed subject is rejected with 403 attempting to resume someone else's session; an
expired token falls back to anonymous and is still rejected (403) against a real owned session —
never silently trusted; a tampered token falls back to anonymous with a clean 200, never a 500; a
header-less request is unchanged (regression, even with a secret configured).

**Step 4 — Credential issuance CLI** (`scripts/issueCredentialToken.ts`): `X16_PROTOCOL_DECISION.md`
itself named this gap — verification existed with no way for a real caller to obtain a token.
Deliberately a script, not a new HTTP endpoint: an issuance endpoint would need its own access
control to avoid becoming a mint-any-identity hole, which would have been a security regression,
not a feature, and well outside this step's minimal scope. A thin CLI wrapper only (argv parsing
over already-tested `signToken()`/`loadAppConfigFromEnv()`), matching the exact
`scripts/waitForReady.ts`/`scripts/smokeTest.ts` convention. Verified live across all four
branches (missing subject, missing secret, invalid TTL, success), not just type-checked.

**Step 5 — Dedicated architecture guard** (`x16-credential-verification-architecture.test.ts`, 13
tests): proves in code, not only in this report, that `credentialToken.ts` is import-isolated from
`src/identity/`'s evaluation engine and `src/auth/`; that Path B's promise was actually honored
(no signature changes anywhere they were meant to be preserved); that an invalid/missing
credential can never silently escalate to a trusted principal; that `package.json` gained zero new
dependency; that every X.11/X.13/X.14 frozen marker and file count (`src/api/`, `src/identity/`)
remains exactly as GX-004 left it; that the issuance CLI is a thin wrapper, not a duplicated
implementation.

---

## Deliberately NOT Done This Milestone

Named explicitly, not glossed over, matching this project's unbroken discipline:

- **No real server-side revocation.** A signed token remains valid until its `expiresAt`; there is
  no blocklist or session-invalidation mechanism. Accepted trade-off for a platform with no
  evidenced revocation requirement (`X16_PROTOCOL_DECISION.md` §5).
- **Single-secret, single-issuer trust model.** Anyone holding the signing secret can mint an
  arbitrary valid token. Secret protection (via the existing, unmodified `.env`/Docker-Compose
  secret-injection mechanism, X.9.4) is the entire security boundary — an explicit, accepted
  design choice, not a hidden weakness.
- **`routeAuthorization.ts` (Fastify-level route gating, X.14) remains completely unwired.** A
  distinct capability from the runtime-level gating this milestone strengthens; X.16's objective
  never included it (`X16_SCOPING_REPORT.md` §2).
- **Recovery-producer wiring remains unwired**, unaffected by and unrelated to this milestone.
- **The other three HTTP routes** (`reasoning/answer`, `reasoning/batch`, `reasoning/answer/stream`)
  remain entirely unauthenticated — none has session state to protect; extending credential
  verification to them was never this milestone's scope.
- **No token-issuance access control of its own.** `scripts/issueCredentialToken.ts` trusts whoever
  can run it with the real secret already present in the environment — appropriate for an
  operator-run CLI, not appropriate if this were ever exposed as a network-reachable endpoint
  (which it deliberately is not).

---

## Verification Evidence

- `tsc --noEmit`: clean, verified fresh before this freeze.
- Architecture guard suite: **35/35 files passing, 334/334 tests** (up from the X.15-freeze
  baseline of 34/321 — exactly the one new X.16 guard's 13 tests).
- Full repository test suite: **553 test files, 14,873 tests (14,870 passed, 3 skipped —
  `TEST_DATABASE_URL`-gated, Docker/Postgres unavailable, unaffected), 0 failures**, clean on the
  first run (no flake encountered this freeze). Up from the X.15-freeze baseline of 549 files /
  14,829 passed — **+4 files, +41 tests**, exactly the four new X.16 test files
  (`x16-credential-token.test.ts` 13, `x16-http-principal-resolver-credential.test.ts` 9,
  `x16-credential-http-integration.test.ts` 6, `x16-credential-verification-architecture.test.ts`
  13 — sums to 41, confirmed).
- `git diff --stat` against the pre-Step-1 baseline (`1044059`) shows exactly 12 files changed:
  3 governance documents (`X16_SCOPING_REPORT.md`, `X16_PROTOCOL_DECISION.md`,
  `ADR_X15_ARCHITECTURE_DECISION.md` revised for GX-004), 3 implementation files
  (`credentialToken.ts`, `httpPrincipalResolver.ts`, `appConfig.ts`), 1 CLI script
  (`issueCredentialToken.ts`), 4 new test files, and 1 governance-exception literal correction
  (`x15-authorization-wiring-architecture.test.ts`, GX-004). No file outside this list was
  touched — confirmed directly, not assumed.
- Zero new `package.json` dependency — confirmed by `git diff` showing no change to that file
  across the entire milestone.
- `src/bootstrap/buildApplication.ts` and `src/server/main.ts` — confirmed untouched, zero
  reference to credentials, by both direct grep and the new architecture guard.

---

## Governance Exceptions Summary

| ID | Guard | Milestone that broke it | Status |
|---|---|---|---|
| GX-001 | `x12-http-entry-architecture.test.ts` | X.15 | Applied (X.15) |
| GX-002 | `x13-recovery-architecture-guard.test.ts` | X.15 | Applied (X.15) |
| GX-003 | `x14-identity-architecture-guard.test.ts` | X.15 | Applied (X.15) |
| GX-004 | `x15-authorization-wiring-architecture.test.ts` | X.16 | Applied (X.16, this milestone) |

Zero new exceptions beyond GX-004 were required for X.16 — Path B was chosen specifically to avoid
a GX-005.

---

*End of report. `develop` is frozen at this milestone's freeze commit. Phase X.17 was not started.*

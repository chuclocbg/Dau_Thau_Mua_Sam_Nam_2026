# Phase X.16 Protocol Decision — Credential Verification

**Date:** 2026-07-13
**Status:** DECIDED. This document resolves the one open product/architecture question
`X16_SCOPING_REPORT.md` §7 deliberately left for explicit decision before Step 2 of its
implementation order may begin. No source code was written, no test was modified, no commit was
created to produce this document.
**Inputs read in full for this decision:** `X16_SCOPING_REPORT.md`,
`ADR_X15_ARCHITECTURE_DECISION.md`, `PROJECT_BASELINE_AFTER_X15.md`,
`PRE_X16_ARCHITECTURE_REVIEW.md`. Re-verified this session, not assumed: current
`package.json` dependencies (zero credential/session/JWT-related packages installed), current
`src/startup/loadEnvironmentSecrets.ts`/`src/config/appConfig.ts` (the established secret-loading
pattern, X.9.4), and current usage of `node:crypto` in the repository (two files, both for
ID/trace generation, none for HMAC signing today).

---

## 1. Decision

## A. Stdlib-only HMAC bearer token.

Verification is a signed, expiring, opaque bearer token (`{payload}.{hmac-sha256-signature}`,
base64url-encoded), verified with Node's built-in `node:crypto` module (`createHmac`,
`timingSafeEqual`). No new runtime dependency. No server-side session store. Stateless — the
server can verify a token with only a locally-held signing secret, the same shape
`httpPrincipalResolver.ts` (X.15) already has (one function, one branch, no I/O).

This is the smallest, most reversible option that actually closes the gap named in every one of
the four input documents, and it is the option most consistent with this repository's own
15-phase pattern of preferring a small, self-built primitive over a new dependency when one
suffices (§2, §3 below make this concrete rather than asserted).

---

## 2. Why the Other Options Were Rejected

### B. JWT — rejected, not disqualified

JWT (via a library such as `jose`) is **functionally comparable to Option A** if used with an
HMAC (`HS256`) signature — at that point it is the same cryptographic mechanism as Option A, plus
a standardized envelope format (`header.payload.signature`, base64url) and a third-party library
to parse/verify it. Evaluated against the ten dimensions:

- **Existing architecture:** No better fit than A — both are stateless, both slot into
  `httpPrincipalResolver.ts` identically.
- **Dependency graph:** Strictly worse — introduces the **first new runtime dependency since
  X.9.4's `dotenv`** (confirmed this session: `package.json` has zero JWT-related packages
  today). Every dependency this platform has added since X.9.1 has been justified by a capability
  the stdlib genuinely lacks (Fastify itself, Prisma, `dotenv`) — JWT verification is not such a
  capability; `node:crypto` already provides it.
- **Production readiness:** No improvement — the actual gap (an unverified `x-client-id` string)
  is closed equally by both.
- **Security:** JWT's real advantage — a standardized format enabling **third-party verification
  without sharing the signing secret** (via asymmetric `RS256`/`ES256`) — has no beneficiary here.
  There is exactly one issuer and exactly one verifier (this same server); no other service in
  this repository needs to independently verify a token. Using JWT's asymmetric mode would add
  complexity (key management) for a benefit that doesn't apply; using JWT's symmetric mode (`HS256`)
  provides no security property Option A lacks.
- **Recovery design:** No interaction with either option — `buildSystemContext()` (used by the
  recovery scan) carries no credential today and continues not to, unaffected by this decision.
- **Deployment complexity:** Slightly worse — one more dependency to vet, pin, and include in the
  Docker image build.
- **Maintenance cost:** Worse — a third-party dependency joins the update/security-advisory
  tracking burden, in a repository that `PROJECT_BASELINE_AFTER_X15.md` §7/§5 already flags as
  having **no CI/CD pipeline** and **no automated dependency scanning** — adding a new
  security-critical dependency without either safety net is a real, not theoretical, cost.
- **Performance:** Materially equivalent for `HS256` (same HMAC primitive underneath); a
  library adds parsing/validation overhead beyond the bare signature check, immaterial at this
  platform's stated 100–1,000-user scale.
- **Rollback simplicity:** Equivalent to A once shipped, but the initial rollout carries one more
  moving part (the dependency itself) to revert cleanly if backed out before a release.
- **Repository conventions:** The weakest fit. X.9.2 built its own W3C-`traceparent` parser
  specifically to avoid an `@opentelemetry` dependency ("zero @opentelemetry dependency" is
  stated as a deliberate virtue in that milestone's own freeze note); X.9.4 reused an
  already-installed `dotenv` rather than hand-rolling or adding a new .env library, and shipped
  with "Zero packages installed" as an explicit, self-reported success metric. JWT-via-library is
  the one option that breaks this pattern for a benefit (standardized interop) this platform does
  not currently need.

**Verdict:** not wrong, but strictly more cost for zero additional benefit given this platform's
actual, evidenced requirements. **Reconsider if and when** a real interoperability need emerges
(e.g., a future external identity provider needing to issue tokens this server verifies without
sharing a secret) — at that point Option B (or D/OIDC) becomes the right upgrade, not before.

### C. Opaque session token — rejected

- **Existing architecture:** Poor fit. `docs/DISASTER_RECOVERY.md`/`RUNBOOK.md` (X.9.5, frozen,
  re-confirmed this session) state the platform's statelessness explicitly as a deliberate
  design property — "RPO/RTO reduce to redeploy time" depends on the server holding no session
  state of its own. A session-token store reintroduces exactly the state this architecture was
  built to avoid.
- **Dependency graph:** Requires a new persisted concern — either a new Prisma model (touching
  `prisma/schema.prisma`, a file `X16_SCOPING_REPORT.md` §3 already flags as "must not change
  unless a session-store protocol is chosen") or an external store (Redis or similar) with no
  precedent anywhere in this repository.
- **Production readiness:** Strictly worse. `PROJECT_BASELINE_AFTER_X15.md` §7/§11 already names
  "Docker/Postgres never run live in this environment" as the platform's single largest
  outstanding HIGH-severity gap. Making the **authentication path itself** depend on that same
  unverified infrastructure compounds the platform's weakest link with its most security-critical
  one — the opposite of good risk sequencing.
- **Security:** A session store enables clean server-side revocation (a genuine advantage over
  A/B), but this platform has no product requirement for it today (no logout/revocation flow
  exists or is requested anywhere in the four input documents), and the advantage is not worth
  the architectural cost below.
- **Recovery design:** Directly conflicts with X.13's own recovery model. `runStartupRecoveryScan()`
  already treats the server as recoverable via redeploy-and-rescan; a session store adds a
  *second* kind of state (independent of `ConversationSession`/`RecoveryMarker`) that a crash
  could leave inconsistent, with no existing recovery mechanism designed to reconcile it.
- **Deployment complexity:** Worst of the three real options — a new store to provision, migrate,
  back up, and include in every deployment/rollback runbook `deployment/deploy.sh`/`rollback.sh`
  currently make no mention of.
- **Maintenance cost:** Ongoing operational burden (expiry sweeps, storage growth, backup/restore)
  that A and B do not carry at all.
- **Performance:** Every authenticated request now requires a store round-trip before the request
  can proceed — a new latency floor and a new failure mode (store unavailable ⇒ every
  authenticated request fails) that a pure signature check never has.
- **Rollback simplicity:** Worst of the three. `X16_SCOPING_REPORT.md` §4 already names this
  precisely: rolling back a session-store schema change *after* real session rows exist is
  materially harder than a pure source revert — the one scenario that specific risk was written
  to warn against.
- **Repository conventions:** Every Prisma-backed module added since X.10 defaults to
  memory-backed with Prisma as an explicit opt-in, *specifically because* Docker/Postgres has
  never been live-verified in this environment. Making the credential path Prisma-dependent by
  default inverts that convention for the one path where a broken default would be most costly.

**Verdict:** rejected. The one genuine advantage (server-side revocation) does not offset the
statelessness violation, the compounded dependency on an already-flagged-fragile persistence
layer, or the rollback/recovery risks — all four input documents converge on flagging exactly
these costs.

### D. Another protocol (OIDC / external identity provider) — rejected

- **Existing architecture / production readiness:** No evidence anywhere in the repository — not
  in `package.json`, not in `app/docs/`, not in `app/.memory/`, not in any of the 100+
  `PROJECT_KNOWLEDGE_SYSTEM/` documents — of an existing or planned external identity provider
  this platform is expected to federate with. `X16_SCOPING_REPORT.md` §7 already states this
  finding plainly: "No evidence of such a requirement was found anywhere in the repository."
- **Dependency graph / deployment complexity / maintenance cost:** Highest of all four options —
  an OIDC client library, a network dependency on an external provider at request time (or a
  token-introspection round-trip, inheriting Option C's latency/failure-mode problems), and an
  entirely new operational relationship (provider onboarding, client registration, key rotation
  coordinated with a third party) this project has never needed before.
- **Security:** Would be the strongest option **if** federation with a real external identity
  system were required — OIDC is not being rejected as insecure, it is being rejected as solving a
  problem this repository does not have evidence of having.
- **Recovery design / rollback simplicity:** Worst-case: a rollback would need to also account for
  external provider registration/state, entirely outside this repository's own control.
- **Repository conventions:** The largest possible departure from the minimal-dependency
  discipline evidenced across all 15 prior phases.

**Verdict:** rejected outright — no evidenced requirement justifies this option's cost. Revisit
only if a genuine, product-driven federation requirement is identified in the future; that would
be its own, separately-scoped decision, not an extension of X.16.

---

## 3. Required Implementation Impact

- A token-issuance mechanism must exist (this decision covers *verification*; §6 below makes
  issuance an explicit acceptance criterion, since `X16_SCOPING_REPORT.md` §3 already flagged that
  none of the four input documents specify one). For a single-server, single-signer design, the
  simplest correct issuance path is an endpoint or script that signs `{userId, issuedAt, expiresAt}`
  with the same server-held secret `httpPrincipalResolver.ts` uses to verify — no separate
  issuance service is required.
- One new configuration value: a signing secret, loaded via the existing
  `loadEnvironmentSecrets.ts` (`dotenv`, X.9.4, unmodified) / `.env` convention — re-confirmed
  this session that `appConfig.ts` has no such field yet, so this is a genuinely new,
  additively-appended config field, not a repurposing of an existing one.
- `httpPrincipalResolver.ts`'s internal branch changes from "header present → trust it" to
  "header present → verify signature + expiry → trust only if valid, else fall back to
  `buildAnonymousContext()` exactly as an absent header already does" — preserving the
  regression-safety guarantee `X16_SCOPING_REPORT.md` §6 (Acceptance Criteria #4) already
  requires.
- No change to `AuthenticationContext`/`Principal`/`evaluateAuthorization()` — re-confirmed this
  session by reading `identityTypes.ts`/`authorizationEvaluator.ts` in full: both operate purely
  on an already-constructed `Principal`, indifferent to how it was produced. This decision
  requires zero change to either.
- No new Prisma model, no new migration, no new external network dependency at request time.

---

## 4. Files Expected to Change

| File | Change |
|---|---|
| `src/api/httpPrincipalResolver.ts` (X.15) | Replace the unconditional-trust branch with a verify-then-trust branch calling the new HMAC verification primitive. |
| A new file, e.g. `src/api/credentialToken.ts` (co-located with `httpPrincipalResolver.ts`, for the same X.14-recursive-guard-collision reason that file itself was relocated out of `src/identity/` at X.15) | `signToken()`/`verifyToken()` pair — `node:crypto`'s `createHmac('sha256', secret)` over a `{subject, issuedAt, expiresAt}` payload, plus `timingSafeEqual()` for constant-time signature comparison. Zero new dependency. |
| `src/config/appConfig.ts` (X.9.1, extended additively at X.9.4/X.15-class milestones before) | One new, additively-appended field for the signing secret, loaded the same way every other config value already is. |
| `.env.example`/`.env.template` (if present) | One new documented variable for the signing secret. |
| `src/__tests__/x15-authorization-wiring-architecture.test.ts` | Updated per `X16_SCOPING_REPORT.md` §5 Step 4 — the "imports only the two X.14 factory functions" assertion extended to also permit the new `credentialToken.ts` import (a planned governance exception, not a reactive one). |
| New test files under `src/__tests__/` | Unit tests for `signToken()`/`verifyToken()` (valid, expired, tampered-signature, malformed-payload cases); an extended real-server integration suite (valid token → 200 with correct principal; expired/tampered token → anonymous fallback or 403 per implementation choice; header-less request → unchanged regression behavior). |
| **Unaffected, confirmed by this decision:** `src/identity/domain/identityTypes.ts`, `application/authenticationContext.ts`, `application/authorizationEvaluator.ts`, `application/runtimeAuthorization.ts`, `application/routeAuthorization.ts`, all of `src/runtime/`, `src/runtime/recovery/`, `prisma/schema.prisma`, `package.json` (no new dependency) | Zero change required by this decision. |

---

## 5. Security Considerations

- **What this closes:** the false-sense-of-security gap X.15 itself named — two different callers
  can no longer collide into the same trusted identity by coincidence, *and* a caller can no
  longer simply assert an arbitrary identity by sending a different header value, since the
  signature can only be produced by a party holding the server's signing secret.
- **What this does not close, stated plainly (matching this project's own consistent honesty
  discipline):** this is still **single-secret, single-issuer** authentication — anyone who
  obtains the signing secret can mint an arbitrary valid token. Secret protection (via the
  existing `.env`/Docker Compose secret-injection mechanism, X.9.4, unmodified) is therefore the
  entire security boundary. This is an accepted, explicit trade-off for a platform with one
  server and no external federation requirement — not a hidden weakness.
- **Expiry is mandatory, not optional.** Every token must carry and enforce an `expiresAt`; an
  unbounded-lifetime token would materially weaken this design without a corresponding benefit.
- **Constant-time comparison is mandatory.** `timingSafeEqual()` (or equivalent), not `===`, for
  the signature check — a naive string comparison would reintroduce a timing side-channel this
  design has no reason to accept.
- **No revocation mechanism exists in this design**, an explicit, accepted limitation (matching
  the "no product requirement for revocation found" finding in §2). If a future requirement for
  revocation emerges, it would need either a short token lifetime (mitigation) or a move toward
  Option C/B-with-introspection (a future, separately-scoped decision).
- **Secret rotation is a manual, deploy-time operation** under this design (update the `.env`
  value, redeploy) — acceptable at this platform's current scale and consistent with how every
  other secret in this repository is already rotated (per `docs/DISASTER_RECOVERY.md`'s existing
  conventions, unmodified).
- **This remains, honestly, still short of "real credential verification" in the strongest sense**
  (there is no user registration, password, or external identity check — a caller who obtains a
  validly-signed token via *any* means, including a leaked secret or a compromised issuance path,
  is fully trusted). This is a deliberate scope boundary for X.16, not an oversight — it closes
  the specific gap named in `CURRENT_MILESTONE.md`/`ADR_X15_ARCHITECTURE_DECISION.md` (a
  caller-distinguishing, tamper-evident, expiring credential replacing an unverified string) and
  should be described exactly that way in any future freeze report, not oversold.

---

## 6. Acceptance Criteria

In addition to every criterion already listed in `X16_SCOPING_REPORT.md` §6 (which this decision
does not weaken or supersede — all still apply), specific to the HMAC-bearer-token choice:

1. Token verification uses `timingSafeEqual()` (or an equivalent constant-time comparison) —
   never a direct string/`===` comparison of signatures.
2. Every issued token carries a mandatory, enforced `expiresAt`; verification rejects expired
   tokens by falling back to `buildAnonymousContext()`, never by throwing an unhandled error.
3. A malformed or tampered token (bad signature, unparseable payload) is treated identically to a
   missing token — anonymous fallback, not a 500 error — preserving the same "never let an
   unverifiable header crash the request" discipline `httpPrincipalResolver.ts` already
   established for the `x-client-id` case at X.15.
4. The signing secret is loaded exclusively via the existing `loadEnvironmentSecrets.ts`/`dotenv`
   convention (X.9.4) — no new secret-loading mechanism is introduced.
5. `signToken()`/`verifyToken()` have zero import from `src/identity/`'s evaluation modules
   (`authorizationEvaluator.ts`, `permissionResolver.ts`) and zero import from `src/auth/` —
   re-confirming, for the new module specifically, the same boundary every prior identity-adjacent
   file has upheld.
6. `package.json` shows zero new runtime dependencies as a direct result of this decision —
   verified by `git diff` at freeze time showing no change to `dependencies`.
7. A real-server integration test (against `buildHttpServer()`, not a throwaway instance) proves:
   valid token → correct non-anonymous principal, 200; expired token → anonymous fallback,
   consistent with criterion 2; tampered token → anonymous fallback, consistent with criterion 3;
   no token → unchanged pre-X.16 behavior (regression guard).
8. The freeze report states explicitly, per §5 above, that this design provides
   single-secret/single-issuer authentication with no revocation mechanism — matching this
   project's unbroken discipline of naming every scope boundary rather than implying more
   security than was actually built.

---

## 7. Rollback Implications

- **Low risk, by design.** Every file in §4's "expected to change" list is source-code-only — no
  schema, no migration, no external service registration. A full rollback of this decision's
  implementation is a pure `git revert`/checkout to the pre-X.16 commit, with no data-migration
  concern of any kind — the same clean profile `X16_SCOPING_REPORT.md` §4 already identified as
  the "low risk, if scoped as described" case, now confirmed as the actual chosen path.
- **`buildAnonymousContext()` remains the universal safe fallback throughout** — even mid-rollout,
  a caller presenting no token or an unverifiable one experiences exactly today's (X.15) anonymous
  behavior; there is no intermediate state where rolling back this feature could leave the
  authorization system in an inconsistent or more-permissive state than before X.16 began.
- **The one non-code artifact this decision introduces — the deployed signing secret itself** —
  has no rollback implication of its own: rotating or removing it at any time simply invalidates
  outstanding tokens (callers fall back to anonymous), it does not need to be "rolled back" in the
  way a schema change would.
- **Contrast with the rejected Option C**, explicitly, per §2: had a session-store protocol been
  chosen instead, rollback after real session rows existed in a live database would have been
  materially harder — this was a deciding factor against C, and its absence here is the direct,
  intended benefit of choosing A.

---

*End of decision. No source code was modified. No tests were modified. No commits were created. No
milestones were updated. No branches or tags were created. Phase X.16 implementation has not
begun — this document authorizes the protocol choice only.*

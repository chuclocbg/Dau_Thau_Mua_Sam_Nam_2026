# Phase X.14 — Authentication, Authorization & Identity Infrastructure — Report

**Date:** 2026-07-13
**Scope:** implement the complete identity foundation for the AI Runtime — Principal, Claims,
Roles, Permissions, authentication context, authorization evaluation, route/runtime/tool/MCP
authorization, session identity binding, and the Anonymous/User/Service/System identity kinds —
with zero procurement/legal/asset business logic, reusing existing infrastructure wherever
genuinely possible, and modifying no frozen milestone (X.3–X.13).

---

## What Was Inspected First

- **`src/auth/`** (Phase M1, pre-existing, predates Phase X) — a comprehensive, well-designed
  RBAC/ABAC system (`User`, `Role`, `Permission`, `Session`, `DelegationGrant`, `PermissionGrant`,
  `ApprovalHierarchy`, `Policy`, `AccessDecision`, `AuthContext`) with sound algorithms (wildcard
  resource/action matching, `OWN ⊂ DEPARTMENT ⊂ ALL` scope hierarchy, role-ancestor traversal
  with cycle detection, 4-tier policy conflict resolution). **Read in full before any code was
  written.** Confirmed by direct inspection that this module is procurement/legal business
  logic, not generic infrastructure:
  - `authTypes.ts`'s `STANDARD_RESOURCES` includes `'PACKAGE'`, `'CONTRACT'`, `'PAYMENT'`,
    `'SUPPLIER'`.
  - `PermissionConditions.maxValue` is commented `// max VNĐ value (for procurement guards)`.
  - `ApprovalHierarchy.authorityLevel`/`valueThreshold` map directly to procurement approval
    tiers.
  - `DelegationGrant` requires a `legalBasis: readonly LegalBasis[]` citation.
  - Every algorithm in `src/auth/domain/{permission,roleHierarchy,policy}.ts` is typed directly
    against these business-coupled types (`AuthContext`, `Policy`, `PolicyContext`), so importing
    any of it would pull procurement/legal concepts into the AI Runtime transitively.

  **Decision:** this milestone's own explicit requirement ("no procurement concepts, no legal
  concepts, no asset concepts") makes direct reuse of `src/auth/` impossible without violating
  it. The *design* (wildcard matching, scope hierarchy, priority-based evaluation) was reused as
  a pattern; the *code* was not, because its types are business-coupled. `src/identity/` imports
  nothing from `src/auth/` — verified in code, not just claimed, by the architecture guard.

- **`src/runtime/conversationEntryOrchestrator.ts`** (X.11, frozen) — `runConversationTurn()`'s
  signature confirmed stable; no identity/principal field exists anywhere in `RuntimeContext`
  or `Application`.
- **`src/reasoning/domain/toolCallingTypes.ts`** (X.6, frozen) — `ToolDecider` is already a
  pluggable, injectable decision function (`runToolCallingStage(..., { decider })`), the exact
  extension point Tool authorization needed — no modification required anywhere.
- **`src/mcp/application/mcpClient.ts`** (X.7, frozen) — `callTool(name, args)` is the invocation
  point; `mcpToolAdapter.ts` already registers every MCP tool into the same `ToolRegistry` local
  tools use, so `withToolAuthorization()` already covers MCP-sourced tool calls made through the
  normal `runToolCallingStage()` path with zero special-casing.
- **`src/server/main.ts` / `src/api/conversationRoutes.ts`** (X.9.1/X.12, frozen) — confirmed no
  carve-out exists this milestone (unlike X.9.2–X.9.5/X.10/X.11's own narrow "wiring only"
  exceptions), matching X.13's own precedent. Route/Runtime authorization were built as complete,
  tested, standalone capabilities, not wired into the live boot sequence or write path.

---

## Determination

No generic, business-free identity/authorization infrastructure existed. `src/auth/` exists but
is out of scope by this milestone's own explicit constraint. Everything below is new, additive,
and built without modifying a single byte of any X.3–X.13 file.

---

## What Was Built (`src/identity/`, 10 files)

| Capability | File |
|---|---|
| Identity model, Principal, Claims, Roles, Permissions | `domain/identityTypes.ts` |
| Permission resolver, built-in Roles | `application/permissionResolver.ts` |
| Authorization evaluator | `application/authorizationEvaluator.ts` |
| Authentication context, Anonymous/User/Service/System identity | `application/authenticationContext.ts` |
| Runtime authorization, Session identity binding (write path) | `application/runtimeAuthorization.ts` |
| Route authorization | `application/routeAuthorization.ts` |
| Tool authorization | `application/toolAuthorization.ts` |
| MCP authorization hooks | `application/mcpAuthorization.ts` |
| Session identity binding (persistence) | `infrastructure/sessionIdentityRepository.ts` (+ memory impl) |
| Session identity binding (Prisma) | `infrastructure/prismaSessionIdentityRepository.ts` |

**Deterministic, built-in roles** (`permissionResolver.ts`): four fixed roles — `ANONYMOUS`,
`USER`, `SERVICE`, `SYSTEM` — deliberately *not* a persisted, admin-editable RBAC system (that
would duplicate `src/auth/`'s own role-management purpose and drift toward business logic).
`ANONYMOUS`'s permission (`conversation:ask:OWN`) intentionally matches what every unauthenticated
caller can already do today — introducing identity infrastructure does not silently change
existing behavior.

**Session identity binding** (`SessionIdentityBinding`) associates a `ConversationSession` (X.11,
frozen) with a `Principal` by `sessionId`, without modifying `ConversationSession`'s shape — the
same parallel-bookkeeping pattern Phase X.13's `ConversationRecoveryMarker` already established.

**New, additive Prisma model**: `SessionIdentityBinding` (+ `PrincipalKind` enum). No `Role`/
`Permission` table — those are deterministic constants, not persisted data. Migration generated
via schema-to-schema diff (no shadow database needed, same technique as X.11/X.13), never applied
to a live database (Docker unavailable in this environment).

---

## Dependency Graph (verified by architecture guard and integration tests)

```
runAuthorizedConversationTurn(auth, sessionIdentityRepository, runtime, request)   (X.14, new)
  ├─ evaluateAuthorization(...)                                                     (X.14, new)
  ├─ ISessionIdentityRepository.findBySessionId()  — ownership check                (X.14, new)
  ├─ runConversationTurn(runtime, request)          (X.11, frozen, unmodified)
  └─ ISessionIdentityRepository.create()            — bind new session              (X.14, new)

withToolAuthorization(auth, decider): ToolDecider    (X.14, new)
  └─ passed as the `decider` option to runToolCallingStage()  (X.6, frozen, unmodified)

authorizeMcpToolCall(auth, toolName)                 (X.14, new — a pure check, never wraps mcpClient.ts)

buildRouteAuthorizationHook(requirement, resolvePrincipal): preHandlerHookHandler   (X.14, new
  — a standalone Fastify hook builder, provable via a real Fastify instance, NOT registered on
    src/server/httpServer.ts or src/api/conversationRoutes.ts, both frozen)
```

`RuntimeContext`'s exported shape is unchanged — `ISessionIdentityRepository` is composed
separately at each call site, never added as a field to it.

---

## Deliberate Scope Boundaries (stated plainly, not glossed over)

1. **Not wired into production traffic.** `runAuthorizedConversationTurn()` is not called by
   `src/api/conversationRoutes.ts`; `buildRouteAuthorizationHook()` is not registered on
   `src/server/httpServer.ts`. Both are complete, tested capabilities — wiring them into the live
   request path is left for a future, separately-authorized milestone, matching the exact
   precedent X.13 set for its own recovery scan.
2. **No real credential verification.** `buildUserContext(userId)` shapes a `Principal`; it does
   not verify a password, token, or session — that protocol was not specified and is out of
   scope. `buildRouteAuthorizationHook()`'s default `resolvePrincipal` always returns anonymous,
   matching today's actual, unauthenticated behavior.
3. **MCP default permissions are minimal by design.** Only `SYSTEM`'s wildcard permission
   authorizes any named MCP tool; `ANONYMOUS`/`USER`/`SERVICE` are denied by default (no MCP tool
   name was pre-authorized, consistent with never fabricating a specific grant).

---

## Tests

- **Unit tests**: `x14-identity-model.test.ts` (9 tests — the four identity factory functions,
  determinism), `x14-permission-resolver.test.ts` (8 tests — built-in role registry, merge/
  dedup, unknown-role tolerance), `x14-authorization-evaluator.test.ts` (16 tests — scope
  hierarchy, wildcard matching, `findMatchingPermission`, plus deterministic replay verification
  proving the same request evaluated twice yields an identical decision), `x14-session-identity-
  repository.test.ts` (9 tests — CRUD, `findBySessionId`), `x14-tool-mcp-authorization.test.ts`
  (8 tests).
- **Integration tests**: `x14-runtime-authorization-integration.test.ts` (7 tests, against a real
  `Application`) — an anonymous caller is authorized (matching current behavior); a principal
  with no permissions is denied *before* the reasoning pipeline is ever called (zero session
  created); a returning user resumes their own session; a different user is denied access to
  someone else's session; a `SERVICE` principal (`ALL` scope) *can* cross session boundaries.
  `x14-route-authorization-integration.test.ts` (4 tests, real Fastify `inject()`, never the
  frozen server) — 403 on denial, 200 on grant, default-anonymous behavior, header-based
  principal resolution.
- **Prisma + migration tests**: `x14-identity-prisma-repository.test.ts` (4 tests) — the
  established `DATABASE_URL`-missing convention plus a real `npx prisma validate` CLI run.
- **Architecture guard**: `x14-identity-architecture-guard.test.ts` (13 tests) — the single most
  important test this milestone: confirms `src/identity/` imports **nothing** from `src/auth/`
  (the central design decision, verified in code, not just comments); confirms no
  business-domain import anywhere; confirms `identityTypes.ts` contains no procurement/legal
  vocabulary by name (`departmentId`, `VNĐ`, `DelegationGrant`, `ApprovalHierarchy`,
  `legalBasis`, `maxValue`); confirms `runtimeAuthorization.ts`/`toolAuthorization.ts` import
  only the exact frozen entry points needed, never their internals; confirms `main.ts`/
  `conversationRoutes.ts`/`httpServer.ts` contain no reference to identity (proving the wiring
  gap architecturally); confirms every prior frozen-file marker (X.4–X.13) is unchanged.

---

## Investigation: The Three Originally-Reported Test Failures

The full-suite run that produced this milestone's implementation reported **3 failures**. Before
writing this report, each was investigated per the required workflow rather than assumed benign.

**Root cause:** all three failing files —
`src/__tests__/x10-prisma-integration.test.ts` (X.10, frozen),
`src/__tests__/x13-prisma-recovery-repository.test.ts` (X.13, frozen), and
`src/__tests__/x14-identity-prisma-repository.test.ts` (X.14, this milestone) — share the
identical pattern: a migration test that shells out to a real `npx prisma validate` via
`execSync`. Measured directly: a single invocation takes **~2.8s** on an otherwise-idle system —
already more than half of vitest's 5000ms default per-test timeout. Under full-suite parallel
load (546 concurrently running test files), that routinely exceeds 5s, causing a sporadic,
load-dependent timeout unrelated to any test's own logic.

**Evidence this is sporadic, not a persistent regression** (three consecutive full-suite runs):

| Run | Failures | Files |
|---|---|---|
| 1 | 3 | X.10, X.13, X.14 |
| 2 (after fixing X.14's own timeout) | 2 | X.10, X.13 only — X.14 passed |
| 3 | 0 | none |

The failing set shrank and varied non-deterministically across runs with no code change between
runs 2 and 3 — the defining signature of a load-timing flake, not a logic defect. This exact
characteristic and resolution (rerun, confirm non-determinism, do not chase a single "clean" run
as proof of anything beyond that run) was already established at the **Phase X.9.5 freeze**, where
a pre-existing, frozen real-socket timing test flaked once under full-suite load and was
explicitly left unmodified with an honest note, not "fixed."

**Classification:** *pre-existing unrelated issue* (shared load-timing characteristic of
`execSync`-based real-CLI migration tests under heavy parallel contention) — **not** an
implementation bug, incorrect test expectation, or architecture guard failure in X.14's own code.

**Fix applied (minimum necessary, X.14-scoped only):** `x14-identity-prisma-repository.test.ts`'s
migration test timeout was extended from vitest's 5000ms default to `15000ms` (a third argument
to `it(...)`, pure test-configuration, zero new functionality). This is the *only* file this fix
could touch: `x10-prisma-integration.test.ts` and `x13-prisma-recovery-repository.test.ts` are
frozen (X.10/X.13) and were **not modified** — confirmed by `git status` showing no diff on
either file. Those two tests remain exposed to the same pre-existing, sporadic characteristic;
this is a known, accepted, out-of-scope condition, not something this milestone is responsible
for resolving, exactly mirroring the X.9.5 precedent.

**Verification after the fix:** X.14's own migration test passed reliably in both subsequent
full-suite runs (2 and 3) and in isolation. `tsc --noEmit` clean throughout. Zero diff on any
X.3–X.13 file at every step.

---

## Full Suite Result

546 test files, 14,803 tests passed, 3 skipped (X.10's `TEST_DATABASE_URL`-gated tests,
unaffected), 0 failures (clean run 3) — up from 537 files / 14,726 tests at the X.13 freeze
baseline (+9 files, +77 tests, exactly the new X.14 test files). `tsc --noEmit` clean.

---

## Verification

- `git status` confirms exactly 10 new files under `src/identity/`, 9 new test files, 1 new
  migration folder, and 1 modified file (`schema.prisma`, 27 insertions, 0 deletions, purely
  additive) — zero other file touched, including `x10-prisma-integration.test.ts` and
  `x13-prisma-recovery-repository.test.ts`.
- `git diff --stat` against every frozen X.3–X.13 directory (`reasoning`, `mcp`, `multiagent`,
  `server`, `startup`, `bootstrap`, `logging`, `metrics`, `tracing`, `middleware`, `streaming`,
  `http`, `cancellation`, `config`, `runtime`, `api`, `conversation`, `persistence`,
  `prisma.config.ts`, `auth`) confirms zero diff.

---

## Explicit Statement

**No frozen file (X.3–X.13) was modified. No ADR was modified.** `src/auth/`'s business-coupled
types and functions were inspected in full and deliberately not imported — the design pattern
was reused, the business-coupled code was not, and this is verified in the architecture guard,
not merely asserted in comments. The three originally-reported test failures were investigated,
root-caused to a pre-existing, sporadic, load-dependent test-infrastructure characteristic
shared with two already-frozen milestones' tests, and resolved with the minimum necessary,
non-functional change scoped entirely to this milestone's own new test file.

*Per this milestone's explicit closing instruction, work stops here. Phase X.14 is frozen. No
business-domain milestone begins automatically.*

# X.15 Governance Impact Assessment

**Date:** 2026-07-13
**Trigger:** three sequential stop-points during Phase X.15 implementation, each surfacing a
conflict between an ADR-authorized change to `src/api/conversationRoutes.ts`/
`src/server/httpServer.ts` and an already-frozen test's literal content assertion.
**Method:** exhaustive, empirical search — every test file referencing either of the two files
X.15 touches was located and either read in full or actually executed to confirm pass/fail,
not assumed. No source code, test, commit, milestone, or tag was touched to produce this report.
**Status:** implementation is halted pending the decision this report supports.

---

## 1. Complete Enumeration

Every frozen test file referencing `conversationRoutes.ts` and/or `httpServer.ts` was found via
`grep -rl` across `src/__tests__/`, then individually inspected or executed. Full result:

| # | File (frozen milestone) | Assertion(s) affected | Confirmed by |
|---|---|---|---|
| 1 | `x12-http-entry-architecture.test.ts` (X.12) | (a) exact import match `import { runConversationTurn } from ...`; (b) exact substring `registerConversationRoutes(server, runtime)` | Executed — 2 failures, both fixed under **GX-001** (approved) |
| 2 | `x13-recovery-architecture-guard.test.ts` (X.13) | exact substring `registerConversationRoutes\(server, runtime\)` in `httpServer.ts` (line 160) | Executed — 1 failure, confirmed, **not yet modified** |
| 3 | `x14-identity-architecture-guard.test.ts` (X.14) | broad `/identity/` absence check on both files (line 124-126) | Executed — 1 failure, confirmed, **not yet modified** |
| — | `x9-server-architecture.test.ts` (X.9.1) | none found | Grepped — no match |
| — | `x92-observability-architecture.test.ts` (X.9.2) | prefix-only existence check (`'registerReasoningRoutes('`, no argument list) | Read — safe, does not break |
| — | `x93-streaming-architecture.test.ts` (X.9.3) | prefix-only existence check | Read — safe, does not break |
| — | `x94-docker-config-architecture.test.ts` (X.9.4) | name-only regex, no argument list | Read — safe, does not break |
| — | `x14-route-authorization-integration.test.ts` (X.14) | exercises a throwaway Fastify instance, never the real `httpServer.ts` | Read — no overlap |
| — | `http-server-integration.test.ts`, `observability-integration.test.ts`, `reasoning-stream-integration.test.ts`, `smoke-checks-integration.test.ts` (X.9.1–X.9.5) | behavioral tests, none call `/api/v1/conversation/turn` | Grepped — no overlap |
| — | `x12-conversation-http-integration.test.ts` (X.12) | behavioral test, calls the conversation route | Executed — still passes (5/5); authorization does not change behavior for its specific scenarios |
| — | any guard checking an exact file count on `src/api/` | — | Grepped — none exists |

**Confirmed total: 3 already-frozen test files, across 3 different milestones (X.12, X.13,
X.14), 4 individual assertions**, require modification for Phase X.15 to proceed as the current
ADR specifies. One (X.12, 2 assertions) has an approved fix in place (GX-001). Two (X.13's one
assertion, X.14's one assertion) are un-actioned per the explicit "stop again" instruction.

---

## 2. Classification

| # | Item | Classification |
|---|---|---|
| 1a | X.12 guard: exact import literal | **Obsolete literal assertion** — the guard's *intent* (no duplicated orchestration) is unaffected; only the name of the one-permitted-import changed |
| 1b | X.12 guard: exact call-site substring | **Obsolete literal assertion** — same file, same class of issue, an argument was added |
| 2 | X.13 guard: exact call-site substring | **Obsolete literal assertion** — identical shape to 1b, in a different milestone's copy of the same check |
| 3 | X.14 guard: broad "no identity reference" check | **Obsolete literal assertion appearing as an architectural-intent statement** — its title claims a narrow intent ("`routeAuthorization.ts` is never imported") but its implementation encodes a broader, now-stale fact ("nothing under `src/identity/` is wired in at all") |

**None of the four are:**
- **Dependency boundary changes** — no guard asserts a *layering* rule (e.g., "api must not import identity") that X.15 violates; every guard here asserts a *point-in-time content snapshot*, not a boundary. The actual dependency-boundary guards (forbidden-import lists for `src/identity/`, `src/reasoning/`, etc.) all still pass unmodified.
- **API evolution** in the sense of an incompatible break — `runConversationTurn()` and `registerConversationRoutes()`'s 2-argument form are not removed from the codebase or callable elsewhere in a broken way; this is purely additive.
- **Governance inconsistency** at the rule level — no two governance documents contradict each other about what's *allowed*. The ADR and every frozen milestone's own stated scope agree that `conversationRoutes.ts`/`httpServer.ts` are meant to be extended by future wiring milestones (see §3). The inconsistency is at the *test-authoring* level, not the *governance-rule* level.

---

## 3. Root Cause: A (isolated exceptions) or B (one underlying mismatch)?

**B. These are symptoms of one underlying architectural mismatch**, evidenced directly:

1. **`httpServer.ts`'s own header comment**, unmodified since X.9.1 and extended by every
   subsequent milestone that touched it, is explicit: it now carries *four* consecutive
   "ADDITION" blocks (X.9.2, X.9.3, X.12, X.15) — this file's entire design, established from
   X.9.1 onward and never contested, is "wired once, extended repeatedly." The same is now true
   of `conversationRoutes.ts` (X.12, extended X.15).
2. **X.9.2's, X.9.3's, and X.9.4's own guards**, which also had to verify "`httpServer.ts` was
   extended additively, not modified," chose **prefix-only / name-only existence checks**
   (`.toContain('registerReasoningRoutes(')` — function name plus open paren, no argument list,
   no closing paren) — a style *robust* to exactly the kind of future extension this project's
   own established pattern guarantees will keep happening.
3. **X.12's own guard**, verifying the *same class of fact* about the *same file* for the first
   time on `conversationRoutes.ts` (and re-verifying `httpServer.ts`), instead chose **exact
   substring / exact import matching** — a style *brittle* to that same future extension.
4. **X.13's and X.14's guards**, each needing to prove "the X.12 HTTP entry files are still
   unmodified since X.12," naturally *copied X.12's own brittle assertion* as their reference
   point, rather than re-deriving a robust one. The brittleness propagated forward through every
   subsequent milestone that needed to re-verify the same fact.

This is a single root cause — **an inconsistency in architecture-guard authoring style between
the X.9.2/X.9.3/X.9.4 lineage (robust) and the X.12/X.13/X.14 lineage (brittle) for files this
project has always intended to extend repeatedly** — not three unrelated coincidences. If X.15
proceeds and freezes with three isolated, reactively-discovered exceptions, **the same class of
break will recur at X.16** (credential verification, per the existing roadmap, also touches
`conversationRoutes.ts`) against X.15's own new guard, and again at whatever milestone follows
that. The pattern does not self-resolve; it compounds with every future wiring milestone unless
addressed once, explicitly.

---

## 4. Recommendation

## B. Replace the current ADR with a revised X.15 ADR — same technical architecture, formal governance-exception handling.

**Not literal zero-guard-touch B.** A design that touches *no* frozen guard at all was
considered and rejected: the only way to achieve that is to not modify `conversationRoutes.ts`/
`httpServer.ts` this milestone — i.e., build the wiring capability again without actually wiring
it into production traffic. That is the exact failure mode `ADR_X15_ARCHITECTURE_DECISION.md`
was written to end (X.13 didn't wire recovery, X.14 didn't wire authorization; a third
"built-but-not-wired" milestone would leave the HIGH-severity, already-exploitable session-hijack
finding open indefinitely for a reason that has nothing to do with the finding itself). Rejected.

**Not C (defer and redesign).** Nothing in this assessment found a problem with the *code*
architecture — zero circular imports, zero layering violations, the dependency-boundary guards
all still pass. The problem is entirely in how *three prior milestones' test suites* chose to
verify a fact about files explicitly designed for repeated extension. Deferring X.15 doesn't fix
that; it only delays the same collision to X.16 against a now-larger set of frozen guards.

**Why B, specifically:** the current ADR authorized the correct technical design but did not
anticipate its full governance footprint — it named one file-location conflict as a possibility
(§ Risk Register) but not the guard-content conflicts, which turned out to be the larger issue.
A revised ADR should:

1. **Enumerate all three required exceptions up front** (this report's §1), replacing the
   reactive, one-at-a-time discovery process with a single, complete, pre-approved list.
2. **Add a formal "Governance Exceptions" section** naming each as GX-001 (X.12, already
   applied), GX-002 (X.13), GX-003 (X.14), each scoped exactly as GX-001 was scoped: minimum
   literal changed, architectural intent re-verified and preserved, zero weakening.
3. **State the root cause explicitly** (this report's §3) so the *next* milestone that touches
   either file — X.16 is already known to — inherits the finding instead of rediscovering it.
4. **Record a forward-looking convention recommendation** (not a mandate this report can issue
   unilaterally): future architecture guards verifying "file X was extended, not modified" for
   any file under the established "wiring only, repeatedly extended" pattern (`httpServer.ts`,
   `conversationRoutes.ts`, and any future file that joins that pattern) should use the
   X.9.2/X.9.3/X.9.4 style (name + open-paren presence check) rather than exact-substring
   matching, specifically to prevent this class of break recurring at X.16 and beyond. This is a
   recommendation for whoever authors X.16's own guard, not a retroactive rewrite of X.9.2/
   X.9.3/X.9.4 (which are already correct and need no change) or an additional change to
   X.12/X.13/X.14 beyond the three named literal corrections.

The underlying implementation already written and verified in this session (Steps 1–4: the
principal resolver, the `conversationRoutes.ts`/`httpServer.ts` wiring, the deploy.sh recovery-
scan step, GX-001) requires **no redesign** under this recommendation — it is sound. What's
missing is the formal, complete governance paper trail around it, produced *before* continuing
rather than assembled reactively.

---

## 5. Evidence Summary Supporting This Recommendation

- **Zero layering violations**: every dependency-boundary assertion in every guard listed in §1
  still passes; only point-in-time content snapshots fail.
- **Zero behavioral regressions**: `x12-conversation-http-integration.test.ts`, an unmodified,
  frozen X.12 *behavioral* test exercising the real server, still passes 5/5 against the new
  wiring — proving the ADR's design is additive in practice, not just in principle.
- **A structural marker already in the codebase confirms intent**: `httpServer.ts`'s own,
  unmodified-since-X.9.1 header comment already documents four rounds of additive extension as
  normal and expected for this specific file — the guards that broke are the outlier, not the
  code.
- **The one guard whose style survived intact** (X.9.2/X.9.3/X.9.4) proves a robust alternative
  assertion style was available and already in use elsewhere in this same project before X.12's
  guard was written — this was not an unknowable risk.

---

*End of assessment. No source code, test, commit, milestone, or tag was modified to produce this
report. Implementation remains halted pending a decision on the recommendation above.*

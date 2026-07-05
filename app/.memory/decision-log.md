# Decision Log

Chronological record of non-obvious architectural decisions.

---

## 2026-07-04 — Authentication strategy: opaque sessions + Keycloak hub (ADR-010)

Decision: The canonical session mechanism is an opaque sessionId (random UUID) validated
by DB lookup. JWT access tokens are optional, API-client-only, deferred to Phase M.
Keycloak is the production IdP hub (on-premise, OIDC, federates LDAP/VNeID/GovSSO/AzureAD).
src/auth/ is FROZEN. IAuthenticationProvider is immutable from this point forward.

---

## 2026-07-04 — src/auth/ frozen as infrastructure module

Decision: src/auth/ joins the frozen modules list. No business module may modify it.
New auth functionality (JWT, new providers) must be added as new files in src/auth/
without changing existing public API signatures. Cross-module auth access goes via
AuthContext only.

---

## 2026-07-03 — Payment rules via dynamic rule engine (no hardcoded values)

Decision: All payment validation limits (advance rates, retention rates, deadlines) are stored
as data in `PaymentLegalRule.numericParams` and resolved at runtime via `resolvePaymentRule`.
Business code never contains Vietnamese law names, decree numbers, or percentage constants.
New legal amendments require only inserting a new rule object — zero code changes.

---

## 2026-07-02 — Architecture Freeze at Phase E.5

Decision: Pause business module development to perform Architecture Freeze Review
before beginning Document Generator.

Rationale: Platform will eventually exceed 100 entities, 300 services, 1000+ API
endpoints, 100k+ tests. Structural issues discovered now cost 1 file to fix.
Structural issues discovered after Phase H cost 8+ frozen modules to update.

Score: 7.5/10. Approved: READY AFTER MINOR FIXES.

Fixes applied:
- R1: Shared IBaseRepository
- R2: Domain type name collisions resolved
- R3: Prisma index report (deferred)
- R4: PROJECT_CONSTITUTION.md + ADRs + .memory/ + coding-rules

---

## 2026-07-02 — Canonical IBaseRepository in src/shared/

Decision: Single `IBaseRepository<T>` in `src/shared/repository/IBaseRepository.ts`.
Both package and planning repos re-export from this file.

Rationale: Two independent definitions existed (package had a generic constraint,
planning did not). With 8+ future modules each defining their own version,
this would produce 8 subtly different base contracts.

---

## 2026-07-02 — Rename domain string-union types

Decision: In `procurementTypes.ts`:
- `PackageType` → `ProcurementPackageKind`
- `ProcurementMethod` → `ProcurementMethodCode`
- `ApprovalAuthority` → `ApprovalAuthorityLevel`

Rationale: All three names collided with entity interface names in `masterdataTypes.ts`.
TypeScript disambiguates by import path but developers frequently import both files.
Collision becomes a build error the moment Document Generator imports from both.

---

## 2026-06-22 — ProcurementNeed embedded in ProcurementRequest

Decision: `ProcurementNeed` is embedded as `needs[]` on `ProcurementRequest`.
No separate `IProcurementNeedRepository` created.

Rationale: Needs never exist independently of a request. Separate repo adds 39 tests
and 1 source file for a concept that has no standalone lifecycle. Ponytail mode.

---

## 2026-06-22 — Planning uses one-way integration bridges (no frozen file modification)

Decision: `planningIntegration.ts` imports from Workflow/MasterData/RuleEngine/Package.
No frozen module imports from planningIntegration.

Rationale: Maintains the invariant that adding a new module never requires modifying
existing frozen modules. Integration bridges are always the new module's responsibility.

---

## 2026-06-22 — buildPlanWorkflow hardcodes OPEN_TENDER (KI-001)

Decision: Accepted as known issue. Hardcoded default is correct for most plans and
keeps Phase E self-contained without pulling Phase G (Approval) logic prematurely.

Rationale: Ponytail mode. The correct fix requires evaluating all requests in a plan
and selecting the dominant method — that logic belongs with the Approval module which
determines method authority. Defer to Phase G.

---

## 2026-07-03 — Phase H.5: LegalBasis named per RULE-09, not LegalReference

Decision: Named the structured legal citation type `LegalBasis` (not `LegalReference`).

Rationale: `LegalReference` already exists in `src/legal/legalSchema.ts` (frozen, 5 fields).
Creating a second `LegalReference` with 10 fields in `src/shared/financial/` would cause
import ambiguity for any module that imports both. RULE-09 already establishes `LegalBasis`
as the canonical term. `LegalBasis` in `financialFactory.ts` is the structured form.

---

## 2026-07-03 — Phase H.5: Money uses bigint

Decision: `Money.amount` is `bigint`, not `number` or `Decimal`.

Rationale: KI-004 documents IEEE 754 rounding for large VNĐ values. `bigint` is native,
requires no library, and is correct for all VNĐ amounts up to 9 quadrillion.
`Decimal` (prisma/decimal.js) would add a dependency and require wrapper types.
Bigint handles the domain correctly. Prisma schema migration (Float → Decimal) is deferred
to Infrastructure phase as KI-004 already notes.

---

## 2026-07-03 — Phase H.5: No repositories in shared/financial

Decision: `src/shared/financial/` has no repository interfaces.

Rationale: The financial domain is a pure value-object and pure-function layer.
It does not own persistence. The Payment module (Phase I) will own persistence for
BudgetAllocation, FundingCommitment, etc. Adding repos here would force
`IBaseRepository` imports and raise the question of which module seeds/owns the data.
Ponytail: avoid premature infrastructure before a concrete consumer exists.

---

## 2026-07-03 — Architecture Freeze H.5: RULE-09 violation fixed in paymentSchedule.ts

Decision: Changed `AdvanceRate.legalCitation: string` to `readonly legalBasis: LegalBasis`.
Updated `DEFAULT_ADVANCE_RATE` to use `createLegalBasis({ document: 'TT 79/2025/TT-BTC', article: 'Điều 15', ... })`.

Rationale: PRINCIPLE 8 and RULE-09 require structured LegalBasis — free-text citation strings are
not acceptable in domain types. Discovered during Architecture Freeze v1.1 verification.
No tests referenced `legalCitation`; fix was non-breaking (78/78 tests still pass).

---

## Earlier decisions

See git log and phase memory files in `C:\Users\ktapp\.claude\projects\E--Dau-Thau-Mau-Sam-Nam-2026\memory\`
for decisions from Phases 13–E (pre-freeze).

# Architecture Freeze History

Record of every freeze event. Frozen decisions are permanent.

---

## v1.0 — 2026-07-02 (Architecture Freeze Review at Phase E.5)

**Trigger:** Pre-freeze review before Document Generator (Phase V) to catch structural issues while cost of fixing is low.

**Score:** 7.5/10 — READY AFTER MINOR FIXES

**Fixes Applied:**
- R1: `IBaseRepository<T>` canonical location moved to `src/shared/repository/`
- R2: Domain type name collision resolved — `PackageType` → `ProcurementPackageKind`, `ProcurementMethod` → `ProcurementMethodCode`, `ApprovalAuthority` → `ApprovalAuthorityLevel`
- R3: Prisma index report documented in technical debt (deferred)
- R4: `PROJECT_CONSTITUTION.md` + 9 ADRs + `.memory/` + `coding-rules.md` created

**Modules Frozen at v1.0:**
Legal Foundation, Legal Domain Services, Legal Document Importer, Procurement Rule Engine, Workflow Engine, Master Data, Procurement Package, Procurement Planning

---

## v1.1 — 2026-07-03 (Post Phase I + Knowledge Architecture Freeze)

**Trigger:** Completion of core business platform (Phases A–I). Knowledge layer architecture specification.

**New Freezes:**
- Approval Module (Phase F)
- Contract Module (Phase G)
- Acceptance Module (Phase H)
- Shared Financial Domain (Phase H.5)
- Payment Module (Phase I)
- Knowledge Platform Architecture (Phase N — IKnowledgePlatform, 16 providers, 4 layers)
- Legal Reasoning Architecture (Phase N2 — ILegalReasoningEngine, 8-stage pipeline)
- AI Context Contract (Phase N3 — AIContext, ILLMAdapter, 4 adapters)

**Architecture Updates:**
- Confirmed `IBaseRepository<T>` is canonical and used by all modules
- `LegalBasis` named per RULE-09 in `src/shared/financial/`
- `Money.amount = bigint` confirmed for all financial domains
- Intelligence stack 3-layer boundary defined and frozen

**Known Violations at Freeze:**
- TD-01: `acceptanceService.ts` uses `string[]` for legal basis (frozen, tracked)
- TD-02: `procurementEngine.ts` hardcodes law symbol conditionals (frozen, tracked)
- TD-07: `buildPlanWorkflow` hardcodes OPEN_TENDER (accepted, tracked)

---

## Freeze Policy

1. Once frozen, a module's public API (exported types + service function signatures) is immutable.
2. Bug fixes to frozen modules require: new ADR + version bump.
3. New behavior for frozen modules requires: new Integration Bridge.
4. Architecture freeze events are recorded here with affected modules and known violations.
5. Violations discovered after freeze are tracked in `.memory/repository/debt.md`, not retroactively unfrozen.

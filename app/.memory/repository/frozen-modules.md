# Frozen Module Registry

The definitive list of all frozen modules, their freeze dates, and extension policies.
A frozen module's public API is immutable unless an ADR documents an exception.

---

## Currently Frozen (13 modules)

| Module | Directory | Frozen | Version | Tests | Extension Policy |
|--------|-----------|--------|---------|-------|-----------------|
| Legal Foundation | `src/legal/` | 2026-07-02 | v1.0 | ~156 | New domain functions in `domain/` OK; new repo interfaces need ADR |
| Legal Domain Services | `src/legal/domain/` | 2026-07-02 | v1.0 | ~78 | Add new functions; never change existing signatures |
| Legal Document Importer | `src/agents/` | 2026-07-02 | v1.0 | ~117 | New extractors in agents/; orchestrator sealed |
| Procurement Rule Engine | `src/procurement/rules/` + `application/` | 2026-07-02 | v1.0 | ~117 | New rules in `procurementRules.ts`; `procurementEngine.ts` sealed (6 capabilities) |
| Workflow Engine | `src/procurement/workflow/` | 2026-07-02 | v1.0 | ~156 | SEALED — 8 functions; new operations via bridge only |
| Master Data | `src/masterdata/` | 2026-07-02 | v1.0 | ~234 | New reference types via new entity + repo; `seedDefaultData()` extensible |
| Procurement Package | `src/procurement/package/` | 2026-07-02 | v1.0 | ~273 | Package service sealed; new operations via bridge |
| Procurement Planning | `src/procurement/planning/` | 2026-07-02 | v1.0 | ~312 | Planning service sealed |
| Approval Module | `src/approval/` | 2026-07-03 | v1.1 | 312 | Approval service sealed |
| Contract Module | `src/contract/` | 2026-07-03 | v1.1 | 312 | Contract service sealed |
| Acceptance Module | `src/acceptance/` | 2026-07-03 | v1.1 | 312 | Acceptance service sealed; TD-01 tracked |
| Shared Financial Domain | `src/shared/financial/` | 2026-07-03 | v1.1 | 312 | New value-object types OK; no new repos |
| Payment Module | `src/payment/` | 2026-07-03 | v1.1 | 355 | Payment service sealed; new rule types via `paymentRuleRegistry.ts` |

---

## Frozen Specs (Architecture Only)

| Spec | Frozen | Files | Implementation Phase |
|------|--------|-------|---------------------|
| Knowledge Platform V2 | 2026-07-03 | `knowledge/decisions/knowledge-platform-v2.md` | Phase N |
| Legal Reasoning Architecture | 2026-07-03 | `knowledge/decisions/reasoning-architecture.md` | Phase N |
| AI Context Contract | 2026-07-03 | `knowledge/decisions/ai-context-contract.md` | Phase N |
| Corpus Foundation | 2026-07-03 | `knowledge/decisions/corpus-foundation.md` | Phase N |

---

## What "Frozen" Means

1. Public exported functions: signatures never change
2. Public exported types: fields never removed; new optional fields OK with ADR
3. Test suite: 100% passing at freeze; no new failures permitted
4. No other module may import from this module except via an Integration Bridge
5. Bug fixes require: new ADR + version bump + regression test

---

## What "Frozen" Does NOT Mean

- Internal implementation can change (refactoring OK if tests pass)
- New private functions OK
- New optional fields on existing types OK (non-breaking)
- New data in registries (rule registries, seed data) always OK

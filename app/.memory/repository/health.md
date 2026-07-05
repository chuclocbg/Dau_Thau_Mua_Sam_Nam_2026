# Repository Health

Last updated: 2026-07-03 (Core Platform Review after Phase I)
Source: `.memory/repository-health.md` (superseded by this structured version)

---

## Test Suite

| Metric | Value |
|--------|-------|
| Total tests | ~12,254 |
| Passing | 100% |
| Framework | Vitest 4.x + jsdom |
| Module format | ESM (`"type": "module"`) |
| Known issue | jsdom crashes with 4+ test files parallel — run in pairs or `--pool=forks` |

---

## Frozen Module Count

13 modules FROZEN. See `.memory/modules/` for full details per module.

---

## Architecture Health

| Check | Result |
|-------|--------|
| Circular dependencies | 0 |
| Frozen module violations | 0 |
| Direct cross-module imports (bypassing Integration Bridge) | 0 |
| `IBaseRepository<T>` canonical | ✓ `src/shared/repository/IBaseRepository.ts` |
| `LegalBasis[]` compliance | 1 violation (TD-01, frozen) |
| Hardcoded law constants in business logic | 2 violations (TD-01, TD-02, frozen) |
| Hardcoded monetary constants | 0 |

---

## Production Readiness Score

| Dimension | Score | Notes |
|-----------|-------|-------|
| Module Completeness | 5/10 | 13 of ~22 modules done |
| Legal Architecture | 7/10 | 2 violations (frozen) |
| Test Coverage | 9/10 | 100% pass; no coverage metrics |
| Architecture Purity | 9/10 | Clean dependency graph |
| Data Integrity | 7/10 | TD-05 Prisma Float issue |
| Error Handling | 8/10 | Domain validation solid; HTTP boundary missing |
| Observability | 2/10 | No logging, no metrics |
| Security | 1/10 | No auth, no input validation |
| Performance | 4/10 | No caching, no pagination |
| Documentation | 8/10 | Strong architecture docs |
| Deployment Readiness | 1/10 | No Prisma, no auth |
| **Overall** | **5.5/10** | Ready after Phases J–M |

---

## Phase-by-Phase Test Counts

| Module | Tests |
|--------|-------|
| Legal Foundation | ~156 |
| Legal Domain Services | ~78 |
| Legal Document Importer (agents) | ~117 |
| Procurement Rule Engine | ~117 |
| Workflow Engine | ~156 |
| Master Data | ~234 |
| Procurement Package | ~273 |
| Procurement Planning | ~312 |
| Approval Module | 312 |
| Contract Module | 312 |
| Acceptance Module | 312 |
| Shared Financial Domain | 312 |
| Payment Module | 355 |
| **Total** | **~12,254** |

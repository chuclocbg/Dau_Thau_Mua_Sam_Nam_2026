# Technical Debt Register

Last updated: 2026-07-05 (corrected TD-04/TD-05 status after Phase M1; reviewed during the Phase N
Release Candidate audit — no item below was introduced or resolved by Phase N itself)

---

## CRITICAL (block production deployment)

**TD-01** — `acceptanceService.ts:11-17` — `DEFAULT_LEGAL_BASIS: string[]`
- Hardcodes 5 specific law strings as plain strings (not `LegalBasis[]`)
- Violates RULE-09 (structured legal citations required)
- Also applies `TT 13/2026/TT-BCT` (GOODS-only circular) to all acceptance types
- Module is FROZEN — fix requires unfreezing acceptance or adding a bridge-layer correction
- Fix: replace with `PROCUREMENT_LEGAL_BASIS` from `shared/financial/financialFactory.ts`

**TD-02** — `procurementEngine.ts:215-217` — law-symbol conditionals in `resolveLegalDocuments()`
- Business logic hardcodes `d.symbol === '13/2026/TT-BCT'` and `d.symbol === '79/2025/TT-BTC'`
- New circular replacing TT-BCT will not have applicability rules — silent miss
- Module is FROZEN
- Fix: add `applicableTo?: { packageTypes?: string[], fundSources?: string[] }` to `DOCUMENT_APPLICABILITY` entries; remove inline conditionals

**TD-03** — No authentication/authorization layer
- Every service function is open to any caller
- Cannot deploy to production without authN/authZ

**TD-04** — Prisma repositories implemented but never verified against a live database (UPDATED
2026-07-05, was "spec-only stubs")
- Phase M1 (2026-07-05) replaced all stub `prisma*.ts` files with real implementations — 67
  repository classes across 11 modules, real migration SQL generated
- Downgraded from CRITICAL toward HIGH in spirit, but kept here until actually verified: no
  migration has ever run against Postgres, no query has ever executed (no Docker in this
  environment) — see `docs/prisma-production.md`
- Production requires running the M0 Docker stack and executing the M0/M1 verification checklist

---

## HIGH (fix before public beta)

**TD-05** — RESOLVED 2026-07-05 (Phase M1) — `Money(bigint)` ↔ Prisma `Float` mismatch (KI-004)
- Was: all monetary fields in Prisma schema used `Float`
- Fix applied: every genuinely monetary field → `Decimal(18,2)` (9 fields, MasterData/Planning);
  Payment's `Money{amount:bigint}` (ADR-004) deliberately maps to `BigInt`, not `Decimal` — more
  precise, documented in `docs/prisma-production.md`
- Kept here (not moved to known-issues.md RESOLVED section) because the fix itself is PENDING
  PRODUCTION VERIFICATION along with the rest of Phase M1 — schema-level correctness is confirmed
  by `prisma validate` but not yet by a live query

**TD-06** — No input validation at HTTP boundary
- Services validate business rules; no HTTP-layer schema validation (Zod, etc.)
- Missing boundary protection against injection attacks

**TD-07** — `buildPlanWorkflow` hardcodes `OPEN_TENDER` (KI-001)
- Documented in decision-log.md; correct default but wrong for non-OPEN_TENDER packages
- Fix: derive from method selection in Planning/Approval integration

**TD-08** — `IBaseRepository.findAll()` has no pagination
- Memory repos return all records; will OOM at 10,000+ entities in production

---

## MEDIUM (fix before scale)

**TD-09** — No transaction support in repositories
- Multi-repo operations are not atomic; partial failure leaves inconsistent state

**TD-10** — No caching in business modules
- Legal rule resolution re-evaluates full rule list on every call

**TD-11** — No soft delete in any module
- `delete()` is permanent; audit requirements typically mandate soft delete

**TD-12** — `buildPaymentLegalBasisFromAcceptance` unguarded null crash
- Throws `TypeError` when `acceptance.legalBasis` is `undefined`
- `src/payment/paymentIntegration.ts` — add null guard

---

## LOW (housekeeping)

**TD-13** — jsdom worker crash with 4+ test files (pre-existing)
- Run tests in pairs as workaround

**TD-14** — No production seed script beyond masterdata
- `seedDefaultData()` exists for masterdata; no equivalent for other modules

**TD-15** — `workflowState.ts` law shorthand constants (L, D, D2, F, T)
- Adding a 6th law requires modifying this frozen file
- Low risk until law corpus grows

---

## DEFERRED (docs/Backlog.md)

- PDF binary extraction (pdfjs-dist)
- DOCX table preservation
- Scanned PDF clause detection
- Full-text search (PostgreSQL tsvector)
- LegalVersion event sourcing

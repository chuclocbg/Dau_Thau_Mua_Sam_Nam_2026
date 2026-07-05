# START HERE — Project Recovery Guide

> A new Claude session can recover the entire project in under 5 minutes
> by reading this file plus the four index files listed in Section 6.

---

## 1. What Is This Project?

An AI-assisted public procurement platform for Vietnamese educational institutions.
It enforces Luật Đấu thầu 22/2023/QH15 and related decrees automatically,
replacing manual paperwork with a structured digital workflow from planning → payment.

**Tech stack:** TypeScript · ESM (`"type": "module"`) · Vitest 4.x · jsdom · Hexagonal architecture

---

## 2. Current Status (as of 2026-07-05)

| Metric | Value |
|--------|-------|
| Business modules (FROZEN) | 13 |
| Infrastructure modules (FROZEN) | 3 (Auth, Storage, Notification) |
| Infrastructure config (COMPLETE, unverified) | M0 — `docker-compose.yml` (Postgres/pgAdmin/Redis/MinIO) |
| Prisma production layer | M1 — IMPLEMENTED, PENDING PRODUCTION VERIFICATION (82 models, 67 repo classes — see `docs/prisma-production.md`) |
| Knowledge Platform | **N — FROZEN.** 16/16 providers built (Stage 1+2, Batches 1-4). See `docs/knowledge-platform.md` |
| Total tests | 13,721 (100% passing, 395 test files) |
| Production readiness | 6.2/10 (re-scored 2026-07-05 after Phase N freeze — see `.memory/repository-health.md`) |
| Architecture | v1.9 |
| Current Milestone | **Knowledge Platform v1.0** (Release Candidate audit passed 2026-07-05) |
| Next Planned Milestone | **Phase X Architecture Design** — NOT started, pending explicit approval |

---

## 3. Five Rules You Must Never Break

1. **No frozen module is ever modified.** New functionality = Integration bridge (`*Integration.ts`).
2. **Money is `bigint`.** Never `number`, never `Decimal`. `Money { amount: bigint, currency: CurrencyCode }`.
3. **Legal citations are `LegalBasis[]`.** Never `string[]`. RULE-09 is absolute.
4. **Domain string = open string.** Never enum in Knowledge Platform. `domain: string`.
5. **AI never calls repositories.** The AI layer only receives a frozen `AIContext` object.

Full rules: `.memory/architecture/hexagonal-rules.md`

---

## 4. Architecture in 60 Seconds

```
HTTP Request
     │
     ▼
[Interface / API Layer]  src/procurement/api/, src/interface/
     │
     ▼
[Application Layer]      src/procurement/application/, src/application/
     │
     ▼
[Domain Layer]           src/legal/domain/, src/procurement/domain/  ← pure functions
     │
     ▼
[Repository Interfaces]  src/shared/repository/IBaseRepository.ts   ← no Prisma here
     │
     ├─→ [Memory Repos]  *memory*.ts   (tests, dev)
     └─→ [Prisma Repos]  *prisma*.ts   (production — stub until Phase M)
```

**Future intelligence stack (Phases N→X):**
```
Knowledge Platform (IKnowledgePlatform)
     ↓
Reasoning Layer (ILegalReasoningEngine → ReasoningResult)
     ↓
AI Context Layer (AIContextBuilder → AIContext)
     ↓
LLM Adapter (ILLMAdapter → LLMResponse)
```

Full diagram: `.memory/architecture/layer-stack.md`

---

## 5. Module List (FROZEN)

| Module | Location | Tests |
|--------|----------|-------|
| Legal Foundation | `src/legal/` | ~156 |
| Legal Domain Services | `src/legal/domain/` | ~78 |
| Legal Document Importer | `src/agents/` | ~117 |
| Procurement Rule Engine | `src/procurement/rules/` + `application/` | ~117 |
| Workflow Engine | `src/procurement/workflow/` | ~156 |
| Master Data | `src/masterdata/` | ~234 |
| Procurement Package | `src/procurement/package/` | ~273 |
| Procurement Planning | `src/procurement/planning/` | ~312 |
| Approval Module | `src/approval/` | 312 |
| Contract Module | `src/contract/` | 312 |
| Acceptance Module | `src/acceptance/` | 312 |
| Shared Financial Domain | `src/shared/financial/` | 312 |
| Payment Module | `src/payment/` | 355 |
| Auth Module (infra) | `src/auth/` | ~265 |
| Storage Module (infra) | `src/storage/` | 232 |
| Notification Module (infra) | `src/notification/` | 276 |

Full module details: `.memory/module-index.md` + `.memory/modules/`

---

## 6. Recovery Reading Order (5 minutes)

Read in this order. Stop when you have enough context for your task.

```
1. This file (start-here.md)                    — 60 seconds
2. .memory/next-task.md                         — what to build next
3. .memory/module-index.md                      — all module statuses
4. .memory/architecture-index.md                — architecture overview
5. .memory/decision-index.md                    — key architectural decisions
6. .memory/integration-index.md                 — how modules connect
```

For deep dives:
- **Building a new module?** → `.memory/modules/<name>.md` for each dependency
- **Architecture question?** → `.memory/architecture/`
- **Legal rule question?** → `.memory/legal/governing-instruments.md`
- **Knowledge platform?** → `.memory/knowledge/platform.md`
- **Technical debt?** → `.memory/repository/debt.md`
- **What was decided and why?** → `.memory/decisions/`

---

## 7. What Is NEXT

See `.memory/next-task.md` — always the canonical source for current task.

Phase M1 (Production Prisma Layer) is IMPLEMENTED but PENDING PRODUCTION VERIFICATION — per the
user's "Implementation First, Production Verification Later" policy, it was built in full
without waiting for Docker. Do not call it VERIFIED or FROZEN until the `docs/infrastructure.md`
first-run checklist (M0) has actually been executed and `npx prisma migrate deploy` has actually
run against a live Postgres.

**Phase N (Knowledge Platform) is now FROZEN — 16/16 providers, 336 tests, zero regressions.**
A full Architecture Audit and Release Candidate review was performed 2026-07-05 (recommendation:
GO WITH NOTES — see `.memory/repository-health.md` for the full readiness scorecard). **Next
Planned Milestone is Phase X (AI Advisory Layer) Architecture Design — NOT started, pending
explicit approval.** Do not write Phase X code without it.

Critical path: **M0 (unverified) → M1 (implemented, unverified) → N (FROZEN) → O → P → ...**
(J Auth, K Storage, L Notification are all FROZEN). Phase X was named the next milestone by
explicit user instruction, ahead of its own literal dependency order (O-W); see
`.memory/roadmap-index.md` for the caveat.

Full roadmap: `.memory/roadmap-index.md`

---

## 8. Critical Constraints (non-obvious)

- **Knowledge Platform domain is open string.** Registering a new knowledge domain requires calling `registerProvider()` only — zero code changes.
- **Layer 3 (School Policy) can be MORE restrictive** than national law. The conflict resolver enforces `MORE_RESTRICTIVE` before `LEX_POSTERIOR`.
- **Reasoning Layer is the ONLY caller of `IKnowledgePlatform`** (via `KnowledgeResolver` stage only). No other code calls the knowledge platform directly.
- **All monetary rules are data, not code.** `procurementRules.ts` and `paymentRuleRegistry.ts` are data registries — not logic files.
- **The Prisma layer is stubs only.** Do NOT wire Prisma until Phase M. All services use memory repos until then.
- **jsdom crashes with 4+ test files in parallel.** Run vitest with `--pool=forks` or test files in pairs.

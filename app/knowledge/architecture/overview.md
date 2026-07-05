# Platform Architecture Overview

Version: 2.0 — updated 2026-07-03 (Infrastructure + Knowledge Engine planning)

---

## Layer Stack

```
┌──────────────────────────────────────────────────┐
│  External Integration Layer                       │
│  Phase X — Public Portal (ĐTMUA/eBid)            │
│  Phase W — AI Advisory Layer                      │
└──────────────────┬───────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────┐
│  Platform Services Layer                          │
│  Phase U — Document Generator                    │
│  Phase V — Dashboard & Reporting                 │
└──────────────────┬───────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────┐
│  Business Execution Layer (Phases N–T)           │
│  Supplier → Tender → Bid → Evaluation → Award    │
│  → Performance → Settlement                      │
└──────────────────┬───────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────┐
│  Business Foundation Layer (Phases A–I) FROZEN   │
│  Legal → MasterData → Workflow → Package         │
│  → Planning → Approval → Contract                │
│  → Acceptance → SharedFinancial → Payment        │
└──────────────────┬───────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────┐
│  Knowledge Layer (Phase N)                       │
│  Legal Knowledge Engine                          │
│  Amendment Chains · Citation Graph · Ontology    │
│  Effective Law Resolver · Semantic Search        │
│  AI Retrieval Interfaces                         │
└──────────────────┬───────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────┐
│  Infrastructure Layer (Phases J–M)               │
│  Auth & Authorization (J)                        │
│  Storage & Attachment (K)                        │
│  Notification Service (L)                        │
│  Production Prisma Layer (M)                     │
└──────────────────┬───────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────┐
│  Data Layer                                      │
│  PostgreSQL + pgvector                           │
│  Redis (session cache)                           │
│  File Storage (Local/S3/Azure)                   │
└──────────────────────────────────────────────────┘
```

---

## Module Map (current — Phases A–I frozen)

```
src/
├── shared/
│   ├── repository/IBaseRepository.ts    ← canonical base repo
│   └── financial/                       ← Money, LegalBasis, PaymentSchedule (FROZEN)
│
├── legal/                               ← schema + repos + 10 domain services (FROZEN)
│
├── masterdata/                          ← 10 entity types, seedDefaultData() (FROZEN)
│
├── procurement/
│   ├── domain/procurementTypes.ts       ← string unions (FROZEN)
│   ├── rules/procurementRules.ts        ← rule data (FROZEN)
│   ├── application/procurementEngine.ts ← 6-capability engine (FROZEN)
│   ├── workflow/                        ← 17-state lifecycle (FROZEN)
│   ├── package/                         ← ProcurementPackage (FROZEN)
│   └── planning/                        ← ProcurementPlan + Requests (FROZEN)
│
├── approval/                            ← ApprovalRequest lifecycle (FROZEN)
├── contract/                            ← Contract state machine (FROZEN)
├── acceptance/                          ← AcceptanceRequest + committee (FROZEN)
└── payment/                             ← PaymentRequest + treasury (FROZEN)
```

---

## Build Order (full platform)

```
Phase J  Auth & Authorization          [INFRA]
Phase K  Storage & Attachment          [INFRA]
Phase L  Notification Service          [INFRA]
Phase M  Production Prisma Layer       [INFRA]
Phase N  Legal Knowledge Engine        [KNOWLEDGE]
Phase O  Supplier Registry             [BUSINESS]
Phase P  Tender Announcement           [BUSINESS]
Phase Q  Bid Submission                [BUSINESS]
Phase R  Bid Opening & Evaluation      [BUSINESS]
Phase S  Contractor Selection & Award  [BUSINESS]
Phase T  Contract Performance          [BUSINESS]
Phase U  Final Settlement              [BUSINESS]
Phase V  Document Generator            [PLATFORM]
Phase W  Dashboard & Reporting         [PLATFORM]
Phase X  AI Advisory Layer             [PLATFORM]
Phase Y  Public Portal Integration     [EXTERNAL]
```

---

## Dependency Rules

1. No reverse imports — newer modules never imported by frozen modules.
2. Cross-module boundary = `*Integration.ts` file ONLY.
3. Auth enforcement at API/adapter layer — frozen service signatures unchanged.
4. New modules (Phase O+) accept `AuthContext` as first parameter.
5. All legal references use `LegalBasis[]` not `string[]`.
6. All monetary values use `Money { amount: bigint, currency: CurrencyCode }`.
7. No hardcoded law document symbols in business logic conditionals.
8. Legal Knowledge Engine is the single source of truth for applicable law resolution.

---

## Frozen Module Extension Points

| Frozen Module | Known Extension Mechanism |
|---------------|--------------------------|
| acceptanceService.ts | Future v2 module replaces string[] with LegalBasis[] |
| procurementEngine.ts | effectiveLawResolver (Phase N) replaces resolveLegalDocuments() |
| approval (all) | Auth enforcement via API gateway wrapper |
| payment (all) | paymentIntegration.ts bridge for new modules |

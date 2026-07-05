# Layer Stack

Version: 1.1 | Frozen: 2026-07-02

---

## Business Layer Stack (Phases A–I, FROZEN)

```
┌─────────────────────────────────────────────────────────────┐
│  Interface / API Layer                                        │
│  src/procurement/api/procurementApi.ts                        │
│  src/interface/                                               │
│  Pure functions. No HTTP framework. No side effects.          │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  Application Layer                                            │
│  src/procurement/application/procurementEngine.ts             │
│  src/application/                                             │
│  Orchestrates domain services. Calls repo interfaces.         │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  Domain Layer                                                 │
│  src/legal/domain/                                            │
│  src/procurement/domain/procurementTypes.ts                   │
│  src/*/...Types.ts                                            │
│  Pure functions. No imports from upper layers. No Prisma.     │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  Repository Interface Layer                                   │
│  src/shared/repository/IBaseRepository.ts                     │
│  src/*/...Repository.ts                                       │
│  Services depend on interfaces. Never on implementations.     │
└────────────┬───────────────────────────────────┬────────────┘
             │                                   │
┌────────────▼────────────┐         ┌────────────▼───────────┐
│  Memory Repositories    │         │  Prisma Repositories   │
│  *memory*.ts            │         │  *prisma*.ts           │
│  Used in tests + dev    │         │  Production (Phase M)  │
│  In-memory Map storage  │         │  Stub until Phase M    │
└─────────────────────────┘         └────────────┬───────────┘
                                                  │
                                    ┌─────────────▼──────────┐
                                    │  PostgreSQL             │
                                    │  prisma/schema.prisma   │
                                    └────────────────────────┘
```

---

## Intelligence Stack (Phases N–X, SPEC FROZEN, IMPLEMENTATION PENDING)

```
┌──────────────────────────────────────────────────────────────┐
│  Knowledge Platform                                           │
│  src/knowledge/  (Phase N — after Phase M)                    │
│  IKnowledgePlatform — 14 methods                              │
│  16 providers across 4 layers                                 │
│  domain = open string (never enum)                            │
│  RETRIEVES knowledge. NEVER reasons.                          │
└──────────────────────┬───────────────────────────────────────┘
                       │ called ONLY from KnowledgeResolver stage
┌──────────────────────▼───────────────────────────────────────┐
│  Reasoning Layer                                              │
│  src/reasoning/  (Phase N — same implementation phase)        │
│  ILegalReasoningEngine — 2 methods: reason(), explain()       │
│  8-stage pipeline                                             │
│  DECIDES which knowledge applies. NEVER stores.               │
└──────────────────────┬───────────────────────────────────────┘
                       │ ReasoningResult → AIContextBuilder
┌──────────────────────▼───────────────────────────────────────┐
│  AI Context Layer                                             │
│  src/ai/  (Phase N — same implementation phase)               │
│  AIContextBuilder → AIContext (frozen, read-only)             │
│  ILLMAdapter — 4 implementations (Claude/OpenAI/Gemini/Local) │
│  TRANSFORMS structured reasoning into LLM-ready context.     │
└──────────────────────┬───────────────────────────────────────┘
                       │ AIContext only (never ReasoningResult or KnowledgeItem)
┌──────────────────────▼───────────────────────────────────────┐
│  AI Advisory Layer                                            │
│  src/advisory/  (Phase X — last)                              │
│  Multi-turn conversation management                           │
│  May only import: IAIContextBuilder, ILLMAdapter, AIContext   │
│  NEVER imports: src/reasoning/, src/knowledge/, src/*/repos   │
└──────────────────────────────────────────────────────────────┘
```

---

## Cross-Cutting Concerns

```
Authentication (Phase J):
  Enforced at API/Interface layer BEFORE service calls.
  Frozen module service signatures are UNCHANGED.
  New modules (Phase N+) accept AuthContext as first parameter.

Storage (Phase K):
  Attachment entity crosses all modules via Attachment.entityType + entityId.
  No module owns Attachment directly — storage is a shared service.

Notifications (Phase L):
  Triggered by integration layer. Frozen modules emit domain events via bridge.
  New modules emit DomainEvent objects; NotificationTrigger subscribes.

Prisma (Phase M):
  All 12 business modules + Auth + Storage + Notification get real DB.
  Memory repos continue to exist for tests.
```

# Domain Layer — Phase A

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         API / Application Layer                     │
│              (LegalReasoningService, ProcurementService, ...)       │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ orchestrates
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         DOMAIN LAYER                                │
│                   src/legal/domain/                                 │
│                                                                     │
│  legalDomainTypes.ts                                                │
│    DOC_HIERARCHY_LEVEL · docTypeToLevel · isHigherAuthority         │
│    LegalStatus · ConflictRule · ConflictResolution                  │
│    ApplicabilityContext · ApplicabilityResult                       │
│    ProcurementRule · ThresholdBand · CitationTarget                 │
│                                                                     │
│  legalDomainServices.ts             legalCrossServices.ts           │
│    determineApplicableLaw()           buildCitation()               │
│    resolveEffectiveDocument()         findCrossReferences()         │
│    resolveAmendmentChain()            determineProcurementRule()    │
│    resolveHierarchyConflict()         resolveThresholdRule()        │
│    determineApplicability()                                         │
│    resolveLegalStatus()                                             │
└──────┬────────────────────────────────────────────────────┬─────────┘
       │ inject                                              │ inject
       ▼                                                     ▼
┌──────────────────────────┐             ┌───────────────────────────┐
│   REPOSITORY LAYER       │             │   REPOSITORY LAYER        │
│   (interfaces only)      │             │   (interfaces only)       │
│                          │             │                           │
│  IEffectivePeriodRepo    │             │  ILegalDocumentRepo       │
│  IAmendmentRepository    │             │  ICitationRepository      │
│  IArticleRepository      │             │  IKeywordRepository       │
└──────┬───────────────────┘             └──────┬────────────────────┘
       │ implemented by                          │ implemented by
       ▼                                         ▼
  Memory (tests)                            Memory (tests)
  Prisma  (prod)                            Prisma  (prod)
```

**Call flow example** — resolve a document's legal status:

```
LegalReasoningService.getStatus(docId, date)
  └─ resolveLegalStatus(docId, date, periodRepo, amendRepo)
       ├─ resolveEffectiveDocument(docId, date, periodRepo)    ← domain fn
       │    └─ periodRepo.resolveEffectivePeriod(...)          ← CRUD only
       └─ amendRepo.listAmendments(docId)                      ← CRUD only
```

---

## Migration Guide

Moving business logic from repositories to domain services:

1. **Identify logic in repositories.**
   Any repository method that does more than read/write data (sorting by legal
   hierarchy, checking amendment chains, computing effective dates) belongs in
   a domain service.

2. **Extract to a pure function first.**
   Move the logic into `legalDomainServices.ts` or `legalCrossServices.ts` as
   a plain function. If it needs no I/O it stays pure.

3. **Inject the repository interface.**
   If the function needs data from storage, add the repository interface as a
   parameter (`periodRepo: IEffectivePeriodRepository`). Never import a
   concrete class (`MemoryEffectivePeriodRepository`) in a domain file.

4. **Update the service (orchestration) layer.**
   The service layer calls the domain function and passes the injected repo.
   Services do not contain legal reasoning — only sequencing.

5. **Update tests.**
   Domain function tests use `MemoryXxxRepository` passed as arguments.
   Repository tests only test CRUD (no legal reasoning scenarios).

6. **Check the boundary.**
   Run `grep -r "Memory.*Repository" src/legal/domain` — must return nothing.
   Run `grep -r "Prisma.*Repository" src/legal/domain` — must return nothing.

---

## Acceptance Criteria

- [ ] `src/legal/domain/` contains exactly 3 files: `legalDomainTypes.ts`,
      `legalDomainServices.ts`, `legalCrossServices.ts`.

- [ ] All 10 domain services are exported and callable as standalone functions.

- [ ] No domain file imports a concrete repository class (`Memory*` or `Prisma*`).
      Only repository interfaces (`I*Repository`) may be imported.

- [ ] All domain services that depend on repositories accept them as function
      parameters (dependency injection by argument, not module-level state).

- [ ] Pure functions (no I/O) are synchronous. Functions that need repository
      data are `async` with injected interfaces.

- [ ] 117 new tests pass covering: hierarchy constants, all 6 domain services,
      all 4 cross-domain services. Existing 9442 tests continue to pass.

- [ ] `resolveHierarchyConflict` returns HIERARCHY rule when types differ,
      LEX_POSTERIOR when same type but different dates, PRIORITY otherwise.

- [ ] `determineProcurementRule` and `resolveThresholdRule` accept config as
      parameters — no hardcoded thresholds inside the functions.

- [ ] `buildCitation` produces Vietnamese citation order:
      `điểm X khoản N Điều M SYMBOL`.

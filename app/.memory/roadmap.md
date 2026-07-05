# Platform Roadmap

---

## Completed

- [x] Legal Foundation (schema, repositories, domain services)
- [x] Procurement Rule Engine (6 capabilities, 5 legal instruments)
- [x] Workflow Engine (17-state lifecycle, sealed)
- [x] Master Data Module (10 entity types)
- [x] Procurement Package (aggregate root, 5 repositories)
- [x] Procurement Planning (7 entities, plan lifecycle)
- [x] Architecture Freeze (shared base, type names, constitution, ADRs)

---

## Remaining Business Modules

| Phase | Module | Dependency |
|-------|--------|------------|
| F | Document Generator | Planning + Package + Legal + MasterData (read-only) |
| G | Approval Module | Package + Workflow + MasterData |
| H | Contract Module | Package + Planning + Workflow |
| I | Acceptance Module | Contract + Workflow |
| J | Payment Module | Contract + Acceptance + MasterData |
| K | Asset Module | Package + Contract + MasterData |
| L | Dashboard + Reporting | All modules (read-only aggregation) |
| M | AI Advisory Layer | All modules (read-only + suggestion only) |

---

## Infrastructure (deferred — tracked in docs/Backlog.md)

- PostgreSQL wiring (DATABASE_URL + npx prisma migrate dev)
- Prisma indexes from docs/prisma-index-review.md
- REST HTTP server mounting
- Authentication / authorization layer
- File storage for attachments

---

## Known Risks Before Document Generator

1. `buildPlanWorkflow` hardcodes OPEN_TENDER — must derive from dominant request before Phase G (Contract).
2. `ProcurementRequest.legalBasis` is a free-text string, not a `LegalBasis` struct — will limit Document Generator's citation output.
3. Prisma `String[]` arrays for requestIds/planIds — no FK constraint, no individual-element indexing.
4. Float monetary fields — recommend `Decimal` before first production migration.

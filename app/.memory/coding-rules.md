# Coding Rules

Mandatory for all code in this repository.
Violations must be corrected before merge.

---

## Architecture Rules

**RULE-01: No Domain → Prisma**
Domain types (`*Types.ts`, `*Schema.ts`) must never import `@prisma/client`.
Prisma belongs only in `*prisma*.ts` infrastructure files.
_Why: Domain layer must be testable without a database._

**RULE-02: No SQL outside Infrastructure**
Raw SQL queries and Prisma model access belong only in `*prisma*.ts` files.
Services use repository interfaces exclusively.
_Why: Swapping storage (memory → Prisma → other) must not require service changes._

**RULE-03: No Workflow bypass**
State transitions go through `workflowEngine.advance()` only.
No module may write directly to `WorkflowInstance.currentState`.
_Why: Workflow owns state (ADR-003). Bypassing it breaks the audit trail._

**RULE-04: No Legal bypass**
Method selection, approval authority, and threshold determination flow through
`ProcurementEngine.evaluate()` only. No module re-implements procurement law logic.
_Why: Legal Engine is the single authority (ADR-005, Principle 1)._

**RULE-05: Repository interfaces only in services**
Service functions accept repository interfaces (e.g. `IProcurementPackageRepository`),
never concrete classes (e.g. `MemoryPackageBaseRepository`).
_Why: Testability and swappable infrastructure._

**RULE-06: Immutable history**
`approvalHistory[]`, `WorkflowHistory.entries[]`, audit records — append-only.
No record is deleted or modified after creation.
_Why: Legal requirement. History is evidence (Principle 3, ADR-008)._

**RULE-07: Pure domain services**
Functions in `*Service.ts` and `*Validation.ts` are stateless.
No module-level mutable variables. No singletons with mutable state in services.
_Why: Predictability and testability._

**RULE-08: IBaseRepository from shared**
All repository interfaces extend `IBaseRepository` from `src/shared/repository/IBaseRepository.ts`.
Never duplicate the base interface in a module-local file.
_Why: Single definition prevents divergence across 100+ future entity types._

**RULE-09: LegalBasis is structured**
Legal citations use `LegalBasis { document: string, article: string }`.
Free-text strings like `"Điều 22 Luật 22/2023"` are not acceptable in domain types.
_Why: Document Generator needs structured citations. Strings cannot be validated._

**RULE-10: Master Data codes are opaque strings at call sites**
No service hardcodes a reference code (`'PHONG-TC'`, `'STATE'`, `'GOODS'`) that
belongs in Master Data. Codes are looked up at runtime.
Exception: test fixtures and `seedDefaultData()` may use hardcoded codes.
_Why: Master Data owns reference values (ADR-009, Principle 6)._

**RULE-11: Integration bridges are one-way**
`*Integration.ts` files import from frozen modules; frozen modules never import back.
Verify before adding any import to a frozen module's file.
_Why: Circular dependencies cause runtime import failures in ESM._

**RULE-12: No hardcoded procurement thresholds in service logic**
Threshold values (50M, 200M, 2B etc.) live in `procurementRules.ts` rule definitions.
Services call `ProcurementEngine.evaluate()` and read the result.
_Why: Decrees change thresholds. One update location (rules) must cascade everywhere._

**RULE-13: No hardcoded law article strings in service logic**
Law citations (`'22/2023/QH15'`, `'Điều 22'`) live in rule definitions or
`LegalBasis` structs. Never appear as string literals in service conditionals.
_Why: When a decree is superseded, citation strings in service code become wrong._

**RULE-14: No business logic inside API adapters**
`*Api.ts` files validate input shape and delegate to services.
They contain no procurement rules, no state transitions, no domain decisions.
_Why: API adapters are infrastructure; business logic lives in services and engines._

**RULE-15: No duplicated validation**
Validation that exists in `*Validation.ts` is not repeated in services or integration files.
Services call validation functions; they do not re-implement checks inline.
_Why: Duplicated validation diverges. One place to fix a rule means one place to update._

**RULE-16: No AI dependency inside domain**
Domain services (`*Service.ts`, `*Validation.ts`, `*Engine.ts`) have no dependency
on language models, embeddings, or external AI APIs.
AI components live in `src/ai/` and are consumers of domain services, not vice versa.
_Why: Domain correctness must be deterministic and testable without AI infrastructure._

---

## Naming Conventions

| Concept | Convention | Example |
|---------|-----------|---------|
| Create entity | `createX()` | `createPackage()` |
| Update entity | `updateX()` | `updatePackage()` |
| Approve | `approveX()` | `approveRequest()` |
| Archive | `archiveX()` | `archivePackage()` |
| Generate document / plan | `generateX()` | `generateProcurementPlan()` |
| Build integration artifact | `buildX()` | `buildPlanWorkflow()` |
| Calculate derived value | `calculateX()` | `calculateFunding()` |
| Resolve reference | `resolveX()` | `resolveApprovalAuthorityLimit()` |
| Validate | `validateX()` | `validatePlanAgainstMasterData()` |
| Domain error class | `XError` | `PackageError`, `PlanningError` |
| Repository bag | `XRepositories` | `PackageRepositories`, `PlanningRepositories` |
| Memory implementation | `MemoryX` | `MemoryPackageBaseRepository` |

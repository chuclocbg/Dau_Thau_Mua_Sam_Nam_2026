# Coding Rules

**Purpose:** Concrete, checkable coding conventions actually in force in this repository —
distinct from [`ARCHITECTURE_CONSTRAINTS.md`](ARCHITECTURE_CONSTRAINTS.md) (structural rules)
and [`DDD_RULES.md`](DDD_RULES.md) (domain-modeling rules).

**Status:** Derived from observed, consistent practice across Phases A-N — not aspirational.

## Machine Context

```yaml
as_of: 2026-07-05
status: CURRENT
related: [ARCHITECTURE_CONSTRAINTS.md, DDD_RULES.md, ../01_PROJECT_DOCS/DEVELOPMENT_GUIDE.md]

conventions:
  language: TypeScript
  module_system: "ESM only (\"type\": \"module\" in package.json) — no CommonJS require()"
  import_style: "relative imports with explicit .ts extensions inside src/ (e.g. './knowledgeTypes.ts')"
  naming:
    memory_repository: "memory<Module>Repositories.ts"
    prisma_repository: "prisma<Module>Repositories.ts"
    integration_bridge: "<module>Integration.ts"
    types_file: "<module>Types.ts"
  comments: "no comments explaining WHAT code does (names should do that); comments only for
             non-obvious WHY (hidden constraints, workarounds, invariants)"
  test_location: "src/__tests__/ — NOT src/tests/ (a different, pre-existing, unrelated
                  directory from an earlier commit track, see REPOSITORY_CONTEXT.md)"
  test_naming: "<module>-<concern>.test.ts, e.g. knowledge-platform-vendor-provider.test.ts"

known_gaps_not_yet_fixed:
  - "ESLint has never been a merge gate: 470 pre-existing repo-wide lint problems, mostly
     no-unused-vars on intentionally-unused `_context` parameters lacking an
     argsIgnorePattern: '^_' override in the ESLint config"
  - "No dependency-cruiser or madge installed — circular-dependency claims in this project's
     memory are verified by manual grep, not an automated tool"

verification_gate_actually_used:
  - "npx tsc --noEmit -p ." 
  - "npx vitest run --pool=forks --reporter=dot"
  - "NOT eslint — do not assume a clean ESLint run means anything about this codebase's history"
```

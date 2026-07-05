# Dependency Rules

**Purpose:** Exactly what may import what. Violating any of these is an architecture defect,
not a style preference.

## Machine Context

```yaml
as_of: 2026-07-05
status: CURRENT
related: [ARCHITECTURE_CONSTRAINTS.md, FREEZE_STATUS.md, ../01_PROJECT_DOCS/TECHNICAL_ARCHITECTURE.md]

layer_order: "Interface -> Application -> Domain -> Repository Interfaces -> Memory|Prisma Repositories"

rules:
  - "A frozen business module NEVER imports another business module directly — cross-module
     access goes through a *Integration.ts bridge file, one-way only"
  - "Repository interfaces (src/shared/repository/IBaseRepository.ts) have NO Prisma import —
     Prisma appears only in prisma<Module>Repositories.ts implementation files"
  - "src/knowledge/platform|graph|search|repositories|application/ NEVER import from
     src/knowledge/providers/ (core never depends on extensions) — verified by grep, zero
     violations found across all 16 providers"
  - "Every one of the 16 Knowledge Platform providers imports ONLY from:
     ../../platform, ../../repositories, ../../graph, ../../search, ../baseProvider —
     zero cross-provider imports"
  - "No business/infra module imports anything under src/knowledge/platform|graph|search|
     repositories|application|providers/ — Knowledge Platform has zero consumers yet
     (Phase X will be the first)"
  - "Future: src/reasoning/ may import src/knowledge/ ONLY via knowledgeResolver.ts"
  - "Future: src/ai/ may import src/reasoning/ (ReasoningResult) but NEVER src/knowledge/ directly"
  - "Future: nothing outside src/ai/ imports src/reasoning/ or src/knowledge/ directly"

verified_zero_violations_of:
  - "circular dependencies within src/knowledge/ (grep-verified this session)"
  - "reverse dependencies (business module -> Knowledge Platform)"
  - "frozen module -> newer module imports"

not_independently_verified:
  - "repo-wide circular dependencies beyond Knowledge Platform — no dependency-cruiser/madge
     tool installed; claims rest on manual grep, which catches direct A<->B cycles but not
     longer transitive ones"
```

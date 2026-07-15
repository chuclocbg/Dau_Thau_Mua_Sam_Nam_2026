# Governance Rule Registry

One file per implemented rule, per `GOVERNANCE_ENGINE_RUNTIME.md` §2. Hand-maintained at this
rule count (viable per that section's own note; revisit once maintaining this by hand becomes
burdensome).

| Rule ID | Category | Status | Script | Command |
|---|---|---|---|---|
| [REVIEW-3](REVIEW-3.md) | review | active | `app/scripts/verifyPushState.ts` | `/ci-review` |

**Not yet in this registry:** the remaining 24 rules catalogued in `GOVERNANCE_ENGINE_DESIGN.md`
remain design-only (`status: designed`) and have not been migrated into individual
`RuleDefinition` files here. Migrating them is not part of Runtime Phase 0's scope
(`GOVERNANCE_RUNTIME_IMPLEMENTATION_CONTRACT.md` §2) and is not performed by this file.

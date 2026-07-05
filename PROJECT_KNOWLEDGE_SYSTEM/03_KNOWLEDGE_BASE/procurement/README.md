# Procurement

**Purpose:** Reference material for procurement method selection, thresholds, and package
lifecycle — the domain reference companion to `src/procurement/` (code) and the `procurement`
Knowledge Platform provider (structured rule data).

**Status:** Scaffolded, not yet populated.

## Future Contents

- Method-selection decision reference (open tender vs. direct award vs. others) with the
  exact threshold values currently modeled as `KnowledgeItem` data, not hardcoded — see
  `app/knowledge/reasoning/pipeline.md`'s documented threshold table for the current baseline
  (`OPEN_TENDER_GOODS_MIN`, `DIRECT_AWARD_MAX`, etc.) as a starting reference.
- Package-type-specific procurement guidance (goods, construction, consulting).
- Cross-reference to [`legal/`](../legal/README.md) for the legal basis behind each rule.

## Boundaries

Rule *values* (thresholds) live only in the `procurement` Knowledge Platform provider as
`KnowledgeItem` data — never hardcode them here; reference them.

## Ownership

Owned by whoever maintains `src/procurement/` and the `procurement`/`legal` providers. Per
[`../../KNOWLEDGE_BASE_EDITOR_GUIDE.md`](../../KNOWLEDGE_BASE_EDITOR_GUIDE.md).

## Update Policy

Additive, per [`../../DOCUMENTATION_CHANGE_POLICY.md`](../../DOCUMENTATION_CHANGE_POLICY.md).
Update when a procurement method or threshold rule changes in the provider data.

**Related:** [`../../01_PROJECT_DOCS/BUSINESS_ARCHITECTURE.md`](../../01_PROJECT_DOCS/BUSINESS_ARCHITECTURE.md) · [`../legal/README.md`](../legal/README.md)

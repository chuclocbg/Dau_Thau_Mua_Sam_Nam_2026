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

**Related:** [`../../01_PROJECT_DOCS/BUSINESS_ARCHITECTURE.md`](../../01_PROJECT_DOCS/BUSINESS_ARCHITECTURE.md) · [`../legal/README.md`](../legal/README.md)

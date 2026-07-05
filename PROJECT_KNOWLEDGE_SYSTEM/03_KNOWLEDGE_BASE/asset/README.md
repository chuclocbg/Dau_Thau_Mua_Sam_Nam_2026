# Asset

**Purpose:** Reference material for public asset lifecycle and depreciation rules — the
domain reference companion to the Knowledge Platform's `asset` provider.

**Status:** Scaffolded, not yet populated.

## Future Contents

- Asset lifecycle stage reference (acquisition → in-use → disposal), mirroring the `asset`
  provider's `DEPENDS_ON`-based stage ordering.
- Depreciation rule reference by asset category.
- Legal basis: Law on Management and Use of Public Assets, Decree 186/2025/NĐ-CP.

## Boundaries

Sources from the `asset` provider's actual graph data (lifecycle `DEPENDS_ON` ordering,
`REFERENCES` depreciation rules) rather than independently authored — never let this folder's
lifecycle description drift from what the provider actually models.

## Ownership

Owned by whoever maintains the `asset` Knowledge Platform provider. Per
[`../../KNOWLEDGE_BASE_EDITOR_GUIDE.md`](../../KNOWLEDGE_BASE_EDITOR_GUIDE.md).

## Update Policy

Additive, per [`../../DOCUMENTATION_CHANGE_POLICY.md`](../../DOCUMENTATION_CHANGE_POLICY.md).
Update when a lifecycle stage or depreciation rule is added to the provider.

**Related:** [`../../01_PROJECT_DOCS/KNOWLEDGE_PLATFORM.md`](../../01_PROJECT_DOCS/KNOWLEDGE_PLATFORM.md) · [`../legal/README.md`](../legal/README.md)

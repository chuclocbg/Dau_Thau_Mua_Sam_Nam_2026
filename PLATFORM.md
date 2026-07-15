# Engineering Platform — Reference Implementation

**Canonical references** (already present in this repository, not duplicated here):
`PROJECT_KNOWLEDGE_SYSTEM/01_PROJECT_DOCS/ENGINEERING_PLATFORM_PRODUCT_SPEC.md` (the frozen
design) and `PROJECT_KNOWLEDGE_SYSTEM/01_PROJECT_DOCS/ENGINEERING_PLATFORM_IMPLEMENTATION_PLAYBOOK.md`
(the execution plan). This file does not restate their content beyond the two sections below,
per the Documentation Rules both documents already state (a document exists only if it answers
something another file can't).

## The layer boundary rule

Layers 1–8 (Core Platform) may never import, reference, or branch on anything specific to Layers
9–14 (Application Stack) — including the AI Procurement Agent application in this repository.
Nothing built under this file may assume it knows what `app/src/` does.

## The 10 Platform Principles

1. Layers never depend upward.
2. No judgment call is ever made silently.
3. Evidence is separated from verdict.
4. Guards assert presence, not exact shape, wherever growth is additive.
5. Nothing is built ahead of evidenced need.
6. One owning file per fact.
7. Rollback is always human-initiated, never automatic.
8. A mid-flight deviation is disclosed, never silently absorbed.
9. The smallest working slice ships first, framework-shaped generalization comes later.
10. Every verification claim is checkable, not just asserted.

Full reasoning for each: `ENGINEERING_PLATFORM_PRODUCT_SPEC.md` §2.

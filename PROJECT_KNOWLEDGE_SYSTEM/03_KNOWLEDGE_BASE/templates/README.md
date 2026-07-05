# Templates

**Purpose:** Document generation templates — this system's implementation of the official
[`forms/`](../forms/README.md), plus templates for anything not a strict legal form (internal
memos, checklists).

**Status:** Scaffolded, not yet populated.

## Future Contents

- The template catalog, cross-referenced to the Knowledge Platform's `templates` provider
  (`TemplateProvider`), which already models prerequisite chains (`DEPENDS_ON`) and
  generated-document relationships (`GENERATES`) between templates.
- Placeholder conventions used in every template — bracketed placeholders only
  (`[Tổ trưởng tổ chuyên gia]`), never real names, per
  [`../../01_PROJECT_DOCS/CONSTITUTION.md`](../../01_PROJECT_DOCS/CONSTITUTION.md)'s Demo Data Rules.

## Boundaries

Templates implement `forms/`'s mandated structures — never the reverse. A template that
deviates from its corresponding form is a defect in the template, not a reason to edit the form.

## Ownership

Owned by whoever maintains the `templates` Knowledge Platform provider (`TemplateProvider`).
Per [`../../KNOWLEDGE_BASE_EDITOR_GUIDE.md`](../../KNOWLEDGE_BASE_EDITOR_GUIDE.md).

## Update Policy

Additive, per [`../../DOCUMENTATION_CHANGE_POLICY.md`](../../DOCUMENTATION_CHANGE_POLICY.md).
Update when a new template is added to the provider or a prerequisite/generation chain changes.

**Related:** [`../forms/README.md`](../forms/README.md) · [`../../01_PROJECT_DOCS/KNOWLEDGE_PLATFORM.md`](../../01_PROJECT_DOCS/KNOWLEDGE_PLATFORM.md)

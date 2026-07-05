# Documentation Template

**Purpose:** Canonical, copy-paste-ready templates for every document type in this system —
directly closing the template-completeness gaps the QA audit found (`DOCUMENTATION_BACKLOG.md`
items 3, 4).

**Audience:** Anyone creating a new file in this system.

**Dependencies:** [`DOCUMENTATION_STYLE_GUIDE.md`](DOCUMENTATION_STYLE_GUIDE.md).

**Status:** ACTIVE canonical templates as of `PROJECT_KNOWLEDGE_SYSTEM v1.0`.

**Related:** [`DOCUMENTATION_REVIEW_CHECKLIST.md`](DOCUMENTATION_REVIEW_CHECKLIST.md)

## Table of Contents

1. [Project Docs Template](#project-docs-template)
2. [AI Context Template](#ai-context-template)
3. [Knowledge Base Folder README Template](#knowledge-base-folder-readme-template)
4. [Project Memory Template](#project-memory-template)

---

## Project Docs Template

All 6 fields are mandatory — no exceptions, per Constitution Article VIII (a missing field is
tracked debt, not a stylistic choice).

```markdown
# <Title>

**Purpose:** <one to two sentences — what this document is for>

**Audience:** <who should read this>

**Dependencies:** <what must be read/true before this document makes sense, or "None">

**Status:** <either a scoped-legend value (FROZEN/APPROVED/PLANNED) if describing a body of
work's status, or free-text currency prose ("Current as of...") if describing the document's
own freshness — see DOCUMENTATION_STYLE_GUIDE.md>

**Related:** [Label](path.md) · [Label](path.md)

## Table of Contents

1. [Section](#section)
...

---

<body>
```

## AI Context Template

```markdown
# <Title>

*Machine-readable. <one-line orientation>.*

## Machine Context

\`\`\`yaml
as_of: YYYY-MM-DD
status: CURRENT   # or STALE, or SUPERSEDED
owner_file: null   # or the file that actually owns this fact, if this file is only referencing it
related: [OtherFile.md, ../folder/OtherFile.md]

<the actual payload, keys as needed>
\`\`\`

<optional short human-readable elaboration, kept minimal>
```

Remember to add this file's owned facts to `02_AI_CONTEXT/SCHEMA.md`'s `owns:` map — a file
that owns a fact but isn't registered there is itself a Constitution Article II violation.

## Knowledge Base Folder README Template

```markdown
# <Folder Name>

**Purpose:** <what domain this folder covers, and its relationship to the corresponding
Knowledge Platform provider domain if one exists>

**Status:** Scaffolded, not yet populated. <or, once populated: describe what's actually here>

## Future Contents

- <bullet list of what will eventually live here>

## Explicit Non-Duplication Rule

<state which other file/system is the source for any fact this folder will eventually
reference, so population doesn't create duplicate content — see KNOWLEDGE_BASE_EDITOR_GUIDE.md>

**Related:** [Label](../other-folder/README.md) · [Label](../../01_PROJECT_DOCS/File.md)
```

## Project Memory Template

```markdown
# <Title>

**Purpose:** <what historical question this document answers>

**Related:** [Label](path.md)

## <Body — narrative, dated where relevant, append-only per Constitution Article III>
```

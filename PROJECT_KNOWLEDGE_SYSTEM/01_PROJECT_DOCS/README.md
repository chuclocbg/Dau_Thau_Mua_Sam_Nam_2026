# 01_PROJECT_DOCS

**Purpose:** Human-facing strategic and technical documentation for the AI Procurement Agent
project. This is the "textbook" layer — read it to understand the project deeply, not to load
fast context (for that, see [`../02_AI_CONTEXT/`](../02_AI_CONTEXT/README.md)).

**Audience:** New human contributors, technical leads, and any AI session that needs deep
architectural reasoning rather than a fast status check.

**Dependencies:** None to read this folder — it is self-contained. Individual documents link
to `app/docs/`, `app/knowledge/`, and `app/.memory/` where deeper module-level detail already
exists, rather than duplicating it.

**Status:** Living document set, current as of `v1.0-knowledge-platform` (2026-07-05).

---

## Table of Contents

| # | Document | One-line description |
|---|---|---|
| 1 | [Executive Summary](EXECUTIVE_SUMMARY.md) | What this project is, in five minutes |
| 2 | [Project Blueprint](PROJECT_BLUEPRINT.md) | The full plan: business goals → technical execution |
| 3 | [Business Architecture](BUSINESS_ARCHITECTURE.md) | Domains, stakeholders, workflows, legal context |
| 4 | [Technical Architecture](TECHNICAL_ARCHITECTURE.md) | Hexagonal architecture, layering, module boundaries |
| 5 | [Module Catalog](MODULE_CATALOG.md) | Every module: what it does, its status, its tests |
| 6 | [Domain Model](DOMAIN_MODEL.md) | Core entities, value objects, aggregates, bounded contexts |
| 7 | [Knowledge Platform](KNOWLEDGE_PLATFORM.md) | The 16-provider Phase N platform, frozen v1.0 |
| 8 | [AI Advisory Architecture](AI_ADVISORY_ARCHITECTURE.md) | The approved (not yet built) Phase X design |
| 9 | [Phase X ADR Draft 001](PHASE_X_ADR_DRAFT_001.md) | Knowledge retrieval strategy decision (formalized v1.1) |
| 10 | [AIContext Schema](AI_CONTEXT_SCHEMA.md) | Phase X's frozen context contract, field-by-field (added v1.1) |
| 11 | [Golden Question Methodology](GOLDEN_QUESTION_METHODOLOGY.md) | Phase X evaluation methodology across 10 domains (added v1.1) |
| 12 | [Development Guide](DEVELOPMENT_GUIDE.md) | How to build in this codebase without breaking it |
| 13 | [Constitution](CONSTITUTION.md) | The non-negotiable rules governing every line of code |
| 14 | [Roadmap](ROADMAP.md) | What's built, what's next, in what order, and why |
| 15 | [Release History](RELEASE_HISTORY.md) | Every tagged release, what it contains |
| 16 | [Glossary](GLOSSARY.md) | Every domain term, Vietnamese and English |

---

## Reading order for a new technical contributor

```
Executive Summary → Constitution → Technical Architecture → Module Catalog →
Domain Model → Knowledge Platform → (AI Advisory Architecture, if working on Phase X) →
Development Guide → Roadmap
```

## Reading order for a new business/product stakeholder

```
Executive Summary → Business Architecture → Roadmap → Release History → Glossary
```

---

*Status legend used throughout this folder: **FROZEN** (built, tested, never to be modified
except via the documented extension pattern) · **APPROVED** (designed and accepted, not yet
implemented) · **PLANNED** (on the roadmap, not yet designed in detail).*

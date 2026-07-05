# Knowledge Platform Memory

**Spec status:** FROZEN (2026-07-03)
**Implementation status:** PENDING (after Phase M)
**Full spec:** `knowledge/decisions/knowledge-platform-v2.md`

---

## The 3-Layer Intelligence Boundary

```
┌────────────────────────────────────────────┐
│ KNOWLEDGE PLATFORM                          │
│ Retrieves. Never reasons.                   │
│ IKnowledgePlatform — 14 methods             │
│ 16 providers / 4 layers                     │
└──────────┬─────────────────────────────────┘
           │ IKnowledgePlatform (KnowledgeResolver stage only)
┌──────────▼─────────────────────────────────┐
│ REASONING LAYER                             │
│ Decides. Never stores.                      │
│ ILegalReasoningEngine — 2 methods           │
│ 8-stage pipeline                            │
└──────────┬─────────────────────────────────┘
           │ ReasoningResult → AIContextBuilder
┌──────────▼─────────────────────────────────┐
│ AI CONTEXT LAYER                            │
│ Transforms. Never reasons.                  │
│ AIContext (frozen, read-only)               │
│ ILLMAdapter — 4 implementations             │
└──────────┬─────────────────────────────────┘
           │ AIContext only
┌──────────▼─────────────────────────────────┐
│ AI ADVISORY LAYER (Phase X)                 │
│ Generates natural language. That's it.      │
│ May only import: IAIContextBuilder,          │
│   ILLMAdapter, AIContext                    │
└────────────────────────────────────────────┘
```

---

## Immutable Rules (all 3 layers)

1. Knowledge Platform NEVER performs reasoning
2. Reasoning Layer NEVER stores documents
3. AI never calls repositories
4. AI never searches knowledge
5. AI never evaluates rules
6. AI never resolves applicable law
7. AI only generates natural language from AIContext
8. AIContext is read-only after construction (`Object.freeze`)
9. Every LLM response passes output validation before serving
10. No model-specific logic in PromptBuilder (handled by PromptRenderer)

---

## Provider Layer Meanings

| Layer | Binding | Override Rules |
|-------|---------|---------------|
| 1 — Legal | Nationally binding | Highest authority |
| 2 — Business | Operationally binding | Cannot override Layer 1 |
| 3 — Organizational | Institutionally binding | Can be MORE restrictive than Layer 2 |
| 4 — Experience | Advisory only | No legal binding |

Layer 3 (school policy) can restrict but never relax Layer 1 or 2 rules.
This is enforced by the Reasoning Layer conflict resolution (ADR-015).

---

## Corpus Layer (Phase N1)

The corpus layer sits below the runtime `KnowledgeItem` layer:
```
KnowledgeObject (corpus truth, versioned, sourced, validated)
    ↓ projected at query time
KnowledgeItem (runtime, universal type, used by all callers)
```

Scale targets: ~520K objects at launch, ~1M at 5 years.
4 indexes: full-text (Postgres tsvector → Elasticsearch), semantic vector (pgvector → Qdrant),
  faceted (GIN), graph (recursive CTE → Apache AGE).

Full corpus spec: `knowledge/corpus/` directory.

---

## Knowledge Domains (16)

Open string constants (not enum):
`legal` · `procurement` · `templates` · `checklists` · `ontology` · `glossary` ·
`vendor` · `asset` · `budget` · `notification` · `school` ·
`cases` · `risk` · `audit` · `bestpractice` · `ai_feedback`

New domain = `registerProvider(domain, provider)`. Zero code changes.

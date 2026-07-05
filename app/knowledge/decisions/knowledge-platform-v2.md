# Knowledge Platform V2 — FROZEN ARCHITECTURE DECISION

Date: 2026-07-03
Status: FROZEN — no modifications permitted after this decision
Supersedes: knowledge-platform.md (v1), legal-engine.md

---

## Decision

The Knowledge Platform is the central intelligence layer for the entire procurement platform. It is not a legal tool. It is a domain-agnostic knowledge operating system.

Architecture is frozen at this definition. All future providers, domains, and knowledge types are added by REGISTRATION ONLY. No modification to the platform core, router, ranker, or any existing provider is ever required to add a new knowledge domain.

---

## The Four Knowledge Layers

```
Knowledge Platform
│
├── Layer 1 — Legal Knowledge
│   AUTHORITY: Nationally binding — cannot be overridden
│   Providers: LegalProvider
│   Content: Laws, Decrees, Circulars, Official Letters, Consolidated Documents, Internal Regulations
│   Key behaviors: amendment chains · effective date resolution · citation graph · authority hierarchy
│
├── Layer 2 — Business Knowledge
│   AUTHORITY: Operationally binding within the platform
│   Providers: ProcurementProvider · TemplateProvider · ChecklistProvider · OntologyProvider
│              GlossaryProvider · VendorKnowledgeProvider · AssetKnowledgeProvider
│              BudgetKnowledgeProvider · NotificationKnowledgeProvider
│   Content: procurement methods · templates · checklists · concepts · vendor criteria · budget rules
│   Key behaviors: context-aware resolution · template matching · applicability filtering
│
├── Layer 3 — Organizational Knowledge
│   AUTHORITY: Institutionally binding within the organization (may be MORE restrictive than Layer 1)
│   Providers: SchoolPolicyProvider
│   Content: internal regulations · spending limits · approval matrices · ethics codes · org procedures
│   Key behaviors: org-scoped filtering · override detection vs Layer 1
│
└── Layer 4 — Experience Knowledge
    AUTHORITY: Advisory only — informs, never mandates
    Providers: CaseProvider · RiskProvider · AuditProvider · BestPracticeProvider · AIFeedbackProvider
    Content: historical cases · fraud patterns · audit findings · lessons learned · AI feedback loops
    Key behaviors: similarity search · pattern matching · feedback reinforcement
```

**Layer precedence for AI recommendation generation:**
More restrictive of Layer 1 and Layer 3 is always applied.
Layer 2 provides the operating procedure.
Layer 4 provides advisory context.

---

## Provider Inventory (16 providers)

| Provider | Domain Key | Layer | Responsibility |
|----------|-----------|-------|---------------|
| LegalProvider | `legal` | 1 | Laws, decrees, circulars, official letters, consolidated docs, internal regs |
| ProcurementProvider | `procurement` | 2 | Methods, workflows, lifecycle rules, approval rules, evaluation rules |
| TemplateProvider | `templates` | 2 | HSMT, HSYC, KHLCNT, contracts, acceptance reports, payment forms, audit forms |
| ChecklistProvider | `checklists` | 2 | Compliance checklists, verification lists, per-phase quality gates |
| OntologyProvider | `ontology` | 2 | Domain concepts, synonyms, Vietnamese procurement terminology graph |
| GlossaryProvider | `glossary` | 2 | Legal/procurement term definitions, abbreviations, term translations |
| VendorKnowledgeProvider | `vendor` | 2 | Supplier capabilities, blacklist criteria, performance benchmarks, certification requirements |
| AssetKnowledgeProvider | `asset` | 2 | Asset categories, depreciation rules, maintenance schedules, asset lifecycle |
| BudgetKnowledgeProvider | `budget` | 2 | Budget codes, spending limits, fund source rules, fiscal year constraints |
| NotificationKnowledgeProvider | `notification` | 2 | Notification templates, escalation rules, routing rules, SLA definitions |
| SchoolPolicyProvider | `school` | 3 | Internal regulations, spending rules, procurement procedures, asset management |
| CaseProvider | `cases` | 4 | Previous procurement cases, decision history, similar package search |
| RiskProvider | `risk` | 4 | Fraud patterns, conflict of interest indicators, red flags, risk mitigations |
| AuditProvider | `audit` | 4 | State Audit findings, inspector conclusions, common mistakes, compliance checklists |
| BestPracticeProvider | `bestpractice` | 4 | Recommended approaches, lessons learned, efficiency patterns |
| AIFeedbackProvider | `ai_feedback` | 4 | AI recommendation acceptance/rejection history, feedback for model improvement |

---

## Immutable Extension Rules

1. **Domain = open string.** Never `enum Domain`. The platform has no list of known domains anywhere in its code.

2. **Registration only.** New knowledge domains are added by calling `platform.registerProvider(provider)`. Zero changes to: platform, router, ranker, any existing provider, any test.

3. **No routing logic in the platform.** The router uses a pure `Map<string, IKnowledgeProvider>` lookup. No switch statements. No if-domain comparisons. No domain-name pattern matching.

4. **AI talks to platform, never providers.** The AI Advisory Layer (Phase X) may only import `IKnowledgePlatform`. It is architecturally prohibited from importing any `*Provider.ts` file. Enforced by module boundary (the provider files are internal to `src/knowledge/providers/`).

5. **suggest() and score() are required.** Every provider implements all four interface methods. `suggest()` enables proactive knowledge surface to the AI without an explicit query. `score()` enables cross-provider relevance ranking.

6. **KnowledgeItem is universal.** Every knowledge artifact — a law, a template, a past case, a risk pattern, a glossary entry, an AI feedback record — is a `KnowledgeItem`. No domain-specific entity type ever escapes the knowledge module.

7. **KnowledgeGraph edges are open string typed.** `KnowledgeRelationType` is an open string constant set, not an enum. New relation types are added as constants without changing any existing code.

8. **Applicability rules are universal.** Any `KnowledgeItem` from any domain can have `KnowledgeApplicabilityRule` records. The same evaluation logic handles legal document scope and template scope and risk pattern scope.

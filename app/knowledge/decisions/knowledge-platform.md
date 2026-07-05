# Design Decision: Knowledge Platform (Phase N)

Date: 2026-07-03
Status: APPROVED — supersedes "Legal Knowledge Engine" design

---

## Decision

Phase N is renamed and broadened from "Legal Knowledge Engine" to "Knowledge Platform".

The Knowledge Platform supports multiple knowledge domains through a provider registry. Legal Intelligence is one provider. Procurement Knowledge, Templates, Audit, Cases, Risk, Ontology, Glossary, MasterData, and School Regulations are additional providers, with the architecture supporting unlimited future domains.

---

## Why the Rename Is Necessary

The original design locked the platform into a single domain. Several problems emerge immediately:

1. **Templates are not legal documents** — HSMT, HSYC, contract forms, and payment forms need the same search-and-resolve API as legal documents. But they have no authority level, no amendment chain, no effective dates. A legal-domain API forces them into a legal model that doesn't fit.

2. **Audit findings have a different lifecycle** — State Audit conclusions reference legal articles but are themselves advisory, time-stamped, and severity-rated. They are knowledge items, not legal documents.

3. **Previous cases are the highest-value AI training signal** — "What did similar organizations do when they faced this situation?" is the most useful AI question. Cases cannot be modeled as legal documents.

4. **Risk patterns require their own metadata** — fraud indicators, conflict-of-interest red flags, and common mistakes are knowledge items with indicators, mitigations, and frequency ratings. None of that fits a legal schema.

5. **School and institutional regulations are a first-class domain** — Internal spending rules, asset management regulations, and procurement procedures are often more operationally relevant than national law. They need the same query interface as national law, but they are not part of the Vietnamese legal hierarchy.

A Legal Knowledge Engine forces all of these into workarounds. The Knowledge Platform accommodates all of them natively through the provider model.

---

## Core Principle: Generic Over Specific

The platform does not know what domains exist. It knows:
1. A `KnowledgeItem` has common fields: itemId, domain, title, content, metadata, tags, effectiveFrom, effectiveTo, isActive.
2. An `IKnowledgeProvider` can search, resolve, list, and register items.
3. Queries carry `KnowledgeContext` which providers interpret according to their domain logic.

New domain = new provider class registered at startup. Zero platform code changes.

---

## How Legal Intelligence Fits

The Legal Intelligence provider (domain = 'legal') retains all capabilities from the original design:
- DocumentTypeRegistry (open, 14 initial types)
- Amendment chain traversal
- Citation graph (typed: IMPLEMENTS / DELEGATES / DEFINES / RESTRICTS / REFERENCE)
- Effective law resolver — `resolveApplicable(context, asOfDate)` for the legal domain
- Concept ontology
- Semantic search interface (pluggable embedding adapter)

These are all internal to `providers/legal/`. From the outside, calling code uses:
```
platform.resolveApplicableDocuments('legal', asOfDate, context)
platform.resolveLegalBasis(topic, context, asOfDate)
platform.searchKnowledge(text, ['legal'], context)
```

The same `platform.searchKnowledge(text, ['risk'], context)` works for the risk domain. The API is identical.

---

## Applicability Rules Are Universal

A key insight: applicability rules (previously: "TT-BCT only applies to GOODS packages") are not a legal concept. They are a property of ANY knowledge item.

- A tender document template (HSMT) only applies to OPEN_TENDER packages → `KnowledgeApplicabilityRule`
- A risk pattern "supplier splitting" is only relevant for GOODS packages above 200M VNĐ → `KnowledgeApplicabilityRule`
- An audit finding applies only to STATE-funded packages → `KnowledgeApplicabilityRule`
- A legal document applies to specific package types and fund sources → same `KnowledgeApplicabilityRule`

One model handles all of these. The `resolveApplicableDocuments(domain, asOfDate, context)` function works for every domain by evaluating `KnowledgeApplicabilityRule` records — the domain name is just a filter.

---

## Impact on Prior Architecture

- TD-02 still fixed: `resolveApplicableDocuments('legal', asOfDate, context)` delegates to `LegalIntelligenceProvider.resolveApplicable()` which reads `KnowledgeApplicabilityRule` rows, never hardcodes symbols.
- Legal items remain the same entities (KnowledgeItem with legal metadata), backed by the same Prisma models plus new `KnowledgeItem` unified table.
- `src/legal/` (frozen) still untouched. `knowledgeIntegration.ts` is the only file that imports from it.

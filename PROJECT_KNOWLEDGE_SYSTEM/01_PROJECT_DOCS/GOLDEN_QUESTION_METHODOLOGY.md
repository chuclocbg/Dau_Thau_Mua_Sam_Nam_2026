# Golden Question Regression Methodology

**Purpose:** Persist the Golden Question Regression Set methodology already designed during
the Phase X implementation blueprint cycle — the audit found this referenced (including a
broken pointer from `03_KNOWLEDGE_BASE/faq/README.md`) but never actually captured anywhere
in `PROJECT_KNOWLEDGE_SYSTEM`.

**Audience:** Whoever implements Phase X.8 (Evaluation), or seeds the FAQ folder.

**Dependencies:** [AI Advisory Architecture](AI_ADVISORY_ARCHITECTURE.md).

**Status:** Methodology DECIDED. No golden question fixtures have been written as actual test
files — this document describes the *method*, not populated test data.

**Related:** [`../03_KNOWLEDGE_BASE/faq/README.md`](../03_KNOWLEDGE_BASE/faq/README.md) · [Testing strategy, referenced in Development Guide](DEVELOPMENT_GUIDE.md)

---

## Table of Contents

1. [Purpose of the Golden Question Set](#purpose-of-the-golden-question-set)
2. [Fixture Structure](#fixture-structure)
3. [The 10 Domains](#the-10-domains)
4. [Execution Cadence](#execution-cadence)
5. [Relationship to the FAQ Knowledge Base Folder](#relationship-to-the-faq-knowledge-base-folder)

---

## Purpose of the Golden Question Set

A fixed regression suite of real (or realistic) questions with known-correct expected answers,
run against the full Phase X reasoning pipeline on every commit — the same regression
discipline `vitest run` already provides for Phases A-N, applied to something much harder to
unit-test in the abstract: reasoning correctness and confidence calibration.

## Fixture Structure

```typescript
interface GoldenQuestion {
  question: string
  context: KnowledgeContext
  expectedIntentType: string
  expectedEvidenceRoles: string[]        // e.g. ['PRIMARY_BASIS']
  expectedCitationSymbols: string[]      // document symbols the answer must cite
  expectedConfidenceLabel: 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW'
  mustNotContain: string[]               // hallucination guardrails — phrases the answer must never state
}
```

## The 10 Domains

| Domain | Question categories | Expected evidence | Expected citations | Expected confidence | Failure conditions |
|---|---|---|---|---|---|
| **Legal** | Threshold checks, method-selection eligibility, Layer 1 vs Layer 3 conflicts | ≥1 `PRIMARY_BASIS` article, effective-date-valid | Full + short citation, `isNormative=true` | HIGH for unambiguous law; MEDIUM + human review for genuine conflicts | Any citation not traceable to context; stating a threshold value absent from `legalBasis[]` |
| **Procurement** | Method selection (open tender vs. direct award), package-type rules | Procurement rule item + legal basis backing it | Rule + underlying law citation | MEDIUM-HIGH | Recommending a method the threshold data contradicts |
| **Planning** | Fund-source allocation, annual plan structuring | Budget applicability rule | Budget code + fund source citation | MEDIUM | Ignoring an `ApplicabilityRule` fund-source filter |
| **Approval** | Authority-level resolution for a given value | Approval authority hierarchy item | School-policy or procurement rule citation | MEDIUM-HIGH | Naming the wrong authority level for a value band |
| **Contract** | Guarantee/milestone compliance | Template + legal basis | Citation to the specific guarantee rule | MEDIUM | Confusing advance-payment vs. performance guarantee rules |
| **Acceptance** | Committee composition by package type | Checklist item | Checklist citation | MEDIUM-HIGH (procedural, low ambiguity) | Omitting a mandatory committee-composition rule |
| **Asset** | Lifecycle stage + depreciation lookups | Asset category + depreciation rule item | Rule citation | MEDIUM-HIGH | Applying the wrong depreciation method |
| **Notification** | Escalation-rule explanation | Escalation rule item | Rule citation, informational tone | MEDIUM (PERMISSIVE bias) | Missing an escalation target |
| **Workflow** | "What's my next required step" | Checklist/template item | Checklist citation | HIGH (deterministic state machine) | Recommending a transition the state machine doesn't allow |
| **Knowledge Search** | Pure lookup/definition (glossary, ontology) | Glossary/ontology item | None required (informational, not a legal conclusion) | HIGH | Confusing a synonym relation with a translation relation |

## Execution Cadence

Mocked-LLM fixture replay in CI on every commit (fast, deterministic); real-model runs on a
slower nightly or pre-release cadence (catches drift the mocked replay can't). Golden questions
should be added incrementally starting at Phase X.2, not batched at the end of the phase.

## Relationship to the FAQ Knowledge Base Folder

Per [`../03_KNOWLEDGE_BASE/faq/README.md`](../03_KNOWLEDGE_BASE/faq/README.md): real, recurring
user questions collected once the system is in use are the natural seed set for new Golden
Questions. The FAQ folder and this methodology are complementary, not duplicative — FAQ holds
*user-facing* Q&A; this document holds the *test methodology* that consumes FAQ content as raw
material.

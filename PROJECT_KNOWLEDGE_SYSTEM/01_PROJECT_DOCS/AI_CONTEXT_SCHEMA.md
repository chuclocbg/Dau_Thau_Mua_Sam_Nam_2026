# AIContext Schema and Field Ownership Registry

**Purpose:** Persist the `AIContext` field-by-field schema and the field-ownership registry
(which reasoning stage populates which field) — knowledge already established during the
Phase X design cycle but, per the Zero-Knowledge Validation audit, not previously retrievable
anywhere within `PROJECT_KNOWLEDGE_SYSTEM`.

**Audience:** Whoever implements Phase X.3 (Context Builder) or writes an `ILLMAdapter`.

**Dependencies:** [AI Advisory Architecture](AI_ADVISORY_ARCHITECTURE.md).

**Status:** Schema is DECIDED (matches the pre-existing design corpus at
`app/knowledge/ai-advisory/context.md`, reconciled here, not redesigned). Not yet implemented
as code.

**Related:** [Phase X ADR Draft 001](PHASE_X_ADR_DRAFT_001.md) · [`../02_AI_CONTEXT/ARCHITECTURE_CONSTRAINTS.md`](../02_AI_CONTEXT/ARCHITECTURE_CONSTRAINTS.md)

---

## Table of Contents

1. [The Frozen Contract](#the-frozen-contract)
2. [Top-Level Field Schema](#top-level-field-schema)
3. [Field Ownership Registry](#field-ownership-registry)
4. [Immutability Rule](#immutability-rule)

---

## The Frozen Contract

`AIContext` is the single, read-only boundary between the Reasoning Engine and everything
downstream (Prompt Layer, LLM Adapter, Output Validator) — per Constraint C-05 in
`../02_AI_CONTEXT/ARCHITECTURE_CONSTRAINTS.md`. Once implemented, `Object.freeze()` is applied
at construction; no downstream consumer may modify any field.

## Top-Level Field Schema

| Field | Type | Purpose |
|---|---|---|
| `contextId` | `string` | UUID; correlates logs and audit trail |
| `builtAt` | `string` | ISO datetime of context creation |
| `asOfDate` | `string` | Legal resolution date |
| `question` | `string` | Original user question, verbatim |
| `intent` | `AIContextIntent` | Classified intent + extracted entities |
| `decision` | `string \| null` | `null` if confidence < 0.50 |
| `confidence` | `number` | 0–1 |
| `confidenceLabel` | `'HIGH' \| 'MEDIUM' \| 'LOW' \| 'VERY_LOW'` | Human-readable confidence tier |
| `humanReviewRequired` | `boolean` | Computed pre-LLM, deterministic |
| `humanReviewReason` | `string?` | Present when `humanReviewRequired = true` |
| `legalBasis` | `AIContextLegalBasis[]` | Applicable legal provisions |
| `citations` | `AIContextCitation[]` | Pre-formatted citations for LLM injection |
| `evidence` | `AIContextEvidence[]` | Supporting evidence items |
| `reasoningTrace` | `AIContextTraceStep[]` | Summarized pipeline trace (5-10 steps, not the full trace) |
| `warnings` | `AIContextWarning[]` | Ranked by severity |
| `missingInformation` | `AIContextMissingInfo[]` | Gaps affecting answer completeness |
| `recommendedActions` | `AIContextAction[]` | Actionable next steps |
| `attachments` | `AIContextAttachment[]` | Storage-module file references |
| `conversationHistory` | `AIContextMessage[]` | Pruned to token budget |
| `systemInstructions` | `AIContextSystemInstructions` | Role, format, tone, forbidden behaviors |
| `totalTokenEstimate` | `number` | Pre-computed for the target model |
| `language` | `'vi' \| 'en' \| 'vi+en'` | Output language |

### Key Sub-Types (abbreviated — full shape matches the pre-existing design corpus)

```
AIContextLegalBasis  { itemId, documentSymbol, documentTitle, documentType, issuingBody,
                       authorityLevel, article?, clause?, point?, provisionText, role,
                       isNormative, isPrimary, effectiveFrom, effectiveTo?,
                       citationFull, citationShort, citationInline }

AIContextCitation    { citationId, itemId, full, short, inline, chain?, isNormative, isPrimary }

AIContextEvidence    { itemId, domain, type, title, summary, detail?, role, confidence, legalRef? }

AIContextAction      { actionId, description, actionType, priority, deadline?, legalRef?, templateRef? }
                     actionType: SUBMIT_DOCUMENT | GET_APPROVAL | PUBLISH_NOTICE |
                       PREPARE_GUARANTEE | CONSULT_LEGAL | CORRECT_VIOLATION | AWAIT_DECISION |
                       REVIEW_DOCUMENT | CONTACT_AUTHORITY | RECORD_MINUTES

AIContextSystemInstructions {
  role, outputLanguage, outputFormat, tone, citationStyle, responseLength,
  confidenceDisclosure, uncertaintyBehavior, forbiddenBehaviors[], allowedKnowledgeSources[],
  customInstructions?, contextSummary
}
  outputFormat: CONVERSATIONAL | STRUCTURED_LIST | LEGAL_ADVISORY | STEP_BY_STEP |
                COMPARISON_TABLE | LEGAL_MEMO
  tone: FORMAL_LEGAL | PROFESSIONAL | ACCESSIBLE
  citationStyle: INLINE | FOOTNOTE | ENDNOTE | NONE
```

## Field Ownership Registry

*(Which reasoning-pipeline stage populates which `AIContext` field — mirrors
`../02_AI_CONTEXT/SCHEMA.md`'s ownership-map convention, applied to `AIContext`'s own fields)*

| Field(s) | Populated by (pipeline stage) |
|---|---|
| `question`, `intent` | Intent Detection / Question Classification |
| `legalBasis`, `citations` | Knowledge Routing + Citation Formatting |
| `evidence` | Evidence Ranking |
| `decision`, `confidence`, `confidenceLabel` | Answer Synthesis (11-deduction scoring table) |
| `humanReviewRequired`, `humanReviewReason` | Computed across all stages; any stage may set `true`, none may set `false` |
| `reasoningTrace` | Assembled by Answer Synthesis, summarized from the full internal trace |
| `warnings`, `missingInformation` | Contradiction Detection + Evidence Ranking |
| `recommendedActions` | Answer Synthesis, derived from rule failures / missing evidence / human-review triggers |
| `attachments` | Context Builder (Phase X.3), from Storage-module references passed in as build options |
| `conversationHistory` | Context Builder, pruned from `ConversationMemory` (Conversation Layer) |
| `systemInstructions` | Context Builder, combining the `AdvisorProfile`'s tone/format defaults with per-question overrides |
| `totalTokenEstimate` | Context Builder's `TokenBudgetManager` |

## Immutability Rule

No field above may be added without marking it optional (`?`) — existing consumers
(`PromptBuilder`, `OutputValidator`, every `ILLMAdapter`) must never require a migration for an
additive field. This mirrors Constraint C-04's Knowledge Platform precedent (open, additive
extension) applied to the `AIContext` contract specifically.

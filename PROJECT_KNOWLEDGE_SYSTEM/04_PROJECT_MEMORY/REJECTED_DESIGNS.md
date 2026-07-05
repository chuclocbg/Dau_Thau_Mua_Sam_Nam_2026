# Rejected Designs

**Purpose:** What was considered and explicitly not chosen — so a future contributor doesn't
re-propose an already-evaluated alternative without knowing why it was set aside.

**Related:** [Decision History](DECISION_HISTORY.md)

## Rejected: 15 Advisors as 15 Service Classes

Considered during the Phase X architecture design. Rejected because it would reintroduce the
service sprawl the Knowledge Platform's 16-provider registration pattern was specifically
built to avoid — a 16th advisor would require a new class *and* new wiring, not just a new data
record. See [`../01_PROJECT_DOCS/AI_ADVISORY_ARCHITECTURE.md`](../01_PROJECT_DOCS/AI_ADVISORY_ARCHITECTURE.md).

## Rejected: Multi-LLM-Agent Conversations

Considered as the mechanism for multi-agent orchestration (X.10). Rejected in favor of
deterministic upstream orchestration with exactly one LLM synthesis call — every additional
LLM-to-LLM hop is an additional place a hallucination or contradiction can be introduced before
the single validation gate ever runs, at real cost and latency, for a domain complexity that
doesn't require it.

## Rejected: Building MCP and Multi-Agent Now

Considered as part of the initial Phase X scope. Rejected as premature — no production usage
data exists yet to justify either capability, and building ahead of proven need was
specifically identified as the most common source of unnecessary complexity in systems like
this one. Both remain fully designed and ready to build once genuinely needed.

## Rejected: Adding New `IKnowledgePlatform` Methods to Fix the resolveCases Signature Gap

Considered as the fix for the `resolveCases`/`resolveBestPractice` signature mismatch.
Rejected once it was confirmed that the existing `searchKnowledge()` method already covers the
exact need — adding redundant methods would have violated the same "don't duplicate
abstractions" principle this whole documentation review exists to enforce.

## Rejected: A Learned/ML Confidence Model for Phase X (v1)

Considered as an alternative to the expert-judgment-derived 11-deduction confidence scoring
table. Rejected for v1 because no training/outcome data exists yet — building a learned model
now would be premature optimization dressed as rigor. Revisit once the Golden Question
Regression Set has accumulated real pass/fail data.

## Rejected: A Single Global Human-Review Confidence Threshold

Considered as a simpler alternative to per-advisor thresholds (STRICT/STANDARD/PERMISSIVE).
Rejected because it would conflate the Legal Advisor's compliance stakes with, e.g., the
Notification Advisor's low-stakes lookups — a single threshold could not correctly serve both.

## Rejected: Letting the LLM Self-Report Confidence or Self-Determine Human Review Need

Considered twice (confidence scoring and human-review thresholds). Rejected both times on the
same grounds: well-documented unreliability of LLM self-assessment, and the structural problem
of letting the LLM grade its own homework on the one decision that matters most.

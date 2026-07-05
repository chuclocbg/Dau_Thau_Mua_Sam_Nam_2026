# Roadmap

**Purpose:** What's built, what's next, in what order, and why.

**Audience:** Anyone planning future work.

**Dependencies:** [Project Blueprint](PROJECT_BLUEPRINT.md).

**Related:** [Release History](RELEASE_HISTORY.md) · [`../02_AI_CONTEXT/NEXT_APPROVED_PHASE.md`](../02_AI_CONTEXT/NEXT_APPROVED_PHASE.md)

## Table of Contents

1. [Complete](#complete)
2. [Improved Roadmap (Post-Phase-N Review)](#improved-roadmap-post-phase-n-review)
3. [Why the Roadmap Changed](#why-the-roadmap-changed)

---

## Complete

```
✅ A-I    Business core (frozen)
✅ J      Authentication & Authorization (frozen)
✅ K      Storage & Attachment Service (frozen)
✅ L      Notification Service (frozen)
✅ M0     Docker Infrastructure Foundation (designed, unverified)
✅ M1     Production Prisma Layer (implemented, pending production verification)
✅ N      Knowledge Platform (FROZEN, 16/16 providers) ← current milestone
```

## Improved Roadmap (Post-Phase-N Review)

A dedicated architecture review of the original roadmap recommended these changes, not yet
executed but accepted:

```
⬜ N.5   Knowledge Platform Persistence (Prisma-backed repos + indexes) — NEW, inserted
⬜ O     Supplier / Contractor Registry
⬜ P     Tender Announcement
⬜ Q     Bid Submission
⬜ R     Bid Opening & Evaluation
⬜ S     Contractor Selection & Award
⬜ X.1   Reasoning Layer (no LLM) — NEW, split from X, can start once N.5 lands
⬜ V     Document Generator — MOVED earlier (read-only, no forward deps)
⬜ T     Contract Performance Monitoring — can run parallel to X.1/V
⬜ U     Final Settlement — can run parallel to X.1/V
⬜ X.2   AI Context + LLM Adapter + Output Validation — split from X, depends on X.1
⬜ W     Dashboard & Reporting
⬜ Y     Public Portal (ĐTMUA / eBid)
```

## Why the Roadmap Changed

The original roadmap named "Phase X" as one monolithic AI Advisory phase. The Phase X
architecture review found this conflated two genuinely separable concerns — a pure-logic
Reasoning Layer needing no external API calls, and an LLM/prompt/validation layer needing real
API keys and adversarial testing. Splitting them mirrors exactly how Phase N itself was
staged (core first, providers in controlled batches) and lets X.1 begin without waiting on
LLM procurement decisions. Document Generator (V) was moved earlier because it has no forward
dependency on anything past Payment/Auth and an ADR (`docs/adr/ADR-007-document-generator-read-only.md`)
already justified building it read-only, independent of AI Advisory.

# Architecture Evolution

**Purpose:** How the architecture changed over time — including the genuinely unusual fact
that this repository contains **two coexisting, unrelated commit histories**, and how they
were reconciled rather than silently ignored.

**Related:** [`../02_AI_CONTEXT/REPOSITORY_CONTEXT.md`](../02_AI_CONTEXT/REPOSITORY_CONTEXT.md) · [Decision History](DECISION_HISTORY.md)

## The Two Histories

This repository's `develop` branch contains 37 commits (an earlier, numbered "Phase 8-21"
sequence: an agent/pipeline orchestration framework, a governance workspace, a capability
framework, a session layer) that **predate and are unrelated to** this project's own lettered
A-N phase sequence. They were discovered — not created — during this project's release
preparation, when `git log` revealed the last real commit before this project's own work began
was `7765a02`, "Phase 21: Governance Workspace & Session Layer," dated 2026-06-28.

**Reconciliation performed, not avoided:** rather than ignore this or silently assume it was
this project's own work, a full investigation was done: every commit in the 37-commit range
was individually inspected (hash, title, date, file list), classified (Orchestrator/Governance
Workspace/Session Memory/Capability Framework), and checked at the **file content level** —
not just by directory name — for any overlap with this project's own Phase A-N work. Result:
zero file-level conflicts. Some directory names collide (`src/legal/`, `src/knowledge/`) but
contain entirely different files serving entirely different purposes in each history. This
finding is what allowed the `v1.0-knowledge-platform` release to proceed with confidence rather
than blocking on an unresolved ambiguity.

## Architecture Freeze Reviews

Two formal freeze reviews occurred within this project's own history: Phase E.5 (after
Procurement Planning, established the Constitution and initial ADRs) and Phase H.5-Freeze
(v1.1, after Shared Financial Domain, fixed a RULE-09 violation in `paymentSchedule.ts`).
Neither review found reason to unfreeze anything already frozen — both added new principles
rather than revising old ones.

## The Knowledge Platform's Architectural Significance

Phase N is treated, throughout this documentation system, as the single strongest empirical
result in the repository — not because it's newer, but because its extension pattern
(registration, not modification) was proven 16 separate times across 4 layers with zero core
drift, a stronger validation than any other pattern in the codebase received. This is why
Phase X's architecture deliberately reuses it rather than inventing something new for advisors
and MCP tools.

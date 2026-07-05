# Executive Summary

**Purpose:** Explain what this system is, what problem it solves, and where it stands today,
in enough depth for a stakeholder or a new contributor to orient themselves without reading
the full technical architecture first.

**Audience:** Anyone new to the project — technical or non-technical.

**Dependencies:** None.

**Status:** Current as of `v1.0-knowledge-platform` (2026-07-05).

**Related documents:** [Project Blueprint](PROJECT_BLUEPRINT.md) · [Business Architecture](BUSINESS_ARCHITECTURE.md) · [Roadmap](ROADMAP.md)

---

## Table of Contents

1. [What This Is](#what-this-is)
2. [The Problem](#the-problem)
3. [What Has Been Built](#what-has-been-built)
4. [What Is Approved But Not Yet Built](#what-is-approved-but-not-yet-built)
5. [Current State in Numbers](#current-state-in-numbers)
6. [Governing Principles](#governing-principles)

---

## What This Is

An AI-assisted procurement platform for **Industrial Technical College** (Trường Cao đẳng Kỹ
thuật Công nghiệp), a public non-business unit under the Ministry of Industry and Trade. It
generates procurement dossiers, enforces Vietnamese public-procurement law automatically, and
is designed — from its first line of code — to survive scrutiny from the State Audit Office,
the Ministry of Finance Inspectorate, and the college's own internal auditors.

## The Problem

Public procurement in Vietnam is governed by a dense, frequently-amended stack of laws,
decrees, and circulars (Law No. 22/2023/QH15, Law No. 57/2024/QH15, Law No. 90/2025/QH15,
Decree 214/2025/NĐ-CP, and more — see [Glossary](GLOSSARY.md)). Staff without legal training
must correctly apply the right version of the right rule to every procurement package, every
time, under real audit risk if they get it wrong. Manually cross-referencing this corpus for
every decision — package planning, method selection, approval routing, contract terms,
acceptance procedures, payment schedules — is slow, error-prone, and does not scale.

## What Has Been Built

Thirteen business modules and three infrastructure modules, covering the full procurement
lifecycle from planning through payment, plus a **Knowledge Platform** — a 16-provider system
that stores and resolves applicability of every kind of institutional knowledge (legal text,
templates, checklists, vendor rules, budget rules, risk patterns, past cases, best practices,
and more) without ever hardcoding a legal rule into application logic. See the
[Module Catalog](MODULE_CATALOG.md) for the full list and the
[Knowledge Platform](KNOWLEDGE_PLATFORM.md) document for how the platform works.

Every module was built test-first and is now **frozen** — extended only by adding new files,
never by modifying what already exists and passed review. This discipline is explained in full
in the [Constitution](CONSTITUTION.md) and [Development Guide](DEVELOPMENT_GUIDE.md).

## What Is Approved But Not Yet Built

**Phase X — the AI Advisory Layer** — has a complete, reviewed, and accepted architecture (an
8–10 stage reasoning pipeline, a frozen `AIContext` contract between reasoning and any LLM,
15 advisor profiles spanning every business domain, and a governed path to tool-calling and
multi-agent orchestration once real usage justifies them). **No Phase X code exists yet.** The
full design is in [AI Advisory Architecture](AI_ADVISORY_ARCHITECTURE.md); the reasoning for
why this specific design was chosen over the alternatives is in
[`../04_PROJECT_MEMORY/DECISION_HISTORY.md`](../04_PROJECT_MEMORY/DECISION_HISTORY.md).

## Current State in Numbers

Thirteen business modules, three infrastructure modules, and a 16-provider Knowledge Platform
— all built, tested, and frozen. **For the exact, always-current test counts, release tag, and
milestone status, see [`../02_AI_CONTEXT/CURRENT_RELEASE.md`](../02_AI_CONTEXT/CURRENT_RELEASE.md)
and [`../02_AI_CONTEXT/CURRENT_MILESTONE.md`](../02_AI_CONTEXT/CURRENT_MILESTONE.md)** — this
document does not restate those numbers, so it never goes stale when they change.

## Governing Principles

Every decision in this system traces back to a small set of rules that never bend:

- **Never fabricate.** Not a legal citation, not a quotation, not a test result, not a
  completion status.
- **Never hardcode a legal value.** Thresholds, rules, and citations are data
  (`KnowledgeItem` records), never `if` statements.
- **Never modify a frozen module.** Extend only via new files (Integration Bridge pattern) or
  registration (Knowledge Platform provider pattern).
- **Never claim more than what's verified.** "IMPLEMENTED, PENDING PRODUCTION VERIFICATION" is
  a real, permanent status — not a temporary embarrassment to be upgraded without evidence.

The full, binding statement of these principles is the [Constitution](CONSTITUTION.md).

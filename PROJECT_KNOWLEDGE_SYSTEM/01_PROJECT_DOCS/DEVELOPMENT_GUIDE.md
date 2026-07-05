# Development Guide

**Purpose:** How to build in this codebase without breaking it.

**Audience:** Any developer or AI about to write code.

**Dependencies:** [Constitution](CONSTITUTION.md), [Technical Architecture](TECHNICAL_ARCHITECTURE.md).

**Related:** [`../02_AI_CONTEXT/CODING_RULES.md`](../02_AI_CONTEXT/CODING_RULES.md) · [`../02_AI_CONTEXT/FREEZE_STATUS.md`](../02_AI_CONTEXT/FREEZE_STATUS.md)

## Table of Contents

1. [Before You Write Anything](#before-you-write-anything)
2. [Adding to a Frozen Business Module](#adding-to-a-frozen-business-module)
3. [Adding a Knowledge Platform Provider](#adding-a-knowledge-platform-provider)
4. [The Verification Gate](#the-verification-gate)
5. [What Not To Do](#what-not-to-do)

---

## Before You Write Anything

Read, in order: [Constitution](CONSTITUTION.md) →
[`../02_AI_CONTEXT/FREEZE_STATUS.md`](../02_AI_CONTEXT/FREEZE_STATUS.md) →
[`../02_AI_CONTEXT/ARCHITECTURE_CONSTRAINTS.md`](../02_AI_CONTEXT/ARCHITECTURE_CONSTRAINTS.md).
Confirm which module you're touching is frozen (almost everything is) before writing a line.

## Adding to a Frozen Business Module

You don't. You create a new `*Integration.ts` file that imports the frozen module one-way and
adds behavior around it. Nothing inside the frozen module's own files changes — not a rename,
not a formatting pass, not a comment.

## Adding a Knowledge Platform Provider

1. Implement `IKnowledgeProvider` (`search/resolve/suggest/score`), extending
   `BaseKnowledgeProvider` for the shared implementation.
2. Register: `platform.registerProvider(new YourProvider(repos, graph))`.
3. Write tests proving: full contract compliance, domain isolation, graph relation
   independence from other providers.
4. Write (or extend) an integration test registering your provider alongside all existing
   ones, proving zero core drift.
5. Update `app/docs/knowledge-platform.md` and the relevant `app/.memory/` files.

This exact sequence was followed 16 times without deviation — it is proven, not theoretical.

## The Verification Gate

Every change, before being considered done:

```
npx tsc --noEmit -p .                                    # must be clean
npx vitest run --pool=forks --reporter=dot               # must be 100% passing, zero regressions
```

ESLint is **not** part of this gate (see [`../02_AI_CONTEXT/CODING_RULES.md`](../02_AI_CONTEXT/CODING_RULES.md)
for why) — do not treat a clean lint run as evidence of anything about this codebase's history.

## What Not To Do

- Do not modify a frozen file, ever, even for a "trivial" fix — file a technical debt item instead.
- Do not fabricate a test result, a migration run, or a completion status. "IMPLEMENTED,
  PENDING PRODUCTION VERIFICATION" is a real, acceptable, permanent status.
- Do not build Phase X code without explicit approval — see
  [`../02_AI_CONTEXT/NEXT_APPROVED_PHASE.md`](../02_AI_CONTEXT/NEXT_APPROVED_PHASE.md).
- Do not create a 16th advisor as a new service class — it's a new `AdvisorProfile` data
  record, per [AI Advisory Architecture](AI_ADVISORY_ARCHITECTURE.md).

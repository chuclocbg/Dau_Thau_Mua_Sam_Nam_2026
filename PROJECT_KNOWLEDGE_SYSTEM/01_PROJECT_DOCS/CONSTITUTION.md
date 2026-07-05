# Constitution

**Purpose:** State the non-negotiable rules that govern this project — legal, architectural,
and behavioral — in one place. This document does not replace `app/PROJECT_CONSTITUTION.md`
or the root `CLAUDE.md`; it is the canonical **index and condensed restatement** of both,
written so any reader (human or AI) gets the full rule set without needing to open three files.

**Audience:** Everyone. This is the one document every contributor — human or AI — must read
before writing a single line of code or documentation in this repository.

**Dependencies:** `CLAUDE.md` (repo root), `app/PROJECT_CONSTITUTION.md` — this document
summarizes both; where it and they ever disagree, `CLAUDE.md` and `PROJECT_CONSTITUTION.md`
are authoritative, and this document should be corrected.

**Status:** FROZEN in spirit — the rules below have not changed since the project's
architecture freeze reviews (Phase E.5, H.5) and are not expected to change. New rules may be
*added* (e.g., Knowledge Platform's Rule 7 on open-string relation types, added at Phase N);
existing rules are not rewritten.

**Related documents:** [Development Guide](DEVELOPMENT_GUIDE.md) · [Technical Architecture](TECHNICAL_ARCHITECTURE.md) · [`../04_PROJECT_MEMORY/ARCHITECTURE_EVOLUTION.md`](../04_PROJECT_MEMORY/ARCHITECTURE_EVOLUTION.md)

---

## Table of Contents

1. [Legal & Domain Rules](#legal--domain-rules)
2. [Demo Data Rules](#demo-data-rules)
3. [Technical Specification Rules](#technical-specification-rules)
4. [Architecture Rules](#architecture-rules)
5. [Knowledge Platform Rules](#knowledge-platform-rules)
6. [Testing Rules](#testing-rules)
7. [AI Behavior Rules](#ai-behavior-rules)
8. [Audit-First Principle](#audit-first-principle)

---

## Legal & Domain Rules

Always prefer the newest applicable regulation — 13 instruments, ranked, from Law No.
22/2023/QH15 down to the college's own internal regulations. **Never use expired regulations.
Never fabricate legal references.**

**Content ownership note:** this document states the *rule* (always prefer newer, never
fabricate). The full, exhaustive, ranked citation list — the *reference content* — lives in
exactly one place: [`../03_KNOWLEDGE_BASE/legal/README.md`](../03_KNOWLEDGE_BASE/legal/README.md).
This split is deliberate: rules governing behavior belong in the Constitution; exhaustive
reference material belongs in the Knowledge Base. Neither document repeats the other's full
content — if you need the complete ranked list, follow the link rather than expecting it here.

## Demo Data Rules

Never invent real people, departments, or organizations. Use bracketed placeholders
(`[Tổ trưởng tổ chuyên gia]`, `[Nhà cung cấp số 1]`, etc.). Actual information always comes
from the user. The Expert Team and the Independent Appraisal Team must remain legally
independent from each other in every generated document — never blur this boundary for
convenience.

## Technical Specification Rules

Never hardcode brand names, manufacturers, countries of origin, product codes, or commercial
benchmark scores in generated technical specifications. Always prefer functional requirements
("card đồ họa rời tối thiểu 4GB") and "equivalent or better" framing, to preserve fair
competition.

## Architecture Rules

- **Hexagonal architecture, one-way dependencies.** Interface → Application → Domain →
  Repository Interfaces → Memory/Prisma Repositories. Full detail: [Technical Architecture](TECHNICAL_ARCHITECTURE.md).
- **Frozen modules are never modified.** Extension happens through a new `*Integration.ts`
  bridge file (business modules) or `platform.registerProvider()` (Knowledge Platform). This
  is not a suggestion — every one of the 16 Knowledge Platform providers and every one of the
  13 business modules was extended this way, with zero exceptions, verified by repeated
  integration-test suites at every batch.
- **`Money` is always `bigint`**, never `number`, never `float`. `Money { amount: bigint,
  currency: CurrencyCode }`.
- **Legal citations are always `LegalBasis[]`**, never a bare `string[]`.
- **Knowledge Platform domain is an open string, never an enum.** A new domain requires zero
  type changes anywhere in the platform core.
- **The AI layer (once built) speaks only `AIContext`.** It never calls a repository or a
  Knowledge Platform provider directly.

## Knowledge Platform Rules

(Frozen at Phase N, `docs/knowledge-platform.md` and `app/.memory/knowledge-platform-frozen.md`
are authoritative.) Domain = open string · registration is the only extension mechanism · no
routing `switch`/`if` anywhere in the platform core · `suggest()`/`score()` required on every
provider · `KnowledgeItem` is universal, no domain-specific entity types · relation types are
an open string set, not an enum · applicability rules are universal across every domain.

## Testing Rules

Unit, integration, and regression tests are maintained for every module. **Business logic is
never modified while writing tests** — if a test reveals a real bug, the bug is fixed and
disclosed as a fix, not silently absorbed into "test updates." The full suite (currently 395
files, 13,721 tests) must pass before any release is tagged.

## AI Behavior Rules

Explain reasoning. Preserve traceability. Prefer incremental improvement over rewrites. Ask at
most three clarifying questions when information is missing (estimated value, package type,
funding source) — never more. Classify every code-review or audit finding as `[CRITICAL]`,
`[HIGH]`, `[MEDIUM]`, or `[LOW]`, each with description, impact, and recommendation. **Never
fabricate a completed task, a test result, a migration run, or a legal citation** — if
something cannot be verified, say so explicitly (e.g., "IMPLEMENTED, PENDING PRODUCTION
VERIFICATION," never "COMPLETE").

## Audit-First Principle

Assume every dossier this system produces will be reviewed by the State Audit Office, the
Ministry of Finance Inspectorate, the Ministry of Industry and Trade Inspectorate, and internal
auditors. Flag risk wherever it exists, using the same `[CRITICAL]/[HIGH]/[MEDIUM]/[LOW]`
severity scale used for code review. Never split a package to dodge a procurement threshold.
Never lock a technical specification to one brand. Never fabricate a quotation, a price, a
catalogue, or a citation.

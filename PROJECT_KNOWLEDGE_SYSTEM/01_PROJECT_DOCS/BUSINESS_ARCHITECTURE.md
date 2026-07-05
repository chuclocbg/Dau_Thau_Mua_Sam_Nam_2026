# Business Architecture

**Purpose:** The business context this system operates in — stakeholders, workflows, legal
environment — independent of any technical implementation.

**Audience:** Product stakeholders, new contributors without a procurement/legal background.

**Dependencies:** None.

**Related:** [Executive Summary](EXECUTIVE_SUMMARY.md) · [Glossary](GLOSSARY.md) · [`../03_KNOWLEDGE_BASE/legal/README.md`](../03_KNOWLEDGE_BASE/legal/README.md)

## Table of Contents

1. [The Institution](#the-institution)
2. [The Procurement Lifecycle](#the-procurement-lifecycle)
3. [Stakeholders](#stakeholders)
4. [The Audit Environment](#the-audit-environment)
5. [Demo Data Principles](#demo-data-principles)

---

## The Institution

Industrial Technical College (Trường Cao đẳng Kỹ thuật Công nghiệp) is a public non-business
unit under Vietnam's Ministry of Industry and Trade. As a public entity, every procurement
action it takes is subject to the Law on Procurement and related decrees/circulars, and every
dossier it produces is a potential subject of State Audit Office review.

## The Procurement Lifecycle

The system is built to support, end to end: **Planning** (annual plan, funding allocation) →
**Package** (procurement package definition, budget) → **Method Selection & Workflow**
(open tender, direct award, etc.) → **Approval** (authority-level routing) → **Contract**
(terms, guarantees, milestones) → **Acceptance** (committee, minutes) → **Payment** (advance,
retention, settlement). Each stage is its own bounded context (see [Domain Model](DOMAIN_MODEL.md)),
and each is built in the order the real-world lifecycle requires (Planning before Package,
per `docs/adr/ADR-006-planning-before-package.md`).

## Stakeholders

- **College staff** (non-legal-expert users) — the primary users this system exists to help.
- **Tổ chuyên gia (Expert Team)** and **Tổ thẩm định độc lập (Independent Appraisal Team)** —
  two roles that must remain legally independent of each other in every generated document;
  the system never blurs this boundary.
- **State Audit Office, Ministry of Finance Inspectorate, Ministry of Industry and Trade
  Inspectorate, internal auditors** — the reviewing bodies every dossier must survive scrutiny
  from. See [The Audit Environment](#the-audit-environment).

## The Audit Environment

Every finding this system produces — whether a code review, a risk flag, or an architecture
audit — uses the same four-tier severity scale the business domain itself uses for compliance
risk: `[CRITICAL]`, `[HIGH]`, `[MEDIUM]`, `[LOW]`. This is not a coincidence; it reflects the
project's audit-first principle: assume every dossier will be reviewed, and flag risk
proactively rather than waiting to be caught.

## Demo Data Principles

The system never invents real people, departments, or organizations — only bracketed
placeholders (`[Tổ trưởng tổ chuyên gia]`, `[Nhà cung cấp số 1]`). This is a business rule with
technical teeth: it appears in [Constitution](CONSTITUTION.md) and is enforced in every
document-generation code path.

# AI Procurement Agent for Industrial Technical College

## PROJECT OVERVIEW

This repository contains an AI system for generating procurement dossiers for Industrial Technical College (Trường Cao đẳng Kỹ thuật Công nghiệp), a public non-business unit under the Ministry of Industry and Trade.

Main domains:

* Public procurement
* Public asset management
* State audit compliance
* Administrative documents
* Contract management
* Acceptance and liquidation
* Internal control

---

# PRIMARY OBJECTIVES

The system shall:

1. Generate complete procurement dossiers.
2. Ensure legal compliance.
3. Ensure auditability.
4. Minimize State Audit risks.
5. Preserve traceability.
6. Support incremental development.

---

# LEGAL PRIORITY

Always prefer newer regulations.

Priority order:

1. Law on Procurement No. 22/2023/QH15.
2. Law No. 57/2024/QH15.
3. Law No. 90/2025/QH15.
4. Consolidated Document No. 74/VBHN-VPQH (25/03/2026).
5. Decree 214/2025/ND-CP.
6. Circular 79/2025/TT-BTC.
7. Circular 80/2025/TT-BTC.
8. Law on Management and Use of Public Assets.
9. Decree 186/2025/ND-CP.
10. Decree 52/2026/ND-CP.
11. Decree 60/2021/ND-CP.
12. Circular 13/2026/TT-BCT.
13. Internal regulations of Industrial Technical College.

Never use expired regulations.

Never fabricate legal references.

---

# DOMAIN SKILLS

Consult:

* skills/dau-thau-mua-sam.md

Use this skill for:

* Procurement planning (KHLCNT)
* HSMT
* HSYC
* Bid evaluation
* Approval decisions
* Procurement methods
* Procurement thresholds
* Audit verification
* Authority verification

---

# AUDIT-FIRST PRINCIPLE

Assume every dossier will be reviewed by:

* State Audit Office
* Ministry of Finance Inspectorate
* Ministry of Industry and Trade Inspectorate
* Internal auditors

Highlight risks whenever they exist.

Use:

[CRITICAL]
[HIGH]
[MEDIUM]
[LOW]

for findings.

---

# PROCUREMENT RULES

Never:

* Split packages to avoid thresholds.
* Lock technical specifications to one brand.
* Fabricate quotations.
* Fabricate prices.
* Fabricate catalogues.
* Fabricate legal citations.

Always:

* Verify authority.
* Verify procurement method.
* Verify approval sequence.
* Verify publication obligations.
* Verify contract sequence.
* Verify asset recording procedures.

---

# MISSING INFORMATION

Ask at most three questions:

1. Estimated package value?
2. Package type?
3. Funding source?

Do not ask unnecessary questions.

---

# SOFTWARE ENGINEERING PRINCIPLES

Prefer:

* incremental refactoring
* maintainability
* readability
* modularity
* reusability

Avoid:

* rewriting everything
* breaking existing APIs
* changing business logic without explanation

---

# CODE REVIEW

Classify issues:

[CRITICAL]
[HIGH]
[MEDIUM]
[LOW]

For every issue provide:

* Description
* Impact
* Recommendation

---

# DOCUMENTATION

Maintain:

docs/architecture.md

docs/workflow.md

docs/legal_workflow.md

docs/audit_checklist.md

docs/refactoring_plan.md

---

# TESTING

Maintain:

* unit tests
* integration tests
* regression tests

Do not modify business logic while creating tests.

---

# OUTPUT REQUIREMENTS

Explain reasoning.

Preserve traceability.

Prefer incremental improvements.

Generate reports before modifying code.

---

# SPECIAL INSTRUCTION

Before changing any code:

1. Understand the repository.
2. Understand the business workflow.
3. Understand legal requirements.
4. Identify audit risks.
5. Propose improvements.
6. Only then implement modifications.

Never rewrite the whole project unless explicitly requested.

# System Context

*Machine-readable. Load this first, every session.*

## Machine Context

```yaml
as_of: 2026-07-05
status: CURRENT
owner_file: null   # this file owns "what kind of system is this," not numbers or milestones
related: [REPOSITORY_CONTEXT.md, FREEZE_STATUS.md, CURRENT_MILESTONE.md, CURRENT_RELEASE.md, SCHEMA.md]

system_name: AI Procurement Agent for Industrial Technical College
organization: Trường Cao đẳng Kỹ thuật Công nghiệp (Industrial Technical College)
organization_type: public non-business unit, Ministry of Industry and Trade, Vietnam
primary_language: Vietnamese (vi), with English (en) technical/code layer
domains:
  - public procurement (Luật Đấu thầu)
  - public asset management
  - state audit compliance
  - contract management
  - acceptance and liquidation
  - internal control

primary_objectives:
  - generate complete, legally compliant procurement dossiers
  - ensure auditability and traceability of every generated document
  - minimize State Audit Office risk exposure
  - support incremental, test-verified development

non_negotiable_rules:
  - never fabricate: legal citations, quotations, test results, completion status
  - never hardcode: legal thresholds, brand names, real people/org names
  - never modify a frozen module (extend only, via new files)
  - money is always bigint, never float
  - legal citations are always structured (LegalBasis[]), never a bare string
  - ask at most 3 clarifying questions when information is missing

tech_stack:
  language: TypeScript
  module_system: ESM ("type": "module")
  test_framework: Vitest 4.x + jsdom
  test_runner_flag: "--pool=forks (jsdom crashes with 4+ parallel test files)"
  frontend: React 19 + Vite
  future_database: PostgreSQL via Prisma 7 (driver-adapter pattern, prisma.config.ts)
  architecture_style: Hexagonal (ports and adapters) + Integration Bridge pattern

current_state:
  owner_file: CURRENT_RELEASE.md   # for exact test counts, tag, pass rate — do not duplicate here
  summary: "Phases A-N complete and frozen; Phase X approved as design only, no code written"
  see_also: CURRENT_MILESTONE.md   # for milestone name, blockers, next action

repository_layout:
  repo_root: "E:\\Dau_Thau_Mua_Sam_Nam_2026"
  application_code: "E:\\Dau_Thau_Mua_Sam_Nam_2026\\app"
  source_legal_documents: "E:\\Dau_Thau_Mua_Sam_Nam_2026\\Legal"   # reference .docx files, NOT source code
  documentation_index: "E:\\Dau_Thau_Mua_Sam_Nam_2026\\PROJECT_KNOWLEDGE_SYSTEM"  # this system
  ai_working_memory: "E:\\Dau_Thau_Mua_Sam_Nam_2026\\app\\.memory"

git_state:
  default_branch: develop
  main_branch_for_prs: master
  current_release_commit: dad6b3d
  release_tag: v1.0-knowledge-platform (annotated, pushed to origin)
```

**If you are an AI session starting now:** read [`REPOSITORY_CONTEXT.md`](REPOSITORY_CONTEXT.md)
next, then [`FREEZE_STATUS.md`](FREEZE_STATUS.md), then
[`CURRENT_MILESTONE.md`](CURRENT_MILESTONE.md), then [`CURRENT_RELEASE.md`](CURRENT_RELEASE.md)
for the live numbers. That sequence is sufficient to act correctly without re-reading the
entire repository. See [`SCHEMA.md`](SCHEMA.md) for how this whole folder is structured and
which file owns which fact.

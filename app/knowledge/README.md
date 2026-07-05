# Platform Knowledge Base

Permanent reference knowledge for the AI-Assisted Procurement Platform.

This directory is the static knowledge corpus for the Knowledge Platform (Phase N, `src/knowledge/`). It maps directly to the provider domains managed at runtime.

`.memory/` holds session continuity. `knowledge/` holds domain truth.

---

## Domain Index

| Domain Code | Provider | Content |
|-------------|---------|---------|
| `legal` | LegalIntelligenceProvider | Laws, decrees, circulars, official letters, consolidated docs, internal regs |
| `procurement` | ProcurementKnowledgeProvider | Methods, workflows, lifecycle, approval rules, evaluation rules, contract rules |
| `templates` | TemplateProvider | HSMT, HSYC, KHLCNT, contracts, acceptance reports, payment forms, audit forms |
| `masterdata` | MasterDataKnowledgeProvider | Departments, budget codes, funding sources, package types |
| `audit` | AuditKnowledgeProvider | State Audit findings, inspector conclusions, common mistakes, compliance checklists |
| `cases` | CaseKnowledgeProvider | Previous procurement cases, decision history, similar package search |
| `risk` | RiskKnowledgeProvider | Procurement risks, conflict of interest, fraud patterns, red flags |
| `ontology` | OntologyProvider | Domain concepts, synonyms, Vietnamese procurement terminology |
| `glossary` | GlossaryProvider | Vietnamese legal definitions, term translations, abbreviations |
| `school` | SchoolRegulationProvider | Internal regulations, spending rules, procurement procedures, asset management |

---

## File Index

### Architecture
- [System Overview](architecture/overview.md) — layer stack, module map, build order
- [Integration Bridges](architecture/integration-bridges.md)
- [Data Flow](architecture/data-flow.md)

### Legal Domain (`legal/`)
- [Vietnamese Legal Hierarchy](legal/hierarchy.md) — 14 authority levels
- [Current Procurement Law Corpus](legal/procurement-laws.md) — active laws, amendment chains
- [Legal Concepts Ontology](legal/legal-concepts.md) — procurement concept graph
- [Knowledge Platform Design](legal/knowledge-engine.md) — Phase N architecture (legal provider view)

### Procurement Domain (`procurement/`)
- [Full Procurement Lifecycle](procurement/lifecycle.md) — 19 stages
- [Approval Authority Table](procurement/approval-authority.md)
- [Method Selection Logic](procurement/method-selection.md)
- [Evaluation Criteria](procurement/evaluation-criteria.md)

### Templates Domain (`templates/`)
- [Template Catalog](templates/catalog.md) — all template types and applicable contexts
- [HSMT Reference](templates/hsmt.md) — tender document template structure
- [HSYC Reference](templates/hsyc.md) — request for quotation template

### Audit Domain (`audit/`)
- [Common Procurement Mistakes](audit/common-mistakes.md)
- [Compliance Checklists](audit/checklists.md)
- [State Audit Finding Patterns](audit/audit-findings.md)

### Cases Domain (`cases/`)
- [Case Structure](cases/structure.md) — how procurement cases are modeled as knowledge
- [Decision Patterns](cases/decision-patterns.md)

### Risk Domain (`risk/`)
- [Risk Taxonomy](risk/taxonomy.md) — all risk types and categories
- [Fraud Patterns](risk/fraud-patterns.md)
- [Conflict of Interest Indicators](risk/conflict-of-interest.md)
- [Red Flags](risk/red-flags.md)

### Ontology Domain (`ontology/`)
- [Concept Graph](ontology/concepts.md) — procurement domain ontology
- [Synonyms](ontology/synonyms.md) — term normalization

### Glossary Domain (`glossary/`)
- [Vietnamese Legal Abbreviations](glossary/abbreviations.md)
- [Vietnamese–English Term Mapping](glossary/vietnamese-terms.md)
- [Entity Type Catalog](glossary/entity-types.md)

### Master Data Domain (`masterdata/`)
- [Entity Catalog](masterdata/entity-catalog.md)
- [Seed Values](masterdata/seed-values.md)

### School / Institutional Domain (`school/`)
- [Internal Regulation Types](school/regulation-types.md)
- [Spending Rule Categories](school/spending-rules.md)

### AI Context Contract (`ai-advisory/`) — Phase N3

The frozen contract between the Reasoning Layer and the AI/LLM layer.

- [AI Context Contract Decision](decisions/ai-context-contract.md) — master decision; 3-layer stack; 8 immutable AI boundary rules; source layout; Phase X constraints
- [AIContext Schema](ai-advisory/context.md) — AIContext · AIContextIntent · AIContextLegalBasis · AIContextCitation · AIContextEvidence · AIContextWarning · AIContextAction · AIContextMessage · AIContextSystemInstructions
- [AIContextBuilder](ai-advisory/builder.md) — build strategy (15 steps) · token budget management · compression priority order · recommendedAction derivation rules
- [LLM Adapter & Model Abstraction](ai-advisory/adapter.md) — ILLMAdapter · 4 adapter implementations (Claude/OpenAI/Gemini/Local) · ModelCapabilities · ModelCapabilityRegistry · ModelSelector · retry policy
- [Prompt Lifecycle](ai-advisory/prompts.md) — PromptBuilder (12 sections) · TokenBudgetManager · PromptRenderer (per-model format) · streaming support
- [Output Validation](ai-advisory/validation.md) — 6 validation checks · citation integrity · numeric consistency · decision contradiction · hallucination redaction · validation log

### Legal Reasoning Architecture (`reasoning/`) — Phase N2

Design specification for the Legal Reasoning Layer. Separates reasoning from knowledge retrieval permanently.

- [Reasoning Architecture Decision](decisions/reasoning-architecture.md) — master decision; two-layer model; 8 immutable rules; source layout; performance targets
- [Type Definitions](reasoning/types.md) — ReasoningQuestion · ReasoningResult · ReasoningIntent · AppliedArticle · FormattedCitation · DetectedConflict · RuleResult · ThresholdResult · ConfidenceComponents · ReasoningExplanation · ILegalReasoningEngine
- [Pipeline](reasoning/pipeline.md) — 8 stages; 15 responsibilities mapped to stages; inter-stage data contract; PipelineState
- [Conflict Resolution](reasoning/conflict.md) — 4-tier cascade: hierarchy → more-restrictive → lex posterior → lex specialis → UNRESOLVED; 4 worked examples
- [Rule Engine](reasoning/rules.md) — rule/threshold KnowledgeItem schemas; founding rule set (12 rules); exception pattern registry (10 patterns); IRuleEvaluator

### Corpus Foundation (`corpus/`) — Phase N1

Complete specification for the corpus layer that backs all 16 providers.

- [Corpus Foundation Decision](decisions/corpus-foundation.md) — master decision; two-layer model; scale targets; key design decisions
- [Schema](corpus/schema.md) — KnowledgeObject · KnowledgeVersion · KnowledgeSource · Citation model · ImportBatch
- [Hierarchy](corpus/hierarchy.md) — document hierarchy per domain · legal authority levels 1–14 · hierarchyPath encoding · document type registry
- [Lifecycle & Versioning](corpus/lifecycle.md) — 6 lifecycle states · immutable versioning · amendment chains · retention policy per domain
- [Metadata & Tagging](corpus/metadata.md) — 4-tier metadata standard · 16 tagging facets · auto-tagging rules · 20+ ontology relation types · KnowledgeApplicabilityRule
- [Quality Score & Validation](corpus/quality.md) — 6-dimension scoring model · quality gates · 8-stage validation pipeline · re-validation triggers
- [Pipelines](corpus/pipelines.md) — bulk import · single import · incremental update · amendment detection · 4 indexes · bootstrap order

### Architecture Decision Records
- [ADR Index](adr/index.md)

### Design Decisions
- [Knowledge Platform V2 (FROZEN)](decisions/knowledge-platform-v2.md) — 16 providers, 4 layers, 14 API methods; FROZEN 2026-07-03
- [Corpus Foundation](decisions/corpus-foundation.md) — Phase N1 corpus specification
- [Knowledge Platform V1](decisions/knowledge-platform.md) — superseded by V2
- [Infrastructure Architecture](decisions/infrastructure.md)
- [Legal Engine (original)](decisions/legal-engine.md) — superseded by Knowledge Platform V2
- [Module Boundaries](decisions/module-boundaries.md)
- [Financial Domain](decisions/financial-domain.md)

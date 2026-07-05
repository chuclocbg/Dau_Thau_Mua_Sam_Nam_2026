# Glossary

**Purpose:** The essential terms needed to onboard quickly — both domain (Vietnamese
procurement law) and technical (this codebase's own vocabulary).

**Scope note (content ownership):** This is a **curated, ~50-term onboarding glossary**, not
an exhaustive reference. The complete, exhaustive glossary — every legal term, every
abbreviation, every ontology relationship — lives in
[`../03_KNOWLEDGE_BASE/glossary/README.md`](../03_KNOWLEDGE_BASE/glossary/README.md) and the
Knowledge Platform's own `GlossaryProvider`/`OntologyProvider`. If a term isn't here, look
there before assuming it doesn't exist.

**Audience:** New contributors, human or AI.

## Domain Terms (Vietnamese Procurement Law)

| Term | English | Meaning |
|---|---|---|
| KHLCNT | Procurement plan | Kế hoạch lựa chọn nhà thầu — the annual/package-level procurement plan |
| HSMT | Bidding documents | Hồ sơ mời thầu — the tender/bid solicitation document |
| HSYC | Request documents | Hồ sơ yêu cầu — used for simpler procurement methods |
| Tổ chuyên gia | Expert Team | Evaluates bids; must stay independent from the Appraisal Team |
| Tổ thẩm định độc lập | Independent Appraisal Team | Reviews the Expert Team's evaluation independently |
| Chỉ định thầu | Direct award/appointment | A non-competitive procurement method, used below certain thresholds |
| Đấu thầu rộng rãi | Open tender | The default, most competitive procurement method |
| Bảo lãnh dự thầu | Bid security/guarantee | Financial guarantee submitted with a bid |
| Bảo lãnh tạm ứng | Advance payment guarantee | Financial guarantee required before an advance payment |
| Nghiệm thu | Acceptance | The formal acceptance/inspection procedure after delivery |

## Technical Terms (This Codebase)

| Term | Meaning |
|---|---|
| Frozen module | A module whose files may never be edited again; extended only via new files |
| Integration Bridge | The `*Integration.ts` one-way import pattern for cross-module access |
| Knowledge Platform | The 16-provider system resolving applicability of institutional knowledge |
| Provider | A Knowledge Platform plugin owning one domain (e.g., `legal`, `budget`) |
| `KnowledgeItem` | The universal entity type for every kind of knowledge, across all 16 providers |
| `AdvisorProfile` | A Phase X advisor, modeled as a data record, not a service class |
| `AIContext` | The frozen, single contract between Phase X's Reasoning Engine and any LLM |
| ADR | Architecture Decision Record — Context/Decision/Alternatives/Consequences format |
| `.memory/` | The AI's own persistent, session-to-session working memory (different from this system) |
| Golden Question | A fixed regression-test question with an expected answer, used to catch AI reasoning drift |

## Where the Rest Lives

- Full legal corpus and citation priority: [`../03_KNOWLEDGE_BASE/legal/README.md`](../03_KNOWLEDGE_BASE/legal/README.md)
- Full ontology (synonym/broader-narrower relationships): [`../03_KNOWLEDGE_BASE/ontology/README.md`](../03_KNOWLEDGE_BASE/ontology/README.md)
- Full abbreviation and translation glossary: [`../03_KNOWLEDGE_BASE/glossary/README.md`](../03_KNOWLEDGE_BASE/glossary/README.md)

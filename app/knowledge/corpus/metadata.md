# Corpus Metadata Standard · Tagging Strategy · Ontology Relationships

Part of: [corpus-foundation.md](../decisions/corpus-foundation.md)

---

## 1. Metadata Standard

Four tiers of metadata. Tier 1 is mandatory on every object. Tier 2 is mandatory for applicable domains. Tier 3 is recommended. Tier 4 is domain-defined.

### Tier 1 — Required on ALL KnowledgeObjects

| Field | Type | Constraint | Validation |
|-------|------|-----------|------------|
| `objectId` | UUID | System-generated | Auto-set on create |
| `domain` | string | Open string; not empty | Must match registered provider domain |
| `objectType` | string | Open string from domain registry | Must be in domain's objectType list |
| `title` | string | 3–500 chars | Non-empty; title-cased recommended |
| `summary` | string | 20–1000 chars | Non-empty; complete sentence(s) |
| `language` | string | ISO 639 + '+' combinator | 'vi', 'en', 'vi+en' |
| `effectiveFrom` | ISO date | YYYY-MM-DD | Must be ≤ today on activation |
| `lifecycleStatus` | enum | Default 'DRAFT' | State machine transitions only |
| `qualityScore.overall` | float 0–1 | Computed | Not directly editable |
| `sourceId` | UUID | FK → KnowledgeSource | Source must be active and not deleted |
| `importedAt` | ISO datetime | System-set | Auto-set on create |

Missing any Tier 1 field: CRITICAL validation error; object stays in DRAFT; cannot enter REVIEW.

### Tier 2 — Required for legal, school, ministry domains

| Field | Type | Constraint | Validation |
|-------|------|-----------|------------|
| `documentSymbol` | string | Pattern: `\d+/\d+/[A-Z\-]+` | Regex validation |
| `documentType` | string | From document type registry | Must be in registered type list |
| `issuingBody` | string | From authority registry | Standardized code (see hierarchy.md) |
| `signedDate` | ISO date | YYYY-MM-DD | ≤ issuedDate ≤ effectiveFrom |
| `gazetteNumber` | string | Non-empty | Required for OFFICIAL_GAZETTE source |
| `gazetteDate` | ISO date | YYYY-MM-DD | ≤ effectiveFrom |

Missing Tier 2 field for applicable domain: HIGH validation error; quality score reduced; can still enter REVIEW.

### Tier 3 — Recommended for all objects

| Field | Target | Default |
|-------|--------|---------|
| `keywords` | 3–30 terms; multilingual | Auto-extracted from title + summary |
| `parentObjectId` | For sub-document objects | null for root documents |
| `hierarchyPath` | Full path encoding | Auto-computed from parentObjectId chain |
| `wordCount` | From extraction | Auto-computed |
| `externalRef` | Link to source system ID | null |
| `tags` | See tagging strategy | Auto-applied at import |

Missing Tier 3 fields: LOW validation warning; no quality penalty except `coverage` dimension.

### Tier 4 — Domain-specific (in `structuredData`)

Each domain defines its own `structuredData` schema in a schema definition file. The validation pipeline applies the domain schema at Stage 3. Schema violations are logged as domain-specific errors.

| Domain | Schema Location | Key Fields |
|--------|----------------|-----------|
| `legal` | `src/knowledge/providers/legal/legalObjectSchema.ts` | chapters[], articles[], clauses[], keywords_vi, keywords_en |
| `templates` | `src/knowledge/providers/templates/templateObjectSchema.ts` | templateCode, applicableMethod[], sections[], fields[] |
| `cases` | `src/knowledge/providers/cases/caseObjectSchema.ts` | caseYear, packageType, contractValue, outcome, lessonsLearned[] |
| `risk` | `src/knowledge/providers/risk/riskObjectSchema.ts` | riskCategory, frequency, indicators[], mitigations[] |
| `audit` | `src/knowledge/providers/audit/auditObjectSchema.ts` | findingCode, phase, severity, correctPractice |
| `glossary` | `src/knowledge/providers/glossary/glossaryObjectSchema.ts` | termVi, termEn, abbreviation, definition, seeAlso[] |
| `ontology` | `src/knowledge/providers/ontology/ontologyObjectSchema.ts` | conceptId, broader[], narrower[], related[], synonyms[] |
| `school` | `src/knowledge/providers/school/schoolObjectSchema.ts` | regulationType, issuingBody, overridesLaw, keyProvisions[] |

---

## 2. Tagging Strategy

Tags are multi-faceted. Each tag has a `facet` (dimension) and a `value` (the tag value within that dimension). Tags are attached to `KnowledgeObject` and inherited by child objects.

```typescript
interface KnowledgeTag {
  facet:       string      // from standard facet registry
  value:       string      // open string within that facet
  source:      'MANUAL' | 'AUTO_RULE' | 'AI_EXTRACTED' | 'ONTOLOGY_INFERRED'
  confidence?: number      // 0–1; required for AI_EXTRACTED and ONTOLOGY_INFERRED
  addedAt:     string
  addedBy?:    string      // userId; only for MANUAL
}
```

### Standard Facet Registry

| Facet | Purpose | Example Values |
|-------|---------|---------------|
| `domain` | Knowledge domain | `legal`, `procurement`, `risk`, `audit` |
| `legal_domain` | Legal subject area | `procurement_law`, `budget_law`, `construction_law`, `audit_law` |
| `process_phase` | Procurement lifecycle phase | `planning`, `tender`, `evaluation`, `contract`, `acceptance`, `payment` |
| `package_type` | Applicable package type | `GOODS`, `CONSTRUCTION`, `CONSULTING`, `MIXED` |
| `procurement_method` | Applicable method | `OPEN_TENDER`, `LIMITED_TENDER`, `DIRECT_AWARD`, `QUOTES`, `COMPETITIVE_OFFER` |
| `fund_source` | Fund source applicability | `STATE_BUDGET`, `ODA`, `PPP`, `ENTERPRISE`, `MIXED` |
| `value_range` | Monetary threshold | `BELOW_50M`, `50M_TO_200M`, `200M_TO_1B`, `1B_TO_5B`, `ABOVE_5B` |
| `issuing_body` | Who issued the document | `QH`, `CP`, `BTC`, `BKHDT`, `BXD`, `BCT`, `KTNN` |
| `document_type` | Legal document type | `LAW`, `DECREE`, `CIRCULAR`, `OFFICIAL_LETTER`, `CONSOLIDATED` |
| `status` | Content status | `active`, `superseded`, `draft`, `historical` |
| `risk_level` | Risk classification | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` |
| `frequency` | How commonly applicable | `ALWAYS`, `OFTEN`, `SOMETIMES`, `RARELY` |
| `audience` | Who this is intended for | `procurement_officer`, `approver`, `legal_staff`, `auditor`, `supplier`, `executive` |
| `region` | Geographic scope | `NATIONWIDE`, `HANOI`, `HCMC`, `DANANG`, or province code |
| `year` | Year of primary relevance | `2022`, `2023`, `2024`, `2025`, `2026` |
| `urgency` | Time sensitivity | `IMMEDIATE`, `HIGH`, `NORMAL`, `LOW` |

**Facet registry is open.** New facets are added as rows in a `tag_facet_registry` table. No code change required to add a new facet.

### Auto-Tagging Rules (applied at Stage 3 of Validation Pipeline)

These rules fire automatically at import time. Manual tags override auto-applied tags on the same facet.

```
RULE AT-01: domain tag
  → always applied; value = KnowledgeObject.domain

RULE AT-02: document_type tag (for domain IN ['legal', 'school', 'ministry'])
  → parse documentSymbol to extract document type code
  → map code to tag value (ND-CP → 'DECREE', TT-BTC → 'CIRCULAR', etc.)

RULE AT-03: issuing_body tag
  → parse issuingBody field; map to standard code

RULE AT-04: year tag
  → extract from documentYear or effectiveFrom

RULE AT-05: process_phase tag
  → keyword match on title + summary against phase keyword lists:
      planning:   ['kế hoạch', 'dự toán', 'phê duyệt kế hoạch', 'lập kế hoạch']
      tender:     ['đấu thầu', 'hồ sơ mời thầu', 'mời thầu', 'đăng tải']
      evaluation: ['đánh giá', 'xét thầu', 'chấm thầu', 'hội đồng']
      contract:   ['hợp đồng', 'ký kết', 'điều khoản hợp đồng']
      acceptance: ['nghiệm thu', 'bàn giao', 'kiểm tra chất lượng']
      payment:    ['thanh toán', 'tạm ứng', 'quyết toán', 'chi trả']
  → a document may get multiple process_phase tags

RULE AT-06: package_type tag
  → keyword match:
      GOODS:        ['hàng hóa', 'mua sắm', 'vật tư', 'thiết bị']
      CONSTRUCTION: ['xây dựng', 'công trình', 'thi công', 'xây lắp']
      CONSULTING:   ['tư vấn', 'thiết kế', 'giám sát']
  → multi-value allowed

RULE AT-07: status tag
  → derived from lifecycleStatus:
      ACTIVE → 'active'
      SUPERSEDED → 'superseded'
      DRAFT, REVIEW → 'draft'
      ARCHIVED → 'historical'

RULE AT-08: region tag
  → 'NATIONWIDE' as default for national laws
  → province-specific if title/summary contains province name
```

### Tag Inheritance

Tags on a parent object are automatically inherited by all children unless explicitly overridden.

```
law:22/2023/QH15 tagged with:
  domain=legal, legal_domain=procurement_law, issuing_body=QH, year=2023, region=NATIONWIDE

All its articles (dieu:15, dieu:16, ...) automatically inherit:
  domain=legal, legal_domain=procurement_law, issuing_body=QH, year=2023, region=NATIONWIDE

Article dieu:15 additionally tagged (more specific):
  process_phase=payment (auto-rule based on article title 'Thanh toán')
```

---

## 3. Ontology Relationships

The full relationship taxonomy for the corpus layer. These are stored as `KnowledgeRelation` records with the `relationType` field. The corpus layer has more relation types than the runtime `KnowledgeGraph` — the extra types are corpus-internal structural relations.

### Group A — Legal-Structural (between legal documents)

| Relation | From | To | Semantics |
|----------|------|----|-----------| 
| `IMPLEMENTS` | Decree/Circular | Law/Decree | Lower authority implementing provisions of higher authority |
| `AMENDS` | Amending doc | Original doc | Partial change; original doc continues with modifications |
| `REPLACES` | New doc | Old doc | Full replacement; old doc entirely superseded |
| `REPEALS` | Repealing doc | Repealed doc | Old doc no longer in legal force |
| `SUPPLEMENTS` | Supplement | Base doc | Adds provisions without changing the base document |
| `CONSOLIDATES` | VBHN | Source docs | Consolidation document (no independent force) |
| `INTERPRETS` | Circular/CV | Law/Decree | Official ministry interpretation; not independently binding |
| `DELEGATES` | Child doc | Parent doc | Authority delegated from the parent document |
| `SUPERSEDES_ARTICLE` | New article | Old article | Article-level supersession (partial amendment) |

### Group B — Content-Structural (hierarchical)

| Relation | From | To | Semantics |
|----------|------|----|-----------| 
| `CONTAINS` | Parent | Child | Hierarchical containment (document → article → clause) |
| `PRECEDES` | Item N | Item N+1 | Sequential ordering within same parent |
| `CROSS_REFERENCES` | Article A | Article B | Explicit cross-reference within same document ('as per Điều 5') |
| `REFERENCES` | Any | Any | General citation; non-directive |

### Group C — Cross-Domain Operational (runtime KnowledgeGraph types)

These map to the 10 types in the frozen `KnowledgeGraph` model. Used at runtime.

| Relation | From | To | Semantics |
|----------|------|----|-----------| 
| `REQUIRES` | Process step | Document/checklist | Step legally requires this artifact |
| `GENERATES` | Process step | Document/form | Step produces this output document |
| `USES_TEMPLATE` | Workflow/process | Template | Workflow uses this template |
| `USES_CHECKLIST` | Workflow/process | Checklist | Workflow requires this checklist |
| `DEPENDS_ON` | Item | Prerequisite | Item is only valid if prerequisite is met |

### Group D — Experience Relations (Layer 4)

| Relation | From | To | Semantics |
|----------|------|----|-----------| 
| `EXEMPLIFIED_BY` | Law/rule | Case | Abstract provision illustrated by concrete case |
| `ILLUSTRATES` | Case | Law/rule | Reverse of EXEMPLIFIED_BY |
| `RISKS_TO` | Process step | Risk pattern | This step is subject to this risk |
| `MITIGATED_BY` | Risk | Best practice | Risk mitigated by this practice |
| `FOUND_BY` | Audit finding | Audit process | Finding discovered via this audit item |
| `SIMILAR_TO` | Case/Risk | Case/Risk | Pattern similarity (weight: 0–1 computed) |
| `RELATED_TO` | Any | Any | General semantic similarity; catch-all |

### Relation Storage

```typescript
interface KnowledgeRelation {
  relationId:    string
  fromObjectId:  string
  toObjectId:    string
  relationType:  string           // open string constant from the taxonomy above
  weight?:       number           // 0–1; strength/confidence of relation
                                  //   explicit structural: 1.0
                                  //   auto-extracted citation: 0.85
                                  //   AI-inferred: 0.6–0.8
                                  //   SIMILAR_TO: computed similarity score
  source:        'EXPLICIT'       // stated in the document text
               | 'AUTO_EXTRACTED' // extracted by citation parser
               | 'AI_INFERRED'    // inferred by AI; pending review
               | 'MANUAL'         // added by staff
  isVerified:    boolean          // false for AI_INFERRED until human confirms
  metadata?:     Record<string, unknown>
  createdBy?:    string
  createdAt:     string
  verifiedBy?:   string
  verifiedAt?:   string
}
```

### New Relation Types

New relation types are added as string constants. No schema change. No code change. The graph engine processes any string `relationType` value.

Example future types (not in founding set; add when needed):
```
CONTRADICTS        — two items in apparent conflict (requires human resolution)
SUPERSEDED_BY      — this item is replaced by the toObject (reverse of REPLACES)
CITES_AS_AUTHORITY — citation used to justify a decision in a case
USED_IN_AUDIT      — this item was used as evidence/basis in an audit finding
```

---

## 4. KnowledgeApplicabilityRule

Universal scope filter. Any `KnowledgeObject` in any domain can have applicability rules. The same evaluation engine handles legal document scope, template scope, risk pattern scope, and checklist scope.

```typescript
interface KnowledgeApplicabilityRule {
  ruleId:     string
  objectId:   string       // FK → KnowledgeObject.objectId
  dimension:  string       // open string from standard dimension list
  operator:   'IN' | 'NOT_IN' | 'ALL' | 'GT' | 'LT' | 'BETWEEN'
  values:     string[]     // for GT/LT/BETWEEN: numeric strings
  priority:   number       // higher = evaluated first; default 0
  notes?:     string
}
```

**Standard dimensions (open — extensible without code change):**

| Dimension | Values format | Example |
|-----------|--------------|---------|
| `PACKAGE_TYPE` | enum codes | `['GOODS', 'CONSTRUCTION']` |
| `FUND_SOURCE` | enum codes | `['STATE_BUDGET', 'ODA']` |
| `PROCUREMENT_METHOD` | enum codes | `['OPEN_TENDER']` |
| `DEPARTMENT` | org unit codes | `['FINANCE', 'PROCUREMENT']` |
| `REGION` | province codes or 'NATIONWIDE' | `['HANOI', 'HCMC']` |
| `VALUE_RANGE` | numeric string (VNĐ) | `GT` + `['500000000']` |
| `CONTRACT_TYPE` | contract type codes | `['LUMP_SUM', 'UNIT_PRICE']` |
| `DOCUMENT_YEAR` | year string | `['2023', '2024', '2025', '2026']` |
| `AUTHORITY_LEVEL` | '1' through '14' | `LT` + `['9']` |
| `AUDIENCE` | audience codes | `['procurement_officer', 'approver']` |

**Evaluation logic:**

```typescript
function isApplicable(rules: KnowledgeApplicabilityRule[], context: KnowledgeContext): boolean {
  if (rules.length === 0) return true   // no rules = universally applicable
  return rules.every(rule => evaluateRule(rule, context))
}
// evaluateRule applies IN/NOT_IN/GT/LT/BETWEEN against context[rule.dimension]
```

This function is the single implementation. All 16 providers use it. Legal documents, templates, risk patterns, checklists, school policies — all evaluated the same way.

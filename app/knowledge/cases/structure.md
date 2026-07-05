# Procurement Case Knowledge Structure

Domain: `cases` — managed by CaseKnowledgeProvider

---

## Purpose

The cases domain stores previous procurement cases as knowledge items. This enables:
1. **Similar case search** — "Find cases where a GOODS package of similar value was procured using COMPETITIVE_QUOTATION"
2. **Decision precedent** — "What approval authority was used for packages of this type and value?"
3. **Duration benchmarks** — "How long does open tender for construction packages typically take?"
4. **Outcome patterns** — "What percentage of restricted tender cases resulted in single bids?"

---

## Case Item Metadata Schema

```
{
  caseCode:            string       // internal case reference
  packageType:         string       // 'GOODS' | 'CONSTRUCTION' | 'CONSULTING' | etc.
  procurementMethod:   string       // 'OPEN_TENDER' | 'COMPETITIVE_QUOTATION' | etc.
  fundSource:          string       // 'STATE' | 'ODA' | 'ENTERPRISE' | 'PPP'
  estimatedValue:      number       // VNĐ (as number for search/comparison)
  actualValue:         number       // final contracted value
  outcome:             string       // 'COMPLETED' | 'CANCELLED' | 'DISPUTE' | 'AUDIT_FINDING'
  durationDays:        number       // total process duration
  bidderCount:         number       // number of bidders received
  approvalAuthority:   string       // which authority level approved
  keyLessons:          string[]     // extracted lessons
  auditFindings?:      string[]     // audit mistake codes if any findings
  risksMaterialized?:  string[]     // risk type codes if any risks occurred
  department:          string       // organizational unit
  fiscalYear:          string       // year of completion
  anonymized:          boolean      // whether identifying details removed
}
```

---

## Case as KnowledgeItem

Each procurement case is stored as a `KnowledgeItem` in the `cases` domain:

```
KnowledgeItem {
  domain:   'cases'
  title:    'Mua sắm máy tính xách tay 50 bộ — Q3/2025'
  content:  '[full description and outcome summary]'
  tags:     ['GOODS', 'COMPETITIVE_QUOTATION', 'STATE', 'COMPLETED']
  metadata: { packageType: 'GOODS', procurementMethod: 'COMPETITIVE_QUOTATION', ... }
}
```

---

## KnowledgeApplicabilityRule for Cases

Cases carry applicability rules so `resolveApplicable()` can filter:
- `PACKAGE_TYPE IN ['GOODS']` → only return goods cases
- `FUND_SOURCE IN ['STATE', 'ODA']` → only return state-funded cases
- `VALUE_RANGE GT 200000000 AND LT 2000000000` → similar value range

This enables `findSimilarCases(description, context)` to return cases that match the current procurement context.

---

## Anonymization Policy

Cases containing identifying information about specific organizations or individuals are anonymized before being added to the knowledge base:
- Department names replaced with department type codes
- Contractor names replaced with `[CONTRACTOR-A]`, `[CONTRACTOR-B]`
- Contract values may be rounded to nearest 100M VNĐ
- Original case reference code retained for traceability within the organization

# Rule Engine Design — Thresholds · Rules · Exceptions

Part of: [reasoning-architecture.md](../decisions/reasoning-architecture.md)

---

## Core Principle

The Rule Engine (Stage 4) is a pure evaluator. It contains no rule definitions. All rules and thresholds are loaded from the Knowledge Platform corpus as `KnowledgeItem` records. Updating a rule or threshold value requires only a corpus update — zero code change.

```
Source of rules:  Knowledge Platform (procurement domain, type='EVALUATION_RULE')
Source of thresholds: Knowledge Platform (procurement domain, type='THRESHOLD')
Rule evaluator:   src/reasoning/rules/DefaultRuleEvaluator.ts

Adding a new procurement rule:
  → Add a new KnowledgeItem to the corpus (admin operation)
  → Rule Engine picks it up automatically at next query
  → Zero code change

Changing a threshold value (e.g., law amends the open tender threshold):
  → Update the KnowledgeItem in the corpus (corpus update pipeline)
  → Old version versioned (immutable); new version activated
  → All future reasoning calls use the new threshold
  → Historical reasoning calls for past asOfDate use the old threshold
  → Zero code change
```

---

## Rule KnowledgeItem Schema

Rules are stored as `KnowledgeItem` in domain `procurement`, `type = 'EVALUATION_RULE'`.

```typescript
// Stored in KnowledgeItem.metadata for type='EVALUATION_RULE'
interface EvaluationRuleMetadata {
  ruleCode:        string             // 'ADVANCE_GUARANTEE_REQUIRED', 'OPEN_TENDER_MIN', etc.
  ruleCategory:    RuleCategory
  conditions:      RuleCondition[]    // AND-joined; all must be true for rule to apply
  outcome: {
    pass:          string             // explanation when rule is satisfied (Vietnamese)
    fail:          string             // explanation when rule is not satisfied
    exception?:    string             // explanation when an exception overrides
    inconclusive?: string             // explanation when cannot determine
  }
  isCritical:      boolean            // if true, INCONCLUSIVE → humanReviewRequired
  exceptionCodes?: string[]           // exception patterns that override this rule (ref to DetectedException)
  priority:        number             // higher = evaluated first; default 0
}

type RuleCategory =
  | 'PROCUREMENT_METHOD'    // which method must be used
  | 'ADVANCE_PAYMENT'       // advance payment rules
  | 'GUARANTEE'             // bid/performance/advance guarantee rules
  | 'DOCUMENT_REQUIREMENT'  // which documents are required
  | 'TIMELINE'              // time limits and deadlines
  | 'AUTHORITY'             // approval authority requirements
  | 'SUPPLIER_ELIGIBILITY'  // supplier qualification requirements
  | 'EVALUATION_CRITERIA'   // bid evaluation rules
  | 'CONTRACT_TERMS'        // contract terms requirements
  | 'PAYMENT_TERMS'         // payment schedule rules
  | 'RETENTION'             // retention money rules
  | 'REPORTING'             // reporting and disclosure requirements

interface RuleCondition {
  field:     string         // ReasoningContext field name (open string)
  operator:  ConditionOperator
  value:     string         // comparison value (always string; cast by evaluator per operator)
  unit?:     string         // 'VND' | 'PERCENT' | 'DAYS'
}

type ConditionOperator =
  | 'EQ'         // equal
  | 'NEQ'        // not equal
  | 'GT'         // greater than
  | 'GTE'        // greater than or equal
  | 'LT'         // less than
  | 'LTE'        // less than or equal
  | 'BETWEEN'    // between two values (value = 'min,max')
  | 'IN'         // value is one of (value = 'A,B,C')
  | 'NOT_IN'     // value is not one of
  | 'EXISTS'     // field is present and non-null in context
  | 'NOT_EXISTS' // field is absent or null
```

---

## Threshold KnowledgeItem Schema

Thresholds are stored as `KnowledgeItem` in domain `procurement`, `type = 'THRESHOLD'`.

```typescript
// Stored in KnowledgeItem.metadata for type='THRESHOLD'
interface ThresholdMetadata {
  thresholdCode:   string             // 'OPEN_TENDER_GOODS_MIN', 'ADVANCE_MAX_STATE', etc.
  thresholdType:   ThresholdType
  contextField:    string             // which ReasoningContext field to compare
  operator:        'GT' | 'GTE' | 'LT' | 'LTE' | 'BETWEEN'
  value:           string             // numeric string (bigint VNĐ, or ratio as decimal '0.30')
  valueTo?:        string             // for BETWEEN: upper bound
  unit:            'VND' | 'PERCENT' | 'DAYS' | 'COUNT'
  applicabilityConditions: RuleCondition[]  // when does this threshold apply?
  note?:           string             // explanatory note
}

type ThresholdType =
  | 'PROCUREMENT_METHOD_FLOOR'   // minimum value to require a procurement method
  | 'PROCUREMENT_METHOD_CEILING' // maximum value for a procurement method
  | 'ADVANCE_PAYMENT_MAX'        // maximum advance payment ratio
  | 'ADVANCE_PAYMENT_MIN_GUARANTEE' // minimum advance requiring guarantee
  | 'BID_SECURITY_FLOOR'         // minimum value requiring bid security
  | 'PERFORMANCE_GUARANTEE_RATE' // performance guarantee as % of contract
  | 'RETENTION_RATE'             // retention money rate
  | 'APPROVAL_AUTHORITY_FLOOR'   // value floor for each approval level
  | 'PUBLICATION_FLOOR'          // value floor requiring publication
  | 'TIMELINE_MIN'               // minimum days for a process step
```

---

## Founding Rule Set

These rules are the initial set stored in the corpus. All defined as `KnowledgeItem` records — not in code. Listed here for documentation; values subject to change via corpus update.

### Procurement Method Selection Rules

```
RULE-M01: OPEN_TENDER_GOODS
  Category: PROCUREMENT_METHOD
  Conditions:
    fundSource IN ['STATE_BUDGET', 'ODA']
    packageType EQ 'GOODS'
    estimatedValue GT '2000000000'     // > 2B VNĐ (from NĐ 24/2024)
  Outcome.pass:  'Bắt buộc đấu thầu rộng rãi (gói hàng hóa > 2 tỷ VNĐ)'
  Outcome.fail:  'Không bắt buộc đấu thầu rộng rãi'
  LegalBasis:    [NĐ 24/2024/NĐ-CP Điều 20; Luật 22/2023/QH15 Điều 22]

RULE-M02: OPEN_TENDER_CONSTRUCTION
  Conditions:
    fundSource IN ['STATE_BUDGET', 'ODA']
    packageType EQ 'CONSTRUCTION'
    estimatedValue GT '5000000000'     // > 5B VNĐ
  LegalBasis:    [NĐ 24/2024/NĐ-CP Điều 20]

RULE-M03: OPEN_TENDER_CONSULTING
  Conditions:
    fundSource IN ['STATE_BUDGET', 'ODA']
    packageType EQ 'CONSULTING'
    estimatedValue GT '500000000'      // > 500M VNĐ
  LegalBasis:    [NĐ 24/2024/NĐ-CP Điều 20]

RULE-M04: DIRECT_AWARD_MAX
  Conditions:
    fundSource IN ['STATE_BUDGET']
    estimatedValue LTE '100000000'     // ≤ 100M VNĐ (mua sắm thường xuyên)
  Outcome.pass:  'Được chỉ định thầu (gói ≤ 100 triệu VNĐ)'
  ExceptionCodes: ['EMERGENCY_PROCUREMENT', 'SINGLE_SUPPLIER']
  LegalBasis:    [Luật 22/2023/QH15 Điều 26; NĐ 24/2024/NĐ-CP Điều 23]

RULE-M05: COMPETITIVE_OFFER_GOODS
  Conditions:
    fundSource IN ['STATE_BUDGET']
    packageType IN ['GOODS', 'CONSTRUCTION']
    estimatedValue BETWEEN '100000000,2000000000'  // 100M–2B
  Outcome.pass:  'Áp dụng chào hàng cạnh tranh (100M–2B VNĐ hàng hóa/xây lắp)'
  LegalBasis:    [Luật 22/2023/QH15 Điều 24; NĐ 24/2024/NĐ-CP Điều 22]
```

### Advance Payment Rules

```
RULE-A01: ADVANCE_PAYMENT_MAX_STATE
  Category: ADVANCE_PAYMENT
  Conditions:
    fundSource EQ 'STATE_BUDGET'
    contractType EXISTS
  Threshold: advanceRatio LTE '0.30'  // max 30%
  Outcome.pass:  'Tạm ứng ≤ 30% giá trị hợp đồng'
  Outcome.fail:  'Tạm ứng vượt 30% — không phù hợp quy định'
  ExceptionCodes: ['ADVANCE_WORKS_PREPARATORY']
  LegalBasis:    [TT 79/2025/TT-BTC Điều 15 khoản 1]

RULE-A02: ADVANCE_GUARANTEE_REQUIRED
  Category: GUARANTEE
  Conditions:
    fundSource EQ 'STATE_BUDGET'
    advanceAmount GT '100000000'       // > 100M VNĐ advance
  Outcome.pass:  'Bảo lãnh tạm ứng bắt buộc'
  Outcome.fail:  'Không đủ điều kiện yêu cầu bảo lãnh tạm ứng'
  LegalBasis:    [TT 79/2025/TT-BTC Điều 18]

RULE-A03: ADVANCE_RECOVERY_DEDUCTION
  Category: PAYMENT_TERMS
  Conditions:
    advanceAmount GT '0'
    fundSource EQ 'STATE_BUDGET'
  Outcome.pass:  'Tạm ứng phải được khấu trừ dần từ các kỳ thanh toán theo tỷ lệ ứng'
  LegalBasis:    [TT 79/2025/TT-BTC Điều 15 khoản 4]
```

### Guarantee Rules

```
RULE-G01: BID_SECURITY_REQUIRED
  Category: GUARANTEE
  Conditions:
    procurementMethod EQ 'OPEN_TENDER'
    estimatedValue GT '500000000'      // > 500M VNĐ
  Outcome.pass:  'Bảo đảm dự thầu bắt buộc'
  LegalBasis:    [Luật 22/2023/QH15 Điều 14; NĐ 24/2024/NĐ-CP Điều 15]

RULE-G02: PERFORMANCE_GUARANTEE_REQUIRED
  Category: GUARANTEE
  Conditions:
    contractType EXISTS
    estimatedValue GT '0'
    fundSource IN ['STATE_BUDGET', 'ODA']
  Outcome.pass:  'Bảo đảm thực hiện hợp đồng bắt buộc'
  Threshold: guaranteeRate BETWEEN '0.02,0.10'  // 2–10% of contract value
  LegalBasis:    [Luật 22/2023/QH15 Điều 66; NĐ 24/2024/NĐ-CP Điều 72]

RULE-G03: RETENTION_MONEY
  Category: RETENTION
  Conditions:
    packageType IN ['CONSTRUCTION', 'MIXED']
    contractType EQ 'LUMP_SUM'
  Outcome.pass:  'Giữ lại bảo hành: tối đa 5% giá trị hợp đồng'
  LegalBasis:    [Luật 22/2023/QH15 Điều 67]
```

### Timeline Rules

```
RULE-T01: TENDER_NOTICE_MIN_DAYS
  Category: TIMELINE
  Conditions:
    procurementMethod EQ 'OPEN_TENDER'
  Threshold: tenderNoticeDays GTE '10'  // minimum 10 days notice
  Outcome.pass:  'Thời gian đăng tải TBMT tối thiểu 10 ngày'
  LegalBasis:    [Luật 22/2023/QH15 Điều 33]

RULE-T02: BID_SUBMISSION_MIN_DAYS
  Category: TIMELINE
  Conditions:
    procurementMethod EQ 'OPEN_TENDER'
    packageType EQ 'GOODS'
  Threshold: bidSubmissionDays GTE '20'  // minimum 20 days for goods
  LegalBasis:    [Luật 22/2023/QH15 Điều 34]

RULE-T03: CONTRACT_SIGNING_MAX_DAYS
  Category: TIMELINE
  Conditions:
    procurementMethod EXISTS
  Threshold: contractSigningDays LTE '20'  // ≤ 20 days after approval
  LegalBasis:    [Luật 22/2023/QH15 Điều 70]
```

---

## Exception Pattern Registry

Exceptions are detected in Stage 4 by scanning `AppliedArticle.extractedText` for these patterns. The registry is open — new patterns added as string entries, zero code change.

```typescript
interface ExceptionPattern {
  patternCode:   string         // 'EXCEPT_CLAUSE', 'SCOPE_EXCLUSION', etc.
  language:      'vi' | 'en'
  triggers:      string[]       // phrases that introduce an exception clause
  conditionPattern: string      // regex to extract the exception condition
}
```

**Vietnamese exception patterns (founding set):**

| Pattern Code | Trigger Phrases | Meaning |
|-------------|----------------|---------|
| `EXCEPT_CLAUSE` | 'trừ trường hợp', 'trừ khi', 'ngoại trừ' | introduces a specific exception condition |
| `SCOPE_EXCLUSION` | 'không áp dụng', 'không áp dụng cho', 'không áp dụng đối với' | scope exclusion |
| `SPECIAL_CASE` | 'trường hợp đặc biệt', 'trường hợp khẩn cấp' | emergency / special case exception |
| `CONDITIONAL_PERMIT` | 'miễn là', 'với điều kiện là', 'nếu và chỉ nếu' | conditional permission |
| `GRANDFATHERED` | 'trước ngày ... tiếp tục được áp dụng' | transition / grandfathering |
| `DELEGATE_EXCEPTION` | 'Thủ tướng Chính phủ quyết định trong từng trường hợp' | PM discretion exception |
| `PILOT_EXCEPTION` | 'thí điểm', 'áp dụng thí điểm' | pilot program exception |
| `EMERGENCY_PROCUREMENT` | 'trường hợp khẩn cấp', 'thiên tai', 'dịch bệnh', 'sự cố' | emergency exemption from normal rules |
| `SINGLE_SUPPLIER` | 'nhà thầu duy nhất', 'độc quyền', 'bản quyền' | single source exception |
| `SMALL_PACKAGE` | 'gói thầu nhỏ', 'mua sắm trực tiếp' | small package exception |

**Exception applicability evaluation:**

```
After extracting exception condition text:
  1. Parse condition entities (packageType, value range, etc.) from condition text
  2. Compare against ReasoningContext
  3. If context matches exception condition → isApplicable = true
  4. If context clearly does not match → isApplicable = false
  5. If cannot determine from context alone → isApplicable = null + MissingEvidence

When isApplicable = true:
  → The rule this exception applies to: RuleStatus = EXCEPTION
  → Add to AppliedArticle.exceptions[]
  → Add to ReasoningResult.exceptions[]
  → Confidence deduction: none (exception is correctly detected)
  → Trace: 'Áp dụng ngoại lệ: [condition] → quy tắc [rule] không áp dụng'

When isApplicable = null:
  → Add MissingEvidence (isCritical = parent rule.isCritical)
  → Confidence deduction: −0.10 (UNRESOLVED_EXCEPTION)
  → Trace: 'Phát hiện ngoại lệ tiềm năng nhưng không đủ thông tin để xác nhận'
```

---

## IRuleEvaluator Interface

```typescript
interface IRuleEvaluator {
  evaluateRule(
    rule:    EvaluationRuleMetadata,
    item:    KnowledgeItemRef,
    context: ReasoningContext,
    exceptions: DetectedException[]
  ): RuleResult

  evaluateThreshold(
    threshold:  ThresholdMetadata,
    item:       KnowledgeItemRef,
    context:    ReasoningContext
  ): ThresholdResult

  evaluateConditions(
    conditions: RuleCondition[],
    context:    ReasoningContext
  ): { allMet: boolean; unmetConditions: RuleCondition[]; missingFields: string[] }
}
```

**DefaultRuleEvaluator** implements this interface. For each condition:
- Reads `context[condition.field]`
- If field missing from context: → `missingFields.push(condition.field)`
- If field present: evaluate `fieldValue [operator] condition.value`
- Returns aggregate: all met / which unmet / which fields missing

Missing fields determine `INCONCLUSIVE` vs `PASS`/`FAIL`.

---

## Rule Loading at Query Time

Rules and thresholds are NOT cached in the Reasoning Layer. They are fetched from the Knowledge Platform on every `reason()` call via Stage 2 (`KnowledgeResolver`). This ensures:

1. Threshold values are always as-of the query's `asOfDate`
2. New rules added to the corpus are immediately available
3. Rule supersessions (old rule replaced by new) are automatically resolved by the Knowledge Platform's temporal filtering

Performance implication: rule sets are typically small (< 50 rules for a given context). The Knowledge Platform query for rules is a faceted lookup (domain=procurement, type=EVALUATION_RULE, context filters) — fast even without caching.

For very high volume scenarios: the Knowledge Platform's own internal caching (outside the Reasoning Layer's concern) absorbs repeated lookups.

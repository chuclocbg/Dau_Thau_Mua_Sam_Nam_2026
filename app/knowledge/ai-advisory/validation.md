# Output Validation

Part of: [ai-context-contract.md](../decisions/ai-context-contract.md)

Every `LLMOutput` passes through `DefaultOutputValidator` before it is returned as an `LLMResponse`. Validation failures are logged. Hallucinated citations are redacted. Contradictions are flagged. No raw LLM output ever reaches the end user without passing validation.

---

## 1. IOutputValidator

```typescript
interface IOutputValidator {
  validate(
    output:  LLMOutput,
    context: AIContext
  ): OutputValidationResult
}

interface OutputValidationResult {
  passed:           boolean
  issues:           ValidationIssue[]
  redactedContent?: string         // cleaned output (if redaction was applied)
  wasRedacted:      boolean        // true if content was modified
  confidence:       number         // 0–1; how confident the validator is in its assessment
  validatedAt:      string
}

interface ValidationIssue {
  issueId:      string
  issueType:    ValidationIssueType
  severity:     'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  description:  string
  location?:    string        // approximate location in output (substring or line number)
  evidence?:    string        // the problematic text
  correction?:  string        // suggested correction or redaction
  autoFixed:    boolean       // true if redaction was applied automatically
}

type ValidationIssueType =
  | 'HALLUCINATED_CITATION'
  | 'NUMERIC_INCONSISTENCY'
  | 'DECISION_CONTRADICTION'
  | 'LANGUAGE_MISMATCH'
  | 'TRUNCATED_RESPONSE'
  | 'FORBIDDEN_PATTERN'
  | 'MISSING_REQUIRED_SECTION'
  | 'UNSUPPORTED_CLAIM'
```

---

## 2. Validation Checks (in execution order)

### Check 1 — Citation Integrity

**Purpose:** Every legal citation in the LLM output must trace back to `AIContext.citations` or `AIContext.legalBasis`. A citation not in the context is a hallucination.

```
1. Extract all citation patterns from output.content using the citation regex:
     Pattern: [\(（]?(?:Điều\s+\d+[^)）]{0,80}(?:\d{1,3}\/\d{4}\/[A-Z\-]+)){1}[)）]?
     Also: document symbol patterns without article refs
     Also: 'căn cứ theo...', 'theo quy định tại...', 'theo Điều...' patterns

2. For each extracted citation:
     a. Look up in AIContext.citations[].full, .short, .inline (normalized string match)
     b. Look up in AIContext.legalBasis[].documentSymbol
     c. Look up in AIContext.legalBasis[].citationFull, .citationShort

3. If found in context: VALID — continue

4. If NOT found in context:
     Issue: HALLUCINATED_CITATION (CRITICAL if isNormative implied; HIGH otherwise)
     AutoFix: replace citation text in output with '[NGUỒN KHÔNG XÁC MINH]'
     wasRedacted = true
     Log: contextId, offending citation, replacement

Example:
  LLM output: 'Theo Điều 25 Nghị định 10/2022/NĐ-CP...'
  AIContext.citations: no entry for 'NĐ 10/2022'
  → HALLUCINATED_CITATION (CRITICAL)
  → Replace with '[NGUỒN KHÔNG XÁC MINH]'
  → Add ValidationIssue to result
```

### Check 2 — Numeric Consistency

**Purpose:** Every specific monetary value, percentage, or count stated as a legal rule in the LLM output must appear in the AIContext.

```
1. Extract numeric assertions from output:
     Money: \d+(?:[.,]\d+)?\s*(?:tỷ|triệu|nghìn|đồng|VNĐ|%)
     Percentages: \d+(?:[.,]\d+)?\s*%
     Counts/days: \d+\s*(?:ngày|năm|tháng|lần)

2. For each extracted number that appears to be a legal rule or limit:
     (detect by surrounding words: 'tối đa', 'tối thiểu', 'không quá', 'ít nhất', 'phải có')

3. Cross-reference against:
     AIContext.legalBasis[].provisionText
     AIContext.evidence[].summary + .detail
     AIContext.reasoningTrace[].outcome
     (search for the numeric value as string in these fields)

4. If number not found in context:
     Issue: NUMERIC_INCONSISTENCY (HIGH if it is a legal threshold; MEDIUM otherwise)
     AutoFix: none (cannot reliably correct numbers — flag for human review)
     wasRedacted = false
     Log and flag as humanReviewRecommended in LLMResponse.metadata

Tolerance: numbers that are clearly from the question (user's own input) are excluded.
Numbers in conversational examples ('ví dụ 100 triệu') are excluded.
Only numbers presented as rule values or legal limits are checked.
```

### Check 3 — Decision Contradiction

**Purpose:** The LLM's conclusion must not contradict `AIContext.decision` when `decision` is non-null and `confidenceLabel` is HIGH or MEDIUM.

```
1. Extract the LLM's conclusion from output:
     Look for conclusion markers: 'kết luận', 'vì vậy', 'do đó', 'tóm lại', 'như vậy'
     Take the sentence(s) following these markers

2. If AIContext.decision is null OR confidenceLabel IN ['LOW', 'VERY_LOW']:
     Skip this check (AIContext itself says it's uncertain; LLM may explore)

3. If AIContext.decision is non-null AND confidenceLabel IN ['HIGH', 'MEDIUM']:
     Check semantic consistency: does the LLM's conclusion align with AIContext.decision?
     Method: keyword overlap check (not full semantic comparison — too expensive)
     Contradiction signals:
       - AIContext.decision affirms X; LLM output denies X
       - AIContext.decision says "bắt buộc"; LLM says "không bắt buộc"
       - AIContext.decision names a specific threshold; LLM names a different value

4. If contradiction detected:
     Issue: DECISION_CONTRADICTION (CRITICAL)
     AutoFix: none (cannot reliably correct contradictions)
     Append to output: '\n\n[⚠ Lưu ý: Kết quả phân tích tự động có kết luận khác. Đề nghị xem xét thủ công.]'
     wasRedacted = true (appended content counts as modification)
     humanReviewRequired override: set to true in LLMResponse.metadata
```

### Check 4 — Language Compliance

**Purpose:** The output language must match the requested language.

```
1. If systemInstructions.outputLanguage = 'vi':
     Detect if output contains more than 30% non-Vietnamese characters
     (Vietnamese uses Latin script; Chinese/Japanese/Korean = wrong language)
     → If detected: LANGUAGE_MISMATCH (MEDIUM)
     → No AutoFix (re-trigger retry with stronger language instruction)

2. If systemInstructions.outputLanguage = 'en':
     Detect if output is predominantly Vietnamese
     → If detected: LANGUAGE_MISMATCH (MEDIUM)

3. If outputLanguage = 'follow_question': skip this check

Implementation: simple heuristic — check ratio of Vietnamese diacritic characters
(ắ, ặ, ấ, ầ, ổ, ộ, etc.) to total character count. > 20% = Vietnamese.
```

### Check 5 — Response Completeness

**Purpose:** Detect truncated responses (model hit output token limit mid-sentence).

```
1. Check output.finishReason = 'MAX_TOKENS'
   AND last character is not a sentence-ending punctuation (., !, ?, ", »)

2. If both conditions: TRUNCATED_RESPONSE (HIGH)
   → Append: '\n[Câu trả lời bị cắt ngắn do giới hạn độ dài. Vui lòng chia nhỏ câu hỏi.]'
   → wasRedacted = true

3. If outputFormat = LEGAL_MEMO: also check that required sections are present
   Missing sections: MISSING_REQUIRED_SECTION (MEDIUM)
```

### Check 6 — Forbidden Pattern Detection

**Purpose:** Detect if the LLM violated any `systemInstructions.forbiddenBehaviors`.

```
Known forbidden pattern checks:
  FP-01: Claims "không có quy định" (no regulation) when legalBasis[] is non-empty
           → FORBIDDEN_PATTERN (HIGH): LLM claiming no law when laws were provided
  FP-02: Claims certainty when humanReviewRequired=true in AIContext
           Detect: 'chắc chắn', 'bắt buộc' without any qualification when humanReview=true
           → FORBIDDEN_PATTERN (HIGH)
  FP-03: Recommends specific legal counsel by name (potential liability)
           → FORBIDDEN_PATTERN (LOW) → replace name with 'bộ phận pháp lý'
  FP-04: Contains raw Markdown table/code blocks when outputFormat='CONVERSATIONAL'
           → not an error; logged as LOW (style issue only)
```

---

## 3. Validation Result Handling

```
All issues collected → OutputValidationResult

if issues.any(i => i.severity = 'CRITICAL'):
  passed = false
  LLMResponse includes the redactedContent (hallucinations removed)
  Log: CRITICAL_VALIDATION_FAILURE with contextId

if issues.all(i => i.severity IN ['MEDIUM', 'LOW']):
  passed = true
  LLMResponse.content = redactedContent (if wasRedacted) else original
  Issues logged as warnings in LLMResponse.validation

if issues.none():
  passed = true
  LLMResponse.content = output.content (unchanged)
```

**On CRITICAL failure** (e.g., hallucinated primary citation after redaction still fails):
```
LLMResponse.content = redactedContent
  + '\n\n[⚠ Cảnh báo: Phản hồi của AI đã được hiệu chỉnh do phát hiện nội dung không chính xác. '
  + 'Đề nghị xem xét và xác minh trước khi sử dụng.]'
LLMResponse.validation.passed = false
Upstream (Phase X) receives this and may: retry, escalate, or present as-is with prominent warning
```

---

## 4. Validation Log

Every validation run is logged for audit. Log records are write-only (append-only audit trail).

```typescript
interface ValidationLog {
  logId:            string
  contextId:        string     // AIContext.contextId
  modelId:          string
  outputLength:     number     // chars
  issues:           ValidationIssue[]
  wasRedacted:      boolean
  validationTimeMs: number
  loggedAt:         string
}
```

Logs are retained per the corpus retention policy for the `audit` domain (5 years minimum). These logs provide the complete audit trail of every AI-generated response — what the AI said, what was validated, and what was corrected.

---

## 5. Validation Confidence

The validator's own confidence in its assessment:

```
Start: 1.0

Deductions:
  Using simple heuristics for numeric check (not NLP): −0.10
  Language detection is heuristic only: −0.05
  Decision contradiction check is keyword-only: −0.15
  Output is very long (> 2000 words; pattern matching less reliable): −0.10

If validationConfidence < 0.70:
  Add to ValidationResult.issues: ValidationIssue {
    issueType: 'UNSUPPORTED_CLAIM',
    severity: 'LOW',
    description: 'Xác minh tự động có độ tin cậy thấp do độ phức tạp của phản hồi. Khuyến nghị xem xét thủ công.',
    autoFixed: false
  }
```

---

## 6. What Validation Does NOT Check

These are out of scope for automated validation — they require human review:

- **Logical completeness**: is the answer thorough enough for the specific question?
- **Factual accuracy of article text**: does the quoted provision match the actual law exactly?
- **Contextual appropriateness**: is this advice suitable for the specific organization's situation?
- **Legal interpretation correctness**: is the legal reasoning sound?
- **Outdated law**: the corpus keeps laws current, but the validator doesn't re-fetch

These limitations are disclosed in `systemInstructions.customInstructions`:
```
'Câu trả lời này được tạo bởi AI dựa trên dữ liệu pháp lý trong hệ thống.
Không thay thế tư vấn pháp lý chuyên nghiệp.
Kiểm tra văn bản pháp luật gốc trước khi ra quyết định quan trọng.'
```

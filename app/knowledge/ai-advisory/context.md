# AIContext Schema

Part of: [ai-context-contract.md](../decisions/ai-context-contract.md)

All types live in `src/ai/aiTypes.ts`. `AIContext` is the frozen contract between the Reasoning Layer and the LLM Adapter.

---

## 1. AIContext — The Frozen Contract

```typescript
interface AIContext {
  // ── Identity ──────────────────────────────────────────────────────────
  contextId:             string              // UUID; correlates logs + audit trail
  builtAt:               string              // ISO datetime of context creation
  asOfDate:              string              // legal resolution date (from ReasoningQuestion)

  // ── Input ─────────────────────────────────────────────────────────────
  question:              string              // original question verbatim
  intent:                AIContextIntent     // classified intent

  // ── Decision (from Reasoning Layer) ───────────────────────────────────
  decision:              string | null       // null if confidence < 0.50
  confidence:            number              // 0–1
  confidenceLabel:       ConfidenceLabel     // 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW'
  humanReviewRequired:   boolean
  humanReviewReason?:    string

  // ── Legal Content ──────────────────────────────────────────────────────
  legalBasis:            AIContextLegalBasis[]    // applicable legal provisions
  citations:             AIContextCitation[]      // formatted citations for LLM use
  evidence:              AIContextEvidence[]      // supporting evidence items

  // ── Reasoning Trace ────────────────────────────────────────────────────
  reasoningTrace:        AIContextTraceStep[]     // summarized pipeline trace (not raw)

  // ── Issues ────────────────────────────────────────────────────────────
  warnings:              AIContextWarning[]
  missingInformation:    AIContextMissingInfo[]

  // ── Actions ───────────────────────────────────────────────────────────
  recommendedActions:    AIContextAction[]

  // ── Files ─────────────────────────────────────────────────────────────
  attachments:           AIContextAttachment[]

  // ── Conversation ──────────────────────────────────────────────────────
  conversationHistory:   AIContextMessage[]       // prior turns (pre-pruned to token budget)

  // ── LLM Instructions ──────────────────────────────────────────────────
  systemInstructions:    AIContextSystemInstructions

  // ── Token Budget ──────────────────────────────────────────────────────
  totalTokenEstimate:    number              // estimated total tokens for this context
  language:              'vi' | 'en' | 'vi+en'
}
```

**AIContext is read-only after construction.** The LLM Adapter receives it and may not modify any field. `Object.freeze()` enforced at build time.

---

## 2. Intent

```typescript
interface AIContextIntent {
  intentType:        string            // from ReasoningIntent.intentType
  subIntent?:        string
  confidence:        number
  extractedEntities: AIContextEntity[]
  summarized:        string            // plain-language description of the detected intent
}

interface AIContextEntity {
  type:   string    // 'MONEY_AMOUNT' | 'DOCUMENT_SYMBOL' | 'LEGAL_CONCEPT' | ...
  value:  string    // normalized value
  label:  string    // display label (Vietnamese): '2 tỷ VNĐ', 'Điều 15 TT 79/2025'
}
```

---

## 3. Legal Basis

```typescript
interface AIContextLegalBasis {
  itemId:          string    // KnowledgeItem.id — for traceability
  documentSymbol:  string    // '22/2023/QH15'
  documentTitle:   string    // short title
  documentType:    string    // 'LAW' | 'DECREE' | 'CIRCULAR'
  issuingBody:     string
  authorityLevel:  number    // 1–14
  article?:        string    // 'Điều 15'
  clause?:         string    // 'khoản 2'
  point?:          string    // 'điểm a'
  provisionText:   string    // the actual text of the provision (trimmed to 500 chars)
  role:            'PRIMARY' | 'SUPPORTING' | 'EXCEPTION' | 'SUPERSEDED_CONTEXT'
  isNormative:     boolean
  isPrimary:       boolean
  effectiveFrom:   string
  effectiveTo?:    string
  citationFull:    string    // 'Điều 15 khoản 2 Thông tư 79/2025/TT-BTC'
  citationShort:   string    // 'Đ15.2 TT 79/2025'
  citationInline:  string    // '(Đ15.2 TT 79/2025/TT-BTC)'
}
```

---

## 4. Citations

```typescript
// Pre-formatted citations ready for LLM injection
interface AIContextCitation {
  citationId:      string
  itemId:          string    // source KnowledgeItem.id — used by OutputValidator
  full:            string    // long form
  short:           string    // abbreviated form
  inline:          string    // parenthetical inline form
  chain?:          string    // citation chain if multi-level: 'Đ15 TT79 thực hiện Đ68 L22/2023'
  isNormative:     boolean
  isPrimary:       boolean
}
```

`OutputValidator` uses `citations[].itemId` to verify every citation in the LLM's output traces back to this list. Any citation in the output not matching an `itemId` or `full` in this list is flagged as HALLUCINATED.

---

## 5. Evidence

```typescript
interface AIContextEvidence {
  itemId:      string
  domain:      string       // 'legal' | 'procurement' | 'cases' | 'bestpractice' | ...
  type:        string       // 'ARTICLE' | 'RULE' | 'CASE' | 'THRESHOLD' | 'CHECKLIST' | ...
  title:       string
  summary:     string       // 200 chars max (token-efficient)
  detail?:     string       // extended text; dropped first during compression
  role:        string       // 'PRIMARY_BASIS' | 'SUPPORTING' | 'EXAMPLE' | 'RISK'
  confidence:  number       // quality confidence from corpus
  legalRef?:   string       // inline citation if this evidence references law
}
```

Evidence is ordered by: role (PRIMARY first), then confidence (descending).

During token compression: `evidence[].detail` fields are dropped first, then lower-confidence SUPPORTING items, then all items except PRIMARY_BASIS.

---

## 6. Reasoning Trace (Summarized)

```typescript
// Not the raw ReasoningStep[]; summarized for LLM consumption
interface AIContextTraceStep {
  stage:       string    // 'REASONING' | 'RULE_EVALUATION' | 'CONFLICT_RESOLUTION' | etc.
  summary:     string    // plain-language: 'Áp dụng TT 79/2025/TT-BTC Điều 15 khoản 1'
  outcome:     string    // what was decided at this step
  confidence:  number
}
```

The full `ReasoningResult.reasoningTrace` has potentially hundreds of steps. `AIContextBuilder` summarizes to the 5–10 most important steps. Full trace available in `FULL_TRACE` output format (passed as separate audit record, not to the LLM).

---

## 7. Warnings and Missing Information

```typescript
interface AIContextWarning {
  code:        string    // 'SUPERSEDED_DOCUMENT_USED' | 'UNRESOLVED_CONFLICT' | etc.
  severity:    'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  message:     string    // Vietnamese; user-facing
  itemId?:     string    // related knowledge item
  suggestion?: string    // what the user should do
}

interface AIContextMissingInfo {
  description:      string    // what is missing (Vietnamese)
  isCritical:       boolean   // if true: decision may be incomplete
  suggestedSources: string[]  // document symbols or domains to consult
  impact:           string    // how the absence affects the answer
}
```

CRITICAL warnings → `systemInstructions.forbiddenBehaviors` is augmented to instruct the LLM to disclose the warning prominently. MEDIUM/LOW warnings are included as supplementary notes.

---

## 8. Recommended Actions

```typescript
interface AIContextAction {
  actionId:      string
  description:   string    // plain-language action (Vietnamese)
  actionType:    AIContextActionType
  priority:      'REQUIRED' | 'RECOMMENDED' | 'OPTIONAL'
  deadline?:     string    // if time-sensitive
  legalRef?:     string    // citation for why this action is needed
  templateRef?:  string    // KnowledgeItem.id of the applicable template/form
}

type AIContextActionType =
  | 'SUBMIT_DOCUMENT'       // upload a specific document
  | 'GET_APPROVAL'          // obtain approval from a specific authority
  | 'PUBLISH_NOTICE'        // publish a procurement notice
  | 'PREPARE_GUARANTEE'     // arrange a guarantee instrument
  | 'CONSULT_LEGAL'         // escalate to legal counsel
  | 'CORRECT_VIOLATION'     // fix a compliance issue
  | 'AWAIT_DECISION'        // wait for external decision
  | 'REVIEW_DOCUMENT'       // review a specific document
  | 'CONTACT_AUTHORITY'     // contact a specific authority
  | 'RECORD_MINUTES'        // document a meeting or decision
```

---

## 9. Attachments

```typescript
interface AIContextAttachment {
  attachmentId:   string    // Storage service reference (Phase K)
  filename:       string
  mimeType:       string
  role:           string    // 'USER_UPLOAD' | 'TEMPLATE_REF' | 'LEGAL_DOCUMENT' | 'CASE_FILE'
  textSummary?:   string    // plain-text summary (populated if document was OCR'd or parsed)
  pageCount?:     number
  isIncluded:     boolean   // false = referenced but not sent to LLM (too large / unsupported format)
  excludeReason?: string    // why it was not included
}
```

Attachments with `isIncluded = true` and a `textSummary` are injected as evidence into the prompt. Attachments with `isIncluded = false` are mentioned by name only: "Tệp đính kèm: [filename] — không thể phân tích trực tiếp."

---

## 10. Conversation History

```typescript
interface AIContextMessage {
  messageId:     string
  role:          'USER' | 'ASSISTANT' | 'SYSTEM'
  content:       string
  timestamp:     string
  tokenCount:    number     // pre-computed; used for pruning
  contextId?:    string     // if this message has an associated AIContext (for assistant turns)
}
```

History is pre-pruned by `AIContextBuilder` to fit within the token budget. Pruning strategy:
1. Always keep the 2 most recent user turns and their assistant responses
2. Drop oldest turns first
3. Never drop system messages
4. When pruning, replace dropped turns with: `[Đã ẩn [N] tin nhắn cũ vì giới hạn ngữ cảnh]`

---

## 11. System Instructions

```typescript
interface AIContextSystemInstructions {
  role:                   string    // 'Chuyên gia tư vấn đấu thầu và pháp lý'
  outputLanguage:         'vi' | 'en' | 'follow_question'
  outputFormat:           AIOutputFormat
  tone:                   AIOutputTone
  citationStyle:          AICitationStyle
  responseLength:         'BRIEF' | 'STANDARD' | 'DETAILED'
  confidenceDisclosure:   boolean   // should LLM state the confidence level explicitly?
  uncertaintyBehavior:    'DISCLOSE' | 'REDIRECT_TO_REVIEW' | 'ESCALATE'
  forbiddenBehaviors:     string[]  // injected instructions for safety
  allowedKnowledgeSources: string[] // 'CONTEXT_ONLY' | names of trusted sources
  customInstructions?:    string    // application-layer additional instructions

  // Injected at build time based on context
  contextSummary:         string    // brief summary of what is in this context (for LLM orientation)
}

type AIOutputFormat =
  | 'CONVERSATIONAL'    // natural chat response
  | 'STRUCTURED_LIST'   // numbered / bulleted list
  | 'LEGAL_ADVISORY'    // formal legal advisory format
  | 'STEP_BY_STEP'      // procedural step-by-step guide
  | 'COMPARISON_TABLE'  // compare options (for method selection questions)
  | 'LEGAL_MEMO'        // full Vietnamese legal memo (Phiếu tư vấn pháp lý)

type AIOutputTone =
  | 'FORMAL_LEGAL'      // formal Vietnamese legal language
  | 'PROFESSIONAL'      // professional but accessible
  | 'ACCESSIBLE'        // plain language for non-specialists

type AICitationStyle =
  | 'INLINE'            // '(Điều 15 khoản 2 TT 79/2025/TT-BTC)' in text
  | 'FOOTNOTE'          // [1] in text; citations at end
  | 'ENDNOTE'           // citations listed at end without inline markers
  | 'NONE'              // no citations in output (used for conversational follow-ups)

// Standard forbidden behaviors (always included)
const STANDARD_FORBIDDEN_BEHAVIORS = [
  'Không được thêm trích dẫn pháp lý không có trong ngữ cảnh được cung cấp',
  'Không được bịa đặt số liệu, tỷ lệ, hoặc ngưỡng giá trị',
  'Không được đưa ra khuyến nghị pháp lý mâu thuẫn với kết quả phân tích đã cung cấp',
  'Không được khẳng định điều gì không có trong ngữ cảnh là đúng',
  'Nếu không chắc chắn, hãy nói rõ và đề xuất tham khảo thêm'
]
```

# Prompt Lifecycle

Part of: [ai-context-contract.md](../decisions/ai-context-contract.md)

---

## 1. Prompt Lifecycle Overview

```
AIContext (frozen, read-only)
    ↓
PromptBuilder.build(context, model)
    ↓ produces PromptSections (model-agnostic)
    ↓
TokenBudgetManager.enforce(sections, model)
    ↓ trims sections to fit model.maxContextTokens
    ↓
PromptRenderer.render(sections, model)
    ↓ formats for model-specific API format
    ↓
LLM API call (via adapter)
    ↓
LLMOutput (raw text)
    ↓
OutputValidator.validate(output, context)
    ↓
LLMResponse (validated, citations verified)
```

Each step is a separate class with a single responsibility. No step has knowledge of another step's internals.

---

## 2. PromptBuilder

`PromptBuilder` assembles `PromptSections` from `AIContext`. Output is model-agnostic text. No API-specific formatting here.

```typescript
interface PromptSection {
  sectionId:     string
  label:         string         // section heading (used in LEGAL_MEMO format)
  content:       string         // the text content
  tokenCount:    number         // pre-estimated
  priority:      number         // 1 = never drop; higher = more compressible
  isRequired:    boolean        // true = never dropped regardless of budget
}

class PromptBuilder {
  build(context: AIContext, model: ModelCapabilities): PromptSection[]
}
```

### Section Assembly Order

Sections are assembled in this order. This order is also the display order in the final prompt.

```
Section 1 — SYSTEM_ROLE [priority 1, required]
  Content from: AIContext.systemInstructions.role
  Template (Vietnamese):
    'Bạn là [role]. Bạn có nhiệm vụ trả lời câu hỏi dưới đây dựa HOÀN TOÀN vào
     ngữ cảnh pháp lý được cung cấp. Không được thêm thông tin nào ngoài ngữ cảnh.
     [forbiddenBehaviors formatted as numbered list]'

Section 2 — SYSTEM_FORMAT [priority 1, required]
  Content from: systemInstructions.outputFormat + citationStyle + tone + responseLength
  Template:
    'Định dạng trả lời: [format description].
     Ngôn ngữ: [outputLanguage].
     Giọng văn: [tone description].
     Trích dẫn: [citationStyle description and examples].
     Độ dài: [responseLength description].'

Section 3 — LEGAL_CONTEXT [priority 1, required]
  Content from: AIContext.legalBasis[] (PRIMARY items first)
  Template:
    '=== CĂN CỨ PHÁP LÝ ÁP DỤNG ===
     [For each PRIMARY legalBasis item]:
       [citationFull]
       "[provisionText]"
     [For each SUPPORTING item]:
       [citationFull] — [one-line summary]
     [Note if any EXCEPTION_SOURCE items]:
       Ngoại lệ áp dụng: [citationFull] — [exception condition]'

Section 4 — DECISION [priority 1, required]
  Content from: AIContext.decision + confidence + confidenceLabel + humanReviewRequired
  Template:
    '=== KẾT QUẢ PHÂN TÍCH PHÁP LÝ ===
     Kết luận: [decision]
     Độ tin cậy: [confidenceLabel] ([confidence × 100]%)
     [if humanReviewRequired]:
       ⚠ YÊU CẦU XEM XÉT THỦ CÔNG: [humanReviewReason]'

Section 5 — EVIDENCE [priority 5, compressible]
  Content from: AIContext.evidence[] (PRIMARY items first)
  Template:
    '=== BẰNG CHỨNG PHÁP LÝ HỖ TRỢ ===
     [For each PRIMARY evidence]:
       [title] ([domain]): [detail or summary]
     [For each EXAMPLE evidence (cases)]:
       Tình huống tương tự: [title] — [summary]'

Section 6 — WARNINGS [priority 3, compressible — CRITICAL kept]
  Content from: AIContext.warnings[] (CRITICAL + HIGH only unless budget allows more)
  Template:
    '=== CẢNH BÁO ===
     [For each warning]:
       [severity]: [message]
       Khuyến nghị: [suggestion]'

Section 7 — MISSING_INFO [priority 3, compressible — critical kept]
  Content from: AIContext.missingInformation[]
  Template:
    '=== THÔNG TIN CÒN THIẾU ===
     [For each missing item]:
       - [description] (ảnh hưởng: [impact])
       Nguồn tham khảo: [suggestedSources.join(", ")]'

Section 8 — ACTIONS [priority 4, compressible]
  Content from: AIContext.recommendedActions[] (REQUIRED first)
  Template:
    '=== HÀNH ĐỘNG CẦN THỰC HIỆN ===
     [REQUIRED]: [action.description] ([legalRef])
     [RECOMMENDED]: [action.description]'

Section 9 — REASONING_TRACE [priority 6, compressible]
  Content from: AIContext.reasoningTrace[] (max 5 steps)
  Template:
    '=== QUÁ TRÌNH PHÂN TÍCH ===
     [For each step]: [step.summary] → [step.outcome]'
  Only included if outputFormat = FULL_TRACE or includeTrace = true

Section 10 — CONVERSATION_HISTORY [priority 7, compressible]
  Content from: AIContext.conversationHistory[] (most recent first)
  Template:
    '=== LỊCH SỬ HỘI THOẠI ===
     [Người dùng]: [message.content]
     [Trợ lý]: [message.content]
     ...'

Section 11 — ATTACHMENTS [priority 8, compressible]
  Content from: AIContext.attachments[] where isIncluded=true
  Template:
    '=== TÀI LIỆU ĐÍNH KÈM ===
     [For each included attachment]:
       Tệp: [filename] ([mimeType])
       Nội dung: [textSummary]
     [For excluded attachments]:
       Tệp tham chiếu: [filename] (không thể phân tích trực tiếp)'

Section 12 — USER_QUESTION [priority 1, required — ALWAYS LAST]
  Content from: AIContext.question
  Template:
    '=== CÂU HỎI CỦA NGƯỜI DÙNG ===
     [question]
     [if citations in context]:
       Hãy trích dẫn các điều khoản pháp lý liên quan khi trả lời.'
```

---

## 3. TokenBudgetManager

`TokenBudgetManager` enforces the token budget BEFORE the prompt is sent to the model. It operates on `PromptSection[]`.

```typescript
class TokenBudgetManager {
  enforce(
    sections:    PromptSection[],
    model:       ModelCapabilities,
    reserve:     number = 2000    // tokens reserved for LLM response
  ): PromptSection[]
}
```

**Enforcement algorithm:**

```
budget = model.maxContextTokens - reserve
currentTotal = sum(sections[].tokenCount)

if currentTotal <= budget:
  return sections unchanged    // no compression needed

// Sort sections by priority DESC (highest priority = drop last)
// Work from highest priority (lowest number) down
// Keep all isRequired sections always

while currentTotal > budget:
  candidate = first section with lowest priority AND isRequired=false

  if candidate is CONVERSATION_HISTORY:
    → drop oldest turn pair (2 messages); update tokenCount
    → if only last turn pair remains: mark isRequired=true (cannot drop)

  else if candidate is EVIDENCE and has .detail content:
    → strip all .detail fields; regenerate content; update tokenCount

  else if candidate is EVIDENCE and no .detail left:
    → remove all SUPPORTING items; keep PRIMARY only; update tokenCount

  else if candidate is REASONING_TRACE and length > 3:
    → trim to 3 most important steps

  else:
    → remove this section entirely

  if no candidate found (all required):
    → log CONTEXT_OVERFLOW; truncate LEGAL_CONTEXT provisionTexts to 100 chars each
    → if still over: raise ContextOverflowError (caller must use smaller model)

return trimmed sections
```

---

## 4. PromptRenderer

`PromptRenderer` translates model-agnostic `PromptSection[]` into the model's expected API format.

```typescript
class PromptRenderer {
  render(sections: PromptSection[], model: ModelCapabilities): RenderedPrompt
}

interface RenderedPrompt {
  system?:   string              // for models with system parameter (Claude, Gemini)
  messages:  RenderedMessage[]   // the message array
  metadata:  Record<string, unknown>  // model-specific request fields
}

interface RenderedMessage {
  role:     'user' | 'assistant' | 'system'
  content:  string | ContentPart[]    // ContentPart[] for multimodal
}

interface ContentPart {
  type:      'text' | 'image' | 'document'
  text?:     string
  imageData?: { mimeType: string; data: string }   // base64
  docData?:   { mimeType: string; data: string }   // base64 for PDF
}
```

### Per-Model Rendering Rules

**Claude (Anthropic API):**
```
system parameter: SYSTEM_ROLE + SYSTEM_FORMAT sections (joined)
messages[0]: { role: 'user', content: [
    LEGAL_CONTEXT section (text part),
    DECISION section (text part),
    EVIDENCE section (text part),
    WARNINGS + MISSING_INFO section (text part),
    ACTIONS section (text part),
    [each attachment that isIncluded and model.supportsMultimodal] (document/image parts),
    USER_QUESTION section (text part — always last)
  ]}
conversationHistory → interleaved messages before the final user message
```

**OpenAI (Chat Completions API):**
```
messages[0]: { role: 'system', content: SYSTEM_ROLE + SYSTEM_FORMAT }
messages[1..n-1]: conversationHistory mapped to user/assistant roles
messages[n]: { role: 'user', content: [
    LEGAL_CONTEXT + DECISION + EVIDENCE + WARNINGS + MISSING_INFO + ACTIONS text,
    USER_QUESTION
  ]}
Note: OpenAI system message cannot appear mid-conversation; history follows system
```

**Gemini (Generative Language API):**
```
system_instruction: { parts: [{ text: SYSTEM_ROLE + SYSTEM_FORMAT }] }
contents: [
  ...conversationHistory.map(m => ({ role: m.role==='USER'?'user':'model', parts: [...] })),
  { role: 'user', parts: [
      { text: LEGAL_CONTEXT + DECISION + EVIDENCE + WARNINGS + MISSING_INFO + ACTIONS },
      ...attachments.filter(isIncluded).map(a => ({ inline_data: { mime_type, data } })),
      { text: USER_QUESTION }
    ]}
]
```

**Local / Ollama (OpenAI-compatible):**
```
Same as OpenAI format.
Note: older local models may not support system role; if so, prepend system content to first user message.
If model.supportsSystemPrompt = false:
  messages[0] = { role: 'user', content: SYSTEM_ROLE + SYSTEM_FORMAT + '\n\n' + LEGAL_CONTEXT + ... + USER_QUESTION }
```

---

## 5. Legal Memo Format

When `outputFormat = 'LEGAL_MEMO'`, `PromptBuilder` injects additional structure instructions into the SYSTEM_FORMAT section:

```
'Hãy trả lời theo định dạng PHIẾU TƯ VẤN PHÁP LÝ với các mục sau:

PHIẾU TƯ VẤN PHÁP LÝ
Ngày: [ngày hôm nay]
Chủ đề: [tóm tắt câu hỏi]

I. CĂN CỨ PHÁP LÝ
   [Liệt kê tất cả văn bản pháp luật áp dụng với trích dẫn đầy đủ]

II. PHÂN TÍCH
   [Phân tích từng quy định pháp luật áp dụng cho tình huống cụ thể]

III. KẾT LUẬN
   [Nêu kết luận rõ ràng, khẳng định hoặc phủ nhận]

IV. LƯU Ý (nếu có)
   [Các ngoại lệ, cảnh báo, thông tin còn thiếu]

Ký tên: [Trợ lý AI — chỉ có giá trị tham khảo, không thay thế ý kiến pháp lý chuyên nghiệp]'
```

---

## 6. Streaming Support

For `stream()` calls:

```
PromptBuilder and TokenBudgetManager run identically to complete() calls.
PromptRenderer produces the same RenderedPrompt.
Adapter opens a streaming connection to the model API.
Each text delta is emitted as LLMStreamChunk.
On isLast=true: accumulated content → OutputValidator.validate()
If validation fails on the accumulated content:
  If HALLUCINATED_CITATION: emit a final correction chunk: '\n\n[⚠ Trích dẫn đã được hiệu chỉnh]'
  If DECISION_CONTRADICTION: emit a final warning chunk
  Full redaction is NOT applied mid-stream (cannot retract already-sent tokens)
  The validated LLMResponse includes the redacted version for record-keeping
```

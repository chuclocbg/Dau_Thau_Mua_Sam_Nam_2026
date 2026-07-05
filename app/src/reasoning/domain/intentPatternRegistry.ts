import type { IntentType } from './reasoningTypes.ts'

// ── Intent classification trigger phrases ──────────────────────────────────────
// Per app/knowledge/reasoning/pipeline.md "Intent Classification". Vietnamese trigger
// phrases per intent, matched as case-insensitive substrings against the normalized
// question. GENERAL has no triggers — it is the fallback when nothing else scores.
// Open registry: new phrases are additive, zero code change elsewhere.

export const INTENT_PATTERN_REGISTRY: Readonly<Record<IntentType, readonly string[]>> = Object.freeze({
  THRESHOLD_CHECK: [
    'ngưỡng', 'hạn mức', 'dưới bao nhiêu', 'trên bao nhiêu', 'vượt', 'không vượt',
    'áp dụng phương thức nào', 'chỉ định thầu được không',
  ],
  METHOD_SELECTION: [
    'phương thức nào', 'hình thức lựa chọn', 'đấu thầu hay chỉ định',
    'được chỉ định không', 'có phải đấu thầu',
  ],
  ADVANCE_PAYMENT_RULE: [
    'tạm ứng', 'ứng trước', 'mức tạm ứng', 'tỷ lệ tạm ứng', 'điều kiện tạm ứng',
  ],
  GUARANTEE_RULE: [
    'bảo lãnh', 'bảo đảm dự thầu', 'bảo đảm thực hiện', 'bảo đảm tạm ứng',
    'mức bảo lãnh', 'thời hạn bảo lãnh',
  ],
  AUTHORITY_CHECK: [
    'ai phê duyệt', 'thẩm quyền', 'cấp nào', 'giám đốc được không', 'cần phê duyệt của ai',
  ],
  COMPLIANCE_CHECK: [
    'có đúng không', 'có hợp lệ không', 'vi phạm không', 'có được không', 'đúng quy định',
  ],
  EXCEPTION_INQUIRY: [
    'ngoại lệ', 'trường hợp nào được', 'trừ trường hợp', 'miễn', 'không áp dụng khi nào',
  ],
  DOCUMENT_REQUIRED: [
    'cần hồ sơ gì', 'hồ sơ yêu cầu', 'tài liệu cần', 'giấy tờ cần thiết',
  ],
  TIMELINE_CHECK: [
    'thời hạn', 'trong bao lâu', 'thời gian tối thiểu', 'thời gian tối đa', 'bao nhiêu ngày',
  ],
  CONFLICT_RESOLUTION: [
    'mâu thuẫn', 'xung đột', 'quy định nào ưu tiên', 'văn bản nào có hiệu lực hơn',
  ],
  DEFINITION_LOOKUP: [
    'là gì', 'định nghĩa', 'khái niệm',
  ],
  PROCEDURE_GUIDE: [
    'quy trình', 'các bước', 'thủ tục thực hiện', 'làm thế nào để',
  ],
  BEST_PRACTICE: [
    'thông lệ tốt', 'kinh nghiệm', 'cách làm tốt nhất',
  ],
  RISK_ASSESSMENT: [
    'rủi ro', 'nguy cơ', 'đánh giá rủi ro',
  ],
  GENERAL: [],
})

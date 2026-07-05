import type { AIContext, PromptSection, PromptSpec } from '../domain/aiTypes.ts'

// ── PromptBuilder — presentation only ──────────────────────────────────────────
// Per this milestone's mandatory requirement 4: no legal reasoning, no business
// rules, no decision making. Every section's content is a plain-text rendering of
// data AIContext already computed — this module never inspects a ReasoningResult,
// KnowledgeItemRef, or ReasoningContext (it cannot import src/reasoning/ at all;
// enforced by ai-architecture.test.ts). buildPrompt() is a pure function: the same
// AIContext always produces byte-identical output.

function buildSystemSection(context: AIContext): PromptSection {
  const lines = [
    `Vai trò: ${context.systemInstructions.role}`,
    `Ngôn ngữ đầu ra: ${context.systemInstructions.outputLanguage}`,
    `Định dạng: ${context.systemInstructions.outputFormat}`,
    `Văn phong: ${context.systemInstructions.tone}`,
    'Quy tắc bắt buộc:',
    ...context.systemInstructions.forbiddenBehaviors.map(rule => `- ${rule}`),
  ]
  return { kind: 'SYSTEM_INSTRUCTIONS', title: 'Hướng dẫn hệ thống', content: lines.join('\n') }
}

function buildQuestionSection(context: AIContext): PromptSection {
  return { kind: 'QUESTION', title: 'Câu hỏi', content: context.question }
}

function buildDecisionContextSection(context: AIContext): PromptSection {
  const lines = [
    `Kết luận: ${context.decision ?? '(chưa có kết luận tự động)'}`,
    `Độ tin cậy: ${(context.confidence * 100).toFixed(0)}% (${context.confidenceLabel})`,
    `Cần rà soát thủ công: ${context.humanReviewRequired ? 'Có' : 'Không'}`,
  ]
  if (context.humanReviewReason) lines.push(`Lý do: ${context.humanReviewReason}`)
  return { kind: 'DECISION_CONTEXT', title: 'Bối cảnh kết luận', content: lines.join('\n') }
}

function buildLegalBasisSection(context: AIContext): PromptSection {
  const content = context.legalBasis.length > 0
    ? context.legalBasis.map(basis => `- ${basis.citationFull}: ${basis.provisionText}`).join('\n')
    : '(không có căn cứ pháp lý)'
  return { kind: 'LEGAL_BASIS', title: 'Căn cứ pháp lý', content }
}

function buildEvidenceSection(context: AIContext): PromptSection {
  const content = context.evidence.length > 0
    ? context.evidence.map(item => `- ${item.title}: ${item.summary}`).join('\n')
    : '(không có chứng cứ bổ sung)'
  return { kind: 'EVIDENCE', title: 'Chứng cứ', content }
}

function buildWarningsSection(context: AIContext): PromptSection {
  const content = context.warnings.length > 0
    ? context.warnings.map(w => `- [${w.severity}] ${w.message}`).join('\n')
    : '(không có cảnh báo)'
  return { kind: 'WARNINGS', title: 'Cảnh báo', content }
}

export function buildPrompt(context: AIContext): PromptSpec {
  return {
    contextId: context.contextId,
    sections: [
      buildSystemSection(context),
      buildQuestionSection(context),
      buildDecisionContextSection(context),
      buildLegalBasisSection(context),
      buildEvidenceSection(context),
      buildWarningsSection(context),
    ],
    conversationMessages: context.conversationHistory,
  }
}

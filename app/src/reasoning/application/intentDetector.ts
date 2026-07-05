import { INTENT_PATTERN_REGISTRY } from '../domain/intentPatternRegistry.ts'
import type {
  DetectedEntity, EntityType, IntentType, ReasoningContext, ReasoningIntent, ReasoningQuestion,
} from '../domain/reasoningTypes.ts'

// ── Stage 1 — Intent Detection ─────────────────────────────────────────────────
// Per app/knowledge/reasoning/pipeline.md Stage 1. Classifies intentType, extracts
// entities, merges caller-provided context with entities extracted from the question.
//
// SCOPE NOTE: extracted MONEY_AMOUNT entities are deliberately NOT auto-assigned to a
// specific ReasoningContext field (estimatedValue / advanceAmount / contractValue) —
// which amount maps to which field cannot be determined from generic pattern matching
// alone, and a wrong guess here would silently corrupt a threshold evaluation. Per
// CLAUDE.md's audit-first / no-fabrication principle, only the caller's explicit
// context ever populates value fields; extracted money amounts are surfaced only via
// the returned DetectedEntity[] for the caller/UI to confirm.

const DOCUMENT_SYMBOL_PATTERN = /\d{1,3}\/\d{4}\/[A-ZĐ][A-ZĐ0-9-]*/g
const ARTICLE_REF_PATTERN = /Điều\s+\d+(?:\s+khoản\s+\d+)?(?:\s+điểm\s+[a-zđ])?/gi
const MONEY_AMOUNT_PATTERN = /\d+(?:[.,]\d+)?\s*(?:tỷ|triệu|nghìn|VNĐ|đồng|VND)/gi
const DATE_PATTERN = /\d{2}\/\d{2}\/\d{4}|năm\s+\d{4}/gi

const LEGAL_CONCEPTS = [
  'tạm ứng', 'bảo lãnh dự thầu', 'hồ sơ mời thầu', 'chỉ định thầu',
  'đấu thầu rộng rãi', 'bảo đảm thực hiện hợp đồng', 'chào hàng cạnh tranh',
]

const PROCUREMENT_METHOD_KEYWORDS: Readonly<Record<string, string>> = Object.freeze({
  'đấu thầu rộng rãi': 'OPEN_TENDER',
  'đấu thầu hạn chế': 'LIMITED_TENDER',
  'chỉ định thầu': 'DIRECT_AWARD',
  'chào hàng cạnh tranh': 'COMPETITIVE_OFFER',
})

const PACKAGE_TYPE_KEYWORDS: Readonly<Record<string, string>> = Object.freeze({
  'hàng hóa': 'GOODS',
  'xây dựng': 'CONSTRUCTION',
  'tư vấn': 'CONSULTING',
  'hỗn hợp': 'MIXED',
})

const FUND_SOURCE_KEYWORDS: Readonly<Record<string, string>> = Object.freeze({
  'ngân sách nhà nước': 'STATE_BUDGET',
  'oda': 'ODA',
  'ppp': 'PPP',
  'doanh nghiệp': 'ENTERPRISE',
})

function extractByPattern(
  text: string, pattern: RegExp, entityType: EntityType, confidence: number,
): DetectedEntity[] {
  const entities: DetectedEntity[] = []
  for (const match of text.matchAll(pattern)) {
    if (match.index === undefined) continue
    entities.push({
      entityType, value: match[0], rawText: match[0], confidence,
      startOffset: match.index, endOffset: match.index + match[0].length,
    })
  }
  return entities
}

function extractByKeywordMap(
  text: string, keywordMap: Readonly<Record<string, string>>, entityType: EntityType,
): DetectedEntity[] {
  const entities: DetectedEntity[] = []
  for (const phrase of Object.keys(keywordMap)) {
    const index = text.indexOf(phrase)
    if (index >= 0) {
      entities.push({
        entityType, value: keywordMap[phrase]!, rawText: phrase, confidence: 0.9,
        startOffset: index, endOffset: index + phrase.length,
      })
    }
  }
  return entities
}

function extractEntities(originalText: string, normalizedQuestion: string): DetectedEntity[] {
  // DOCUMENT_SYMBOL relies on uppercase document-type codes (QH15, NĐ-CP, TT-BTC) —
  // extracted from the original-case text, not the lowercased classification text.
  const entities: DetectedEntity[] = [
    ...extractByPattern(originalText, DOCUMENT_SYMBOL_PATTERN, 'DOCUMENT_SYMBOL', 0.95),
    ...extractByPattern(normalizedQuestion, ARTICLE_REF_PATTERN, 'ARTICLE_REF', 0.9),
    ...extractByPattern(normalizedQuestion, MONEY_AMOUNT_PATTERN, 'MONEY_AMOUNT', 0.85),
    ...extractByPattern(normalizedQuestion, DATE_PATTERN, 'DATE', 0.85),
    ...extractByKeywordMap(normalizedQuestion, PROCUREMENT_METHOD_KEYWORDS, 'PROCUREMENT_METHOD'),
    ...extractByKeywordMap(normalizedQuestion, PACKAGE_TYPE_KEYWORDS, 'PACKAGE_TYPE'),
    ...extractByKeywordMap(normalizedQuestion, FUND_SOURCE_KEYWORDS, 'FUND_SOURCE'),
  ]
  for (const concept of LEGAL_CONCEPTS) {
    const index = normalizedQuestion.indexOf(concept)
    if (index >= 0) {
      entities.push({
        entityType: 'LEGAL_CONCEPT', value: concept, rawText: concept, confidence: 0.8,
        startOffset: index, endOffset: index + concept.length,
      })
    }
  }
  return entities
}

function scoreIntent(normalizedQuestion: string, triggers: readonly string[]): number {
  const matched = triggers.filter(t => normalizedQuestion.includes(t)).length
  if (matched === 0) return 0
  return Math.min(1, 0.6 + (matched - 1) * 0.2)
}

function classifyIntent(normalizedQuestion: string): { intentType: IntentType; confidence: number; ambiguous: boolean; alternatives?: IntentType[] } {
  const scores = (Object.keys(INTENT_PATTERN_REGISTRY) as IntentType[])
    .filter(intentType => intentType !== 'GENERAL')
    .map(intentType => ({ intentType, score: scoreIntent(normalizedQuestion, INTENT_PATTERN_REGISTRY[intentType]) }))
    .sort((a, b) => b.score - a.score)

  const top = scores[0]
  if (!top || top.score === 0) {
    return { intentType: 'GENERAL', confidence: 0.3, ambiguous: false }
  }

  const tiedWithin = scores.filter(s => s.score > 0 && top.score - s.score <= 0.10 && s.intentType !== top.intentType)
  const ambiguous = tiedWithin.length > 0

  return {
    intentType: top.intentType,
    confidence: ambiguous ? Math.max(0, top.score - 0.10) : top.score,
    ambiguous,
    alternatives: ambiguous ? tiedWithin.map(s => s.intentType) : undefined,
  }
}

function buildContext(
  question: ReasoningQuestion, entities: readonly DetectedEntity[],
): ReasoningContext {
  const extractedProcurementMethod = entities.find(e => e.entityType === 'PROCUREMENT_METHOD')?.value
  const extractedPackageType = entities.find(e => e.entityType === 'PACKAGE_TYPE')?.value
  const extractedFundSource = entities.find(e => e.entityType === 'FUND_SOURCE')?.value
  const documentSymbols = entities.filter(e => e.entityType === 'DOCUMENT_SYMBOL').map(e => e.value)
  const articles = entities.filter(e => e.entityType === 'ARTICLE_REF').map(e => e.value)
  const concepts = entities.filter(e => e.entityType === 'LEGAL_CONCEPT').map(e => e.value)

  return {
    ...question.context,
    asOfDate: question.asOfDate ?? question.context?.asOfDate ?? new Date().toISOString().slice(0, 10),
    procurementMethod: question.context?.procurementMethod ?? extractedProcurementMethod,
    packageType: question.context?.packageType ?? extractedPackageType,
    fundSource: question.context?.fundSource ?? extractedFundSource,
    mentionedDocumentSymbols: documentSymbols.length > 0 ? documentSymbols : question.context?.mentionedDocumentSymbols,
    mentionedArticles: articles.length > 0 ? articles : question.context?.mentionedArticles,
    mentionedConcepts: concepts.length > 0 ? concepts : question.context?.mentionedConcepts,
  }
}

export function detectIntent(question: ReasoningQuestion): ReasoningIntent {
  const normalizedQuestion = question.question.trim().toLowerCase()
  const entities = extractEntities(question.question.trim(), normalizedQuestion)
  const classification = classifyIntent(normalizedQuestion)
  const context = buildContext(question, entities)

  return {
    intentType: classification.intentType,
    question: question.question,
    normalizedQuestion,
    detectedEntities: entities,
    context,
    confidence: classification.confidence,
    ambiguous: classification.ambiguous,
    alternatives: classification.alternatives,
  }
}

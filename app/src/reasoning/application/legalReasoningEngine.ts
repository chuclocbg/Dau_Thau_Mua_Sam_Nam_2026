import { detectExceptions, evaluateRule, evaluateThreshold } from './ruleEngine.ts'
import { collectEvidence } from './evidenceCollector.ts'
import { formatCitations } from './citationFormatter.ts'
import { buildExplanation, composeDecision, computeConfidence, determineHumanReview } from './answerComposer.ts'
import type {
  AppliedArticle, AppliedDocument, AppliedRole, ConflictingItem, DetectedConflict,
  DetectedException, ILegalReasoningEngine, KnowledgeItemRef, LegalBasisRef, LegalReasoningStep,
  ReasoningExplanation, ReasoningIntent, ReasoningOutputFormat, ReasoningResult, ReasoningWarning,
  ResolvedKnowledge,
} from '../domain/reasoningTypes.ts'

// ── legalReasoningEngine.ts — orchestrates Stages 1, 3-7 ────────────────────────
// Per PHASE_X_EXECUTION_PLAN.md / PHASE_X2_IMPLEMENTATION_STRATEGY.md, this file
// also carries Stage 3's responsibilities (applicable law, hierarchy, conflict
// resolution, supersession) since the user-approved goal list for this milestone
// does not include a separate reasoningEngine.ts — folding Stage 3 in here avoids
// introducing a file beyond what was requested.
//
// Stage 2 (Knowledge Resolution — the only stage calling IKnowledgePlatform) is out
// of scope: ResolvedKnowledge is a caller-supplied parameter here, produced by
// mockKnowledgeFixtures.ts in Batch A and by X.3's knowledgeResolver.ts in production.
// Cross-reference graph expansion (Stage 3 Responsibility 6) is deferred to X.3 along
// with the knowledge graph it requires — appliedArticles[].crossReferences is always
// empty in Batch A.

const AUTHORITY_LEVEL_BY_TYPE: Readonly<Record<string, number>> = Object.freeze({
  CONSTITUTION: 1, LAW: 3, DECREE: 6, CIRCULAR: 8, OFFICIAL_LETTER: 11, INTERNAL_REGULATION: 14,
})

function authorityLevelOf(item: KnowledgeItemRef): number {
  return AUTHORITY_LEVEL_BY_TYPE[item.type] ?? 99
}

function isSupersededAt(item: KnowledgeItemRef, asOfDate: string): boolean {
  return item.effectiveTo !== undefined && item.effectiveTo <= asOfDate
}

function isEffectiveAt(item: KnowledgeItemRef, asOfDate: string): boolean {
  return item.effectiveFrom <= asOfDate && !isSupersededAt(item, asOfDate)
}

function toConflictingItem(item: KnowledgeItemRef): ConflictingItem {
  const basis = item.legalBasis[0]
  return {
    itemId: item.itemId, documentSymbol: basis?.documentSymbol ?? item.itemId,
    article: basis?.article, provision: item.summary, authorityLevel: authorityLevelOf(item),
    effectiveFrom: item.effectiveFrom, layer: item.layer,
  }
}

function isMoreRestrictive(candidate: KnowledgeItemRef, baseline: KnowledgeItemRef): boolean | null {
  const candidateValue = Number.parseFloat(String(candidate.metadata['conflictValue'] ?? ''))
  const baselineValue = Number.parseFloat(String(baseline.metadata['conflictValue'] ?? ''))
  if (Number.isNaN(candidateValue) || Number.isNaN(baselineValue)) return null
  if (candidateValue === baselineValue) return null
  return candidateValue < baselineValue
}

interface ConflictOutcome {
  readonly conflict: DetectedConflict
  readonly primaryItemId?: string
  readonly conflictSourceItemIds: readonly string[]
}

function resolveConflict(a: KnowledgeItemRef, b: KnowledgeItemRef): ConflictOutcome {
  const conflictId = `conflict-${a.itemId}-${b.itemId}`
  const description = `Xung đột giữa ${a.legalBasis[0]?.documentSymbol ?? a.itemId} và ${b.legalBasis[0]?.documentSymbol ?? b.itemId}`
  const conflictingItems: readonly [ConflictingItem, ConflictingItem] = [toConflictingItem(a), toConflictingItem(b)]

  const layer3 = a.layer === 3 ? a : b.layer === 3 ? b : null
  if (layer3) {
    const other = layer3 === a ? b : a
    const moreRestrictive = isMoreRestrictive(layer3, other)
    if (moreRestrictive === true) {
      return {
        conflict: { conflictId, description, conflictingItems, resolution: 'RESOLVED_BY_MORE_RESTRICTIVE', isResolved: true, appliedItem: layer3.itemId, supersededItem: undefined },
        primaryItemId: layer3.itemId, conflictSourceItemIds: [],
      }
    }
    if (moreRestrictive === false) {
      return {
        conflict: { conflictId, description, conflictingItems, resolution: 'RESOLVED_BY_HIERARCHY', isResolved: true, appliedItem: other.itemId, supersededItem: layer3.itemId },
        primaryItemId: other.itemId, conflictSourceItemIds: [layer3.itemId],
      }
    }
  }

  const levelA = authorityLevelOf(a), levelB = authorityLevelOf(b)
  if (levelA !== levelB) {
    const [winner, loser] = levelA < levelB ? [a, b] : [b, a]
    return {
      conflict: { conflictId, description, conflictingItems, resolution: 'RESOLVED_BY_HIERARCHY', isResolved: true, appliedItem: winner.itemId, supersededItem: loser.itemId },
      primaryItemId: winner.itemId, conflictSourceItemIds: [loser.itemId],
    }
  }

  if (a.effectiveFrom !== b.effectiveFrom) {
    const [winner, loser] = a.effectiveFrom > b.effectiveFrom ? [a, b] : [b, a]
    return {
      conflict: { conflictId, description, conflictingItems, resolution: 'RESOLVED_BY_LEX_POSTERIOR', isResolved: true, appliedItem: winner.itemId, supersededItem: loser.itemId },
      primaryItemId: winner.itemId, conflictSourceItemIds: [loser.itemId],
    }
  }

  const scopeA = String(a.metadata['scope'] ?? 'ALL')
  const scopeB = String(b.metadata['scope'] ?? 'ALL')
  if (scopeA !== scopeB) {
    const [narrow, broad] = scopeA === 'ALL' ? [b, a] : [a, b]
    if (scopeA === 'ALL' || scopeB === 'ALL') {
      return {
        conflict: { conflictId, description, conflictingItems, resolution: 'RESOLVED_BY_LEX_SPECIALIS', isResolved: true, appliedItem: narrow.itemId, supersededItem: broad.itemId },
        primaryItemId: narrow.itemId, conflictSourceItemIds: [broad.itemId],
      }
    }
  }

  return {
    conflict: { conflictId, description, conflictingItems, resolution: 'UNRESOLVED', isResolved: false },
    conflictSourceItemIds: [a.itemId, b.itemId],
  }
}

function detectAndResolveConflicts(activeItems: readonly KnowledgeItemRef[]): ConflictOutcome[] {
  const groups = new Map<string, KnowledgeItemRef[]>()
  for (const item of activeItems) {
    const dimension = item.metadata['conflictDimension']
    if (typeof dimension !== 'string') continue
    const group = groups.get(dimension) ?? []
    group.push(item)
    groups.set(dimension, group)
  }

  const outcomes: ConflictOutcome[] = []
  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!, b = group[j]!
        if (a.metadata['conflictValue'] === b.metadata['conflictValue']) continue
        outcomes.push(resolveConflict(a, b))
      }
    }
  }
  return outcomes
}

function toAppliedArticle(item: KnowledgeItemRef, role: AppliedRole): AppliedArticle {
  const basis = item.legalBasis[0]
  return {
    itemId: item.itemId, documentSymbol: basis?.documentSymbol ?? item.itemId, documentType: item.type,
    article: basis?.article, clause: basis?.clause, point: basis?.point,
    extractedText: item.summary, role, applicabilityScore: item.confidence,
    exceptions: [], crossReferences: [],
  }
}

function toAppliedDocument(item: KnowledgeItemRef, role: AppliedRole, wasSuperseded: boolean): AppliedDocument {
  const basis = item.legalBasis[0]
  return {
    itemId: item.itemId, documentSymbol: basis?.documentSymbol ?? item.itemId, documentType: item.type,
    title: item.title, authorityLevel: authorityLevelOf(item), effectiveFrom: item.effectiveFrom,
    effectiveTo: item.effectiveTo, role, wasSuperseded,
  }
}

function promoteToPrimary(appliedArticles: AppliedArticle[], legalBasis: readonly LegalBasisRef[]): void {
  for (const basis of legalBasis) {
    for (const article of appliedArticles) {
      const matches = article.documentSymbol === basis.documentSymbol
        && (basis.article === undefined || article.article === basis.article)
      if (matches && article.role === 'SUPPORTING_BASIS') {
        (article as { role: AppliedRole }).role = 'PRIMARY_BASIS'
      }
    }
  }
}

let stepSeq = 0
function traceStep(
  trace: LegalReasoningStep[], stage: LegalReasoningStep['stage'], action: LegalReasoningStep['action'],
  description: string, itemIdsConsumed: readonly string[] = [], confidence = 1, flagged = false,
): void {
  trace.push({ stepId: `step-${++stepSeq}`, stage, action, description, itemIdsConsumed, confidence, flagged, humanReviewTriggered: false })
}

export class LegalReasoningEngine implements ILegalReasoningEngine {
  // Stage 1 (intent detection) is now the caller's responsibility — per the pre-X.4 API
  // cleanup, intent is supplied here, never detected internally, so a caller holding a
  // ReasoningIntent already (e.g. one that also drove Knowledge Resolution) never re-detects it.
  async reason(intent: ReasoningIntent, resolvedKnowledge: ResolvedKnowledge): Promise<ReasoningResult> {
    const trace: LegalReasoningStep[] = []
    const warnings: ReasoningWarning[] = []

    const asOfDate = intent.context.asOfDate
    traceStep(trace, 'INTENT_DETECTION', 'DETECT_INTENT', `Phát hiện ý định: ${intent.intentType} (confidence: ${intent.confidence.toFixed(2)})`, [], intent.confidence)

    const candidates = [...resolvedKnowledge.legalItems, ...resolvedKnowledge.schoolPolicyItems]
    const activeItems = candidates.filter(item => isEffectiveAt(item, asOfDate))
    const supersededItems = candidates.filter(item => isSupersededAt(item, asOfDate))

    const roleByItemId = new Map<string, AppliedRole>(activeItems.map(item => [item.itemId, 'SUPPORTING_BASIS' as AppliedRole]))

    const conflictOutcomes = detectAndResolveConflicts(activeItems)
    const conflicts: DetectedConflict[] = []
    for (const outcome of conflictOutcomes) {
      conflicts.push(outcome.conflict)
      if (outcome.primaryItemId) roleByItemId.set(outcome.primaryItemId, 'PRIMARY_BASIS')
      for (const id of outcome.conflictSourceItemIds) roleByItemId.set(id, 'CONFLICT_SOURCE')
      traceStep(
        trace, 'REASONING', outcome.conflict.isResolved ? 'RESOLVE_CONFLICT' : 'DETECT_CONFLICT',
        outcome.conflict.description + ' — ' + outcome.conflict.resolution,
        outcome.conflict.conflictingItems.map(c => c.itemId), outcome.conflict.isResolved ? 0.9 : 0.5,
        !outcome.conflict.isResolved,
      )
      if (!outcome.conflict.isResolved) {
        warnings.push({ warningCode: 'UNRESOLVED_CONFLICT', severity: 'HIGH', stage: 'REASONING', message: `Cần tư vấn pháp lý: ${outcome.conflict.description} chưa được giải quyết` })
      }
    }

    const appliedArticles: AppliedArticle[] = activeItems.map(item => toAppliedArticle(item, roleByItemId.get(item.itemId)!))
    const appliedDocuments: AppliedDocument[] = activeItems.map(item => toAppliedDocument(item, roleByItemId.get(item.itemId)!, false))

    for (const item of supersededItems) {
      appliedArticles.push(toAppliedArticle(item, 'SUPERSEDED_CONTEXT'))
      appliedDocuments.push(toAppliedDocument(item, 'SUPERSEDED_CONTEXT', true))
      warnings.push({ warningCode: 'SUPERSEDED_DOCUMENT', severity: 'MEDIUM', stage: 'REASONING', message: `Văn bản ${item.legalBasis[0]?.documentSymbol ?? item.itemId} đã hết hiệu lực`, itemId: item.itemId })
    }

    const allExceptions: DetectedException[] = []
    for (const article of appliedArticles) {
      const exceptions = detectExceptions(article, intent.context)
      article.exceptions.push(...exceptions)
      allExceptions.push(...exceptions)
      for (const exception of exceptions) {
        traceStep(trace, 'RULE_EVALUATION', 'DETECT_EXCEPTION', `Phát hiện ngoại lệ [${exception.patternCode}]: ${exception.conditionText}`, [article.itemId], exception.isApplicable === null ? 0.5 : 0.9, exception.isApplicable === null)
      }
    }

    const thresholdResults = resolvedKnowledge.thresholdItems
      .map(item => evaluateThreshold(item, intent.context))
      .filter((r): r is NonNullable<typeof r> => r !== null)
    for (const result of thresholdResults) {
      traceStep(trace, 'RULE_EVALUATION', 'EVALUATE_THRESHOLD', `Đánh giá ngưỡng ${result.thresholdCode}: ${result.passed ? 'đạt' : 'không đạt'}`, [result.thresholdItemId])
      promoteToPrimary(appliedArticles, result.legalBasis)
    }

    const ruleResults = resolvedKnowledge.ruleItems.map(item => evaluateRule(item, intent.context, allExceptions))
    for (const result of ruleResults) {
      traceStep(trace, 'RULE_EVALUATION', 'EVALUATE_RULE', `Đánh giá quy tắc ${result.ruleCode}: ${result.status}`, [result.ruleItemId], result.status === 'INCONCLUSIVE' ? 0.5 : 0.9, result.status === 'INCONCLUSIVE')
      if (result.status === 'PASS' || result.status === 'EXCEPTION') promoteToPrimary(appliedArticles, result.legalBasis)
    }

    const { missingEvidence, warnings: evidenceWarnings, sufficiency } = collectEvidence(appliedArticles, ruleResults)
    warnings.push(...evidenceWarnings)
    traceStep(trace, 'EVIDENCE_COLLECTION', 'ASSESS_EVIDENCE_SUFFICIENCY', `Đánh giá đầy đủ chứng cứ: ${sufficiency}`, [], sufficiency === 'SUFFICIENT' ? 1 : 0.6, sufficiency === 'INSUFFICIENT')

    const citations = formatCitations(appliedArticles)
    traceStep(trace, 'CITATION_FORMATTING', 'FORMAT_CITATION', `Định dạng ${citations.length} trích dẫn`, citations.map(c => c.itemId))

    const primaryItemConfidences = activeItems
      .filter(item => roleByItemId.get(item.itemId) === 'PRIMARY_BASIS')
      .map(item => item.confidence)

    const confidence = computeConfidence({
      intent, conflicts, appliedDocuments, missingEvidence,
      unresolvedCrossReferenceCount: missingEvidence.filter(m => m.evidenceId.startsWith('missing-xref-')).length,
      unresolvedExceptionCount: allExceptions.filter(e => e.isApplicable === null).length,
      primaryItemConfidences,
    })
    traceStep(trace, 'ANSWER_COMPOSITION', 'COMPUTE_CONFIDENCE', `Điểm tin cậy: ${(confidence.finalScore * 100).toFixed(0)}% (${confidence.label})`, [], confidence.finalScore)

    const humanReview = determineHumanReview({
      confidence: confidence.finalScore, conflicts, missingEvidence,
      unresolvedExceptionCount: allExceptions.filter(e => e.isApplicable === null).length,
      primaryItemConfidences, externallyFlagged: false,
    })
    traceStep(trace, 'ANSWER_COMPOSITION', 'DETERMINE_HUMAN_REVIEW', humanReview.required ? `Yêu cầu rà soát: ${humanReview.reason}` : 'Không yêu cầu rà soát thủ công', [], confidence.finalScore, humanReview.required)

    const decision = composeDecision(citations, ruleResults, confidence.finalScore)
    traceStep(trace, 'ANSWER_COMPOSITION', 'COMPOSE_DECISION', decision ? 'Đã tổng hợp quyết định' : 'Không thể tổng hợp quyết định tự động', [], confidence.finalScore)

    // ReasoningIntent carries no outputFormat (that field lived only on the now-removed
    // ReasoningQuestion parameter) — reason() always composes the default DECISION-format
    // explanation; call explain(result, format) to regenerate at a different format.
    const explainability = buildExplanation({ format: 'DECISION', decision, appliedArticles, conflicts, missingEvidence, confidence, citations })

    return {
      decision, confidence: confidence.finalScore, confidenceLabel: confidence.label,
      appliedDocuments, appliedArticles, reasoningTrace: trace, citations, missingEvidence,
      evidenceSufficiency: sufficiency, warnings, humanReviewRequired: humanReview.required,
      humanReviewReason: humanReview.reason, intent, explainability, resolvedKnowledge, conflicts,
      thresholdResults, ruleResults, asOfDate, answeredAt: new Date().toISOString(),
    }
  }

  explain(result: ReasoningResult, format: ReasoningOutputFormat): ReasoningExplanation {
    return buildExplanation({
      format, decision: result.decision, appliedArticles: result.appliedArticles,
      conflicts: result.conflicts, missingEvidence: result.missingEvidence,
      confidence: { baseScore: 1, deductions: [], finalScore: result.confidence, label: result.confidenceLabel },
      citations: result.citations,
    })
  }
}

export function buildLegalReasoningEngine(): LegalReasoningEngine {
  return new LegalReasoningEngine()
}

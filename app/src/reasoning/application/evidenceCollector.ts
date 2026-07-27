import type {
  AppliedArticle, EvidenceSufficiency, LegalRuleResult, MissingEvidence, ReasoningWarning,
} from '../domain/reasoningTypes.ts'

// ── Stage 5 — Evidence Collection ───────────────────────────────────────────────
// Per app/knowledge/reasoning/pipeline.md Stage 5, Responsibility 10.

export interface EvidenceCollectionResult {
  readonly missingEvidence: readonly MissingEvidence[]
  readonly warnings: readonly ReasoningWarning[]
  readonly sufficiency: EvidenceSufficiency
}

function hasBackingArticle(rule: LegalRuleResult, appliedArticles: readonly AppliedArticle[]): boolean {
  // A rule's evidence[] is a self-reference to its own rule item, not an article id —
  // rule items and legal-article items live in disjoint id namespaces (see
  // mockKnowledgeFixtures.ts). Whether a rule is actually backed by an applied article
  // is determined by matching its legalBasis (documentSymbol/article) against the
  // articles the pipeline actually applied, not by comparing itemIds directly.
  return rule.legalBasis.some(basis => appliedArticles.some(a =>
    a.documentSymbol === basis.documentSymbol && (basis.article === undefined || a.article === basis.article),
  ))
}

export function collectEvidence(
  appliedArticles: readonly AppliedArticle[], ruleResults: readonly LegalRuleResult[],
): EvidenceCollectionResult {
  const primaryArticles = appliedArticles.filter(a => a.role === 'PRIMARY_BASIS')
  const backingArticleIds = new Set(appliedArticles.map(a => a.itemId))

  const missingEvidence: MissingEvidence[] = []
  const warnings: ReasoningWarning[] = []

  for (const rule of ruleResults) {
    if (rule.status === 'INCONCLUSIVE') {
      missingEvidence.push({
        evidenceId: `missing-${rule.ruleItemId}`,
        description: `Thiếu thông tin: ${rule.missingFields.join(', ')}`,
        isCritical: true,
        suggestedSources: [rule.ruleCode],
        impact: `Không thể xác định kết quả quy tắc ${rule.ruleCode}`,
      })
    }
    if (!hasBackingArticle(rule, appliedArticles) && rule.status !== 'INCONCLUSIVE') {
      warnings.push({
        warningCode: 'WEAK_EVIDENCE',
        severity: 'MEDIUM',
        stage: 'EVIDENCE_COLLECTION',
        message: `Quy tắc ${rule.ruleCode} không có điều khoản áp dụng trực tiếp làm căn cứ`,
        itemId: rule.ruleItemId,
      })
    }
  }

  for (const article of primaryArticles) {
    for (const crossRefId of article.crossReferences) {
      if (!backingArticleIds.has(crossRefId)) {
        missingEvidence.push({
          evidenceId: `missing-xref-${crossRefId}`,
          description: `Chưa tìm thấy văn bản được trích dẫn: ${crossRefId}`,
          isCritical: false,
          impact: 'Thiếu cơ sở pháp lý bổ sung',
        })
      }
    }
  }

  const criticalCount = missingEvidence.filter(m => m.isCritical).length
  const sufficiency: EvidenceSufficiency =
    primaryArticles.length === 0 || criticalCount > 0
      ? 'INSUFFICIENT'
      : missingEvidence.length > 0
        ? 'PARTIAL'
        : 'SUFFICIENT'

  return { missingEvidence, warnings, sufficiency }
}

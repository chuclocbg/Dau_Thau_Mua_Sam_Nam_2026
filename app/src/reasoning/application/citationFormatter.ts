import type { AppliedArticle, FormattedCitation } from '../domain/reasoningTypes.ts'

// ── Stage 6 — Citation Formatter ────────────────────────────────────────────────
// Per app/knowledge/reasoning/pipeline.md Stage 6, Responsibility 11.

const DOCUMENT_TYPE_LABEL: Readonly<Record<string, string>> = Object.freeze({
  LAW: 'Luật', DECREE: 'Nghị định', CIRCULAR: 'Thông tư', INTERNAL_REGULATION: 'Quy chế nội bộ',
})

const DOCUMENT_TYPE_CODE: Readonly<Record<string, string>> = Object.freeze({
  LAW: 'Luật', DECREE: 'NĐ', CIRCULAR: 'TT', INTERNAL_REGULATION: 'QCNB',
})

function trailingToken(text: string | undefined): string {
  if (!text) return ''
  const match = /(\d+|[a-zđ]+)$/i.exec(text.trim())
  return match ? match[1]! : ''
}

function symbolNumberYear(documentSymbol: string): string {
  const parts = documentSymbol.split('/')
  return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : documentSymbol
}

const NORMATIVE_ROLES = new Set([
  'PRIMARY_BASIS', 'SUPPORTING_BASIS', 'EXCEPTION_SOURCE', 'CONFLICT_SOURCE', 'SCHOOL_POLICY_OVERRIDE',
])

export function formatCitations(appliedArticles: readonly AppliedArticle[]): FormattedCitation[] {
  let primaryAssigned = false

  return appliedArticles.map((article, index): FormattedCitation => {
    const typeLabel = DOCUMENT_TYPE_LABEL[article.documentType] ?? article.documentType
    const typeCode = DOCUMENT_TYPE_CODE[article.documentType] ?? article.documentType

    const fullParts = [article.article, article.clause, article.point, typeLabel, article.documentSymbol]
      .filter((part): part is string => Boolean(part))
    const full = fullParts.join(' ')

    const shortParts = [
      article.article ? `Đ${trailingToken(article.article)}` : '',
      trailingToken(article.clause),
      trailingToken(article.point),
    ].filter(Boolean)
    const short = `${shortParts.join('.')} ${typeCode} ${symbolNumberYear(article.documentSymbol)}`.trim()

    const inlineParts = [article.article, article.clause, typeCode, article.documentSymbol]
      .filter((part): part is string => Boolean(part))
    const inline = `(${inlineParts.join(' ')})`

    const isPrimary = article.role === 'PRIMARY_BASIS' && !primaryAssigned
    if (isPrimary) primaryAssigned = true

    return {
      citationId: `citation-${index + 1}`,
      itemId: article.itemId,
      documentSymbol: article.documentSymbol,
      article: article.article,
      clause: article.clause,
      point: article.point,
      full, short, inline,
      role: article.role,
      isNormative: NORMATIVE_ROLES.has(article.role),
      isPrimary,
    }
  })
}

import { describe, it, expect } from 'vitest'
import { collectEvidence } from '../reasoning/application/evidenceCollector.ts'
import type { AppliedArticle, LegalRuleResult } from '../reasoning/domain/reasoningTypes.ts'

function article(overrides: Partial<AppliedArticle>): AppliedArticle {
  return {
    itemId: 'item-1', documentSymbol: '22/2023/QH15', documentType: 'LAW', article: 'Điều 22',
    extractedText: 'x', role: 'PRIMARY_BASIS', applicabilityScore: 0.9, exceptions: [], crossReferences: [],
    ...overrides,
  }
}

function ruleResult(overrides: Partial<LegalRuleResult>): LegalRuleResult {
  return {
    ruleItemId: 'rule-1', ruleCode: 'RULE-X', status: 'PASS', evidence: ['rule-1'],
    legalBasis: [{ documentSymbol: '22/2023/QH15', article: 'Điều 22' }],
    explanation: 'x', missingFields: [],
    ...overrides,
  }
}

describe('collectEvidence', () => {
  it('is SUFFICIENT with a primary article and no missing evidence', () => {
    const result = collectEvidence([article({})], [ruleResult({})])
    expect(result.sufficiency).toBe('SUFFICIENT')
    expect(result.missingEvidence).toHaveLength(0)
  })

  it('is INSUFFICIENT with zero PRIMARY_BASIS articles', () => {
    const result = collectEvidence([article({ role: 'SUPPORTING_BASIS' })], [ruleResult({})])
    expect(result.sufficiency).toBe('INSUFFICIENT')
  })

  it('is INSUFFICIENT when a rule is INCONCLUSIVE (critical missing evidence)', () => {
    const result = collectEvidence(
      [article({})],
      [ruleResult({ status: 'INCONCLUSIVE', missingFields: ['fundSource'] })],
    )
    expect(result.sufficiency).toBe('INSUFFICIENT')
    expect(result.missingEvidence[0]!.isCritical).toBe(true)
  })

  it('does not flag WEAK_EVIDENCE when the rule legalBasis matches an applied article', () => {
    const result = collectEvidence([article({})], [ruleResult({})])
    expect(result.warnings.filter(w => w.warningCode === 'WEAK_EVIDENCE')).toHaveLength(0)
  })

  it('flags WEAK_EVIDENCE when a PASS rule has no matching applied article', () => {
    const result = collectEvidence(
      [article({ documentSymbol: '79/2025/TT-BTC', article: 'Điều 15' })],
      [ruleResult({})],
    )
    expect(result.warnings.some(w => w.warningCode === 'WEAK_EVIDENCE')).toBe(true)
  })

  it('does not flag WEAK_EVIDENCE for an INCONCLUSIVE rule (already covered by missing evidence)', () => {
    const result = collectEvidence(
      [article({ documentSymbol: 'other', article: undefined })],
      [ruleResult({ status: 'INCONCLUSIVE', missingFields: ['x'] })],
    )
    expect(result.warnings.filter(w => w.warningCode === 'WEAK_EVIDENCE')).toHaveLength(0)
  })
})

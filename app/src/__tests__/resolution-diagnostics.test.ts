import { describe, it, expect } from 'vitest'
import { buildResolutionDiagnostics } from '../reasoning/application/resolutionDiagnostics.ts'
import type { MissingEvidence } from '../reasoning/domain/reasoningTypes.ts'

function missingEvidence(id: string): MissingEvidence {
  return { evidenceId: id, description: 'd', isCritical: true, impact: 'i' }
}

describe('buildResolutionDiagnostics', () => {
  it('carries every input evaluation/missing-evidence entry forward unchanged', () => {
    const effectivePeriodEvaluations = [{ itemId: 'a', status: 'CURRENT' as const }]
    const applicabilityEvaluations = [{ itemId: 'a', status: 'APPLICABLE' as const }]
    const missing = [missingEvidence('mv-1')]

    const diagnostics = buildResolutionDiagnostics(effectivePeriodEvaluations, applicabilityEvaluations, missing)

    expect(diagnostics.effectivePeriodEvaluations).toBe(effectivePeriodEvaluations)
    expect(diagnostics.applicabilityEvaluations).toBe(applicabilityEvaluations)
    expect(diagnostics.missingEvidence).toBe(missing)
  })

  it('summary.totalItemsEvaluated counts every effectivePeriod evaluation', () => {
    const diagnostics = buildResolutionDiagnostics(
      [{ itemId: 'a', status: 'CURRENT' }, { itemId: 'b', status: 'EXPIRED' }], [], [],
    )
    expect(diagnostics.summary.totalItemsEvaluated).toBe(2)
  })

  it('summary counts NOT_YET_EFFECTIVE/EXPIRED/missingEvidence independently', () => {
    const diagnostics = buildResolutionDiagnostics(
      [],
      [
        { itemId: 'a', status: 'NOT_YET_EFFECTIVE' },
        { itemId: 'b', status: 'NOT_YET_EFFECTIVE' },
        { itemId: 'c', status: 'EXPIRED' },
        { itemId: 'd', status: 'APPLICABLE' },
      ],
      [missingEvidence('mv-1'), missingEvidence('mv-2')],
    )

    expect(diagnostics.summary.notYetEffectiveCount).toBe(2)
    expect(diagnostics.summary.expiredCount).toBe(1)
    expect(diagnostics.summary.missingEvidenceCount).toBe(2)
  })

  it('produces a zeroed summary for empty input', () => {
    const diagnostics = buildResolutionDiagnostics([], [], [])
    expect(diagnostics.summary).toEqual({
      totalItemsEvaluated: 0, notYetEffectiveCount: 0, expiredCount: 0, missingEvidenceCount: 0,
    })
  })
})

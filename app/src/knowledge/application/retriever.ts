import type { KnowledgeItem, KnowledgeApplicabilityRule, KnowledgeContext } from '../platform/knowledgeTypes.ts'
import type { KnowledgeRepositories } from '../repositories/knowledgeRepositories.ts'

// ── Retriever — the universal applicability-rule evaluator (fixes TD-02) ─────
// The SAME logic resolves "which legal documents apply" and "which templates
// apply" and "which risk patterns apply" — domain is just a filter, never a
// branch. This is the mechanism behind IKnowledgePlatform.resolveApplicableDocuments().

export function isEffectiveOn(item: KnowledgeItem, asOfDate: string): boolean {
  if (!item.effectivePeriod) return true
  const { startDate, endDate } = item.effectivePeriod
  return startDate <= asOfDate && (!endDate || endDate > asOfDate)
}

export function matchesApplicability(
  rule: KnowledgeApplicabilityRule,
  context: KnowledgeContext,
  asOfDate: string,
): boolean {
  if (!rule.isActive) return false
  if (rule.effectiveFrom > asOfDate) return false
  if (rule.effectiveUntil && rule.effectiveUntil <= asOfDate) return false

  if (rule.packageTypes && context.packageType && !rule.packageTypes.includes(context.packageType)) return false
  if (rule.procurementMethods && context.procurementMethod && !rule.procurementMethods.includes(context.procurementMethod)) return false
  if (rule.fundSources && context.fundSource && !rule.fundSources.includes(context.fundSource)) return false
  if (rule.departments && context.department && !rule.departments.includes(context.department)) return false
  if (rule.minValue !== undefined && context.valueAmount !== undefined && context.valueAmount < rule.minValue) return false
  if (rule.maxValue !== undefined && context.valueAmount !== undefined && context.valueAmount > rule.maxValue) return false

  return true
}

export class Retriever {
  constructor(private readonly repos: KnowledgeRepositories) {}

  /**
   * Universal applicability resolution — works identically for ANY domain.
   * An item with zero applicability rules is treated as universally applicable.
   */
  async resolveApplicableDocuments(
    domain: string,
    asOfDate: string,
    context: KnowledgeContext,
  ): Promise<readonly KnowledgeItem[]> {
    const items = await this.repos.items.findActive(domain)
    const effective = items.filter(i => isEffectiveOn(i, asOfDate))

    const result: KnowledgeItem[] = []
    for (const item of effective) {
      const rules = await this.repos.applicability.findByItemId(item.id)
      const active = rules.filter(r => r.isActive)
      if (active.length === 0 || active.some(r => matchesApplicability(r, context, asOfDate))) {
        result.push(item)
      }
    }
    return result
  }
}
